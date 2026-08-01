// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import axe from "axe-core";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import App from "./App";
import {
  observeWorkspaceRenders,
  type WorkspaceRegion,
} from "./workspace/renderDiagnostics";
import {
  createMemoryStudyRepository,
  type StudyRepository,
} from "./lib/studyRepository";

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.scrollTo = vi.fn();
});

afterEach(cleanup);

describe("Workspace 区域渲染隔离", () => {
  it("聊天下输入不会提交教材侧栏和阅读区", () => {
    const renders: WorkspaceRegion[] = [];
    const stopObserving = observeWorkspaceRenders((region) => renders.push(region));
    const { container } = render(<App />);
    renders.length = 0;

    fireEvent.change(container.querySelector(".chat-input input")!, {
      target: { value: "render isolation" },
    });

    expect(renders).toContain("assistant");
    expect(renders).not.toContain("library");
    expect(renders).not.toContain("reader");
    stopObserving();
  });

  it("章节搜索不会提交伴学区", () => {
    const renders: WorkspaceRegion[] = [];
    const stopObserving = observeWorkspaceRenders((region) => renders.push(region));
    const { container } = render(<App />);
    fireEvent.click(container.querySelector('[data-testid="chapter-search-toggle"]')!);
    const search = container.querySelector("#chapter-search");
    expect(search).toBeTruthy();
    renders.length = 0;

    fireEvent.change(search!, { target: { value: "test" } });

    expect(renders).toContain("reader");
    expect(renders).not.toContain("assistant");
    stopObserving();
  });
});

describe("知页核心用户流程", () => {
  it("章节搜索按钮会打开可用的查找栏", () => {
    render(<App />);

    fireEvent.click(screen.getByTitle("在当前章节中查找"));

    expect(screen.getByPlaceholderText("查找当前章节")).toBeInTheDocument();
  });

  it("演示与 EPUB 类内容不会提供无效的查看原版按钮", () => {
    render(<App />);

    expect(
      screen.queryByRole("button", { name: /查看原版/ }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText(/离散数学学习样章/).length).toBeGreaterThan(0);
  });

  it("导入弹窗具有可访问名称和具名关闭按钮", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /导入教材/ }));

    expect(
      screen.getByRole("dialog", { name: "导入一本教材" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭导入教材窗口" }));
    expect(
      screen.queryByRole("dialog", { name: "导入一本教材" }),
    ).not.toBeInTheDocument();
  });

  it("核心页面没有严重或致命的自动化无障碍问题", async () => {
    render(<App />);

    const result = await axe.run(document.body);
    expect(
      result.violations.filter(
        (violation) =>
          violation.impact === "serious" || violation.impact === "critical",
      ),
    ).toHaveLength(0);
  });

  it("本地保存失败时保留笔记草稿并明确提示", async () => {
    const memory = createMemoryStudyRepository();
    const repository: StudyRepository = {
      ...memory,
      apply: vi.fn(async (command) => {
        if (command.type === "purgeExpiredTrash") {
          return memory.apply(command);
        }
        throw new Error("模拟本地存储失败");
      }),
    };
    const unhandled = vi.fn((event: PromiseRejectionEvent) =>
      event.preventDefault(),
    );
    window.addEventListener("unhandledrejection", unhandled);

    try {
      render(<App studyRepository={repository} />);
      fireEvent.click(
        within(screen.getByLabelText("伴学与笔记")).getByRole("button", {
          name: "笔记",
        }),
      );
      const editor =
        screen.getByPlaceholderText("记录此刻的理解、疑问或待复习内容…");
      fireEvent.change(editor, { target: { value: "需要保留的草稿" } });
      fireEvent.click(screen.getByRole("button", { name: "保存笔记" }));

      expect(
        await screen.findAllByText(/笔记保存失败：浏览器存储不可用或空间不足/),
      ).not.toHaveLength(0);
      expect(editor).toHaveValue("需要保留的草稿");
      expect(screen.queryByText("笔记已保存在本机")).not.toBeInTheDocument();
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("unhandledrejection", unhandled);
    }
  });

  it("删除持久化失败时保留笔记和确认窗口", async () => {
    const memory = createMemoryStudyRepository({
      notes: [
        {
          id: "note-1",
          documentId: "demo-discrete-math",
          chapterId: "demo-c1",
          text: "不能丢失的笔记",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    const repository: StudyRepository = {
      ...memory,
      apply: vi.fn(async (command) => {
        if (command.type === "purgeExpiredTrash") {
          return memory.apply(command);
        }
        throw new Error("模拟本地存储失败");
      }),
    };

    render(<App studyRepository={repository} />);
    fireEvent.click(
      within(screen.getByLabelText("伴学与笔记")).getByRole("button", {
        name: "笔记",
      }),
    );
    expect(await screen.findByText("不能丢失的笔记")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "删除笔记" }));
    const dialog = screen.getByRole("alertdialog", {
      name: "删除这条笔记？",
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "删除笔记" }));

    expect(
      await screen.findByText("笔记删除失败，本地记录未改变"),
    ).toBeInTheDocument();
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("不能丢失的笔记")).toBeInTheDocument();
  });

  it("偏好保存失败时保留当前选择并给出重启风险提示", async () => {
    const memory = createMemoryStudyRepository();
    const repository: StudyRepository = {
      ...memory,
      apply: vi.fn(async (command) => {
        if (command.type === "purgeExpiredTrash") {
          return memory.apply(command);
        }
        throw new Error("模拟本地存储失败");
      }),
    };

    render(<App studyRepository={repository} />);
    await waitFor(() =>
      expect(repository.apply).toHaveBeenCalledWith({
        type: "purgeExpiredTrash",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    const fontScale = screen.getByRole("combobox", { name: "字号" });
    fireEvent.change(fontScale, { target: { value: "large" } });

    expect(
      await screen.findByText(
        "阅读设置已应用，但未能保存；重启后可能恢复原设置",
      ),
    ).toBeInTheDocument();
    expect(fontScale).toHaveValue("large");
  });

  it("练习记录读取失败时不产生未处理 Promise 或打开空练习", async () => {
    const memory = createMemoryStudyRepository();
    const repository: StudyRepository = {
      ...memory,
      loadWorkspace: vi.fn(async () => {
        throw new Error("模拟读取失败");
      }),
    };
    const unhandled = vi.fn((event: PromiseRejectionEvent) =>
      event.preventDefault(),
    );
    window.addEventListener("unhandledrejection", unhandled);

    try {
      render(<App studyRepository={repository} />);
      fireEvent.click(
        screen.getAllByRole("button", { name: "开始章节练习" })[0],
      );

      expect(
        await screen.findByText("练习记录暂时无法读取，请稍后重试"),
      ).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("unhandledrejection", unhandled);
    }
  });

  it("慢速读取聊天记录时不会把占位消息提前写回", async () => {
    const chapter = {
      id: "slow-chapter",
      title: "慢速章节",
      order: 0,
      blocks: [],
    };
    const slowDocument = {
      id: "slow-document",
      title: "慢速教材",
      filename: "slow.epub",
      kind: "epub" as const,
      createdAt: 1,
      chapters: [chapter],
    };
    const memory = createMemoryStudyRepository({
      documents: [slowDocument],
      chatSessions: [
        {
          documentId: slowDocument.id,
          messages: [
            {
              id: "saved-message",
              role: "assistant",
              text: "不能被占位消息覆盖的历史记录",
              status: "direct",
            },
          ],
          updatedAt: 1,
        },
      ],
    });
    let releaseLoad!: () => void;
    const loadGate = new Promise<void>((resolve) => {
      releaseLoad = resolve;
    });
    const apply = vi.fn((command) => memory.apply(command));
    const repository: StudyRepository = {
      ...memory,
      apply,
      loadWorkspace: vi.fn(async () => {
        await loadGate;
        return memory.loadWorkspace();
      }),
    };

    render(<App studyRepository={repository} />);
    const button = await screen.findByRole("button", { name: "慢速教材" });
    apply.mockClear();
    fireEvent.click(button);
    await new Promise((resolve) => window.setTimeout(resolve, 500));

    expect(
      apply.mock.calls.some(([command]) => command.type === "saveChatSession"),
    ).toBe(false);

    releaseLoad();
    expect(
      await screen.findByText("不能被占位消息覆盖的历史记录"),
    ).toBeInTheDocument();
  });

  it("快速切换教材时丢弃较早返回的聊天记录", async () => {
    const chapter = {
      id: "chapter",
      title: "章节",
      order: 0,
      blocks: [],
    };
    const documentA = {
      id: "race-a",
      title: "竞态教材 A",
      filename: "a.epub",
      kind: "epub" as const,
      createdAt: 1,
      chapters: [chapter],
    };
    const documentB = {
      id: "race-b",
      title: "竞态教材 B",
      filename: "b.epub",
      kind: "epub" as const,
      createdAt: 2,
      chapters: [chapter],
    };
    const memory = createMemoryStudyRepository({
      documents: [documentA, documentB],
    });
    const workspace = await memory.loadWorkspace();
    let resolveA!: (value: typeof workspace) => void;
    let resolveB!: (value: typeof workspace) => void;
    const first = new Promise<typeof workspace>((resolve) => {
      resolveA = resolve;
    });
    const second = new Promise<typeof workspace>((resolve) => {
      resolveB = resolve;
    });
    const repository: StudyRepository = {
      ...memory,
      loadWorkspace: vi
        .fn()
        .mockReturnValueOnce(first)
        .mockReturnValueOnce(second),
    };
    render(<App studyRepository={repository} />);

    const buttonA = await screen.findByRole("button", { name: "竞态教材 A" });
    const buttonB = await screen.findByRole("button", { name: "竞态教材 B" });
    fireEvent.click(buttonA);
    fireEvent.click(buttonB);
    resolveB({
      ...workspace,
      chatSessions: [
        {
          documentId: documentB.id,
          messages: [
            {
              id: "b-message",
              role: "assistant",
              text: "只属于教材 B 的对话",
              status: "direct",
            },
          ],
          updatedAt: 2,
        },
      ],
    });
    expect(await screen.findByText("只属于教材 B 的对话")).toBeInTheDocument();
    resolveA({
      ...workspace,
      chatSessions: [
        {
          documentId: documentA.id,
          messages: [
            {
              id: "a-message",
              role: "assistant",
              text: "不应覆盖的教材 A 对话",
              status: "direct",
            },
          ],
          updatedAt: 1,
        },
      ],
    });
    await Promise.resolve();
    expect(screen.queryByText("不应覆盖的教材 A 对话")).not.toBeInTheDocument();
  });
});
