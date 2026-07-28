const { contextBridge, ipcRenderer } = require("electron");

const invoke = (channel, payload) => ipcRenderer.invoke(channel, payload);

contextBridge.exposeInMainWorld("zhiyeDesktop", {
  isDesktop: true,
  getSettings: () => invoke("intelligence:get-settings"),
  saveSettings: (settings) => invoke("intelligence:save-settings", settings),
  clearApiKey: (provider) => invoke("intelligence:clear-api-key", provider),
  getStatuses: (config) => invoke("intelligence:get-statuses", config),
  login: (provider) => invoke("intelligence:login", provider),
  logout: (provider) => invoke("intelligence:logout", provider),
  listModels: (config) => invoke("intelligence:list-models", config),
  invoke: (request) => invoke("intelligence:invoke", request),
  cancel: (requestId) => invoke("intelligence:cancel", requestId),
});
