import { afterEach, describe, expect, it, vi } from "vitest";
import {
  detectModelCapabilities,
  explainPageImage,
  listModels,
  type LlmConfig,
} from "./ollama";

const config: LlmConfig = {
  provider: "ollama",
  endpoint: "http://localhost:11434",
  model: "test",
  apiKey: "",
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("model request lifecycle", () => {
  it("propagates caller cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        return Promise.reject(
          init?.signal?.reason || new DOMException("aborted", "AbortError"),
        );
      }),
    );

    await expect(listModels(config, controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it("times out a stalled model-list request", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(init.signal?.reason),
            { once: true },
          );
        });
      }),
    );

    const request = listModels(config);
    const assertion = expect(request).rejects.toThrow("8 秒内未响应");
    await vi.advanceTimersByTimeAsync(8_000);
    await assertion;
  });
});

describe("model capabilities and diagram input", () => {
  it("detects vision from upstream model metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              capabilities: ["completion", "vision"],
            }),
            { status: 200 },
          ),
        ),
      ),
    );

    await expect(detectModelCapabilities(config)).resolves.toEqual({
      vision: true,
      source: "metadata",
    });
  });

  it("sends the rendered page as an image to an OpenAI-compatible model", async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "图示说明" } }],
          }),
          { status: 200 },
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const externalConfig: LlmConfig = {
      provider: "openai-compatible",
      endpoint: "https://example.test/v1",
      model: "vision-test",
      apiKey: "session-only",
    };

    await expect(
      explainPageImage("data:image/jpeg;base64,YWJj", 184, externalConfig),
    ).resolves.toBe("图示说明");
    const request = JSON.parse(
      String((fetchMock.mock.calls[0]?.[1] as RequestInit).body),
    ) as {
      messages: Array<{
        content: Array<{ type: string; image_url?: { url: string } }>;
      }>;
    };
    expect(request.messages[0].content).toContainEqual({
      type: "image_url",
      image_url: { url: "data:image/jpeg;base64,YWJj" },
    });
  });
});
