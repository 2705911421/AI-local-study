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

export interface IntelligenceConnection {
  provider: ProviderId;
  endpoint: string;
  model: string;
}

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

export type IntelligenceRequest<T extends IntelligenceTask = IntelligenceTask> =
  {
    [Task in T]: {
      id: string;
      provider: ProviderId;
      task: Task;
      payload: IntelligencePayloadMap[Task];
      config?: IntelligenceConnection;
    };
  }[T];

export interface ProviderCapabilities {
  text: boolean;
  vision: boolean;
  modelList: boolean;
}

export type ProviderAvailability =
  "ready" | "not-authenticated" | "unavailable" | "error";

export interface ProviderStatus {
  provider: ProviderId;
  availability: ProviderAvailability;
  authenticated: boolean;
  capabilities: ProviderCapabilities;
  label: string;
  detail?: string;
}

export interface ModelGrade {
  score: number;
  feedback: string;
  coveredKeyPoints: string[];
  missingKeyPoints: string[];
}

export interface QuizItemOutput {
  id: string;
  kind?: "recall" | "distinguish" | "choice" | "application";
  prompt: string;
  answer: string;
  rationale?: string;
  options?: string[];
  locator: string;
  evidenceBlockId?: string;
  evidenceBlockIds?: string[];
  keyPoints?: string[];
}

export interface IntelligenceResult {
  requestId: string;
  text?: string;
  blocks?: Array<{ id: string; text: string }>;
  grade?: ModelGrade;
  quiz?: QuizItemOutput[];
}

export interface DesktopSavedSettings extends IntelligenceConnection {
  hasApiKeyByProvider: Partial<Record<ProviderId, boolean>>;
  credentialsReset: boolean;
  firstRunComplete: boolean;
}

export interface DesktopSettingsInput extends IntelligenceConnection {
  firstRunComplete: boolean;
  apiKey?: string;
  clearApiKey?: boolean;
}

export interface DesktopUpdateStatus {
  status:
    | "disabled"
    | "idle"
    | "checking"
    | "current"
    | "downloading"
    | "ready"
    | "error";
  currentVersion: string;
  availableVersion: string;
  progress: number;
  message: string;
}

export interface DesktopDiagnosticsContext {
  appVersion: string;
  channel: "beta" | "stable";
  platform: string;
  arch: string;
  locale: string;
  provider: ProviderId;
  model: string;
  configured: boolean;
  hasApiKeyByProvider: Partial<Record<ProviderId, boolean>>;
}

export interface DesktopAutoBackupSettings {
  enabled: boolean;
  directory: string;
  retention: number;
  lastBackupAt: number;
}

export interface DesktopIntelligenceBridge {
  isDesktop: true;
  getSettings(): Promise<DesktopSavedSettings>;
  saveSettings(settings: DesktopSettingsInput): Promise<DesktopSavedSettings>;
  clearApiKey(
    provider: Extract<ProviderId, "claude" | "openai-compatible">,
  ): Promise<DesktopSavedSettings>;
  getStatuses(config?: IntelligenceConnection): Promise<ProviderStatus[]>;
  login(provider: AgentProvider): Promise<ProviderStatus>;
  logout(provider: AgentProvider): Promise<ProviderStatus>;
  listModels(config: IntelligenceConnection): Promise<string[]>;
  invoke<T extends IntelligenceTask>(
    request: IntelligenceRequest<T>,
  ): Promise<IntelligenceResult>;
  cancel(requestId: string): Promise<void>;
  getUpdateStatus(): Promise<DesktopUpdateStatus>;
  checkForUpdates(): Promise<DesktopUpdateStatus>;
  installUpdate(): Promise<boolean>;
  getDiagnosticsContext(): Promise<DesktopDiagnosticsContext>;
  getAutoBackupSettings(): Promise<DesktopAutoBackupSettings>;
  chooseAutoBackupDirectory(
    passphrase: string,
  ): Promise<DesktopAutoBackupSettings>;
  disableAutoBackup(): Promise<DesktopAutoBackupSettings>;
  writeAutoBackup(payload: ArrayBuffer): Promise<boolean>;
}
