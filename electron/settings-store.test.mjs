import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SettingsStore } from "./settings-store.mjs";

const directories = [];
const safeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (value) => Buffer.from(`encrypted:${value}`, "utf8"),
  decryptString: (value) =>
    value.toString("utf8").replace(/^encrypted:/, ""),
};

async function createStore() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "zhiye-test-"));
  directories.push(directory);
  return {
    directory,
    store: new SettingsStore({ userData: directory, safeStorage }),
  };
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("SettingsStore", () => {
  it("encrypts and endpoint-binds an OpenAI-compatible API key", async () => {
    const { directory, store } = await createStore();
    const publicValue = await store.save({
      provider: "openai-compatible",
      endpoint: "https://EXAMPLE.test/v1/",
      model: "test",
      apiKey: "top-secret-key",
      firstRunComplete: true,
    });

    expect(publicValue.hasApiKeyByProvider["openai-compatible"]).toBe(true);
    expect(JSON.stringify(publicValue)).not.toContain("top-secret-key");
    const disk = await readFile(
      path.join(directory, "intelligence-secrets.json"),
      "utf8",
    );
    expect(disk).not.toContain("top-secret-key");
    await expect(
      store.getRuntimeConfig({
        provider: "openai-compatible",
        endpoint: "https://example.test/v1",
      }),
    ).resolves.toMatchObject({ apiKey: "top-secret-key" });
    await expect(
      store.getRuntimeConfig({
        provider: "openai-compatible",
        endpoint: "https://other.test/v1",
      }),
    ).resolves.toMatchObject({ apiKey: "" });
  });

  it("isolates Claude and compatible-service credentials", async () => {
    const { store } = await createStore();
    await store.save({
      provider: "openai-compatible",
      endpoint: "https://example.test/v1",
      model: "test",
      apiKey: "openai-key",
      firstRunComplete: true,
    });
    await store.save({
      provider: "claude",
      endpoint: "",
      model: "",
      apiKey: "claude-key",
      firstRunComplete: true,
    });

    await expect(
      store.getRuntimeConfig({ provider: "claude" }),
    ).resolves.toMatchObject({ apiKey: "claude-key" });
    await expect(
      store.getRuntimeConfig({
        provider: "openai-compatible",
        endpoint: "https://example.test/v1",
      }),
    ).resolves.toMatchObject({ apiKey: "openai-key", claudeToken: "" });

    await store.clearClaudeCredentials();
    await expect(store.hasProviderCredential("claude")).resolves.toBe(false);
  });

  it("clears an incompatible endpoint key instead of reusing it", async () => {
    const { store } = await createStore();
    await store.save({
      provider: "openai-compatible",
      endpoint: "https://first.test/v1",
      model: "test",
      apiKey: "first-key",
      firstRunComplete: true,
    });
    const changed = await store.save({
      provider: "openai-compatible",
      endpoint: "https://second.test/v1",
      model: "test",
      firstRunComplete: true,
    });
    expect(changed.hasApiKeyByProvider["openai-compatible"]).toBe(false);
    await expect(
      store.getRuntimeConfig({
        provider: "openai-compatible",
        endpoint: "https://second.test/v1",
      }),
    ).resolves.toMatchObject({ apiKey: "" });
  });

  it("deletes an unscoped legacy key and reports the migration once", async () => {
    const { directory, store } = await createStore();
    await writeFile(
      path.join(directory, "intelligence-secrets.json"),
      JSON.stringify({ apiKey: "legacy-encrypted-key" }),
      "utf8",
    );

    const first = await store.publicSettings();
    const second = await store.publicSettings();
    expect(first.credentialsReset).toBe(true);
    expect(second.credentialsReset).toBe(false);
    await expect(store.getRuntimeConfig()).resolves.toMatchObject({ apiKey: "" });
  });
});
