import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useLibrary, useNotes } from "../workspace/WorkspaceDomains";

export function ConfirmDialog({
  type,
  onConfirm,
}: {
  type: "note" | "document";
  onConfirm: (id: string) => void;
}) {
  const library = useLibrary();
  const notes = useNotes();
  const isNote = type === "note";
  const open = isNote
    ? notes.pendingDeleteNoteId !== null
    : library.pendingDeleteDocumentId !== null;
  const onOpenChange = (open: boolean) => {
    if (!open) {
      if (isNote) notes.requestNoteDelete(null);
      else library.requestDocumentDelete(null);
    }
  };
  const pendingId = isNote
    ? notes.pendingDeleteNoteId
    : library.pendingDeleteDocumentId;

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="overlay">
          <AlertDialog.Content className="modal confirm-modal">
            <AlertDialog.Title>
              {isNote ? "删除这条笔记？" : "将教材移入回收站？"}
            </AlertDialog.Title>
            <AlertDialog.Description>
              {isNote
                ? "删除后无法从回收站恢复，但不会影响教材和高亮。"
                : "教材、笔记、进度、会话和练习记录会一起保留 30 天，期间可以恢复。"}
            </AlertDialog.Description>
            <div className="modal-actions">
              <AlertDialog.Cancel asChild>
                <button className="secondary-button">取消</button>
              </AlertDialog.Cancel>
              <button
                className="danger-button"
                onClick={() => pendingId && onConfirm(pendingId)}
              >
                {isNote ? "删除笔记" : "移入回收站"}
              </button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Overlay>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
