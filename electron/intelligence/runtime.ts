import {
  getHttpStatus,
  invokeHttp,
  listHttpModels,
  type HttpConfig,
} from "./http-source.js";
import type {
  AgentSource,
  HttpProvider,
  IntelligenceRequest,
  IntelligenceResult,
  ProviderId,
  ProviderStatus,
  RendererConfig,
  SafeLog,
  SettingsStoreContract,
} from "./types.js";

const providers: readonly ProviderId[] = [
  "codex",
  "claude",
  "ollama",
  "openai-compatible",
];
const tasks = [
  "answer",
  "enhance-blocks",
  "enhance-selection",
  "grade",
  "generate-quiz",
  "explain-image",
] as const;

interface IntelligenceRuntimeOptions {
  agentSource: AgentSource;
  settingsStore: SettingsStoreContract;
  log: SafeLog;
}

interface ActiveRequest {
  id: string;
  controller: AbortController;
}

export class IntelligenceRuntime {
  private readonly agentSource: AgentSource;
  private readonly settingsStore: SettingsStoreContract;
  private readonly log: SafeLog;
  private readonly active = new Map<ProviderId, ActiveRequest>();

  constructor({ agentSource, settingsStore, log }: IntelligenceRuntimeOptions) {
    this.agentSource = agentSource;
    this.settingsStore = settingsStore;
    this.log = log;
  }

  async initialize(): Promise<void> {
    await this.agentSource.initialize();
  }

  async statuses(
    rendererConfig: RendererConfig = {},
  ): Promise<ProviderStatus[]> {
    const [agents, selected] = await Promise.all([
      this.agentSource.statuses(),
      this.settingsStore.getRuntimeConfig(rendererConfig),
    ]);
    const httpStatuses = await Promise.all(
      (["ollama", "openai-compatible"] as const).map(async (provider) => {
        const config =
          selected.provider === provider
            ? selected
            : defaultHttpConfig(provider);
        return getHttpStatus(
          { ...config, provider },
          AbortSignal.timeout(5_000),
        );
      }),
    );
    return [...agents, ...httpStatuses];
  }

  login(provider: ProviderId): Promise<ProviderStatus | undefined> {
    return this.agentSource.login(provider);
  }

  logout(provider: ProviderId): Promise<ProviderStatus | undefined> {
    this.cancelProvider(provider);
    return this.agentSource.logout(provider);
  }

  async listModels(rendererConfig: RendererConfig): Promise<string[]> {
    const config = await this.settingsStore.getRuntimeConfig(rendererConfig);
    if (!isHttpProvider(config.provider)) return [];
    return listHttpModels(
      { ...config, provider: config.provider },
      AbortSignal.timeout(8_000),
    );
  }

  async invoke(request: unknown): Promise<IntelligenceResult> {
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
        const config = await this.settingsStore.getRuntimeConfig(
          request.config,
        );
        if (!isHttpProvider(config.provider)) {
          throw new Error("HTTP 智能来源配置不正确");
        }
        result = await invokeHttp(
          request,
          { ...config, provider: config.provider },
          controller.signal,
        );
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
      throw new Error(normalized.message, { cause: error });
    } finally {
      clearTimeout(timer);
      const active = this.active.get(request.provider);
      if (active?.id === request.id) this.active.delete(request.provider);
    }
  }

  cancel(requestId: string): void {
    for (const [provider, active] of this.active) {
      if (active.id !== requestId) continue;
      active.controller.abort(new DOMException("请求已取消", "AbortError"));
      this.active.delete(provider);
      break;
    }
  }

  private cancelProvider(provider: ProviderId): void {
    const active = this.active.get(provider);
    if (!active) return;
    active.controller.abort(new DOMException("请求已替换", "AbortError"));
    this.active.delete(provider);
  }

  async cleanup(): Promise<void> {
    for (const { controller } of this.active.values()) controller.abort();
    this.active.clear();
    await this.agentSource.cleanup();
  }
}

function validateRequest(
  request: unknown,
): asserts request is IntelligenceRequest {
  if (!request || typeof request !== "object")
    throw new Error("请求格式不正确");
  const candidate = request as Record<string, unknown>;
  if (
    typeof candidate.id !== "string" ||
    candidate.id.length < 8 ||
    candidate.id.length > 100
  ) {
    throw new Error("请求 ID 不正确");
  }
  if (
    typeof candidate.provider !== "string" ||
    !providers.includes(candidate.provider as ProviderId)
  ) {
    throw new Error("未知智能来源");
  }
  if (
    typeof candidate.task !== "string" ||
    !tasks.includes(candidate.task as (typeof tasks)[number])
  ) {
    throw new Error("未知智能任务");
  }
  if (!candidate.payload || typeof candidate.payload !== "object") {
    throw new Error("任务内容缺失");
  }
  const size = Buffer.byteLength(JSON.stringify(request), "utf8");
  if (size > 12 * 1024 * 1024) throw new Error("任务内容超过 12 MB 限制");
  if (
    "blocks" in candidate.payload &&
    (!Array.isArray(candidate.payload.blocks) ||
      candidate.payload.blocks.length > 100)
  ) {
    throw new Error("单次最多处理 100 个教材段落");
  }
  if (
    "citations" in candidate.payload &&
    (!Array.isArray(candidate.payload.citations) ||
      candidate.payload.citations.length > 10)
  ) {
    throw new Error("单次最多使用 10 条教材证据");
  }
}

function normalizeError(error: unknown, signal: AbortSignal) {
  if (signal.aborted) {
    const reason: unknown = signal.reason;
    const reasonName =
      reason instanceof Error || reason instanceof DOMException
        ? reason.name
        : "";
    const reasonMessage = reason instanceof Error ? reason.message : "";
    return {
      code: reasonName === "AbortError" ? "cancelled" : "timeout",
      message:
        reasonName === "AbortError"
          ? "请求已取消"
          : reasonMessage || "智能来源响应超时",
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

function defaultHttpConfig(provider: HttpProvider): HttpConfig {
  return provider === "ollama"
    ? {
        provider,
        endpoint: "http://localhost:11434",
        model: "qwen3:4b",
        apiKey: "",
        claudeToken: "",
      }
    : {
        provider,
        endpoint: "",
        model: "",
        apiKey: "",
        claudeToken: "",
      };
}

function isHttpProvider(provider: ProviderId): provider is HttpProvider {
  return provider === "ollama" || provider === "openai-compatible";
}
