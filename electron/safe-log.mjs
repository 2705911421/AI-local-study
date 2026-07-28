import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export function createSafeLogger(userData) {
  const logDir = path.join(userData, "logs");
  const logFile = path.join(logDir, "intelligence.log");
  return async function log(event, fields = {}) {
    await mkdir(logDir, { recursive: true });
    const safe = {
      at: new Date().toISOString(),
      event,
      provider: clean(fields.provider),
      task: clean(fields.task),
      durationMs:
        typeof fields.durationMs === "number" ? fields.durationMs : undefined,
      errorCode: clean(fields.errorCode),
    };
    await appendFile(logFile, `${JSON.stringify(safe)}\n`, "utf8");
  };
}

function clean(value) {
  return typeof value === "string" ? value.slice(0, 80) : undefined;
}

