import { getHttpStatus, invokeHttp, listHttpModels } from "./http-source.mjs";

const providers = ["codex", "claude", "ollama", "openai-compatible"];
const tasks = [
  "answer",
  "enhance-blocks",
  "enhance-selection",
  "grade",
  "explain-image",
];

export class IntelligenceRuntime {
  constructor({ agentSource, settingsStore, log }) {
    this.agentSource = agentSource;
    this.settingsStore = settingsStore;
    this.log = log;
    this.active = new Map();
  }

  async initialize() {
    await this.agentSource.initialize();
  }

  async statuses(rendererConfig = {}) {
    const [agents, selected] = await Promise.all([
      this.agentSource.statuses(),
      this.settingsStore.getRuntimeConfig(rendererConfig),
    ]);
    const httpStatuses = await Promise.all(
      ["ollama", "openai-compatible"].map(async (provider) => {
        const config =
          selected.provider === provider
            ? selected
            : defaultHttpConfig(provider);
        return getHttpStatus({ ...config, provider }, AbortSignal.timeout(5_000));
      }),
    );
    return [...agents, ...httpStatuses];
  }

  login(provider) {
    return this.agentSource.login(provider);
  }

  logout(provider) {
    this.cancelProvider(provider);
    return this.agentSource.logout(provider);
  }

  async listModels(rendererConfig) {
    const config = await this.settingsStore.getRuntimeConfig(rendererConfig);
    if (!["ollama", "openai-compatible"].includes(config.provider)) return [];
    return listHttpModels(config, AbortSignal.timeout(8_000));
  }

  async invoke(request) {
    validateRequest(request);
    this.cancelProvider(request.provider);
    const controller = new AbortController();
    this.active.set(request.provider, { id: request.id, controller });
    const timeoutMs =
      request.task === "answer" || request.task === "grade" ? 60_000 : 120_000;
    const timer = setTimeout(
      () => controller.abort(new Error("智能来源响应超时")),
      timeoutMs,
    );
    const started = Date.now();
    try {
      let result;
      if (request.provider === "codex" || request.provider === "claude") {
        result = await this.agentSource.invoke(request, controller);
      } else {
        const config = await this.settingsStore.getRuntimeConfig(request.config);
        result = await invokeHttp(request, config, controller.signal);
      }
      await this.log("task.completed", {
        provider: request.provider,
        task: request.task,
        durationMs: Date.now() - started,
      });
      return result;
    } catch (error) {
      const normalized = normalizeError(error, controller.signal);
      await this.log("task.failed", {
        provider: request.provider,
        task: request.task,
        durationMs: Date.now() - started,
        errorCode: normalized.code,
      });
      throw new Error(normalized.message);
    } finally {
      clearTimeout(timer);
      const active = this.active.get(request.provider);
      if (active?.id === request.id) this.active.delete(request.provider);
    }
  }

  cancel(requestId) {
    for (const [provider, active] of this.active) {
      if (active.id !== requestId) continue;
      active.controller.abort(new DOMException("请求已取消", "AbortError"));
      this.active.delete(provider);
      break;
    }
  }

  cancelProvider(provider) {
    const active = this.active.get(provider);
    if (!active) return;
    active.controller.abort(new DOMException("请求已替换", "AbortError"));
    this.active.delete(provider);
  }

  async cleanup() {
    for (const { controller } of this.active.values()) controller.abort();
    this.active.clear();
    await this.agentSource.cleanup();
  }
}

function validateRequest(request) {
  if (!request || typeof request !== "object") throw new Error("请求格式不正确");
  if (
    typeof request.id !== "string" ||
    request.id.length < 8 ||
    request.id.length > 100
  ) {
    throw new Error("请求 ID 不正确");
  }
  if (!providers.includes(request.provider)) throw new Error("未知智能来源");
  if (!tasks.includes(request.task)) throw new Error("未知智能任务");
  if (!request.payload || typeof request.payload !== "object") {
    throw new Error("任务内容缺失");
  }
  const size = Buffer.byteLength(JSON.stringify(request), "utf8");
  if (size > 12 * 1024 * 1024) throw new Error("任务内容超过 12 MB 限制");
  if (
    "blocks" in request.payload &&
    (!Array.isArray(request.payload.blocks) ||
      request.payload.blocks.length > 100)
  ) {
    throw new Error("单次最多处理 100 个教材段落");
  }
  if (
    "citations" in request.payload &&
    (!Array.isArray(request.payload.citations) ||
      request.payload.citations.length > 10)
  ) {
    throw new Error("单次最多使用 10 条教材证据");
  }
}

function normalizeError(error, signal) {
  if (signal.aborted) {
    const reason = signal.reason;
    return {
      code: reason?.name === "AbortError" ? "cancelled" : "timeout",
      message:
        reason?.name === "AbortError"
          ? "请求已取消"
          : reason?.message || "智能来源响应超时",
    };
  }
  const message = error instanceof Error ? error.message : "智能来源调用失败";
  return {
    code: /登录|auth|token|401|403/i.test(message)
      ? "not_authenticated"
      : /额度|billing|limit|429/i.test(message)
        ? "quota"
        : "provider_error",
    message: message.replace(/sk-[A-Za-z0-9_-]{10,}/g, "[已隐藏凭据]"),
  };
}

function defaultHttpConfig(provider) {
  return provider === "ollama"
    ? {
        provider,
        endpoint: "http://localhost:11434",
        model: "qwen3:4b",
        apiKey: "",
      }
    : {
        provider,
        endpoint: "",
        model: "",
        apiKey: "",
      };
}

