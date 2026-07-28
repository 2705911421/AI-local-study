import type { Citation, TextBlock } from "../../types";

export type ProviderId =
  | "codex"
  | "claude"
  | "ollama"
  | "openai-compatible";

export type IntelligenceTask =
  | "answer"
  | "enhance-blocks"
  | "enhance-selection"
  | "grade"
  | "explain-image";

export interface IntelligenceConfig {
  provider: ProviderId;
  endpoint: string;
  model: string;
  apiKey: string;
}

export interface ProviderCapabilities {
  text: boolean;
  vision: boolean;
  modelList: boolean;
}

export type ProviderAvailability =
  | "ready"
  | "not-authenticated"
  | "unavailable"
  | "error";

export interface ProviderStatus {
  provider: ProviderId;
  availability: ProviderAvailability;
  authenticated: boolean;
  capabilities: ProviderCapabilities;
  label: string;
  detail?: string;
}

export interface AnswerPayload {
  question: string;
  citations: Citation[];
}

export interface EnhanceBlocksPayload {
  blocks: TextBlock[];
}

export interface EnhanceSelectionPayload {
  blocks: TextBlock[];
}

export interface GradePayload {
  answer: string;
  reference: string;
  keyPoints: string[];
}

export interface ExplainImagePayload {
  dataUrl: string;
  page: number;
}

export interface IntelligencePayloadMap {
  answer: AnswerPayload;
  "enhance-blocks": EnhanceBlocksPayload;
  "enhance-selection": EnhanceSelectionPayload;
  grade: GradePayload;
  "explain-image": ExplainImagePayload;
}

export interface IntelligenceRequest<T extends IntelligenceTask = IntelligenceTask> {
  id: string;
  provider: ProviderId;
  task: T;
  payload: IntelligencePayloadMap[T];
  config?: Omit<IntelligenceConfig, "apiKey">;
}

export interface ModelGrade {
  score: number;
  feedback: string;
  coveredKeyPoints: string[];
  missingKeyPoints: string[];
}

export interface IntelligenceResult {
  requestId: string;
  text?: string;
  blocks?: Array<{ id: string; text: string }>;
  grade?: ModelGrade;
}

export interface DesktopSavedSettings {
  provider: ProviderId;
  endpoint: string;
  model: string;
  hasApiKeyByProvider: Partial<Record<ProviderId, boolean>>;
  credentialsReset: boolean;
  firstRunComplete: boolean;
}

export interface DesktopIntelligenceBridge {
  isDesktop: true;
  getSettings(): Promise<DesktopSavedSettings>;
  saveSettings(
    settings: Omit<
      DesktopSavedSettings,
      "hasApiKeyByProvider" | "credentialsReset"
    > & {
      apiKey?: string;
      clearApiKey?: boolean;
    },
  ): Promise<DesktopSavedSettings>;
  clearApiKey(
    provider: "claude" | "openai-compatible",
  ): Promise<DesktopSavedSettings>;
  getStatuses(config?: Omit<IntelligenceConfig, "apiKey">): Promise<ProviderStatus[]>;
  login(provider: "codex" | "claude"): Promise<ProviderStatus>;
  logout(provider: "codex" | "claude"): Promise<ProviderStatus>;
  listModels(config: Omit<IntelligenceConfig, "apiKey">): Promise<string[]>;
  invoke(request: IntelligenceRequest): Promise<IntelligenceResult>;
  cancel(requestId: string): Promise<void>;
}

declare global {
  interface Window {
    zhiyeDesktop?: DesktopIntelligenceBridge;
  }
}
