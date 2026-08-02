import { describe, expect, it, vi } from "vitest";
import { IntelligenceRuntime } from "./runtime.js";

function request(id) {
  return {
    id,
    provider: "codex",
    task: "answer",
    payload: {
      question: "什么是命题？",
      citations: [{ locator: "第 1 页", excerpt: "命题是判断句。" }],
    },
  };
}

describe("IntelligenceRuntime", () => {
  it("keeps same-provider requests concurrent and cancels only the requested id", async () => {
    const controllers = new Map();
    const completions = new Map();
    const agentSource = {
      initialize: vi.fn(),
      statuses: vi.fn(() => []),
      cleanup: vi.fn(),
      invoke: vi.fn((value, controller) => {
        controllers.set(value.id, controller);
        return new Promise((resolve, reject) => {
          completions.set(value.id, resolve);
          controller.signal.addEventListener("abort", () =>
            reject(controller.signal.reason),
          );
        });
      }),
    };
    const runtime = new IntelligenceRuntime({
      agentSource,
      settingsStore: {},
      log: vi.fn(),
    });

    const first = runtime.invoke(request("request-first"));
    const second = runtime.invoke(request("request-second"));

    expect(controllers.get("request-first").signal.aborted).toBe(false);
    expect(controllers.get("request-second").signal.aborted).toBe(false);
    runtime.cancel("request-first");
    completions.get("request-second")({
      requestId: "request-second",
      text: "ok",
    });

    await expect(first).rejects.toThrow("请求已取消");
    await expect(second).resolves.toEqual({
      requestId: "request-second",
      text: "ok",
    });
  });

  it("rejects oversized or unbounded input before calling a provider", async () => {
    const agentSource = { invoke: vi.fn() };
    const runtime = new IntelligenceRuntime({
      agentSource,
      settingsStore: {},
      log: vi.fn(),
    });
    const invalid = request("request-invalid");
    invalid.payload.citations = Array.from({ length: 11 }, () => ({
      locator: "x",
      excerpt: "y",
    }));

    await expect(runtime.invoke(invalid)).rejects.toThrow("最多使用 10 条");
    expect(agentSource.invoke).not.toHaveBeenCalled();
  });
});
