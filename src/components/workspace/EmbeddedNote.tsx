import { memo, useCallback, useState } from "react";
import {
  CaretDown,
  CaretRight,
  NotePencil,
  Sparkle,
  Trash,
  PencilSimple,
  X,
} from "@phosphor-icons/react";
import type { StudyNote } from "../../types";

interface EmbeddedNoteProps {
  note: StudyNote;
  onEdit: (note: StudyNote) => void;
  onDelete: (noteId: string) => void;
}

export const EmbeddedNote = memo(function EmbeddedNote({
  note,
  onEdit,
  onDelete,
}: EmbeddedNoteProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = useCallback(() => {
    if (confirmDelete) {
      onDelete(note.id);
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  }, [confirmDelete, note.id, onDelete]);

  return (
    <div
      className={`embedded-note ${collapsed ? "is-collapsed" : ""} ${note.source === "ai-generated" ? "is-ai" : ""}`}
    >
      <div className="embedded-note-header">
        <button
          type="button"
          className="embedded-note-toggle"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "展开笔记" : "收起笔记"}
        >
          {collapsed ? <CaretRight size={12} /> : <CaretDown size={12} />}
          <NotePencil size={13} />
          {note.source === "ai-generated" && (
            <span className="embedded-note-badge">
              <Sparkle size={10} />
              AI
            </span>
          )}
          <span className="embedded-note-time">
            {new Date(note.updatedAt).toLocaleString("zh-CN", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </button>
        <div className="embedded-note-actions">
          <button
            type="button"
            onClick={() => onEdit(note)}
            aria-label="编辑笔记"
            title="编辑笔记"
          >
            <PencilSimple size={12} />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            aria-label={confirmDelete ? "确认删除" : "删除笔记"}
            title={confirmDelete ? "再次点击确认删除" : "删除笔记"}
            className={confirmDelete ? "is-confirm" : ""}
          >
            {confirmDelete ? <X size={12} /> : <Trash size={12} />}
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="embedded-note-body">
          <p>{note.text}</p>
          {note.quote && (
            <blockquote className="embedded-note-quote">
              {note.quote}
            </blockquote>
          )}
        </div>
      )}
    </div>
  );
});
