import type { Citation, TextBlock } from "../../types";
import {
  askModel as askBrowserModel,
  checkModel as checkBrowserModel,
  detectModelCapabilities as detectBrowserCapabilities,
  enhanceCombinedTextBlocks as enhanceBrowserSelection,
  enhanceTextBlocks as enhanceBrowserBlocks,
  explainPageImage as explainBrowserImage,
  gradeAnswerWithModel as gradeBrowserAnswer,
  generateQuizWithModel as generateBrowserQuiz,
  listModels as listBrowserModels,
} from "../ollama";
import type {
  DesktopSavedSettings,
  IntelligenceConfig,
  IntelligencePayloadMap,
  IntelligenceResult,
  IntelligenceTask,
  ModelGrade,
  ProviderStatus,
} from "./types";

export type {
  DesktopSavedSettings,
  IntelligenceConfig as LlmConfig,
  ModelGrade,
  ProviderId as LlmProvider,
  ProviderStatus,
} from "./types";

export const isDesktopApp = () => Boolean(window.zhiyeDesktop);

async function invokeDesktop<T extends IntelligenceTask>(
  task: T,
  payload: IntelligencePayloadMap[T],
  config: IntelligenceConfig,
  signal?: AbortSignal,
): Promise<IntelligenceResult> {
  const bridge = window.zhiyeDesktop;
  if (!bridge) throw new Error("桌面智能来源不可用");
  const id = crypto.randomUUID();
  const cancel = () => void bridge.cancel(id);
  if (signal?.aborted) {
    cancel();
    throw signal.reason || new DOMException("请求已取消", "AbortError");
  }
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    return await bridge.invoke({
      id,
      provider: config.provider,
      task,
      payload,
      config: {
        provider: config.provider,
        endpoint: config.endpoint,
        model: config.model,
      },
    });
  } finally {
    signal?.removeEventListener("abort", cancel);
  }
}

function isBrowserProvider(config: IntelligenceConfig): boolean {
  return config.provider === "ollama" || config.provider === "openai-compatible";
}

function browserConfig(config: IntelligenceConfig) {
  if (!isBrowserProvider(config)) throw new Error("该来源仅在桌面版可用");
  return {
    provider: config.provider as "ollama" | "openai-compatible",
    endpoint: config.endpoint,
    model: config.model,
    apiKey: config.apiKey,
  };
}

export async function getDesktopSettings(): Promise<DesktopSavedSettings | null> {
  return window.zhiyeDesktop?.getSettings() || null;
}

export async function saveDesktopSettings(
  config: IntelligenceConfig,
  firstRunComplete = true,
): Promise<DesktopSavedSettings | null> {
  return (
    window.zhiyeDesktop?.saveSettings({
      provider: config.provider,
      endpoint: config.endpoint,
      model: config.model,
      apiKey: config.apiKey || undefined,
      firstRunComplete,
    }) || null
  );
}

export async function clearDesktopApiKey(
  provider: "claude" | "openai-compatible",
): Promise<DesktopSavedSettings | null> {
  return window.zhiyeDesktop?.clearApiKey(provider) || null;
}

export async function getProviderStatuses(
  config: IntelligenceConfig,
): Promise<ProviderStatus[]> {
  if (window.zhiyeDesktop) {
    return window.zhiyeDesktop.getStatuses({
      provider: config.provider,
      endpoint: config.endpoint,
      model: config.model,
    });
  }
  const capabilities = await detectBrowserCapabilities(browserConfig(config));
  return [
    {
      provider: config.provider,
      availability: "ready",
      authenticated: true,
      capabilities: {
        text: true,
        vision: capabilities.vision,
        modelList: true,
      },
      label: config.provider === "ollama" ? "本机 Ollama" : "OpenAI 兼容服务",
    },
  ];
}

export async function loginProvider(provider: "codex" | "claude") {
  if (!window.zhiyeDesktop) throw new Error("请在知页桌面版中连接智能体账号");
  return window.zhiyeDesktop.login(provider);
}

export async function logoutProvider(provider: "codex" | "claude") {
  if (!window.zhiyeDesktop) throw new Error("请在知页桌面版中管理智能体账号");
  return window.zhiyeDesktop.logout(provider);
}

export async function listModels(
  config: IntelligenceConfig,
  signal?: AbortSignal,
): Promise<string[]> {
  if (window.zhiyeDesktop) {
    signal?.throwIfAborted();
    return window.zhiyeDesktop.listModels({
      provider: config.provider,
      endpoint: config.endpoint,
      model: config.model,
    });
  }
  if (!isBrowserProvider(config)) return [];
  return listBrowserModels(browserConfig(config), signal);
}

export async function checkModel(
  config: IntelligenceConfig,
  signal?: AbortSignal,
): Promise<boolean> {
  if (window.zhiyeDesktop) {
    signal?.throwIfAborted();
    const statuses = await getProviderStatuses(config);
    return statuses.some(
      (status) =>
        status.provider === config.provider && status.availability === "ready",
    );
  }
  if (!isBrowserProvider(config)) return false;
  return checkBrowserModel(browserConfig(config), signal);
}

export async function detectModelCapabilities(
  config: IntelligenceConfig,
  signal?: AbortSignal,
): Promise<{ vision: boolean; source: "metadata" | "name-fallback" }> {
  if (window.zhiyeDesktop) {
    signal?.throwIfAborted();
    const status = (await getProviderStatuses(config)).find(
      (item) => item.provider === config.provider,
    );
    return {
      vision: Boolean(status?.capabilities.vision),
      source: "metadata",
    };
  }
  return detectBrowserCapabilities(browserConfig(config), signal);
}

export async function askModel(
  question: string,
  citations: Citation[],
  config: IntelligenceConfig,
  signal?: AbortSignal,
): Promise<string> {
  if (!window.zhiyeDesktop) {
    if (!isBrowserProvider(config)) throw new Error("该来源仅在桌面版可用");
    return askBrowserModel(question, citations, browserConfig(config), signal);
  }
  const result = await invokeDesktop(
    "answer",
    { question, citations },
    config,
    signal,
  );
  if (!result.text) throw new Error("智能来源没有返回回答");
  return result.text;
}

export async function enhanceTextBlocks(
  blocks: TextBlock[],
  config: IntelligenceConfig,
  onProgress?: (completed: number, total: number) => void,
  signal?: AbortSignal,
): Promise<Map<string, string>> {
  if (!window.zhiyeDesktop) {
    if (!isBrowserProvider(config)) throw new Error("该来源仅在桌面版可用");
    return enhanceBrowserBlocks(
      blocks,
      browserConfig(config),
      onProgress,
      signal,
    );
  }
  const result = await invokeDesktop(
    "enhance-blocks",
    { blocks },
    config,
    signal,
  );
  onProgress?.(1, 1);
  return new Map((result.blocks || []).map((item) => [item.id, item.text]));
}

export async function enhanceCombinedTextBlocks(
  blocks: TextBlock[],
  config: IntelligenceConfig,
  signal?: AbortSignal,
): Promise<string> {
  if (!window.zhiyeDesktop) {
    if (!isBrowserProvider(config)) throw new Error("该来源仅在桌面版可用");
    return enhanceBrowserSelection(blocks, browserConfig(config), signal);
  }
  const result = await invokeDesktop(
    "enhance-selection",
    { blocks },
    config,
    signal,
  );
  if (!result.text) throw new Error("智能来源没有返回可用的智能文本");
  return result.text;
}

export async function gradeAnswerWithModel(
  answer: string,
  reference: string,
  keyPoints: string[],
  config: IntelligenceConfig,
  signal?: AbortSignal,
): Promise<ModelGrade> {
  if (!window.zhiyeDesktop) {
    if (!isBrowserProvider(config)) throw new Error("该来源仅在桌面版可用");
    return gradeBrowserAnswer(
      answer,
      reference,
      keyPoints,
      browserConfig(config),
      signal,
    );
  }
  const result = await invokeDesktop(
    "grade",
    { answer, reference, keyPoints },
    config,
    signal,
  );
  if (!result.grade) throw new Error("智能来源没有返回有效评分");
  return result.grade;
}

export async function generateQuizWithModel(
  chapterTitle: string,
  blocks: TextBlock[],
  count: number,
  config: IntelligenceConfig,
  signal?: AbortSignal,
) {
  if (!window.zhiyeDesktop) {
    if (!isBrowserProvider(config)) throw new Error("该来源仅在桌面版可用");
    return generateBrowserQuiz(
      chapterTitle,
      blocks,
      count,
      browserConfig(config),
      signal,
    );
  }
  const result = await invokeDesktop(
    "generate-quiz",
    { chapterTitle, blocks, count },
    config,
    signal,
  );
  if (!result.quiz?.length) throw new Error("智能来源没有返回有效练习题");
  return result.quiz;
}

export async function explainPageImage(
  dataUrl: string,
  page: number,
  config: IntelligenceConfig,
  signal?: AbortSignal,
): Promise<string> {
  if (!window.zhiyeDesktop) {
    if (!isBrowserProvider(config)) throw new Error("该来源仅在桌面版可用");
    return explainBrowserImage(
      dataUrl,
      page,
      browserConfig(config),
      signal,
    );
  }
  const result = await invokeDesktop(
    "explain-image",
    { dataUrl, page },
    config,
    signal,
  );
  if (!result.text) throw new Error("智能来源没有返回图示讲解");
  return result.text;
}
