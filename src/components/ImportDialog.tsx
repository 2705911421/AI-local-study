import * as Dialog from "@radix-ui/react-dialog";
import { FileArrowUp, ShieldCheck, BookOpen, Check, X } from "@phosphor-icons/react";
import { IMPORT_LIMITS } from "../lib/document";
import { useAppContext } from "../AppContext";

export function ImportDialog({
  onFile,
}: {
  onFile: (file?: File) => void;
}) {
  const ctx = useAppContext();
  const { importState, importError, importProgress, importWithOcr } = ctx;

  return (
    <Dialog.Root
      open={ctx.overlay === "upload"}
      onOpenChange={(open) => {
        if (!open && importState !== "parsing") ctx.setOverlay(null);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="overlay">
          <Dialog.Content className="modal upload-modal">
            <Dialog.Close asChild>
              <button className="modal-close" aria-label="关闭导入教材窗口">
                <X size={19} />
              </button>
            </Dialog.Close>
            <span className="modal-icon">
              <FileArrowUp size={28} />
            </span>
            <Dialog.Title>导入一本教材</Dialog.Title>
            <Dialog.Description>
              文件只在这台设备中解析和保存，不会上传到网络。导入后，它将成为当前学习会话的唯一参考来源。
            </Dialog.Description>
            <div className="import-limits">
              <span>
                PDF 最大 {Math.round(IMPORT_LIMITS.pdfBytes / 1024 / 1024)} MB{" "}
                · {IMPORT_LIMITS.pdfPages} 页
              </span>
              <span>
                EPUB 最大 {Math.round(IMPORT_LIMITS.epubBytes / 1024 / 1024)} MB
              </span>
            </div>
            <input
              id="textbook-file"
              className="native-file-input"
              type="file"
              accept=".pdf,.epub,application/pdf,application/epub+zip"
              onChange={(event) => onFile(event.target.files?.[0])}
            />
            <div
              className={`dropzone ${importState}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                onFile(event.dataTransfer.files[0]);
              }}
            >
              {importState === "parsing" ? (
                <>
                  <span className="parse-lines">
                    <i />
                    <i />
                    <i />
                  </span>
                  <strong>
                    {importProgress?.message || "正在解析章节与正文"}
                  </strong>
                  <small>
                    {importProgress?.completed !== undefined &&
                    importProgress.total
                      ? `${Math.round(importProgress.completed)} / ${importProgress.total}`
                      : "大文件可能需要一些时间"}
                  </small>
                  <button
                    className="cancel-import"
                    onClick={() =>
                      ctx.importControllerRef.current?.abort()
                    }
                  >
                    取消导入
                  </button>
                </>
              ) : importState === "done" ? (
                <>
                  <Check size={30} weight="bold" />
                  <strong>教材已保存到本机</strong>
                </>
              ) : (
                <>
                  <BookOpen size={32} />
                  <strong>导入 PDF 或 EPUB 教材</strong>
                  <label
                    className="file-picker-button"
                    htmlFor="textbook-file"
                  >
                    从电脑选择文件
                  </label>
                  <small>也可以将文件拖放到这个区域</small>
                </>
              )}
            </div>
            {importError && (
              <div className="import-error">{importError}</div>
            )}
            <label className="ocr-option">
              <input
                type="checkbox"
                checked={importWithOcr}
                onChange={(event) =>
                  ctx.setImportWithOcr(event.target.checked)
                }
                disabled={importState === "parsing"}
              />
              <span>
                扫描版 PDF 启用本地 OCR
                <small>
                  首次使用会下载并缓存中英文识别模型，页面不会上传
                </small>
              </span>
            </label>
            <div className="privacy-row">
              <ShieldCheck size={18} weight="fill" />
              <span>本地解析 · 本地索引 · 本地保存</span>
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
