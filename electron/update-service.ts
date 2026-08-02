import type { AppUpdater, ProgressInfo, UpdateInfo } from "electron-updater";

export type UpdateStatus =
  | "disabled"
  | "idle"
  | "checking"
  | "current"
  | "downloading"
  | "ready"
  | "error";

export interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  availableVersion: string;
  progress: number;
  message: string;
}

interface UpdateServiceOptions {
  updater: Pick<
    AppUpdater,
    | "autoDownload"
    | "autoInstallOnAppQuit"
    | "setFeedURL"
    | "on"
    | "checkForUpdatesAndNotify"
    | "quitAndInstall"
  >;
  feedUrl?: string;
  packaged: boolean;
}

export class UpdateService {
  private readonly updater: UpdateServiceOptions["updater"];
  private readonly feedUrl: string;
  readonly enabled: boolean;
  private state: UpdateState;

  constructor({ updater, feedUrl, packaged }: UpdateServiceOptions) {
    this.updater = updater;
    this.feedUrl = normalizeUpdateUrl(feedUrl);
    // Packaged builds can use electron-builder's embedded app-update.yml.
    // An explicit URL remains useful for QA and private release channels.
    this.enabled = packaged;
    this.state = {
      status: this.enabled ? "idle" : "disabled",
      currentVersion: "",
      availableVersion: "",
      progress: 0,
      message: this.enabled ? "" : "开发模式不检查应用更新",
    };
    if (!this.enabled) return;
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = false;
    if (this.feedUrl) {
      updater.setFeedURL({ provider: "generic", url: this.feedUrl });
    }
    updater.on("checking-for-update", () => this.patch({ status: "checking" }));
    updater.on("update-not-available", (info: UpdateInfo) =>
      this.patch({
        status: "current",
        currentVersion: info?.version || "",
        message: "当前已是最新版本",
      }),
    );
    updater.on("update-available", (info: UpdateInfo) =>
      this.patch({
        status: "downloading",
        availableVersion: info?.version || "",
        message: "发现新版本，正在安全下载",
      }),
    );
    updater.on("download-progress", (progress: ProgressInfo) =>
      this.patch({
        status: "downloading",
        progress: Math.round(progress?.percent || 0),
      }),
    );
    updater.on("update-downloaded", (info: UpdateInfo) =>
      this.patch({
        status: "ready",
        availableVersion: info?.version || this.state.availableVersion,
        progress: 100,
        message: "新版本已下载，可重启安装",
      }),
    );
    updater.on("error", (error: Error) =>
      this.patch({
        status: "error",
        message: error instanceof Error ? error.message : "更新检查失败",
      }),
    );
  }

  private patch(next: Partial<UpdateState>): void {
    this.state = { ...this.state, ...next };
  }

  status(): UpdateState {
    return { ...this.state };
  }

  async check(): Promise<UpdateState> {
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

  install(): boolean {
    if (!this.enabled || this.state.status !== "ready") return false;
    this.updater.quitAndInstall(false, true);
    return true;
  }
}

export function normalizeUpdateUrl(value?: string): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return "";
    return url.href.replace(/\/+$/, "");
  } catch {
    return "";
  }
}
