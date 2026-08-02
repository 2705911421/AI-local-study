import { useCallback } from "react";
import type { StudyDocument, TextBlock } from "../../types";
import type { WorkspaceRuntime } from "../WorkspaceRuntime";
import { estimateGeneration } from "../../lib/batchGeneration";
import { rebuildPdfDocument } from "../../lib/document";
import {
  enhanceCombinedTextBlocks,
  enhanceTextBlocks,
  explainPageImage,
} from "../../lib/intelligence/client";

type EnhancementRuntime = Pick<
  WorkspaceRuntime,
  | "activeChapter"
  | "activeDocument"
  | "config"
  | "currentTextPage"
  | "enhancementControllerRef"
  | "highlights"
  | "imageExplanationControllerRef"
  | "isEnhancing"
  | "isRebuildingSegments"
  | "isThinking"
  | "modelOnline"
  | "modelSupportsVision"
  | "preferences"
  | "repository"
  | "selectedBlockIds"
  | "setActiveChapterId"
  | "setDocuments"
  | "setEnhanceError"
  | "setEnhanceProgress"
  | "setHighlightedBlockId"
  | "setHighlights"
  | "setIsEnhancing"
  | "setIsRebuildingSegments"
  | "setIsThinking"
  | "setMessages"
  | "setMobileView"
  | "setNotice"
  | "setOverlay"
  | "setReaderMode"
  | "setRightTab"
  | "setSelectedBlockIds"
  | "setSelectionMode"
>;

export function useEnhancement(ctx: EnhancementRuntime) {
  const {
    activeDocument,
    activeChapter,
    setDocuments,
    setHighlights,
    modelOnline,
    config,
  } = ctx;
  const runEnhancement = useCallback(
    async (targetBlocks: TextBlock[]) => {
      if (ctx.isEnhancing) return;
      if (!modelOnline) {
        ctx.setOverlay("settings");
        return;
      }
      if (!targetBlocks.length) {
        ctx.setEnhanceError("请先选择需要生成智能文本的原文");
        return;
      }
      const jobId = `${activeDocument.id}:${activeChapter.id}:enhance`;
      const workspace = await ctx.repository.loadWorkspace();
      const previousJob = workspace.enhancementJobs.find(
        (job) => job.id === jobId && job.status !== "completed",
      );
      const completedBeforeStart = targetBlocks
        .filter((block) => Boolean(block.smartText?.trim()))
        .map((block) => block.id);
      const pendingBlocks = targetBlocks.filter(
        (block) => !completedBeforeStart.includes(block.id),
      );
      if (!pendingBlocks.length) {
        ctx.setEnhanceProgress("所选原文已全部生成智能文本");
        return 0;
      }
      const { estimatedInputTokens, estimatedOutputTokens, estimatedCost } =
        estimateGeneration(
          pendingBlocks,
          ctx.preferences.inputPricePerMillion,
          ctx.preferences.outputPricePerMillion,
        );
      const pricingConfigured =
        config.provider === "ollama" ||
        Boolean(
          ctx.preferences.inputPricePerMillion ||
          ctx.preferences.outputPricePerMillion,
        );
      const resumeMessage = previousJob
        ? `\n将从上次进度继续，剩余 ${pendingBlocks.length} / ${targetBlocks.length} 段。`
        : "";
      const costMessage = pricingConfigured
        ? `预计费用约 ¥${estimatedCost.toFixed(4)}。`
        : "尚未配置 Token 单价，无法换算费用。";
      if (
        !window.confirm(
          `预计输入约 ${estimatedInputTokens.toLocaleString()} Token，输出约 ${estimatedOutputTokens.toLocaleString()} Token；${costMessage}${resumeMessage}\n\n是否开始？`,
        )
      ) {
        return;
      }
      const baseJob = {
        id: jobId,
        documentId: activeDocument.id,
        chapterId: activeChapter.id,
        blockIds: targetBlocks.map((block) => block.id),
        completedBlockIds: completedBeforeStart,
        failedBlockIds: [] as string[],
        status: "running" as const,
        estimatedInputTokens,
        estimatedOutputTokens,
        updatedAt: Date.now(),
      };
      await ctx.repository.apply({
        type: "saveEnhancementJob",
        job: baseJob,
      });
      ctx.enhancementControllerRef.current?.abort();
      const controller = new AbortController();
      ctx.enhancementControllerRef.current = controller;
      ctx.setIsEnhancing(true);
      ctx.setEnhanceError("");
      ctx.setEnhanceProgress("正在准备教材原文…");
      let completedBlockIds = completedBeforeStart;
      try {
        const enhanced = await enhanceTextBlocks(
          pendingBlocks,
          config,
          (completed, total, partial) => {
            ctx.setEnhanceProgress(`正在整理 ${completed} / ${total} 段原文`);
            const partialDocument: StudyDocument = {
              ...activeDocument,
              updatedAt: Date.now(),
              chapters: activeDocument.chapters.map((chapter) => ({
                ...chapter,
                blocks: chapter.blocks.map((block) => ({
                  ...block,
                  smartText: partial.get(block.id) || block.smartText,
                })),
              })),
            };
            setDocuments((current) =>
              current.map((document) =>
                document.id === partialDocument.id ? partialDocument : document,
              ),
            );
            void ctx.repository.apply({
              type: "saveDocument",
              document: partialDocument,
            });
            completedBlockIds = [
              ...new Set([...completedBeforeStart, ...partial.keys()]),
            ];
            void ctx.repository.apply({
              type: "saveEnhancementJob",
              job: {
                ...baseJob,
                completedBlockIds,
                updatedAt: Date.now(),
              },
            });
          },
          controller.signal,
          {
            concurrency: ctx.preferences.batchConcurrency,
            requestsPerMinute: ctx.preferences.batchRequestsPerMinute,
            retries: 2,
          },
        );
        if (controller.signal.aborted) return;
        if (!enhanced.size) {
          throw new Error("模型没有返回可用的智能文本");
        }
        const updatedDocument: StudyDocument = {
          ...activeDocument,
          updatedAt: Date.now(),
          chapters: activeDocument.chapters.map((chapter) => ({
            ...chapter,
            blocks: chapter.blocks.map((block) => ({
              ...block,
              smartText: enhanced.get(block.id) || block.smartText,
            })),
          })),
        };
        setDocuments((current) =>
          current.map((document) =>
            document.id === updatedDocument.id ? updatedDocument : document,
          ),
        );
        await ctx.repository.apply({
          type: "saveDocument",
          document: updatedDocument,
        });
        await ctx.repository.apply({
          type: "saveEnhancementJob",
          job: {
            ...baseJob,
            completedBlockIds: targetBlocks.map((block) => block.id),
            status: "completed",
            updatedAt: Date.now(),
          },
        });
        ctx.setEnhanceProgress(`已生成 ${enhanced.size} 个智能文本片段`);
        return enhanced.size;
      } catch (error) {
        if (controller.signal.aborted) {
          await ctx.repository.apply({
            type: "saveEnhancementJob",
            job: {
              ...baseJob,
              completedBlockIds,
              status: "paused",
              updatedAt: Date.now(),
            },
          });
          return;
        }
        await ctx.repository.apply({
          type: "saveEnhancementJob",
          job: {
            ...baseJob,
            completedBlockIds,
            status: "failed",
            failedBlockIds: pendingBlocks
              .filter((block) => !completedBlockIds.includes(block.id))
              .map((block) => block.id),
            error: error instanceof Error ? error.message : "智能文本生成失败",
            updatedAt: Date.now(),
          },
        });
        ctx.setEnhanceError(
          error instanceof Error ? error.message : "智能文本生成失败",
        );
        ctx.setEnhanceProgress("");
      } finally {
        if (ctx.enhancementControllerRef.current === controller) {
          ctx.enhancementControllerRef.current = null;
          ctx.setIsEnhancing(false);
        }
      }
    },
    [ctx, activeDocument, activeChapter.id, modelOnline, config, setDocuments],
  );

  const enhanceCurrentChapter = useCallback(async () => {
    const count = await runEnhancement(activeChapter.blocks);
    if (count) ctx.setReaderMode("text");
  }, [runEnhancement, activeChapter, ctx]);

  const cancelEnhancement = useCallback(() => {
    ctx.enhancementControllerRef.current?.abort();
    ctx.setEnhanceProgress("任务已暂停，可再次开始继续处理");
  }, [ctx]);

  const enhanceSelectedBlocks = useCallback(async () => {
    const selected = activeDocument.chapters
      .flatMap((chapter) => chapter.blocks)
      .filter((block) => ctx.selectedBlockIds.includes(block.id));
    if (ctx.isEnhancing) return;
    if (!modelOnline) {
      ctx.setOverlay("settings");
      return;
    }
    if (!selected.length) {
      ctx.setEnhanceError("请先选择需要生成智能文本的原文");
      return;
    }
    ctx.enhancementControllerRef.current?.abort();
    const controller = new AbortController();
    ctx.enhancementControllerRef.current = controller;
    ctx.setIsEnhancing(true);
    ctx.setEnhanceError("");
    ctx.setEnhanceProgress(`正在合并整理 ${selected.length} 段原文…`);
    try {
      const smartText = await enhanceCombinedTextBlocks(
        selected,
        config,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const owner = selected[0];
      const sourceIds = selected.map((block) => block.id);
      const affectedOwnerIds = new Set(
        activeDocument.chapters
          .flatMap((chapter) => chapter.blocks)
          .filter(
            (block) =>
              sourceIds.includes(block.id) ||
              block.smartTextSourceIds?.some((id) => sourceIds.includes(id)),
          )
          .map((block) => block.smartTextOwnerId || block.id),
      );
      const updatedDocument: StudyDocument = {
        ...activeDocument,
        chapters: activeDocument.chapters.map((chapter) => ({
          ...chapter,
          blocks: chapter.blocks.map((block) => {
            const currentOwnerId = block.smartTextOwnerId || block.id;
            const reset = affectedOwnerIds.has(currentOwnerId)
              ? {
                  ...block,
                  smartText: undefined,
                  smartTextSourceIds: undefined,
                  smartTextOwnerId: undefined,
                }
              : block;
            if (!sourceIds.includes(block.id)) return reset;
            if (block.id === owner.id) {
              return {
                ...reset,
                smartText,
                smartTextSourceIds: sourceIds,
                smartTextOwnerId: owner.id,
              };
            }
            return {
              ...reset,
              smartText: undefined,
              smartTextSourceIds: undefined,
              smartTextOwnerId: owner.id,
            };
          }),
        })),
      };
      setDocuments((current) =>
        current.map((document) =>
          document.id === updatedDocument.id ? updatedDocument : document,
        ),
      );
      await ctx.repository.apply({
        type: "saveDocument",
        document: updatedDocument,
      });
      ctx.setEnhanceProgress(
        `已将 ${selected.length} 段原文整理为 1 份智能文本`,
      );
      ctx.setSelectionMode(false);
      ctx.setSelectedBlockIds([]);
    } catch (error) {
      if (controller.signal.aborted) return;
      ctx.setEnhanceError(
        error instanceof Error ? error.message : "智能文本生成失败",
      );
      ctx.setEnhanceProgress("");
    } finally {
      if (ctx.enhancementControllerRef.current === controller) {
        ctx.enhancementControllerRef.current = null;
        ctx.setIsEnhancing(false);
      }
    }
  }, [ctx, activeDocument, modelOnline, config, setDocuments]);

  const rebuildActiveDocumentSegments = useCallback(async () => {
    if (
      ctx.isRebuildingSegments ||
      activeDocument.kind !== "pdf" ||
      !activeDocument.originalFile
    ) {
      return;
    }
    const hasGeneratedText = activeDocument.chapters.some((chapter) =>
      chapter.blocks.some((block) => Boolean(block.smartText)),
    );
    const linkedHighlights = ctx.highlights.filter(
      (highlight) => highlight.documentId === activeDocument.id,
    );
    if (
      (hasGeneratedText || linkedHighlights.length > 0) &&
      !window.confirm(
        "重建会替换旧的机械分段。已有 AI 整理稿和段落高亮无法可靠对应，将被清除；笔记与阅读进度会保留。是否继续？",
      )
    ) {
      return;
    }
    ctx.setIsRebuildingSegments(true);
    ctx.setNotice("正在依据 PDF 版面重建语义分段，请稍候…");
    try {
      const rebuilt = await rebuildPdfDocument(activeDocument);
      const targetChapter =
        rebuilt.chapters.find((chapter) =>
          chapter.blocks.some((block) => block.page === ctx.currentTextPage),
        ) ||
        rebuilt.chapters.find(
          (chapter) => chapter.title === activeChapter.title,
        ) ||
        rebuilt.chapters[0];
      setDocuments((current) =>
        current.map((document) =>
          document.id === rebuilt.id ? rebuilt : document,
        ),
      );
      let workspace = await ctx.repository.apply({
        type: "saveDocument",
        document: rebuilt,
      });
      for (const highlight of linkedHighlights) {
        workspace = await ctx.repository.apply({
          type: "deleteHighlight",
          highlightId: highlight.id,
        });
      }
      setHighlights(workspace.highlights);
      ctx.setActiveChapterId(targetChapter.id);
      ctx.setSelectedBlockIds([]);
      ctx.setSelectionMode(false);
      ctx.setHighlightedBlockId(null);
      ctx.setNotice("智能分段已重建：标题、缩进段落和编号层级将分别选择");
    } catch (error) {
      ctx.setNotice(
        error instanceof Error ? error.message : "智能分段重建失败",
      );
    } finally {
      ctx.setIsRebuildingSegments(false);
    }
  }, [ctx, activeDocument, activeChapter, setDocuments, setHighlights]);

  const explainCurrentPageImage = useCallback(
    async (page: number, dataUrl: string) => {
      if (!modelOnline || !ctx.modelSupportsVision || ctx.isThinking) return;
      ctx.imageExplanationControllerRef.current?.abort();
      const controller = new AbortController();
      ctx.imageExplanationControllerRef.current = controller;
      ctx.setRightTab("mentor");
      ctx.setMobileView("mentor");
      ctx.setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "student",
          text: `讲解原版教材第 ${page} 页中的演示图`,
        },
      ]);
      ctx.setIsThinking(true);
      try {
        const answer = await explainPageImage(
          dataUrl,
          page,
          config,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        ctx.setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: answer,
            status: "direct",
          },
        ]);
      } catch (error) {
        if (controller.signal.aborted) return;
        ctx.setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text:
              error instanceof Error
                ? `图示讲解失败：${error.message}`
                : "图示讲解失败，请检查模型服务。",
            status: "insufficient",
          },
        ]);
      } finally {
        if (ctx.imageExplanationControllerRef.current === controller) {
          ctx.imageExplanationControllerRef.current = null;
          ctx.setIsThinking(false);
        }
      }
    },
    [ctx, modelOnline, config],
  );

  return {
    runEnhancement,
    enhanceCurrentChapter,
    enhanceSelectedBlocks,
    rebuildActiveDocumentSegments,
    explainCurrentPageImage,
    cancelEnhancement,
  };
}
