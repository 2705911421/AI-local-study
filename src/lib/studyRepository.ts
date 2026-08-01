import type {
  ChatSession,
  DailyStudyMetric,
  EnhancementJob,
  Highlight,
  ImportCheckpoint,
  QuizAttempt,
  ReadingState,
  ReviewSchedule,
  StudyDocument,
  StudyNote,
  UserPreferences,
} from "../types";
import {
  decryptBackupPayload,
  encryptBackupPayload,
  inspectBackupFormat,
  MAX_BACKUP_PAYLOAD_BYTES,
} from "./backupCrypto";

const DB_NAME = "zhiye-local";
const DB_VERSION = 4;
const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const STORES = [
  "documents",
  "notes",
  "highlights",
  "readingStates",
  "chatSessions",
  "quizAttempts",
  "reviewSchedules",
  "checkpoints",
  "dailyMetrics",
  "enhancementJobs",
  "preferences",
] as const;

type StoreName = (typeof STORES)[number];

export interface WorkspaceSnapshot {
  documents: StudyDocument[];
  notes: StudyNote[];
  highlights: Highlight[];
  readingStates: ReadingState[];
  chatSessions: ChatSession[];
  quizAttempts: QuizAttempt[];
  reviewSchedules: ReviewSchedule[];
  checkpoints: ImportCheckpoint[];
  dailyMetrics: DailyStudyMetric[];
  enhancementJobs: EnhancementJob[];
  preferences: UserPreferences;
}

export type StudyCommand =
  | { type: "saveDocument"; document: StudyDocument }
  | {
      type: "renameDocument";
      documentId: string;
      displayTitle: string;
      now?: number;
    }
  | { type: "trashDocument"; documentId: string; now?: number }
  | { type: "restoreDocument"; documentId: string; now?: number }
  | { type: "purgeExpiredTrash"; now?: number }
  | { type: "emptyTrash" }
  | { type: "saveNote"; note: StudyNote }
  | { type: "deleteNote"; noteId: string }
  | { type: "saveHighlight"; highlight: Highlight }
  | { type: "deleteHighlight"; highlightId: string }
  | { type: "saveReadingState"; readingState: ReadingState }
  | { type: "saveChatSession"; chatSession: ChatSession }
  | { type: "saveQuizAttempt"; quizAttempt: QuizAttempt }
  | { type: "saveReviewSchedule"; reviewSchedule: ReviewSchedule }
  | { type: "saveCheckpoint"; checkpoint: ImportCheckpoint }
  | { type: "deleteCheckpoint"; checkpointId: string }
  | { type: "saveDailyMetric"; metric: DailyStudyMetric }
  | { type: "saveEnhancementJob"; job: EnhancementJob }
  | { type: "deleteEnhancementJob"; jobId: string }
  | { type: "savePreferences"; preferences: UserPreferences };

export interface StudyRepository {
  loadWorkspace(): Promise<WorkspaceSnapshot>;
  apply(command: StudyCommand): Promise<WorkspaceSnapshot>;
  exportPortableBackup(): Promise<Blob>;
  exportBackup(passphrase: string): Promise<Blob>;
  restoreBackup(
    backup: Blob,
    options?: { passphrase?: string; mode?: "replace" | "merge" },
  ): Promise<WorkspaceSnapshot>;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "auto",
  fontScale: "medium",
  lineHeight: "comfortable",
  readingWidth: "medium",
  semanticSearchEnabled: true,
  batchConcurrency: 2,
  batchRequestsPerMinute: 30,
  inputPricePerMillion: 0,
  outputPricePerMillion: 0,
};

interface LegacyNote {
  id: string;
  chapterId: string;
  text: string;
  createdAt: number;
}

interface Seed {
  documents?: StudyDocument[];
  notes?: StudyNote[];
  highlights?: Highlight[];
  readingStates?: ReadingState[];
  chatSessions?: ChatSession[];
  quizAttempts?: QuizAttempt[];
  reviewSchedules?: ReviewSchedule[];
  checkpoints?: ImportCheckpoint[];
  dailyMetrics?: DailyStudyMetric[];
  enhancementJobs?: EnhancementJob[];
  preferences?: UserPreferences;
  legacyNotes?: LegacyNote[];
}

function normalizeDocument(document: StudyDocument): StudyDocument {
  return {
    ...document,
    displayTitle: document.displayTitle || document.title,
    updatedAt: document.updatedAt || document.createdAt,
    lastOpenedAt: document.lastOpenedAt || document.createdAt,
  };
}

function normalizeReviewSchedule(schedule: ReviewSchedule): ReviewSchedule {
  const legacyIntervals = [1, 3, 7, 14, 30];
  const intervalDays =
    schedule.intervalDays ??
    legacyIntervals[
      Math.min(schedule.intervalIndex ?? 0, legacyIntervals.length - 1)
    ];
  return {
    ...schedule,
    intervalDays,
    easeFactor: schedule.easeFactor ?? 2.5,
    repetitions:
      schedule.repetitions ?? Math.max(0, schedule.intervalIndex ?? 0),
    lapses: schedule.lapses ?? 0,
  };
}

export function migrateLegacyNotes(
  legacyNotes: LegacyNote[],
  documents: StudyDocument[],
): StudyNote[] {
  return legacyNotes.map((note) => {
    const matches = documents.filter((document) =>
      document.chapters.some((chapter) => chapter.id === note.chapterId),
    );
    return {
      ...note,
      documentId: matches.length === 1 ? matches[0].id : null,
      updatedAt: note.createdAt,
    };
  });
}

function createSnapshot(seed: Seed = {}): WorkspaceSnapshot {
  const documents = (seed.documents || []).map(normalizeDocument);
  return {
    documents,
    notes: [
      ...(seed.notes || []),
      ...migrateLegacyNotes(seed.legacyNotes || [], documents),
    ],
    highlights: seed.highlights || [],
    readingStates: seed.readingStates || [],
    chatSessions: seed.chatSessions || [],
    quizAttempts: seed.quizAttempts || [],
    reviewSchedules: (seed.reviewSchedules || []).map(normalizeReviewSchedule),
    checkpoints: seed.checkpoints || [],
    dailyMetrics: seed.dailyMetrics || [],
    enhancementJobs: seed.enhancementJobs || [],
    preferences: { ...DEFAULT_PREFERENCES, ...(seed.preferences || {}) },
  };
}

function recordsForDocument(snapshot: WorkspaceSnapshot, documentId: string) {
  snapshot.notes = snapshot.notes.filter(
    (item) => item.documentId !== documentId,
  );
  snapshot.highlights = snapshot.highlights.filter(
    (item) => item.documentId !== documentId,
  );
  snapshot.readingStates = snapshot.readingStates.filter(
    (item) => item.documentId !== documentId,
  );
  snapshot.chatSessions = snapshot.chatSessions.filter(
    (item) => item.documentId !== documentId,
  );
  snapshot.quizAttempts = snapshot.quizAttempts.filter(
    (item) => item.documentId !== documentId,
  );
  snapshot.reviewSchedules = snapshot.reviewSchedules.filter(
    (item) => item.documentId !== documentId,
  );
  snapshot.dailyMetrics = snapshot.dailyMetrics.filter(
    (item) => item.documentId !== documentId,
  );
  snapshot.enhancementJobs = snapshot.enhancementJobs.filter(
    (item) => item.documentId !== documentId,
  );
}

function upsert<T>(items: T[], item: T, getKey: (value: T) => string): T[] {
  const key = getKey(item);
  return [item, ...items.filter((value) => getKey(value) !== key)];
}

function applyToSnapshot(
  current: WorkspaceSnapshot,
  command: StudyCommand,
): WorkspaceSnapshot {
  const snapshot: WorkspaceSnapshot = structuredClone(current);
  const now = "now" in command ? command.now || Date.now() : Date.now();
  switch (command.type) {
    case "saveDocument":
      snapshot.documents = upsert(
        snapshot.documents,
        normalizeDocument(command.document),
        (item) => item.id,
      );
      break;
    case "renameDocument":
      snapshot.documents = snapshot.documents.map((document) =>
        document.id === command.documentId
          ? {
              ...document,
              displayTitle: command.displayTitle.trim(),
              updatedAt: now,
            }
          : document,
      );
      break;
    case "trashDocument":
      snapshot.documents = snapshot.documents.map((document) =>
        document.id === command.documentId
          ? { ...document, deletedAt: now, updatedAt: now }
          : document,
      );
      break;
    case "restoreDocument":
      snapshot.documents = snapshot.documents.map((document) => {
        if (document.id !== command.documentId) return document;
        const restored = { ...document, updatedAt: now };
        delete restored.deletedAt;
        return restored;
      });
      break;
    case "purgeExpiredTrash": {
      const expiredIds = snapshot.documents
        .filter(
          (document) =>
            document.deletedAt !== undefined &&
            now - document.deletedAt >= TRASH_RETENTION_MS,
        )
        .map((document) => document.id);
      snapshot.documents = snapshot.documents.filter(
        (document) => !expiredIds.includes(document.id),
      );
      expiredIds.forEach((id) => recordsForDocument(snapshot, id));
      break;
    }
    case "emptyTrash": {
      const ids = snapshot.documents
        .filter((document) => document.deletedAt !== undefined)
        .map((document) => document.id);
      snapshot.documents = snapshot.documents.filter(
        (document) => document.deletedAt === undefined,
      );
      ids.forEach((id) => recordsForDocument(snapshot, id));
      break;
    }
    case "saveNote":
      snapshot.notes = upsert(snapshot.notes, command.note, (item) => item.id);
      break;
    case "deleteNote":
      snapshot.notes = snapshot.notes.filter(
        (item) => item.id !== command.noteId,
      );
      break;
    case "saveHighlight":
      snapshot.highlights = upsert(
        snapshot.highlights,
        command.highlight,
        (item) => item.id,
      );
      break;
    case "deleteHighlight":
      snapshot.highlights = snapshot.highlights.filter(
        (item) => item.id !== command.highlightId,
      );
      break;
    case "saveReadingState":
      snapshot.readingStates = upsert(
        snapshot.readingStates,
        command.readingState,
        (item) => item.documentId,
      );
      break;
    case "saveChatSession":
      snapshot.chatSessions = upsert(
        snapshot.chatSessions,
        command.chatSession,
        (item) => item.documentId,
      );
      break;
    case "saveQuizAttempt":
      snapshot.quizAttempts = upsert(
        snapshot.quizAttempts,
        command.quizAttempt,
        (item) => item.id,
      );
      break;
    case "saveReviewSchedule":
      snapshot.reviewSchedules = upsert(
        snapshot.reviewSchedules,
        normalizeReviewSchedule(command.reviewSchedule),
        (item) => item.id,
      );
      break;
    case "saveCheckpoint":
      snapshot.checkpoints = upsert(
        snapshot.checkpoints,
        command.checkpoint,
        (item) => item.id,
      );
      break;
    case "deleteCheckpoint":
      snapshot.checkpoints = snapshot.checkpoints.filter(
        (item) => item.id !== command.checkpointId,
      );
      break;
    case "saveDailyMetric":
      snapshot.dailyMetrics = upsert(
        snapshot.dailyMetrics,
        command.metric,
        (item) => item.id,
      );
      break;
    case "saveEnhancementJob":
      snapshot.enhancementJobs = upsert(
        snapshot.enhancementJobs,
        command.job,
        (item) => item.id,
      );
      break;
    case "deleteEnhancementJob":
      snapshot.enhancementJobs = snapshot.enhancementJobs.filter(
        (item) => item.id !== command.jobId,
      );
      break;
    case "savePreferences":
      snapshot.preferences = command.preferences;
      break;
  }
  return snapshot;
}

interface BackupManifest {
  version: 1 | 2;
  exportedAt: number;
  workspace: Omit<WorkspaceSnapshot, "documents"> & {
    documents: Array<Omit<StudyDocument, "originalFile">>;
  };
}

async function exportSnapshot(snapshot: WorkspaceSnapshot): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const documents = snapshot.documents.map(
    ({ originalFile: _originalFile, ...document }) => document,
  );
  const manifest: BackupManifest = {
    version: 2,
    exportedAt: Date.now(),
    workspace: { ...snapshot, documents },
  };
  const manifestJson = JSON.stringify(manifest, null, 2);
  const estimatedPayloadBytes =
    new TextEncoder().encode(manifestJson).byteLength +
    snapshot.documents.reduce(
      (total, document) => total + (document.originalFile?.size || 0),
      0,
    );
  if (estimatedPayloadBytes > MAX_BACKUP_PAYLOAD_BYTES) {
    throw new Error("完整备份超过 256 MB 上限，请减少教材后重试");
  }
  await Promise.all(
    snapshot.documents.map(async (document) => {
      if (!document.originalFile) return;
      zip.file(
        `documents/${document.id}.bin`,
        await document.originalFile.arrayBuffer(),
      );
    }),
  );
  zip.file("manifest.json", manifestJson);
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

async function importSnapshot(blob: Blob): Promise<WorkspaceSnapshot> {
  if (blob.size > MAX_BACKUP_PAYLOAD_BYTES) {
    throw new Error("完整备份超过 256 MB 上限");
  }
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) throw new Error("备份缺少 manifest.json");
  const manifest = JSON.parse(
    await manifestFile.async("string"),
  ) as BackupManifest;
  if (
    ![1, 2].includes(manifest.version) ||
    !Array.isArray(manifest.workspace.documents)
  ) {
    throw new Error("不支持的知页备份版本");
  }
  const documents = await Promise.all(
    manifest.workspace.documents.map(async (document) => {
      const file = zip.file(`documents/${document.id}.bin`);
      return {
        ...document,
        originalFile: file
          ? new Blob([await file.async("arraybuffer")])
          : undefined,
      } as StudyDocument;
    }),
  );
  return createSnapshot({ ...manifest.workspace, documents });
}

function newestById<T extends { id: string; updatedAt?: number }>(
  current: T[],
  incoming: T[],
): T[] {
  const merged = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) {
    const previous = merged.get(item.id);
    if (!previous || (item.updatedAt || 0) >= (previous.updatedAt || 0)) {
      merged.set(item.id, item);
    }
  }
  return [...merged.values()];
}

function mergeSnapshots(
  current: WorkspaceSnapshot,
  incoming: WorkspaceSnapshot,
): WorkspaceSnapshot {
  const documents = [...current.documents];
  for (const document of incoming.documents) {
    const duplicateIndex = documents.findIndex(
      (candidate) =>
        candidate.id === document.id ||
        (candidate.contentHash &&
          document.contentHash &&
          candidate.contentHash === document.contentHash),
    );
    if (duplicateIndex < 0) {
      documents.push(document);
    } else if (
      (document.updatedAt || document.createdAt) >=
      (documents[duplicateIndex].updatedAt ||
        documents[duplicateIndex].createdAt)
    ) {
      documents[duplicateIndex] = document;
    }
  }
  return createSnapshot({
    documents,
    notes: newestById(current.notes, incoming.notes),
    highlights: newestById(current.highlights, incoming.highlights),
    readingStates: newestById(
      current.readingStates.map((item) => ({ ...item, id: item.documentId })),
      incoming.readingStates.map((item) => ({ ...item, id: item.documentId })),
    ).map(({ id: _id, ...item }) => item),
    chatSessions: newestById(
      current.chatSessions.map((item) => ({ ...item, id: item.documentId })),
      incoming.chatSessions.map((item) => ({ ...item, id: item.documentId })),
    ).map(({ id: _id, ...item }) => item),
    quizAttempts: newestById(current.quizAttempts, incoming.quizAttempts),
    reviewSchedules: newestById(
      current.reviewSchedules,
      incoming.reviewSchedules,
    ),
    checkpoints: newestById(current.checkpoints, incoming.checkpoints),
    dailyMetrics: newestById(current.dailyMetrics, incoming.dailyMetrics),
    enhancementJobs: newestById(
      current.enhancementJobs,
      incoming.enhancementJobs,
    ),
    preferences:
      incoming.preferences || current.preferences || DEFAULT_PREFERENCES,
  });
}

async function decodeBackup(
  backup: Blob,
  passphrase = "",
): Promise<WorkspaceSnapshot> {
  const format = await inspectBackupFormat(backup);
  const payload =
    format === "encrypted-v2"
      ? await decryptBackupPayload(backup, passphrase)
      : backup;
  return importSnapshot(payload);
}

export function createMemoryStudyRepository(seed: Seed = {}): StudyRepository {
  let snapshot = createSnapshot(seed);
  return {
    async loadWorkspace() {
      return structuredClone(snapshot);
    },
    async apply(command) {
      snapshot = applyToSnapshot(snapshot, command);
      return structuredClone(snapshot);
    },
    async exportBackup(passphrase) {
      return encryptBackupPayload(await exportSnapshot(snapshot), passphrase);
    },
    async exportPortableBackup() {
      return exportSnapshot(snapshot);
    },
    async restoreBackup(backup, options = {}) {
      const incoming = await decodeBackup(backup, options.passphrase);
      snapshot =
        options.mode === "merge"
          ? mergeSnapshots(snapshot, incoming)
          : incoming;
      return structuredClone(snapshot);
    },
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORES) {
        if (db.objectStoreNames.contains(name)) continue;
        const keyPath =
          name === "readingStates" || name === "chatSessions"
            ? "documentId"
            : name === "preferences"
              ? "id"
              : "id";
        db.createObjectStore(name, { keyPath });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("本地数据库正被其他页面占用，请关闭其他知页页面后重试"));
  });
}

async function readAll<T>(db: IDBDatabase, store: StoreName): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(store, "readonly")
      .objectStore(store)
      .getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

async function loadBrowserSnapshot(
  db: IDBDatabase,
): Promise<WorkspaceSnapshot> {
  const [
    documents,
    notes,
    highlights,
    readingStates,
    chatSessions,
    quizAttempts,
    reviewSchedules,
    checkpoints,
    dailyMetrics,
    enhancementJobs,
    preferencesRecords,
  ] = await Promise.all([
    readAll<StudyDocument>(db, "documents"),
    readAll<StudyNote>(db, "notes"),
    readAll<Highlight>(db, "highlights"),
    readAll<ReadingState>(db, "readingStates"),
    readAll<ChatSession>(db, "chatSessions"),
    readAll<QuizAttempt>(db, "quizAttempts"),
    readAll<ReviewSchedule>(db, "reviewSchedules"),
    readAll<ImportCheckpoint>(db, "checkpoints"),
    readAll<DailyStudyMetric>(db, "dailyMetrics"),
    readAll<EnhancementJob>(db, "enhancementJobs"),
    readAll<UserPreferences & { id: string }>(db, "preferences"),
  ]);
  return createSnapshot({
    documents,
    notes,
    highlights,
    readingStates,
    chatSessions,
    quizAttempts,
    reviewSchedules,
    checkpoints,
    dailyMetrics,
    enhancementJobs,
    preferences: preferencesRecords[0] || DEFAULT_PREFERENCES,
  });
}

/** Incrementally apply a command to IndexedDB — only touches affected stores. */
async function persistIncremental(
  db: IDBDatabase,
  snapshot: WorkspaceSnapshot,
  command: StudyCommand,
) {
  // Commands that remove documents cascade across all stores; fall back to full persist.
  const needsFullPersist =
    command.type === "purgeExpiredTrash" || command.type === "emptyTrash";

  if (needsFullPersist) {
    await persistSnapshot(db, snapshot);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    // Determine which stores need writing.
    const storeWrites = new Map<StoreName, unknown[]>();
    const storeDeletes = new Map<StoreName, string[]>();
    const storeClears = new Set<StoreName>();

    switch (command.type) {
      case "saveDocument":
        storeWrites.set("documents", [normalizeDocument(command.document)]);
        break;
      case "renameDocument":
      case "trashDocument":
      case "restoreDocument": {
        // These mutate documents in-place; need full documents store.
        storeWrites.set("documents", snapshot.documents);
        break;
      }
      case "saveNote":
        storeWrites.set("notes", [command.note]);
        break;
      case "deleteNote":
        storeDeletes.set("notes", [command.noteId]);
        break;
      case "saveHighlight":
        storeWrites.set("highlights", [command.highlight]);
        break;
      case "deleteHighlight":
        storeDeletes.set("highlights", [command.highlightId]);
        break;
      case "saveReadingState":
        storeWrites.set("readingStates", [command.readingState]);
        break;
      case "saveChatSession":
        storeWrites.set("chatSessions", [command.chatSession]);
        break;
      case "saveQuizAttempt":
        storeWrites.set("quizAttempts", [command.quizAttempt]);
        break;
      case "saveReviewSchedule":
        storeWrites.set("reviewSchedules", [command.reviewSchedule]);
        break;
      case "saveCheckpoint":
        storeWrites.set("checkpoints", [command.checkpoint]);
        break;
      case "deleteCheckpoint":
        storeDeletes.set("checkpoints", [command.checkpointId]);
        break;
      case "saveDailyMetric":
        storeWrites.set("dailyMetrics", [command.metric]);
        break;
      case "saveEnhancementJob":
        storeWrites.set("enhancementJobs", [command.job]);
        break;
      case "deleteEnhancementJob":
        storeDeletes.set("enhancementJobs", [command.jobId]);
        break;
      case "savePreferences":
        storeWrites.set("preferences", [
          { id: "user", ...command.preferences },
        ]);
        break;
    }

    const involvedStores = [
      ...new Set([...storeWrites.keys(), ...storeDeletes.keys()]),
    ];
    if (involvedStores.length === 0) {
      resolve();
      return;
    }

    const transaction = db.transaction(involvedStores, "readwrite");

    for (const storeName of involvedStores) {
      const store = transaction.objectStore(storeName);
      const toWrite = storeWrites.get(storeName);
      const toDelete = storeDeletes.get(storeName);
      if (toWrite) toWrite.forEach((value) => store.put(value));
      if (toDelete) toDelete.forEach((id) => store.delete(id));
    }

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function persistSnapshot(db: IDBDatabase, snapshot: WorkspaceSnapshot) {
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([...STORES], "readwrite");
    const mapping: Record<StoreName, unknown[]> = {
      documents: snapshot.documents,
      notes: snapshot.notes,
      highlights: snapshot.highlights,
      readingStates: snapshot.readingStates,
      chatSessions: snapshot.chatSessions,
      quizAttempts: snapshot.quizAttempts,
      reviewSchedules: snapshot.reviewSchedules,
      checkpoints: snapshot.checkpoints,
      dailyMetrics: snapshot.dailyMetrics,
      enhancementJobs: snapshot.enhancementJobs,
      preferences: [{ id: "user", ...snapshot.preferences }],
    };
    for (const storeName of STORES) {
      const store = transaction.objectStore(storeName);
      store.clear();
      mapping[storeName].forEach((value) => store.put(value));
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function readLegacyNotes(): LegacyNote[] {
  try {
    const value = JSON.parse(localStorage.getItem("zhiye-notes") || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function createBrowserStudyRepository(): StudyRepository {
  let mutationQueue: Promise<unknown> = Promise.resolve();

  async function loadAndMigrate(): Promise<WorkspaceSnapshot> {
    const db = await openDb();
    try {
      const snapshot = await loadBrowserSnapshot(db);
      const legacy = readLegacyNotes();
      if (!snapshot.notes.length && legacy.length) {
        snapshot.notes = migrateLegacyNotes(legacy, snapshot.documents);
        await persistSnapshot(db, snapshot);
        localStorage.removeItem("zhiye-notes");
      }
      return snapshot;
    } finally {
      db.close();
    }
  }

  return {
    loadWorkspace: loadAndMigrate,
    apply(command) {
      const operation = mutationQueue.then(async () => {
        const db = await openDb();
        try {
          const snapshot = applyToSnapshot(
            await loadBrowserSnapshot(db),
            command,
          );
          await persistIncremental(db, snapshot, command);
          return snapshot;
        } finally {
          db.close();
        }
      });
      mutationQueue = operation.catch(() => undefined);
      return operation;
    },
    async exportBackup(passphrase) {
      return encryptBackupPayload(
        await exportSnapshot(await loadAndMigrate()),
        passphrase,
      );
    },
    async exportPortableBackup() {
      return exportSnapshot(await loadAndMigrate());
    },
    restoreBackup(backup, options = {}) {
      const operation = mutationQueue.then(async () => {
        const incoming = await decodeBackup(backup, options.passphrase);
        const db = await openDb();
        try {
          const next =
            options.mode === "merge"
              ? mergeSnapshots(await loadBrowserSnapshot(db), incoming)
              : incoming;
          await persistSnapshot(db, next);
          return next;
        } finally {
          db.close();
        }
      });
      mutationQueue = operation.catch(() => undefined);
      return operation;
    },
  };
}
