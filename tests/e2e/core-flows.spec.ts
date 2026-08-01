import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function expectNoSeriousAccessibilityIssues(page: Page) {
  await expect(page.locator('[aria-label="正在载入知页"]')).toHaveCount(0);
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every((animation) => animation.playState !== "running"),
  );
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations
      .filter(
        (violation) =>
          violation.impact === "serious" || violation.impact === "critical",
      )
      .map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          summary: node.failureSummary,
        })),
      })),
  ).toEqual([]);
}

async function visibleControlSizes(page: Page) {
  return page
    .locator("button, input, textarea, select, a")
    .evaluateAll((elements) =>
      elements
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            name:
              element.getAttribute("aria-label") ||
              element.getAttribute("title") ||
              element.textContent?.trim() ||
              element.getAttribute("placeholder") ||
              element.tagName,
            width: rect.width,
            height: rect.height,
            visible:
              rect.width > 0 &&
              rect.height > 0 &&
              rect.right > 0 &&
              rect.left < innerWidth &&
              rect.bottom > 0 &&
              rect.top < innerHeight &&
              style.display !== "none" &&
              style.visibility !== "hidden",
          };
        })
        .filter((item) => item.visible),
    );
}

async function mockOllama(page: Page) {
  await page.route("http://localhost:11434/**", async (route) => {
    const url = route.request().url();
    if (url.endsWith("/api/tags")) {
      await route.fulfill({ json: { models: [{ name: "qwen3:4b" }] } });
      return;
    }
    if (url.endsWith("/api/show")) {
      await route.fulfill({ json: { capabilities: ["text"] } });
      return;
    }
    const body = route.request().postDataJSON() as {
      messages?: Array<{ content?: string }>;
    };
    const prompt = JSON.stringify(body.messages || []);
    const content = prompt.includes("练习评分器")
      ? JSON.stringify({
          score: 0.8,
          feedback: "已覆盖核心要点",
          coveredKeyPoints: ["可判断真假"],
          missingKeyPoints: [],
        })
      : "命题是能够判断真假的陈述句。";
    await route.fulfill({ json: { message: { content } } });
  });
}

test("桌面端章节搜索、高亮与弹窗均可操作", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await page.goto("/app");

  await page.getByTitle("在当前章节中查找").click();
  await page.getByPlaceholder("查找当前章节").fill("命题");
  await expect(page.getByText(/\d+ \/ \d+/)).toBeVisible();

  await page.getByTitle("高亮教材段落").click();
  await page.locator(".text-block").first().click();
  await expect(page.locator(".text-block").first()).toHaveClass(
    /is-persistently-highlighted/,
  );

  await page.getByRole("button", { name: /导入教材/ }).click();
  await expect(
    page.getByRole("dialog", { name: "导入一本教材" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "关闭导入教材窗口" }).click();
});

test("AI 问答会展示受教材约束的模型回答", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await mockOllama(page);
  await page.goto("/app");
  await page.getByRole("button", { name: "设置" }).click();
  await page.getByRole("button", { name: "测试连接" }).click();
  await expect(page.getByText(/连接正常，当前为文本模型/)).toBeVisible();
  await page.getByRole("button", { name: "关闭设置窗口" }).click();

  await page
    .getByPlaceholder("输入问题，仅依据当前教材回答…")
    .fill("什么是命题？");
  await page.getByRole("button", { name: "发送提问" }).click();

  await expect(page.getByText("命题是能够判断真假的陈述句。")).toBeVisible();
  await expect(page.getByText("教材依据").last()).toBeVisible();
});

test("笔记可以创建后重新编辑", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await page.goto("/app");

  await page
    .getByLabel("伴学与笔记")
    .getByRole("button", { name: "笔记" })
    .click();
  const editor = page.getByPlaceholder("记录此刻的理解、疑问或待复习内容…");
  await editor.fill("命题可以判断真假");
  await page.getByRole("button", { name: "保存笔记" }).click();
  await expect(page.getByText("命题可以判断真假")).toBeVisible();

  await page.getByRole("button", { name: "编辑笔记" }).click();
  await editor.fill("命题是能够判断真假的陈述句");
  await page.getByRole("button", { name: "更新笔记" }).click();
  await expect(page.getByText("命题是能够判断真假的陈述句")).toBeVisible();
  await expect(page.getByText("命题可以判断真假", { exact: true })).toHaveCount(
    0,
  );
});

test("章节练习支持作答、评分并完成流程", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await mockOllama(page);
  await page.goto("/app");

  await page.getByRole("button", { name: "开始章节练习" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder("用自己的话作答…").fill("回答教材中的核心概念");
  await dialog.getByRole("button", { name: "提交答案" }).click();
  await expect(dialog.getByText(/教材参考：/)).toBeVisible();
  await dialog.getByRole("button", { name: "已掌握" }).click();

  for (let index = 0; index < 6; index += 1) {
    const finish = dialog.getByRole("button", { name: "完成练习" });
    if (await finish.count()) {
      await finish.click();
      break;
    }
    await dialog.getByRole("button", { name: "下一题" }).click();
    await dialog
      .getByPlaceholder("用自己的话作答…")
      .fill("继续回答教材中的核心概念");
    await dialog.getByRole("button", { name: "提交答案" }).click();
    await expect(dialog.getByText(/教材参考：/)).toBeVisible();
    await dialog.getByRole("button", { name: "已掌握" }).click();
  }
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("章节练习已完成，结果已保存")).toBeVisible();
});

test("加密备份要求强密码并警告旧版明文文件", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await page.goto("/app");
  await page.getByRole("button", { name: "设置" }).click();

  const password = page.getByLabel("备份密码", { exact: true });
  await expect(password).toHaveAttribute("minlength", "12");
  await password.fill("short");
  await page.getByLabel("确认备份密码").fill("short");
  await page.getByRole("button", { name: "导出加密备份" }).click();
  await expect(page.getByRole("alert")).toContainText("至少需要 12 个字符");
  await expect(password).toHaveValue("");
  await expect(page.getByLabel("确认备份密码")).toHaveValue("");

  await page
    .locator('input[type="file"][accept*=".zhiye-backup"]')
    .setInputFiles({
      name: "legacy.zip",
      mimeType: "application/zip",
      buffer: Buffer.from("PK\u0003\u0004legacy"),
    });
  await expect(page.getByText(/旧版备份未加密且包含教材正文/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "恢复所选备份" }),
  ).toBeDisabled();
});

test("手机端可直接切换阅读、伴学和笔记", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium");
  await page.goto("/app");

  for (const width of [320, 390, 700]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByRole("button", { name: "阅读", exact: true }).click();
    const heading = page.getByRole("heading", {
      name: "第一章 命题与逻辑",
      exact: true,
    });
    const box = await heading.boundingBox();
    expect(box, `${width}px 下阅读标题应有布局边界`).not.toBeNull();
    expect(box!.x, `${width}px 下阅读标题不应移出左侧`).toBeGreaterThanOrEqual(
      0,
    );
    expect(box!.x, `${width}px 下阅读标题应位于视口内`).toBeLessThan(width);
    await expect(page.locator(".reader-panel")).toHaveJSProperty(
      "scrollWidth",
      await page
        .locator(".reader-panel")
        .evaluate((element) => element.clientWidth),
    );
    await page
      .getByRole("button", { name: "伴学", exact: true })
      .last()
      .click();
    await expect(page.locator(".study-panel")).toHaveClass(/mobile-active/);
    await expect(
      page.getByPlaceholder("输入问题，仅依据当前教材回答…"),
    ).toBeVisible();

    await page
      .getByRole("button", { name: "笔记", exact: true })
      .last()
      .click();
    await expect(
      page.getByPlaceholder("记录此刻的理解、疑问或待复习内容…"),
    ).toBeVisible();

    await page.getByRole("button", { name: "阅读", exact: true }).click();
    await expect(page.locator(".reader-panel")).toHaveClass(/mobile-active/);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "设置" })).toBeVisible();
  await page.getByRole("button", { name: "设置" }).click();
  await expect(page.getByRole("dialog", { name: "设置" })).toBeVisible();
  await expect(page.getByLabel("字号")).toBeVisible();
  await page.getByRole("button", { name: "关闭设置窗口" }).click();
});

test("真实浏览器主题与设置状态满足无障碍要求", async ({ page }) => {
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await page.goto("/app");
    await expectNoSeriousAccessibilityIssues(page);

    await page.getByRole("button", { name: "设置" }).click();
    await expectNoSeriousAccessibilityIssues(page);
    await page.getByRole("button", { name: "关闭设置窗口" }).click();
  }

  await page.getByRole("button", { name: "设置" }).click();
  await page.getByLabel("主题").selectOption("dark");
  await page.getByRole("button", { name: "关闭设置窗口" }).click();
  await expectNoSeriousAccessibilityIssues(page);
});

test("可见文字与交互控件达到舒适尺寸", async ({ page }, testInfo) => {
  await page.goto("/app");

  const minimumControlHeight =
    testInfo.project.name === "mobile-chromium" ? 44 : 36;
  const undersizedControls = (await visibleControlSizes(page))
    .filter((control) => control.height < minimumControlHeight)
    .map(({ name, width, height }) => ({
      name,
      width: Math.round(width),
      height: Math.round(height),
    }));
  expect(undersizedControls).toEqual([]);

  const undersizedText = await page.locator("body *").evaluateAll((elements) =>
    elements
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          text: element.childElementCount
            ? ""
            : element.textContent?.trim() || "",
          fontSize: Number.parseFloat(style.fontSize),
          visible:
            rect.width > 0 &&
            rect.height > 0 &&
            rect.right > 0 &&
            rect.left < innerWidth &&
            rect.bottom > 0 &&
            rect.top < innerHeight &&
            style.display !== "none" &&
            style.visibility !== "hidden",
        };
      })
      .filter((item) => item.visible && item.text && item.fontSize < 12)
      .map(({ text, fontSize }) => ({ text, fontSize })),
  );
  expect(undersizedText).toEqual([]);
});
