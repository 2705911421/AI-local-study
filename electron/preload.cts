const { contextBridge, ipcRenderer } = require("electron");

const invoke = <T,>(channel: string, payload?: unknown): Promise<T> =>
  ipcRenderer.invoke(channel, payload) as Promise<T>;

contextBridge.exposeInMainWorld("zhiyeDesktop", {
  isDesktop: true,
  getSettings: () => invoke("intelligence:get-settings"),
  saveSettings: (settings: unknown) =>
    invoke("intelligence:save-settings", settings),
  clearApiKey: (provider: string) =>
    invoke("intelligence:clear-api-key", provider),
  getStatuses: (config: unknown) => invoke("intelligence:get-statuses", config),
  login: (provider: string) => invoke("intelligence:login", provider),
  logout: (provider: string) => invoke("intelligence:logout", provider),
  listModels: (config: unknown) => invoke("intelligence:list-models", config),
  invoke: (request: unknown) => invoke("intelligence:invoke", request),
  cancel: (requestId: string) => invoke("intelligence:cancel", requestId),
  getUpdateStatus: () => invoke("updates:get-status"),
  checkForUpdates: () => invoke("updates:check"),
  installUpdate: () => invoke("updates:install"),
  getAutoBackupSettings: () => invoke("backup:get-settings"),
  chooseAutoBackupDirectory: (passphrase: string) =>
    invoke("backup:choose-directory", { passphrase }),
  disableAutoBackup: () => invoke("backup:disable"),
  writeAutoBackup: (payload: ArrayBuffer) => invoke("backup:write", payload),
});
