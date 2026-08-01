import { buildTask, parseStructured } from "./prompts.js";
import type {
  HttpProvider,
  IntelligenceRequest,
  IntelligenceResult,
  JsonSchema,
  ProviderStatus,
  RuntimeConfig,
} from "./types.js";

export interface HttpConfig extends RuntimeConfig {
  provider: HttpProvider;
}

const trimEndpoint = (value: string): string =>
  value.trim().replace(/\/+$/, "");

function openAiChatUrl(endpoint: string): string {
  const base = trimEndpoint(endpoint);
  return /\/chat\/completions$/i.test(base) ? base : `${base}/chat/completions`;
}

function openAiModelsUrl(endpoint: string): string {
  return `${trimEndpoint(endpoint).replace(/\/chat\/completions$/i, "")}/models`;
}

function headers(config: HttpConfig): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(config.provider === "openai-compatible" && config.apiKey
      ? { Authorization: `Bearer ${config.apiKey.trim()}` }
      : {}),
  };
}

async function checkedJson(
  response: Response,
  label: string,
): Promise<unknown> {
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `${label}（${response.status}）${detail ? `：${detail.slice(0, 160)}` : ""}`,
    );
  }
  return response.json();
}

export async function listHttpModels(
  config: HttpConfig,
  signal: AbortSignal,
): Promise<string[]> {
  const url =
    config.provider === "ollama"
      ? `${trimEndpoint(config.endpoint)}/api/tags`
      : openAiModelsUrl(config.endpoint);
  const data = await checkedJson(
    await fetch(url, { headers: headers(config), signal }),
    "无法获取模型列表",
  );
  const record = asRecord(data);
  const models = (
    config.provider === "ollama"
      ? asArray(record.models).map((item) => {
          const model = asRecord(item);
          return stringValue(model.name) || stringValue(model.model);
        })
      : asArray(record.data).map((item) => stringValue(asRecord(item).id))
  ).filter(Boolean);
  return [...new Set(models.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export async function getHttpStatus(
  config: HttpConfig,
  signal: AbortSignal,
): Promise<ProviderStatus> {
  const label =
    config.provider === "ollama" ? "本机 Ollama" : "OpenAI 兼容服务";
  try {
    if (!config.endpoint || !config.model) {
      return {
        provider: config.provider,
        availability: "unavailable",
        authenticated: false,
        capabilities: { text: true, vision: false, modelList: true },
        label,
        detail: "请填写服务地址和模型",
      };
    }
    await runHttpText(
      [
        { role: "system", content: '连接测试，只返回 JSON：{"text":"OK"}' },
        { role: "user", content: "OK" },
      ],
      { type: "object", properties: { text: { type: "string" } } },
      config,
      signal,
      12_000,
    );
    return {
      provider: config.provider,
      availability: "ready",
      authenticated: true,
      capabilities: {
        text: true,
        vision: nameSuggestsVision(config.model),
        modelList: true,
      },
      label,
    };
  } catch (error) {
    return {
      provider: config.provider,
      availability: "error",
      authenticated: false,
      capabilities: { text: true, vision: false, modelList: true },
      label,
      detail: error instanceof Error ? error.message : "连接失败",
    };
  }
}

export async function invokeHttp(
  request: IntelligenceRequest,
  config: HttpConfig,
  signal: AbortSignal,
): Promise<IntelligenceResult> {
  const task = buildTask(request);
  const messages =
    request.task === "explain-image" && config.provider !== "ollama"
      ? [
          {
            role: "user",
            content: [
              { type: "text", text: task.prompt },
              {
                type: "image_url",
                image_url: { url: task.imageDataUrl },
              },
            ],
          },
        ]
      : [
          {
            role: "user",
            content: task.prompt,
            ...(request.task === "explain-image"
              ? {
                  images: [
                    (task.imageDataUrl || "").replace(
                      /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
                      "",
                    ),
                  ],
                }
              : {}),
          },
        ];
  const text = await runHttpText(
    messages,
    task.schema,
    config,
    signal,
    request.task === "answer" || request.task === "grade" ? 60_000 : 120_000,
  );
  return parseStructured(text, request.id);
}

async function runHttpText(
  messages: unknown[],
  schema: JsonSchema,
  config: HttpConfig,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<string> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  if (config.provider === "ollama") {
    const data = await checkedJson(
      await fetch(`${trimEndpoint(config.endpoint)}/api/chat`, {
        method: "POST",
        headers: headers(config),
        body: JSON.stringify({
          model: config.model,
          stream: false,
          format: schema,
          options: { temperature: 0 },
          messages,
        }),
        signal: combined,
      }),
      "Ollama 请求失败",
    );
    const message = asRecord(asRecord(data).message);
    if (typeof message.content !== "string") {
      throw new Error("Ollama 没有返回内容");
    }
    return message.content;
  }
  const data = await checkedJson(
    await fetch(openAiChatUrl(config.endpoint), {
      method: "POST",
      headers: headers(config),
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        response_format: {
          type: "json_schema",
          json_schema: { name: "result", schema },
        },
        messages,
      }),
      signal: combined,
    }),
    "外部模型请求失败",
  );
  const firstChoice = asRecord(asArray(asRecord(data).choices)[0]);
  const content = asRecord(firstChoice.message).content;
  if (typeof content !== "string" || !content) {
    throw new Error("外部模型没有返回内容");
  }
  return content;
}

function nameSuggestsVision(model: string): boolean {
  return /(^|[-_:./])(vision|vl|4o|4\.1|gemini|pixtral|llava|minicpm-v|internvl|glm-4v)([-_:./]|$)/i.test(
    model,
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}
