import { buildTask, parseStructured } from "./prompts.mjs";

const trimEndpoint = (value) => value.trim().replace(/\/+$/, "");

function openAiChatUrl(endpoint) {
  const base = trimEndpoint(endpoint);
  return /\/chat\/completions$/i.test(base)
    ? base
    : `${base}/chat/completions`;
}

function openAiModelsUrl(endpoint) {
  return `${trimEndpoint(endpoint).replace(/\/chat\/completions$/i, "")}/models`;
}

function headers(config) {
  return {
    "Content-Type": "application/json",
    ...(config.provider === "openai-compatible" && config.apiKey
      ? { Authorization: `Bearer ${config.apiKey.trim()}` }
      : {}),
  };
}

async function checkedJson(response, label) {
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `${label}（${response.status}）${detail ? `：${detail.slice(0, 160)}` : ""}`,
    );
  }
  return response.json();
}

export async function listHttpModels(config, signal) {
  const url =
    config.provider === "ollama"
      ? `${trimEndpoint(config.endpoint)}/api/tags`
      : openAiModelsUrl(config.endpoint);
  const data = await checkedJson(
    await fetch(url, { headers: headers(config), signal }),
    "无法获取模型列表",
  );
  const models =
    config.provider === "ollama"
      ? (data.models || []).map((item) => item.name || item.model || "")
      : (data.data || []).map((item) => item.id || "");
  return [...new Set(models.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export async function getHttpStatus(config, signal) {
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
        { role: "system", content: "连接测试，只返回 JSON：{\"text\":\"OK\"}" },
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

export async function invokeHttp(request, config, signal) {
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
                    task.imageDataUrl.replace(
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

async function runHttpText(messages, schema, config, signal, timeoutMs) {
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
    if (!data.message?.content) throw new Error("Ollama 没有返回内容");
    return data.message.content;
  }
  const data = await checkedJson(
    await fetch(openAiChatUrl(config.endpoint), {
      method: "POST",
      headers: headers(config),
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        response_format: { type: "json_schema", json_schema: { name: "result", schema } },
        messages,
      }),
      signal: combined,
    }),
    "外部模型请求失败",
  );
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("外部模型没有返回内容");
  return content;
}

function nameSuggestsVision(model) {
  return /(^|[-_:./])(vision|vl|4o|4\.1|gemini|pixtral|llava|minicpm-v|internvl|glm-4v)([-_:./]|$)/i.test(
    model,
  );
}

