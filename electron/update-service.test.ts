import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { normalizeUpdateUrl, UpdateService } from "./update-service.js";

describe("UpdateService", () => {
  it("只接受 HTTPS 更新源", () => {
    expect(normalizeUpdateUrl("https://updates.example.com/")).toBe(
      "https://updates.example.com",
    );
    expect(normalizeUpdateUrl("http://updates.example.com")).toBe("");
  });

  it("下载完成后只在用户确认时重启安装", async () => {
    const updater = Object.assign(new EventEmitter(), {
      setFeedURL: vi.fn(),
      checkForUpdatesAndNotify: vi.fn(async () => undefined),
      quitAndInstall: vi.fn(),
    });
    const service = new UpdateService({
      updater,
      feedUrl: "https://updates.example.com",
      packaged: true,
    });

    updater.emit("update-downloaded", { version: "0.2.0" });
    expect(service.status()).toMatchObject({
      status: "ready",
      availableVersion: "0.2.0",
    });
    expect(service.install()).toBe(true);
    expect(updater.quitAndInstall).toHaveBeenCalledWith(false, true);
  });

  it("正式包可读取构建时写入的 app-update.yml", () => {
    const updater = Object.assign(new EventEmitter(), {
      setFeedURL: vi.fn(),
      checkForUpdatesAndNotify: vi.fn(async () => undefined),
      quitAndInstall: vi.fn(),
    });
    const service = new UpdateService({ updater, packaged: true });
    expect(service.enabled).toBe(true);
    expect(updater.setFeedURL).not.toHaveBeenCalled();
  });
});
