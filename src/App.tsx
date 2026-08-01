import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Archive,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Books,
  Brain,
  CaretDown,
  CaretRight,
  Check,
  CheckCircle,
  Copy,
  DownloadSimple,
  FileArrowUp,
  GearSix,
  HighlighterCircle,
  House,
  MagnifyingGlass,
  NotePencil,
  PaperPlaneTilt,
  PencilSimple,
  Quotes,
  ShieldCheck,
  Sparkle,
  Target,
  ThumbsDown,
  ThumbsUp,
  Trash,
  X,
} from "@phosphor-icons/react";
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
  Section,
  StudyDocument,
  StudyNote,
  TextBlock,
  UserPreferences,
} from "./types";
import {
  AppContext,
  useAppContext,
  type MobileStudyView,
  type Overlay,
  type RightTab,
  type SearchScope,
} from "./AppContext";
import { PdfReader } from "./components/PdfReader";
import { MobileStudyTabs } from "./components/MobileStudyTabs";
import { StatusToast } from "./components/StatusToast";
import { ImportDialog } from "./components/ImportDialog";
import { SettingsDialog } from "./components/SettingsDialog";
import { QuizDialog } from "./components/QuizDialog";
import { ReviewDialog, type ReviewQueueItem } from "./components/ReviewDialog";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { demoDocument } from "./lib/demo";
import { IMPORT_LIMITS, rebuildPdfDocument } from "./lib/document";
import { importPipeline, type ImportProgress } from "./lib/importPipeline";
import { createQuiz, scheduleReview } from "./lib/learningEngine";
import {
  askModel,
  checkModel,
  clearDesktopApiKey,
  detectModelCapabilities,
  enhanceCombinedTextBlocks,
  enhanceTextBlocks,
  explainPageImage,
  getDesktopSettings,
  getProviderStatuses,
  isDesktopApp,
  listModels,
  loginProvider,
  logoutProvider,
  saveDesktopSettings,
  type LlmConfig,
  type LlmProvider,
  type ProviderStatus,
} from "./lib/intelligence/client";
import {
  createBrowserStudyRepository,
  type StudyCommand,
  type StudyRepository,
  type WorkspaceSnapshot,
} from "./lib/studyRepository";
import {
  usePersistence,
  useDocumentManager,
  useChat,
  useNoteManager,
  useQuiz,
  useModelConfig,
  useImporter,
  useEnhancement,
  useReaderNav,
} from "./hooks/useAppHooks";

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

function AppInner() {
  const ctx = useAppContext();
  const {
    repository,
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
    query,
    setQuery,
    messages,
    setMessages,
    chatHydratingDocumentId,
    isThinking,
    setIsThinking,
    searchScope,
    setSearchScope,
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
    noteDraft,
    setNoteDraft,
    noteQuote,
    setNoteQuote,
    noteError,
    setNoteError,
    editingNoteId,
    setEditingNoteId,
    noteSearch,
    setNoteSearch,
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
    searchOpen,
    setSearchOpen,
    chapterSearch,
    setChapterSearch,
    searchIndex,
    setSearchIndex,
    highlighterMode,
    setHighlighterMode,
    furthestPercent,
    setFurthestPercent,
    notice,
    setNotice,
    bookSearch,
    setBookSearch,
    bookSort,
    setBookSort,
    showTrash,
    setShowTrash,
    storageUsage,
    setStorageUsage,
    pendingDeleteNoteId,
    setPendingDeleteNoteId,
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
  } = ctx;

  // ── Hooks ──
  const { persistCommand, persistInBackground } = usePersistence();
  const {
    cancelScopedWork,
    applyWorkspace,
    selectDocument,
    selectChapter,
    selectSection,
    renameDocument,
    trashDocument,
    restoreDocument,
    emptyTrash,
  } = useDocumentManager();
  const { submitQuestion, copyMessage, setMessageFeedback } = useChat();
  const { addNote, editNote, deleteNote, exportNotes } = useNoteManager();
  const { openQuiz, gradeQuiz, nextQuiz, setCurrentMastery } = useQuiz(quiz);
  const { testModel, fetchModelOptions, saveSettings, changeAgentLogin } =
    useModelConfig();
  const { handleFile } = useImporter();
  const {
    runEnhancement,
    enhanceCurrentChapter,
    enhanceSelectedBlocks,
    rebuildActiveDocumentSegments,
    explainCurrentPageImage,
    cancelEnhancement,
  } = useEnhancement();

  // ── Derived values (with useMemo — P0-3 fixes) ──
  // These must be computed BEFORE hooks that depend on them.
  const activeDocumentIdMemo = activeDocument.id;
  const activeChapterIdMemo = activeChapter.id;

  const quizItems = useMemo(
    () => makeQuiz(activeChapter),
    [activeChapter.id], // P0-3: depend on id, not object reference
  );

  const chapterNotes = useMemo(() => {
    return notes.filter(
      (note) =>
        note.documentId === activeDocumentIdMemo &&
        note.chapterId === activeChapterIdMemo &&
        (!noteSearch ||
          note.text
            .toLocaleLowerCase("zh-CN")
            .includes(noteSearch.toLocaleLowerCase("zh-CN"))),
    );
  }, [notes, activeDocumentIdMemo, activeChapterIdMemo, noteSearch]);

  const chapterHighlights = useMemo(() => {
    return highlights.filter(
      (item) =>
        item.documentId === activeDocumentIdMemo &&
        item.chapterId === activeChapterIdMemo,
    );
  }, [highlights, activeDocumentIdMemo, activeChapterIdMemo]);

  const searchResults = useMemo(() => {
    const normalized = chapterSearch.trim().toLocaleLowerCase("zh-CN");
    if (!normalized) return [];
    return activeChapter.blocks.filter((block) =>
      (block.smartText || block.text)
        .toLocaleLowerCase("zh-CN")
        .includes(normalized),
    );
  }, [activeChapter.blocks, chapterSearch]);

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

  const visibleLibraryDocuments = useMemo(() => {
    const normalized = bookSearch.trim().toLocaleLowerCase("zh-CN");
    return documents
      .filter(
        (document) =>
          !normalized ||
          `${document.displayTitle || document.title} ${document.filename}`
            .toLocaleLowerCase("zh-CN")
            .includes(normalized),
      )
      .sort((a, b) => {
        if (bookSort === "name") {
          return (a.displayTitle || a.title).localeCompare(
            b.displayTitle || b.title,
            "zh-CN",
          );
        }
        if (bookSort === "created") return b.createdAt - a.createdAt;
        return (
          (b.lastOpenedAt || b.createdAt) - (a.lastOpenedAt || a.createdAt)
        );
      });
  }, [bookSearch, bookSort, documents]);

  const documentQuizHistory = useMemo(
    () =>
      quizAttempts.filter(
        (attempt) => attempt.documentId === activeDocumentIdMemo,
      ),
    [quizAttempts, activeDocumentIdMemo],
  );

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

  const dashboard = useMemo(() => {
    const metrics = dailyMetrics.filter(
      (item) => item.documentId === activeDocumentIdMemo,
    );
    const activeSeconds = metrics.reduce(
      (total, item) => total + item.activeSeconds,
      0,
    );
    const scores = documentQuizHistory.flatMap((attempt) =>
      attempt.scores.filter((score): score is number => score !== null),
    );
    const correctCount = scores.filter((score) => score >= 0.65).length;
    return {
      activeMinutes: Math.round(activeSeconds / 60),
      accuracy: scores.length
        ? Math.round((correctCount / scores.length) * 100)
        : 0,
      weakCount: scores.filter((score) => score < 0.35).length,
    };
  }, [activeDocumentIdMemo, dailyMetrics, documentQuizHistory]);

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

  const selectedProviderStatus = providerStatuses.find(
    (status) => status.provider === config.provider,
  );

  const {
    syncPdfPage,
    pulseCorrespondence,
    findBlockForPage,
    showOriginalPage,
    showTextForPage,
    openCitation,
    toggleHighlight,
    goToSearchResult,
  } = useReaderNav({ searchResults, chapterHighlights });

  const openAnswerCitation = useCallback(
    (citation: import("./types").Citation) => {
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
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

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
  }, []);

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
  }, [config.provider, config.endpoint, config.model]);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      readerRef.current?.scrollTo({ top: 0, behavior: "auto" });
    });
  }, [activeChapterId, readerMode]);

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
    [],
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
  }, [sidebarOpen]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

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
  }, [documents.length, trashedDocuments.length]);

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
    positionPercent,
    readerMode,
    rightTab,
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
  const toggleBlockSelection = useCallback(
    (blockId: string) => {
      setSelectedBlockIds((current) =>
        current.includes(blockId)
          ? current.filter((id) => id !== blockId)
          : [...current, blockId],
      );
    },
    [setSelectedBlockIds],
  );

  // ── Context value ──
  const contextValue = useMemo(
    () => ({
      ...ctx,
    }),
    [ctx],
  );

  return (
    <AppContext.Provider value={contextValue}>
      <div className="app-shell">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setSidebarOpen((value) => !value)}
            aria-label="打开教材目录"
          >
            <BookOpen size={21} />
          </button>
          <button
            className="brand"
            onClick={() => selectDocument(demoDocument)}
            aria-label="返回知页首页"
          >
            <span className="brand-mark" aria-hidden="true">
              <img
                src={`${import.meta.env.BASE_URL}brand/logo-mark.svg`}
                alt=""
              />
            </span>
            <span>
              <strong>知页</strong>
              <small>本地教材伴学</small>
            </span>
          </button>
          <div className="source-scope">
            <ShieldCheck size={17} weight="fill" />
            <span>唯一来源</span>
            <strong>{activeDocument.title}</strong>
          </div>
          <div className="top-actions">
            <span
              className={`model-status ${modelOnline ? "is-online" : ""}`}
              title={
                modelOnline
                  ? `已连接 ${
                      config.provider === "codex"
                        ? "Codex"
                        : config.provider === "claude"
                          ? "Claude"
                          : config.model
                    }`
                  : "使用原文检索模式"
              }
            >
              <i />
              {modelOnline
                ? config.provider === "ollama"
                  ? "本地模型已连接"
                  : config.provider === "codex"
                    ? "Codex 已连接"
                    : config.provider === "claude"
                      ? "Claude 已连接"
                      : "外部模型已连接"
                : "原文检索模式"}
            </span>
            <button
              className="icon-button"
              onClick={() => setOverlay("settings")}
              aria-label="设置"
            >
              <GearSix size={20} />
            </button>
            <button
              className="primary-button"
              onClick={() => setOverlay("upload")}
            >
              <FileArrowUp size={18} />
              导入教材
            </button>
          </div>
        </header>

        {sidebarOpen && (
          <button
            className="sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
            aria-label="关闭教材目录"
          />
        )}
        <div className="workspace">
          <aside
            className={`library-panel ${sidebarOpen ? "is-open" : ""}`}
            aria-label="教材与目录"
          >
            <div className="panel-kicker">
              <span>我的教材</span>
              <span>{documents.length}</span>
            </div>
            <button
              className="book-selector"
              onClick={() => document.getElementById("library-search")?.focus()}
              aria-label="在书库中切换教材"
            >
              <span className="book-spine">
                {activeDocument.title.slice(0, 1)}
              </span>
              <span className="book-meta">
                <strong>
                  {activeDocument.displayTitle || activeDocument.title}
                </strong>
                <small>{activeDocument.filename}</small>
              </span>
              <CaretDown size={16} />
            </button>

            <div className="library-controls">
              <label className="library-search">
                <MagnifyingGlass size={15} />
                <input
                  id="library-search"
                  value={bookSearch}
                  onChange={(event) => setBookSearch(event.target.value)}
                  placeholder="搜索教材"
                />
              </label>
              <select
                aria-label="教材排序"
                value={bookSort}
                onChange={(event) =>
                  setBookSort(
                    event.target.value as "recent" | "name" | "created",
                  )
                }
              >
                <option value="recent">最近阅读</option>
                <option value="created">最近导入</option>
                <option value="name">按名称</option>
              </select>
            </div>
            <div className="other-books library-list">
              {visibleLibraryDocuments.map((document) => (
                <div
                  className={`library-book-row ${
                    document.id === activeDocument.id ? "is-active" : ""
                  }`}
                  key={document.id}
                >
                  <button
                    className="library-book-main"
                    onClick={() => selectDocument(document)}
                  >
                    <BookOpen size={16} />
                    <span>{document.displayTitle || document.title}</span>
                  </button>
                  {document.kind !== "demo" && (
                    <span className="library-book-actions">
                      <button
                        onClick={() => renameDocument(document)}
                        aria-label={`重命名${document.displayTitle || document.title}`}
                      >
                        <PencilSimple size={14} />
                      </button>
                      <button
                        onClick={() => setPendingDeleteDocumentId(document.id)}
                        aria-label={`删除${document.displayTitle || document.title}`}
                      >
                        <Trash size={14} />
                      </button>
                    </span>
                  )}
                </div>
              ))}
            </div>
            <button
              className="trash-toggle"
              onClick={() => setShowTrash((value) => !value)}
            >
              <Archive size={15} />
              回收站
              <span>{trashedDocuments.length}</span>
            </button>
            {showTrash && (
              <div className="trash-list">
                {trashedDocuments.length ? (
                  <>
                    {trashedDocuments.map((document) => (
                      <div key={document.id}>
                        <span>{document.displayTitle || document.title}</span>
                        <button onClick={() => restoreDocument(document.id)}>
                          恢复
                        </button>
                      </div>
                    ))}
                    <button
                      className="empty-trash"
                      onClick={() => {
                        if (
                          window.confirm("永久删除回收站中的教材和学习记录？")
                        ) {
                          emptyTrash();
                        }
                      }}
                    >
                      清空回收站
                    </button>
                  </>
                ) : (
                  <span className="trash-empty">回收站为空</span>
                )}
              </div>
            )}
            {storageUsage && (
              <div className="storage-usage">
                <span>本机存储</span>
                <strong>{storageUsage}</strong>
              </div>
            )}

            <nav className="chapter-nav" aria-label="教材目录">
              <div className="nav-label">目录</div>
              {activeDocument.chapters.map((chapter, index) => {
                const isActive = chapter.id === activeChapter.id;
                return (
                  <div className="chapter-entry" key={chapter.id}>
                    <button
                      className={isActive ? "active" : ""}
                      onClick={() => selectChapter(chapter)}
                    >
                      <span className="chapter-index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>
                        {chapter.title.replace(/^第.+?[章节篇]\s*/, "")}
                      </span>
                      {isActive && <CaretRight size={14} />}
                    </button>
                    {isActive && Boolean(chapter.sections?.length) && (
                      <div
                        className="chapter-sections"
                        aria-label={`${chapter.title}小节`}
                      >
                        {chapter.sections?.map((section) => (
                          <button
                            key={section.id}
                            className={
                              visiblePdfPage === section.page
                                ? "section-active"
                                : ""
                            }
                            onClick={() => selectSection(chapter, section)}
                          >
                            <span>{section.title}</span>
                            <small>第 {section.page} 页</small>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            <div className="study-plan">
              <div className="plan-title">
                <Target size={18} />
                <strong>本章学习</strong>
              </div>
              <div className="plan-row">
                <span>阅读进度</span>
                <strong>{furthestPercent}%</strong>
              </div>
              <div className="progress-track">
                <span style={{ width: `${furthestPercent}%` }} />
              </div>
              <div className="study-history">
                <span>练习记录 {documentQuizHistory.length}</span>
                <span className={dueReviewCount ? "has-due" : ""}>
                  待复习 {dueReviewCount}
                </span>
              </div>
              <div className="learning-dashboard" aria-label="本章学习数据">
                <span>
                  <strong>{dashboard.activeMinutes}</strong>
                  学习分钟
                </span>
                <span>
                  <strong>{dashboard.accuracy}%</strong>
                  答题正确
                </span>
                <span>
                  <strong>{dashboard.weakCount}</strong>
                  薄弱题目
                </span>
              </div>
              <button onClick={openQuiz} aria-label="开始章节练习（底部）">
                开始章节练习
                <ArrowRight size={15} />
              </button>
              <button
                className="review-start"
                onClick={() => setOverlay("review")}
                disabled={!dueReviewCount}
                aria-label={`开始今日复习，共 ${dueReviewCount} 项`}
              >
                今日复习
                <span>{dueReviewCount}</span>
              </button>
            </div>
          </aside>

          <main
            ref={readerRef}
            className={`reader-panel ${
              readerMode === "original" ? "is-original" : ""
            } ${mobileView === "reader" ? "mobile-active" : ""}`}
            onScroll={handleReaderScroll}
          >
            <div className="reader-toolbar">
              <div className="breadcrumb">
                <House size={15} />
                <span>{activeDocument.title}</span>
                <CaretRight size={12} />
                <strong>{activeChapter.title}</strong>
              </div>
              <div className="reader-tools">
                {activeDocument.kind === "pdf" &&
                  activeDocument.originalFile &&
                  activeDocument.parserVersion !== 2 && (
                    <button
                      className="segment-upgrade-button"
                      onClick={rebuildActiveDocumentSegments}
                      disabled={isRebuildingSegments}
                      title="使用标题、缩进和行距重新构建可选择的原文段落"
                    >
                      <Sparkle size={15} />
                      {isRebuildingSegments ? "正在重建分段…" : "重建智能分段"}
                    </button>
                  )}
                {activeDocument.kind === "pdf" &&
                  activeDocument.originalFile && (
                    <div className="reader-mode-switch" aria-label="阅读模式">
                      <button
                        className={readerMode === "original" ? "active" : ""}
                        onClick={() => showOriginalPage(currentTextPage)}
                      >
                        原版教材
                      </button>
                      <button
                        className={readerMode === "text" ? "active" : ""}
                        onClick={() => showTextForPage(visiblePdfPage)}
                      >
                        智能文本
                      </button>
                    </div>
                  )}
                {readerMode === "text" && (
                  <>
                    <button
                      className="enhance-chapter-button"
                      onClick={
                        isEnhancing ? cancelEnhancement : enhanceCurrentChapter
                      }
                      title={
                        modelOnline
                          ? "使用已连接模型整理当前章节"
                          : "先配置并连接 LLM 服务"
                      }
                    >
                      <Sparkle size={15} />
                      {isEnhancing ? "暂停任务" : "AI 优化本章"}
                    </button>
                    <button
                      className={searchOpen ? "active" : ""}
                      title="在当前章节中查找"
                      onClick={() => {
                        setSearchOpen((value) => !value);
                        window.setTimeout(
                          () =>
                            document.getElementById("chapter-search")?.focus(),
                          0,
                        );
                      }}
                    >
                      <MagnifyingGlass size={18} />
                    </button>
                    <button
                      className={highlighterMode ? "active" : ""}
                      title="高亮教材段落"
                      aria-pressed={highlighterMode}
                      onClick={() => {
                        setHighlighterMode((value) => !value);
                        setNotice(
                          highlighterMode
                            ? "已退出高亮模式"
                            : "点击正文段落即可添加或取消高亮",
                        );
                      }}
                    >
                      <HighlighterCircle size={18} />
                    </button>
                    {activeDocument.kind === "pdf" && (
                      <button
                        className={selectionMode ? "active" : ""}
                        onClick={() => {
                          setSelectionMode(!selectionMode);
                          setSelectedBlockIds([]);
                        }}
                        aria-pressed={selectionMode}
                      >
                        编辑分段
                      </button>
                    )}
                    <span>{activeChapter.blocks.length} 个内容片段</span>
                  </>
                )}
              </div>
            </div>
            {searchOpen && readerMode === "text" && (
              <div className="chapter-search-bar" role="search">
                <MagnifyingGlass size={16} />
                <input
                  id="chapter-search"
                  value={chapterSearch}
                  onChange={(event) => {
                    setChapterSearch(event.target.value);
                    setSearchIndex(0);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      goToSearchResult(searchIndex + (event.shiftKey ? -1 : 1));
                    }
                    if (event.key === "Escape") {
                      setSearchOpen(false);
                      setChapterSearch("");
                    }
                  }}
                  placeholder="查找当前章节"
                />
                <span>
                  {searchResults.length
                    ? `${searchIndex + 1} / ${searchResults.length}`
                    : chapterSearch
                      ? "无结果"
                      : "输入关键词"}
                </span>
                <button
                  onClick={() => goToSearchResult(searchIndex - 1)}
                  disabled={!searchResults.length}
                  aria-label="上一个搜索结果"
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  onClick={() => goToSearchResult(searchIndex + 1)}
                  disabled={!searchResults.length}
                  aria-label="下一个搜索结果"
                >
                  <ArrowDown size={15} />
                </button>
                <button
                  onClick={() => {
                    setSearchOpen(false);
                    setChapterSearch("");
                  }}
                  aria-label="关闭章节搜索"
                >
                  <X size={15} />
                </button>
              </div>
            )}
            {selectionMode && readerMode === "text" && (
              <div
                className="segment-editor"
                role="toolbar"
                aria-label="分段编辑"
              >
                <span>已选 {selectedBlockIds.length} 段</span>
                <button onClick={mergeSelectedSegments}>合并</button>
                <button onClick={splitSelectedSegment}>拆分</button>
                <button onClick={toggleSelectedTable}>标记表格</button>
                <button onClick={restoreOriginalSegments}>恢复初始分段</button>
              </div>
            )}

            {readerMode === "original" &&
            activeDocument.kind === "pdf" &&
            activeDocument.originalFile ? (
              <PdfReader
                file={activeDocument.originalFile}
                page={visiblePdfPage}
                blocks={visiblePdfBlocks}
                highlightedBlockId={highlightedBlockId}
                selectionMode={selectionMode}
                selectedBlockIds={selectedBlockIds}
                isEnhancing={isEnhancing}
                enhanceProgress={enhanceProgress}
                onPageChange={syncPdfPage}
                onShowText={showTextForPage}
                onToggleSelection={toggleBlockSelection}
                onSelectionModeChange={(enabled) => {
                  setSelectionMode(enabled);
                  if (!enabled) setSelectedBlockIds([]);
                  setEnhanceError("");
                }}
                onGenerateSelected={enhanceSelectedBlocks}
                visionEnabled={modelSupportsVision}
                isExplainingImage={
                  isThinking && imageExplanationControllerRef.current !== null
                }
                onExplainPageImage={explainCurrentPageImage}
              />
            ) : (
              <article className="page">
                <div className="page-heading">
                  <span>正在学习</span>
                  <h1>{activeChapter.title}</h1>
                  <p>
                    本页内容由教材原文解析生成。提问、练习和笔记均限定在当前教材范围内。
                  </p>
                </div>
                <div className="page-rule" />
                {(enhanceProgress || enhanceError) && (
                  <div
                    className={`enhance-state ${enhanceError ? "is-error" : ""}`}
                    role="status"
                  >
                    {enhanceError || enhanceProgress}
                  </div>
                )}
                {activeChapter.blocks.map((block, index) =>
                  block.smartTextOwnerId &&
                  block.smartTextOwnerId !== block.id ? null : (
                    <section
                      className={`text-block ${
                        highlightedBlockId === block.id
                          ? "correspondence-highlight"
                          : ""
                      } ${
                        chapterHighlights.some(
                          (item) => item.blockId === block.id,
                        )
                          ? "is-persistently-highlighted"
                          : ""
                      } ${
                        searchResults.some((item) => item.id === block.id)
                          ? "search-match"
                          : ""
                      } ${
                        searchResults[searchIndex]?.id === block.id
                          ? "search-current"
                          : ""
                      } ${highlighterMode ? "is-highlight-selectable" : ""} ${
                        selectionMode ? "is-segment-selectable" : ""
                      } ${
                        selectedBlockIds.includes(block.id)
                          ? "is-segment-selected"
                          : ""
                      } ${block.blockKind === "table" ? "is-table-block" : ""}`}
                      key={block.id}
                      id={block.id}
                      data-page={block.page}
                      onClick={() => {
                        setCurrentBlockId(block.id);
                        if (selectionMode) {
                          setSelectedBlockIds((current) =>
                            current.includes(block.id)
                              ? current.filter((id) => id !== block.id)
                              : [...current, block.id],
                          );
                          return;
                        }
                        if (highlighterMode) toggleHighlight(block);
                      }}
                    >
                      <span className="paragraph-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        {block.smartText && (
                          <span className="smart-text-badge">
                            <Sparkle size={11} />
                            AI 整理稿
                          </span>
                        )}
                        <p>{block.smartText || block.text}</p>
                        <div className="text-block-actions">
                          {activeDocument.kind === "pdf" &&
                          activeDocument.originalFile &&
                          block.page ? (
                            <button
                              className="locator"
                              onClick={(event) => {
                                event.stopPropagation();
                                showOriginalPage(block.page!, block.id);
                              }}
                            >
                              <BookOpen size={13} weight="fill" />
                              查看原版 · {block.locator}
                            </button>
                          ) : (
                            <span className="locator is-static">
                              <BookOpen size={13} weight="fill" />
                              {block.locator}
                            </span>
                          )}
                          <button
                            className="highlight-block"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleHighlight(block);
                            }}
                          >
                            <HighlighterCircle size={13} />
                            {chapterHighlights.some(
                              (item) => item.blockId === block.id,
                            )
                              ? "取消高亮"
                              : "高亮"}
                          </button>
                          <button
                            className="highlight-block"
                            onClick={(event) => {
                              event.stopPropagation();
                              setCurrentBlockId(block.id);
                              setCurrentTextPage(block.page || currentTextPage);
                              setNoteQuote(
                                (block.smartText || block.text).slice(0, 180),
                              );
                              setNoteDraft("");
                              setEditingNoteId(null);
                              setRightTab("notes");
                              setMobileView("notes");
                              setNotice("已引用该段，写下你的理解");
                            }}
                          >
                            <NotePencil size={13} />
                            记笔记
                          </button>
                          <button
                            className="explain-block"
                            onClick={(event) => {
                              event.stopPropagation();
                              submitQuestion(
                                `请解释教材中"${block.text.slice(0, 28)}"这段内容`,
                              );
                            }}
                          >
                            <Sparkle size={13} />
                            解释这段
                          </button>
                        </div>
                      </div>
                    </section>
                  ),
                )}
                <div className="chapter-end">
                  <CheckCircle size={24} weight="fill" />
                  <div>
                    <strong>读到这里，检验一下是否真正理解</strong>
                    <span>练习答案只按照本章教材内容进行评分</span>
                  </div>
                  <button onClick={openQuiz} aria-label="开始章节练习">
                    开始章节练习
                    <ArrowRight size={15} />
                  </button>
                </div>
              </article>
            )}
          </main>

          <aside
            className={`study-panel ${
              mobileView !== "reader" ? "mobile-active" : ""
            }`}
            aria-label="伴学与笔记"
          >
            <div className="panel-tabs">
              <button
                className={rightTab === "mentor" ? "active" : ""}
                onClick={() => setRightTab("mentor")}
              >
                <Brain size={16} />
                伴学
              </button>
              <button
                className={rightTab === "notes" ? "active" : ""}
                onClick={() => setRightTab("notes")}
              >
                <NotePencil size={16} />
                笔记
                {chapterNotes.length > 0 && <span>{chapterNotes.length}</span>}
              </button>
            </div>

            {rightTab === "mentor" ? (
              <div className="chat-panel">
                <div className="chat-messages">
                  {messages.map((message) => (
                    <article
                      className={`chat-bubble ${message.role}`}
                      key={message.id}
                    >
                      <div className="bubble-content">
                        <p>{message.text}</p>
                        {message.citations?.length ? (
                          <div className="citation-list">
                            {message.citations.map((citation) => (
                              <button
                                className="citation"
                                key={citation.blockId}
                                onClick={() => openAnswerCitation(citation)}
                              >
                                <Quotes size={12} weight="fill" />
                                {citation.locator}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      {message.role === "assistant" && (
                        <footer className="bubble-actions">
                          <span className="bubble-status">
                            {message.status === "direct"
                              ? "教材依据"
                              : message.status === "inferred"
                                ? "推断回答"
                                : message.status === "insufficient"
                                  ? "未找到依据"
                                  : ""}
                          </span>
                          <button
                            onClick={() => copyMessage(message)}
                            title="复制回答"
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            className={
                              message.feedback === "helpful" ? "is-active" : ""
                            }
                            onClick={() =>
                              setMessageFeedback(message.id, "helpful")
                            }
                            title="有帮助"
                          >
                            <ThumbsUp size={14} />
                          </button>
                          <button
                            className={
                              message.feedback === "unhelpful"
                                ? "is-active"
                                : ""
                            }
                            onClick={() =>
                              setMessageFeedback(message.id, "unhelpful")
                            }
                            title="没帮助"
                          >
                            <ThumbsDown size={14} />
                          </button>
                        </footer>
                      )}
                      {message.role === "assistant" &&
                        message.feedback === "unhelpful" && (
                          <div className="feedback-followup">
                            <label>
                              <span>主要问题</span>
                              <select
                                value={message.feedbackReason || ""}
                                onChange={(event) =>
                                  setMessageFeedback(
                                    message.id,
                                    "unhelpful",
                                    event.target.value as
                                      | "irrelevant"
                                      | "unsupported"
                                      | "unclear"
                                      | "incomplete",
                                  )
                                }
                              >
                                <option value="">请选择</option>
                                <option value="irrelevant">
                                  检索内容不相关
                                </option>
                                <option value="unsupported">
                                  缺少教材依据
                                </option>
                                <option value="unclear">表达不清楚</option>
                                <option value="incomplete">回答不完整</option>
                              </select>
                            </label>
                            {message.question && (
                              <button
                                onClick={() =>
                                  submitQuestion(
                                    `${message.question}（请扩大检索范围，重新核对教材依据后回答）`,
                                  )
                                }
                              >
                                重新检索并回答
                              </button>
                            )}
                          </div>
                        )}
                    </article>
                  ))}
                  {isThinking && (
                    <div className="chat-bubble assistant thinking">
                      <span className="typing-dots">
                        <i />
                        <i />
                        <i />
                      </span>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <label className="search-scope">
                  <span>检索范围</span>
                  <select
                    value={searchScope}
                    onChange={(event) =>
                      setSearchScope(event.target.value as SearchScope)
                    }
                  >
                    <option value="chapter">当前章节</option>
                    <option value="document">整本教材</option>
                    <option value="library">全部教材</option>
                  </select>
                </label>
                <form
                  className="chat-input"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitQuestion();
                  }}
                >
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="输入问题，仅依据当前教材回答…"
                    disabled={
                      isThinking ||
                      chatHydratingDocumentId === activeDocument.id
                    }
                  />
                  <button
                    type="submit"
                    disabled={
                      !query.trim() ||
                      isThinking ||
                      chatHydratingDocumentId === activeDocument.id
                    }
                    aria-label="发送提问"
                  >
                    <PaperPlaneTilt size={18} />
                  </button>
                </form>
              </div>
            ) : (
              <div className="notes-panel">
                <div className="note-editor">
                  {noteQuote && (
                    <blockquote className="note-quote">
                      {noteQuote}
                      <button
                        onClick={() => setNoteQuote("")}
                        aria-label="清除引用"
                      >
                        <X size={13} />
                      </button>
                    </blockquote>
                  )}
                  <textarea
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    placeholder="记录此刻的理解、疑问或待复习内容…"
                  />
                  {noteError && <div className="note-error">{noteError}</div>}
                  <div className="note-editor-actions">
                    <button
                      className="primary-button"
                      onClick={addNote}
                      disabled={!noteDraft.trim()}
                    >
                      {editingNoteId ? "更新笔记" : "保存笔记"}
                    </button>
                    {editingNoteId && (
                      <button
                        className="secondary-button"
                        onClick={() => {
                          setEditingNoteId(null);
                          setNoteDraft("");
                          setNoteQuote("");
                        }}
                      >
                        取消编辑
                      </button>
                    )}
                  </div>
                </div>
                <label className="note-search">
                  <MagnifyingGlass size={14} />
                  <input
                    value={noteSearch}
                    onChange={(event) => setNoteSearch(event.target.value)}
                    placeholder="搜索笔记"
                  />
                </label>
                <button
                  className="export-notes"
                  onClick={exportNotes}
                  disabled={!chapterNotes.length}
                >
                  <DownloadSimple size={14} />
                  导出笔记
                </button>
                <div className="note-list">
                  {chapterNotes.length ? (
                    chapterNotes
                      .sort((a, b) => b.updatedAt - a.updatedAt)
                      .map((note) => (
                        <article className="note-card" key={note.id}>
                          <p>{note.text}</p>
                          <footer>
                            <span>
                              {new Date(note.updatedAt).toLocaleString("zh-CN")}
                            </span>
                            <span>
                              <button
                                onClick={() => editNote(note)}
                                aria-label="编辑笔记"
                              >
                                <PencilSimple size={13} />
                              </button>
                              <button
                                onClick={() => setPendingDeleteNoteId(note.id)}
                                aria-label="删除笔记"
                              >
                                <Trash size={13} />
                              </button>
                            </span>
                          </footer>
                        </article>
                      ))
                  ) : (
                    <div className="empty-notes">
                      <NotePencil size={30} />
                      <strong>还没有章节笔记</strong>
                      <span>写下自己的理解，比复制教材更有帮助。</span>
                    </div>
                  )}
                </div>
                {chapterHighlights.length > 0 && (
                  <div className="highlight-summary">
                    <strong>高亮批注 · {chapterHighlights.length}</strong>
                    {chapterHighlights.map((highlight) => {
                      const block = activeChapter.blocks.find(
                        (item) => item.id === highlight.blockId,
                      );
                      if (!block) return null;
                      return (
                        <button
                          key={highlight.id}
                          onClick={() => openCitation(block.id, block.locator)}
                        >
                          <HighlighterCircle size={14} />
                          <span>
                            {(block.smartText || block.text).slice(0, 54)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>

        <MobileStudyTabs
          value={mobileView}
          onChange={(view) => {
            setMobileView(view);
            if (view !== "reader") setRightTab(view);
          }}
        />
        <StatusToast message={notice} />

        <ImportDialog onFile={handleFile} />
        <SettingsDialog
          onTestModel={testModel}
          onFetchModelOptions={fetchModelOptions}
          onSaveSettings={saveSettings}
          onChangeAgentLogin={changeAgentLogin}
          onClearApiKey={clearSavedApiKey}
          onExportBackup={exportBackup}
          onRestoreBackup={restoreBackup}
          onSavePreferences={savePreferences}
        />
        <QuizDialog
          onGrade={gradeQuiz}
          onNext={nextQuiz}
          onSetMastery={setCurrentMastery}
        />
        <ReviewDialog
          items={dueReviewItems}
          onRate={rateReview}
          onOpenEvidence={openReviewEvidence}
        />
        <ConfirmDialog type="note" onConfirm={deleteNote} />
        <ConfirmDialog type="document" onConfirm={trashDocument} />
      </div>
    </AppContext.Provider>
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
  const [query, setQuery] = useState("");
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
  const [noteDraft, setNoteDraft] = useState("");
  const [noteQuote, setNoteQuote] = useState("");
  const [noteError, setNoteError] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [searchScope, setSearchScope] = useState<SearchScope>("document");
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [chapterSearch, setChapterSearch] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const [highlighterMode, setHighlighterMode] = useState(false);
  const [currentBlockId, setCurrentBlockId] = useState<string | undefined>();
  const [furthestPercent, setFurthestPercent] = useState(0);
  const [notice, setNotice] = useState("");
  const [bookSearch, setBookSearch] = useState("");
  const [bookSort, setBookSort] = useState<"recent" | "name" | "created">(
    "recent",
  );
  const [showTrash, setShowTrash] = useState(false);
  const [storageUsage, setStorageUsage] = useState("");
  const [noteSearch, setNoteSearch] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [pendingDeleteNoteId, setPendingDeleteNoteId] = useState<string | null>(
    null,
  );
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

  // ── Context value ──
  const contextValue: import("./AppContext").AppContextType = useMemo(
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
      query,
      setQuery,
      messages,
      setMessages,
      chatHydratingDocumentId,
      setChatHydratingDocumentId,
      isThinking,
      setIsThinking,
      searchScope,
      setSearchScope,
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
      noteDraft,
      setNoteDraft,
      noteQuote,
      setNoteQuote,
      noteError,
      setNoteError,
      editingNoteId,
      setEditingNoteId,
      noteSearch,
      setNoteSearch,
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
      quiz:
        quizItemsOverride.length > 0
          ? quizItemsOverride
          : makeQuiz(activeChapter),
      quizItemsOverride,
      setQuizItemsOverride,
      searchOpen,
      setSearchOpen,
      chapterSearch,
      setChapterSearch,
      searchIndex,
      setSearchIndex,
      highlighterMode,
      setHighlighterMode,
      furthestPercent,
      setFurthestPercent,
      bookSearch,
      setBookSearch,
      bookSort,
      setBookSort,
      showTrash,
      setShowTrash,
      storageUsage,
      setStorageUsage,
      pendingDeleteNoteId,
      setPendingDeleteNoteId,
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
      reportPersistenceFailure,
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
      query,
      messages,
      chatHydratingDocumentId,
      isThinking,
      searchScope,
      notes,
      highlights,
      quizAttempts,
      reviewSchedules,
      dailyMetrics,
      readingStates,
      preferences,
      noteDraft,
      noteQuote,
      noteError,
      editingNoteId,
      noteSearch,
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
      searchOpen,
      chapterSearch,
      searchIndex,
      highlighterMode,
      furthestPercent,
      bookSearch,
      bookSort,
      showTrash,
      storageUsage,
      pendingDeleteNoteId,
      pendingDeleteDocumentId,
      importState,
      importError,
      importProgress,
      importWithOcr,
      importOcrLanguages,
      reportPersistenceFailure,
    ],
  );

  return (
    <AppContext.Provider value={contextValue}>
      <AppInner />
    </AppContext.Provider>
  );
}

export default App;
