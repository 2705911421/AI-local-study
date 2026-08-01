// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PdfReader } from "./PdfReader";

const renderTask = { promise: Promise.resolve(), cancel: vi.fn() };
const pdfPage = {
  getViewport: ({ scale }: { scale: number }) => ({
    width: 600 * scale,
    height: 800 * scale,
    convertToViewportRectangle: (value: number[]) => value,
  }),
  getTextContent: vi.fn(async () => ({ items: [] })),
  render: vi.fn(() => renderTask),
};
const pdfDocument = {
  numPages: 3,
  getPage: vi.fn(async () => pdfPage),
  destroy: vi.fn(async () => undefined),
};

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: () => ({
    promise: Promise.resolve(pdfDocument),
    destroy: vi.fn(async () => undefined),
  }),
}));

beforeAll(() => {
  class ResizeObserverMock {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe() {
      this.callback([], this as unknown as ResizeObserver);
    }
    disconnect() {}
    unobserve() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => ({}) as CanvasRenderingContext2D,
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

afterEach(cleanup);

const file = {
  arrayBuffer: vi.fn(async () => new ArrayBuffer(8)),
} as unknown as Blob;

function renderReader(overrides = {}) {
  const props = {
    file,
    page: 1,
    blocks: [],
    highlightedBlockId: null,
    selectionMode: false,
    selectedBlockIds: [],
    isEnhancing: false,
    enhanceProgress: "",
    onPageChange: vi.fn(),
    onShowText: vi.fn(),
    onToggleSelection: vi.fn(),
    onSelectionModeChange: vi.fn(),
    onGenerateSelected: vi.fn(),
    visionEnabled: false,
    isExplainingImage: false,
    onExplainPageImage: vi.fn(),
    ...overrides,
  };
  render(<PdfReader {...props} />);
  return props;
}

describe("PdfReader", () => {
  it("加载页数后按边界翻页", async () => {
    const props = renderReader();
    expect(screen.getByRole("button", { name: "上一页" })).toBeDisabled();
    await waitFor(() => expect(screen.getByText("/ 3")).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    expect(props.onPageChange).toHaveBeenCalledWith(2);
  });

  it("选择模式只在有选中段落时允许生成并可取消", () => {
    const props = renderReader({
      selectionMode: true,
      selectedBlockIds: ["block-1"],
    });
    fireEvent.click(screen.getByRole("button", { name: "生成已选 1 段" }));
    fireEvent.click(screen.getByRole("button", { name: "取消内容选择" }));
    expect(props.onGenerateSelected).toHaveBeenCalledOnce();
    expect(props.onSelectionModeChange).toHaveBeenCalledWith(false);
  });
});
