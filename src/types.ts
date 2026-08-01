export type SourceKind = "pdf" | "epub" | "demo";

export interface TextBlock {
  id: string;
  chapterId: string;
  text: string;
  smartText?: string;
  /**
   * The original semantic paragraphs used to generate this smart-text block.
   * The owner block stores the full list; members point back through
   * smartTextOwnerId so both readers can preserve a many-to-one mapping.
   */
  smartTextSourceIds?: string[];
  smartTextOwnerId?: string;
  page?: number;
  sourceItemStart?: number;
  sourceItemEnd?: number;
  locator: string;
  blockKind?: "paragraph" | "table";
  virtualPage?: number;
  progressPercent?: number;
}

export interface Section {
  id: string;
  title: string;
  page: number;
}

export interface Chapter {
  id: string;
  title: string;
  order: number;
  sections?: Section[];
  blocks: TextBlock[];
}

export interface StudyDocument {
  id: string;
  title: string;
  displayTitle?: string;
  filename: string;
  kind: SourceKind;
  originalFile?: Blob;
  parserVersion?: number;
  createdAt: number;
  updatedAt?: number;
  lastOpenedAt?: number;
  contentHash?: string;
  deletedAt?: number;
  chapters: Chapter[];
  sourceChapters?: Chapter[];
}

export interface Citation {
  blockId: string;
  documentId?: string;
  chapterId?: string;
  locator: string;
  excerpt: string;
  score: number;
}

export interface ChatMessage {
  id: string;
  role: "student" | "assistant";
  text: string;
  citations?: Citation[];
  status?: "direct" | "inferred" | "insufficient";
  feedback?: "helpful" | "unhelpful";
  feedbackReason?: "irrelevant" | "unsupported" | "unclear" | "incomplete";
  question?: string;
}

export interface StudyNote {
  id: string;
  documentId: string | null;
  chapterId: string;
  text: string;
  createdAt: number;
  updatedAt: number;
  blockId?: string;
  page?: number;
  quote?: string;
}

export interface QuizItem {
  id: string;
  kind?: "recall" | "distinguish" | "choice" | "application";
  prompt: string;
  answer: string;
  rationale?: string;
  options?: string[];
  locator: string;
  evidenceBlockId?: string;
  evidenceBlockIds?: string[];
  keyPoints?: string[];
}

export interface Highlight {
  id: string;
  documentId: string;
  chapterId: string;
  blockId: string;
  createdAt: number;
}

export interface ReadingState {
  documentId: string;
  chapterId: string;
  readerMode: "original" | "text";
  page?: number;
  blockId?: string;
  positionPercent: number;
  furthestPercent: number;
  rightTab: "mentor" | "notes";
  updatedAt: number;
}

export interface ChatSession {
  documentId: string;
  messages: ChatMessage[];
  updatedAt: number;
}

export interface QuizAttempt {
  id: string;
  documentId: string;
  chapterId: string;
  items: QuizItem[];
  currentIndex: number;
  draft: string;
  scores: Array<number | null>;
  mastery: Array<"mastered" | "review" | null>;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface ReviewSchedule {
  id: string;
  documentId: string;
  chapterId: string;
  evidenceBlockId: string;
  /** Legacy fixed-interval position, retained only while migrating v1 data. */
  intervalIndex?: number;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
  lastRating?: ReviewRating;
  lastReviewedAt?: number;
  dueAt: number;
  updatedAt: number;
}

export type ReviewRating = "again" | "hard" | "good" | "easy";

export interface DailyStudyMetric {
  id: string;
  date: string;
  documentId: string;
  activeSeconds: number;
  pagesRead: number;
  questionsAnswered: number;
  correctAnswers: number;
  reviewsCompleted: number;
  updatedAt: number;
}

export interface EnhancementJob {
  id: string;
  documentId: string;
  chapterId: string;
  blockIds: string[];
  completedBlockIds: string[];
  failedBlockIds: string[];
  status: "pending" | "running" | "paused" | "completed" | "failed";
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  updatedAt: number;
  error?: string;
}

export interface UserPreferences {
  theme: "auto" | "light" | "dark";
  fontScale: "small" | "medium" | "large";
  lineHeight: "compact" | "comfortable" | "relaxed";
  readingWidth: "narrow" | "medium" | "wide";
  semanticSearchEnabled?: boolean;
  batchConcurrency?: number;
  batchRequestsPerMinute?: number;
  inputPricePerMillion?: number;
  outputPricePerMillion?: number;
}

export interface ImportCheckpoint {
  id: string;
  filename: string;
  fileSize?: number;
  lastModified?: number;
  contentHash?: string;
  stage: "validation" | "reading" | "structure" | "ocr" | "index" | "save";
  completedPages: number[];
  errorPages?: number[];
  totalPages?: number;
  pageTexts?: Record<string, string>;
  ocrLanguages?: string[];
  updatedAt: number;
}
