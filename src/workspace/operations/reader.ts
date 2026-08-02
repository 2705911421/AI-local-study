import { useCallback } from "react";
import type { TextBlock } from "../../types";
import type { WorkspaceRuntime } from "../WorkspaceRuntime";

type ReaderNavigationRuntime = Pick<
  WorkspaceRuntime,
  | "activeChapter"
  | "activeDocument"
  | "highlightTimerRef"
  | "readerRef"
  | "repository"
  | "setActiveChapterId"
  | "setCurrentBlockId"
  | "setCurrentTextPage"
  | "setHighlightedBlockId"
  | "setHighlights"
  | "setNotice"
  | "setPdfFocusPage"
  | "setReaderMode"
>;

export function useReaderNav(
  {
    chapterHighlights,
  }: {
    chapterHighlights: import("../../types").Highlight[];
  },
  ctx: ReaderNavigationRuntime,
) {
  const {
    activeDocument,
    activeChapter,
    setPdfFocusPage,
    setCurrentTextPage,
    setActiveChapterId,
    setHighlightedBlockId,
    setReaderMode,
    setCurrentBlockId,
    setHighlights,
    setNotice,
    repository,
    readerRef,
    highlightTimerRef,
  } = ctx;

  const syncPdfPage = useCallback(
    (page: number) => {
      setPdfFocusPage(page);
      setCurrentTextPage(page);
      const matchingChapter = activeDocument.chapters.find((chapter) =>
        chapter.blocks.some((block) => block.page === page),
      );
      if (matchingChapter && matchingChapter.id !== activeChapter.id) {
        setActiveChapterId(matchingChapter.id);
      }
    },
    [
      activeDocument,
      activeChapter.id,
      setPdfFocusPage,
      setCurrentTextPage,
      setActiveChapterId,
    ],
  );

  const pulseCorrespondence = useCallback(
    (blockId?: string) => {
      if (!blockId) return;
      setHighlightedBlockId(blockId);
      if (highlightTimerRef.current !== null) {
        window.clearTimeout(highlightTimerRef.current);
      }
      highlightTimerRef.current = window.setTimeout(() => {
        setHighlightedBlockId(null);
        highlightTimerRef.current = null;
      }, 4000);
    },
    [highlightTimerRef, setHighlightedBlockId],
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
      setReaderMode("original");
      readerRef.current?.scrollTo({ top: 0, behavior: "auto" });
    },
    [
      syncPdfPage,
      pulseCorrespondence,
      findBlockForPage,
      setReaderMode,
      readerRef,
    ],
  );

  const showTextForPage = useCallback(
    (page: number, blockId?: string) => {
      const matchingChapter =
        activeDocument.chapters.find((chapter) =>
          chapter.blocks.some((block) => block.page === page),
        ) || activeChapter;
      if (matchingChapter.id !== activeChapter.id) {
        setActiveChapterId(matchingChapter.id);
      }
      const requestedBlock =
        matchingChapter.blocks.find((block) => block.id === blockId) ||
        matchingChapter.blocks.find((block) => block.page === page);
      setCurrentTextPage(page);
      pulseCorrespondence(requestedBlock?.id);
      setReaderMode("text");

      const scrollWhenReady = (attempt = 0) => {
        const blocks = [
          ...(readerRef.current?.querySelectorAll<HTMLElement>(
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
          readerRef.current?.scrollTo({ top: 0, behavior: "auto" });
        }
      };
      window.setTimeout(scrollWhenReady, 50);
    },
    [
      activeDocument,
      activeChapter,
      pulseCorrespondence,
      readerRef,
      setActiveChapterId,
      setCurrentTextPage,
      setReaderMode,
    ],
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
      setReaderMode("text");
      window.setTimeout(() => {
        document.getElementById(blockId)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 0);
    },
    [activeDocument, showOriginalPage, setReaderMode],
  );

  const toggleHighlight = useCallback(
    async (block: TextBlock) => {
      const existing = chapterHighlights.find(
        (item) => item.blockId === block.id,
      );
      const { persistCommand } = await Promise.resolve({
        persistCommand: async (
          command: import("../../lib/studyRepository").StudyCommand,
          failureMessage: string,
        ) => {
          try {
            return await repository.apply(command);
          } catch {
            setNotice(failureMessage);
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
        setHighlights(workspace.highlights);
        setNotice("已取消高亮");
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
      setHighlights(workspace.highlights);
      setNotice("段落已加入高亮批注");
    },
    [
      repository,
      setHighlights,
      setNotice,
      activeDocument,
      activeChapter,
      chapterHighlights,
    ],
  );

  const goToSearchResult = useCallback(
    (index: number, searchResults: TextBlock[]) => {
      if (!searchResults.length) return 0;
      const nextIndex = (index + searchResults.length) % searchResults.length;
      const block = searchResults[nextIndex];
      setCurrentBlockId(block.id);
      window.setTimeout(() => {
        document.getElementById(block.id)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
      return nextIndex;
    },
    [setCurrentBlockId],
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
