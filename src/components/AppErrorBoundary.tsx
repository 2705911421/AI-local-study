import { Component, type ErrorInfo, type ReactNode } from "react";
import { DownloadSimple, WarningCircle } from "@phosphor-icons/react";
import type { DesktopDiagnosticsContext } from "../lib/intelligence/types";

interface State {
  error: Error | null;
  details: string;
}

export function redactDiagnosticsText(value: string): string {
  return value
    .replace(/https?:\/\/[^\s)]+/gi, "[redacted-url]")
    .replace(
      /\b(?:sk|key|token|secret)[-_a-z0-9]*\s*[:=]\s*[^\s,;]+/gi,
      "[redacted-secret]",
    )
    .replace(/\b(?:sk-[a-z0-9_-]{8,}|[a-f0-9]{32,})\b/gi, "[redacted-secret]");
}

export function buildDiagnosticsText(
  details: string,
  context?: DesktopDiagnosticsContext,
): string {
  const lines = [
    "知页 Beta 本地诊断",
    `时间：${new Date().toISOString()}`,
    `浏览器：${navigator.userAgent}`,
    `语言：${navigator.language}`,
  ];
  if (context) {
    lines.push(
      `应用版本：${context.appVersion}`,
      `发布渠道：${context.channel}`,
      `系统：${context.platform} ${context.arch}`,
      `应用区域：${context.locale}`,
      `智能来源：${context.provider}`,
      `模型：${context.model || "未设置"}`,
      `连接配置：${context.configured ? "已完成" : "未完成"}`,
      `已保存凭据：${
        Object.entries(context.hasApiKeyByProvider)
          .filter(([, value]) => value)
          .map(([provider]) => provider)
          .join(", ") || "无"
      }`,
    );
  } else {
    lines.push("应用版本：Web 当前页面", "发布渠道：web");
  }
  lines.push("", redactDiagnosticsText(details || "无错误详情"));
  return lines.join("\n");
}

export class AppErrorBoundary extends Component<
  { children: ReactNode },
  State
> {
  state: State = { error: null, details: "" };

  static getDerivedStateFromError(error: Error): State {
    return { error, details: "" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({
      details: `${error.stack || error.message}\n\n${info.componentStack || ""}`,
    });
  }

  private exportDiagnostics = async () => {
    const context = window.zhiyeDesktop
      ? await window.zhiyeDesktop.getDiagnosticsContext().catch(() => undefined)
      : undefined;
    const content = buildDiagnosticsText(
      this.state.details ||
        this.state.error?.stack ||
        this.state.error?.message ||
        "",
      context,
    );
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "知页诊断.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="fatal-error">
        <WarningCircle size={38} />
        <h1>知页遇到了无法恢复的问题</h1>
        <p>
          教材和学习记录仍保存在本机。可以刷新页面重试，或导出不含教材内容的诊断信息。
        </p>
        <div>
          <button type="button" onClick={() => location.reload()}>
            刷新页面
          </button>
          <button type="button" onClick={this.exportDiagnostics}>
            <DownloadSimple size={16} />
            导出诊断
          </button>
        </div>
      </main>
    );
  }
}
