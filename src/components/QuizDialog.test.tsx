// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import App from "../App";
import { createMemoryStudyRepository } from "../lib/studyRepository";

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.scrollTo = vi.fn();
});

afterEach(cleanup);

async function openQuiz() {
  render(<App studyRepository={createMemoryStudyRepository()} />);
  fireEvent.click(screen.getAllByRole("button", { name: "开始章节练习" })[0]);
  return screen.findByPlaceholderText("用自己的话作答…");
}

describe("章节练习流程", () => {
  it("答案为空时阻止提交并在输入后允许提交", async () => {
    const answer = await openQuiz();
    const submit = screen.getByRole("button", { name: "提交答案" });
    expect(submit).toBeDisabled();

    fireEvent.change(answer, { target: { value: "能够判断真假的句子" } });

    expect(answer).toHaveValue("能够判断真假的句子");
    expect(submit).toBeEnabled();
  });

  it("评分后显示教材依据并允许记录需复习", async () => {
    const answer = await openQuiz();
    fireEvent.change(answer, {
      target: { value: "命题是能够判断真假的陈述句" },
    });
    fireEvent.click(screen.getByRole("button", { name: "提交答案" }));

    expect(await screen.findByText(/教材参考：/)).toBeVisible();
    const review = screen.getByRole("button", { name: "需复习" });
    fireEvent.click(review);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "需复习" })).toHaveClass(
        "is-selected",
      ),
    );
  });
});
