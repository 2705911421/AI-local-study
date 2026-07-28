import type { StudyDocument } from "../types";
import {
  createOcrDocument,
  parseDocument,
  validateImportFile,
} from "./document";

export type ImportStage =
  | "validation"
  | "reading"
  | "structure"
  | "ocr"
  | "index"
  | "save";

export interface ImportProgress {
  stage: ImportStage;
  message: string;
  completed?: number;
  total?: number;
}

export interface ImportOptions {
  signal?: AbortSignal;
  onProgress?: (progress: ImportProgress) => void;
  ocr?: boolean;
}

export interface ImportResult {
  document: StudyDocument;
  report: {
    contentHash: string;
    usedOcr: boolean;
    durationMs: number;
  };
}

type DocumentParser = (file: File) => Promise<StudyDocument>;

function abortError(): DOMException {
  return new DOMException("教材导入已取消", "AbortError");
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw abortError();
}

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function parseScannedPdf(
  file: File,
  options: ImportOptions,
): Promise<StudyDocument> {
  const [{ createWorker }, pdfjsLib] = await Promise.all([
    import("tesseract.js"),
    import("pdfjs-dist"),
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  });
  const pdf = await loadingTask.promise;
  let currentPage = 0;
  const worker = await createWorker(["chi_sim", "eng"], undefined, {
    logger(message) {
      if (message.status === "recognizing text") {
        options.onProgress?.({
          stage: "ocr",
          message: `正在识别第 ${currentPage} / ${pdf.numPages} 页 · ${Math.round(
            message.progress * 100,
          )}%`,
          completed: currentPage - 1 + message.progress,
          total: pdf.numPages,
        });
      }
    },
  });
  const abortWorker = () => {
    void worker.terminate();
  };
  options.signal?.addEventListener("abort", abortWorker, { once: true });
  try {
    const pageTexts: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      currentPage = pageNumber;
      throwIfAborted(options.signal);
      options.onProgress?.({
        stage: "ocr",
        message: `正在识别第 ${pageNumber} / ${pdf.numPages} 页`,
        completed: pageNumber - 1,
        total: pdf.numPages,
      });
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.6 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("浏览器无法创建 OCR 画布");
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      throwIfAborted(options.signal);
      const result = await worker.recognize(canvas);
      pageTexts.push(result.data.text);
      canvas.width = 1;
      canvas.height = 1;
    }
    return createOcrDocument(file, pageTexts);
  } finally {
    options.signal?.removeEventListener("abort", abortWorker);
    await worker.terminate().catch(() => undefined);
    await loadingTask.destroy();
  }
}

export function createImportPipeline(
  parser: DocumentParser = parseDocument,
): {
  run(file: File, options?: ImportOptions): Promise<ImportResult>;
} {
  return {
    async run(file, options = {}) {
      const startedAt = performance.now();
      throwIfAborted(options.signal);
      options.onProgress?.({
        stage: "validation",
        message: "正在校验文件类型与大小",
      });
      validateImportFile(file);
      throwIfAborted(options.signal);

      options.onProgress?.({
        stage: "reading",
        message: "正在读取文件并计算本地指纹",
      });
      const contentHash = await sha256(file);
      throwIfAborted(options.signal);

      options.onProgress?.({
        stage: "structure",
        message: "正在识别教材结构",
      });
      let document: StudyDocument;
      let usedOcr = false;
      try {
        document = await parser(file);
      } catch (error) {
        if (
          options.ocr &&
          /\.pdf$/i.test(file.name) &&
          error instanceof Error &&
          /扫描版|提取文字|OCR/.test(error.message)
        ) {
          usedOcr = true;
          document = await parseScannedPdf(file, options);
        } else {
          throw error;
        }
      }
      throwIfAborted(options.signal);

      options.onProgress?.({
        stage: "index",
        message: "正在建立教材检索索引",
      });
      document = {
        ...document,
        contentHash,
        updatedAt: Date.now(),
      };
      throwIfAborted(options.signal);
      options.onProgress?.({
        stage: "save",
        message: "教材已解析，准备保存",
      });
      return {
        document,
        report: {
          contentHash,
          usedOcr,
          durationMs: performance.now() - startedAt,
        },
      };
    },
  };
}

export const importPipeline = createImportPipeline();
