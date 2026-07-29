import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  safeStorage,
  shell,
} from "electron";
import { createAgentSource } from "./intelligence/agent-source.mjs";
import { IntelligenceRuntime } from "./intelligence/runtime.mjs";
import { createSafeLogger } from "./safe-log.mjs";
import { SettingsStore } from "./settings-store.mjs";
import updaterPackage from "electron-updater";
import { UpdateService } from "./update-service.mjs";
import { BackupService } from "./backup-service.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
let runtime;
let updateService;
let backupService;

app.setName("知页");
if (process.env.ZHIYE_TEST_USER_DATA) {
  app.setPath("userData", process.env.ZHIYE_TEST_USER_DATA);
}

app.whenReady().then(async () => {
  const userData = app.getPath("userData");
  const settingsStore = new SettingsStore({ userData, safeStorage });
  const agentSource = createAgentSource({
    userData,
    settingsStore,
    openExternal: (url) => shell.openExternal(url),
    runtimeAssets: app.isPackaged
      ? path.join(process.resourcesPath, "runtimes")
      : null,
    appVersion: app.getVersion(),
  });
  runtime = new IntelligenceRuntime({
    agentSource,
    settingsStore,
    log: createSafeLogger(userData),
  });
  updateService = new UpdateService({
    updater: updaterPackage.autoUpdater,
    feedUrl: process.env.ZHIYE_UPDATE_URL,
    packaged: app.isPackaged,
  });
  backupService = new BackupService({ userData, safeStorage });
  await runtime.initialize();
  registerHandlers(runtime, settingsStore, updateService, backupService);
  createWindow();
  if (updateService.enabled) {
    setTimeout(() => void updateService.check(), 5_000);
  }
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  void runtime?.cleanup();
});

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 700,
    show: false,
    backgroundColor: "#edf0eb",
    webPreferences: {
      preload: path.join(here, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  window.once("ready-to-show", () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    const allowed =
      process.env.VITE_DEV_SERVER_URL &&
      url.startsWith(process.env.VITE_DEV_SERVER_URL);
    if (!allowed && !url.startsWith("file:")) event.preventDefault();
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void window.loadFile(path.join(here, "..", "dist", "index.html"));
  }
}

function registerHandlers(intelligence, settingsStore, updates, backups) {
  const handle = (channel, handler) => {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, (_event, payload) => handler(payload));
  };
  handle("intelligence:get-settings", () => settingsStore.publicSettings());
  handle("intelligence:save-settings", (settings) =>
    settingsStore.save(settings || {}),
  );
  handle("intelligence:clear-api-key", (provider) =>
    settingsStore.clearApiKey(provider),
  );
  handle("intelligence:get-statuses", (config) =>
    intelligence.statuses(config || {}),
  );
  handle("intelligence:login", (provider) => intelligence.login(provider));
  handle("intelligence:logout", (provider) => intelligence.logout(provider));
  handle("intelligence:list-models", (config) =>
    intelligence.listModels(config || {}),
  );
  handle("intelligence:invoke", (request) => intelligence.invoke(request));
  handle("intelligence:cancel", (requestId) => intelligence.cancel(requestId));
  handle("updates:get-status", () => updates.status());
  handle("updates:check", () => updates.check());
  handle("updates:install", () => updates.install());
  handle("backup:get-settings", () => backups.settings());
  handle("backup:choose-directory", async (payload) => {
    const selection = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "选择知页自动备份目录",
    });
    if (selection.canceled || !selection.filePaths[0]) return backups.settings();
    return backups.configure({
      directory: selection.filePaths[0],
      passphrase: payload?.passphrase,
      enabled: true,
    });
  });
  handle("backup:disable", async () => {
    const current = await backups.settings();
    return backups.configure({ ...current, enabled: false, passphrase: "" });
  });
  handle("backup:write", (payload) =>
    backups.writePortableBackup(new Uint8Array(payload)),
  );
}
