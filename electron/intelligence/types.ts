import type {
  IntelligenceRequest,
  IntelligenceResult,
  IntelligenceTask,
  ProviderId,
  ProviderStatus,
} from "../../shared/desktop-contract/intelligence.js";

export type {
  AgentProvider,
  HttpProvider,
  IntelligenceConnection,
  IntelligencePayloadMap,
  IntelligenceRequest,
  IntelligenceResult,
  IntelligenceTask,
  ModelGrade,
  ProviderAvailability,
  ProviderCapabilities,
  ProviderId,
  ProviderStatus,
  QuizItemOutput,
} from "../../shared/desktop-contract/intelligence.js";

export interface RuntimeConfig {
  provider: ProviderId;
  endpoint: string;
  model: string;
  apiKey: string;
  claudeToken: string;
}

export type JsonSchema = Record<string, unknown>;

export interface BuiltTask {
  prompt: string;
  schema: JsonSchema;
  imageDataUrl?: string;
  imagePath?: string;
}

export interface RendererConfig {
  provider?: unknown;
  endpoint?: unknown;
  model?: unknown;
}

export interface SettingsStoreContract {
  getRuntimeConfig(config?: RendererConfig): Promise<RuntimeConfig>;
  hasProviderCredential(provider: ProviderId): Promise<boolean>;
  setClaudeToken(token: string): Promise<void>;
  clearClaudeCredentials(): Promise<void>;
}

export interface AgentSource {
  initialize(): Promise<void>;
  statuses(): Promise<ProviderStatus[]>;
  login(provider: ProviderId): Promise<ProviderStatus | undefined>;
  logout(provider: ProviderId): Promise<ProviderStatus | undefined>;
  invoke(
    request: IntelligenceRequest,
    controller: AbortController,
  ): Promise<IntelligenceResult>;
  cleanup(): Promise<void>;
}

export type SafeLog = (
  event: string,
  fields?: {
    provider?: ProviderId;
    task?: IntelligenceTask;
    durationMs?: number;
    errorCode?: string;
  },
) => Promise<void>;
