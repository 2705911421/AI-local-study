// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  IMPORT_LIMITS,
  parseDocument,
  semanticPdfBlocks,
  validateImportFile,
} from "./document";

describe("validateImportFile", () => {
  it("accepts supported files within their limits", () => {
    expect(() =>
      validateImportFile({
        name: "textbook.PDF",
        size: IMPORT_LIMITS.pdfBytes,
      }),
    ).not.toThrow();
    expect(() =>
      validateImportFile({
        name: "textbook.epub",
        size: IMPORT_LIMITS.epubBytes,
      }),
    ).not.toThrow();
  });

  it("rejects unsupported and oversized files", () => {
    expect(() => validateImportFile({ name: "notes.txt", size: 20 })).toThrow(
      "仅支持 PDF 和 EPUB",
    );
    expect(() =>
      validateImportFile({
        name: "huge.pdf",
        size: IMPORT_LIMITS.pdfBytes + 1,
      }),
    ).toThrow("不能超过");
    expect(() =>
      validateImportFile({
        name: "huge.epub",
        size: IMPORT_LIMITS.epubBytes + 1,
      }),
    ).toThrow("不能超过");
  });
});

describe("EPUB paragraph locators", () => {
  it("preserves semantic paragraphs and splits only an oversized paragraph", async () => {
    const zip = new JSZip();
    zip.file(
      "META-INF/container.xml",
      `<?xml version="1.0"?>
      <container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>`,
    );
    zip.file(
      "OEBPS/content.opf",
      `<?xml version="1.0"?>
      <package>
        <metadata><title>段落教材</title></metadata>
        <manifest><item id="chapter" href="chapter.xhtml"/></manifest>
        <spine><itemref idref="chapter"/></spine>
      </package>`,
    );
    zip.file(
      "OEBPS/chapter.xhtml",
      `<html><body>
        <h1>第一章</h1>
        <p>这是第一个真实段落，内容足够长以便被识别并保留。</p>
        <p>这是第二个真实段落，引用必须能够定位到第二段。</p>
        <ul><li>这是列表中的第三个语义段落，同样需要独立定位。</li></ul>
        <p>${"这是一个很长的句子。".repeat(70)}</p>
      </body></html>`,
    );
    const bytes = await zip.generateAsync({ type: "arraybuffer" });
    const document = await parseDocument(
      new File([bytes], "paragraphs.epub", { type: "application/epub+zip" }),
    );
    const blocks = document.chapters[0].blocks;

    expect(
      blocks.some((block) => block.locator.includes("EPUB 段落 1 ·")),
    ).toBe(true);
    expect(
      blocks.some((block) => block.locator.includes("EPUB 段落 2 ·")),
    ).toBe(true);
    expect(
      blocks.some((block) => block.locator.includes("EPUB 段落 3 ·")),
    ).toBe(true);
    expect(
      blocks.filter((block) => block.locator.includes("EPUB 段落 4 ·")).length,
    ).toBeGreaterThan(1);
  });

  it("resolves relative spine paths and hard-splits a long sentence", async () => {
    const zip = new JSZip();
    zip.file(
      "META-INF/container.xml",
      `<?xml version="1.0"?>
      <container><rootfiles><rootfile full-path="OEBPS/package/content.opf"/></rootfiles></container>`,
    );
    zip.file(
      "OEBPS/package/content.opf",
      `<?xml version="1.0"?>
      <package>
        <metadata><title>相对路径教材</title></metadata>
        <manifest><item id="chapter" href="../Text/chapter.xhtml#section"/></manifest>
        <spine><itemref idref="chapter"/></spine>
      </package>`,
    );
    zip.file(
      "OEBPS/Text/chapter.xhtml",
      `<html><body><h1>路径章节</h1><p>${"无标点长句".repeat(180)}</p></body></html>`,
    );

    const bytes = await zip.generateAsync({ type: "arraybuffer" });
    const document = await parseDocument(
      new File([bytes], "relative.epub", { type: "application/epub+zip" }),
    );
    const blocks = document.chapters[0].blocks;

    expect(blocks.length).toBeGreaterThan(1);
    expect(blocks.every((block) => block.text.length <= 520)).toBe(true);
    expect(
      blocks.every((block) =>
        block.locator.includes("路径章节 · EPUB 段落 1 · 虚拟页"),
      ),
    ).toBe(true);
  });

  it("adds stable virtual pages and progress percentages", async () => {
    const zip = new JSZip();
    zip.file(
      "META-INF/container.xml",
      '<container><rootfiles><rootfile full-path="content.opf"/></rootfiles></container>',
    );
    zip.file(
      "content.opf",
      '<package><metadata><title>定位</title></metadata><manifest><item id="c" href="c.xhtml"/></manifest><spine><itemref idref="c"/></spine></package>',
    );
    zip.file(
      "c.xhtml",
      `<html><body><h1>章节</h1><p>${"第一段正文内容。".repeat(80)}</p><p>${"第二段正文内容。".repeat(80)}</p></body></html>`,
    );
    const bytes = await zip.generateAsync({ type: "arraybuffer" });
    const document = await parseDocument(new File([bytes], "locator.epub"));
    const blocks = document.chapters.flatMap((chapter) => chapter.blocks);
    expect(blocks[0].virtualPage).toBe(1);
    expect(blocks.at(-1)?.progressPercent).toBe(100);
    expect(blocks.at(-1)?.locator).toContain("进度");
  });
});

describe("complex PDF segmentation", () => {
  const item = (
    text: string,
    x: number,
    y: number,
    sourceIndex: number,
    width = 90,
  ) => ({
    text,
    x,
    y,
    sourceIndex,
    width,
    height: 12,
  });

  it("reads both columns independently instead of interleaving rows", () => {
    const blocks = semanticPdfBlocks(
      [
        item("左栏第一行内容足够长", 50, 650, 0),
        item("右栏第一行内容足够长", 330, 650, 1),
        item("左栏第二行继续说明", 50, 630, 2),
        item("右栏第二行继续说明", 330, 630, 3),
      ],
      "chapter",
      1,
    );
    expect(blocks[0].text).toContain("左栏第一行");
    expect(blocks[0].text).toContain("左栏第二行");
    expect(blocks[0].text).not.toContain("右栏第一行");
    expect(blocks[0].sourceItemIndexes).toEqual([0, 2]);
    expect(blocks.some((block) => block.text.includes("右栏第一行"))).toBe(
      true,
    );
  });

  it("keeps three-column prose in column reading order", () => {
    const blocks = semanticPdfBlocks(
      [
        item("第一栏第一行正文内容", 50, 650, 0),
        item("第二栏第一行正文内容", 260, 650, 1),
        item("第三栏第一行正文内容", 470, 650, 2),
        item("第一栏第二行继续说明", 50, 630, 3),
        item("第二栏第二行继续说明", 260, 630, 4),
        item("第三栏第二行继续说明", 470, 630, 5),
      ],
      "chapter",
      2,
    );

    expect(blocks).toHaveLength(3);
    expect(blocks.every((block) => block.blockKind !== "table")).toBe(true);
    expect(blocks[0].text).toContain("第一栏第一行");
    expect(blocks[0].text).toContain("第一栏第二行");
    expect(blocks[0].text).not.toContain("第二栏第一行");
  });

  it("preserves spaced table cells as a table block", () => {
    const blocks = semanticPdfBlocks(
      [
        item("项目", 50, 650, 0, 35),
        item("数量", 180, 650, 1, 35),
        item("金额", 310, 650, 2, 35),
      ],
      "chapter",
      2,
    );
    expect(blocks[0]).toMatchObject({ blockKind: "table" });
    expect(blocks[0].text).toContain("项目 | 数量 | 金额");
  });
});
