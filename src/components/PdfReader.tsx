import { useEffect, useRef, useState } from "react";
import {
  CaretLeft,
  CaretRight,
  CheckSquare,
  ImageSquare,
  Minus,
  Plus,
  TextAlignLeft,
  X,
} from "@phosphor-icons/react";
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  RenderTask,
} from "pdfjs-dist";
import type { TextBlock } from "../types";

interface PdfReaderProps {
  file: Blob;
  page: number;
  blocks: TextBlock[];
  highlightedBlockId: string | null;
  selectionMode: boolean;
  selectedBlockIds: string[];
  isEnhancing: boolean;
  enhanceProgress: string;
  onPageChange: (page: number) => void;
  onShowText: (page: number, blockId?: string) => void;
  onToggleSelection: (blockId: string) => void;
  onSelectionModeChange: (enabled: boolean) => void;
  onGenerateSelected: () => void;
  visionEnabled: boolean;
  isExplainingImage: boolean;
  onExplainPageImage: (page: number, dataUrl: string) => void;
}

interface TextRegion {
  blockId: string;
  sourceBlockIds: string[];
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

export function PdfReader({
  file,
  page,
  blocks,
  highlightedBlockId,
  selectionMode,
  selectedBlockIds,
  isEnhancing,
  enhanceProgress,
  onPageChange,
  onShowText,
  onToggleSelection,
  onSelectionModeChange,
  onGenerateSelected,
  visionEnabled,
  isExplainingImage,
  onExplainPageImage,
}: PdfReaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [textRegions, setTextRegions] = useState<TextRegion[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const wheelCooldownRef = useRef(0);
  const pendingEdgeRef = useRef<"top" | "bottom" | null>(null);
  const renderRunRef = useRef(0);
  const activeRenderTaskRef = useRef<RenderTask | null>(null);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const updateWidth = () =>
      setContainerWidth(Math.max(320, node.clientWidth - 32));
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | undefined;
    let loadedDocument: PDFDocumentProxy | undefined;
    setStatus("loading");

    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const data = new Uint8Array(await file.arrayBuffer());
        const publicAssetBase = new URL(
          import.meta.env.BASE_URL,
          window.location.origin,
        );
        loadingTask = pdfjs.getDocument({
          data,
          cMapUrl: new URL("cmaps/", publicAssetBase).toString(),
          cMapPacked: true,
          standardFontDataUrl: new URL(
            "standard_fonts/",
            publicAssetBase,
          ).toString(),
        });
        loadedDocument = await loadingTask.promise;
        if (cancelled) return;
        setDocument(loadedDocument);
        setTotalPages(loadedDocument.numPages);
        setStatus("ready");
      } catch (error) {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      setDocument(null);
      void loadingTask?.destroy();
      void loadedDocument?.destroy();
    };
  }, [file]);

  useEffect(() => {
    if (!document || !canvasRef.current || !containerWidth) return;
    const runId = renderRunRef.current + 1;
    renderRunRef.current = runId;
    let cancelled = false;
    let renderTask: RenderTask | undefined;
    setStatus("ready");
    setTextRegions([]);

    void (async () => {
      const pdfPage = await document.getPage(
        Math.min(Math.max(1, page), document.numPages),
      );
      if (cancelled || runId !== renderRunRef.current || !canvasRef.current) {
        return;
      }
      const baseViewport = pdfPage.getViewport({ scale: 1 });
      const fitScale = containerWidth / baseViewport.width;
      const viewport = pdfPage.getViewport({ scale: fitScale * zoom });
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) return;
      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      setPageSize({
        width: Math.floor(viewport.width),
        height: Math.floor(viewport.height),
      });

      const textContent = await pdfPage.getTextContent();
      if (cancelled || runId !== renderRunRef.current) return;
      const items = textContent.items
        .filter(
          (
            item,
          ): item is (typeof textContent.items)[number] & {
            str: string;
            transform: number[];
            width: number;
            height: number;
          } =>
            "str" in item &&
            "transform" in item &&
            "width" in item &&
            "height" in item &&
            Boolean(item.str.trim()),
        )
        .map((item, sourceIndex) => ({
          text: item.str.replace(/\s+/g, " ").trim(),
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
          height: item.height,
          sourceIndex,
        }));
      let joinedText = "";
      const rangedItems = items.map((item) => {
        if (joinedText) joinedText += " ";
        const start = joinedText.length;
        joinedText += item.text;
        return { ...item, start, end: joinedText.length };
      });
      let searchCursor = 0;
      const regions: TextRegion[] = [];
      blocks.forEach((block) => {
        let matchingItems: typeof rangedItems;
        if (
          typeof block.sourceItemStart === "number" &&
          typeof block.sourceItemEnd === "number"
        ) {
          matchingItems = rangedItems.filter(
            (item) =>
              item.sourceIndex >= block.sourceItemStart! &&
              item.sourceIndex < block.sourceItemEnd!,
          );
        } else {
          const blockText = block.text.replace(/\s+/g, " ").trim();
          let start = joinedText.indexOf(blockText, searchCursor);
          if (start < 0) {
            start = joinedText.indexOf(blockText.slice(0, 36), searchCursor);
          }
          if (start < 0) return;
          const end = start + blockText.length;
          searchCursor = end;
          matchingItems = rangedItems.filter(
            (item) => item.end > start && item.start < end,
          );
        }
        const itemRects: Array<{
          left: number;
          top: number;
          width: number;
          height: number;
        }> = [];
        matchingItems.forEach((item) => {
          const [x1, y1, x2, y2] = viewport.convertToViewportRectangle([
            item.x,
            item.y,
            item.x + item.width,
            item.y + item.height,
          ]);
          const left = Math.min(x1, x2);
          const top = Math.min(y1, y2);
          const width = Math.abs(x2 - x1);
          const height = Math.max(12, Math.abs(y2 - y1));
          itemRects.push({ left, top, width, height });
        });
        if (!itemRects.length) return;
        const padding = 3;
        const left = Math.min(...itemRects.map((rect) => rect.left)) - padding;
        const top = Math.min(...itemRects.map((rect) => rect.top)) - padding;
        const right =
          Math.max(...itemRects.map((rect) => rect.left + rect.width)) +
          padding;
        const bottom =
          Math.max(...itemRects.map((rect) => rect.top + rect.height)) +
          padding;
        regions.push({
          blockId: block.id,
          sourceBlockIds: [block.id],
          label: block.text.slice(0, 42),
          left,
          top,
          width: right - left,
          height: bottom - top,
        });
      });
      if (!cancelled) setTextRegions(regions);

      const previousRenderTask = activeRenderTaskRef.current;
      if (previousRenderTask) {
        previousRenderTask.cancel();
        try {
          await previousRenderTask.promise;
        } catch {
          // Cancellation is expected when the page, width, or zoom changes.
        }
      }
      if (cancelled || runId !== renderRunRef.current || !canvasRef.current) {
        return;
      }
      renderTask = pdfPage.render({
        canvas,
        canvasContext: context,
        viewport,
        transform:
          pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
      });
      activeRenderTaskRef.current = renderTask;
      try {
        await renderTask.promise;
        if (pendingEdgeRef.current && viewportRef.current) {
          viewportRef.current.scrollTop =
            pendingEdgeRef.current === "bottom"
              ? viewportRef.current.scrollHeight
              : 0;
          pendingEdgeRef.current = null;
        }
      } catch (error) {
        const errorName =
          typeof error === "object" &&
          error !== null &&
          "name" in error &&
          typeof error.name === "string"
            ? error.name
            : "";
        if (!cancelled && errorName !== "RenderingCancelledException") {
          setStatus("error");
        }
      } finally {
        if (activeRenderTaskRef.current === renderTask) {
          activeRenderTaskRef.current = null;
        }
      }
    })().catch((error: unknown) => {
      const errorName =
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        typeof error.name === "string"
          ? error.name
          : "";
      if (
        !cancelled &&
        runId === renderRunRef.current &&
        errorName !== "RenderingCancelledException"
      ) {
        setStatus("error");
      }
    });

    return () => {
      cancelled = true;
      if (renderRunRef.current === runId) {
        renderRunRef.current += 1;
      }
      renderTask?.cancel();
    };
  }, [containerWidth, document, page, zoom]);

  useEffect(() => {
    if (!highlightedBlockId || !viewportRef.current) return;
    const firstRegion = textRegions.find(
      (region) => region.blockId === highlightedBlockId,
    );
    if (!firstRegion) return;
    viewportRef.current.scrollTo({
      top: Math.max(0, firstRegion.top - 72),
      behavior: "auto",
    });
  }, [highlightedBlockId, textRegions]);

  const safePage = Math.min(Math.max(1, page), totalPages || page);
  const displayedRegions = selectionMode
    ? textRegions
    : [
        ...textRegions
          .reduce((groups, region) => {
            const block = blocks.find((item) => item.id === region.blockId);
            const ownerId =
              block?.smartTextOwnerId || block?.id || region.blockId;
            const existing = groups.get(ownerId);
            if (!existing) {
              groups.set(ownerId, {
                ...region,
                blockId: ownerId,
                sourceBlockIds: [region.blockId],
              });
              return groups;
            }
            const right = Math.max(
              existing.left + existing.width,
              region.left + region.width,
            );
            const bottom = Math.max(
              existing.top + existing.height,
              region.top + region.height,
            );
            existing.left = Math.min(existing.left, region.left);
            existing.top = Math.min(existing.top, region.top);
            existing.width = right - existing.left;
            existing.height = bottom - existing.top;
            existing.sourceBlockIds.push(region.blockId);
            return groups;
          }, new Map<string, TextRegion>())
          .values(),
      ];

  function turnPage(direction: -1 | 1) {
    const next = Math.min(
      totalPages || safePage + direction,
      Math.max(1, safePage + direction),
    );
    if (next === safePage) return;
    pendingEdgeRef.current = direction < 0 ? "bottom" : "top";
    onPageChange(next);
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    const viewport = event.currentTarget;
    const atTop = viewport.scrollTop <= 2;
    const atBottom =
      viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 2;
    const direction = event.deltaY > 0 ? 1 : -1;
    const atTurningEdge = direction > 0 ? atBottom : atTop;
    if (
      !atTurningEdge ||
      Math.abs(event.deltaY) < 24 ||
      Date.now() < wheelCooldownRef.current
    ) {
      return;
    }
    wheelCooldownRef.current = Date.now() + 450;
    turnPage(direction);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight" || event.key === "PageDown") {
      event.preventDefault();
      turnPage(1);
    } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
      event.preventDefault();
      turnPage(-1);
    }
  }

  return (
    <div className="pdf-reader">
      <div className="pdf-reader-controls">
        <div className="pdf-page-controls">
          <button
            onClick={() => turnPage(-1)}
            disabled={safePage <= 1}
            aria-label="上一页"
          >
            <CaretLeft size={17} />
          </button>
          <label>
            <span className="sr-only">当前 PDF 页码</span>
            <input
              type="number"
              min={1}
              max={totalPages || undefined}
              value={safePage}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (next > 0) {
                  onPageChange(totalPages ? Math.min(next, totalPages) : next);
                }
              }}
            />
            <span>/ {totalPages || "…"}</span>
          </label>
          <button
            onClick={() => turnPage(1)}
            disabled={Boolean(totalPages && safePage >= totalPages)}
            aria-label="下一页"
          >
            <CaretRight size={17} />
          </button>
        </div>

        <div className="pdf-center-actions">
          {selectionMode ? (
            <>
              <button
                className="pdf-generate-selected"
                onClick={onGenerateSelected}
                disabled={!selectedBlockIds.length || isEnhancing}
              >
                <CheckSquare size={16} weight="fill" />
                {isEnhancing
                  ? enhanceProgress || "正在生成…"
                  : `生成已选 ${selectedBlockIds.length} 段`}
              </button>
              <button
                className="pdf-cancel-selection"
                onClick={() => onSelectionModeChange(false)}
                aria-label="取消内容选择"
              >
                <X size={15} />
              </button>
            </>
          ) : (
            <>
              <button
                className="pdf-text-bridge"
                onClick={() =>
                  onShowText(safePage, highlightedBlockId || blocks[0]?.id)
                }
              >
                <TextAlignLeft size={16} />
                查看对应智能文本
              </button>
              <button
                className="pdf-select-content"
                onClick={() => onSelectionModeChange(true)}
              >
                <CheckSquare size={16} />
                选择内容生成
              </button>
            </>
          )}
          {visionEnabled && !selectionMode && (
            <button
              className="pdf-explain-image"
              disabled={isExplainingImage || status !== "ready"}
              onClick={() => {
                const dataUrl = canvasRef.current?.toDataURL(
                  "image/jpeg",
                  0.88,
                );
                if (dataUrl) onExplainPageImage(safePage, dataUrl);
              }}
            >
              <ImageSquare size={16} />
              {isExplainingImage ? "正在讲解…" : "讲解本页图示"}
            </button>
          )}
        </div>

        <div className="pdf-zoom-controls">
          <button
            onClick={() => setZoom((current) => Math.max(0.7, current - 0.1))}
            aria-label="缩小页面"
          >
            <Minus size={15} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((current) => Math.min(1.8, current + 0.1))}
            aria-label="放大页面"
          >
            <Plus size={15} />
          </button>
        </div>
      </div>

      <div
        className="pdf-canvas-viewport"
        ref={viewportRef}
        tabIndex={0}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        aria-label="PDF 页面，滚轮到页边缘或使用左右方向键翻页"
      >
        {status === "loading" && (
          <div className="pdf-loading" aria-live="polite">
            <span />
            <span />
            <span />
            <strong>正在绘制原版页面</strong>
          </div>
        )}
        {status === "error" && (
          <div className="pdf-error">
            <strong>这一页暂时无法显示</strong>
            <span>可以切换到智能文本继续阅读。</span>
          </div>
        )}
        <div
          className="pdf-page-stage"
          style={{ width: pageSize.width, height: pageSize.height }}
        >
          <canvas
            ref={canvasRef}
            className="pdf-page-canvas"
            aria-label={`PDF 第 ${safePage} 页`}
          />
          <div className="pdf-text-regions" aria-label="可定位的原文段落">
            {displayedRegions.map((region) => {
              const block = blocks.find((item) => item.id === region.blockId);
              const sourceBlocks = blocks.filter((item) =>
                region.sourceBlockIds.includes(item.id),
              );
              const classNames = [
                "original-text-region",
                "original-paragraph-region",
              ];
              if (
                highlightedBlockId === region.blockId ||
                region.sourceBlockIds.includes(highlightedBlockId || "")
              ) {
                classNames.push("correspondence-highlight");
              }
              if (
                region.sourceBlockIds.some((id) =>
                  selectedBlockIds.includes(id),
                )
              ) {
                classNames.push("is-selected");
              }
              if (
                block?.smartText ||
                sourceBlocks.some(
                  (item) => item.smartText || item.smartTextOwnerId,
                )
              ) {
                classNames.push("has-smart-text");
              }
              return (
                <button
                  key={region.blockId}
                  className={classNames.join(" ")}
                  data-original-block-id={region.blockId}
                  data-source-block-count={region.sourceBlockIds.length}
                  style={{
                    left: region.left,
                    top: region.top,
                    width: region.width,
                    height: region.height,
                  }}
                  onClick={() =>
                    selectionMode
                      ? onToggleSelection(region.blockId)
                      : onShowText(safePage, region.blockId)
                  }
                  aria-pressed={
                    selectionMode
                      ? selectedBlockIds.includes(region.blockId)
                      : undefined
                  }
                  aria-label={
                    selectionMode
                      ? `${selectedBlockIds.includes(region.blockId) ? "取消选择" : "选择"}原文：${region.label}`
                      : `定位智能文本：${region.label}`
                  }
                  title={
                    selectionMode
                      ? "点击选择或取消这段原文"
                      : block?.smartText
                        ? "已有智能文本，点击查看"
                        : "点击定位到对应智能文本"
                  }
                />
              );
            })}
          </div>
        </div>
        <div className="pdf-navigation-hint">
          {selectionMode
            ? "点击原文段落进行多选，翻页后选择仍会保留"
            : "绿色标记表示已有智能文本 · 点击原文段落定位 · 滚轮到页边缘或 ← → 翻页"}
        </div>
      </div>
    </div>
  );
}
