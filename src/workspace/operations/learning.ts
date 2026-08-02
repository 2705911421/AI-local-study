import { useCallback } from "react";
import type { QuizItem } from "../../types";
import type { WorkspaceRuntime } from "../WorkspaceRuntime";
import { gradeAnswer, scheduleReview } from "../../lib/learningEngine";
import {
  generateQuizWithModel,
  gradeAnswerWithModel,
} from "../../lib/intelligence/client";
import { usePersistence } from "./persistence";

type QuizRuntime = Pick<
  WorkspaceRuntime,
  | "activeChapter"
  | "activeDocument"
  | "config"
  | "modelOnline"
  | "quizAnswer"
  | "quizAttemptId"
  | "quizIndex"
  | "quizMastery"
  | "quizScores"
  | "repository"
  | "reviewSchedules"
  | "setNotice"
  | "setOverlay"
  | "setQuizAnswer"
  | "setQuizAttemptId"
  | "setQuizAttempts"
  | "setQuizIndex"
  | "setQuizItemsOverride"
  | "setQuizMastery"
  | "setQuizScore"
  | "setQuizScores"
  | "setReviewSchedules"
>;

export function useQuiz(quiz: QuizItem[], ctx: QuizRuntime) {
  const { activeDocument, activeChapter, setOverlay, modelOnline, config } =
    ctx;
  const { persistCommand, reportPersistenceFailure } = usePersistence(ctx);

  const openQuiz = useCallback(async () => {
    try {
      const workspace = await ctx.repository.loadWorkspace();
      const attempt = [...workspace.quizAttempts]
        .filter(
          (item) =>
            item.documentId === activeDocument.id &&
            item.chapterId === activeChapter.id &&
            !item.completedAt,
        )
        .sort((a, b) => b.updatedAt - a.updatedAt)[0];
      if (attempt) {
        ctx.setQuizItemsOverride(attempt.items);
        ctx.setQuizAttemptId(attempt.id);
        ctx.setQuizIndex(attempt.currentIndex);
        ctx.setQuizAnswer(attempt.draft);
        ctx.setQuizScores(attempt.scores);
        ctx.setQuizMastery(attempt.mastery);
        ctx.setQuizScore(attempt.scores[attempt.currentIndex] ?? null);
      } else {
        let nextQuiz = quiz;
        if (modelOnline) {
          try {
            const generated = await generateQuizWithModel(
              activeChapter.title,
              activeChapter.blocks,
              Math.min(5, activeChapter.blocks.length),
              config,
            );
            if (generated.length) nextQuiz = generated;
          } catch {
            ctx.setNotice("智能出题暂不可用，已使用本地练习");
          }
        }
        ctx.setQuizItemsOverride(nextQuiz);
        ctx.setQuizAttemptId(crypto.randomUUID());
        ctx.setQuizIndex(0);
        ctx.setQuizAnswer("");
        ctx.setQuizScore(null);
        ctx.setQuizScores(nextQuiz.map(() => null));
        ctx.setQuizMastery(nextQuiz.map(() => null));
      }
      setOverlay("quiz");
    } catch {
      reportPersistenceFailure("练习记录暂时无法读取，请稍后重试");
    }
  }, [
    ctx,
    activeDocument.id,
    activeChapter.id,
    activeChapter.title,
    activeChapter.blocks,
    quiz,
    modelOnline,
    config,
    setOverlay,
    reportPersistenceFailure,
  ]);

  const gradeQuiz = useCallback(async () => {
    const item = quiz[ctx.quizIndex];
    if (!item) return;
    const result = gradeAnswer(
      ctx.quizAnswer,
      item.keyPoints?.length ? item.keyPoints : [item.answer],
    );
    let score = result.score;
    if (modelOnline) {
      try {
        const modelGrade = await gradeAnswerWithModel(
          ctx.quizAnswer,
          item.answer,
          item.keyPoints || [],
          config,
        );
        score = Math.min(1, Math.max(0, modelGrade.score));
      } catch {
        ctx.setNotice("模型评分不可用，已使用本地保守评分");
      }
    }
    ctx.setQuizScore(score);
    ctx.setQuizScores((current) =>
      current.map((previousScore, index) =>
        index === ctx.quizIndex ? score : previousScore,
      ),
    );
  }, [ctx, quiz, modelOnline, config]);

  const nextQuiz = useCallback(async () => {
    if (ctx.quizIndex < quiz.length - 1) {
      ctx.setQuizIndex((value) => value + 1);
      ctx.setQuizAnswer("");
      ctx.setQuizScore(null);
    } else {
      if (ctx.quizAttemptId) {
        const workspace = await persistCommand(
          {
            type: "saveQuizAttempt",
            quizAttempt: {
              id: ctx.quizAttemptId,
              documentId: activeDocument.id,
              chapterId: activeChapter.id,
              items: quiz,
              currentIndex: ctx.quizIndex,
              draft: ctx.quizAnswer,
              scores: ctx.quizScores,
              mastery: ctx.quizMastery,
              startedAt: Date.now(),
              updatedAt: Date.now(),
              completedAt: Date.now(),
            },
          },
          "练习结果保存失败，请保留当前窗口后重试",
        );
        if (!workspace) return;
        ctx.setQuizAttempts(workspace.quizAttempts);
        ctx.setReviewSchedules(workspace.reviewSchedules);
      }
      setOverlay(null);
      ctx.setNotice("章节练习已完成，结果已保存");
    }
  }, [
    ctx,
    quiz,
    activeDocument.id,
    activeChapter.id,
    persistCommand,
    setOverlay,
  ]);

  const setCurrentMastery = useCallback(
    async (value: "mastered" | "review") => {
      if (value === "review" && quiz[ctx.quizIndex]?.evidenceBlockId) {
        const evidenceBlockId = quiz[ctx.quizIndex].evidenceBlockId!;
        const id = `${activeDocument.id}:${evidenceBlockId}`;
        const scheduling = scheduleReview(
          ctx.reviewSchedules.find((item) => item.id === id),
          "good",
        );
        const workspace = await persistCommand(
          {
            type: "saveReviewSchedule",
            reviewSchedule: {
              id,
              documentId: activeDocument.id,
              chapterId: activeChapter.id,
              evidenceBlockId,
              ...scheduling,
            },
          },
          "复习计划保存失败，本题状态未改变",
        );
        if (!workspace) return;
        ctx.setReviewSchedules(workspace.reviewSchedules);
      }
      ctx.setQuizMastery((current) =>
        current.map((item, index) => (index === ctx.quizIndex ? value : item)),
      );
    },
    [ctx, quiz, activeDocument.id, activeChapter.id, persistCommand],
  );

  return { openQuiz, gradeQuiz, nextQuiz, setCurrentMastery };
}
