import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  CaretDown,
  CaretRight,
  DotsSixVertical,
  Palette,
  Trash,
  X,
} from "@phosphor-icons/react";
import type { StickyNote as StickyNoteType } from "../../types";

interface StickyNoteProps {
  note: StickyNoteType;
  onUpdate: (id: string, updates: Partial<StickyNoteType>) => void;
  onDelete: (id: string) => void;
}

const COLORS = {
  yellow: { bg: "#fef9c3", border: "#facc15", text: "#854d0e" },
  blue: { bg: "#dbeafe", border: "#60a5fa", text: "#1e40af" },
  green: { bg: "#dcfce7", border: "#4ade80", text: "#166534" },
  pink: { bg: "#fce7f3", border: "#f472b6", text: "#9d174d" },
  purple: { bg: "#f3e8ff", border: "#c084fc", text: "#6b21a8" },
} as const;

export const StickyNote = memo(function StickyNote({
  note,
  onUpdate,
  onDelete,
}: StickyNoteProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.text);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [position, setPosition] = useState({ x: note.x, y: note.y });
  const positionRef = useRef(position);
  positionRef.current = position;
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  useEffect(() => {
    if (!dragRef.current) setPosition({ x: note.x, y: note.y });
  }, [note.x, note.y]);

  const color = COLORS[note.color] || COLORS.yellow;

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: note.x,
        origY: note.y,
      };

      const handleDrag = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const dx = ev.clientX - dragRef.current.startX;
        const dy = ev.clientY - dragRef.current.startY;
        setPosition({
          x: Math.max(0, dragRef.current.origX + dx),
          y: Math.max(0, dragRef.current.origY + dy),
        });
      };

      const handleDragEnd = () => {
        if (dragRef.current) {
          onUpdate(note.id, {
            x: positionRef.current.x,
            y: positionRef.current.y,
          });
        }
        dragRef.current = null;
        document.removeEventListener("mousemove", handleDrag);
        document.removeEventListener("mouseup", handleDragEnd);
      };

      document.addEventListener("mousemove", handleDrag);
      document.addEventListener("mouseup", handleDragEnd);
    },
    [note.id, note.x, note.y, onUpdate],
  );

  const handleSave = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== note.text) {
      onUpdate(note.id, { text: trimmed, updatedAt: Date.now() });
    } else {
      setDraft(note.text);
    }
    setEditing(false);
  }, [draft, note.id, note.text, onUpdate]);

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
      className={`sticky-note color-${note.color} ${note.collapsed ? "is-collapsed" : ""}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: note.width ? `${note.width}px` : undefined,
        backgroundColor: color.bg,
        borderColor: color.border,
        color: color.text,
      }}
    >
      <div className="sticky-note-header">
        <button
          type="button"
          className="sticky-note-drag"
          onMouseDown={handleDragStart}
          aria-label="拖拽移动"
          title="拖拽移动"
        >
          <DotsSixVertical size={12} />
        </button>
        <button
          type="button"
          className="sticky-note-toggle"
          onClick={() => onUpdate(note.id, { collapsed: !note.collapsed })}
          aria-label={note.collapsed ? "展开" : "收起"}
        >
          {note.collapsed ? <CaretRight size={12} /> : <CaretDown size={12} />}
        </button>
        <div className="sticky-note-header-actions">
          <div className="sticky-note-color-wrapper">
            <button
              type="button"
              onClick={() => setShowColorPicker(!showColorPicker)}
              aria-label="更改颜色"
              title="更改颜色"
            >
              <Palette size={12} />
            </button>
            {showColorPicker && (
              <div className="sticky-note-color-picker">
                {Object.keys(COLORS).map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`color-swatch color-${c}`}
                    style={{
                      backgroundColor: COLORS[c as keyof typeof COLORS].bg,
                      borderColor: COLORS[c as keyof typeof COLORS].border,
                    }}
                    onClick={() => {
                      onUpdate(note.id, {
                        color: c as StickyNoteType["color"],
                      });
                      setShowColorPicker(false);
                    }}
                    aria-label={c}
                  />
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleDelete}
            aria-label={confirmDelete ? "确认删除" : "删除"}
            title={confirmDelete ? "再次点击确认删除" : "删除"}
            className={confirmDelete ? "is-confirm" : ""}
          >
            {confirmDelete ? <X size={12} /> : <Trash size={12} />}
          </button>
        </div>
      </div>
      {!note.collapsed && (
        <div className="sticky-note-body">
          {editing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleSave();
                }
                if (e.key === "Escape") {
                  setDraft(note.text);
                  setEditing(false);
                }
              }}
              autoFocus
              rows={3}
            />
          ) : (
            <p onClick={() => setEditing(true)} title="点击编辑">
              {note.text || "点击添加内容…"}
            </p>
          )}
        </div>
      )}
    </div>
  );
});
