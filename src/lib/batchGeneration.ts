import type { TextBlock } from "../types";

export interface BatchGenerationOptions {
  concurrency?: number;
  requestsPerMinute?: number;
  retries?: number;
}

export function createBlockBatches(
  blocks: TextBlock[],
  maxCharacters = 5_200,
): TextBlock[][] {
  const batches: TextBlock[][] = [];
  let current: TextBlock[] = [];
  let characters = 0;
  for (const block of blocks) {
    if (current.length && characters + block.text.length > maxCharacters) {
      batches.push(current);
      current = [];
      characters = 0;
    }
    current.push(block);
    characters += block.text.length;
  }
  if (current.length) batches.push(current);
  return batches;
}

export function estimateGeneration(
  blocks: TextBlock[],
  inputPricePerMillion = 0,
  outputPricePerMillion = 0,
) {
  const estimatedInputTokens = Math.ceil(
    blocks.reduce((total, block) => total + block.text.length, 0) / 1.8,
  );
  const estimatedOutputTokens = Math.ceil(estimatedInputTokens * 0.8);
  const estimatedCost =
    (estimatedInputTokens / 1_000_000) * Math.max(0, inputPricePerMillion) +
    (estimatedOutputTokens / 1_000_000) * Math.max(0, outputPricePerMillion);
  return { estimatedInputTokens, estimatedOutputTokens, estimatedCost };
}

export async function runBatchQueue<T>(
  tasks: Array<() => Promise<T>>,
  options: BatchGenerationOptions = {},
  onResult?: (result: T, index: number) => void,
): Promise<T[]> {
  const concurrency = Math.max(
    1,
    Math.min(4, Math.floor(options.concurrency || 2)),
  );
  const requestsPerMinute = Math.max(
    1,
    Math.floor(options.requestsPerMinute || 30),
  );
  const minimumInterval = 60_000 / requestsPerMinute;
  const retries = Math.max(0, Math.min(4, Math.floor(options.retries ?? 2)));
  const results = new Array<T>(tasks.length);
  let cursor = 0;
  let nextStartAt = 0;

  const worker = async () => {
    while (cursor < tasks.length) {
      const index = cursor++;
      const delay = Math.max(0, nextStartAt - Date.now());
      nextStartAt = Math.max(Date.now(), nextStartAt) + minimumInterval;
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      let attempt = 0;
      while (true) {
        try {
          const result = await tasks[index]();
          results[index] = result;
          onResult?.(result, index);
          break;
        } catch (error) {
          if (
            attempt >= retries ||
            (error instanceof DOMException && error.name === "AbortError")
          )
            throw error;
          await new Promise((resolve) =>
            setTimeout(resolve, Math.min(4_000, 500 * 2 ** attempt)),
          );
          attempt += 1;
        }
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, worker),
  );
  return results;
}
