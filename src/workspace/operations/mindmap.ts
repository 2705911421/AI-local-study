import { useCallback } from "react";
import type { MindMap, MindMapNode, Chapter } from "../../types";
import { askModel } from "../../lib/intelligence/client";
import type { WorkspaceRuntime } from "../WorkspaceRuntime";
import { usePersistence } from "./persistence";

type MindMapRuntime = Pick<
  WorkspaceRuntime,
  | "activeChapter"
  | "activeDocument"
  | "config"
  | "isThinking"
  | "modelOnline"
  | "repository"
  | "setIsThinking"
  | "setNotice"
>;

export function useMindMap(ctx: MindMapRuntime) {
  const {
    activeDocument,
    activeChapter,
    config,
    modelOnline,
    isThinking,
    setIsThinking,
    setNotice,
  } = ctx;
  const { persistCommand } = usePersistence(ctx);

  const generateMindMap = useCallback(
    async (existingMindMaps: MindMap[]): Promise<MindMap | null> => {
      if (isThinking) {
        setNotice("AI 正在处理中，请稍候");
        return null;
      }

      setIsThinking(true);
      try {
        // Check if mind map already exists for this chapter
        const existing = existingMindMaps.find(
          (m) =>
            m.documentId === activeDocument.id &&
            m.chapterId === activeChapter.id,
        );

        // Build chapter content for AI
        const chapterContent = activeChapter.blocks
          .slice(0, 20)
          .map((block, i) => `${i + 1}. ${block.text.slice(0, 200)}`)
          .join("\n");

        const prompt = `请为以下教材章节生成一个思维导图的 JSON 结构。

章节标题：${activeChapter.title}

章节内容摘要：
${chapterContent}

请返回如下 JSON 格式（直接返回 JSON，不要加 markdown 代码块标记）：
{
  "title": "思维导图标题",
  "nodes": {
    "node-1": { "id": "node-1", "label": "核心概念", "children": ["node-2", "node-3"], "color": "accent" },
    "node-2": { "id": "node-2", "label": "子概念1", "children": [] },
    "node-3": { "id": "node-3", "label": "子概念2", "children": ["node-4"] },
    "node-4": { "id": "node-4", "label": "细节要点", "children": [] }
  },
  "rootIds": ["node-1"]
}

要求：
- 3-6 个根节点，每个根节点 2-4 个子节点
- color 可选值："accent" | "blue" | "orange" | "purple"
- 尽量使用章节中的关键术语`;

        let mindMapData: {
          title: string;
          nodes: Record<string, MindMapNode>;
          rootIds: string[];
        };

        if (modelOnline) {
          try {
            const response = await askModel(
              prompt,
              [],
              config,
              new AbortController().signal,
            );
            // Try to parse JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              mindMapData = JSON.parse(jsonMatch[0]);
            } else {
              mindMapData = generateFallbackMindMap(activeChapter);
            }
          } catch {
            mindMapData = generateFallbackMindMap(activeChapter);
          }
        } else {
          mindMapData = generateFallbackMindMap(activeChapter);
        }

        const now = Date.now();
        const mindMap: MindMap = {
          id: existing?.id || crypto.randomUUID(),
          documentId: activeDocument.id,
          chapterId: activeChapter.id,
          title: mindMapData.title || activeChapter.title,
          rootIds: mindMapData.rootIds || [],
          nodes: mindMapData.nodes || {},
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        };

        const workspace = await persistCommand(
          { type: "saveMindMap", mindMap },
          "思维导图保存失败",
        );
        if (!workspace) return null;

        setNotice("思维导图已生成");
        return mindMap;
      } catch {
        setNotice("思维导图生成失败，请重试");
        return null;
      } finally {
        setIsThinking(false);
      }
    },
    [
      isThinking,
      activeDocument.id,
      activeChapter,
      config,
      modelOnline,
      persistCommand,
      setIsThinking,
      setNotice,
    ],
  );

  const deleteMindMap = useCallback(
    async (mindMapId: string): Promise<boolean> => {
      const workspace = await persistCommand(
        { type: "deleteMindMap", mindMapId },
        "思维导图删除失败",
      );
      if (!workspace) return false;
      setNotice("思维导图已删除");
      return true;
    },
    [persistCommand, setNotice],
  );

  return { generateMindMap, deleteMindMap };
}

function generateFallbackMindMap(chapter: Chapter): {
  title: string;
  nodes: Record<string, MindMapNode>;
  rootIds: string[];
} {
  const blocks = chapter.blocks.slice(0, 12);
  const rootIds: string[] = [];
  const nodes: Record<string, MindMapNode> = {};

  // Group blocks into 3-4 conceptual groups
  const groupSize = Math.max(3, Math.ceil(blocks.length / 4));
  const colors: Array<"accent" | "blue" | "orange" | "purple"> = [
    "accent",
    "blue",
    "orange",
    "purple",
  ];

  for (let g = 0; g < Math.ceil(blocks.length / groupSize); g++) {
    const groupId = `root-${g}`;
    const groupBlocks = blocks.slice(g * groupSize, (g + 1) * groupSize);

    if (groupBlocks.length === 0) continue;

    rootIds.push(groupId);
    nodes[groupId] = {
      id: groupId,
      label: extractKeyPhrase(groupBlocks[0].text),
      children: groupBlocks.slice(1).map((_, i) => `child-${g}-${i}`),
      color: colors[g % colors.length],
    };

    groupBlocks.slice(1).forEach((block, i) => {
      const childId = `child-${g}-${i}`;
      nodes[childId] = {
        id: childId,
        label: extractKeyPhrase(block.text),
        children: [],
        blockIds: [block.id],
      };
    });
  }

  return {
    title: chapter.title,
    nodes,
    rootIds,
  };
}

function extractKeyPhrase(text: string): string {
  // Extract the first meaningful phrase from text
  const cleaned = text
    .replace(/^[，。、；：！？\s]+/, "")
    .replace(/[，。、；：！？].*$/, "");
  const truncated = cleaned.slice(0, 30);
  return truncated.length < cleaned.length ? `${truncated}…` : truncated;
}
