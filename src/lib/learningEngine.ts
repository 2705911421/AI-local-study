import type { Chapter, Citation, QuizItem, TextBlock } from "../types";

const STOP_WORDS = new Set([
  "什么",
  "怎么",
  "如何",
  "为什么",
  "请问",
  "教材",
  "内容",
  "这个",
  "一种",
]);

function normalize(value: string): string {
  return value
    .toLocaleLowerCase("zh-CN")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function terms(value: string): string[] {
  const normalized = normalize(value);
  const segmented: string[] = [];
  if ("Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("zh-CN", { granularity: "word" });
    for (const item of segmenter.segment(value)) {
      const token = normalize(item.segment);
      if (item.isWordLike && token.length > 1 && !STOP_WORDS.has(token)) {
        segmented.push(token);
      }
    }
  }
  for (let index = 0; index < normalized.length - 1; index += 1) {
    const gram = normalized.slice(index, index + 2);
    if (!STOP_WORDS.has(gram)) segmented.push(gram);
  }
  return [...new Set(segmented)];
}

function scoreBlock(query: string, block: TextBlock, chapterTitle: string): number {
  const queryTerms = terms(query);
  if (!queryTerms.length) return 0;
  const text = normalize(`${chapterTitle}${block.smartText || block.text}`);
  const matches = queryTerms.filter((term) => text.includes(term));
  if (!matches.length) return 0;

  let score = matches.reduce((total, term) => total + Math.min(1, term.length / 3), 0);
  score /= queryTerms.length;
  if (/什么是|定义|含义|指什么/.test(query) && /是|指|定义|称为/.test(block.text)) {
    score += 0.34;
  }
  if (normalize(block.text).includes(normalize(query).replace(/什么是|是什么|吗/g, ""))) {
    score += 0.22;
  }
  return Math.min(1, score);
}

export function retrieve(
  query: string,
  activeChapter: Chapter,
  chapters: Chapter[],
  limit = 2,
): Citation[] {
  const candidates = chapters
    .flatMap((chapter) =>
      chapter.blocks.map((block) => ({
        chapter,
        block,
        score:
          scoreBlock(query, block, chapter.title) *
          (chapter.id === activeChapter.id ? 1.18 : 1),
      })),
    )
    .filter((candidate) => candidate.score >= 0.18)
    .sort((a, b) => b.score - a.score);

  const strongest = candidates[0]?.score || 0;
  const selected: typeof candidates = [];
  for (const candidate of candidates) {
    if (candidate.score < Math.max(0.24, strongest * 0.68)) continue;
    const previous = selected[selected.length - 1];
    if (
      previous &&
      previous.chapter.id === candidate.chapter.id &&
      Math.abs(
        previous.chapter.blocks.indexOf(previous.block) -
          candidate.chapter.blocks.indexOf(candidate.block),
      ) <= 1
    ) {
      continue;
    }
    selected.push(candidate);
    if (selected.length >= limit) break;
  }

  return selected.map(({ block, score }) => ({
    blockId: block.id,
    locator: block.locator,
    excerpt:
      (block.smartText || block.text).length > 240
        ? `${(block.smartText || block.text).slice(0, 240)}…`
        : block.smartText || block.text,
    score: Math.min(1, score),
  }));
}

function extractKeyPoints(text: string): string[] {
  const phrases = text
    .split(/[，。；：、！？]/)
    .map((item) => normalize(item))
    .filter((item) => item.length >= 2)
    .flatMap((item) => {
      if (item.length <= 8) return [item];
      return terms(item).filter((term) => term.length >= 2).slice(0, 3);
    });
  return [...new Set(phrases)].slice(0, 4);
}

export function createQuiz(chapter: Chapter, count = 5): QuizItem[] {
  const usable = chapter.blocks.filter(
    (block) => normalize(block.smartText || block.text).length >= 12,
  );
  if (!usable.length) return [];
  const targetCount = Math.min(count, usable.length);
  const chosen = Array.from({ length: targetCount }, (_, index) => {
    const sourceIndex =
      targetCount === 1
        ? 0
        : Math.round((index * (usable.length - 1)) / (targetCount - 1));
    return usable[sourceIndex];
  });
  return chosen.map((block, index) => {
    const answer = (block.smartText || block.text).split(/[。！？]/)[0];
    return {
      id: `quiz-${chapter.id}-${block.id}`,
      prompt:
        index === 0
          ? `请用自己的话说明“${chapter.title}”中的核心概念。`
          : `教材在这里给出了什么关键结论？`,
      answer,
      locator: block.locator,
      evidenceBlockId: block.id,
      keyPoints: extractKeyPoints(answer),
    };
  });
}

export interface GradeResult {
  score: number;
  coveredKeyPoints: string[];
  missingKeyPoints: string[];
}

export function gradeAnswer(answer: string, keyPoints: string[]): GradeResult {
  const normalized = normalize(answer);
  const coveredKeyPoints = keyPoints.filter((point) => {
    const pointTerms = terms(point);
    return normalized.includes(normalize(point)) || pointTerms.some((term) => normalized.includes(term));
  });
  const ratio = keyPoints.length ? coveredKeyPoints.length / keyPoints.length : 0;
  const lengthFactor = Math.min(1, normalized.length / 18);
  const score = Math.min(1, ratio * 0.85 + lengthFactor * 0.15);
  return {
    score,
    coveredKeyPoints,
    missingKeyPoints: keyPoints.filter((point) => !coveredKeyPoints.includes(point)),
  };
}
