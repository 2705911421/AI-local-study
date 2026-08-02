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

  it("applies the request-per-minute limit to retries", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    try {
      const starts: number[] = [];
      const task = vi.fn(async () => {
        starts.push(Date.now());
        if (starts.length === 1) throw new Error("rate limited");
        return "ok";
      });

      const queue = runBatchQueue([task], {
        concurrency: 1,
        requestsPerMinute: 60,
        retries: 1,
      });
      await vi.advanceTimersByTimeAsync(999);
      expect(starts).toEqual([0]);
      await vi.advanceTimersByTimeAsync(1);

      await expect(queue).resolves.toEqual(["ok"]);
      expect(starts).toEqual([0, 1_000]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops claiming queued work after a terminal failure", async () => {
    const terminalError = new Error("generation failed");
    const first = vi.fn(async () => {
      throw terminalError;
    });
    const queued = vi.fn(async () => "should not run");

    await expect(
      runBatchQueue([first, queued], {
        concurrency: 1,
        requestsPerMinute: 60_000,
        retries: 0,
      }),
    ).rejects.toBe(terminalError);
    expect(first).toHaveBeenCalledTimes(1);
    expect(queued).not.toHaveBeenCalled();
  });
});
