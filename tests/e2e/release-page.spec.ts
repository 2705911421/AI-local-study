import { expect, test } from "@playwright/test";

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
    await expect(page.getByRole("link", { name: "打开在线体验" })).toBeVisible();
    await expect(page.getByRole("link", { name: "查看 Windows 版" })).toBeVisible();
  }
});

test("发布页导航和工作台路由均可访问", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "把教材留在电脑里，把问题问到原文里。",
    }),
  ).toBeVisible();

  await page.getByRole("link", { name: "怎么学习" }).click();
  await expect(page).toHaveURL(/#workflow$/);

  for (const route of ["/app", "/app/"]) {
    await page.goto(route);
    await expect(page.getByRole("button", { name: "设置" })).toBeVisible();
    await expect(page).toHaveTitle("知页 · 本地教材伴学");
  }
});
