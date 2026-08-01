import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  ProviderId,
  RendererConfig,
  RuntimeConfig,
} from "./intelligence/types.js";

interface SettingsStoreOptions {
  userData: string;
  safeStorage: Electron.SafeStorage;
}

interface StoredSettings {
  provider: ProviderId;
  endpoint: string;
  model: string;
  firstRunComplete: boolean;
}

export interface SaveSettingsInput extends RendererConfig {
  apiKey?: unknown;
  clearApiKey?: unknown;
  firstRunComplete?: unknown;
}

interface EncryptedEndpointSecret {
  endpoint: string;
  value: string;
}

interface StoredSecrets {
  version?: number;
  apiKey?: unknown;
  claudeToken?: string;
  providerKeys?: {
    claude?: string;
    "openai-compatible"?: EncryptedEndpointSecret;
  };
}

export interface PublicSettings extends StoredSettings {
  hasApiKeyByProvider: Partial<Record<ProviderId, boolean>>;
  credentialsReset: boolean;
}

const defaults: StoredSettings = {
  provider: "ollama",
  endpoint: "http://localhost:11434",
  model: "qwen3:4b",
  firstRunComplete: false,
};

export class SettingsStore {
  private readonly safeStorage: Electron.SafeStorage;
  private readonly settingsPath: string;
  private readonly secretsPath: string;
  private legacyCredentialCleared = false;

  constructor({ userData, safeStorage }: SettingsStoreOptions) {
    this.safeStorage = safeStorage;
    this.settingsPath = path.join(userData, "intelligence-settings.json");
    this.secretsPath = path.join(userData, "intelligence-secrets.json");
  }

  async read(): Promise<StoredSettings> {
    return { ...defaults, ...(await readJson(this.settingsPath, {})) };
  }

  async publicSettings(): Promise<PublicSettings> {
    const settings = await this.read();
    const secrets = await this.readSecrets();
    const openAiKey = secrets.providerKeys?.["openai-compatible"];
    const credentialsReset = this.legacyCredentialCleared;
    this.legacyCredentialCleared = false;
    return {
      ...settings,
      hasApiKeyByProvider: {
        claude: Boolean(secrets.providerKeys?.claude),
        "openai-compatible": Boolean(
          openAiKey &&
          openAiKey.endpoint === normalizeEndpoint(settings.endpoint),
        ),
      },
      credentialsReset,
    };
  }

  async save(next: SaveSettingsInput): Promise<PublicSettings> {
    const current = await this.read();
    const secrets = await this.readSecrets();
    const settings = {
      provider: validProvider(next.provider) ? next.provider : current.provider,
      endpoint: String(next.endpoint || ""),
      model: String(next.model || ""),
      firstRunComplete: Boolean(next.firstRunComplete),
    };
    const providerKeys = { ...(secrets.providerKeys || {}) };
    if (settings.provider === "openai-compatible") {
      const endpoint = normalizeEndpoint(settings.endpoint);
      const existing = providerKeys["openai-compatible"];
      if (next.clearApiKey || (existing && existing.endpoint !== endpoint)) {
        delete providerKeys["openai-compatible"];
      }
      if (typeof next.apiKey === "string" && next.apiKey.trim()) {
        providerKeys["openai-compatible"] = {
          endpoint,
          value: this.encrypt(next.apiKey.trim()),
        };
      }
    } else if (settings.provider === "claude") {
      if (next.clearApiKey) delete providerKeys.claude;
      if (typeof next.apiKey === "string" && next.apiKey.trim()) {
        providerKeys.claude = this.encrypt(next.apiKey.trim());
      }
    }
    await Promise.all([
      writeFile(this.settingsPath, JSON.stringify(settings, null, 2), "utf8"),
      this.writeSecrets({ ...secrets, version: 2, providerKeys }),
    ]);
    return this.publicSettings();
  }

  async clearApiKey(provider: ProviderId): Promise<PublicSettings> {
    if (!["claude", "openai-compatible"].includes(provider)) {
      throw new Error("该来源没有可清除的 API Key");
    }
    const secrets = await this.readSecrets();
    const providerKeys = { ...(secrets.providerKeys || {}) };
    if (provider === "claude") delete providerKeys.claude;
    if (provider === "openai-compatible") {
      delete providerKeys["openai-compatible"];
    }
    await this.writeSecrets({ ...secrets, version: 2, providerKeys });
    return this.publicSettings();
  }

  async getRuntimeConfig(
    rendererConfig: RendererConfig = {},
  ): Promise<RuntimeConfig> {
    const settings = await this.read();
    const secrets = await this.readSecrets();
    const provider = validProvider(rendererConfig.provider)
      ? rendererConfig.provider
      : settings.provider;
    const endpoint = String(rendererConfig.endpoint ?? settings.endpoint);
    let apiKey = "";
    if (provider === "claude") {
      apiKey = this.decrypt(secrets.providerKeys?.claude);
    } else if (provider === "openai-compatible") {
      const stored = secrets.providerKeys?.["openai-compatible"];
      if (stored?.endpoint === normalizeEndpoint(endpoint)) {
        apiKey = this.decrypt(stored.value);
      }
    }
    return {
      provider,
      endpoint,
      model: String(rendererConfig.model ?? settings.model),
      apiKey,
      claudeToken:
        provider === "claude" ? this.decrypt(secrets.claudeToken) : "",
    };
  }

  async hasProviderCredential(provider: ProviderId): Promise<boolean> {
    const secrets = await this.readSecrets();
    if (provider === "claude") {
      return Boolean(secrets.claudeToken || secrets.providerKeys?.claude);
    }
    if (provider === "openai-compatible") {
      const settings = await this.read();
      const stored = secrets.providerKeys?.["openai-compatible"];
      return Boolean(
        stored && stored.endpoint === normalizeEndpoint(settings.endpoint),
      );
    }
    return false;
  }

  async setClaudeToken(token: string): Promise<void> {
    const secrets = await this.readSecrets();
    await this.writeSecrets({
      ...secrets,
      version: 2,
      claudeToken: this.encrypt(token),
    });
  }

  async clearClaudeCredentials(): Promise<void> {
    const secrets = await this.readSecrets();
    const providerKeys = { ...(secrets.providerKeys || {}) };
    delete providerKeys.claude;
    delete secrets.claudeToken;
    await this.writeSecrets({ ...secrets, version: 2, providerKeys });
  }

  private async readSecrets(): Promise<StoredSecrets> {
    const raw = await readJson<StoredSecrets>(this.secretsPath, {});
    if ("apiKey" in raw) {
      delete raw.apiKey;
      raw.version = 2;
      raw.providerKeys = raw.providerKeys || {};
      this.legacyCredentialCleared = true;
      await this.writeSecrets(raw);
    }
    return raw;
  }

  private async writeSecrets(secrets: StoredSecrets): Promise<void> {
    const empty =
      !secrets.claudeToken &&
      Object.keys(secrets.providerKeys || {}).length === 0;
    if (empty) {
      await rm(this.secretsPath, { force: true });
      return;
    }
    await writeFile(this.secretsPath, JSON.stringify(secrets), "utf8");
  }

  private encrypt(value: string): string {
    if (!value) return "";
    if (!this.safeStorage.isEncryptionAvailable()) {
      throw new Error("Windows 安全凭据存储当前不可用");
    }
    return this.safeStorage.encryptString(value).toString("base64");
  }

  private decrypt(value?: string): string {
    if (!value) return "";
    try {
      return this.safeStorage.decryptString(Buffer.from(value, "base64"));
    } catch {
      return "";
    }
  }
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function validProvider(value: unknown): value is ProviderId {
  return (
    typeof value === "string" &&
    ["codex", "claude", "ollama", "openai-compatible"].includes(value)
  );
}

export function normalizeEndpoint(value: unknown): string {
  const trimmed = String(value || "")
    .trim()
    .replace(/\/+$/, "");
  try {
    const url = new URL(trimmed);
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    return url.toString().replace(/\/+$/, "");
  } catch {
    return trimmed;
  }
}
