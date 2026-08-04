/* eslint-disable no-console */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createWorker } from "tesseract.js";

const projectRoot = path.resolve(import.meta.dirname, "..");
const imagePath = path.join(
  projectRoot,
  "benchmarks",
  "corpus",
  "synthetic-medical-scan-page.png",
);
const tessdataDir = path.join(projectRoot, "benchmarks", "corpus", "tessdata");
const resultsDir = path.join(projectRoot, "benchmarks", "results");
const expected = [
  "代谢性酸中毒",
  "酸负荷增加",
  "碳酸氢根丢失",
  "肾排酸障碍",
  "Na+",
  "HCO3-",
  "β1",
  "PaCO2",
];
const started = performance.now();
await mkdir(tessdataDir, { recursive: true });
const worker = await createWorker(["chi_sim", "eng"], undefined, {
  cachePath: tessdataDir,
});

try {
  const { data } = await worker.recognize(await readFile(imagePath));
  const normalized = data.text.replace(/\s+/g, "");
  const checks = expected.map((keyword) => ({
    keyword,
    found: normalized.includes(keyword),
  }));
  const report = {
    generatedAt: new Date().toISOString(),
    durationMs: performance.now() - started,
    confidence: data.confidence,
    expectedCount: expected.length,
    matchedCount: checks.filter((item) => item.found).length,
    checks,
    text: data.text,
  };
  await mkdir(resultsDir, { recursive: true });
  await writeFile(
    path.join(resultsDir, "ocr-latest.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  console.log(JSON.stringify(report, null, 2));
  if (report.matchedCount !== report.expectedCount) process.exitCode = 1;
} finally {
  await worker.terminate();
}
