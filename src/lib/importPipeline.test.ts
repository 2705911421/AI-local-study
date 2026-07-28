import { describe, expect, it, vi } from "vitest";
import type { StudyDocument } from "../types";
import { createImportPipeline } from "./importPipeline";

function fakeDocument(file: File): StudyDocument {
  return {
    id: "parsed",
    title: "测试教材",
    filename: file.name,
    kind: "pdf",
    createdAt: 1,
    chapters: [{ id: "parsed:c1", title: "第一章", order: 0, blocks: [] }],
  };
}

describe("ImportPipeline", () => {
  it("报告校验、读取、结构、索引和保存阶段并生成内容指纹", async () => {
    const stages: string[] = [];
    const parser = vi.fn(async (file: File) => fakeDocument(file));
    const pipeline = createImportPipeline(parser);
    const file = new File(["same content"], "book.pdf", {
      type: "application/pdf",
    });

    const result = await pipeline.run(file, {
      onProgress: (progress) => stages.push(progress.stage),
    });

    expect(result.document.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stages).toEqual([
      "validation",
      "reading",
      "structure",
      "index",
      "save",
    ]);
  });

  it("在开始解析前响应取消信号", async () => {
    const parser = vi.fn(async (file: File) => fakeDocument(file));
    const pipeline = createImportPipeline(parser);
    const controller = new AbortController();
    controller.abort();

    await expect(
      pipeline.run(new File(["x"], "book.pdf"), {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(parser).not.toHaveBeenCalled();
  });
});
