import { DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import { WorkerMessageHandler } from "pdfjs-dist/build/pdf.worker.mjs";

Object.assign(globalThis, {
  DOMMatrix,
  ImageData,
  Path2D,
  pdfjsWorker: { WorkerMessageHandler },
});

if (!(Uint8Array.prototype as Uint8Array & { toHex?: () => string }).toHex) {
  Object.defineProperty(Uint8Array.prototype, "toHex", {
    configurable: true,
    value(this: Uint8Array) {
      return Array.from(this, (value) =>
        value.toString(16).padStart(2, "0"),
      ).join("");
    },
  });
}

if (
  !(Math as Math & { sumPrecise?: (values: Iterable<number>) => number })
    .sumPrecise
) {
  Object.defineProperty(Math, "sumPrecise", {
    configurable: true,
    value(values: Iterable<number>) {
      let sum = 0;
      let compensation = 0;
      for (const value of values) {
        const adjusted = value - compensation;
        const next = sum + adjusted;
        compensation = next - sum - adjusted;
        sum = next;
      }
      return sum;
    },
  });
}
