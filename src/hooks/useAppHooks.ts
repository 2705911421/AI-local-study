import { useCallback, useMemo, useRef } from "react";
import type {
  Chapter,
  Highlight,
  QuizItem,
  Section,
  StudyDocument,
  StudyNote,
  TextBlock,
} from "../types";
import {
  useAppContext,
  type MobileStudyView,
  type Overlay,
  type RightTab,
} from "../AppContext";
import { demoDocument } from "../lib/demo";
import {
  createQuiz,
  gradeAnswer,
  retrieve,
  retrieveDocuments,
  scheduleReview,
} from "../lib/learningEngine";
import {
  askModel,
  checkModel,
  detectModelCapabilities,
  enhanceCombinedTextBlocks,
  enhanceTextBlocks,
  explainPageImage,
  getDesktopSettings,
  getProviderStatuses,
  gradeAnswerWithModel,
  generateQuizWithModel,
  isDesktopApp,
  listModels,
  loginProvider,
  logoutProvider,
  saveDesktopSettings,
  type LlmConfig,
} from "../lib/intelligence/client";
import { estimateGeneration } from "../lib/batchGeneration";
import { importPipeline } from "../lib/importPipeline";
import { rebuildPdfDocument } from "../lib/document";
import type { StudyCommand, WorkspaceSnapshot } from "../lib/studyRepository";

// ─── Shared helpers ──────────────────────────────────────────────────

function getWelcomeMessage(document: StudyDocument) {
  return {
    id: "welcome" as const,
    role: "assistant" as const,
    text: `我已载入《${document.title}》。你可以询问概念、要求总结当前章节，或让我根据教材检查你的理解。我的回答只使用这本教材。`,
    status: "direct" as const,
  };
}

// ─── usePersistence ──────────────────────────────────────────────────

export function usePersistence() {
  const { repository, setNotice } = useAppContext();
  const persistenceNoticeAtRef = useRef(0);

  const reportPersistenceFailure = useCallback(
    (message: string, background = false) => {
      const now = Date.now();
      if (background && now - persistenceNoticeAtRef.current < 3200) return;
      persistenceNoticeAtRef.current = now;
      setNotice(message);
    },
    [setNotice],
  );

  const persistCommand = useCallback(
    async (
      command: StudyCommand,
      failureMessage: string,
      background = false,
    ): Promise<WorkspaceSnapshot | null> => {
      try {
        return await repository.apply(command);
      } catch {
        reportPersistenceFailure(failureMessage, background);
        return null;
      }
    },
    [repository, reportPersistenceFailure],
  );

  const persistInBackground = useCallback(
    (command: StudyCommand, failureMessage: string) => {
      void persistCommand(command, failureMessage, true);
    },
    [persistCommand],
  );

  return { persistCommand, persistInBackground, reportPersistenceFailure };
}

// ─── useDocumentManager ──────────────────────────────────────────────

export function useDocumentManager() {
  const ctx = useAppContext();
  const selectionRequestRef = useRef(0);
  const {
    repository,
    documents,
    setDocuments,
    setTrashedDocuments,
    activeDocumentId,
    setActiveDocumentId,
    activeDocument,
    activeChapterId,
    setActiveChapterId,
    readingStates,
    setPdfFocusPage,
    setCurrentTextPage,
    setReaderMode,
    setCurrentBlockId,
    setFurthestPercent,
    setRightTab,
    setSelectionMode,
    setSelectedBlockIds,
    setSidebarOpen,
    setMobileView,
    setMessages,
    setChatHydratingDocumentId,
    setHighlights,
    setNotes,
    setReadingStates,
    setQuizAttempts,
    setReviewSchedules,
    setDailyMetrics,
    setPreferences,
    setNotice,
  } = ctx;

  const { persistCommand, reportPersistenceFailure } = usePersistence();

  const cancelScopedWork = useCallback(() => {
    ctx.questionControllerRef.current?.abort();
    ctx.questionControllerRef.current = null;
    ctx.enhancementControllerRef.current?.abort();
    ctx.enhancementControllerRef.current = null;
    ctx.setIsThinking(false);
    ctx.setIsEnhancing(false);
  }, [ctx]);

  const applyWorkspace = useCallback(
    (workspace: WorkspaceSnapshot) => {
      setDocuments([
        demoDocument,
        ...workspace.documents.filter((d) => d.deletedAt === undefined),
      ]);
      setTrashedDocuments(
        workspace.documents.filter((d) => d.deletedAt !== undefined),
      );
      setNotes(workspace.notes);
      setHighlights(workspace.highlights);
      setReadingStates(workspace.readingStates);
      setQuizAttempts(workspace.quizAttempts);
      setReviewSchedules(workspace.reviewSchedules);
      setDailyMetrics(workspace.dailyMetrics);
      setPreferences(workspace.preferences);
    },
    [
      setDocuments,
      setTrashedDocuments,
      setNotes,
      setHighlights,
      setReadingStates,
      setQuizAttempts,
      setReviewSchedules,
      setDailyMetrics,
      setPreferences,
    ],
  );

  const selectDocument = useCallback(
    (document: StudyDocument) => {
      cancelScopedWork();
      const requestId = selectionRequestRef.current + 1;
      selectionRequestRef.current = requestId;
      const savedState = readingStates.find(
        (item) => item.documentId === document.id,
      );
      const restoredChapter =
        document.chapters.find(
          (chapter) => chapter.id === savedState?.chapterId,
        ) || document.chapters[0];
      const firstPage =
        savedState?.page ||
        restoredChapter.blocks.find((block) => block.page)?.page ||
        1;
      setActiveDocumentId(document.id);
      setActiveChapterId(restoredChapter.id);
      setPdfFocusPage(firstPage);
      setCurrentTextPage(firstPage);
      setReaderMode(
        document.kind === "pdf" && document.originalFile
          ? savedState?.readerMode || "original"
          : "text",
      );
      setCurrentBlockId(savedState?.blockId);
      setFurthestPercent(savedState?.furthestPercent || 0);
      setRightTab(savedState?.rightTab || "mentor");
      setSelectionMode(false);
      setSelectedBlockIds([]);
      setChatHydratingDocumentId(document.id);
      setMessages([getWelcomeMessage(document)]);
      void repository
        .loadWorkspace()
        .then((workspace) => {
          if (selectionRequestRef.current !== requestId) return;
          const session = workspace.chatSessions.find(
            (item) => item.documentId === document.id,
          );
          setMessages(
            session?.messages.length
              ? session.messages
              : [getWelcomeMessage(document)],
          );
          setChatHydratingDocumentId(null);
        })
        .catch(() => {
          if (selectionRequestRef.current !== requestId) return;
          setChatHydratingDocumentId(null);
          reportPersistenceFailure("伴学记录暂时无法读取，本次学习仍可继续");
        });
      setSidebarOpen(false);
      setMobileView("reader");
    },
    [
      cancelScopedWork,
      readingStates,
      repository,
      setActiveDocumentId,
      setActiveChapterId,
      setPdfFocusPage,
      setCurrentTextPage,
      setReaderMode,
      setCurrentBlockId,
      setFurthestPercent,
      setRightTab,
      setSelectionMode,
      setSelectedBlockIds,
      setMessages,
      setChatHydratingDocumentId,
      setSidebarOpen,
      setMobileView,
      reportPersistenceFailure,
    ],
  );

  const selectChapter = useCallback(
    (chapter: Chapter) => {
      cancelScopedWork();
      const startPage = chapter.blocks.find((block) => block.page)?.page || 1;
      ctx.readerRef.current?.scrollTo({ top: 0, behavior: "auto" });
      setActiveChapterId(chapter.id);
      setPdfFocusPage(startPage);
      setCurrentTextPage(startPage);
      setNotice(`学习范围已切换到"${chapter.title}"`);
      setSidebarOpen(false);
    },
    [
      cancelScopedWork,
      ctx.readerRef,
      setActiveChapterId,
      setPdfFocusPage,
      setCurrentTextPage,
      setNotice,
      setSidebarOpen,
    ],
  );

  const selectSection = useCallback(
    (chapter: Chapter, section: Section) => {
      cancelScopedWork();
      if (chapter.id !== activeDocument.chapters[0]?.id) {
        setActiveChapterId(chapter.id);
      }
      setPdfFocusPage(section.page);
      setCurrentTextPage(section.page);
      setReaderMode(
        activeDocument.kind === "pdf" && activeDocument.originalFile
          ? "original"
          : "text",
      );
      ctx.readerRef.current?.scrollTo({ top: 0, behavior: "auto" });
      setSidebarOpen(false);
    },
    [
      cancelScopedWork,
      activeDocument,
      setActiveChapterId,
      setPdfFocusPage,
      setCurrentTextPage,
      setReaderMode,
      ctx.readerRef,
      setSidebarOpen,
    ],
  );

  const renameDocument = useCallback(
    async (document: StudyDocument) => {
      if (document.kind === "demo") return;
      const displayTitle = window.prompt(
        "教材名称",
        document.displayTitle || document.title,
      );
      if (!displayTitle?.trim()) return;
      const workspace = await persistCommand(
        {
          type: "renameDocument",
          documentId: document.id,
          displayTitle,
        },
        "教材名称保存失败，本地记录未改变",
      );
      if (!workspace) return;
      applyWorkspace(workspace);
      setNotice("教材名称已更新");
    },
    [persistCommand, applyWorkspace, setNotice],
  );

  const trashDocument = useCallback(
    async (documentId: string) => {
      const workspace = await persistCommand(
        { type: "trashDocument", documentId },
        "教材未能移入回收站，本地记录未改变",
      );
      if (!workspace) return;
      applyWorkspace(workspace);
      ctx.setPendingDeleteDocumentId(null);
      if (activeDocument.id === documentId) selectDocument(demoDocument);
      setNotice("教材已移入回收站，将保留 30 天");
    },
    [
      persistCommand,
      applyWorkspace,
      activeDocument.id,
      selectDocument,
      setNotice,
      ctx.setPendingDeleteDocumentId,
    ],
  );

  const restoreDocument = useCallback(
    async (documentId: string) => {
      const workspace = await persistCommand(
        { type: "restoreDocument", documentId },
        "教材恢复失败，本地记录未改变",
      );
      if (!workspace) return;
      applyWorkspace(workspace);
      setNotice("教材及学习记录已恢复");
    },
    [persistCommand, applyWorkspace, setNotice],
  );

  const emptyTrash = useCallback(async () => {
    const workspace = await persistCommand(
      { type: "emptyTrash" },
      "回收站清空失败，本地记录未改变",
    );
    if (!workspace) return;
    applyWorkspace(workspace);
    setNotice("回收站已清空，相关数据无法恢复");
  }, [persistCommand, applyWorkspace, setNotice]);

  return {
    cancelScopedWork,
    applyWorkspace,
    selectDocument,
    selectChapter,
    selectSection,
    renameDocument,
    trashDocument,
    restoreDocument,
    emptyTrash,
  };
}

// ─── useChat ─────────────────────────────────────────────────────────

export function useChat() {
  const ctx = useAppContext();
  const {
    activeChapter,
    activeDocument,
    query,
    setQuery,
    messages,
    setMessages,
    isThinking,
    setIsThinking,
    config,
    modelOnline,
    setModelOnline,
    documents,
    searchScope,
  } = ctx;

  const questionControllerRef = ctx.questionControllerRef;

  const submitQuestion = useCallback(
    async (preset?: string) => {
      const question = (preset || query).trim();
      if (!question || isThinking) return;
      if (ctx.chatHydratingDocumentId === activeDocument.id) {
        ctx.setNotice("正在读取该教材的伴学记录，请稍候");
        return;
      }
      questionControllerRef.current?.abort();
      const controller = new AbortController();
      questionControllerRef.current = controller;
      setQuery("");
      const studentMessage = {
        id: crypto.randomUUID(),
        role: "student" as const,
        text: question,
      };
      setMessages((current) => [...current, studentMessage]);
      setIsThinking(true);

      try {
        let citations =
          searchScope === "library"
            ? retrieveDocuments(
                question,
                documents.filter((document) => document.kind !== "demo"),
                activeChapter.id,
                3,
                ctx.preferences.semanticSearchEnabled !== false,
              )
            : retrieve(
                question,
                activeChapter,
                searchScope === "chapter"
                  ? [activeChapter]
                  : activeDocument.chapters,
                3,
                ctx.preferences.semanticSearchEnabled !== false,
              );
        if (
          citations.length === 0 &&
          /总结|概括|梳理|核心|要点/.test(question)
        ) {
          citations = activeChapter.blocks.slice(0, 4).map((block) => ({
            blockId: block.id,
            locator: block.locator,
            excerpt:
              block.text.length > 240
                ? `${block.text.slice(0, 240)}…`
                : block.text,
            score: 0.7,
          }));
        }

        let answer = "";
        let status: "direct" | "inferred" | "insufficient" = "direct";
        if (!citations.length || citations[0].score < 0.1) {
          answer =
            "教材中未找到足够依据。我没有使用教材外知识补充答案。你可以换一种问法，或将学习范围切换到其他章节。";
          status = "insufficient";
        } else if (modelOnline) {
          status = citations[0].score < 0.48 ? "inferred" : "direct";
          try {
            answer = await askModel(
              question,
              citations,
              config,
              controller.signal,
            );
          } catch (error) {
            if (controller.signal.aborted) return;
            setModelOnline(false);
            answer = `当前模型服务未响应。根据检索到的教材原文：${citations[0].excerpt}`;
          }
        } else {
          status = citations[0].score < 0.48 ? "inferred" : "direct";
          answer = `根据教材，${citations[0].excerpt}${
            citations.length > 1
              ? `\n\n相关内容还出现在"${citations[1].locator}"。`
              : ""
          }`;
        }

        if (controller.signal.aborted) return;
        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: answer,
            citations,
            status,
            question,
          },
        ]);
      } finally {
        if (questionControllerRef.current === controller) {
          questionControllerRef.current = null;
          setIsThinking(false);
        }
      }
    },
    [
      query,
      isThinking,
      ctx.chatHydratingDocumentId,
      ctx.setNotice,
      activeChapter,
      activeDocument,
      documents,
      searchScope,
      config,
      modelOnline,
      questionControllerRef,
      setQuery,
      setMessages,
      setIsThinking,
      setModelOnline,
    ],
  );

  const copyMessage = useCallback(
    (message: { text: string }) => {
      void navigator.clipboard
        .writeText(message.text)
        .then(() => ctx.setNotice("回答已复制"))
        .catch(() => ctx.setNotice("复制失败，请手动选择文字"));
    },
    [ctx.setNotice],
  );

  const setMessageFeedback = useCallback(
    (
      messageId: string,
      feedback: "helpful" | "unhelpful",
      feedbackReason?: "irrelevant" | "unsupported" | "unclear" | "incomplete",
    ) => {
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? { ...message, feedback, feedbackReason }
            : message,
        ),
      );
      ctx.setNotice("感谢反馈，已保存在本机");
    },
    [setMessages, ctx.setNotice],
  );

  return { submitQuestion, copyMessage, setMessageFeedback };
}

// ─── useNoteManager ──────────────────────────────────────────────────

export function useNoteManager() {
  const ctx = useAppContext();
  const { activeDocument, activeChapter, notes, setNotes } = ctx;
  const { persistCommand } = usePersistence();

  const addNote = useCallback(async () => {
    const text = ctx.noteDraft.trim();
    if (!text) return;
    const now = Date.now();
    const previous = notes.find((note) => note.id === ctx.editingNoteId);
    const note = {
      id: previous?.id || crypto.randomUUID(),
      documentId: activeDocument.id,
      chapterId: activeChapter.id,
      text,
      createdAt: previous?.createdAt || now,
      updatedAt: now,
      blockId: previous?.blockId || ctx.currentBlockId,
      page: previous?.page || ctx.currentTextPage,
      quote: previous?.quote,
      ...(ctx.noteQuote ? { quote: ctx.noteQuote } : {}),
    };
    const workspace = await persistCommand(
      { type: "saveNote", note },
      "笔记保存失败：浏览器存储不可用或空间不足",
    );
    if (!workspace) {
      ctx.setNoteError("笔记保存失败：浏览器存储不可用或空间不足。");
      return;
    }
    setNotes(workspace.notes);
    ctx.setNoteDraft("");
    ctx.setNoteQuote("");
    ctx.setEditingNoteId(null);
    ctx.setNoteError("");
    ctx.setNotice(previous ? "笔记已更新" : "笔记已保存在本机");
  }, [
    ctx,
    notes,
    activeDocument.id,
    activeChapter.id,
    persistCommand,
    setNotes,
  ]);

  const editNote = useCallback(
    (note: StudyNote) => {
      ctx.setEditingNoteId(note.id);
      ctx.setNoteDraft(note.text);
      ctx.setNoteQuote(note.quote || "");
    },
    [ctx],
  );

  const deleteNote = useCallback(
    async (noteId: string) => {
      const workspace = await persistCommand(
        { type: "deleteNote", noteId },
        "笔记删除失败，本地记录未改变",
      );
      if (!workspace) return;
      setNotes(workspace.notes);
      ctx.setPendingDeleteNoteId(null);
      ctx.setNotice("笔记已删除");
    },
    [persistCommand, setNotes, ctx],
  );

  const exportNotes = useCallback(() => {
    const documentNotes = notes.filter(
      (note) => note.documentId === activeDocument.id,
    );
    const markdown = [
      `# ${activeDocument.displayTitle || activeDocument.title} · 学习笔记`,
      "",
      ...documentNotes.flatMap((note) => [
        `## ${activeDocument.chapters.find((item) => item.id === note.chapterId)?.title || "待归类"}`,
        "",
        note.quote ? `> ${note.quote}` : "",
        note.text,
        "",
        `记录于 ${new Date(note.createdAt).toLocaleString("zh-CN")}`,
        "",
      ]),
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([markdown], { type: "text/markdown;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeDocument.displayTitle || activeDocument.title}-笔记.md`;
    link.click();
    URL.revokeObjectURL(url);
    ctx.setNotice("笔记已导出为 Markdown");
  }, [notes, activeDocument, ctx.setNotice]);

  return { addNote, editNote, deleteNote, exportNotes };
}

// ─── useQuiz ─────────────────────────────────────────────────────────

export function useQuiz(quiz: QuizItem[]) {
  const ctx = useAppContext();
  const {
    activeDocument,
    activeChapter,
    overlay,
    setOverlay,
    modelOnline,
    config,
  } = ctx;
  const { persistCommand } = usePersistence();

  const openQuiz = useCallback(async () => {
    try {
      const workspace = await ctx.repository.loadWorkspace();
      const attempt = [...workspace.quizAttempts]
        .filter(
          (item) =>
            item.documentId === activeDocument.id &&
            item.chapterId === activeChapter.id &&
            !item.completedAt,
        )
        .sort((a, b) => b.updatedAt - a.updatedAt)[0];
      if (attempt) {
        ctx.setQuizItemsOverride(attempt.items);
        ctx.setQuizAttemptId(attempt.id);
        ctx.setQuizIndex(attempt.currentIndex);
        ctx.setQuizAnswer(attempt.draft);
        ctx.setQuizScores(attempt.scores);
        ctx.setQuizMastery(attempt.mastery);
        ctx.setQuizScore(attempt.scores[attempt.currentIndex] ?? null);
      } else {
        let nextQuiz = quiz;
        if (modelOnline) {
          try {
            const generated = await generateQuizWithModel(
              activeChapter.title,
              activeChapter.blocks,
              Math.min(5, activeChapter.blocks.length),
              config,
            );
            if (generated.length) nextQuiz = generated;
          } catch {
            ctx.setNotice("智能出题暂不可用，已使用本地练习");
          }
        }
        ctx.setQuizItemsOverride(nextQuiz);
        ctx.setQuizAttemptId(crypto.randomUUID());
        ctx.setQuizIndex(0);
        ctx.setQuizAnswer("");
        ctx.setQuizScore(null);
        ctx.setQuizScores(nextQuiz.map(() => null));
        ctx.setQuizMastery(nextQuiz.map(() => null));
      }
      setOverlay("quiz");
    } catch {
      ctx.reportPersistenceFailure("练习记录暂时无法读取，请稍后重试");
    }
  }, [
    ctx,
    activeDocument.id,
    activeChapter.id,
    quiz,
    modelOnline,
    config,
    setOverlay,
  ]);

  const gradeQuiz = useCallback(async () => {
    const item = quiz[ctx.quizIndex];
    if (!item) return;
    const result = gradeAnswer(
      ctx.quizAnswer,
      item.keyPoints?.length ? item.keyPoints : [item.answer],
    );
    let score = result.score;
    if (modelOnline) {
      try {
        const modelGrade = await gradeAnswerWithModel(
          ctx.quizAnswer,
          item.answer,
          item.keyPoints || [],
          config,
        );
        score = Math.min(1, Math.max(0, modelGrade.score));
      } catch {
        ctx.setNotice("模型评分不可用，已使用本地保守评分");
      }
    }
    ctx.setQuizScore(score);
    ctx.setQuizScores((current) =>
      current.map((previousScore, index) =>
        index === ctx.quizIndex ? score : previousScore,
      ),
    );
  }, [ctx, quiz, modelOnline, config]);

  const nextQuiz = useCallback(async () => {
    if (ctx.quizIndex < quiz.length - 1) {
      ctx.setQuizIndex((value) => value + 1);
      ctx.setQuizAnswer("");
      ctx.setQuizScore(null);
    } else {
      if (ctx.quizAttemptId) {
        const workspace = await persistCommand(
          {
            type: "saveQuizAttempt",
            quizAttempt: {
              id: ctx.quizAttemptId,
              documentId: activeDocument.id,
              chapterId: activeChapter.id,
              items: quiz,
              currentIndex: ctx.quizIndex,
              draft: ctx.quizAnswer,
              scores: ctx.quizScores,
              mastery: ctx.quizMastery,
              startedAt: Date.now(),
              updatedAt: Date.now(),
              completedAt: Date.now(),
            },
          },
          "练习结果保存失败，请保留当前窗口后重试",
        );
        if (!workspace) return;
        ctx.setQuizAttempts(workspace.quizAttempts);
        ctx.setReviewSchedules(workspace.reviewSchedules);
      }
      setOverlay(null);
      ctx.setNotice("章节练习已完成，结果已保存");
    }
  }, [
    ctx,
    quiz,
    activeDocument.id,
    activeChapter.id,
    persistCommand,
    setOverlay,
  ]);

  const setCurrentMastery = useCallback(
    async (value: "mastered" | "review") => {
      if (value === "review" && quiz[ctx.quizIndex]?.evidenceBlockId) {
        const evidenceBlockId = quiz[ctx.quizIndex].evidenceBlockId!;
        const id = `${activeDocument.id}:${evidenceBlockId}`;
        const scheduling = scheduleReview(
          ctx.reviewSchedules.find((item) => item.id === id),
          "good",
        );
        const workspace = await persistCommand(
          {
            type: "saveReviewSchedule",
            reviewSchedule: {
              id,
              documentId: activeDocument.id,
              chapterId: activeChapter.id,
              evidenceBlockId,
              ...scheduling,
            },
          },
          "复习计划保存失败，本题状态未改变",
        );
        if (!workspace) return;
        ctx.setReviewSchedules(workspace.reviewSchedules);
      }
      ctx.setQuizMastery((current) =>
        current.map((item, index) => (index === ctx.quizIndex ? value : item)),
      );
    },
    [ctx, quiz, activeDocument.id, activeChapter.id, persistCommand],
  );

  return { openQuiz, gradeQuiz, nextQuiz, setCurrentMastery };
}

// ─── useModelConfig ──────────────────────────────────────────────────

export function useModelConfig() {
  const ctx = useAppContext();
  const { config, setConfig, setNotice } = ctx;

  const testModel = useCallback(async () => {
    ctx.modelTestControllerRef.current?.abort();
    const controller = new AbortController();
    ctx.modelTestControllerRef.current = controller;
    ctx.setIsTestingModel(true);
    ctx.setModelOnline(null);
    try {
      if (isDesktopApp()) {
        await saveDesktopSettings(config, true);
        if (config.apiKey) {
          setConfig((current) => ({ ...current, apiKey: "" }));
        }
      }
      const online = await checkModel(config, controller.signal);
      if (!controller.signal.aborted) {
        ctx.setModelOnline(online);
        if (online) {
          const capabilities = await detectModelCapabilities(
            config,
            controller.signal,
          );
          if (!controller.signal.aborted) {
            ctx.setModelSupportsVision(capabilities.vision);
          }
        } else {
          ctx.setModelSupportsVision(false);
        }
        if (isDesktopApp()) {
          const statuses = await getProviderStatuses(config);
          if (!controller.signal.aborted) ctx.setProviderStatuses(statuses);
        }
      }
    } catch {
      // A superseded test should not overwrite the latest connection state.
    } finally {
      if (ctx.modelTestControllerRef.current === controller) {
        ctx.modelTestControllerRef.current = null;
        ctx.setIsTestingModel(false);
      }
    }
  }, [config, ctx]);

  const fetchModelOptions = useCallback(async () => {
    ctx.modelListControllerRef.current?.abort();
    const controller = new AbortController();
    ctx.modelListControllerRef.current = controller;
    ctx.setModelListState("正在从上游获取模型…");
    ctx.setModelOptions([]);
    try {
      if (isDesktopApp()) {
        await saveDesktopSettings(config, true);
        if (config.apiKey) {
          setConfig((current) => ({ ...current, apiKey: "" }));
        }
      }
      const models = await listModels(config, controller.signal);
      if (controller.signal.aborted) return;
      ctx.setModelOptions(models);
      if (models.length) {
        setConfig((current) => ({
          ...current,
          model: models.includes(current.model) ? current.model : models[0],
        }));
        ctx.setModelListState(`已获取 ${models.length} 个模型`);
      } else {
        ctx.setModelListState("上游未返回模型，可继续手动填写");
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      ctx.setModelListState(
        error instanceof Error
          ? `${error.message}，可继续手动填写`
          : "获取失败，可继续手动填写",
      );
    } finally {
      if (ctx.modelListControllerRef.current === controller) {
        ctx.modelListControllerRef.current = null;
      }
    }
  }, [config, ctx, setConfig]);

  const saveSettings = useCallback(async () => {
    try {
      localStorage.setItem("zhiye-llm-provider", config.provider);
      localStorage.setItem("zhiye-llm-endpoint", config.endpoint);
      localStorage.setItem("zhiye-llm-model", config.model);
      localStorage.removeItem("zhiye-llm-api-key");
    } catch {
      ctx.setModelListState("浏览器无法保存设置；本次会话仍可继续使用");
    }
    if (isDesktopApp()) {
      try {
        await saveDesktopSettings(config, true);
        setConfig((current) => ({ ...current, apiKey: "" }));
      } catch (error) {
        ctx.setModelListState(
          error instanceof Error ? error.message : "桌面设置保存失败",
        );
        return;
      }
    }
    void testModel();
  }, [config, ctx, setConfig, testModel]);

  const changeAgentLogin = useCallback(
    async (action: "login" | "logout") => {
      if (config.provider !== "codex" && config.provider !== "claude") return;
      ctx.setIsTestingModel(true);
      ctx.setModelListState(
        action === "login" ? "请在浏览器中完成官方登录…" : "正在退出登录…",
      );
      try {
        const status =
          action === "login"
            ? await loginProvider(config.provider)
            : await logoutProvider(config.provider);
        ctx.setProviderStatuses((current) => [
          ...current.filter((item) => item.provider !== status.provider),
          status,
        ]);
        ctx.setModelOnline(status.availability === "ready");
        ctx.setModelSupportsVision(status.capabilities.vision);
        ctx.setModelListState(
          status.availability === "ready" ? "账号已连接" : "账号已退出",
        );
      } catch (error) {
        ctx.setModelOnline(false);
        ctx.setModelListState(
          error instanceof Error ? error.message : "账号连接失败",
        );
      } finally {
        ctx.setIsTestingModel(false);
      }
    },
    [config, ctx],
  );

  return { testModel, fetchModelOptions, saveSettings, changeAgentLogin };
}

// ─── useImporter ─────────────────────────────────────────────────────

export function useImporter() {
  const ctx = useAppContext();
  const { activeDocument, documents, setDocuments } = ctx;
  const { selectDocument } = useDocumentManager();

  const handleFile = useCallback(
    async (file?: File) => {
      if (!file) return;
      ctx.importControllerRef.current?.abort();
      const controller = new AbortController();
      ctx.importControllerRef.current = controller;
      ctx.setImportState("parsing");
      ctx.setImportError("");
      ctx.setImportProgress(null);
      try {
        const { document: parsed } = await importPipeline.run(file, {
          signal: controller.signal,
          ocr: ctx.importWithOcr,
          ocrLanguages: ctx.importOcrLanguages,
          onProgress: ctx.setImportProgress,
          loadCheckpoint: async (contentHash) => {
            const workspace = await ctx.repository.loadWorkspace();
            return workspace.checkpoints.find(
              (checkpoint) => checkpoint.id === contentHash,
            );
          },
          saveCheckpoint: async (checkpoint) => {
            await ctx.repository.apply({
              type: "saveCheckpoint",
              checkpoint,
            });
          },
          deleteCheckpoint: async (checkpointId) => {
            await ctx.repository.apply({
              type: "deleteCheckpoint",
              checkpointId,
            });
          },
        });
        const existing = documents.find(
          (document) =>
            document.kind !== "demo" &&
            document.contentHash &&
            document.contentHash === parsed.contentHash,
        );
        if (existing) {
          const replace = window.confirm(
            `《${existing.displayTitle || existing.title}》已在书库中。\n\n确定：替换原教材并保留学习记录\n取消：保留为副本`,
          );
          if (replace) {
            parsed.id = existing.id;
            parsed.chapters = parsed.chapters.map((chapter) => ({
              ...chapter,
              id: chapter.id.replace(/^[^:]+:/, `${existing.id}:`),
              blocks: chapter.blocks.map((block) => ({
                ...block,
                id: block.id.replace(/^[^:]+:/, `${existing.id}:`),
                chapterId: block.chapterId.replace(
                  /^[^:]+:/,
                  `${existing.id}:`,
                ),
              })),
            }));
          } else {
            parsed.displayTitle = `${parsed.displayTitle || parsed.title}（副本）`;
          }
        }
        const stored = parsed;
        const workspace = await ctx.repository.apply({
          type: "saveDocument",
          document: stored,
        });
        if (stored.contentHash) {
          await ctx.repository.apply({
            type: "deleteCheckpoint",
            checkpointId: stored.contentHash,
          });
        }
        ctx.setNotes(workspace.notes);
        setDocuments((current) => [
          demoDocument,
          stored,
          ...current.filter(
            (document) =>
              document.id !== demoDocument.id && document.id !== stored.id,
          ),
        ]);
        selectDocument(stored);
        ctx.setImportState("done");
        ctx.setNotice(
          `《${stored.displayTitle || stored.title}》已导入并保存在本机`,
        );
        if (ctx.importCloseTimerRef.current !== null) {
          window.clearTimeout(ctx.importCloseTimerRef.current);
        }
        ctx.importCloseTimerRef.current = window.setTimeout(() => {
          ctx.setOverlay(null);
          ctx.setImportState("idle");
          ctx.importCloseTimerRef.current = null;
        }, 900);
      } catch (error) {
        if (controller.signal.aborted) {
          ctx.setImportState("idle");
          ctx.setImportProgress(null);
          return;
        }
        ctx.setImportState("error");
        ctx.setImportError(
          error instanceof Error ? error.message : "教材导入失败，请重试。",
        );
      } finally {
        if (ctx.importControllerRef.current === controller) {
          ctx.importControllerRef.current = null;
        }
      }
    },
    [documents, ctx, setDocuments, selectDocument],
  );

  return { handleFile };
}

// ─── useEnhancement ──────────────────────────────────────────────────

export function useEnhancement() {
  const ctx = useAppContext();
  const {
    activeDocument,
    activeChapter,
    setDocuments,
    setHighlights,
    modelOnline,
    config,
  } = ctx;
  const { persistCommand } = usePersistence();

  const runEnhancement = useCallback(
    async (targetBlocks: TextBlock[]) => {
      if (ctx.isEnhancing) return;
      if (!modelOnline) {
        ctx.setOverlay("settings");
        return;
      }
      if (!targetBlocks.length) {
        ctx.setEnhanceError("请先选择需要生成智能文本的原文");
        return;
      }
      const jobId = `${activeDocument.id}:${activeChapter.id}:enhance`;
      const workspace = await ctx.repository.loadWorkspace();
      const previousJob = workspace.enhancementJobs.find(
        (job) => job.id === jobId && job.status !== "completed",
      );
      const completedBeforeStart = targetBlocks
        .filter((block) => Boolean(block.smartText?.trim()))
        .map((block) => block.id);
      const pendingBlocks = targetBlocks.filter(
        (block) => !completedBeforeStart.includes(block.id),
      );
      if (!pendingBlocks.length) {
        ctx.setEnhanceProgress("所选原文已全部生成智能文本");
        return 0;
      }
      const { estimatedInputTokens, estimatedOutputTokens, estimatedCost } =
        estimateGeneration(
          pendingBlocks,
          ctx.preferences.inputPricePerMillion,
          ctx.preferences.outputPricePerMillion,
        );
      const pricingConfigured =
        config.provider === "ollama" ||
        Boolean(
          ctx.preferences.inputPricePerMillion ||
          ctx.preferences.outputPricePerMillion,
        );
      const resumeMessage = previousJob
        ? `\n将从上次进度继续，剩余 ${pendingBlocks.length} / ${targetBlocks.length} 段。`
        : "";
      const costMessage = pricingConfigured
        ? `预计费用约 ¥${estimatedCost.toFixed(4)}。`
        : "尚未配置 Token 单价，无法换算费用。";
      if (
        !window.confirm(
          `预计输入约 ${estimatedInputTokens.toLocaleString()} Token，输出约 ${estimatedOutputTokens.toLocaleString()} Token；${costMessage}${resumeMessage}\n\n是否开始？`,
        )
      ) {
        return;
      }
      const baseJob = {
        id: jobId,
        documentId: activeDocument.id,
        chapterId: activeChapter.id,
        blockIds: targetBlocks.map((block) => block.id),
        completedBlockIds: completedBeforeStart,
        failedBlockIds: [] as string[],
        status: "running" as const,
        estimatedInputTokens,
        estimatedOutputTokens,
        updatedAt: Date.now(),
      };
      await ctx.repository.apply({
        type: "saveEnhancementJob",
        job: baseJob,
      });
      ctx.enhancementControllerRef.current?.abort();
      const controller = new AbortController();
      ctx.enhancementControllerRef.current = controller;
      ctx.setIsEnhancing(true);
      ctx.setEnhanceError("");
      ctx.setEnhanceProgress("正在准备教材原文…");
      try {
        const enhanced = await enhanceTextBlocks(
          pendingBlocks,
          config,
          (completed, total, partial) => {
            ctx.setEnhanceProgress(`正在整理 ${completed} / ${total} 段原文`);
            const partialDocument: StudyDocument = {
              ...activeDocument,
              updatedAt: Date.now(),
              chapters: activeDocument.chapters.map((chapter) => ({
                ...chapter,
                blocks: chapter.blocks.map((block) => ({
                  ...block,
                  smartText: partial.get(block.id) || block.smartText,
                })),
              })),
            };
            setDocuments((current) =>
              current.map((document) =>
                document.id === partialDocument.id ? partialDocument : document,
              ),
            );
            void ctx.repository.apply({
              type: "saveDocument",
              document: partialDocument,
            });
            void ctx.repository.apply({
              type: "saveEnhancementJob",
              job: {
                ...baseJob,
                completedBlockIds: [
                  ...new Set([...completedBeforeStart, ...partial.keys()]),
                ],
                updatedAt: Date.now(),
              },
            });
          },
          controller.signal,
          {
            concurrency: ctx.preferences.batchConcurrency,
            requestsPerMinute: ctx.preferences.batchRequestsPerMinute,
            retries: 2,
          },
        );
        if (controller.signal.aborted) return;
        if (!enhanced.size) {
          throw new Error("模型没有返回可用的智能文本");
        }
        const updatedDocument: StudyDocument = {
          ...activeDocument,
          updatedAt: Date.now(),
          chapters: activeDocument.chapters.map((chapter) => ({
            ...chapter,
            blocks: chapter.blocks.map((block) => ({
              ...block,
              smartText: enhanced.get(block.id) || block.smartText,
            })),
          })),
        };
        setDocuments((current) =>
          current.map((document) =>
            document.id === updatedDocument.id ? updatedDocument : document,
          ),
        );
        await ctx.repository.apply({
          type: "saveDocument",
          document: updatedDocument,
        });
        await ctx.repository.apply({
          type: "saveEnhancementJob",
          job: {
            ...baseJob,
            completedBlockIds: targetBlocks.map((block) => block.id),
            status: "completed",
            updatedAt: Date.now(),
          },
        });
        ctx.setEnhanceProgress(`已生成 ${enhanced.size} 个智能文本片段`);
        return enhanced.size;
      } catch (error) {
        if (controller.signal.aborted) {
          await ctx.repository.apply({
            type: "saveEnhancementJob",
            job: {
              ...baseJob,
              status: "paused",
              updatedAt: Date.now(),
            },
          });
          return;
        }
        await ctx.repository.apply({
          type: "saveEnhancementJob",
          job: {
            ...baseJob,
            status: "failed",
            failedBlockIds: pendingBlocks.map((block) => block.id),
            error: error instanceof Error ? error.message : "智能文本生成失败",
            updatedAt: Date.now(),
          },
        });
        ctx.setEnhanceError(
          error instanceof Error ? error.message : "智能文本生成失败",
        );
        ctx.setEnhanceProgress("");
      } finally {
        if (ctx.enhancementControllerRef.current === controller) {
          ctx.enhancementControllerRef.current = null;
          ctx.setIsEnhancing(false);
        }
      }
    },
    [ctx, activeDocument, modelOnline, config, setDocuments],
  );

  const enhanceCurrentChapter = useCallback(async () => {
    const count = await runEnhancement(activeChapter.blocks);
    if (count) ctx.setReaderMode("text");
  }, [runEnhancement, activeChapter, ctx]);

  const cancelEnhancement = useCallback(() => {
    ctx.enhancementControllerRef.current?.abort();
    ctx.setEnhanceProgress("任务已暂停，可再次开始继续处理");
  }, [ctx]);

  const enhanceSelectedBlocks = useCallback(async () => {
    const selected = activeDocument.chapters
      .flatMap((chapter) => chapter.blocks)
      .filter((block) => ctx.selectedBlockIds.includes(block.id));
    if (ctx.isEnhancing) return;
    if (!modelOnline) {
      ctx.setOverlay("settings");
      return;
    }
    if (!selected.length) {
      ctx.setEnhanceError("请先选择需要生成智能文本的原文");
      return;
    }
    ctx.enhancementControllerRef.current?.abort();
    const controller = new AbortController();
    ctx.enhancementControllerRef.current = controller;
    ctx.setIsEnhancing(true);
    ctx.setEnhanceError("");
    ctx.setEnhanceProgress(`正在合并整理 ${selected.length} 段原文…`);
    try {
      const smartText = await enhanceCombinedTextBlocks(
        selected,
        config,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const owner = selected[0];
      const sourceIds = selected.map((block) => block.id);
      const affectedOwnerIds = new Set(
        activeDocument.chapters
          .flatMap((chapter) => chapter.blocks)
          .filter(
            (block) =>
              sourceIds.includes(block.id) ||
              block.smartTextSourceIds?.some((id) => sourceIds.includes(id)),
          )
          .map((block) => block.smartTextOwnerId || block.id),
      );
      const updatedDocument: StudyDocument = {
        ...activeDocument,
        chapters: activeDocument.chapters.map((chapter) => ({
          ...chapter,
          blocks: chapter.blocks.map((block) => {
            const currentOwnerId = block.smartTextOwnerId || block.id;
            const reset = affectedOwnerIds.has(currentOwnerId)
              ? {
                  ...block,
                  smartText: undefined,
                  smartTextSourceIds: undefined,
                  smartTextOwnerId: undefined,
                }
              : block;
            if (!sourceIds.includes(block.id)) return reset;
            if (block.id === owner.id) {
              return {
                ...reset,
                smartText,
                smartTextSourceIds: sourceIds,
                smartTextOwnerId: owner.id,
              };
            }
            return {
              ...reset,
              smartText: undefined,
              smartTextSourceIds: undefined,
              smartTextOwnerId: owner.id,
            };
          }),
        })),
      };
      setDocuments((current) =>
        current.map((document) =>
          document.id === updatedDocument.id ? updatedDocument : document,
        ),
      );
      await ctx.repository.apply({
        type: "saveDocument",
        document: updatedDocument,
      });
      ctx.setEnhanceProgress(
        `已将 ${selected.length} 段原文整理为 1 份智能文本`,
      );
      ctx.setSelectionMode(false);
      ctx.setSelectedBlockIds([]);
    } catch (error) {
      if (controller.signal.aborted) return;
      ctx.setEnhanceError(
        error instanceof Error ? error.message : "智能文本生成失败",
      );
      ctx.setEnhanceProgress("");
    } finally {
      if (ctx.enhancementControllerRef.current === controller) {
        ctx.enhancementControllerRef.current = null;
        ctx.setIsEnhancing(false);
      }
    }
  }, [ctx, activeDocument, modelOnline, config, setDocuments]);

  const rebuildActiveDocumentSegments = useCallback(async () => {
    if (
      ctx.isRebuildingSegments ||
      activeDocument.kind !== "pdf" ||
      !activeDocument.originalFile
    ) {
      return;
    }
    const hasGeneratedText = activeDocument.chapters.some((chapter) =>
      chapter.blocks.some((block) => Boolean(block.smartText)),
    );
    const linkedHighlights = ctx.highlights.filter(
      (highlight) => highlight.documentId === activeDocument.id,
    );
    if (
      (hasGeneratedText || linkedHighlights.length > 0) &&
      !window.confirm(
        "重建会替换旧的机械分段。已有 AI 整理稿和段落高亮无法可靠对应，将被清除；笔记与阅读进度会保留。是否继续？",
      )
    ) {
      return;
    }
    ctx.setIsRebuildingSegments(true);
    ctx.setNotice("正在依据 PDF 版面重建语义分段，请稍候…");
    try {
      const rebuilt = await rebuildPdfDocument(activeDocument);
      const targetChapter =
        rebuilt.chapters.find((chapter) =>
          chapter.blocks.some((block) => block.page === ctx.currentTextPage),
        ) ||
        rebuilt.chapters.find(
          (chapter) => chapter.title === activeChapter.title,
        ) ||
        rebuilt.chapters[0];
      setDocuments((current) =>
        current.map((document) =>
          document.id === rebuilt.id ? rebuilt : document,
        ),
      );
      let workspace = await ctx.repository.apply({
        type: "saveDocument",
        document: rebuilt,
      });
      for (const highlight of linkedHighlights) {
        workspace = await ctx.repository.apply({
          type: "deleteHighlight",
          highlightId: highlight.id,
        });
      }
      setHighlights(workspace.highlights);
      ctx.setActiveChapterId(targetChapter.id);
      ctx.setSelectedBlockIds([]);
      ctx.setSelectionMode(false);
      ctx.setHighlightedBlockId(null);
      ctx.setNotice("智能分段已重建：标题、缩进段落和编号层级将分别选择");
    } catch (error) {
      ctx.setNotice(
        error instanceof Error ? error.message : "智能分段重建失败",
      );
    } finally {
      ctx.setIsRebuildingSegments(false);
    }
  }, [ctx, activeDocument, activeChapter, setDocuments, setHighlights]);

  const explainCurrentPageImage = useCallback(
    async (page: number, dataUrl: string) => {
      if (!modelOnline || !ctx.modelSupportsVision || ctx.isThinking) return;
      ctx.imageExplanationControllerRef.current?.abort();
      const controller = new AbortController();
      ctx.imageExplanationControllerRef.current = controller;
      ctx.setRightTab("mentor");
      ctx.setMobileView("mentor");
      ctx.setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "student",
          text: `讲解原版教材第 ${page} 页中的演示图`,
        },
      ]);
      ctx.setIsThinking(true);
      try {
        const answer = await explainPageImage(
          dataUrl,
          page,
          config,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        ctx.setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: answer,
            status: "direct",
          },
        ]);
      } catch (error) {
        if (controller.signal.aborted) return;
        ctx.setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text:
              error instanceof Error
                ? `图示讲解失败：${error.message}`
                : "图示讲解失败，请检查模型服务。",
            status: "insufficient",
          },
        ]);
      } finally {
        if (ctx.imageExplanationControllerRef.current === controller) {
          ctx.imageExplanationControllerRef.current = null;
          ctx.setIsThinking(false);
        }
      }
    },
    [ctx, modelOnline, config],
  );

  return {
    runEnhancement,
    enhanceCurrentChapter,
    enhanceSelectedBlocks,
    rebuildActiveDocumentSegments,
    explainCurrentPageImage,
    cancelEnhancement,
  };
}

// ─── useReaderNav ────────────────────────────────────────────────────

export function useReaderNav({
  searchResults,
  chapterHighlights,
}: {
  searchResults: import("../types").TextBlock[];
  chapterHighlights: import("../types").Highlight[];
}) {
  const ctx = useAppContext();
  const { activeDocument, activeChapter, readerMode } = ctx;

  const highlightTimerRef = ctx.highlightTimerRef;

  const syncPdfPage = useCallback(
    (page: number) => {
      ctx.setPdfFocusPage(page);
      ctx.setCurrentTextPage(page);
      const matchingChapter = activeDocument.chapters.find((chapter) =>
        chapter.blocks.some((block) => block.page === page),
      );
      if (matchingChapter && matchingChapter.id !== activeChapter.id) {
        ctx.setActiveChapterId(matchingChapter.id);
      }
    },
    [activeDocument, activeChapter, ctx],
  );

  const pulseCorrespondence = useCallback(
    (blockId?: string) => {
      if (!blockId) return;
      ctx.setHighlightedBlockId(blockId);
      if (highlightTimerRef.current !== null) {
        window.clearTimeout(highlightTimerRef.current);
      }
      highlightTimerRef.current = window.setTimeout(() => {
        ctx.setHighlightedBlockId(null);
        highlightTimerRef.current = null;
      }, 4000);
    },
    [ctx, highlightTimerRef],
  );

  const findBlockForPage = useCallback(
    (page: number) => {
      return activeDocument.chapters
        .flatMap((chapter) => chapter.blocks)
        .find((block) => block.page === page);
    },
    [activeDocument],
  );

  const showOriginalPage = useCallback(
    (page: number, blockId?: string) => {
      syncPdfPage(page);
      pulseCorrespondence(blockId || findBlockForPage(page)?.id);
      ctx.setReaderMode("original");
      ctx.readerRef.current?.scrollTo({ top: 0, behavior: "auto" });
    },
    [syncPdfPage, pulseCorrespondence, findBlockForPage, ctx],
  );

  const showTextForPage = useCallback(
    (page: number, blockId?: string) => {
      const matchingChapter =
        activeDocument.chapters.find((chapter) =>
          chapter.blocks.some((block) => block.page === page),
        ) || activeChapter;
      if (matchingChapter.id !== activeChapter.id) {
        ctx.setActiveChapterId(matchingChapter.id);
      }
      const requestedBlock =
        matchingChapter.blocks.find((block) => block.id === blockId) ||
        matchingChapter.blocks.find((block) => block.page === page);
      ctx.setCurrentTextPage(page);
      pulseCorrespondence(requestedBlock?.id);
      ctx.setReaderMode("text");

      const scrollWhenReady = (attempt = 0) => {
        const blocks = [
          ...(ctx.readerRef.current?.querySelectorAll<HTMLElement>(
            ".text-block[data-page]",
          ) || []),
        ];
        const matchingBlock =
          blocks.find((block) => block.id === requestedBlock?.id) ||
          blocks.find((block) => Number(block.dataset.page) === page) ||
          blocks.find((block) => Number(block.dataset.page) > page);
        if (matchingBlock) {
          matchingBlock.scrollIntoView({ behavior: "auto", block: "start" });
        } else if (attempt < 8) {
          window.setTimeout(() => scrollWhenReady(attempt + 1), 25);
        } else {
          ctx.readerRef.current?.scrollTo({ top: 0, behavior: "auto" });
        }
      };
      window.setTimeout(scrollWhenReady, 50);
    },
    [activeDocument, activeChapter, pulseCorrespondence, ctx],
  );

  const openCitation = useCallback(
    (blockId: string, locator: string) => {
      if (activeDocument.kind === "pdf" && activeDocument.originalFile) {
        const page = Number(locator.match(/第\s*(\d+)\s*页/)?.[1]);
        if (page) {
          showOriginalPage(page, blockId);
          return;
        }
      }
      ctx.setReaderMode("text");
      window.setTimeout(() => {
        document.getElementById(blockId)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 0);
    },
    [activeDocument, showOriginalPage, ctx],
  );

  const toggleHighlight = useCallback(
    async (block: TextBlock) => {
      const existing = chapterHighlights.find(
        (item) => item.blockId === block.id,
      );
      const { persistCommand } = await Promise.resolve({
        persistCommand: async (
          command: import("../lib/studyRepository").StudyCommand,
          failureMessage: string,
        ) => {
          try {
            return await ctx.repository.apply(command);
          } catch {
            ctx.setNotice(failureMessage);
            return null;
          }
        },
      });
      if (existing) {
        const workspace = await persistCommand(
          { type: "deleteHighlight", highlightId: existing.id },
          "取消高亮失败，本地记录未改变",
        );
        if (!workspace) return;
        ctx.setHighlights(workspace.highlights);
        ctx.setNotice("已取消高亮");
        return;
      }
      const highlight = {
        id: crypto.randomUUID(),
        documentId: activeDocument.id,
        chapterId: activeChapter.id,
        blockId: block.id,
        createdAt: Date.now(),
      };
      const workspace = await persistCommand(
        { type: "saveHighlight", highlight },
        "高亮保存失败，请检查本地存储空间",
      );
      if (!workspace) return;
      ctx.setHighlights(workspace.highlights);
      ctx.setNotice("段落已加入高亮批注");
    },
    [ctx, activeDocument, activeChapter],
  );

  const goToSearchResult = useCallback(
    (index: number) => {
      if (!searchResults.length) return;
      const nextIndex = (index + searchResults.length) % searchResults.length;
      ctx.setSearchIndex(nextIndex);
      const block = searchResults[nextIndex];
      ctx.setCurrentBlockId(block.id);
      window.setTimeout(() => {
        document.getElementById(block.id)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
    },
    [ctx],
  );

  return {
    syncPdfPage,
    pulseCorrespondence,
    findBlockForPage,
    showOriginalPage,
    showTextForPage,
    openCitation,
    toggleHighlight,
    goToSearchResult,
  };
}
