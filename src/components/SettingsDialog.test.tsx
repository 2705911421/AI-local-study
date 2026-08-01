// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppContextType } from "../AppContext";
import { SettingsDialog } from "./SettingsDialog";

let context: AppContextType;

vi.mock("../AppContext", () => ({
  useAppContext: () => context,
}));

beforeEach(() => {
  context = {
    overlay: "settings",
    setOverlay: vi.fn(),
    config: {
      provider: "ollama",
      endpoint: "http://localhost:11434",
      model: "qwen3:4b",
      apiKey: "",
    },
    setConfig: vi.fn(),
    preferences: {
      theme: "auto",
      fontScale: "medium",
      lineHeight: "comfortable",
      readingWidth: "medium",
    },
    modelOnline: null,
    setModelOnline: vi.fn(),
    modelSupportsVision: false,
    isTestingModel: false,
    modelOptions: [],
    setModelOptions: vi.fn(),
    modelListState: "",
    setModelListState: vi.fn(),
    providerStatuses: [],
  } as unknown as AppContextType;
});

afterEach(cleanup);

function renderDialog(overrides = {}) {
  const props = {
    onTestModel: vi.fn(),
    onFetchModelOptions: vi.fn(),
    onSaveSettings: vi.fn(),
    onChangeAgentLogin: vi.fn(),
    onClearApiKey: vi.fn(async () => true),
    onExportBackup: vi.fn(async () => true),
    onRestoreBackup: vi.fn(async () => true),
    onSavePreferences: vi.fn(),
    ...overrides,
  };
  render(<SettingsDialog {...props} />);
  return props;
}

describe("SettingsDialog", () => {
  it("拒绝弱备份密码且不会调用导出", async () => {
    const props = renderDialog();
    fireEvent.change(screen.getByLabelText("备份密码", { exact: true }), {
      target: { value: "short" },
    });
    fireEvent.change(screen.getByLabelText("确认备份密码"), {
      target: { value: "short" },
    });
    fireEvent.click(screen.getByRole("button", { name: "导出加密备份" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "至少需要 12 个字符",
    );
    expect(props.onExportBackup).not.toHaveBeenCalled();
  });

  it("把阅读主题变更交给偏好保存入口", () => {
    const props = renderDialog();
    fireEvent.change(screen.getByLabelText("主题"), {
      target: { value: "dark" },
    });
    expect(props.onSavePreferences).toHaveBeenCalledWith({
      ...context.preferences,
      theme: "dark",
    });
  });
});
