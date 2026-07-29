import type {
  Chapter,
  Citation,
  QuizItem,
  ReviewRating,
  ReviewSchedule,
  StudyDocument,
  TextBlock,
} from "../types";

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

interface RetrievalCandidate {
  documentId?: string;
  chapter: Chapter;
  block: TextBlock;
  text: string;
  titleText: string;
}

function bm25Scores(query: string, candidates: RetrievalCandidate[]): number[] {
  const queryTerms = terms(query);
  if (!queryTerms.length || !candidates.length) return candidates.map(() => 0);
  const averageLength =
    candidates.reduce((total, candidate) => total + terms(candidate.text).length, 0) /
    candidates.length;
  const k1 = 1.35;
  const b = 0.72;

  return candidates.map((candidate) => {
    const bodyTerms = terms(candidate.text);
    const titleTerms = terms(candidate.titleText);
    let score = 0;
    for (const term of queryTerms) {
      const documentFrequency = candidates.filter(
        (item) =>
          normalize(item.text).includes(term) ||
          normalize(item.titleText).includes(term),
      ).length;
      const inverseFrequency = Math.log(
        1 + (candidates.length - documentFrequency + 0.5) / (documentFrequency + 0.5),
      );
      const bodyFrequency = bodyTerms.filter((item) => item === term).length;
      const titleFrequency = titleTerms.filter((item) => item === term).length;
      const weightedFrequency = bodyFrequency + titleFrequency * 2.4;
      if (!weightedFrequency) continue;
      const lengthNormalization =
        weightedFrequency +
        k1 * (1 - b + b * (bodyTerms.length / Math.max(1, averageLength)));
      score +=
        inverseFrequency *
        ((weightedFrequency * (k1 + 1)) / lengthNormalization);
    }
    if (/什么是|定义|含义|指什么/.test(query) && /是|指|定义|称为/.test(candidate.text)) {
      score += 0.45;
    }
    return score;
  });
}

export function retrieve(
  query: string,
  activeChapter: Chapter,
  chapters: Chapter[],
  limit = 2,
): Citation[] {
  return retrieveCandidates(
    query,
    chapters.flatMap((chapter) =>
      chapter.blocks.map((block) => ({
        chapter,
        block,
        text: block.smartText || block.text,
        titleText: chapter.title,
      })),
    ),
    limit,
    activeChapter.id,
  );
}

function retrieveCandidates(
  query: string,
  rawCandidates: RetrievalCandidate[],
  limit: number,
  activeChapterId?: string,
): Citation[] {
  const rawScores = bm25Scores(query, rawCandidates);
  const maxScore = Math.max(...rawScores, 0);
  const candidates = rawCandidates
    .map((candidate, index) => ({
      ...candidate,
      score:
        (maxScore ? rawScores[index] / maxScore : 0) *
        (candidate.chapter.id === activeChapterId ? 1.08 : 1),
    }))
    .filter((candidate) => candidate.score >= 0.08)
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
    documentId: selected.find((item) => item.block.id === block.id)?.documentId,
    chapterId: block.chapterId,
    locator: block.locator,
    excerpt:
      (block.smartText || block.text).length > 240
        ? `${(block.smartText || block.text).slice(0, 240)}…`
        : block.smartText || block.text,
    score: Math.min(1, score),
  }));
}

export function retrieveDocuments(
  query: string,
  documents: StudyDocument[],
  activeChapterId?: string,
  limit = 3,
): Citation[] {
  return retrieveCandidates(
    query,
    documents.flatMap((document) =>
      document.chapters.flatMap((chapter) =>
        chapter.blocks.map((block) => ({
          documentId: document.id,
          chapter,
          block,
          text: block.smartText || block.text,
          titleText: `${document.displayTitle || document.title} ${chapter.title}`,
        })),
      ),
    ),
    limit,
    activeChapterId,
  );
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
    const kinds = [
      "recall",
      "distinguish",
      "application",
      "choice",
    ] as const;
    const kind = kinds[index % kinds.length];
    const prompt =
      kind === "recall"
        ? `请用自己的话说明“${chapter.title}”中的核心概念。`
        : kind === "distinguish"
          ? `这段内容与相近概念相比，关键区别是什么？`
          : kind === "application"
            ? `如果把这段结论用于一个新情境，应如何解释？`
            : `下面哪项最符合教材在此处表达的关键结论？`;
    return {
      id: `quiz-${chapter.id}-${block.id}`,
      kind,
      prompt,
      answer,
      rationale: `答案来自${block.locator}，应覆盖教材中的核心限定条件。`,
      locator: block.locator,
      evidenceBlockId: block.id,
      evidenceBlockIds: [block.id],
      keyPoints: extractKeyPoints(answer),
    };
  });
}

export interface ReviewState {
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
  lastRating: ReviewRating;
  lastReviewedAt: number;
  dueAt: number;
  updatedAt: number;
}

export function scheduleReview(
  previous: Partial<ReviewSchedule> | undefined,
  rating: ReviewRating,
  now = Date.now(),
): ReviewState {
  const priorEase = Math.max(1.3, previous?.easeFactor ?? 2.5);
  const priorInterval = Math.max(0, previous?.intervalDays ?? 0);
  const priorRepetitions = Math.max(0, previous?.repetitions ?? 0);
  const priorLapses = Math.max(0, previous?.lapses ?? 0);

  let easeFactor = priorEase;
  let intervalDays = priorInterval;
  let repetitions = priorRepetitions;
  let lapses = priorLapses;
  let dueAt: number;

  if (rating === "again") {
    intervalDays = 0;
    repetitions = 0;
    lapses += 1;
    easeFactor = Math.max(1.3, priorEase - 0.2);
    dueAt = now + 10 * 60 * 1000;
  } else {
    repetitions += 1;
    if (rating === "hard") {
      intervalDays = Math.max(1, Math.round(Math.max(1, priorInterval) * 1.2));
      easeFactor = Math.max(1.3, priorEase - 0.15);
    } else if (rating === "easy") {
      intervalDays =
        priorRepetitions === 0
          ? 4
          : Math.max(4, Math.round(Math.max(1, priorInterval) * priorEase * 1.3));
      easeFactor = priorEase + 0.15;
    } else {
      intervalDays =
        priorRepetitions === 0
          ? 1
          : priorRepetitions === 1
            ? 3
            : Math.max(3, Math.round(Math.max(1, priorInterval) * priorEase));
    }
    dueAt = now + intervalDays * 24 * 60 * 60 * 1000;
  }

  return {
    intervalDays,
    easeFactor,
    repetitions,
    lapses,
    lastRating: rating,
    lastReviewedAt: now,
    dueAt,
    updatedAt: now,
  };
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
