import type {
  DesktopIntelligenceBridge,
  IntelligenceConnection,
} from "../../../shared/desktop-contract/intelligence";

export type {
  AgentProvider,
  DesktopAutoBackupSettings,
  DesktopDiagnosticsContext,
  DesktopIntelligenceBridge,
  DesktopSavedSettings,
  DesktopSettingsInput,
  DesktopUpdateStatus,
  HttpProvider,
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
} from "../../../shared/desktop-contract/intelligence";

export interface IntelligenceConfig extends IntelligenceConnection {
  apiKey: string;
}

declare global {
  interface Window {
    zhiyeDesktop?: DesktopIntelligenceBridge;
  }
}
