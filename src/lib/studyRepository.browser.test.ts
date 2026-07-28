import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { StudyDocument } from "../types";
import { createBrowserStudyRepository } from "./studyRepository";

const document: StudyDocument = {
  id: "browser-doc",
  title: "浏览器教材",
  filename: "browser.pdf",
  kind: "pdf",
  createdAt: 1,
  chapters: [{ id: "chapter", title: "章节", order: 0, blocks: [] }],
};

async function deleteDatabase() {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("zhiye-local");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("database deletion blocked"));
  });
}

describe("browser StudyRepository", () => {
  beforeEach(deleteDatabase);
  afterEach(deleteDatabase);

  it("persists a restored document across repository instances", async () => {
    const first = createBrowserStudyRepository();
    await first.apply({ type: "saveDocument", document });
    await first.apply({ type: "trashDocument", documentId: document.id });
    await first.apply({ type: "restoreDocument", documentId: document.id });

    const reopened = createBrowserStudyRepository();
    const workspace = await reopened.loadWorkspace();
    expect(workspace.documents).toHaveLength(1);
    expect(workspace.documents[0].deletedAt).toBeUndefined();
  });
});
