import { useCallback } from "react";
import type { SearchScope, WorkspaceRuntime } from "../WorkspaceRuntime";
import { retrieve, retrieveDocuments } from "../../lib/learningEngine";
import { askModel } from "../../lib/intelligence/client";
import { usePersistence } from "./persistence";

type ChatRuntime = Pick<
  WorkspaceRuntime,
  | "activeChapter"
  | "activeDocument"
  | "chatHydratingDocumentId"
  | "config"
  | "documents"
  | "isThinking"
  | "modelOnline"
  | "preferences"
  | "questionControllerRef"
  | "setIsThinking"
  | "setMessages"
  | "setModelOnline"
  | "setNotice"
>;

type NoteRuntime = Pick<
  WorkspaceRuntime,
  | "activeChapter"
  | "activeDocument"
  | "currentBlockId"
  | "currentTextPage"
  | "notes"
  | "repository"
  | "setNotes"
  | "setNotice"
>;

export function useChat(ctx: ChatRuntime) {
  const {
    activeChapter,
    activeDocument,
    setMessages,
    isThinking,
    setIsThinking,
    config,
    modelOnline,
    setModelOnline,
    documents,
    chatHydratingDocumentId,
    setNotice,
    preferences,
  } = ctx;

  const questionControllerRef = ctx.questionControllerRef;

  const submitQuestion = useCallback(
    async (preset?: string, scopeOverride: SearchScope = "document") => {
      const question = (preset || "").trim();
      if (!question || isThinking) return;
      if (chatHydratingDocumentId === activeDocument.id) {
        setNotice("正在读取该教材的伴学记录，请稍候");
        return;
      }
      questionControllerRef.current?.abort();
      const controller = new AbortController();
      questionControllerRef.current = controller;
      const studentMessage = {
        id: crypto.randomUUID(),
        role: "student" as const,
        text: question,
      };
      setMessages((current) => [...current, studentMessage]);
      setIsThinking(true);

      try {
        let citations =
          scopeOverride === "library"
            ? retrieveDocuments(
                question,
                documents.filter((document) => document.kind !== "demo"),
                activeChapter.id,
                3,
                preferences.semanticSearchEnabled !== false,
              )
            : retrieve(
                question,
                activeChapter,
                scopeOverride === "chapter"
                  ? [activeChapter]
                  : activeDocument.chapters,
                3,
                preferences.semanticSearchEnabled !== false,
              );
        if (
          citations.length === 0 &&
          /总结|概括|梳理|核心|要点/.test(question)
        ) {
          citations = activeChapter.blocks.slice(0, 4).map((block) => ({
            blockId: block.id,
            locator: block.locator,
            excerpt:
              block.text.length > 240
                ? `${block.text.slice(0, 240)}…`
                : block.text,
            score: 0.7,
          }));
        }

        let answer = "";
        let status: "direct" | "inferred" | "insufficient" = "direct";
        if (!citations.length || citations[0].score < 0.1) {
          answer =
            "教材中未找到足够依据。我没有使用教材外知识补充答案。你可以换一种问法，或将学习范围切换到其他章节。";
          status = "insufficient";
        } else if (modelOnline) {
          status = citations[0].score < 0.48 ? "inferred" : "direct";
          try {
            answer = await askModel(
              question,
              citations,
              config,
              controller.signal,
            );
          } catch {
            if (controller.signal.aborted) return;
            setModelOnline(false);
            answer = `当前模型服务未响应。根据检索到的教材原文：${citations[0].excerpt}`;
          }
        } else {
          status = citations[0].score < 0.48 ? "inferred" : "direct";
          answer = `根据教材，${citations[0].excerpt}${
            citations.length > 1
              ? `\n\n相关内容还出现在"${citations[1].locator}"。`
              : ""
          }`;
        }

        if (controller.signal.aborted) return;
        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: answer,
            citations,
            status,
            question,
          },
        ]);
      } finally {
        if (questionControllerRef.current === controller) {
          questionControllerRef.current = null;
          setIsThinking(false);
        }
      }
    },
    [
      isThinking,
      chatHydratingDocumentId,
      setNotice,
      activeChapter,
      activeDocument,
      documents,
      config,
      modelOnline,
      questionControllerRef,
      setMessages,
      setIsThinking,
      setModelOnline,
      preferences.semanticSearchEnabled,
    ],
  );

  const copyMessage = useCallback(
    (message: { text: string }) => {
      void navigator.clipboard
        .writeText(message.text)
        .then(() => setNotice("回答已复制"))
        .catch(() => setNotice("复制失败，请手动选择文字"));
    },
    [setNotice],
  );

  const setMessageFeedback = useCallback(
    (
      messageId: string,
      feedback: "helpful" | "unhelpful",
      feedbackReason?: "irrelevant" | "unsupported" | "unclear" | "incomplete",
    ) => {
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? { ...message, feedback, feedbackReason }
            : message,
        ),
      );
      setNotice("感谢反馈，已保存在本机");
    },
    [setMessages, setNotice],
  );

  return { submitQuestion, copyMessage, setMessageFeedback };
}

// ─── useNoteManager ──────────────────────────────────────────────────

export function useNoteManager(ctx: NoteRuntime) {
  const {
    activeDocument,
    activeChapter,
    notes,
    setNotes,
    currentBlockId,
    currentTextPage,
    setNotice,
  } = ctx;
  const { persistCommand } = usePersistence(ctx);

  const addNote = useCallback(
    async ({
      draft,
      editingNoteId,
      quote,
    }: {
      draft: string;
      editingNoteId: string | null;
      quote: string;
    }): Promise<boolean> => {
      const text = draft.trim();
      if (!text) return false;
      const now = Date.now();
      const previous = notes.find((note) => note.id === editingNoteId);
      const note = {
        id: previous?.id || crypto.randomUUID(),
        documentId: activeDocument.id,
        chapterId: activeChapter.id,
        text,
        createdAt: previous?.createdAt || now,
        updatedAt: now,
        blockId: previous?.blockId || currentBlockId,
        page: previous?.page || currentTextPage,
        quote: previous?.quote,
        ...(quote ? { quote } : {}),
      };
      const workspace = await persistCommand(
        { type: "saveNote", note },
        "笔记保存失败：浏览器存储不可用或空间不足",
      );
      if (!workspace) {
        return false;
      }
      setNotes(workspace.notes);
      setNotice(previous ? "笔记已更新" : "笔记已保存在本机");
      return true;
    },
    [
      currentBlockId,
      currentTextPage,
      notes,
      activeDocument.id,
      activeChapter.id,
      persistCommand,
      setNotes,
      setNotice,
    ],
  );

  const deleteNote = useCallback(
    async (noteId: string): Promise<boolean> => {
      const workspace = await persistCommand(
        { type: "deleteNote", noteId },
        "笔记删除失败，本地记录未改变",
      );
      if (!workspace) return false;
      setNotes(workspace.notes);
      setNotice("笔记已删除");
      return true;
    },
    [persistCommand, setNotes, setNotice],
  );

  const exportNotes = useCallback(() => {
    const documentNotes = notes.filter(
      (note) => note.documentId === activeDocument.id,
    );
    const markdown = [
      `# ${activeDocument.displayTitle || activeDocument.title} · 学习笔记`,
      "",
      ...documentNotes.flatMap((note) => [
        `## ${activeDocument.chapters.find((item) => item.id === note.chapterId)?.title || "待归类"}`,
        "",
        note.quote ? `> ${note.quote}` : "",
        note.text,
        "",
        `记录于 ${new Date(note.createdAt).toLocaleString("zh-CN")}`,
        "",
      ]),
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([markdown], { type: "text/markdown;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeDocument.displayTitle || activeDocument.title}-笔记.md`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("笔记已导出为 Markdown");
  }, [notes, activeDocument, setNotice]);

  return { addNote, deleteNote, exportNotes };
}

// ─── useAiNoteGenerator ────────────────────────────────────────────

type AiNoteRuntime = Pick<
  WorkspaceRuntime,
  | "activeChapter"
  | "activeDocument"
  | "config"
  | "isThinking"
  | "modelOnline"
  | "notes"
  | "repository"
  | "setIsThinking"
  | "setNotes"
  | "setNotice"
>;

export function useAiNoteGenerator(ctx: AiNoteRuntime) {
  const {
    activeDocument,
    activeChapter,
    notes,
    setNotes,
    config,
    modelOnline,
    isThinking,
    setIsThinking,
    setNotice,
  } = ctx;
  const { persistCommand } = usePersistence(ctx);

  const generateNoteForBlock = useCallback(
    async (blockId: string, blockText: string): Promise<boolean> => {
      if (isThinking) {
        setNotice("AI 正在处理中，请稍候");
        return false;
      }

      // Check if an embedded note already exists for this block
      const existingNote = notes.find(
        (n) =>
          n.blockId === blockId &&
          n.embedded &&
          n.documentId === activeDocument.id,
      );
      if (existingNote) {
        setNotice("该段落已有 AI 笔记");
        return false;
      }

      setIsThinking(true);
      try {
        const prompt = `请为以下教材段落生成一份简洁的学习笔记（3-5句话），包含核心概念、关键要点和一个记忆提示。直接输出笔记内容，不要加标题或前缀。

教材段落：
${blockText.slice(0, 600)}`;

        const citations = [
          {
            blockId,
            locator: "",
            excerpt: blockText.slice(0, 300),
            score: 1,
          },
        ];

        let noteText: string;
        if (modelOnline) {
          try {
            const { askModel: ask } =
              await import("../../lib/intelligence/client");
            noteText = await ask(
              prompt,
              citations,
              config,
              new AbortController().signal,
            );
          } catch {
            setNotice("AI 笔记生成失败，请检查模型连接后重试");
            return false;
          }
        } else {
          noteText = generateFallbackNote(blockText);
        }

        const now = Date.now();
        const note = {
          id: crypto.randomUUID(),
          documentId: activeDocument.id,
          chapterId: activeChapter.id,
          text: noteText,
          createdAt: now,
          updatedAt: now,
          blockId,
          embedded: true,
          source: "ai-generated" as const,
        };

        const workspace = await persistCommand(
          { type: "saveNote", note },
          "AI 笔记保存失败",
        );
        if (!workspace) return false;

        setNotes(workspace.notes);
        setNotice("AI 笔记已生成");
        return true;
      } finally {
        setIsThinking(false);
      }
    },
    [
      isThinking,
      notes,
      activeDocument.id,
      activeChapter.id,
      config,
      modelOnline,
      persistCommand,
      setNotes,
      setIsThinking,
      setNotice,
    ],
  );

  const deleteAiNote = useCallback(
    async (noteId: string): Promise<boolean> => {
      const workspace = await persistCommand(
        { type: "deleteNote", noteId },
        "笔记删除失败",
      );
      if (!workspace) return false;
      setNotes(workspace.notes);
      setNotice("笔记已删除");
      return true;
    },
    [persistCommand, setNotes, setNotice],
  );

  const updateAiNote = useCallback(
    async (noteId: string, newText: string): Promise<boolean> => {
      const existing = notes.find((n) => n.id === noteId);
      if (!existing) return false;
      const updatedNote = {
        ...existing,
        text: newText,
        updatedAt: Date.now(),
      };
      const workspace = await persistCommand(
        { type: "saveNote", note: updatedNote },
        "笔记更新失败",
      );
      if (!workspace) return false;
      setNotes(workspace.notes);
      setNotice("笔记已更新");
      return true;
    },
    [notes, persistCommand, setNotes, setNotice],
  );

  return { generateNoteForBlock, deleteAiNote, updateAiNote };
}

function generateFallbackNote(text: string): string {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/[。！？；]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 4);

  const keyPoints = sentences.slice(0, 3);
  return `核心要点：${keyPoints.join("；")}。建议结合教材上下文深入理解以上概念。`;
}
