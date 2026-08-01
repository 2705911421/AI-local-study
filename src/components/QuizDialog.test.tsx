// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppContextType } from "../AppContext";
import { QuizDialog } from "./QuizDialog";

let context: AppContextType;

vi.mock("../AppContext", () => ({
  useAppContext: () => context,
}));

beforeEach(() => {
  context = {
    overlay: "quiz",
    setOverlay: vi.fn(),
    quiz: [
      {
        id: "quiz-1",
        prompt: "什么是命题？",
        answer: "可以判断真假的陈述句。",
        locator: "第一章",
      },
    ],
    quizIndex: 0,
    quizAnswer: "",
    setQuizAnswer: vi.fn(),
    quizScore: null,
    quizMastery: [null],
  } as unknown as AppContextType;
});

afterEach(cleanup);

describe("QuizDialog", () => {
  it("答案为空时阻止提交，并把输入同步给练习状态", () => {
    const onGrade = vi.fn();
    render(
      <QuizDialog onGrade={onGrade} onNext={vi.fn()} onSetMastery={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "提交答案" })).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText("用自己的话作答…"), {
      target: { value: "能够判断真假的句子" },
    });
    expect(context.setQuizAnswer).toHaveBeenCalledWith("能够判断真假的句子");
    expect(onGrade).not.toHaveBeenCalled();
  });

  it("评分后显示教材依据并允许记录掌握程度", () => {
    const onNext = vi.fn();
    const onSetMastery = vi.fn();
    context.quizAnswer = "回答";
    context.quizScore = 0.8;
    context.quizMastery = ["mastered"];

    render(
      <QuizDialog
        onGrade={vi.fn()}
        onNext={onNext}
        onSetMastery={onSetMastery}
      />,
    );

    expect(screen.getByText(/教材参考：可以判断真假的陈述句/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "需复习" }));
    fireEvent.click(screen.getByRole("button", { name: "完成练习" }));
    expect(onSetMastery).toHaveBeenCalledWith("review");
    expect(onNext).toHaveBeenCalledOnce();
  });
});
