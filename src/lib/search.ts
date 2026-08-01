import type { Citation, TextBlock } from "../types";

const STOP_WORDS = new Set([
  "什么",
  "怎么",
  "为什么",
  "请问",
  "一个",
  "以及",
  "可以",
  "是否",
  "如何",
  "教材",
  "这个",
  "进行",
]);

function terms(input: string): string[] {
  const normalized = input
    .toLowerCase()
    .replace(/[，。！？、；：“”‘’（）《》【】,.!?;:'"()[\]{}]/g, " ");
  const latin = normalized.match(/[a-z0-9_→∈∉]+/g) || [];
  const chinese = normalized.split(/\s+/).flatMap((part) => {
    if (!/[\u4e00-\u9fff]/.test(part)) return [];
    const chars = [...part];
    const result = [part];
    for (let i = 0; i < chars.length - 1; i += 1) {
      result.push(chars.slice(i, i + 2).join(""));
    }
    return result;
  });
  return [...new Set([...latin, ...chinese])].filter(
    (term) => term.length > 1 && !STOP_WORDS.has(term),
  );
}

export function searchBlocks(
  query: string,
  blocks: TextBlock[],
  limit = 3,
): Citation[] {
  const queryTerms = terms(query);
  if (!queryTerms.length) return [];

  return blocks
    .map((block) => {
      const haystack = `${block.smartText || ""} ${block.text}`.toLowerCase();
      const matched = queryTerms.filter((term) => haystack.includes(term));
      const coverage = matched.length / queryTerms.length;
      const density = matched.reduce(
        (score, term) => score + Math.min(3, haystack.split(term).length - 1),
        0,
      );
      return {
        blockId: block.id,
        locator: block.locator,
        excerpt:
          block.text.length > 240 ? `${block.text.slice(0, 240)}…` : block.text,
        score: coverage * 0.72 + Math.min(density / 12, 0.28),
      };
    })
    .filter((item) => item.score > 0.08)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function keywordOverlap(answer: string, reference: string): number {
  const answerTerms = new Set(terms(answer));
  const referenceTerms = terms(reference);
  if (!referenceTerms.length) return 0;
  const matched = referenceTerms.filter((term) => answerTerms.has(term));
  return Math.min(1, matched.length / Math.min(8, referenceTerms.length));
}
