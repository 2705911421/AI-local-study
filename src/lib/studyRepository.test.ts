import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import type { StudyDocument } from "../types";
import { createMemoryStudyRepository } from "./studyRepository";

const documentA: StudyDocument = {
  id: "doc-a",
  title: "教材 A",
  filename: "a.pdf",
  kind: "pdf",
  createdAt: 1,
  chapters: [{ id: "pdf-c1", title: "同名章", order: 0, blocks: [] }],
};

const documentB: StudyDocument = {
  id: "doc-b",
  title: "教材 B",
  filename: "b.pdf",
  kind: "pdf",
  createdAt: 2,
  chapters: [{ id: "pdf-c1", title: "同名章", order: 0, blocks: [] }],
};

describe("StudyRepository", () => {
  it("按教材与章节复合归属隔离笔记", async () => {
    const repository = createMemoryStudyRepository({
      documents: [documentA, documentB],
    });
    await repository.apply({
      type: "saveNote",
      note: {
        id: "note-a",
        documentId: "doc-a",
        chapterId: "pdf-c1",
        text: "只属于 A",
        createdAt: 10,
        updatedAt: 10,
      },
    });

    const workspace = await repository.loadWorkspace();
    expect(
      workspace.notes.filter(
        (note) => note.documentId === "doc-a" && note.chapterId === "pdf-c1",
      ),
    ).toHaveLength(1);
    expect(
      workspace.notes.filter(
        (note) => note.documentId === "doc-b" && note.chapterId === "pdf-c1",
      ),
    ).toHaveLength(0);
  });

  it("教材先进入回收站，超过 30 天后连同关联数据清除", async () => {
    const now = 40 * 24 * 60 * 60 * 1000;
    const repository = createMemoryStudyRepository({
      documents: [documentA],
      notes: [
        {
          id: "note-a",
          documentId: "doc-a",
          chapterId: "pdf-c1",
          text: "待清理",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });

    await repository.apply({
      type: "trashDocument",
      documentId: "doc-a",
      now: 1,
    });
    let workspace = await repository.loadWorkspace();
    expect(workspace.documents[0].deletedAt).toBe(1);
    expect(workspace.notes).toHaveLength(1);

    await repository.apply({ type: "purgeExpiredTrash", now });
    workspace = await repository.loadWorkspace();
    expect(workspace.documents).toHaveLength(0);
    expect(workspace.notes).toHaveLength(0);
  });

  it("无法唯一匹配的旧笔记保留为待归类笔记", async () => {
    const repository = createMemoryStudyRepository({
      documents: [documentA, documentB],
      legacyNotes: [
        {
          id: "legacy",
          chapterId: "pdf-c1",
          text: "不能猜属于哪本书",
          createdAt: 3,
        },
      ],
    });

    const workspace = await repository.loadWorkspace();
    expect(workspace.notes[0]).toMatchObject({
      id: "legacy",
      documentId: null,
      text: "不能猜属于哪本书",
    });
  });

  it("加密完整备份可恢复教材原文件和正文", async () => {
    const password = "a sufficiently long backup password";
    const source = createMemoryStudyRepository({
      documents: [
        {
          ...documentA,
          originalFile: new Blob(["original-pdf"]),
          chapters: [
            {
              id: "pdf-c1",
              title: "同名章",
              order: 0,
              blocks: [
                {
                  id: "block",
                  chapterId: "pdf-c1",
                  text: "备份中的教材正文",
                  locator: "第 1 页",
                },
              ],
            },
          ],
        },
      ],
    });

    const backup = await source.exportBackup(password);
    expect(await backup.text()).not.toContain("备份中的教材正文");

    const target = createMemoryStudyRepository();
    const restored = await target.restoreBackup(backup, {
      passphrase: password,
    });
    expect(restored.documents[0].chapters[0].blocks[0].text).toBe(
      "备份中的教材正文",
    );
    await expect(restored.documents[0].originalFile?.text()).resolves.toBe(
      "original-pdf",
    );
  });

  it("仍可导入旧版未加密 v1 备份", async () => {
    const zip = new JSZip();
    zip.file(
      "manifest.json",
      JSON.stringify({
        version: 1,
        exportedAt: 1,
        workspace: {
          documents: [documentA],
          notes: [],
          highlights: [],
          readingStates: [],
          chatSessions: [],
          quizAttempts: [],
          reviewSchedules: [],
          checkpoints: [],
          preferences: {
            theme: "auto",
            fontScale: "medium",
            lineHeight: "comfortable",
            readingWidth: "medium",
          },
        },
      }),
    );
    const legacy = new Blob([await zip.generateAsync({ type: "arraybuffer" })]);
    const target = createMemoryStudyRepository();
    const restored = await target.restoreBackup(legacy);
    expect(restored.documents[0].id).toBe(documentA.id);
  });

  it("拒绝声明解压尺寸超过上限的备份条目", async () => {
    const zip = new JSZip();
    zip.file("manifest.json", "{}");
    const bytes = new Uint8Array(
      await zip.generateAsync({ type: "arraybuffer", compression: "STORE" }),
    );
    const centralDirectory = findSignature(bytes, [0x50, 0x4b, 0x01, 0x02]);
    new DataView(bytes.buffer).setUint32(
      centralDirectory + 24,
      256 * 1024 * 1024 + 1,
      true,
    );

    await expect(
      createMemoryStudyRepository().restoreBackup(new Blob([bytes])),
    ).rejects.toThrow("超过 256 MB 上限");
  });

  it("合并同内容的独立教材时保留两边的关联记录", async () => {
    const current = createMemoryStudyRepository({
      documents: [{ ...documentA, contentHash: "same-content" }],
      notes: [
        {
          id: "note-a",
          documentId: documentA.id,
          chapterId: documentA.chapters[0].id,
          text: "A 的笔记",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    const incoming = createMemoryStudyRepository({
      documents: [{ ...documentB, contentHash: "same-content" }],
      notes: [
        {
          id: "note-b",
          documentId: documentB.id,
          chapterId: documentB.chapters[0].id,
          text: "B 的笔记",
          createdAt: 2,
          updatedAt: 2,
        },
      ],
    });

    const restored = await current.restoreBackup(
      await incoming.exportPortableBackup(),
      { mode: "merge" },
    );

    expect(restored.documents.map((document) => document.id).sort()).toEqual([
      documentA.id,
      documentB.id,
    ]);
    expect(restored.notes.map((note) => note.documentId).sort()).toEqual([
      documentA.id,
      documentB.id,
    ]);
  });
});

function findSignature(bytes: Uint8Array, signature: number[]): number {
  for (let index = 0; index <= bytes.length - signature.length; index += 1) {
    if (signature.every((value, offset) => bytes[index + offset] === value)) {
      return index;
    }
  }
  throw new Error("ZIP signature not found");
}
