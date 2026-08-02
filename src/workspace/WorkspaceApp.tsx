import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../styles.css";
import type {
  Chapter,
  ChatMessage,
  DailyStudyMetric,
  Highlight,
  QuizAttempt,
  QuizItem,
  ReadingState,
  ReviewSchedule,
  ReviewRating,
  StudyDocument,
  StudyNote,
  TextBlock,
  UserPreferences,
} from "../types";
import type {
  WorkspaceRuntime,
  MobileStudyView,
  Overlay,
  RightTab,
} from "./WorkspaceRuntime";
import type { ReviewQueueItem } from "../components/ReviewDialog";
import { WorkspaceTopbar } from "../components/workspace/WorkspaceTopbar";
import { WorkspaceOverlays } from "../components/workspace/WorkspaceOverlays";
import { LibrarySidebar } from "../components/workspace/LibrarySidebar";
import { ReaderPane } from "../components/workspace/ReaderPane";
import { StudyPanel } from "../components/workspace/StudyPanel";
import { demoDocument } from "../lib/demo";
import type { ImportProgress } from "../lib/importPipeline";
import { createQuiz, scheduleReview } from "../lib/learningEngine";
import {
  clearDesktopApiKey,
  getDesktopSettings,
  getProviderStatuses,
  isDesktopApp,
  type LlmConfig,
  type LlmProvider,
  type ProviderStatus,
} from "../lib/intelligence/client";
import {
  createBrowserStudyRepository,
  type StudyRepository,
  type WorkspaceSnapshot,
} from "../lib/studyRepository";
import { usePersistence } from "./operations/persistence";
import { useDocumentManager } from "./operations/documents";
import { useChat } from "./operations/assistant";
import { useQuiz } from "./operations/learning";
import { useModelConfig } from "./operations/intelligence";
import { useImporter } from "./operations/importer";
import { useEnhancement } from "./operations/enhancement";
import { useReaderNav } from "./operations/reader";
import { useNotes, WorkspaceProvider } from "./WorkspaceDomains";

function readSetting(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

const savedProviderValue = readSetting("zhiye-llm-provider");
const savedProvider: LlmProvider = [
  "codex",
  "claude",
  "ollama",
  "openai-compatible",
].includes(savedProviderValue || "")
  ? (savedProviderValue as LlmProvider)
  : "ollama";
try {
  localStorage.removeItem("zhiye-llm-api-key");
} catch {
  // Storage may be disabled; the key is never read back into application state.
}
const defaultConfig: LlmConfig = {
  provider: savedProvider,
  endpoint:
    readSetting("zhiye-llm-endpoint") ||
    readSetting("zhiye-ollama-endpoint") ||
    (savedProvider === "ollama"
      ? "http://localhost:11434"
      : savedProvider === "openai-compatible"
        ? "https://api.openai.com/v1"
        : ""),
  model:
    readSetting("zhiye-llm-model") ||
    readSetting("zhiye-ollama-model") ||
    (savedProvider === "ollama" ? "qwen3:4b" : ""),
  apiKey: "",
};

const defaultRepository = createBrowserStudyRepository();

function useStableCallback<T extends (...args: never[]) => unknown>(
  callback: T,
): T {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  return useCallback(
    ((...args: Parameters<T>) => callbackRef.current(...args)) as T,
    [],
  );
}

function getWelcomeMessage(document: StudyDocument): ChatMessage {
  return {
    id: "welcome",
    role: "assistant",
    text: `我已载入《${document.title}》。你可以询问概念、要求总结当前章节，或让我根据教材检查你的理解。我的回答只使用这本教材。`,
    status: "direct",
  };
}

function makeQuiz(chapter: Chapter): QuizItem[] {
  return createQuiz(chapter, 5);
}

// ─── Inner App (consumes hooks) ─────────────────────────────────────

function AppInner({ runtime: ctx }: { runtime: WorkspaceRuntime }) {
  const {
    repository,
    documents,
    setDocuments,
    trashedDocuments,
    setTrashedDocuments,
    setActiveDocumentId,
    activeDocument,
    activeChapterId,
    setActiveChapterId,
    activeChapter,
    overlay,
    setOverlay,
    rightTab,
    setRightTab,
    messages,
    setMessages,
    chatHydratingDocumentId,
    isThinking,
    setNotes,
    highlights,
    setHighlights,
    setQuizAttempts,
    reviewSchedules,
    setReviewSchedules,
    dailyMetrics,
    setDailyMetrics,
    setReadingStates,
    preferences,
    setPreferences,
    config,
    setConfig,
    setModelOnline,
    setModelSupportsVision,
    setProviderStatuses,
    selectedBlockIds,
    setSelectedBlockIds,
    sidebarOpen,
    setSidebarOpen,
    readerMode,
    setReaderMode,
    pdfFocusPage,
    setPdfFocusPage,
    currentTextPage,
    setCurrentTextPage,
    currentBlockId,
    setCurrentBlockId,
    setHighlightedBlockId,
    quizIndex,
    quizAnswer,
    quizScores,
    quizMastery,
    quizAttemptId,
    quiz,
    furthestPercent,
    setFurthestPercent,
    notice,
    setNotice,
    setStorageUsage,
    readerRef,
    chatEndRef,
    highlightTimerRef,
    importCloseTimerRef,
    questionControllerRef,
    modelTestControllerRef,
    modelListControllerRef,
    enhancementControllerRef,
    imageExplanationControllerRef,
    importControllerRef,
  } = ctx;

  // ── Hooks ──
  const noteDomain = useNotes();
  const { persistCommand, persistInBackground } = usePersistence(ctx);
  const {
    applyWorkspace,
    selectDocument,
    selectChapter,
    selectSection,
    renameDocument,
    trashDocument,
    restoreDocument,
    emptyTrash,
  } = useDocumentManager(ctx);
  const stableSelectDocument = useStableCallback(selectDocument);
  const stableSelectChapter = useStableCallback(selectChapter);
  const stableSelectSection = useStableCallback(selectSection);
  const stableRenameDocument = useStableCallback(renameDocument);
  const stableRestoreDocument = useStableCallback(restoreDocument);
  const stableEmptyTrash = useStableCallback(emptyTrash);
  const { submitQuestion, copyMessage, setMessageFeedback } = useChat(ctx);
  const { openQuiz, gradeQuiz, nextQuiz, setCurrentMastery } = useQuiz(
    quiz,
    ctx,
  );
  const stableOpenQuiz = useStableCallback(openQuiz);
  const { testModel, fetchModelOptions, saveSettings, changeAgentLogin } =
    useModelConfig(ctx);
  const { handleFile } = useImporter(ctx, stableSelectDocument);
  const {
    enhanceCurrentChapter,
    enhanceSelectedBlocks,
    rebuildActiveDocumentSegments,
    explainCurrentPageImage,
    cancelEnhancement,
  } = useEnhancement(ctx);

  // ── Derived values (with useMemo — P0-3 fixes) ──
  // These must be computed BEFORE hooks that depend on them.
  const activeDocumentIdMemo = activeDocument.id;
  const activeChapterIdMemo = activeChapter.id;

  const chapterHighlights = useMemo(() => {
    return highlights.filter(
      (item) =>
        item.documentId === activeDocumentIdMemo &&
        item.chapterId === activeChapterIdMemo,
    );
  }, [highlights, activeDocumentIdMemo, activeChapterIdMemo]);

  const allBlocks = useMemo(
    () => activeDocument.chapters.flatMap((chapter) => chapter.blocks),
    [activeDocument.chapters],
  );

  const currentBlockIndex = useMemo(
    () =>
      Math.max(
        0,
        allBlocks.findIndex((block) => block.id === currentBlockId),
      ),
    [allBlocks, currentBlockId],
  );

  const positionPercent = useMemo(
    () =>
      allBlocks.length
        ? Math.round(((currentBlockIndex + 1) / allBlocks.length) * 100)
        : 0,
    [allBlocks, currentBlockIndex],
  );

  const chapterStartPage =
    activeChapter.blocks.find((block) => block.page)?.page || 1;
  const visiblePdfPage = pdfFocusPage || chapterStartPage;

  const dueReviewItems = useMemo<ReviewQueueItem[]>(() => {
    const now = Date.now();
    return reviewSchedules
      .filter((item) => item.dueAt <= now)
      .flatMap((schedule) => {
        const document = documents.find(
          (candidate) =>
            candidate.id === schedule.documentId && !candidate.deletedAt,
        );
        const chapter = document?.chapters.find(
          (candidate) => candidate.id === schedule.chapterId,
        );
        const block = chapter?.blocks.find(
          (candidate) => candidate.id === schedule.evidenceBlockId,
        );
        return document && chapter && block
          ? [{ schedule, document, chapterTitle: chapter.title, block }]
          : [];
      })
      .sort((a, b) => a.schedule.dueAt - b.schedule.dueAt);
  }, [documents, reviewSchedules]);
  const dueReviewCount = dueReviewItems.length;

  const recordDailyMetric = useCallback(
    (
      updates: Partial<
        Pick<
          DailyStudyMetric,
          | "activeSeconds"
          | "pagesRead"
          | "questionsAnswered"
          | "correctAnswers"
          | "reviewsCompleted"
        >
      >,
    ) => {
      if (activeDocument.kind === "demo") return;
      const date = new Date().toLocaleDateString("en-CA");
      const id = `${date}:${activeDocument.id}`;
      const current = dailyMetrics.find((item) => item.id === id);
      const next: DailyStudyMetric = {
        id,
        date,
        documentId: activeDocument.id,
        activeSeconds:
          (current?.activeSeconds || 0) + (updates.activeSeconds || 0),
        pagesRead: Math.max(current?.pagesRead || 0, updates.pagesRead || 0),
        questionsAnswered:
          (current?.questionsAnswered || 0) + (updates.questionsAnswered || 0),
        correctAnswers:
          (current?.correctAnswers || 0) + (updates.correctAnswers || 0),
        reviewsCompleted:
          (current?.reviewsCompleted || 0) + (updates.reviewsCompleted || 0),
        updatedAt: Date.now(),
      };
      setDailyMetrics((items) => [
        next,
        ...items.filter((item) => item.id !== id),
      ]);
      persistInBackground(
        { type: "saveDailyMetric", metric: next },
        "学习统计暂未保存，将在下次活动时重试",
      );
    },
    [
      activeDocument.id,
      activeDocument.kind,
      dailyMetrics,
      persistInBackground,
      setDailyMetrics,
    ],
  );

  const rateReview = useCallback(
    async (item: ReviewQueueItem, rating: ReviewRating) => {
      const workspace = await persistCommand(
        {
          type: "saveReviewSchedule",
          reviewSchedule: {
            ...item.schedule,
            ...scheduleReview(item.schedule, rating),
          },
        },
        "复习进度保存失败，请稍后重试",
      );
      if (workspace) {
        setReviewSchedules(workspace.reviewSchedules);
        recordDailyMetric({ reviewsCompleted: 1 });
        setNotice("复习计划已更新");
      }
    },
    [persistCommand, recordDailyMetric, setReviewSchedules, setNotice],
  );

  const persistSegmentEdit = useCallback(
    async (chapters: Chapter[], successMessage: string) => {
      if (activeDocument.kind !== "pdf") return;
      const updated: StudyDocument = {
        ...activeDocument,
        sourceChapters:
          activeDocument.sourceChapters ||
          structuredClone(activeDocument.chapters),
        chapters,
        updatedAt: Date.now(),
      };
      const workspace = await persistCommand(
        { type: "saveDocument", document: updated },
        "分段修改保存失败，请稍后重试",
      );
      if (!workspace) return;
      setDocuments((items) =>
        items.map((document) =>
          document.id === updated.id ? updated : document,
        ),
      );
      setSelectedBlockIds([]);
      setNotice(successMessage);
    },
    [
      activeDocument,
      persistCommand,
      setDocuments,
      setNotice,
      setSelectedBlockIds,
    ],
  );

  const mergeSelectedSegments = useCallback(() => {
    const selected = activeChapter.blocks.filter((block) =>
      selectedBlockIds.includes(block.id),
    );
    if (selected.length < 2) {
      setNotice("请至少选择两个连续段落");
      return;
    }
    const selectedIndexes = selected.map((block) =>
      activeChapter.blocks.indexOf(block),
    );
    const consecutive = selectedIndexes.every(
      (value, index) => index === 0 || value === selectedIndexes[index - 1] + 1,
    );
    if (!consecutive) {
      setNotice("只能合并连续段落");
      return;
    }
    const owner = {
      ...selected[0],
      text: selected.map((block) => block.text).join("\n"),
      smartText: undefined,
      blockKind: selected.some((block) => block.blockKind === "table")
        ? ("table" as const)
        : selected[0].blockKind,
    };
    const removed = new Set(selected.slice(1).map((block) => block.id));
    void persistSegmentEdit(
      activeDocument.chapters.map((chapter) =>
        chapter.id === activeChapter.id
          ? {
              ...chapter,
              blocks: chapter.blocks
                .map((block) => (block.id === owner.id ? owner : block))
                .filter((block) => !removed.has(block.id)),
            }
          : chapter,
      ),
      "已合并所选段落",
    );
  }, [
    activeChapter,
    activeDocument.chapters,
    persistSegmentEdit,
    selectedBlockIds,
    setNotice,
  ]);

  const splitSelectedSegment = useCallback(() => {
    const block = activeChapter.blocks.find((candidate) =>
      selectedBlockIds.includes(candidate.id),
    );
    if (!block || selectedBlockIds.length !== 1) {
      setNotice("请选择一个段落进行拆分");
      return;
    }
    const parts = block.text
      .split(/(?<=[。！？；])/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length < 2) {
      setNotice("该段落没有可用的句子边界");
      return;
    }
    const middle = Math.ceil(parts.length / 2);
    const replacements: TextBlock[] = [
      { ...block, id: `${block.id}:a`, text: parts.slice(0, middle).join("") },
      { ...block, id: `${block.id}:b`, text: parts.slice(middle).join("") },
    ].map((item) => ({ ...item, smartText: undefined }));
    void persistSegmentEdit(
      activeDocument.chapters.map((chapter) =>
        chapter.id === activeChapter.id
          ? {
              ...chapter,
              blocks: chapter.blocks.flatMap((candidate) =>
                candidate.id === block.id ? replacements : [candidate],
              ),
            }
          : chapter,
      ),
      "已拆分所选段落",
    );
  }, [
    activeChapter,
    activeDocument.chapters,
    persistSegmentEdit,
    selectedBlockIds,
    setNotice,
  ]);

  const toggleSelectedTable = useCallback(() => {
    if (!selectedBlockIds.length) {
      setNotice("请先选择需要标记的段落");
      return;
    }
    void persistSegmentEdit(
      activeDocument.chapters.map((chapter) =>
        chapter.id === activeChapter.id
          ? {
              ...chapter,
              blocks: chapter.blocks.map((block) =>
                selectedBlockIds.includes(block.id)
                  ? {
                      ...block,
                      blockKind:
                        block.blockKind === "table" ? "paragraph" : "table",
                    }
                  : block,
              ),
            }
          : chapter,
      ),
      "已更新表格标记",
    );
  }, [
    activeChapter.id,
    activeDocument.chapters,
    persistSegmentEdit,
    selectedBlockIds,
    setNotice,
  ]);

  const restoreOriginalSegments = useCallback(() => {
    if (!activeDocument.sourceChapters) {
      setNotice("当前教材没有分段修改");
      return;
    }
    void persistSegmentEdit(
      structuredClone(activeDocument.sourceChapters),
      "已恢复初始解析结果",
    );
  }, [activeDocument.sourceChapters, persistSegmentEdit, setNotice]);

  const openReviewEvidence = useCallback(
    (item: ReviewQueueItem) => {
      selectDocument(item.document);
      setActiveChapterId(item.schedule.chapterId);
      setReaderMode("text");
      setCurrentBlockId(item.block.id);
      setHighlightedBlockId(item.block.id);
      setOverlay(null);
    },
    [
      selectDocument,
      setActiveChapterId,
      setReaderMode,
      setCurrentBlockId,
      setHighlightedBlockId,
      setOverlay,
    ],
  );

  const visiblePdfBlocks = useMemo(
    () =>
      activeDocument.chapters
        .flatMap((chapter) => chapter.blocks)
        .filter((block) => block.page === visiblePdfPage),
    [activeDocument.chapters, visiblePdfPage],
  );

  const {
    syncPdfPage,
    showOriginalPage,
    showTextForPage,
    openCitation,
    toggleHighlight,
    goToSearchResult,
  } = useReaderNav({ chapterHighlights }, ctx);

  const openAnswerCitation = useCallback(
    (citation: import("../types").Citation) => {
      const targetDocument = citation.documentId
        ? documents.find((document) => document.id === citation.documentId)
        : activeDocument;
      if (targetDocument && targetDocument.id !== activeDocument.id) {
        selectDocument(targetDocument);
        if (citation.chapterId) setActiveChapterId(citation.chapterId);
        setReaderMode("text");
        setCurrentBlockId(citation.blockId);
        window.setTimeout(() => {
          document.getElementById(citation.blockId)?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 80);
        return;
      }
      openCitation(citation.blockId, citation.locator);
    },
    [
      activeDocument,
      documents,
      openCitation,
      selectDocument,
      setActiveChapterId,
      setCurrentBlockId,
      setReaderMode,
    ],
  );

  // ── Effects ──
  useEffect(() => {
    let cancelled = false;
    void repository
      .apply({ type: "purgeExpiredTrash" })
      .then((workspace: WorkspaceSnapshot) => {
        if (cancelled) return;
        const saved = workspace.documents.filter(
          (document) => document.deletedAt === undefined,
        );
        setTrashedDocuments(
          workspace.documents.filter(
            (document) => document.deletedAt !== undefined,
          ),
        );
        setDocuments([demoDocument, ...saved]);
        setNotes(workspace.notes);
        setHighlights(workspace.highlights);
        setReadingStates(workspace.readingStates);
        setQuizAttempts(workspace.quizAttempts);
        setReviewSchedules(workspace.reviewSchedules);
        setDailyMetrics(workspace.dailyMetrics);
        setPreferences(workspace.preferences);
        const lastState = [...workspace.readingStates].sort(
          (a, b) => b.updatedAt - a.updatedAt,
        )[0];
        const restoredDocument = saved.find(
          (document) => document.id === lastState?.documentId,
        );
        if (restoredDocument && lastState) {
          setActiveDocumentId(restoredDocument.id);
          setActiveChapterId(
            restoredDocument.chapters.some(
              (chapter) => chapter.id === lastState.chapterId,
            )
              ? lastState.chapterId
              : restoredDocument.chapters[0].id,
          );
          setReaderMode(
            restoredDocument.kind === "pdf" && restoredDocument.originalFile
              ? lastState.readerMode
              : "text",
          );
          setPdfFocusPage(lastState.page || null);
          setCurrentTextPage(lastState.page || 1);
          setCurrentBlockId(lastState.blockId);
          setFurthestPercent(lastState.furthestPercent);
          setRightTab(lastState.rightTab);
          const session = workspace.chatSessions.find(
            (item) => item.documentId === restoredDocument.id,
          );
          setMessages(
            session?.messages.length
              ? session.messages
              : [getWelcomeMessage(restoredDocument)],
          );
        }
      })
      .catch(() => {
        setNotice("本地学习记录暂时无法读取，演示教材仍可使用");
      });
    return () => {
      cancelled = true;
    };
  }, [
    repository,
    setActiveChapterId,
    setActiveDocumentId,
    setCurrentBlockId,
    setCurrentTextPage,
    setDailyMetrics,
    setDocuments,
    setFurthestPercent,
    setHighlights,
    setMessages,
    setNotes,
    setNotice,
    setPdfFocusPage,
    setPreferences,
    setQuizAttempts,
    setReaderMode,
    setReadingStates,
    setReviewSchedules,
    setRightTab,
    setTrashedDocuments,
  ]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatEndRef, messages, isThinking]);

  useEffect(() => {
    if (!isDesktopApp()) return;
    let cancelled = false;
    void getDesktopSettings()
      .then(async (settings) => {
        if (!settings || cancelled) return;
        const next: LlmConfig = {
          provider: settings.provider,
          endpoint: settings.endpoint,
          model: settings.model,
          apiKey: "",
        };
        setConfig(next);
        if (settings.credentialsReset) {
          setNotice("安全升级已清除旧版通用 API Key，请为对应来源重新填写");
        }
        setOverlay((current) =>
          settings.firstRunComplete && current === "settings"
            ? null
            : !settings.firstRunComplete
              ? "settings"
              : current,
        );
        const statuses = await getProviderStatuses(next);
        if (!cancelled) setProviderStatuses(statuses);
      })
      .catch(() => {
        if (!cancelled) setNotice("桌面智能来源暂时无法初始化");
      });
    return () => {
      cancelled = true;
    };
  }, [setConfig, setNotice, setOverlay, setProviderStatuses]);

  useEffect(() => {
    if (!window.zhiyeDesktop) return;
    let cancelled = false;
    void window.zhiyeDesktop
      .getAutoBackupSettings()
      .then(async (settings) => {
        if (cancelled || !settings.enabled) return;
        const today = new Date().toLocaleDateString("en-CA");
        const lastDate = settings.lastBackupAt
          ? new Date(settings.lastBackupAt).toLocaleDateString("en-CA")
          : "";
        if (lastDate === today) return;
        const payload = await repository.exportPortableBackup();
        if (cancelled) return;
        await window.zhiyeDesktop!.writeAutoBackup(await payload.arrayBuffer());
        if (!cancelled) setNotice("今日自动备份已完成");
      })
      .catch(() => {
        if (!cancelled) setNotice("自动备份暂未完成，可在设置中重试");
      });
    return () => {
      cancelled = true;
    };
  }, [repository, setNotice]);

  useEffect(() => {
    setModelOnline(null);
    setModelSupportsVision(false);
  }, [
    config.provider,
    config.endpoint,
    config.model,
    setModelOnline,
    setModelSupportsVision,
  ]);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      readerRef.current?.scrollTo({ top: 0, behavior: "auto" });
    });
  }, [activeChapterId, readerMode, readerRef]);

  useEffect(
    () => () => {
      if (highlightTimerRef.current !== null) {
        window.clearTimeout(highlightTimerRef.current);
      }
      if (importCloseTimerRef.current !== null) {
        window.clearTimeout(importCloseTimerRef.current);
      }
      questionControllerRef.current?.abort();
      modelTestControllerRef.current?.abort();
      modelListControllerRef.current?.abort();
      enhancementControllerRef.current?.abort();
      imageExplanationControllerRef.current?.abort();
      importControllerRef.current?.abort();
    },
    [
      enhancementControllerRef,
      highlightTimerRef,
      imageExplanationControllerRef,
      importCloseTimerRef,
      importControllerRef,
      modelListControllerRef,
      modelTestControllerRef,
      questionControllerRef,
    ],
  );

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = preferences.theme;
    root.dataset.fontScale = preferences.fontScale;
    root.dataset.lineHeight = preferences.lineHeight;
    root.dataset.readingWidth = preferences.readingWidth;
  }, [preferences]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const previous = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [setSidebarOpen, sidebarOpen]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice, setNotice]);

  useEffect(() => {
    if (!navigator.storage?.estimate) return;
    void navigator.storage.estimate().then(({ usage, quota }) => {
      if (!usage || !quota) return;
      setStorageUsage(
        `${(usage / 1024 / 1024).toFixed(1)} MB / ${(
          quota /
          1024 /
          1024 /
          1024
        ).toFixed(1)} GB`,
      );
    });
  }, [documents.length, setStorageUsage, trashedDocuments.length]);

  useEffect(() => {
    if (activeDocument.kind === "demo") return;
    const timer = window.setTimeout(() => {
      const nextFurthest = Math.max(furthestPercent, positionPercent);
      const readingState: ReadingState = {
        documentId: activeDocument.id,
        chapterId: activeChapter.id,
        readerMode,
        page: readerMode === "original" ? visiblePdfPage : currentTextPage,
        blockId: currentBlockId,
        positionPercent,
        furthestPercent: nextFurthest,
        rightTab,
        updatedAt: Date.now(),
      };
      setFurthestPercent(nextFurthest);
      setReadingStates((current) => [
        readingState,
        ...current.filter((item) => item.documentId !== activeDocument.id),
      ]);
      persistInBackground(
        { type: "saveReadingState", readingState },
        "阅读进度暂未保存，将在下次阅读变化时重试",
      );
    }, 350);
    return () => window.clearTimeout(timer);
  }, [
    activeDocument.id,
    activeDocument.kind,
    activeChapter.id,
    currentBlockId,
    currentTextPage,
    furthestPercent,
    persistInBackground,
    positionPercent,
    readerMode,
    rightTab,
    setFurthestPercent,
    setReadingStates,
    visiblePdfPage,
  ]);

  useEffect(() => {
    if (activeDocument.kind === "demo") return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      recordDailyMetric({
        activeSeconds: 60,
        pagesRead: readerMode === "original" ? visiblePdfPage : currentTextPage,
      });
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [
    activeDocument.kind,
    currentTextPage,
    readerMode,
    recordDailyMetric,
    visiblePdfPage,
  ]);

  useEffect(() => {
    if (
      activeDocument.kind === "demo" ||
      !messages.length ||
      chatHydratingDocumentId === activeDocument.id
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      persistInBackground(
        {
          type: "saveChatSession",
          chatSession: {
            documentId: activeDocument.id,
            messages,
            updatedAt: Date.now(),
          },
        },
        "伴学记录暂未保存，将在下次对话变化时重试",
      );
    }, 400);
    return () => window.clearTimeout(timer);
  }, [
    activeDocument.id,
    activeDocument.kind,
    chatHydratingDocumentId,
    messages,
    persistInBackground,
  ]);

  useEffect(() => {
    if (overlay !== "quiz" || !quizAttemptId || !quiz.length) return;
    const timer = window.setTimeout(() => {
      persistInBackground(
        {
          type: "saveQuizAttempt",
          quizAttempt: {
            id: quizAttemptId,
            documentId: activeDocument.id,
            chapterId: activeChapter.id,
            items: quiz,
            currentIndex: quizIndex,
            draft: quizAnswer,
            scores: quizScores.length ? quizScores : quiz.map(() => null),
            mastery: quizMastery.length ? quizMastery : quiz.map(() => null),
            startedAt: Date.now(),
            updatedAt: Date.now(),
          },
        },
        "练习草稿暂未保存，将在下次答题变化时重试",
      );
    }, 300);
    return () => window.clearTimeout(timer);
  }, [
    activeDocument.id,
    activeChapter.id,
    overlay,
    quiz,
    quizAnswer,
    quizAttemptId,
    quizIndex,
    quizMastery,
    quizScores,
    persistInBackground,
  ]);

  // ── P0-4: Scroll throttle with requestAnimationFrame ──
  const scrollRafRef = useRef<number | null>(null);
  const handleReaderScroll = useCallback(() => {
    if (readerMode !== "text" || !readerRef.current) return;
    if (scrollRafRef.current !== null) return; // already scheduled
    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null;
      if (!readerRef.current) return;
      const readerTop = readerRef.current.getBoundingClientRect().top + 64;
      const blocks = [
        ...readerRef.current.querySelectorAll<HTMLElement>(
          ".text-block[data-page]",
        ),
      ];
      let closestPage = currentTextPage;
      let closestBlock = currentBlockId;
      let closestDistance = Number.POSITIVE_INFINITY;
      blocks.forEach((block) => {
        const page = Number(block.dataset.page);
        const distance = Math.abs(
          block.getBoundingClientRect().top - readerTop,
        );
        if (distance < closestDistance) {
          closestDistance = distance;
          closestBlock = block.id;
          if (page) closestPage = page;
        }
      });
      if (closestPage !== currentTextPage) setCurrentTextPage(closestPage);
      if (closestBlock !== currentBlockId) setCurrentBlockId(closestBlock);
    });
  }, [
    readerMode,
    readerRef,
    currentTextPage,
    currentBlockId,
    setCurrentTextPage,
    setCurrentBlockId,
  ]);

  // ── Backup helpers ──
  const exportBackup = useCallback(
    async (passphrase: string) => {
      try {
        const blob = await repository.exportBackup(passphrase);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `知页备份-${new Date().toISOString().slice(0, 10)}.zhiye-backup`;
        link.click();
        URL.revokeObjectURL(url);
        setNotice("加密完整备份已导出");
        return true;
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "备份导出失败");
        return false;
      }
    },
    [repository, setNotice],
  );

  const restoreBackup = useCallback(
    async (
      file: File,
      passphrase?: string,
      mode: "replace" | "merge" = "merge",
    ) => {
      try {
        const workspace = await repository.restoreBackup(file, {
          passphrase,
          mode,
        });
        applyWorkspace(workspace);
        setNotice(mode === "merge" ? "备份已合并恢复" : "备份已替换恢复");
        return true;
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "备份恢复失败");
        return false;
      }
    },
    [repository, applyWorkspace, setNotice],
  );

  const savePreferences = useCallback(
    (next: UserPreferences) => {
      setPreferences(next);
      void persistCommand(
        { type: "savePreferences", preferences: next },
        "阅读设置已应用，但未能保存；重启后可能恢复原设置",
      );
    },
    [setPreferences, persistCommand],
  );

  const clearSavedApiKey = useCallback(async () => {
    if (
      config.provider !== "claude" &&
      config.provider !== "openai-compatible"
    ) {
      return false;
    }
    try {
      await clearDesktopApiKey(config.provider);
      setConfig((current) => ({ ...current, apiKey: "" }));
      setModelOnline(null);
      setNotice("已清除当前来源保存的 API Key");
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "API Key 清除失败");
      return false;
    }
  }, [config.provider, setConfig, setModelOnline, setNotice]);

  // ── Toggle block selection ──
  return (
    <div className="app-shell">
      <WorkspaceTopbar onOpenHome={() => selectDocument(demoDocument)} />
      <div className="workspace">
        <LibrarySidebar
          visiblePdfPage={visiblePdfPage}
          dueReviewCount={dueReviewCount}
          onSelectDocument={stableSelectDocument}
          onRenameDocument={stableRenameDocument}
          onRestoreDocument={stableRestoreDocument}
          onEmptyTrash={stableEmptyTrash}
          onSelectChapter={stableSelectChapter}
          onSelectSection={stableSelectSection}
          onOpenQuiz={stableOpenQuiz}
        />

        <ReaderPane
          containerRef={readerRef}
          visiblePdfPage={visiblePdfPage}
          visiblePdfBlocks={visiblePdfBlocks}
          chapterHighlights={chapterHighlights}
          onScroll={handleReaderScroll}
          onRebuildSegments={rebuildActiveDocumentSegments}
          onShowOriginalPage={showOriginalPage}
          onShowTextForPage={showTextForPage}
          onEnhanceChapter={enhanceCurrentChapter}
          onCancelEnhancement={cancelEnhancement}
          onGoToSearchResult={goToSearchResult}
          onMergeSegments={mergeSelectedSegments}
          onSplitSegment={splitSelectedSegment}
          onToggleTable={toggleSelectedTable}
          onRestoreSegments={restoreOriginalSegments}
          onSyncPdfPage={syncPdfPage}
          onEnhanceSelected={enhanceSelectedBlocks}
          onExplainPageImage={explainCurrentPageImage}
          onToggleHighlight={toggleHighlight}
          onSubmitQuestion={submitQuestion}
          onOpenQuiz={stableOpenQuiz}
        />

        <StudyPanel
          chatEndRef={chatEndRef}
          chapterHighlights={chapterHighlights}
          onOpenAnswerCitation={openAnswerCitation}
          onOpenCitation={openCitation}
          onCopyMessage={copyMessage}
          onSetMessageFeedback={setMessageFeedback}
          onSubmitQuestion={submitQuestion}
        />
      </div>

      <WorkspaceOverlays
        onFile={handleFile}
        onTestModel={testModel}
        onFetchModelOptions={fetchModelOptions}
        onSaveSettings={saveSettings}
        onChangeAgentLogin={changeAgentLogin}
        onClearApiKey={clearSavedApiKey}
        onExportBackup={exportBackup}
        onRestoreBackup={restoreBackup}
        onSavePreferences={savePreferences}
        onGradeQuiz={gradeQuiz}
        onNextQuiz={nextQuiz}
        onSetMastery={setCurrentMastery}
        reviewItems={dueReviewItems}
        onRateReview={rateReview}
        onOpenReviewEvidence={openReviewEvidence}
        onDeleteNote={noteDomain.deleteNote}
        onDeleteDocument={trashDocument}
      />
    </div>
  );
}

// ─── Outer App (state + provider) ────────────────────────────────────

interface AppProps {
  studyRepository?: StudyRepository;
}

function App({ studyRepository = defaultRepository }: AppProps = {}) {
  const repository = studyRepository;

  // ── All state lives here ──
  const [documents, setDocuments] = useState<StudyDocument[]>([demoDocument]);
  const [trashedDocuments, setTrashedDocuments] = useState<StudyDocument[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState(demoDocument.id);
  const [activeChapterId, setActiveChapterId] = useState(
    demoDocument.chapters[0].id,
  );
  const [overlay, setOverlay] = useState<Overlay>(
    isDesktopApp() ? "settings" : null,
  );
  const [rightTab, setRightTab] = useState<RightTab>("mentor");
  const [messages, setMessages] = useState<ChatMessage[]>([
    getWelcomeMessage(demoDocument),
  ]);
  const [chatHydratingDocumentId, setChatHydratingDocumentId] = useState<
    string | null
  >(null);
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([]);
  const [reviewSchedules, setReviewSchedules] = useState<ReviewSchedule[]>([]);
  const [dailyMetrics, setDailyMetrics] = useState<DailyStudyMetric[]>([]);
  const [readingStates, setReadingStates] = useState<ReadingState[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: "auto",
    fontScale: "medium",
    lineHeight: "comfortable",
    readingWidth: "medium",
    semanticSearchEnabled: true,
    batchConcurrency: 2,
    batchRequestsPerMinute: 30,
    inputPricePerMillion: 0,
    outputPricePerMillion: 0,
  });
  const [isThinking, setIsThinking] = useState(false);
  const [importState, setImportState] = useState<
    "idle" | "parsing" | "done" | "error"
  >("idle");
  const [importError, setImportError] = useState("");
  const [config, setConfig] = useState(defaultConfig);
  const [modelOnline, setModelOnline] = useState<boolean | null>(null);
  const [modelSupportsVision, setModelSupportsVision] = useState(false);
  const [isTestingModel, setIsTestingModel] = useState(false);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [modelListState, setModelListState] = useState("");
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>(
    [],
  );
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isRebuildingSegments, setIsRebuildingSegments] = useState(false);
  const [enhanceProgress, setEnhanceProgress] = useState("");
  const [enhanceError, setEnhanceError] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileView, setMobileView] = useState<MobileStudyView>("reader");
  const [readerMode, setReaderMode] = useState<"original" | "text">("text");
  const [pdfFocusPage, setPdfFocusPage] = useState<number | null>(null);
  const [currentTextPage, setCurrentTextPage] = useState(1);
  const [highlightedBlockId, setHighlightedBlockId] = useState<string | null>(
    null,
  );
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState("");
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [quizMastery, setQuizMastery] = useState<
    Array<"mastered" | "review" | null>
  >([]);
  const [quizScores, setQuizScores] = useState<Array<number | null>>([]);
  const [quizAttemptId, setQuizAttemptId] = useState<string | null>(null);
  const [quizItemsOverride, setQuizItemsOverride] = useState<QuizItem[]>([]);
  const [highlighterMode, setHighlighterMode] = useState(false);
  const [currentBlockId, setCurrentBlockId] = useState<string | undefined>();
  const [furthestPercent, setFurthestPercent] = useState(0);
  const [notice, setNotice] = useState("");
  const [storageUsage, setStorageUsage] = useState("");
  const [pendingDeleteDocumentId, setPendingDeleteDocumentId] = useState<
    string | null
  >(null);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(
    null,
  );
  const [importWithOcr, setImportWithOcr] = useState(false);
  const [importOcrLanguages, setImportOcrLanguages] = useState<string[]>([
    "chi_sim",
    "eng",
  ]);

  // ── Refs ──
  const readerRef = useRef<HTMLElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const importCloseTimerRef = useRef<number | null>(null);
  const questionControllerRef = useRef<AbortController | null>(null);
  const modelTestControllerRef = useRef<AbortController | null>(null);
  const modelListControllerRef = useRef<AbortController | null>(null);
  const enhancementControllerRef = useRef<AbortController | null>(null);
  const imageExplanationControllerRef = useRef<AbortController | null>(null);
  const importControllerRef = useRef<AbortController | null>(null);

  // ── Derived values ──
  const activeDocument =
    documents.find((document) => document.id === activeDocumentId) ||
    documents[0];
  const activeChapter =
    activeDocument.chapters.find((chapter) => chapter.id === activeChapterId) ||
    activeDocument.chapters[0];
  const quiz = useMemo(
    () =>
      quizItemsOverride.length > 0
        ? quizItemsOverride
        : makeQuiz(activeChapter),
    [activeChapter, quizItemsOverride],
  );

  // ── Context value ──
  const contextValue: WorkspaceRuntime = useMemo(
    () => ({
      repository,
      notice,
      setNotice,
      documents,
      setDocuments,
      trashedDocuments,
      setTrashedDocuments,
      activeDocumentId,
      setActiveDocumentId,
      activeDocument,
      activeChapterId,
      setActiveChapterId,
      activeChapter,
      overlay,
      setOverlay,
      rightTab,
      setRightTab,
      messages,
      setMessages,
      chatHydratingDocumentId,
      setChatHydratingDocumentId,
      isThinking,
      setIsThinking,
      notes,
      setNotes,
      highlights,
      setHighlights,
      quizAttempts,
      setQuizAttempts,
      reviewSchedules,
      setReviewSchedules,
      dailyMetrics,
      setDailyMetrics,
      readingStates,
      setReadingStates,
      preferences,
      setPreferences,
      config,
      setConfig,
      modelOnline,
      setModelOnline,
      modelSupportsVision,
      setModelSupportsVision,
      isTestingModel,
      setIsTestingModel,
      modelOptions,
      setModelOptions,
      modelListState,
      setModelListState,
      providerStatuses,
      setProviderStatuses,
      isEnhancing,
      setIsEnhancing,
      isRebuildingSegments,
      setIsRebuildingSegments,
      enhanceProgress,
      setEnhanceProgress,
      enhanceError,
      setEnhanceError,
      selectionMode,
      setSelectionMode,
      selectedBlockIds,
      setSelectedBlockIds,
      sidebarOpen,
      setSidebarOpen,
      mobileView,
      setMobileView,
      readerMode,
      setReaderMode,
      pdfFocusPage,
      setPdfFocusPage,
      currentTextPage,
      setCurrentTextPage,
      currentBlockId,
      setCurrentBlockId,
      highlightedBlockId,
      setHighlightedBlockId,
      quizIndex,
      setQuizIndex,
      quizAnswer,
      setQuizAnswer,
      quizScore,
      setQuizScore,
      quizScores,
      setQuizScores,
      quizMastery,
      setQuizMastery,
      quizAttemptId,
      setQuizAttemptId,
      quiz,
      quizItemsOverride,
      setQuizItemsOverride,
      highlighterMode,
      setHighlighterMode,
      furthestPercent,
      setFurthestPercent,
      storageUsage,
      setStorageUsage,
      pendingDeleteDocumentId,
      setPendingDeleteDocumentId,
      importState,
      setImportState,
      importError,
      setImportError,
      importProgress,
      setImportProgress,
      importWithOcr,
      setImportWithOcr,
      importOcrLanguages,
      setImportOcrLanguages,
      readerRef,
      chatEndRef,
      highlightTimerRef,
      importCloseTimerRef,
      questionControllerRef,
      modelTestControllerRef,
      modelListControllerRef,
      enhancementControllerRef,
      imageExplanationControllerRef,
      importControllerRef,
    }),
    [
      repository,
      notice,
      documents,
      trashedDocuments,
      activeDocumentId,
      activeDocument,
      activeChapterId,
      activeChapter,
      overlay,
      rightTab,
      messages,
      chatHydratingDocumentId,
      isThinking,
      notes,
      highlights,
      quizAttempts,
      reviewSchedules,
      dailyMetrics,
      readingStates,
      preferences,
      config,
      modelOnline,
      modelSupportsVision,
      isTestingModel,
      modelOptions,
      modelListState,
      providerStatuses,
      isEnhancing,
      isRebuildingSegments,
      enhanceProgress,
      enhanceError,
      selectionMode,
      selectedBlockIds,
      sidebarOpen,
      mobileView,
      readerMode,
      pdfFocusPage,
      currentTextPage,
      currentBlockId,
      highlightedBlockId,
      quizIndex,
      quizAnswer,
      quizScore,
      quizScores,
      quizMastery,
      quizAttemptId,
      quizItemsOverride,
      quiz,
      highlighterMode,
      furthestPercent,
      storageUsage,
      pendingDeleteDocumentId,
      importState,
      importError,
      importProgress,
      importWithOcr,
      importOcrLanguages,
    ],
  );

  return (
    <WorkspaceProvider runtime={contextValue}>
      <AppInner runtime={contextValue} />
    </WorkspaceProvider>
  );
}

export default App;
