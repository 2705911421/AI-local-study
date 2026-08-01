// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { IMPORT_LIMITS, parseDocument, validateImportFile } from "./document";

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

    expect(blocks.some((block) => block.locator.endsWith("EPUB 段落 1"))).toBe(
      true,
    );
    expect(blocks.some((block) => block.locator.endsWith("EPUB 段落 2"))).toBe(
      true,
    );
    expect(blocks.some((block) => block.locator.endsWith("EPUB 段落 3"))).toBe(
      true,
    );
    expect(
      blocks.filter((block) => block.locator.endsWith("EPUB 段落 4")).length,
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
      blocks.every((block) => block.locator === "路径章节 · EPUB 段落 1"),
    ).toBe(true);
  });
});
