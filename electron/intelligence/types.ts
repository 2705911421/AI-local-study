export type ProviderId = "codex" | "claude" | "ollama" | "openai-compatible";

export type AgentProvider = Extract<ProviderId, "codex" | "claude">;
export type HttpProvider = Extract<ProviderId, "ollama" | "openai-compatible">;

export type IntelligenceTask =
  | "answer"
  | "enhance-blocks"
  | "enhance-selection"
  | "grade"
  | "generate-quiz"
  | "explain-image";

export interface TextBlockInput {
  id: string;
  text: string;
  page?: number;
}

export interface CitationInput {
  locator: string;
  excerpt: string;
}

export interface IntelligencePayloadMap {
  answer: { question: string; citations: CitationInput[] };
  "enhance-blocks": { blocks: TextBlockInput[] };
  "enhance-selection": { blocks: TextBlockInput[] };
  grade: { answer: string; reference: string; keyPoints: string[] };
  "generate-quiz": {
    chapterTitle: string;
    blocks: TextBlockInput[];
    count: number;
  };
  "explain-image": { dataUrl: string; page: number };
}

export type IntelligenceRequest = {
  [Task in IntelligenceTask]: {
    id: string;
    provider: ProviderId;
    task: Task;
    payload: IntelligencePayloadMap[Task];
    config?: Omit<RuntimeConfig, "apiKey" | "claudeToken">;
  };
}[IntelligenceTask];

export interface RuntimeConfig {
  provider: ProviderId;
  endpoint: string;
  model: string;
  apiKey: string;
  claudeToken: string;
}

export interface ProviderStatus {
  provider: ProviderId;
  availability: "ready" | "not-authenticated" | "unavailable" | "error";
  authenticated: boolean;
  capabilities: {
    text: boolean;
    vision: boolean;
    modelList: boolean;
  };
  label: string;
  detail?: string;
}

export type JsonSchema = Record<string, unknown>;

export interface BuiltTask {
  prompt: string;
  schema: JsonSchema;
  imageDataUrl?: string;
  imagePath?: string;
}

export interface IntelligenceResult {
  requestId: string;
  text?: string;
  blocks?: Array<{ id: string; text: string }>;
  grade?: {
    score: number;
    feedback: string;
    coveredKeyPoints: string[];
    missingKeyPoints: string[];
  };
  quiz?: Array<Record<string, unknown>>;
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
