import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const releaseViewports = [
  { width: 320, height: 700 },
  { width: 390, height: 844 },
  { width: 768, height: 900 },
  { width: 820, height: 900 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];

test("发布页首屏在支持的视口内完整显示", async ({ page }) => {
  await page.goto("/");

  for (const viewport of releaseViewports) {
    await page.setViewportSize(viewport);
    await page.waitForFunction(() =>
      document
        .getAnimations()
        .every((animation) => animation.playState !== "running"),
    );

    const overflow = await page
      .locator(
        ".landing-nav, .hero, .hero-copy, .hero h1, .hero-lede, .hero-actions, .hero-visual",
      )
      .evaluateAll((elements) =>
        elements
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              selector: element.className || element.tagName,
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              viewportWidth: innerWidth,
            };
          })
          .filter(
            ({ left, right, viewportWidth }) =>
              left < -1 || right > viewportWidth + 1,
          ),
      );

    expect(overflow, `${viewport.width}px 首屏存在水平越界`).toEqual([]);
    await expect(page.getByRole("link", { name: "开始阅读" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "查看 Windows 版" }),
    ).toBeVisible();
  }
});

test("工作台深层入口不会请求缺失的静态资源", async ({ page }) => {
  const failedAssets: string[] = [];
  page.on("response", (response) => {
    const resourceType = response.request().resourceType();
    if (
      response.status() >= 400 &&
      ["font", "image", "script", "stylesheet"].includes(resourceType)
    ) {
      failedAssets.push(`${response.status()} ${response.url()}`);
    }
  });

  for (const route of ["/app", "/app/"]) {
    await page.goto(route);
    await expect(page.locator("header.topbar .icon-button")).toBeVisible();
  }

  expect(failedAssets).toEqual([]);
});

test("发布页图片和脚本资源均可加载", async ({ page }) => {
  const failedAssets: string[] = [];
  page.on("response", (response) => {
    const resourceType = response.request().resourceType();
    if (
      response.status() >= 400 &&
      ["font", "image", "script", "stylesheet"].includes(resourceType)
    ) {
      failedAssets.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto("/");
  await expect(page.locator(".hero-reader-frame img")).toBeVisible();
  await expect(page.locator(".local-first-visual img")).toBeVisible();
  expect(failedAssets).toEqual([]);
  expect(
    await page
      .locator('img[src*="assets/optimized/windows-desk.webp"]')
      .count(),
  ).toBe(0);
});

test("发布页导航和工作台路由均可访问", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "教材留在本地，问题回到原文。",
    }),
  ).toBeVisible();

  await page
    .locator('a[href="#workflow"]')
    .first()
    .evaluate((link) => (link as HTMLAnchorElement).click());
  await expect(page).toHaveURL(/#workflow$/);

  for (const route of ["/app", "/app/"]) {
    await page.goto(route);
    await expect(page.locator("header.topbar .icon-button")).toBeVisible();
    await expect(page).toHaveTitle("知页 · 本地教材伴学");
  }
});

test("发布页响应深色、减少动效与无障碍偏好", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/");

  const preferences = await page.locator(".landing").evaluate((landing) => ({
    paper: getComputedStyle(landing).getPropertyValue("--paper").trim(),
    activeAnimations: document
      .getAnimations()
      .filter((animation) => animation.playState === "running").length,
    transitionDuration: Number.parseFloat(
      getComputedStyle(document.querySelector(".primary-button")!)
        .transitionDuration,
    ),
  }));

  expect(preferences.paper).toBe("#1a1814");
  expect(preferences.activeAnimations).toBe(0);
  expect(preferences.transitionDuration).toBeLessThanOrEqual(0.00001);

  const audit = await new AxeBuilder({ page }).analyze();
  const severeViolations = audit.violations.filter(({ impact }) =>
    ["serious", "critical"].includes(impact ?? ""),
  );
  expect(severeViolations).toEqual([]);
});
