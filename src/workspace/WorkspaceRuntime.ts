import type React from "react";
import type {
  ChatMessage,
  DailyStudyMetric,
  Highlight,
  QuizAttempt,
  QuizItem,
  ReadingState,
  ReviewSchedule,
  StudyDocument,
  StudyNote,
  UserPreferences,
} from "../types";
import type { ImportProgress } from "../lib/importPipeline";
import type { LlmConfig, ProviderStatus } from "../lib/intelligence/client";
import type { StudyRepository } from "../lib/studyRepository";

export type Overlay = "upload" | "settings" | "quiz" | "review" | null;
export type RightTab = "mentor" | "notes";
export type MobileStudyView = "reader" | "mentor" | "notes";
export type SearchScope = "chapter" | "document" | "library";
type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

export interface WorkspaceRuntime {
  // ── Repository ──
  repository: StudyRepository;

  // ── Notice ──
  notice: string;
  setNotice: Setter<string>;

  // ── Documents ──
  documents: StudyDocument[];
  setDocuments: React.Dispatch<React.SetStateAction<StudyDocument[]>>;
  trashedDocuments: StudyDocument[];
  setTrashedDocuments: React.Dispatch<React.SetStateAction<StudyDocument[]>>;
  activeDocumentId: string;
  setActiveDocumentId: Setter<string>;
  activeDocument: StudyDocument;
  activeChapterId: string;
  setActiveChapterId: Setter<string>;
  activeChapter: import("../types").Chapter;

  // ── UI Layout ──
  overlay: Overlay;
  setOverlay: Setter<Overlay>;
  rightTab: RightTab;
  setRightTab: Setter<RightTab>;
  sidebarOpen: boolean;
  setSidebarOpen: Setter<boolean>;
  mobileView: MobileStudyView;
  setMobileView: Setter<MobileStudyView>;

  // ── Chat ──
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  chatHydratingDocumentId: string | null;
  setChatHydratingDocumentId: Setter<string | null>;
  isThinking: boolean;
  setIsThinking: Setter<boolean>;

  // ── Notes ──
  notes: StudyNote[];
  setNotes: React.Dispatch<React.SetStateAction<StudyNote[]>>;

  // ── Highlights ──
  highlights: Highlight[];
  setHighlights: React.Dispatch<React.SetStateAction<Highlight[]>>;

  // ── Quiz ──
  quizAttempts: QuizAttempt[];
  setQuizAttempts: React.Dispatch<React.SetStateAction<QuizAttempt[]>>;
  reviewSchedules: ReviewSchedule[];
  setReviewSchedules: React.Dispatch<React.SetStateAction<ReviewSchedule[]>>;
  dailyMetrics: DailyStudyMetric[];
  setDailyMetrics: React.Dispatch<React.SetStateAction<DailyStudyMetric[]>>;
  quizIndex: number;
  setQuizIndex: Setter<number>;
  quizAnswer: string;
  setQuizAnswer: Setter<string>;
  quizScore: number | null;
  setQuizScore: Setter<number | null>;
  quizScores: Array<number | null>;
  setQuizScores: React.Dispatch<React.SetStateAction<Array<number | null>>>;
  quizMastery: Array<"mastered" | "review" | null>;
  setQuizMastery: React.Dispatch<
    React.SetStateAction<Array<"mastered" | "review" | null>>
  >;
  quizAttemptId: string | null;
  setQuizAttemptId: (id: string | null) => void;
  quiz: QuizItem[];
  quizItemsOverride: QuizItem[];
  setQuizItemsOverride: Setter<QuizItem[]>;

  // ── Model Config ──
  config: LlmConfig;
  setConfig: React.Dispatch<React.SetStateAction<LlmConfig>>;
  modelOnline: boolean | null;
  setModelOnline: (v: boolean | null) => void;
  modelSupportsVision: boolean;
  setModelSupportsVision: (v: boolean) => void;
  isTestingModel: boolean;
  setIsTestingModel: (v: boolean) => void;
  modelOptions: string[];
  setModelOptions: Setter<string[]>;
  modelListState: string;
  setModelListState: (s: string) => void;
  providerStatuses: ProviderStatus[];
  setProviderStatuses: React.Dispatch<React.SetStateAction<ProviderStatus[]>>;

  // ── Import ──
  importState: "idle" | "parsing" | "done" | "error";
  setImportState: (s: "idle" | "parsing" | "done" | "error") => void;
  importError: string;
  setImportError: (e: string) => void;
  importProgress: ImportProgress | null;
  setImportProgress: (p: ImportProgress | null) => void;
  importWithOcr: boolean;
  setImportWithOcr: (v: boolean) => void;
  importOcrLanguages: string[];
  setImportOcrLanguages: Setter<string[]>;

  // ── Enhancement ──
  isEnhancing: boolean;
  setIsEnhancing: (v: boolean) => void;
  isRebuildingSegments: boolean;
  setIsRebuildingSegments: (v: boolean) => void;
  enhanceProgress: string;
  setEnhanceProgress: (p: string) => void;
  enhanceError: string;
  setEnhanceError: (e: string) => void;

  // ── Reader ──
  readerMode: "original" | "text";
  setReaderMode: (m: "original" | "text") => void;
  pdfFocusPage: number | null;
  setPdfFocusPage: (p: number | null) => void;
  currentTextPage: number;
  setCurrentTextPage: (p: number) => void;
  currentBlockId: string | undefined;
  setCurrentBlockId: (id: string | undefined) => void;
  highlightedBlockId: string | null;
  setHighlightedBlockId: (id: string | null) => void;
  selectionMode: boolean;
  setSelectionMode: (v: boolean) => void;
  selectedBlockIds: string[];
  setSelectedBlockIds: Setter<string[]>;
  furthestPercent: number;
  setFurthestPercent: (p: number) => void;
  readingStates: ReadingState[];
  setReadingStates: React.Dispatch<React.SetStateAction<ReadingState[]>>;
  highlighterMode: boolean;
  setHighlighterMode: Setter<boolean>;

  // ── Library ──
  storageUsage: string;
  setStorageUsage: (u: string) => void;

  // ── Preferences ──
  preferences: UserPreferences;
  setPreferences: React.Dispatch<React.SetStateAction<UserPreferences>>;

  // ── Delete Confirmations ──
  pendingDeleteDocumentId: string | null;
  setPendingDeleteDocumentId: (id: string | null) => void;

  // ── Refs ──
  readerRef: React.RefObject<HTMLElement | null>;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  highlightTimerRef: React.MutableRefObject<number | null>;
  importCloseTimerRef: React.MutableRefObject<number | null>;
  questionControllerRef: React.MutableRefObject<AbortController | null>;
  modelTestControllerRef: React.MutableRefObject<AbortController | null>;
  modelListControllerRef: React.MutableRefObject<AbortController | null>;
  enhancementControllerRef: React.MutableRefObject<AbortController | null>;
  imageExplanationControllerRef: React.MutableRefObject<AbortController | null>;
  importControllerRef: React.MutableRefObject<AbortController | null>;

  // ── Computed (set by AppInner via props, not context) ──
  // searchResults, chapterHighlights, chapterNotes are computed inside
  // AppInner and passed directly to hooks that need them.
}
