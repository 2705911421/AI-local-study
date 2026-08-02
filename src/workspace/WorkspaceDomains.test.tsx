// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  useAssistant,
  useIntelligence,
  useLearning,
  useLibrary,
  useNotes,
  usePreferences,
  useReader,
  useShell,
} from "./WorkspaceDomains";

afterEach(cleanup);

function HookProbe({ hook }: { hook: () => unknown }) {
  hook();
  return null;
}

describe("Workspace domain hooks", () => {
  it.each([
    ["useShell", useShell],
    ["useLibrary", useLibrary],
    ["useReader", useReader],
    ["useAssistant", useAssistant],
    ["useNotes", useNotes],
    ["useLearning", useLearning],
    ["useIntelligence", useIntelligence],
    ["usePreferences", usePreferences],
  ])("%s 在 WorkspaceProvider 外给出明确错误", (name, hook) => {
    expect(() => render(<HookProbe hook={hook} />)).toThrow(
      `${name} must be used within WorkspaceProvider`,
    );
  });
});
