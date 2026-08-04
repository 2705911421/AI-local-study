import { memo, useEffect, useMemo, useState, type RefObject } from "react";
import {
  Brain,
  Copy,
  DownloadSimple,
  HighlighterCircle,
  MagnifyingGlass,
  NotePencil,
  PaperPlaneTilt,
  PencilSimple,
  Quotes,
  ThumbsDown,
  ThumbsUp,
  Trash,
  TreeStructure,
  X,
} from "@phosphor-icons/react";
import type { ChatMessage, Citation, Highlight } from "../../types";
import type { SearchScope } from "../../workspace/WorkspaceRuntime";
import {
  useAssistant,
  useLibrary,
  useNotes,
  useMindMapDomain,
  useStickyNotes,
  useShell,
} from "../../workspace/WorkspaceDomains";
import { markWorkspaceRender } from "../../workspace/renderDiagnostics";
import { MindMapPane } from "./MindMapPane";
import { StickyNote } from "./StickyNote";

type FeedbackReason = NonNullable<ChatMessage["feedbackReason"]>;

interface StudyPanelProps {
  chatEndRef: RefObject<HTMLDivElement | null>;
  chapterHighlights: Highlight[];
  onOpenAnswerCitation: (citation: Citation) => void;
  onOpenCitation: (blockId: string, locator: string) => void;
  onCopyMessage: (message: ChatMessage) => void;
  onSetMessageFeedback: (
    messageId: string,
    feedback: "helpful" | "unhelpful",
    reason?: FeedbackReason,
  ) => void;
  onSubmitQuestion: (preset?: string, scope?: SearchScope) => void;
}

export const StudyPanel = memo(function StudyPanel({
  chatEndRef,
  chapterHighlights,
  onOpenAnswerCitation,
  onOpenCitation,
  onCopyMessage,
  onSetMessageFeedback,
  onSubmitQuestion,
}: StudyPanelProps) {
  markWorkspaceRender("assistant");
  const shell = useShell();
  const library = useLibrary();
  const assistant = useAssistant();
  const notes = useNotes();
  const mindMap = useMindMapDomain();
  const sticky = useStickyNotes();
  const [query, setQuery] = useState("");
  const [searchScope, setSearchScope] = useState<SearchScope>("document");
  const [noteDraft, setNoteDraft] = useState("");
  const [noteError, setNoteError] = useState("");
  const [noteSearch, setNoteSearch] = useState("");
  const currentStickyNotes = useMemo(
    () =>
      sticky.stickyNotes.filter(
        (note) =>
          note.documentId === library.activeDocument.id &&
          note.chapterId === library.activeChapter.id,
      ),
    [library.activeChapter.id, library.activeDocument.id, sticky.stickyNotes],
  );
  useEffect(() => {
    setNoteDraft(notes.editor.initialDraft);
    setNoteError("");
  }, [notes.editor.initialDraft, notes.editor.revision]);
  const chapterNotes = useMemo(() => {
    const normalized = noteSearch.trim().toLocaleLowerCase("zh-CN");
    return notes.notes.filter(
      (note) =>
        note.documentId === library.activeDocument.id &&
        note.chapterId === library.activeChapter.id &&
        (!normalized ||
          `${note.text} ${note.quote || ""}`
            .toLocaleLowerCase("zh-CN")
            .includes(normalized)),
    );
  }, [
    library.activeChapter.id,
    library.activeDocument.id,
    noteSearch,
    notes.notes,
  ]);

  return (
    <aside
      className={`study-panel ${
        shell.mobileView !== "reader" ? "mobile-active" : ""
      }`}
      aria-label="伴学与笔记"
    >
      <div className="panel-tabs">
        <button
          type="button"
          className={shell.rightTab === "mentor" ? "active" : ""}
          onClick={() => shell.selectRightTab("mentor")}
        >
          <Brain size={16} />
          伴学
        </button>
        <button
          type="button"
          className={shell.rightTab === "notes" ? "active" : ""}
          onClick={() => shell.selectRightTab("notes")}
        >
          <NotePencil size={16} />
          笔记
          {chapterNotes.length > 0 && <span>{chapterNotes.length}</span>}
        </button>
        <button
          type="button"
          className={shell.rightTab === "mindmap" ? "active" : ""}
          onClick={() => shell.selectRightTab("mindmap")}
        >
          <TreeStructure size={16} />
          导图
        </button>
      </div>

      {shell.rightTab === "mindmap" ? (
        <MindMapPane
          mindMap={mindMap.activeMindMap}
          onGenerate={() => void mindMap.generateMindMap()}
          onDelete={() => void mindMap.deleteMindMap()}
          isGenerating={mindMap.isGenerating}
        />
      ) : shell.rightTab === "mentor" ? (
        <div className="chat-panel">
          <div className="chat-messages">
            {assistant.messages.map((message) => (
              <article
                className={`chat-bubble ${message.role}`}
                key={message.id}
              >
                <div className="bubble-content">
                  <p>{message.text}</p>
                  {message.citations?.length ? (
                    <div className="citation-list">
                      {message.citations.map((citation) => (
                        <button
                          type="button"
                          className="citation"
                          key={citation.blockId}
                          onClick={() => onOpenAnswerCitation(citation)}
                        >
                          <Quotes size={12} weight="fill" />
                          {citation.locator}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                {message.role === "assistant" && (
                  <footer className="bubble-actions">
                    <span className="bubble-status">
                      {message.status === "direct"
                        ? "教材依据"
                        : message.status === "inferred"
                          ? "推断回答"
                          : message.status === "insufficient"
                            ? "未找到依据"
                            : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => onCopyMessage(message)}
                      title="复制回答"
                      aria-label="复制回答"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      type="button"
                      className={
                        message.feedback === "helpful" ? "is-active" : ""
                      }
                      onClick={() =>
                        onSetMessageFeedback(message.id, "helpful")
                      }
                      title="有帮助"
                      aria-label="标记回答有帮助"
                    >
                      <ThumbsUp size={14} />
                    </button>
                    <button
                      type="button"
                      className={
                        message.feedback === "unhelpful" ? "is-active" : ""
                      }
                      onClick={() =>
                        onSetMessageFeedback(message.id, "unhelpful")
                      }
                      title="没帮助"
                      aria-label="标记回答没帮助"
                    >
                      <ThumbsDown size={14} />
                    </button>
                  </footer>
                )}
                {message.role === "assistant" &&
                  message.feedback === "unhelpful" && (
                    <div className="feedback-followup">
                      <label>
                        <span>主要问题</span>
                        <select
                          value={message.feedbackReason || ""}
                          onChange={(event) =>
                            onSetMessageFeedback(
                              message.id,
                              "unhelpful",
                              event.target.value as FeedbackReason,
                            )
                          }
                        >
                          <option value="">请选择</option>
                          <option value="irrelevant">检索内容不相关</option>
                          <option value="unsupported">缺少教材依据</option>
                          <option value="unclear">表达不清楚</option>
                          <option value="incomplete">回答不完整</option>
                        </select>
                      </label>
                      {message.question && (
                        <button
                          type="button"
                          onClick={() =>
                            onSubmitQuestion(
                              `${message.question}（请扩大检索范围，重新核对教材依据后回答）`,
                            )
                          }
                        >
                          重新检索并回答
                        </button>
                      )}
                    </div>
                  )}
              </article>
            ))}
            {assistant.isThinking && (
              <div className="chat-bubble assistant thinking" role="status">
                <span className="sr-only">正在生成回答</span>
                <span className="typing-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <label className="search-scope">
            <span>检索范围</span>
            <select
              value={searchScope}
              onChange={(event) =>
                setSearchScope(event.target.value as SearchScope)
              }
            >
              <option value="chapter">当前章节</option>
              <option value="document">整本教材</option>
              <option value="library">全部教材</option>
            </select>
          </label>
          <form
            className="chat-input"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitQuestion(query, searchScope);
              setQuery("");
            }}
          >
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="输入问题，仅依据当前教材回答…"
              disabled={
                assistant.isThinking ||
                assistant.chatHydratingDocumentId === library.activeDocument.id
              }
            />
            <button
              type="submit"
              disabled={
                !query.trim() ||
                assistant.isThinking ||
                assistant.chatHydratingDocumentId === library.activeDocument.id
              }
              aria-label="发送提问"
            >
              <PaperPlaneTilt size={18} />
            </button>
          </form>
        </div>
      ) : (
        <div className="notes-panel">
          <div className="note-editor">
            {notes.noteQuote && (
              <blockquote className="note-quote">
                {notes.noteQuote}
                <button
                  type="button"
                  onClick={notes.clearQuote}
                  aria-label="清除引用"
                >
                  <X size={13} />
                </button>
              </blockquote>
            )}
            <textarea
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="记录此刻的理解、疑问或待复习内容…"
            />
            {noteError && (
              <div className="note-error" role="alert">
                {noteError}
              </div>
            )}
            <div className="note-editor-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  setNoteError("");
                  void notes.saveNote(noteDraft).then((saved) => {
                    if (saved) {
                      setNoteDraft("");
                    } else {
                      setNoteError(
                        "笔记保存失败：浏览器存储不可用或空间不足。",
                      );
                    }
                  });
                }}
                disabled={!noteDraft.trim()}
              >
                {notes.editor.editingNoteId ? "更新笔记" : "保存笔记"}
              </button>
              {notes.editor.editingNoteId && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    notes.cancelEditing();
                  }}
                >
                  取消编辑
                </button>
              )}
            </div>
          </div>
          <label className="note-search">
            <MagnifyingGlass size={14} />
            <input
              value={noteSearch}
              onChange={(event) => setNoteSearch(event.target.value)}
              placeholder="搜索笔记"
            />
          </label>
          <button
            type="button"
            className="export-notes"
            onClick={notes.exportNotes}
            disabled={!chapterNotes.length}
          >
            <DownloadSimple size={14} />
            导出笔记
          </button>
          <div className="note-list">
            {chapterNotes.length ? (
              [...chapterNotes]
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((note) => (
                  <article className="note-card" key={note.id}>
                    <p>{note.text}</p>
                    <footer>
                      <span>
                        {new Date(note.updatedAt).toLocaleString("zh-CN")}
                      </span>
                      <span>
                        <button
                          type="button"
                          onClick={() => {
                            notes.editNote(note);
                          }}
                          aria-label="编辑笔记"
                        >
                          <PencilSimple size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => notes.requestNoteDelete(note.id)}
                          aria-label="删除笔记"
                        >
                          <Trash size={13} />
                        </button>
                      </span>
                    </footer>
                  </article>
                ))
            ) : (
              <div className="empty-notes">
                <NotePencil size={30} />
                <strong>还没有章节笔记</strong>
                <span>写下自己的理解，比复制教材更有帮助。</span>
              </div>
            )}
          </div>
          <section className="sticky-notes-section" aria-label="章节便签">
            <div className="sticky-notes-heading">
              <strong>章节便签</strong>
              <button
                type="button"
                className="secondary-button"
                onClick={() => void sticky.addStickyNote("新便签", 24, 24)}
              >
                <NotePencil size={13} />
                添加
              </button>
            </div>
            <div className="sticky-notes-container">
              {currentStickyNotes.map((note) => (
                <StickyNote
                  key={note.id}
                  note={note}
                  onUpdate={(id, updates) =>
                    void sticky.updateStickyNote(id, updates)
                  }
                  onDelete={(id) => void sticky.deleteStickyNote(id)}
                />
              ))}
            </div>
          </section>
          {chapterHighlights.length > 0 && (
            <div className="highlight-summary">
              <strong>高亮批注 · {chapterHighlights.length}</strong>
              {chapterHighlights.map((highlight) => {
                const block = library.activeChapter.blocks.find(
                  (item) => item.id === highlight.blockId,
                );
                if (!block) return null;
                return (
                  <button
                    type="button"
                    key={highlight.id}
                    onClick={() => onOpenCitation(block.id, block.locator)}
                  >
                    <HighlighterCircle size={14} />
                    <span>{(block.smartText || block.text).slice(0, 54)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </aside>
  );
});
