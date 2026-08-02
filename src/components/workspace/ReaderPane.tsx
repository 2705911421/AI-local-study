import { memo, useMemo, useState, type RefObject } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpen,
  CaretRight,
  CheckCircle,
  HighlighterCircle,
  House,
  MagnifyingGlass,
  NotePencil,
  Sparkle,
  X,
} from "@phosphor-icons/react";
import type { Highlight, TextBlock } from "../../types";
import { CURRENT_PDF_PARSER_VERSION } from "../../lib/document";
import { PdfReader } from "../PdfReader";
import {
  useIntelligence,
  useLibrary,
  useNotes,
  useReader,
  useShell,
} from "../../workspace/WorkspaceDomains";
import { markWorkspaceRender } from "../../workspace/renderDiagnostics";

interface ReaderPaneProps {
  containerRef: RefObject<HTMLElement | null>;
  visiblePdfPage: number;
  visiblePdfBlocks: TextBlock[];
  chapterHighlights: Highlight[];
  onScroll: () => void;
  onRebuildSegments: () => void;
  onShowOriginalPage: (page: number, blockId?: string) => void;
  onShowTextForPage: (page: number, blockId?: string) => void;
  onEnhanceChapter: () => void;
  onCancelEnhancement: () => void;
  onGoToSearchResult: (index: number, results: TextBlock[]) => number;
  onMergeSegments: () => void;
  onSplitSegment: () => void;
  onToggleTable: () => void;
  onRestoreSegments: () => void;
  onSyncPdfPage: (page: number) => void;
  onEnhanceSelected: () => void;
  onExplainPageImage: (page: number, dataUrl: string) => void;
  onToggleHighlight: (block: TextBlock) => void;
  onSubmitQuestion: (preset: string) => void;
  onOpenQuiz: () => void;
}

export const ReaderPane = memo(function ReaderPane({
  containerRef,
  visiblePdfPage,
  visiblePdfBlocks,
  chapterHighlights,
  onScroll,
  onRebuildSegments,
  onShowOriginalPage,
  onShowTextForPage,
  onEnhanceChapter,
  onCancelEnhancement,
  onGoToSearchResult,
  onMergeSegments,
  onSplitSegment,
  onToggleTable,
  onRestoreSegments,
  onSyncPdfPage,
  onEnhanceSelected,
  onExplainPageImage,
  onToggleHighlight,
  onSubmitQuestion,
  onOpenQuiz,
}: ReaderPaneProps) {
  markWorkspaceRender("reader");
  const shell = useShell();
  const library = useLibrary();
  const reader = useReader();
  const notes = useNotes();
  const intelligence = useIntelligence();
  const { activeDocument, activeChapter } = library;
  const [searchOpen, setSearchOpen] = useState(false);
  const [chapterSearch, setChapterSearch] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const searchResults = useMemo(() => {
    const normalized = chapterSearch.trim().toLocaleLowerCase("zh-CN");
    if (!normalized) return [];
    return activeChapter.blocks.filter((block) =>
      (block.smartText || block.text)
        .toLocaleLowerCase("zh-CN")
        .includes(normalized),
    );
  }, [activeChapter.blocks, chapterSearch]);
  const goToSearchResult = (index: number) => {
    setSearchIndex(onGoToSearchResult(index, searchResults));
  };

  return (
    <main
      ref={containerRef}
      className={`reader-panel ${
        reader.readerMode === "original" ? "is-original" : ""
      } ${shell.mobileView === "reader" ? "mobile-active" : ""}`}
      onScroll={onScroll}
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
            activeDocument.parserVersion !== CURRENT_PDF_PARSER_VERSION && (
              <button
                type="button"
                className="segment-upgrade-button"
                onClick={onRebuildSegments}
                disabled={reader.isRebuildingSegments}
                title="使用标题、缩进和行距重新构建可选择的原文段落"
              >
                <Sparkle size={15} />
                {reader.isRebuildingSegments ? "正在重建分段…" : "重建智能分段"}
              </button>
            )}
          {activeDocument.kind === "pdf" && activeDocument.originalFile && (
            <div className="reader-mode-switch" aria-label="阅读模式">
              <button
                type="button"
                className={reader.readerMode === "original" ? "active" : ""}
                onClick={() => onShowOriginalPage(reader.currentTextPage)}
              >
                原版教材
              </button>
              <button
                type="button"
                className={reader.readerMode === "text" ? "active" : ""}
                onClick={() => onShowTextForPage(visiblePdfPage)}
              >
                智能文本
              </button>
            </div>
          )}
          {reader.readerMode === "text" && (
            <>
              <button
                type="button"
                className="enhance-chapter-button"
                onClick={
                  reader.isEnhancing ? onCancelEnhancement : onEnhanceChapter
                }
                title={
                  intelligence.modelOnline
                    ? "使用已连接模型整理当前章节"
                    : "先配置并连接 LLM 服务"
                }
              >
                <Sparkle size={15} />
                {reader.isEnhancing ? "暂停任务" : "AI 优化本章"}
              </button>
              <button
                type="button"
                data-testid="chapter-search-toggle"
                className={searchOpen ? "active" : ""}
                title="在当前章节中查找"
                onClick={() => {
                  setSearchOpen((open) => !open);
                  window.setTimeout(
                    () => document.getElementById("chapter-search")?.focus(),
                    0,
                  );
                }}
              >
                <MagnifyingGlass size={18} />
              </button>
              <button
                type="button"
                className={reader.highlighterMode ? "active" : ""}
                title="高亮教材段落"
                aria-pressed={reader.highlighterMode}
                onClick={() => {
                  reader.toggleHighlighter();
                  shell.announce(
                    reader.highlighterMode
                      ? "已退出高亮模式"
                      : "点击正文段落即可添加或取消高亮",
                  );
                }}
              >
                <HighlighterCircle size={18} />
              </button>
              {activeDocument.kind === "pdf" && (
                <button
                  type="button"
                  className={reader.selectionMode ? "active" : ""}
                  onClick={() => {
                    reader.toggleSelection();
                    reader.clearSelection();
                  }}
                  aria-pressed={reader.selectionMode}
                >
                  编辑分段
                </button>
              )}
              <span>{activeChapter.blocks.length} 个内容片段</span>
            </>
          )}
        </div>
      </div>
      {searchOpen && reader.readerMode === "text" && (
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
            type="button"
            onClick={() => goToSearchResult(searchIndex - 1)}
            disabled={!searchResults.length}
            aria-label="上一个搜索结果"
          >
            <ArrowUp size={15} />
          </button>
          <button
            type="button"
            onClick={() => goToSearchResult(searchIndex + 1)}
            disabled={!searchResults.length}
            aria-label="下一个搜索结果"
          >
            <ArrowDown size={15} />
          </button>
          <button
            type="button"
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
      {reader.selectionMode && reader.readerMode === "text" && (
        <div className="segment-editor" role="toolbar" aria-label="分段编辑">
          <span>已选 {reader.selectedBlockIds.length} 段</span>
          <button type="button" onClick={onMergeSegments}>
            合并
          </button>
          <button type="button" onClick={onSplitSegment}>
            拆分
          </button>
          <button type="button" onClick={onToggleTable}>
            标记表格
          </button>
          <button type="button" onClick={onRestoreSegments}>
            恢复初始分段
          </button>
        </div>
      )}

      {reader.readerMode === "original" &&
      activeDocument.kind === "pdf" &&
      activeDocument.originalFile ? (
        <PdfReader
          file={activeDocument.originalFile}
          page={visiblePdfPage}
          blocks={visiblePdfBlocks}
          highlightedBlockId={reader.highlightedBlockId}
          selectionMode={reader.selectionMode}
          selectedBlockIds={reader.selectedBlockIds}
          isEnhancing={reader.isEnhancing}
          enhanceProgress={reader.enhanceProgress}
          onPageChange={onSyncPdfPage}
          onShowText={onShowTextForPage}
          onToggleSelection={reader.toggleBlockSelection}
          onSelectionModeChange={(enabled) => {
            reader.setSelectionMode(enabled);
            if (!enabled) reader.clearSelection();
            reader.clearEnhancementError();
          }}
          onGenerateSelected={onEnhanceSelected}
          visionEnabled={intelligence.modelSupportsVision}
          isExplainingImage={reader.isExplainingImage}
          onExplainPageImage={onExplainPageImage}
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
          {(reader.enhanceProgress || reader.enhanceError) && (
            <div
              className={`enhance-state ${reader.enhanceError ? "is-error" : ""}`}
              role="status"
              aria-live="polite"
            >
              {reader.enhanceError || reader.enhanceProgress}
            </div>
          )}
          {activeChapter.blocks.map((block, index) =>
            block.smartTextOwnerId &&
            block.smartTextOwnerId !== block.id ? null : (
              <section
                className={`text-block ${
                  reader.highlightedBlockId === block.id
                    ? "correspondence-highlight"
                    : ""
                } ${
                  chapterHighlights.some((item) => item.blockId === block.id)
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
                } ${reader.highlighterMode ? "is-highlight-selectable" : ""} ${
                  reader.selectionMode ? "is-segment-selectable" : ""
                } ${
                  reader.selectedBlockIds.includes(block.id)
                    ? "is-segment-selected"
                    : ""
                } ${block.blockKind === "table" ? "is-table-block" : ""}`}
                key={block.id}
                id={block.id}
                data-page={block.page}
                onClick={() => {
                  reader.selectBlock(block.id);
                  if (reader.selectionMode) {
                    reader.toggleBlockSelection(block.id);
                    return;
                  }
                  if (reader.highlighterMode) onToggleHighlight(block);
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
                        type="button"
                        className="locator"
                        onClick={(event) => {
                          event.stopPropagation();
                          onShowOriginalPage(block.page!, block.id);
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
                      type="button"
                      className="highlight-block"
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleHighlight(block);
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
                      type="button"
                      className="highlight-block"
                      onClick={(event) => {
                        event.stopPropagation();
                        reader.selectBlock(block.id);
                        reader.changeTextPage(
                          block.page || reader.currentTextPage,
                        );
                        notes.startNewNote(
                          (block.smartText || block.text).slice(0, 180),
                        );
                        shell.selectRightTab("notes");
                        shell.selectMobileView("notes");
                        shell.announce("已引用该段，写下你的理解");
                      }}
                    >
                      <NotePencil size={13} />
                      记笔记
                    </button>
                    <button
                      type="button"
                      className="explain-block"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSubmitQuestion(
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
            <button
              type="button"
              onClick={onOpenQuiz}
              aria-label="开始章节练习"
            >
              开始章节练习
              <ArrowRight size={15} />
            </button>
          </div>
        </article>
      )}
    </main>
  );
});
