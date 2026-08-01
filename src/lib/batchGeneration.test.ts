import { describe, expect, it, vi } from "vitest";
import {
  createBlockBatches,
  estimateGeneration,
  runBatchQueue,
} from "./batchGeneration";

const block = (id: string, text: string) => ({
  id,
  chapterId: "c",
  locator: id,
  text,
});

describe("batch generation", () => {
  it("plans token cost and keeps character-bounded batches", () => {
    const blocks = [
      block("a", "x".repeat(3_000)),
      block("b", "y".repeat(3_000)),
    ];
    expect(createBlockBatches(blocks)).toHaveLength(2);
    const estimate = estimateGeneration(blocks, 10, 20);
    expect(estimate.estimatedInputTokens).toBeGreaterThan(3_000);
    expect(estimate.estimatedCost).toBeGreaterThan(0);
  });

  it("retries a transient failure", async () => {
    let attempts = 0;
    const task = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("rate limited");
      return "ok";
    });
    await expect(
      runBatchQueue([task], {
        concurrency: 1,
        requestsPerMinute: 600,
        retries: 1,
      }),
    ).resolves.toEqual(["ok"]);
    expect(task).toHaveBeenCalledTimes(2);
  });
});
