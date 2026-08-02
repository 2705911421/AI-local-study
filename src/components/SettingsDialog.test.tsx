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
import App from "../App";
import {
  createMemoryStudyRepository,
  type StudyRepository,
} from "../lib/studyRepository";

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.scrollTo = vi.fn();
});

afterEach(cleanup);

describe("设置流程", () => {
  it("拒绝弱备份密码且不会导出备份", async () => {
    const memory = createMemoryStudyRepository();
    const exportBackup = vi.fn(memory.exportPortableBackup);
    const repository: StudyRepository = {
      ...memory,
      exportPortableBackup: exportBackup,
    };
    render(<App studyRepository={repository} />);

    fireEvent.click(screen.getByRole("button", { name: "设置" }));
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
    expect(exportBackup).not.toHaveBeenCalled();
  });

  it("通过工作区接口保存阅读主题", async () => {
    const memory = createMemoryStudyRepository();
    const apply = vi.fn(memory.apply);
    const repository: StudyRepository = { ...memory, apply };
    render(<App studyRepository={repository} />);

    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    fireEvent.change(screen.getByLabelText("主题"), {
      target: { value: "dark" },
    });

    await waitFor(() =>
      expect(apply).toHaveBeenCalledWith({
        type: "savePreferences",
        preferences: expect.objectContaining({ theme: "dark" }),
      }),
    );
  });
});
