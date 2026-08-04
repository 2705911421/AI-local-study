// @vitest-environment jsdom
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  IMPORT_LIMITS,
  parseDocument,
  validateImportFile,
} from "../../src/lib/document";
import { retrieve } from "../../src/lib/learningEngine";
import type { StudyDocument } from "../../src/types";

type Material = {
  id: string;
  filename: string;
  profile: string;
  remoteBytes?: number;
  expected: {
    outcome: "parsed" | "requires_text_or_rejects" | "rejected_by_size";
    kind: "pdf" | "epub";
    minChapters?: number;
    minBlocks?: number;
    keywords?: string[];
  };
};

type TestCase = {
  materialId: string;
  question: string;
  keywords: string[];
  expectedPage: number[];
  minCitations?: number;
  maxCitations?: number;
  negativeKeywords?: string[];
};

type Result = {
  id: string;
  status: "passed" | "failed" | "skipped";
  durationMs: number;
  bytes?: number;
  chapters?: number;
  sections?: number;
  blocks?: number;
  pages?: number;
  virtualPages?: number;
  tableBlocks?: number;
  detail?: string;
};

const projectRoot = path.resolve(import.meta.dirname, "../..");
const corpusDir = path.join(projectRoot, "benchmarks", "corpus");
const resultsDir = path.join(projectRoot, "benchmarks", "results");
const manifest = JSON.parse(
  await readFile(path.join(projectRoot, "benchmarks", "manifest.json"), "utf8"),
) as { version: string; materials: Material[] };
const testCases = JSON.parse(
  await readFile(
    path.join(projectRoot, "benchmarks", "test-cases.json"),
    "utf8",
  ),
) as TestCase[];
const results: Result[] = [];
const parsedDocuments = new Map<string, StudyDocument>();

async function existingFile(filename: string): Promise<string | undefined> {
  const target = path.join(corpusDir, filename);
  try {
    await stat(target);
    return target;
  } catch {
    return undefined;
  }
}

async function parseFixture(
  filename: string,
): Promise<{ document: StudyDocument; bytes: number }> {
  const target = path.join(corpusDir, filename);
  const buffer = await readFile(target);
  const file = new File([buffer], filename, {
    type: filename.endsWith(".epub")
      ? "application/epub+zip"
      : "application/pdf",
  });
  return { document: await parseDocument(file), bytes: buffer.byteLength };
}

describe("知页 Benchmark 教材测试集 v1.0", () => {
  for (const material of manifest.materials) {
    it(`${material.id}: ${material.expected.outcome}`, async (context) => {
      const started = performance.now();
      if (material.expected.outcome === "rejected_by_size") {
        expect(material.remoteBytes).toBeDefined();
        expect(() =>
          validateImportFile({
            name: material.filename,
            size: material.remoteBytes!,
          }),
        ).toThrow();
        results.push({
          id: material.id,
          status: "passed",
          durationMs: performance.now() - started,
          bytes: material.remoteBytes,
          detail: "remote size is above the configured import limit",
        });
        return;
      }

      if (!(await existingFile(material.filename))) {
        results.push({
          id: material.id,
          status: "skipped",
          durationMs: 0,
          detail: "not downloaded",
        });
        context.skip();
        return;
      }

      try {
        const { document, bytes } = await parseFixture(material.filename);
        parsedDocuments.set(material.id, document);
        const blocks = document.chapters.flatMap((chapter) => chapter.blocks);
        const text = blocks
          .map((block) => block.text)
          .join("\n")
          .toLowerCase();
        expect(document.kind).toBe(material.expected.kind);
        if (material.expected.outcome === "parsed") {
          expect(document.chapters.length).toBeGreaterThanOrEqual(
            material.expected.minChapters || 1,
          );
          expect(blocks.length).toBeGreaterThanOrEqual(
            material.expected.minBlocks || 1,
          );
          for (const keyword of material.expected.keywords || []) {
            expect(text).toContain(keyword.toLowerCase());
          }
        }
        results.push({
          id: material.id,
          status: "passed",
          durationMs: performance.now() - started,
          bytes,
          chapters: document.chapters.length,
          sections: document.chapters.reduce(
            (total, chapter) => total + (chapter.sections?.length || 0),
            0,
          ),
          blocks: blocks.length,
          pages: Math.max(0, ...blocks.map((block) => block.page || 0)),
          virtualPages: Math.max(
            0,
            ...blocks.map((block) => block.virtualPage || 0),
          ),
          tableBlocks: blocks.filter((block) => block.blockKind === "table")
            .length,
          detail:
            material.expected.outcome === "requires_text_or_rejects"
              ? "parser extracted a usable text layer"
              : undefined,
        });
      } catch (error) {
        if (material.expected.outcome === "requires_text_or_rejects") {
          results.push({
            id: material.id,
            status: "passed",
            durationMs: performance.now() - started,
            detail: `requires OCR or has no usable text: ${error instanceof Error ? error.message : String(error)}`,
          });
          return;
        }
        results.push({
          id: material.id,
          status: "failed",
          durationMs: performance.now() - started,
          detail: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }, 120_000);
  }

  it("synthetic-medical-adversarial: complex Chinese layout and retrieval", async (context) => {
    const filename = "synthetic-medical-adversarial.pdf";
    if (!(await existingFile(filename))) {
      context.skip();
      return;
    }
    const started = performance.now();
    const { document, bytes } = await parseFixture(filename);
    parsedDocuments.set("synthetic-medical-adversarial", document);
    const blocks = document.chapters.flatMap((chapter) => chapter.blocks);
    const text = blocks.map((block) => block.text).join("\n");
    expect(text).toContain("标准碳酸氢盐");
    expect(text).toContain("β");
    expect(blocks.some((block) => block.page === 3)).toBe(true);
    // Page 4 is image-only; the current mixed-PDF path does not OCR individual blank pages.
    expect(blocks.some((block) => block.page === 4)).toBe(false);
    results.push({
      id: "synthetic-medical-adversarial",
      status: "passed",
      durationMs: performance.now() - started,
      bytes,
      chapters: document.chapters.length,
      sections: document.chapters.reduce(
        (total, chapter) => total + (chapter.sections?.length || 0),
        0,
      ),
      blocks: blocks.length,
      pages: 4,
      tableBlocks: blocks.filter((block) => block.blockKind === "table").length,
      detail:
        "known gap reproduced: image-only page 4 is silently omitted in a mixed PDF",
    });
  }, 120_000);

  it("synthetic-medical-scan: pure image PDF requests OCR", async (context) => {
    const filename = "synthetic-medical-scan.pdf";
    if (!(await existingFile(filename))) {
      context.skip();
      return;
    }
    const started = performance.now();
    await expect(parseFixture(filename)).rejects.toThrow(/OCR|扫描|PDF/);
    results.push({
      id: "synthetic-medical-scan",
      status: "passed",
      durationMs: performance.now() - started,
      detail: "pure image PDF was correctly classified as requiring OCR",
    });
  }, 120_000);

  it("synthetic-2001-pages: rejects the page-count boundary", async (context) => {
    const filename = "synthetic-2001-pages.pdf";
    if (!(await existingFile(filename))) {
      context.skip();
      return;
    }
    const started = performance.now();
    await expect(parseFixture(filename)).rejects.toThrow(
      String(IMPORT_LIMITS.pdfPages),
    );
    results.push({
      id: "synthetic-2001-pages",
      status: "passed",
      durationMs: performance.now() - started,
      detail: "2001-page PDF rejected at the configured 2000-page limit",
    });
  }, 120_000);

  for (const testCase of testCases) {
    it(`retrieval: ${testCase.materialId} / ${testCase.question}`, (context) => {
      const document = parsedDocuments.get(testCase.materialId);
      if (!document) {
        context.skip();
        return;
      }
      const citations = retrieve(
        testCase.question,
        document.chapters[0],
        document.chapters,
        testCase.maxCitations || 6,
      );

      // 1. Must have at least 1 citation
      const minC = testCase.minCitations ?? 1;
      expect(citations.length).toBeGreaterThanOrEqual(minC);

      // 2. Must not exceed max citations
      if (testCase.maxCitations) {
        expect(citations.length).toBeLessThanOrEqual(testCase.maxCitations);
      }

      // 3. At least one keyword must appear in excerpts
      const combined = citations
        .map((citation) => citation.excerpt)
        .join(" ")
        .toLowerCase();
      expect(
        testCase.keywords.some((keyword) =>
          combined.includes(keyword.toLowerCase()),
        ),
      ).toBe(true);

      // 4. At least one citation must match expected page
      expect(
        citations.some((citation) =>
          testCase.expectedPage.some(
            (page) =>
              citation.locator.includes(` ${page} `) ||
              citation.locator.includes(`第 ${page} 页`),
          ),
        ),
      ).toBe(true);

      // 5. Negative keywords must NOT appear
      if (testCase.negativeKeywords?.length) {
        for (const neg of testCase.negativeKeywords) {
          expect(combined).not.toContain(neg.toLowerCase());
        }
      }

      results.push({
        id: `retrieval:${testCase.materialId}:${testCase.question}`,
        status: "passed",
        durationMs: 0,
        detail: citations
          .map(
            (citation) =>
              `${citation.locator} (score ${citation.score.toFixed(3)})`,
          )
          .join("; "),
      });
    });
  }
});

afterAll(async () => {
  await mkdir(resultsDir, { recursive: true });
  const passed = results.filter((item) => item.status === "passed").length;
  const failed = results.filter((item) => item.status === "failed").length;
  const skipped = results.filter((item) => item.status === "skipped").length;
  const report = {
    benchmarkVersion: manifest.version,
    generatedAt: new Date().toISOString(),
    limits: IMPORT_LIMITS,
    summary: { passed, failed, skipped, total: results.length },
    results,
  };
  await writeFile(
    path.join(resultsDir, "latest.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );

  // Human-readable summary
  const lines: string[] = [
    `# Zhiye Benchmark Report v${manifest.version}`,
    ``,
    `Generated: ${new Date().toISOString()}`,
    ``,
    `## Summary`,
    ``,
    `| Metric | Count |`,
    `|--------|-------|`,
    `| Total | ${results.length} |`,
    `| Passed | ${passed} |`,
    `| Failed | ${failed} |`,
    `| Skipped | ${skipped} |`,
    ``,
    `## Parse Results`,
    ``,
    `| ID | Status | Chapters | Blocks | Tables | Pages | Duration |`,
    `|-----|--------|----------|--------|--------|-------|----------|`,
  ];
  for (const r of results.filter((r) => !r.id.startsWith("retrieval:"))) {
    lines.push(
      `| ${r.id} | ${r.status} | ${r.chapters ?? "-"} | ${r.blocks ?? "-"} | ${r.tableBlocks ?? "-"} | ${r.pages ?? "-"} | ${Math.round(r.durationMs)}ms |`,
    );
  }
  lines.push(``, `## Retrieval Results`, ``);
  lines.push(
    `| Material | Question | Status | Detail |`,
    `|----------|----------|--------|--------|`,
  );
  for (const r of results.filter((r) => r.id.startsWith("retrieval:"))) {
    const parts = r.id.split(":");
    lines.push(
      `| ${parts[1]} | ${parts.slice(2).join(":")} | ${r.status} | ${r.detail ?? ""} |`,
    );
  }
  lines.push(
    ``,
    `---`,
    `*Report auto-generated by benchmark-materials.test.ts*`,
  );
  await writeFile(
    path.join(resultsDir, "summary.md"),
    lines.join("\n") + "\n",
    "utf8",
  );
});
