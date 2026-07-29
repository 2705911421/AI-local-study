import { describe, expect, it } from "vitest";
import type { Chapter } from "../types";
import {
  createQuiz,
  gradeAnswer,
  retrieve,
  scheduleReview,
} from "./learningEngine";

const chapter: Chapter = {
  id: "doc-a:c1",
  title: "第一章 命题逻辑",
  order: 0,
  blocks: [
    {
      id: "doc-a:c1:b1",
      chapterId: "doc-a:c1",
      text: "命题是能够判断真假的陈述句。命题具有确定的真值。",
      locator: "第 1 页",
      page: 1,
    },
    {
      id: "doc-a:c1:b2",
      chapterId: "doc-a:c1",
      text: "逻辑联结词可以把简单命题组合成复合命题。",
      locator: "第 2 页",
      page: 2,
    },
    {
      id: "doc-a:c1:b3",
      chapterId: "doc-a:c1",
      text: "否定联结词改变原命题的真值。",
      locator: "第 3 页",
      page: 3,
    },
  ],
};

describe("LearningEngine", () => {
  it("只返回与提问强相关且去重后的教材证据", () => {
    const results = retrieve("什么是命题？", chapter, [chapter], 2);

    expect(results).toHaveLength(1);
    expect(results[0].blockId).toBe("doc-a:c1:b1");
    expect(results[0].score).toBeGreaterThan(0.2);
  });

  it("从章节不同位置生成带教材依据的练习", () => {
    const quiz = createQuiz(chapter, 3);

    expect(quiz).toHaveLength(3);
    expect(new Set(quiz.map((item) => item.evidenceBlockId)).size).toBe(3);
    expect(quiz.every((item) => (item.keyPoints?.length || 0) > 0)).toBe(true);
    expect(quiz.map((item) => item.kind)).toEqual([
      "recall",
      "distinguish",
      "application",
    ]);
  });

  it("离线评分保守地区分覆盖完整与依据不足", () => {
    const good = gradeAnswer(
      "命题是可以判断真假的陈述句，并且有确定真值。",
      ["判断真假", "陈述句", "真值"],
    );
    const weak = gradeAnswer("这是一种逻辑知识。", [
      "判断真假",
      "陈述句",
      "真值",
    ]);

    expect(good.score).toBeGreaterThanOrEqual(0.65);
    expect(good.missingKeyPoints).toHaveLength(0);
    expect(weak.score).toBeLessThan(0.35);
  });

  it("四档自评会推进或重置复习间隔", () => {
    const first = scheduleReview(undefined, "good", Date.UTC(2026, 6, 29));
    const easy = scheduleReview(first, "easy", Date.UTC(2026, 6, 30));
    const again = scheduleReview(easy, "again", Date.UTC(2026, 7, 1));

    expect(first.intervalDays).toBe(1);
    expect(easy.intervalDays).toBeGreaterThan(first.intervalDays);
    expect(easy.repetitions).toBe(2);
    expect(again.intervalDays).toBe(0);
    expect(again.repetitions).toBe(0);
    expect(again.lapses).toBe(1);
    expect(again.dueAt).toBe(Date.UTC(2026, 7, 1) + 10 * 60 * 1000);
  });
});
