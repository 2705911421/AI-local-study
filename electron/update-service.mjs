export class UpdateService {
  constructor({ updater, feedUrl, packaged }) {
    this.updater = updater;
    this.feedUrl = normalizeUpdateUrl(feedUrl);
    this.enabled = Boolean(packaged && this.feedUrl);
    this.state = {
      status: this.enabled ? "idle" : "disabled",
      currentVersion: "",
      availableVersion: "",
      progress: 0,
      message: this.enabled ? "" : "正式更新源尚未配置",
    };
    if (!this.enabled) return;
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    updater.setFeedURL({ provider: "generic", url: this.feedUrl });
    updater.on("checking-for-update", () => this.patch({ status: "checking" }));
    updater.on("update-not-available", (info) =>
      this.patch({
        status: "current",
        currentVersion: info?.version || "",
        message: "当前已是最新版本",
      }),
    );
    updater.on("update-available", (info) =>
      this.patch({
        status: "downloading",
        availableVersion: info?.version || "",
        message: "发现新版本，正在安全下载",
      }),
    );
    updater.on("download-progress", (progress) =>
      this.patch({
        status: "downloading",
        progress: Math.round(progress?.percent || 0),
      }),
    );
    updater.on("update-downloaded", (info) =>
      this.patch({
        status: "ready",
        availableVersion: info?.version || this.state.availableVersion,
        progress: 100,
        message: "新版本已下载，可重启安装",
      }),
    );
    updater.on("error", (error) =>
      this.patch({
        status: "error",
        message: error instanceof Error ? error.message : "更新检查失败",
      }),
    );
  }

  patch(next) {
    this.state = { ...this.state, ...next };
  }

  status() {
    return { ...this.state };
  }

  async check() {
    if (!this.enabled) return this.status();
    this.patch({ status: "checking", message: "正在检查更新" });
    try {
      await this.updater.checkForUpdatesAndNotify();
    } catch (error) {
      this.patch({
        status: "error",
        message: error instanceof Error ? error.message : "更新检查失败",
      });
    }
    return this.status();
  }

  install() {
    if (!this.enabled || this.state.status !== "ready") return false;
    this.updater.quitAndInstall(false, true);
    return true;
  }
}

export function normalizeUpdateUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return "";
    return url.href.replace(/\/+$/, "");
  } catch {
    return "";
  }
}
