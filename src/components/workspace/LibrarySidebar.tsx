import { memo, useMemo, useState } from "react";
import {
  Archive,
  ArrowRight,
  BookOpen,
  CaretDown,
  CaretRight,
  MagnifyingGlass,
  PencilSimple,
  Target,
  Trash,
} from "@phosphor-icons/react";
import type { Chapter, Section, StudyDocument } from "../../types";
import {
  useLearning,
  useLibrary,
  useReader,
  useShell,
} from "../../workspace/WorkspaceDomains";
import { markWorkspaceRender } from "../../workspace/renderDiagnostics";

interface LibrarySidebarProps {
  visiblePdfPage: number;
  dueReviewCount: number;
  onSelectDocument: (document: StudyDocument) => void;
  onRenameDocument: (document: StudyDocument) => void;
  onRestoreDocument: (documentId: string) => void;
  onEmptyTrash: () => void;
  onSelectChapter: (chapter: Chapter) => void;
  onSelectSection: (chapter: Chapter, section: Section) => void;
  onOpenQuiz: () => void;
}

export const LibrarySidebar = memo(function LibrarySidebar({
  visiblePdfPage,
  dueReviewCount,
  onSelectDocument,
  onRenameDocument,
  onRestoreDocument,
  onEmptyTrash,
  onSelectChapter,
  onSelectSection,
  onOpenQuiz,
}: LibrarySidebarProps) {
  markWorkspaceRender("library");
  const shell = useShell();
  const library = useLibrary();
  const reader = useReader();
  const learning = useLearning();
  const [bookSearch, setBookSearch] = useState("");
  const [bookSort, setBookSort] = useState<"recent" | "name" | "created">(
    "recent",
  );
  const [showTrash, setShowTrash] = useState(false);

  const visibleDocuments = useMemo(() => {
    const normalized = bookSearch.trim().toLocaleLowerCase("zh-CN");
    return [...library.documents]
      .filter(
        (document) =>
          !normalized ||
          `${document.displayTitle || document.title} ${document.filename}`
            .toLocaleLowerCase("zh-CN")
            .includes(normalized),
      )
      .sort((a, b) => {
        if (bookSort === "name") {
          return (a.displayTitle || a.title).localeCompare(
            b.displayTitle || b.title,
            "zh-CN",
          );
        }
        if (bookSort === "created") return b.createdAt - a.createdAt;
        return (
          (b.lastOpenedAt || b.createdAt) - (a.lastOpenedAt || a.createdAt)
        );
      });
  }, [bookSearch, bookSort, library.documents]);
  const documentQuizHistory = useMemo(
    () =>
      learning.quizAttempts.filter(
        (attempt) => attempt.documentId === library.activeDocument.id,
      ),
    [learning.quizAttempts, library.activeDocument.id],
  );
  const dashboard = useMemo(() => {
    const activeSeconds = learning.dailyMetrics
      .filter((item) => item.documentId === library.activeDocument.id)
      .reduce((total, item) => total + item.activeSeconds, 0);
    const scores = documentQuizHistory.flatMap((attempt) =>
      attempt.scores.filter((score): score is number => score !== null),
    );
    const correctCount = scores.filter((score) => score >= 0.65).length;
    return {
      activeMinutes: Math.round(activeSeconds / 60),
      accuracy: scores.length
        ? Math.round((correctCount / scores.length) * 100)
        : 0,
      weakCount: scores.filter((score) => score < 0.35).length,
    };
  }, [documentQuizHistory, learning.dailyMetrics, library.activeDocument.id]);

  return (
    <aside
      className={`library-panel ${shell.sidebarOpen ? "is-open" : ""}`}
      aria-label="教材与目录"
    >
      <div className="panel-kicker">
        <span>我的教材</span>
        <span>{library.documents.length}</span>
      </div>
      <button
        type="button"
        className="book-selector"
        onClick={() => document.getElementById("library-search")?.focus()}
        aria-label="在书库中切换教材"
      >
        <span className="book-spine">
          {library.activeDocument.title.slice(0, 1)}
        </span>
        <span className="book-meta">
          <strong>
            {library.activeDocument.displayTitle || library.activeDocument.title}
          </strong>
          <small>{library.activeDocument.filename}</small>
        </span>
        <CaretDown size={16} />
      </button>

      <div className="library-controls">
        <label className="library-search">
          <MagnifyingGlass size={15} />
          <input
            id="library-search"
            value={bookSearch}
            onChange={(event) => setBookSearch(event.target.value)}
            placeholder="搜索教材"
          />
        </label>
        <select
          aria-label="教材排序"
          value={bookSort}
          onChange={(event) =>
            setBookSort(event.target.value as "recent" | "name" | "created")
          }
        >
          <option value="recent">最近阅读</option>
          <option value="created">最近导入</option>
          <option value="name">按名称</option>
        </select>
      </div>
      <div className="other-books library-list">
        {visibleDocuments.map((document) => (
          <div
            className={`library-book-row ${
              document.id === library.activeDocument.id ? "is-active" : ""
            }`}
            key={document.id}
          >
            <button
              type="button"
              className="library-book-main"
              onClick={() => onSelectDocument(document)}
            >
              <BookOpen size={16} />
              <span>{document.displayTitle || document.title}</span>
            </button>
            {document.kind !== "demo" && (
              <span className="library-book-actions">
                <button
                  type="button"
                  onClick={() => onRenameDocument(document)}
                  aria-label={`重命名${document.displayTitle || document.title}`}
                >
                  <PencilSimple size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => library.requestDocumentDelete(document.id)}
                  aria-label={`删除${document.displayTitle || document.title}`}
                >
                  <Trash size={14} />
                </button>
              </span>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="trash-toggle"
        onClick={() => setShowTrash((visible) => !visible)}
      >
        <Archive size={15} />
        回收站
        <span>{library.trashedDocuments.length}</span>
      </button>
      {showTrash && (
        <div className="trash-list">
          {library.trashedDocuments.length ? (
            <>
              {library.trashedDocuments.map((document) => (
                <div key={document.id}>
                  <span>{document.displayTitle || document.title}</span>
                  <button
                    type="button"
                    onClick={() => onRestoreDocument(document.id)}
                  >
                    恢复
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="empty-trash"
                onClick={() => {
                  if (window.confirm("永久删除回收站中的教材和学习记录？")) {
                    onEmptyTrash();
                  }
                }}
              >
                清空回收站
              </button>
            </>
          ) : (
            <span className="trash-empty">回收站为空</span>
          )}
        </div>
      )}
      {library.storageUsage && (
        <div className="storage-usage">
          <span>本机存储</span>
          <strong>{library.storageUsage}</strong>
        </div>
      )}

      <nav className="chapter-nav" aria-label="教材目录">
        <div className="nav-label">目录</div>
        {library.activeDocument.chapters.map((chapter, index) => {
          const isActive = chapter.id === library.activeChapter.id;
          return (
            <div className="chapter-entry" key={chapter.id}>
              <button
                type="button"
                className={isActive ? "active" : ""}
                onClick={() => onSelectChapter(chapter)}
              >
                <span className="chapter-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{chapter.title.replace(/^第.+?[章节篇]\s*/, "")}</span>
                {isActive && <CaretRight size={14} />}
              </button>
              {isActive && Boolean(chapter.sections?.length) && (
                <div
                  className="chapter-sections"
                  aria-label={`${chapter.title}小节`}
                >
                  {chapter.sections?.map((section) => (
                    <button
                      type="button"
                      key={section.id}
                      className={
                        visiblePdfPage === section.page ? "section-active" : ""
                      }
                      onClick={() => onSelectSection(chapter, section)}
                    >
                      <span>{section.title}</span>
                      <small>第 {section.page} 页</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="study-plan">
        <div className="plan-title">
          <Target size={18} />
          <strong>本章学习</strong>
        </div>
        <div className="plan-row">
          <span>阅读进度</span>
          <strong>{reader.furthestPercent}%</strong>
        </div>
        <div className="progress-track">
          <span style={{ width: `${reader.furthestPercent}%` }} />
        </div>
        <div className="study-history">
          <span>练习记录 {documentQuizHistory.length}</span>
          <span className={dueReviewCount ? "has-due" : ""}>
            待复习 {dueReviewCount}
          </span>
        </div>
        <div className="learning-dashboard" aria-label="本章学习数据">
          <span>
            <strong>{dashboard.activeMinutes}</strong>
            学习分钟
          </span>
          <span>
            <strong>{dashboard.accuracy}%</strong>
            答题正确
          </span>
          <span>
            <strong>{dashboard.weakCount}</strong>
            薄弱题目
          </span>
        </div>
        <button type="button" onClick={onOpenQuiz} aria-label="开始章节练习（底部）">
          开始章节练习
          <ArrowRight size={15} />
        </button>
        <button
          type="button"
          className="review-start"
          onClick={() => shell.openOverlay("review")}
          disabled={!dueReviewCount}
          aria-label={`开始今日复习，共 ${dueReviewCount} 项`}
        >
          今日复习
          <span>{dueReviewCount}</span>
        </button>
      </div>
    </aside>
  );
});
