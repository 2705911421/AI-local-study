const { contextBridge, ipcRenderer } = require("electron");
import type {
  AgentProvider,
  DesktopIntelligenceBridge,
  DesktopSettingsInput,
  IntelligenceConnection,
  IntelligenceRequest,
  IntelligenceTask,
  ProviderId,
} from "../shared/desktop-contract/intelligence.js";

const invoke = <T,>(channel: string, payload?: unknown): Promise<T> =>
  ipcRenderer.invoke(channel, payload) as Promise<T>;

const bridge: DesktopIntelligenceBridge = {
  isDesktop: true,
  getSettings: () => invoke("intelligence:get-settings"),
  saveSettings: (settings: DesktopSettingsInput) =>
    invoke("intelligence:save-settings", settings),
  clearApiKey: (
    provider: Extract<ProviderId, "claude" | "openai-compatible">,
  ) => invoke("intelligence:clear-api-key", provider),
  getStatuses: (config?: IntelligenceConnection) =>
    invoke("intelligence:get-statuses", config),
  login: (provider: AgentProvider) => invoke("intelligence:login", provider),
  logout: (provider: AgentProvider) => invoke("intelligence:logout", provider),
  listModels: (config: IntelligenceConnection) =>
    invoke("intelligence:list-models", config),
  invoke: <T extends IntelligenceTask>(request: IntelligenceRequest<T>) =>
    invoke("intelligence:invoke", request),
  cancel: (requestId: string) => invoke("intelligence:cancel", requestId),
  getUpdateStatus: () => invoke("updates:get-status"),
  checkForUpdates: () => invoke("updates:check"),
  installUpdate: () => invoke("updates:install"),
  getAutoBackupSettings: () => invoke("backup:get-settings"),
  chooseAutoBackupDirectory: (passphrase: string) =>
    invoke("backup:choose-directory", { passphrase }),
  disableAutoBackup: () => invoke("backup:disable"),
  writeAutoBackup: (payload: ArrayBuffer) => invoke("backup:write", payload),
};

contextBridge.exposeInMainWorld("zhiyeDesktop", bridge);
