import { describe, expect, it } from "vitest";
import {
  buildDiagnosticsText,
  redactDiagnosticsText,
} from "./AppErrorBoundary";

describe("Beta diagnostics", () => {
  it("removes URLs and credential-shaped values", () => {
    const output = redactDiagnosticsText(
      "request failed at https://api.example.com/v1 with api_key=sk-secret-value",
    );

    expect(output).not.toContain("api.example.com");
    expect(output).not.toContain("sk-secret-value");
    expect(output).toContain("[redacted-secret]");
  });

  it("contains only safe runtime context and no endpoint", () => {
    const output = buildDiagnosticsText("provider error", {
      appVersion: "0.1.0-beta.1",
      channel: "beta",
      platform: "win32",
      arch: "x64",
      locale: "zh-CN",
      provider: "openai-compatible",
      model: "gpt-test",
      configured: true,
      hasApiKeyByProvider: { "openai-compatible": true },
    });

    expect(output).toContain("0.1.0-beta.1");
    expect(output).toContain("openai-compatible");
    expect(output).toContain("已保存凭据：openai-compatible");
    expect(output).not.toContain("http");
  });
});
