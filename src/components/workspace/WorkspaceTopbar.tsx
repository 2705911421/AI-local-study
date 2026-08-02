import { memo } from "react";
import {
  BookOpen,
  FileArrowUp,
  GearSix,
  ShieldCheck,
} from "@phosphor-icons/react";
import {
  useIntelligence,
  useLibrary,
  useShell,
} from "../../workspace/WorkspaceDomains";
import { markWorkspaceRender } from "../../workspace/renderDiagnostics";

export const WorkspaceTopbar = memo(function WorkspaceTopbar({
  onOpenHome,
}: {
  onOpenHome: () => void;
}) {
  markWorkspaceRender("shell");
  const shell = useShell();
  const { activeDocument } = useLibrary();
  const { config, modelOnline } = useIntelligence();

  return (
    <>
      <header className="topbar">
        <button
          type="button"
          className="mobile-menu"
          onClick={shell.toggleSidebar}
          aria-label="打开教材目录"
        >
          <BookOpen size={21} />
        </button>
        <button
          type="button"
          className="brand"
          onClick={onOpenHome}
          aria-label="返回知页首页"
        >
          <span className="brand-mark" aria-hidden="true">
            <img
              src={`${import.meta.env.BASE_URL}brand/logo-mark.svg`}
              alt=""
            />
          </span>
          <span>
            <strong>知页</strong>
            <small>本地教材伴学</small>
          </span>
        </button>
        <div className="source-scope">
          <ShieldCheck size={17} weight="fill" />
          <span>唯一来源</span>
          <strong>{activeDocument.title}</strong>
        </div>
        <div className="top-actions">
          <span
            className={`model-status ${modelOnline ? "is-online" : ""}`}
            title={
              modelOnline
                ? `已连接 ${
                    config.provider === "codex"
                      ? "Codex"
                      : config.provider === "claude"
                        ? "Claude"
                        : config.model
                  }`
                : "使用原文检索模式"
            }
          >
            <i />
            {modelOnline
              ? config.provider === "ollama"
                ? "本地模型已连接"
                : config.provider === "codex"
                  ? "Codex 已连接"
                  : config.provider === "claude"
                    ? "Claude 已连接"
                    : "外部模型已连接"
              : "原文检索模式"}
          </span>
          <button
            type="button"
            className="icon-button"
            onClick={() => shell.openOverlay("settings")}
            aria-label="设置"
          >
            <GearSix size={20} />
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => shell.openOverlay("upload")}
          >
            <FileArrowUp size={18} />
            导入教材
          </button>
        </div>
      </header>
      {shell.sidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          onClick={shell.closeSidebar}
          aria-label="关闭教材目录"
        />
      )}
    </>
  );
});
