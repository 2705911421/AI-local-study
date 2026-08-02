import { useCallback } from "react";
import type { WorkspaceRuntime } from "../WorkspaceRuntime";
import { demoDocument } from "../../lib/demo";
import { importPipeline } from "../../lib/importPipeline";
import type { StudyDocument } from "../../types";

type ImportRuntime = Pick<
  WorkspaceRuntime,
  | "documents"
  | "importCloseTimerRef"
  | "importControllerRef"
  | "importOcrLanguages"
  | "importWithOcr"
  | "repository"
  | "setDocuments"
  | "setImportError"
  | "setImportProgress"
  | "setImportState"
  | "setNotes"
  | "setNotice"
  | "setOverlay"
>;

export function useImporter(
  ctx: ImportRuntime,
  selectDocument: (document: StudyDocument) => void,
) {
  const { documents, setDocuments } = ctx;

  const handleFile = useCallback(
    async (file?: File) => {
      if (!file) return;
      ctx.importControllerRef.current?.abort();
      const controller = new AbortController();
      ctx.importControllerRef.current = controller;
      ctx.setImportState("parsing");
      ctx.setImportError("");
      ctx.setImportProgress(null);
      try {
        const { document: parsed } = await importPipeline.run(file, {
          signal: controller.signal,
          ocr: ctx.importWithOcr,
          ocrLanguages: ctx.importOcrLanguages,
          onProgress: ctx.setImportProgress,
          loadCheckpoint: async (contentHash) => {
            const workspace = await ctx.repository.loadWorkspace();
            return workspace.checkpoints.find(
              (checkpoint) => checkpoint.id === contentHash,
            );
          },
          saveCheckpoint: async (checkpoint) => {
            await ctx.repository.apply({
              type: "saveCheckpoint",
              checkpoint,
            });
          },
          deleteCheckpoint: async (checkpointId) => {
            await ctx.repository.apply({
              type: "deleteCheckpoint",
              checkpointId,
            });
          },
        });
        const existing = documents.find(
          (document) =>
            document.kind !== "demo" &&
            document.contentHash &&
            document.contentHash === parsed.contentHash,
        );
        if (existing) {
          const replace = window.confirm(
            `《${existing.displayTitle || existing.title}》已在书库中。\n\n确定：替换原教材并保留学习记录\n取消：保留为副本`,
          );
          if (replace) {
            parsed.id = existing.id;
            parsed.chapters = parsed.chapters.map((chapter) => ({
              ...chapter,
              id: chapter.id.replace(/^[^:]+:/, `${existing.id}:`),
              blocks: chapter.blocks.map((block) => ({
                ...block,
                id: block.id.replace(/^[^:]+:/, `${existing.id}:`),
                chapterId: block.chapterId.replace(
                  /^[^:]+:/,
                  `${existing.id}:`,
                ),
              })),
            }));
          } else {
            parsed.displayTitle = `${parsed.displayTitle || parsed.title}（副本）`;
          }
        }
        const stored = parsed;
        const workspace = await ctx.repository.apply({
          type: "saveDocument",
          document: stored,
        });
        if (stored.contentHash) {
          await ctx.repository.apply({
            type: "deleteCheckpoint",
            checkpointId: stored.contentHash,
          });
        }
        ctx.setNotes(workspace.notes);
        setDocuments((current) => [
          demoDocument,
          stored,
          ...current.filter(
            (document) =>
              document.id !== demoDocument.id && document.id !== stored.id,
          ),
        ]);
        selectDocument(stored);
        ctx.setImportState("done");
        ctx.setNotice(
          `《${stored.displayTitle || stored.title}》已导入并保存在本机`,
        );
        if (ctx.importCloseTimerRef.current !== null) {
          window.clearTimeout(ctx.importCloseTimerRef.current);
        }
        ctx.importCloseTimerRef.current = window.setTimeout(() => {
          ctx.setOverlay(null);
          ctx.setImportState("idle");
          ctx.importCloseTimerRef.current = null;
        }, 900);
      } catch (error) {
        if (controller.signal.aborted) {
          ctx.setImportState("idle");
          ctx.setImportProgress(null);
          return;
        }
        ctx.setImportState("error");
        ctx.setImportError(
          error instanceof Error ? error.message : "教材导入失败，请重试。",
        );
      } finally {
        if (ctx.importControllerRef.current === controller) {
          ctx.importControllerRef.current = null;
        }
      }
    },
    [documents, ctx, setDocuments, selectDocument],
  );

  return { handleFile };
}
