import type { StudyDocument, StudyNote } from "../types";

const DB_NAME = "zhiye-local";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let rejectedAsBlocked = false;
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("documents")) {
        db.createObjectStore("documents", { keyPath: "id" });
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      if (rejectedAsBlocked) {
        request.result.close();
      } else {
        resolve(request.result);
      }
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      rejectedAsBlocked = true;
      reject(new Error("教材数据库正被其他页面占用，请关闭其他页面后重试"));
    };
  });
}

export async function saveDocument(document: StudyDocument): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("documents", "readwrite");
      transaction.objectStore("documents").put(document);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () =>
        reject(transaction.error || new Error("教材保存事务已中止"));
    });
  } finally {
    db.close();
  }
}

export async function loadDocuments(): Promise<StudyDocument[]> {
  const db = await openDb();
  try {
    const documents = await new Promise<StudyDocument[]>((resolve, reject) => {
      const request = db
        .transaction("documents", "readonly")
        .objectStore("documents")
        .getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return documents
      .filter(
        (document) =>
          document &&
          typeof document.id === "string" &&
          Array.isArray(document.chapters) &&
          document.chapters.length > 0,
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  } finally {
    db.close();
  }
}

export function loadNotes(): StudyNote[] {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem("zhiye-notes") || "[]",
    );
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (note): note is StudyNote =>
        typeof note === "object" &&
        note !== null &&
        "id" in note &&
        typeof note.id === "string" &&
        "chapterId" in note &&
        typeof note.chapterId === "string" &&
        "text" in note &&
        typeof note.text === "string" &&
        "createdAt" in note &&
        typeof note.createdAt === "number",
    );
  } catch {
    return [];
  }
}

export function saveNotes(notes: StudyNote[]): void {
  localStorage.setItem("zhiye-notes", JSON.stringify(notes));
}
