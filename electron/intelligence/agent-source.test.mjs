import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import {
  assertNoForbiddenCodexItems,
  claudeOptions,
  codexThreadOptions,
  extractProviderRuntime,
  getClaudeCredential,
} from "./agent-source.mjs";

describe("agent isolation policy", () => {
  it("runs Codex in an empty read-only workspace without network or approvals", () => {
    expect(codexThreadOptions("C:\\isolated")).toEqual({
      sandboxMode: "read-only",
      workingDirectory: "C:\\isolated",
      skipGitRepoCheck: true,
      approvalPolicy: "never",
      networkAccessEnabled: false,
      webSearchMode: "disabled",
    });
  });

  it("disables every Claude tool and session persistence", () => {
    const options = claudeOptions({
      controller: new AbortController(),
      workspace: "C:\\isolated",
      schema: { type: "object" },
      claudePath: "C:\\claude.exe",
      token: "secret-test-token",
    });
    expect(options.tools).toEqual([]);
    expect(options.allowedTools).toEqual([]);
    expect(options.permissionMode).toBe("dontAsk");
    expect(options.maxTurns).toBe(1);
    expect(options.persistSession).toBe(false);
    expect(options.settingSources).toEqual([]);
  });

  it("always resolves Claude credentials from the Claude provider slot", async () => {
    const settingsStore = {
      getRuntimeConfig: async (config) => {
        expect(config).toEqual({ provider: "claude" });
        return {
          provider: "claude",
          apiKey: "claude-api-key",
          claudeToken: "",
        };
      },
    };

    await expect(getClaudeCredential(settingsStore)).resolves.toBe(
      "claude-api-key",
    );
  });

  it("discards a Codex result if a forbidden tool appeared", () => {
    expect(() =>
      assertNoForbiddenCodexItems([
        { type: "command_execution", command: "dir" },
      ]),
    ).toThrow("禁止的工具");
  });

  it("expands a packaged provider runtime only into the versioned cache", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "zhiye-runtime-test-"));
    const archive = path.join(root, "provider.zip");
    const destination = path.join(root, "providers", "0.1.0", "codex");
    const zip = new JSZip();
    zip.file("bin/codex.exe", "runtime");
    await writeFile(archive, await zip.generateAsync({ type: "nodebuffer" }));
    try {
      const executable = await extractProviderRuntime({
        archive,
        destination,
        executable: ["bin", "codex.exe"],
      });
      expect(executable).toBe(path.join(destination, "bin", "codex.exe"));
      expect(await readFile(executable, "utf8")).toBe("runtime");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 15_000);
});
