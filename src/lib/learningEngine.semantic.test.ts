import { describe, expect, it } from "vitest";
import type { Chapter } from "../types";
import { retrieve } from "./learningEngine";

describe("hybrid retrieval", () => {
  it("finds a semantic synonym even without an exact keyword match", () => {
    const chapter: Chapter = {
      id: "c1",
      title: "项目管理",
      order: 0,
      blocks: [
        {
          id: "b1",
          chapterId: "c1",
          text: "采购方案会显著降低总体成本。",
          locator: "第一节",
        },
        {
          id: "b2",
          chapterId: "c1",
          text: "团队每周召开一次例会。",
          locator: "第二节",
        },
      ],
    };
    expect(retrieve("怎样减少费用？", chapter, [chapter], 1)[0]?.blockId).toBe(
      "b1",
    );
  });
});
