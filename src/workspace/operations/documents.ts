import { useCallback, useRef } from "react";
import type { Chapter, Section, StudyDocument } from "../../types";
import type { WorkspaceRuntime } from "../WorkspaceRuntime";
import { demoDocument } from "../../lib/demo";
import type { WorkspaceSnapshot } from "../../lib/studyRepository";
import { usePersistence } from "./persistence";

type DocumentManagerRuntime = Pick<
  WorkspaceRuntime,
  | "activeDocument"
  | "enhancementControllerRef"
  | "questionControllerRef"
  | "readerRef"
  | "readingStates"
  | "repository"
  | "setActiveChapterId"
  | "setActiveDocumentId"
  | "setChatHydratingDocumentId"
  | "setCurrentBlockId"
  | "setCurrentTextPage"
  | "setDailyMetrics"
  | "setDocuments"
  | "setFurthestPercent"
  | "setHighlights"
  | "setIsEnhancing"
  | "setIsThinking"
  | "setMessages"
  | "setMobileView"
  | "setNotes"
  | "setNotice"
  | "setPdfFocusPage"
  | "setPendingDeleteDocumentId"
  | "setPreferences"
  | "setQuizAttempts"
  | "setReaderMode"
  | "setReadingStates"
  | "setReviewSchedules"
  | "setRightTab"
  | "setSelectedBlockIds"
  | "setSelectionMode"
  | "setSidebarOpen"
  | "setTrashedDocuments"
>;

function getWelcomeMessage(document: StudyDocument) {
  return {
    id: "welcome" as const,
    role: "assistant" as const,
    text: `我已载入《${document.title}》。你可以询问概念、要求总结当前章节，或让我根据教材检查你的理解。我的回答只使用这本教材。`,
    status: "direct" as const,
  };
}

export function useDocumentManager(ctx: DocumentManagerRuntime) {
  const selectionRequestRef = useRef(0);
  const {
    repository,
    setDocuments,
    setTrashedDocuments,
    setActiveDocumentId,
    activeDocument,
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
    setPendingDeleteDocumentId,
    setIsThinking,
    setIsEnhancing,
    questionControllerRef,
    enhancementControllerRef,
    readerRef,
  } = ctx;

  const { persistCommand, reportPersistenceFailure } = usePersistence(ctx);

  const cancelScopedWork = useCallback(() => {
    questionControllerRef.current?.abort();
    questionControllerRef.current = null;
    enhancementControllerRef.current?.abort();
    enhancementControllerRef.current = null;
    setIsThinking(false);
    setIsEnhancing(false);
  }, [
    questionControllerRef,
    enhancementControllerRef,
    setIsThinking,
    setIsEnhancing,
  ]);

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
      readerRef.current?.scrollTo({ top: 0, behavior: "auto" });
      setActiveChapterId(chapter.id);
      setPdfFocusPage(startPage);
      setCurrentTextPage(startPage);
      setNotice(`学习范围已切换到"${chapter.title}"`);
      setSidebarOpen(false);
    },
    [
      cancelScopedWork,
      readerRef,
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
      readerRef.current?.scrollTo({ top: 0, behavior: "auto" });
      setSidebarOpen(false);
    },
    [
      cancelScopedWork,
      activeDocument,
      setActiveChapterId,
      setPdfFocusPage,
      setCurrentTextPage,
      setReaderMode,
      readerRef,
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
      setPendingDeleteDocumentId(null);
      if (activeDocument.id === documentId) selectDocument(demoDocument);
      setNotice("教材已移入回收站，将保留 30 天");
    },
    [
      persistCommand,
      applyWorkspace,
      activeDocument.id,
      selectDocument,
      setNotice,
      setPendingDeleteDocumentId,
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
