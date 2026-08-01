import { _electron as electron, expect, test } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("桌面首次选择、来源字段与设置持久化均无需终端", async () => {
  const userData = await mkdtemp(path.join(os.tmpdir(), "zhiye-desktop-e2e-"));
  const env = {
    ...process.env,
    ZHIYE_TEST_USER_DATA: userData,
  };
  const first = await electron.launch({
    args: ["--no-sandbox", "."],
    env,
  });
  try {
    const page = await first.firstWindow();
    const splash = page.locator(".startup-splash");
    await expect(splash).toBeVisible();
    await expect(splash).toHaveCount(0, { timeout: 5_000 });
    await expect(page.locator(".brand-mark img")).toBeVisible();
    await expect(page.getByRole("dialog", { name: "设置" })).toBeVisible({
      timeout: 20_000,
    });

    const provider = page.getByLabel("LLM 服务类型");
    await provider.selectOption("codex");
    await expect(
      page.getByRole("button", { name: "通过浏览器连接" }),
    ).toBeVisible();
    await expect(page.getByLabel("LLM 模型名称")).toHaveCount(0);

    await provider.selectOption("ollama");
    await expect(page.getByLabel("LLM 服务地址")).toBeVisible();
    await expect(page.getByLabel("LLM 模型名称")).toBeVisible();
    await page.getByRole("button", { name: "保存设置" }).click();
    await page.getByRole("button", { name: "关闭设置窗口" }).click();
  } finally {
    await first.close();
  }

  const second = await electron.launch({
    args: ["--no-sandbox", "."],
    env,
  });
  try {
    const page = await second.firstWindow();
    await expect(page.getByRole("dialog", { name: "设置" })).toHaveCount(0);
    await expect(page.getByText("知页").first()).toBeVisible();
  } finally {
    await second.close();
    await rm(userData, { recursive: true, force: true });
  }
});
