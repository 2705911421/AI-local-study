import type { Chapter, StudyDocument, TextBlock } from "../types";

export const IMPORT_LIMITS = {
  pdfBytes: 150 * 1024 * 1024,
  epubBytes: 50 * 1024 * 1024,
  epubUncompressedBytes: 300 * 1024 * 1024,
  pdfPages: 2_000,
  epubSpineItems: 2_000,
} as const;

export const CURRENT_PDF_PARSER_VERSION = 4;

function formatMiB(bytes: number): number {
  return Math.round(bytes / 1024 / 1024);
}

export function validateImportFile(file: Pick<File, "name" | "size">): void {
  const isPdf = /\.pdf$/i.test(file.name);
  const isEpub = /\.epub$/i.test(file.name);
  if (!isPdf && !isEpub) {
    throw new Error("目前仅支持 PDF 和 EPUB 文件");
  }
  const limit = isPdf ? IMPORT_LIMITS.pdfBytes : IMPORT_LIMITS.epubBytes;
  if (file.size > limit) {
    throw new Error(
      `${isPdf ? "PDF" : "EPUB"} 文件不能超过 ${formatMiB(limit)} MB`,
    );
  }
}

function cleanText(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\u0000/g, "")
    .trim();
}

function splitIntoBlocks(
  text: string,
  chapterId: string,
  locator: string,
  page?: number,
): TextBlock[] {
  const sentences = text.split(/(?<=[。！？.!?])\s*/);
  const chunks: string[] = [];
  let current = "";
  const pushChunk = (value: string) => {
    let remaining = value;
    while (remaining.length > 520) {
      chunks.push(remaining.slice(0, 520));
      remaining = remaining.slice(520);
    }
    if (remaining) chunks.push(remaining);
  };
  for (const sentence of sentences) {
    if (current.length + sentence.length > 520 && current.length > 0) {
      pushChunk(current);
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current) pushChunk(current);
  return chunks
    .map(cleanText)
    .filter((item) => item.length > 10)
    .map((item, index) => ({
      id: `${chapterId}-b${index}`,
      chapterId,
      text: item,
      page,
      locator,
    }));
}

function resolveEpubArchivePath(basePath: string, href: string): string {
  const hrefWithoutFragment = href.split("#", 1)[0].split("?", 1)[0];
  const decoded = decodeURIComponent(hrefWithoutFragment).replace(/\\/g, "/");
  const combined = decoded.startsWith("/") ? decoded : `${basePath}${decoded}`;
  const segments: string[] = [];
  for (const segment of combined.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.join("/");
}

function extractEpubBlocks(
  doc: Document,
  chapterId: string,
  heading: string,
): TextBlock[] {
  const selector = "p, li, blockquote, pre, dt, dd";
  const semanticBlocks = [...doc.body.querySelectorAll(selector)].filter(
    (element) => !element.querySelector(selector),
  );
  const paragraphs = semanticBlocks
    .map((element) => cleanText(element.textContent || ""))
    .filter((text) => text.length > 10);
  const source =
    paragraphs.length > 0
      ? paragraphs
      : [cleanText(doc.body?.textContent || "")].filter(
          (text) => text.length > 10,
        );
  return source.flatMap((text, paragraphIndex) =>
    splitIntoBlocks(
      text,
      chapterId,
      `${heading} · EPUB 段落 ${paragraphIndex + 1}`,
    ).map((block, partIndex) => ({
      ...block,
      id: `${chapterId}-p${paragraphIndex + 1}-${partIndex + 1}`,
    })),
  );
}

function addEpubLocations(chapters: Chapter[]): Chapter[] {
  const blocks = chapters.flatMap((chapter) => chapter.blocks);
  const totalCharacters = Math.max(
    1,
    blocks.reduce((total, block) => total + block.text.length, 0),
  );
  let offset = 0;
  return chapters.map((chapter) => ({
    ...chapter,
    blocks: chapter.blocks.map((block) => {
      const virtualPage = Math.floor(offset / 800) + 1;
      offset += block.text.length;
      const progressPercent = Math.min(
        100,
        Math.round((offset / totalCharacters) * 100),
      );
      return {
        ...block,
        virtualPage,
        progressPercent,
        locator: `${block.locator} · 虚拟页 ${virtualPage} · 进度 ${progressPercent}%`,
      };
    }),
  }));
}

export interface PositionedPdfItem {
  text: string;
  x: number;
  y: number;
  height: number;
  width: number;
  sourceIndex: number;
}

interface PdfLine {
  text: string;
  x: number;
  y: number;
  height: number;
  items: PositionedPdfItem[];
  table?: boolean;
  column?: number;
}

function isStructuralHeading(line: PdfLine, medianHeight: number): boolean {
  const text = line.text.replace(/\s+/g, "");
  return (
    /^第[一二三四五六七八九十百0-9]+节[|｜]?/.test(text) ||
    /^[一二三四五六七八九十]+、/.test(text) ||
    /^[（(][一二三四五六七八九十]+[）)]/.test(text) ||
    (line.height >= medianHeight + 1.4 && text.length <= 30)
  );
}

function joinPdfLines(left: string, right: string): string {
  if (!left) return right;
  if (!right) return left;
  const needsSpace = /[A-Za-z0-9)]$/.test(left) && /^[A-Za-z0-9(]/.test(right);
  return `${left}${needsSpace ? " " : ""}${right}`;
}

export function semanticPdfBlocks(
  positionedItems: PositionedPdfItem[],
  chapterId: string,
  pageNumber: number,
): TextBlock[] {
  const lineGroups = new Map<number, PositionedPdfItem[]>();
  positionedItems.forEach((item) => {
    const key = Math.round(item.y * 2) / 2;
    const line = lineGroups.get(key) || [];
    line.push(item);
    lineGroups.set(key, line);
  });
  const rows = [...lineGroups.values()].map((items) => {
    const sorted = [...items].sort((a, b) => a.x - b.x);
    const cells: PositionedPdfItem[][] = [];
    let cell: PositionedPdfItem[] = [];
    sorted.forEach((item, index) => {
      const previous = sorted[index - 1];
      const previousEnd = previous
        ? previous.x +
          Math.max(
            previous.width,
            previous.text.length * previous.height * 0.45,
          )
        : 0;
      if (previous && item.x - previousEnd > Math.max(28, item.height * 3.2)) {
        cells.push(cell);
        cell = [];
      }
      cell.push(item);
    });
    if (cell.length) cells.push(cell);
    const y = sorted.reduce((sum, item) => sum + item.y, 0) / sorted.length;
    const height = Math.max(...sorted.map((item) => item.height));
    return { sorted, cells, y, height };
  });
  const repeatedProseLayouts = new Set<string>();
  const rowsByLayout = new Map<string, typeof rows>();
  rows
    .filter((row) => row.cells.length >= 3)
    .forEach((row) => {
      const signature = row.cells
        .map((cell) => Math.round(cell[0].x / 24))
        .join(":");
      const matching = rowsByLayout.get(signature) || [];
      matching.push(row);
      rowsByLayout.set(signature, matching);
    });
  rowsByLayout.forEach((matching, signature) => {
    const cellTexts = matching.flatMap((row) =>
      row.cells.map((cell) =>
        cleanText(cell.map((item) => item.text).join("")),
      ),
    );
    const averageLength =
      cellTexts.reduce((total, text) => total + text.length, 0) /
      Math.max(1, cellTexts.length);
    if (matching.length >= 2 && averageLength >= 8) {
      repeatedProseLayouts.add(signature);
    }
  });

  let lines: PdfLine[] = rows
    .flatMap(({ sorted, cells, y, height }) => {
      const signature = cells
        .map((cell) => Math.round(cell[0].x / 24))
        .join(":");
      if (cells.length >= 3 && !repeatedProseLayouts.has(signature)) {
        return [
          {
            text: cells
              .map((group) =>
                cleanText(group.map((item) => item.text).join("")),
              )
              .join(" | "),
            x: sorted[0].x,
            y,
            height,
            items: sorted,
            table: true,
          },
        ];
      }
      return cells.map((group) => ({
        text: cleanText(group.map((item) => item.text).join("")),
        x: Math.min(...group.map((item) => item.x)),
        y,
        height,
        items: group,
      }));
    })
    .filter(
      (line) =>
        line.text.length > 0 &&
        line.y > 55 &&
        !/^\d{1,4}$/.test(line.text) &&
        !/\d+-\d+\.indd/i.test(line.text) &&
        line.text !== "本章数字资源" &&
        !(
          line.y > 680 &&
          /^第[一二三四五六七八九十百0-9]+章/.test(
            line.text.replace(/\s+/g, ""),
          )
        ),
    )
    .sort((a, b) => b.y - a.y || a.x - b.x);
  if (!lines.length) return [];

  const startPositions = [
    ...new Set(
      lines.filter((line) => !line.table).map((line) => Math.round(line.x)),
    ),
  ].sort((a, b) => a - b);
  const columnBoundaries: number[] = [];
  for (let index = 1; index < startPositions.length; index += 1) {
    const gap = startPositions[index] - startPositions[index - 1];
    if (gap >= 90) {
      columnBoundaries.push(
        (startPositions[index] + startPositions[index - 1]) / 2,
      );
    }
  }
  const columnForX = (x: number) =>
    columnBoundaries.filter((boundary) => x >= boundary).length;
  if (columnBoundaries.length) {
    const columnCounts = new Map<number, number>();
    lines
      .filter((line) => !line.table)
      .forEach((line) => {
        const column = columnForX(line.x);
        columnCounts.set(column, (columnCounts.get(column) || 0) + 1);
      });
    if (
      columnCounts.size !== columnBoundaries.length + 1 ||
      [...columnCounts.values()].some((count) => count < 2)
    ) {
      columnBoundaries.length = 0;
    }
  }
  lines = lines
    .map((line) => ({
      ...line,
      column: line.table ? 0 : columnForX(line.x),
    }))
    .sort(
      (a, b) => (a.column || 0) - (b.column || 0) || b.y - a.y || a.x - b.x,
    );

  const substantialLines = lines.filter((line) => line.text.length > 8);
  const leftValues = substantialLines
    .map((line) => line.x)
    .sort((a, b) => a - b);
  const baseLeft =
    leftValues[Math.floor(leftValues.length * 0.2)] || leftValues[0] || 0;
  const columnBases = new Map<number, number>();
  lines.forEach((line) => {
    const column = line.column || 0;
    columnBases.set(
      column,
      Math.min(columnBases.get(column) ?? line.x, line.x),
    );
  });
  const heights = substantialLines
    .map((line) => line.height)
    .sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] || 10;
  const gaps = lines
    .slice(1)
    .map((line, index) => lines[index].y - line.y)
    .filter((gap) => gap > 2 && gap < 40)
    .sort((a, b) => a - b);
  const medianGap = gaps[Math.floor(gaps.length / 2)] || 16;

  const groups: PdfLine[][] = [];
  let current: PdfLine[] = [];
  const flush = () => {
    if (current.length) groups.push(current);
    current = [];
  };

  lines.forEach((line, index) => {
    const previous = lines[index - 1];
    if (line.table) {
      flush();
      current.push(line);
      flush();
      return;
    }
    const changedColumn = Boolean(previous) && previous.column !== line.column;
    const heading = isStructuralHeading(line, medianHeight);
    const currentOnlyHeading =
      current.length === 1 && isStructuralHeading(current[0], medianHeight);
    const startsIndentedParagraph =
      line.x >= (columnBases.get(line.column || 0) ?? baseLeft) + 8 &&
      Boolean(current.length) &&
      !changedColumn &&
      !currentOnlyHeading &&
      !heading;
    const hasLargeGap =
      Boolean(previous) &&
      previous.y - line.y > medianGap * 1.38 &&
      Boolean(current.length) &&
      !currentOnlyHeading &&
      !changedColumn;

    if (changedColumn || heading || startsIndentedParagraph || hasLargeGap)
      flush();
    current.push(line);
  });
  flush();

  return groups
    .map((group, index) => {
      const sourceIndexes = group.flatMap((line) =>
        line.items.map((item) => item.sourceIndex),
      );
      const exactSourceIndexes = [...new Set(sourceIndexes)].sort(
        (left, right) => left - right,
      );
      return {
        id: `${chapterId}-p${pageNumber}-b${index}`,
        chapterId,
        text: group.reduce((text, line) => joinPdfLines(text, line.text), ""),
        page: pageNumber,
        sourceItemIndexes: exactSourceIndexes,
        sourceItemStart: exactSourceIndexes[0],
        sourceItemEnd: exactSourceIndexes.at(-1)! + 1,
        locator: `PDF 第 ${pageNumber} 页`,
        blockKind: (group.some((line) => line.table)
          ? "table"
          : "paragraph") as TextBlock["blockKind"],
      };
    })
    .filter((block) => block.text.length > 8);
}

async function parsePdf(
  file: File,
  documentId: string,
): Promise<StudyDocument> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjsLib.getDocument({ data });
  let pdf;
  try {
    pdf = await loadingTask.promise;
  } catch (error) {
    await loadingTask.destroy();
    throw error;
  }
  try {
    if (pdf.numPages > IMPORT_LIMITS.pdfPages) {
      throw new Error(`PDF 页数不能超过 ${IMPORT_LIMITS.pdfPages} 页`);
    }
    const chapters: Chapter[] = [];
    let active: Chapter = {
      id: `${documentId}:pdf-c1`,
      title: "教材前置内容",
      order: 0,
      blocks: [],
    };
    chapters.push(active);

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const positionedItems = content.items
        .filter(
          (
            item,
          ): item is (typeof content.items)[number] & {
            str: string;
            transform: number[];
            height: number;
            width: number;
          } =>
            "str" in item &&
            "transform" in item &&
            "height" in item &&
            "width" in item &&
            Boolean(item.str.trim()),
        )
        .map((item, sourceIndex) => ({
          text: cleanText(item.str),
          x: item.transform[4],
          y: item.transform[5],
          height: item.height,
          width: item.width,
          sourceIndex,
        }));
      const text = cleanText(
        content.items.map((item) => ("str" in item ? item.str : "")).join(" "),
      );
      if (!text) continue;

      const chapterMarkerIndex = positionedItems.findIndex(
        (item) =>
          item.y > 700 &&
          (item.height < 10 || item.height > 16) &&
          /^第[一二三四五六七八九十百0-9]+章$/.test(
            item.text.replace(/\s/g, ""),
          ),
      );
      let detectedChapter = "";
      if (chapterMarkerIndex >= 0) {
        const marker = positionedItems[chapterMarkerIndex];
        const title = positionedItems
          .slice(chapterMarkerIndex + 1)
          .filter(
            (item) =>
              Math.abs(item.y - marker.y) < 3 &&
              !/^\d+$/.test(item.text) &&
              item.text !== "本章数字资源",
          )
          .map((item) => item.text)
          .join("")
          .replace(/\s+/g, " ")
          .trim();
        if (title && title.length <= 34) {
          detectedChapter = `${marker.text.replace(/\s/g, "")} ${title}`;
        }
      }

      if (
        detectedChapter &&
        detectedChapter !== active.title &&
        active.blocks.length > 0
      ) {
        active = {
          id: `${documentId}:pdf-c${chapters.length + 1}`,
          title: detectedChapter,
          order: chapters.length,
          sections: [],
          blocks: [],
        };
        chapters.push(active);
      }

      if (active.title !== "教材前置内容") {
        const lines = new Map<number, typeof positionedItems>();
        positionedItems.forEach((item) => {
          const lineKey = Math.round(item.y * 2) / 2;
          const line = lines.get(lineKey) || [];
          line.push(item);
          lines.set(lineKey, line);
        });
        [...lines.values()].forEach((lineItems) => {
          const lineText = lineItems
            .sort((a, b) => a.x - b.x)
            .map((item) => item.text)
            .join("")
            .replace(/\s+/g, " ")
            .trim();
          const sectionMatch = lineText.match(
            /^(第[一二三四五六七八九十百0-9]+节)\s*[|｜]?\s*(.{2,42})$/,
          );
          if (!sectionMatch) return;
          const title = `${sectionMatch[1]} ${sectionMatch[2]}`
            .replace(/\.{3,}.*$/, "")
            .replace(/\s+/g, " ")
            .trim();
          if (
            title.length > 48 ||
            active.sections?.some((section) => section.title === title)
          ) {
            return;
          }
          active.sections = [
            ...(active.sections || []),
            {
              id: `${active.id}-s${(active.sections?.length || 0) + 1}`,
              title,
              page: pageNumber,
            },
          ];
        });
      }

      active.blocks.push(
        ...semanticPdfBlocks(positionedItems, active.id, pageNumber),
      );
    }

    if (!chapters.some((chapter) => chapter.blocks.length)) {
      throw new Error(
        "未能从 PDF 中提取文字。这可能是扫描版教材，当前版本尚未启用 OCR。",
      );
    }

    const createdAt = Date.now();
    return {
      id: documentId,
      title: file.name.replace(/\.pdf$/i, ""),
      displayTitle: file.name.replace(/\.pdf$/i, ""),
      filename: file.name,
      kind: "pdf",
      originalFile: file,
      parserVersion: CURRENT_PDF_PARSER_VERSION,
      createdAt,
      updatedAt: createdAt,
      lastOpenedAt: createdAt,
      chapters: chapters.filter((chapter) => chapter.blocks.length),
    };
  } finally {
    await loadingTask.destroy();
  }
}

async function parseEpub(
  file: File,
  documentId: string,
): Promise<StudyDocument> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  let declaredUncompressedBytes = 0;
  Object.values(zip.files).forEach((entry) => {
    const internal = entry as typeof entry & {
      _data?: { uncompressedSize?: number };
    };
    const size = internal._data?.uncompressedSize;
    if (typeof size === "number" && Number.isFinite(size)) {
      declaredUncompressedBytes += size;
    }
  });
  if (declaredUncompressedBytes > IMPORT_LIMITS.epubUncompressedBytes) {
    throw new Error(
      `EPUB 解压后内容不能超过 ${formatMiB(IMPORT_LIMITS.epubUncompressedBytes)} MB`,
    );
  }
  const container = await zip.file("META-INF/container.xml")?.async("text");
  if (!container) throw new Error("EPUB 缺少 container.xml");

  const parser = new DOMParser();
  const containerDoc = parser.parseFromString(container, "application/xml");
  const opfPath = containerDoc
    .querySelector("rootfile")
    ?.getAttribute("full-path");
  if (!opfPath) throw new Error("无法定位 EPUB 内容清单");

  const opfText = await zip.file(opfPath)?.async("text");
  if (!opfText) throw new Error("无法读取 EPUB 内容清单");
  const opfDoc = parser.parseFromString(opfText, "application/xml");
  const basePath = opfPath.includes("/")
    ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1)
    : "";
  const manifest = new Map<string, string>();
  opfDoc.querySelectorAll("manifest item").forEach((item) => {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    if (id && href) manifest.set(id, resolveEpubArchivePath(basePath, href));
  });

  const title =
    opfDoc.querySelector("metadata title")?.textContent?.trim() ||
    file.name.replace(/\.epub$/i, "");
  const chapters: Chapter[] = [];
  const spineItems = [...opfDoc.querySelectorAll("spine itemref")];
  if (spineItems.length > IMPORT_LIMITS.epubSpineItems) {
    throw new Error(`EPUB 章节清单不能超过 ${IMPORT_LIMITS.epubSpineItems} 项`);
  }
  let extractedCharacters = 0;

  for (const itemRef of spineItems) {
    const href = manifest.get(itemRef.getAttribute("idref") || "");
    if (!href) continue;
    const content = await zip.file(href)?.async("text");
    if (!content) continue;
    extractedCharacters += content.length;
    if (extractedCharacters * 2 > IMPORT_LIMITS.epubUncompressedBytes) {
      throw new Error("EPUB 解压后的正文内容过大");
    }
    const doc = parser.parseFromString(content, "text/html");
    doc.querySelectorAll("script, style, nav").forEach((node) => node.remove());
    const heading =
      doc.querySelector("h1, h2, h3, title")?.textContent?.trim() ||
      `章节 ${chapters.length + 1}`;
    const chapterId = `${documentId}:epub-c${chapters.length + 1}`;
    const cleanedHeading = cleanText(heading);
    const blocks = extractEpubBlocks(doc, chapterId, cleanedHeading);
    if (!blocks.length) continue;
    chapters.push({
      id: chapterId,
      title: cleanedHeading,
      order: chapters.length,
      blocks,
    });
  }

  if (!chapters.length) throw new Error("未能从 EPUB 中提取可读章节");
  const createdAt = Date.now();
  return {
    id: documentId,
    title,
    displayTitle: title,
    filename: file.name,
    kind: "epub",
    originalFile: file,
    createdAt,
    updatedAt: createdAt,
    lastOpenedAt: createdAt,
    chapters: addEpubLocations(chapters),
  };
}

export async function parseDocument(file: File): Promise<StudyDocument> {
  validateImportFile(file);
  const documentId = crypto.randomUUID();
  if (/\.pdf$/i.test(file.name)) return parsePdf(file, documentId);
  if (/\.epub$/i.test(file.name)) return parseEpub(file, documentId);
  throw new Error("无法识别教材文件");
}

export async function rebuildPdfDocument(
  document: StudyDocument,
): Promise<StudyDocument> {
  if (document.kind !== "pdf" || !document.originalFile) {
    throw new Error("当前教材没有可用于重建的 PDF 原文件");
  }
  const file =
    document.originalFile instanceof File
      ? document.originalFile
      : new File([document.originalFile], document.filename, {
          type: document.originalFile.type || "application/pdf",
        });
  const rebuilt = await parsePdf(file, document.id);
  return {
    ...rebuilt,
    title: document.title,
    displayTitle: document.displayTitle,
    createdAt: document.createdAt,
    lastOpenedAt: document.lastOpenedAt,
    contentHash: document.contentHash,
    updatedAt: Date.now(),
  };
}

export function createOcrDocument(
  file: File,
  pageTexts: string[],
  documentId = crypto.randomUUID(),
): StudyDocument {
  const chapters: Chapter[] = pageTexts
    .map((text, pageIndex) => {
      const chapterId = `${documentId}:ocr-c${pageIndex + 1}`;
      const cleaned = cleanText(text);
      if (cleaned.length < 10) return null;
      return {
        id: chapterId,
        title: `扫描页 ${pageIndex + 1}`,
        order: pageIndex,
        blocks: splitIntoBlocks(
          cleaned,
          chapterId,
          `PDF 第 ${pageIndex + 1} 页 · OCR`,
          pageIndex + 1,
        ).map((block, index) => ({
          ...block,
          id: `${chapterId}-b${index}`,
        })),
      } satisfies Chapter;
    })
    .filter((chapter): chapter is Chapter => chapter !== null);
  if (!chapters.length) throw new Error("OCR 未能识别出可读文字");
  const createdAt = Date.now();
  const title = file.name.replace(/\.pdf$/i, "");
  return {
    id: documentId,
    title,
    displayTitle: title,
    filename: file.name,
    kind: "pdf",
    originalFile: file,
    createdAt,
    updatedAt: createdAt,
    lastOpenedAt: createdAt,
    chapters,
  };
}
