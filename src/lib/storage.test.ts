import { afterEach, describe, expect, it, vi } from "vitest";
import { loadNotes, saveNotes } from "./storage";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("note storage", () => {
  it("filters malformed persisted records", () => {
    vi.stubGlobal("localStorage", {
      getItem: () =>
        JSON.stringify([
          {
            id: "ok",
            chapterId: "chapter",
            text: "note",
            createdAt: 123,
          },
          { id: "broken" },
        ]),
    });

    expect(loadNotes()).toEqual([
      {
        id: "ok",
        chapterId: "chapter",
        text: "note",
        createdAt: 123,
      },
    ]);
  });

  it("falls back to an empty list for unavailable storage", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
    });

    expect(loadNotes()).toEqual([]);
  });

  it("surfaces quota failures to the caller", () => {
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError");
      },
    });

    expect(() => saveNotes([])).toThrow();
  });
});
