import type { Citation, QuizItem, TextBlock } from "../types";
import {
  createBlockBatches,
  runBatchQueue,
  type BatchGenerationOptions,
} from "./batchGeneration";

export type LlmProvider = "ollama" | "openai-compatible";

export interface LlmConfig {
  provider: LlmProvider;
  endpoint: string;
  model: string;
  apiKey: string;
}

interface ChatMessagePayload {
  role: "system" | "user";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
  images?: string[];
}

const DEFAULT_CHAT_TIMEOUT_MS = 60_000;

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_CHAT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(
    () => controller.abort(new DOMException("请求超时", "TimeoutError")),
    timeoutMs,
  );
  const abortFromCaller = () =>
    controller.abort(
      init.signal?.reason || new DOMException("请求已取消", "AbortError"),
    );
  if (init.signal?.aborted) {
    abortFromCaller();
  } else {
    init.signal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (
      controller.signal.reason instanceof DOMException &&
      controller.signal.reason.name === "TimeoutError"
    ) {
      throw new Error(`模型服务在 ${Math.ceil(timeoutMs / 1000)} 秒内未响应`);
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
    init.signal?.removeEventListener("abort", abortFromCaller);
  }
}

function trimEndpoint(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, "");
}

function openAiChatUrl(endpoint: string): string {
  const base = trimEndpoint(endpoint);
  return /\/chat\/completions$/i.test(base) ? base : `${base}/chat/completions`;
}

function openAiModelsUrl(endpoint: string): string {
  const base = trimEndpoint(endpoint).replace(/\/chat\/completions$/i, "");
  return `${base}/models`;
}

export async function listModels(
  config: LlmConfig,
  signal?: AbortSignal,
): Promise<string[]> {
  const url =
    config.provider === "ollama"
      ? `${trimEndpoint(config.endpoint)}/api/tags`
      : openAiModelsUrl(config.endpoint);
  const response = await fetchWithTimeout(
    url,
    {
      headers:
        config.provider === "openai-compatible" && config.apiKey
          ? { Authorization: `Bearer ${config.apiKey.trim()}` }
          : undefined,
      signal,
    },
    8_000,
  );
  if (!response.ok) {
    throw new Error(`无法获取模型列表（${response.status}）`);
  }
  const data = (await response.json()) as {
    data?: Array<{ id?: string }>;
    models?: Array<{ name?: string; model?: string }>;
  };
  const models =
    config.provider === "ollama"
      ? (data.models || []).map((item) => item.name || item.model || "")
      : (data.data || []).map((item) => item.id || "");
  return [...new Set(models.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

async function chat(
  messages: ChatMessagePayload[],
  config: LlmConfig,
  options?: {
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
    timeoutMs?: number;
  },
): Promise<string> {
  if (config.provider === "ollama") {
    const response = await fetchWithTimeout(
      `${trimEndpoint(config.endpoint)}/api/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.model,
          stream: false,
          options: { temperature: options?.temperature ?? 0.1 },
          messages,
        }),
        signal: options?.signal,
      },
      options?.timeoutMs,
    );
    if (!response.ok) {
      throw new Error(`Ollama 请求失败（${response.status}）`);
    }
    const data = (await response.json()) as {
      message?: { content?: string };
    };
    if (!data.message?.content) throw new Error("Ollama 没有返回内容");
    return data.message.content;
  }

  const response = await fetchWithTimeout(
    openAiChatUrl(config.endpoint),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey
          ? { Authorization: `Bearer ${config.apiKey.trim()}` }
          : {}),
      },
      body: JSON.stringify({
        model: config.model,
        temperature: options?.temperature ?? 0.1,
        max_tokens: options?.maxTokens,
        messages,
      }),
      signal: options?.signal,
    },
    options?.timeoutMs,
  );
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(
      `外部模型请求失败（${response.status}）${details ? `：${details.slice(0, 120)}` : ""}`,
    );
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("外部模型没有返回内容");
  return content;
}

export async function askModel(
  question: string,
  citations: Citation[],
  config: LlmConfig,
  signal?: AbortSignal,
): Promise<string> {
  const evidence = citations
    .map(
      (citation, index) =>
        `[证据 ${index + 1}｜${citation.locator}]\n${citation.excerpt}`,
    )
    .join("\n\n");

  return chat(
    [
      {
        role: "system",
        content:
          "你是教材伴学助手。只能依据用户提供的证据回答，不得使用外部知识。若证据不足，必须回答“教材中未找到足够依据”。用简洁中文作答，不要编造页码或引用。",
      },
      {
        role: "user",
        content: `问题：${question}\n\n${evidence}`,
      },
    ],
    config,
    { signal },
  );
}

export interface ModelGrade {
  score: number;
  feedback: string;
  coveredKeyPoints: string[];
  missingKeyPoints: string[];
}

export async function gradeAnswerWithModel(
  answer: string,
  reference: string,
  keyPoints: string[],
  config: LlmConfig,
  signal?: AbortSignal,
): Promise<ModelGrade> {
  const content = await chat(
    [
      {
        role: "system",
        content:
          '你是教材练习评分器。只能依据教材参考答案与关键要点评价，不得补充外部知识。严格返回 JSON 对象：{"score":0到1,"feedback":"一句中文反馈","coveredKeyPoints":["已覆盖要点"],"missingKeyPoints":["未覆盖要点"]}。',
      },
      {
        role: "user",
        content: JSON.stringify({ answer, reference, keyPoints }),
      },
    ],
    config,
    { temperature: 0, maxTokens: 500, signal, timeoutMs: 30_000 },
  );
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || content;
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("模型评分格式不正确");
  const value = JSON.parse(fenced.slice(start, end + 1)) as Partial<ModelGrade>;
  if (
    typeof value.score !== "number" ||
    value.score < 0 ||
    value.score > 1 ||
    typeof value.feedback !== "string" ||
    !Array.isArray(value.coveredKeyPoints) ||
    !Array.isArray(value.missingKeyPoints)
  ) {
    throw new Error("模型评分缺少必要字段");
  }
  return value as ModelGrade;
}

export async function generateQuizWithModel(
  chapterTitle: string,
  blocks: TextBlock[],
  count: number,
  config: LlmConfig,
  signal?: AbortSignal,
): Promise<QuizItem[]> {
  const content = await chat(
    [
      {
        role: "system",
        content:
          '你是教材练习设计器。只能依据给出的教材段落生成练习。严格返回 JSON：{"quiz":[{"id":"题目ID","kind":"recall|distinguish|choice|application","prompt":"问题","answer":"参考答案","rationale":"教材内解析","locator":"原定位","evidenceBlockId":"原段落ID","keyPoints":["要点"],"options":[]}]}。',
      },
      {
        role: "user",
        content: JSON.stringify({
          chapterTitle,
          count,
          blocks: blocks.map((block) => ({
            id: block.id,
            locator: block.locator,
            text: block.smartText || block.text,
          })),
        }),
      },
    ],
    config,
    { temperature: 0.3, maxTokens: 2400, signal, timeoutMs: 60_000 },
  );
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || content;
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("模型出题格式不正确");
  const value = JSON.parse(fenced.slice(start, end + 1)) as {
    quiz?: QuizItem[];
  };
  if (!Array.isArray(value.quiz) || !value.quiz.length) {
    throw new Error("模型没有返回有效练习题");
  }
  const sourceIds = new Set(blocks.map((block) => block.id));
  return value.quiz
    .filter(
      (item) =>
        item &&
        typeof item.prompt === "string" &&
        typeof item.answer === "string" &&
        Boolean(item.evidenceBlockId && sourceIds.has(item.evidenceBlockId)),
    )
    .slice(0, count);
}

export async function checkModel(
  config: LlmConfig,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const content = await chat(
      [
        {
          role: "system",
          content: "这是连接测试。只回复 OK。",
        },
        { role: "user", content: "OK" },
      ],
      config,
      { temperature: 0, maxTokens: 4, signal, timeoutMs: 12_000 },
    );
    return Boolean(content.trim());
  } catch (error) {
    if (isAbortError(error)) throw error;
    return false;
  }
}

export interface ModelCapabilities {
  vision: boolean;
  source: "metadata" | "name-fallback";
}

function nameSuggestsVision(model: string): boolean {
  return /(^|[-_:./])(vision|vl|4o|4\.1|gemini|pixtral|llava|minicpm-v|internvl|glm-4v)([-_:./]|$)/i.test(
    model,
  );
}

function metadataSupportsVision(value: unknown): boolean | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const candidates = [
    record.capabilities,
    record.modalities,
    record.input_modalities,
    (record.architecture as Record<string, unknown> | undefined)
      ?.input_modalities,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const normalized = candidate.map((item) => String(item).toLowerCase());
      if (normalized.some((item) => item === "vision" || item === "image")) {
        return true;
      }
      if (normalized.some((item) => item === "text")) return false;
    }
    if (candidate && typeof candidate === "object") {
      const capability = candidate as Record<string, unknown>;
      if (capability.vision === true || capability.image === true) return true;
      if (capability.vision === false || capability.image === false)
        return false;
    }
  }
  return null;
}

export async function detectModelCapabilities(
  config: LlmConfig,
  signal?: AbortSignal,
): Promise<ModelCapabilities> {
  try {
    const url =
      config.provider === "ollama"
        ? `${trimEndpoint(config.endpoint)}/api/show`
        : `${openAiModelsUrl(config.endpoint)}/${encodeURIComponent(config.model)}`;
    const response = await fetchWithTimeout(
      url,
      {
        method: config.provider === "ollama" ? "POST" : "GET",
        headers: {
          ...(config.provider === "ollama"
            ? { "Content-Type": "application/json" }
            : {}),
          ...(config.provider === "openai-compatible" && config.apiKey
            ? { Authorization: `Bearer ${config.apiKey.trim()}` }
            : {}),
        },
        body:
          config.provider === "ollama"
            ? JSON.stringify({ model: config.model })
            : undefined,
        signal,
      },
      8_000,
    );
    if (response.ok) {
      const metadata = await response.json();
      const detected = metadataSupportsVision(metadata);
      if (detected !== null) return { vision: detected, source: "metadata" };
    }
  } catch (error) {
    if (isAbortError(error)) throw error;
    // Some OpenAI-compatible providers do not expose per-model metadata.
  }
  return {
    vision: nameSuggestsVision(config.model),
    source: "name-fallback",
  };
}

export async function explainPageImage(
  dataUrl: string,
  page: number,
  config: LlmConfig,
  signal?: AbortSignal,
): Promise<string> {
  const prompt =
    `请讲解教材 PDF 第 ${page} 页中可见的示意图、流程图、结构图或图表。` +
    "只依据图片中可见的标题、标注、箭头、图例和相互关系作答，不补充图片以外的事实。" +
    "先说明图在表达什么，再按阅读顺序解释各部分关系；若本页没有有意义的图，请明确说明。";
  const imageBase64 = dataUrl.replace(
    /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
    "",
  );
  const messages: ChatMessagePayload[] =
    config.provider === "ollama"
      ? [
          {
            role: "user",
            content: prompt,
            images: [imageBase64],
          },
        ]
      : [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ];
  return chat(messages, config, {
    temperature: 0.1,
    maxTokens: 1200,
    signal,
    timeoutMs: 120_000,
  });
}

function extractJsonArray(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || content;
  const start = fenced.indexOf("[");
  const end = fenced.lastIndexOf("]");
  if (start < 0 || end <= start) {
    throw new Error("模型没有返回可解析的智能文本");
  }
  return JSON.parse(fenced.slice(start, end + 1));
}

export async function enhanceTextBlocks(
  blocks: TextBlock[],
  config: LlmConfig,
  onProgress?: (
    completed: number,
    total: number,
    partial: ReadonlyMap<string, string>,
  ) => void,
  signal?: AbortSignal,
  options?: BatchGenerationOptions,
): Promise<Map<string, string>> {
  const batches = createBlockBatches(blocks);
  const enhanced = new Map<string, string>();
  let completed = 0;
  const tasks = batches.map((current) => async () => {
    signal?.throwIfAborted();
    const source = current.map((block) => ({
      id: block.id,
      page: block.page,
      text: block.text,
    }));
    const content = await chat(
      [
        {
          role: "system",
          content:
            '你是教材文本整理器。只能整理输入原文，不得补充外部知识、推断、总结或删除事实。清除页眉页脚、孤立页码和重复章名；修复 PDF 提取造成的断词与多余空格；保留标题、编号、术语、数据和原有论述顺序；将每个块整理为清晰可读的中文。严格返回 JSON 数组，每项格式为 {"id":"原ID","text":"整理后的完整文本"}，不要返回其他内容。',
        },
        {
          role: "user",
          content: JSON.stringify(source),
        },
      ],
      config,
      {
        temperature: 0,
        maxTokens: 6000,
        signal,
        timeoutMs: 120_000,
      },
    );
    const parsed = extractJsonArray(content);
    if (!Array.isArray(parsed)) {
      throw new Error("模型返回格式不正确");
    }
    const result = new Map<string, string>();
    parsed.forEach((item) => {
      if (
        typeof item === "object" &&
        item !== null &&
        "id" in item &&
        "text" in item &&
        typeof item.id === "string" &&
        typeof item.text === "string" &&
        current.some((block) => block.id === item.id) &&
        item.text.trim().length > 8
      ) {
        result.set(item.id, item.text.trim());
      }
    });
    return result;
  });
  await runBatchQueue(tasks, options, (result, index) => {
    result.forEach((text, id) => enhanced.set(id, text));
    completed += batches[index].length;
    onProgress?.(completed, blocks.length, new Map(enhanced));
  });
  return enhanced;
}

export async function enhanceCombinedTextBlocks(
  blocks: TextBlock[],
  config: LlmConfig,
  signal?: AbortSignal,
): Promise<string> {
  if (!blocks.length) throw new Error("没有可整理的原文段落");
  const source = blocks.map((block, index) => ({
    order: index + 1,
    page: block.page,
    text: block.text,
  }));
  return chat(
    [
      {
        role: "system",
        content:
          "你是教材文本整理器。下面多个原文段落共同对应一份智能文本。只能整理输入原文，不得补充外部知识、推断、总结或删除事实。修复断词与多余空格，保留标题、编号、术语、数据和论述顺序，并将相邻段落衔接为一份结构清晰的中文整理稿。只返回整理后的正文。",
      },
      { role: "user", content: JSON.stringify(source) },
    ],
    config,
    {
      temperature: 0,
      maxTokens: 6000,
      signal,
      timeoutMs: 120_000,
    },
  ).then((text) => {
    const normalized = text.trim();
    if (normalized.length < 8) throw new Error("模型没有返回可用的智能文本");
    return normalized;
  });
}
