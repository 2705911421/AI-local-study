import { Component, type ErrorInfo, type ReactNode } from "react";
import { DownloadSimple, WarningCircle } from "@phosphor-icons/react";

interface State {
  error: Error | null;
  details: string;
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

  private exportDiagnostics = () => {
    const content = [
      "知页本地诊断",
      `时间：${new Date().toISOString()}`,
      `浏览器：${navigator.userAgent}`,
      "",
      this.state.details ||
        this.state.error?.stack ||
        this.state.error?.message,
    ].join("\n");
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
          <button onClick={() => location.reload()}>刷新页面</button>
          <button onClick={this.exportDiagnostics}>
            <DownloadSimple size={16} />
            导出诊断
          </button>
        </div>
      </main>
    );
  }
}
