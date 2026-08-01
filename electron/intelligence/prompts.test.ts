import { describe, expect, it } from "vitest";
import { buildTask, parseStructured } from "./prompts.js";

describe("desktop intelligence task contract", () => {
  it("limits block output IDs to the supplied textbook blocks", () => {
    const task = buildTask({
      task: "enhance-blocks",
      payload: {
        blocks: [
          { id: "a", text: "第一段教材原文", locator: "第 1 页" },
          { id: "b", text: "第二段教材原文", locator: "第 2 页" },
        ],
      },
    });

    expect(task.schema.properties.blocks.items.properties.id.enum).toEqual([
      "a",
      "b",
    ]);
    expect(task.prompt).toContain("不得总结");
  });

  it("rejects malformed grading output", () => {
    expect(() =>
      parseStructured('{"score": 2, "feedback": "bad"}', "request-1"),
    ).toThrow("模型评分缺少必要字段");
  });

  it("normalizes structured text output", () => {
    expect(
      parseStructured('```json\n{"text":"  教材回答  "}\n```', "request-2"),
    ).toEqual({ requestId: "request-2", text: "教材回答" });
  });

  it("accepts evidence-bound generated quiz items", () => {
    const result = parseStructured(
      JSON.stringify({
        quiz: [
          {
            id: "q1",
            kind: "recall",
            prompt: "什么是命题？",
            answer: "能够判断真假的陈述句。",
            rationale: "答案来自定义段落。",
            locator: "第 1 页",
            evidenceBlockId: "b1",
            keyPoints: ["判断真假", "陈述句"],
            options: [],
          },
        ],
      }),
      "request-quiz",
    );

    expect(result.quiz).toHaveLength(1);
    expect(result.quiz[0].evidenceBlockId).toBe("b1");
  });
});
