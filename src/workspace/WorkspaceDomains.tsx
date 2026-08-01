import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { WorkspaceRuntime } from "./WorkspaceRuntimeContext";

type ShellDomain = Pick<
  WorkspaceRuntime,
  "overlay" | "rightTab" | "sidebarOpen" | "mobileView" | "notice"
> & {
  openOverlay: (overlay: Exclude<WorkspaceRuntime["overlay"], null>) => void;
  closeOverlay: () => void;
  selectRightTab: (tab: WorkspaceRuntime["rightTab"]) => void;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  selectMobileView: (view: WorkspaceRuntime["mobileView"]) => void;
  announce: (message: string) => void;
};

type LibraryDomain = Pick<
  WorkspaceRuntime,
  | "documents"
  | "trashedDocuments"
  | "activeDocument"
  | "activeChapter"
  | "bookSearch"
  | "bookSort"
  | "showTrash"
  | "storageUsage"
  | "importState"
  | "importError"
  | "importProgress"
  | "importWithOcr"
  | "importOcrLanguages"
  | "pendingDeleteDocumentId"
> & {
  setBookQuery: (query: string) => void;
  changeBookSort: (sort: WorkspaceRuntime["bookSort"]) => void;
  toggleTrash: () => void;
  requestDocumentDelete: (documentId: string | null) => void;
  configureImportOcr: (enabled: boolean) => void;
  configureImportLanguages: (languages: string[]) => void;
  cancelImport: () => void;
};

type ReaderDomain = Pick<
  WorkspaceRuntime,
  | "readerMode"
  | "pdfFocusPage"
  | "currentTextPage"
  | "currentBlockId"
  | "highlightedBlockId"
  | "selectionMode"
  | "selectedBlockIds"
  | "furthestPercent"
  | "readingStates"
  | "searchOpen"
  | "chapterSearch"
  | "searchIndex"
  | "highlighterMode"
  | "highlights"
  | "isEnhancing"
  | "isRebuildingSegments"
  | "enhanceProgress"
  | "enhanceError"
> & {
  isExplainingImage: boolean;
  changeMode: (mode: WorkspaceRuntime["readerMode"]) => void;
  openSearch: (open: boolean) => void;
  changeSearch: (query: string) => void;
  changeSearchIndex: (index: number) => void;
  toggleHighlighter: () => void;
  toggleSelection: () => void;
  setSelectionMode: (enabled: boolean) => void;
  clearSelection: () => void;
  selectBlock: (blockId: string) => void;
  changeTextPage: (page: number) => void;
  clearEnhancementError: () => void;
  toggleBlockSelection: (blockId: string) => void;
};

type AssistantDomain = Pick<
  WorkspaceRuntime,
  | "query"
  | "messages"
  | "chatHydratingDocumentId"
  | "isThinking"
  | "searchScope"
> & {
  changeQuery: (query: string) => void;
  changeSearchScope: (scope: WorkspaceRuntime["searchScope"]) => void;
  cancelQuestion: () => void;
};

type NotesDomain = Pick<
  WorkspaceRuntime,
  | "notes"
  | "noteDraft"
  | "noteQuote"
  | "noteError"
  | "editingNoteId"
  | "noteSearch"
  | "pendingDeleteNoteId"
> & {
  changeDraft: (draft: string) => void;
  changeSearch: (query: string) => void;
  cancelEditing: () => void;
  requestNoteDelete: (noteId: string | null) => void;
  startNote: (quote: string) => void;
  clearQuote: () => void;
};

type LearningDomain = Pick<
  WorkspaceRuntime,
  | "quizAttempts"
  | "reviewSchedules"
  | "dailyMetrics"
  | "quizIndex"
  | "quizAnswer"
  | "quizScore"
  | "quizScores"
  | "quizMastery"
  | "quizAttemptId"
  | "quiz"
> & {
  changeQuizAnswer: (answer: string) => void;
};

type IntelligenceDomain = Pick<
  WorkspaceRuntime,
  | "config"
  | "modelOnline"
  | "modelSupportsVision"
  | "isTestingModel"
  | "modelOptions"
  | "modelListState"
  | "providerStatuses"
> & {
  changeConfig: WorkspaceRuntime["setConfig"];
  setModelListMessage: (message: string) => void;
  chooseModel: (model: string) => void;
  resetConnectionDiscovery: () => void;
};

type PreferencesDomain = Pick<WorkspaceRuntime, "preferences">;

const ShellContext = createContext<ShellDomain | null>(null);
const LibraryContext = createContext<LibraryDomain | null>(null);
const ReaderContext = createContext<ReaderDomain | null>(null);
const AssistantContext = createContext<AssistantDomain | null>(null);
const NotesContext = createContext<NotesDomain | null>(null);
const LearningContext = createContext<LearningDomain | null>(null);
const IntelligenceContext = createContext<IntelligenceDomain | null>(null);
const PreferencesContext = createContext<PreferencesDomain | null>(null);

function useRequiredContext<T>(context: React.Context<T | null>, name: string) {
  const value = useContext(context);
  if (!value) throw new Error(`${name} must be used within WorkspaceProvider`);
  return value;
}

export function useShell() {
  return useRequiredContext(ShellContext, "useShell");
}

export function useLibrary() {
  return useRequiredContext(LibraryContext, "useLibrary");
}

export function useReader() {
  return useRequiredContext(ReaderContext, "useReader");
}

export function useAssistant() {
  return useRequiredContext(AssistantContext, "useAssistant");
}

export function useNotes() {
  return useRequiredContext(NotesContext, "useNotes");
}

export function useLearning() {
  return useRequiredContext(LearningContext, "useLearning");
}

export function useIntelligence() {
  return useRequiredContext(IntelligenceContext, "useIntelligence");
}

export function usePreferences() {
  return useRequiredContext(PreferencesContext, "usePreferences");
}

export function WorkspaceDomainProviders({
  runtime,
  children,
}: {
  runtime: WorkspaceRuntime;
  children: ReactNode;
}) {
  const {
    setOverlay,
    setSidebarOpen,
    setShowTrash,
    importControllerRef,
    highlighterMode,
    setHighlighterMode,
    selectionMode,
    setSelectionMode,
    setSelectedBlockIds,
    setEnhanceError,
    setEditingNoteId,
    setNoteDraft,
    setNoteQuote,
    setNoteError,
    setConfig,
    setModelOnline,
    setModelOptions,
    setModelListState,
  } = runtime;
  const closeOverlay = useCallback(() => setOverlay(null), [setOverlay]);
  const toggleSidebar = useCallback(
    () => setSidebarOpen((open) => !open),
    [setSidebarOpen],
  );
  const closeSidebar = useCallback(
    () => setSidebarOpen(false),
    [setSidebarOpen],
  );
  const toggleTrash = useCallback(
    () => setShowTrash((visible) => !visible),
    [setShowTrash],
  );
  const cancelImport = useCallback(
    () => importControllerRef.current?.abort(),
    [importControllerRef],
  );
  const toggleHighlighter = useCallback(
    () => setHighlighterMode(!highlighterMode),
    [highlighterMode, setHighlighterMode],
  );
  const toggleSelection = useCallback(
    () => setSelectionMode(!selectionMode),
    [selectionMode, setSelectionMode],
  );
  const clearSelection = useCallback(
    () => setSelectedBlockIds([]),
    [setSelectedBlockIds],
  );
  const clearEnhancementError = useCallback(
    () => setEnhanceError(""),
    [setEnhanceError],
  );
  const toggleBlockSelection = useCallback(
    (blockId: string) =>
      setSelectedBlockIds((current) =>
        current.includes(blockId)
          ? current.filter((id) => id !== blockId)
          : [...current, blockId],
      ),
    [setSelectedBlockIds],
  );
  const cancelEditing = useCallback(() => {
    setEditingNoteId(null);
    setNoteDraft("");
    setNoteQuote("");
    setNoteError("");
  }, [setEditingNoteId, setNoteDraft, setNoteError, setNoteQuote]);
  const clearQuote = useCallback(() => setNoteQuote(""), [setNoteQuote]);
  const startNote = useCallback(
    (quote: string) => {
      setNoteQuote(quote);
      setNoteDraft("");
      setEditingNoteId(null);
      setNoteError("");
    },
    [setEditingNoteId, setNoteDraft, setNoteError, setNoteQuote],
  );
  const chooseModel = useCallback(
    (model: string) => setConfig((current) => ({ ...current, model })),
    [setConfig],
  );
  const resetConnectionDiscovery = useCallback(() => {
    setModelOnline(null);
    setModelOptions([]);
    setModelListState("");
  }, [setModelListState, setModelOnline, setModelOptions]);

  const shell = useMemo<ShellDomain>(
    () => ({
      overlay: runtime.overlay,
      rightTab: runtime.rightTab,
      sidebarOpen: runtime.sidebarOpen,
      mobileView: runtime.mobileView,
      notice: runtime.notice,
      openOverlay: runtime.setOverlay,
      closeOverlay,
      selectRightTab: runtime.setRightTab,
      toggleSidebar,
      closeSidebar,
      selectMobileView: runtime.setMobileView,
      announce: runtime.setNotice,
    }),
    [
      runtime.mobileView,
      runtime.notice,
      runtime.overlay,
      runtime.rightTab,
      runtime.setMobileView,
      runtime.setNotice,
      runtime.setOverlay,
      runtime.setRightTab,
      runtime.sidebarOpen,
      closeOverlay,
      closeSidebar,
      toggleSidebar,
    ],
  );
  const library = useMemo<LibraryDomain>(
    () => ({
      documents: runtime.documents,
      trashedDocuments: runtime.trashedDocuments,
      activeDocument: runtime.activeDocument,
      activeChapter: runtime.activeChapter,
      bookSearch: runtime.bookSearch,
      bookSort: runtime.bookSort,
      showTrash: runtime.showTrash,
      storageUsage: runtime.storageUsage,
      importState: runtime.importState,
      importError: runtime.importError,
      importProgress: runtime.importProgress,
      importWithOcr: runtime.importWithOcr,
      importOcrLanguages: runtime.importOcrLanguages,
      pendingDeleteDocumentId: runtime.pendingDeleteDocumentId,
      setBookQuery: runtime.setBookSearch,
      changeBookSort: runtime.setBookSort,
      toggleTrash,
      requestDocumentDelete: runtime.setPendingDeleteDocumentId,
      configureImportOcr: runtime.setImportWithOcr,
      configureImportLanguages: runtime.setImportOcrLanguages,
      cancelImport,
    }),
    [
      runtime.activeChapter,
      runtime.activeDocument,
      runtime.bookSearch,
      runtime.bookSort,
      runtime.documents,
      runtime.importError,
      runtime.importOcrLanguages,
      runtime.importProgress,
      runtime.importState,
      runtime.importWithOcr,
      runtime.pendingDeleteDocumentId,
      runtime.setBookSearch,
      runtime.setBookSort,
      runtime.setImportOcrLanguages,
      runtime.setImportWithOcr,
      runtime.setPendingDeleteDocumentId,
      runtime.showTrash,
      runtime.storageUsage,
      runtime.trashedDocuments,
      cancelImport,
      toggleTrash,
    ],
  );
  const reader = useMemo<ReaderDomain>(
    () => ({
      readerMode: runtime.readerMode,
      pdfFocusPage: runtime.pdfFocusPage,
      currentTextPage: runtime.currentTextPage,
      currentBlockId: runtime.currentBlockId,
      highlightedBlockId: runtime.highlightedBlockId,
      selectionMode: runtime.selectionMode,
      selectedBlockIds: runtime.selectedBlockIds,
      furthestPercent: runtime.furthestPercent,
      readingStates: runtime.readingStates,
      searchOpen: runtime.searchOpen,
      chapterSearch: runtime.chapterSearch,
      searchIndex: runtime.searchIndex,
      highlighterMode: runtime.highlighterMode,
      highlights: runtime.highlights,
      isEnhancing: runtime.isEnhancing,
      isRebuildingSegments: runtime.isRebuildingSegments,
      enhanceProgress: runtime.enhanceProgress,
      enhanceError: runtime.enhanceError,
      isExplainingImage:
        runtime.isThinking &&
        runtime.imageExplanationControllerRef.current !== null,
      changeMode: runtime.setReaderMode,
      openSearch: runtime.setSearchOpen,
      changeSearch: runtime.setChapterSearch,
      changeSearchIndex: runtime.setSearchIndex,
      toggleHighlighter,
      toggleSelection,
      setSelectionMode: runtime.setSelectionMode,
      clearSelection,
      selectBlock: runtime.setCurrentBlockId,
      changeTextPage: runtime.setCurrentTextPage,
      clearEnhancementError,
      toggleBlockSelection,
    }),
    [
      runtime.chapterSearch,
      runtime.currentBlockId,
      runtime.currentTextPage,
      runtime.enhanceError,
      runtime.enhanceProgress,
      runtime.furthestPercent,
      runtime.highlightedBlockId,
      runtime.highlighterMode,
      runtime.highlights,
      runtime.isEnhancing,
      runtime.isThinking,
      runtime.isRebuildingSegments,
      runtime.imageExplanationControllerRef,
      runtime.pdfFocusPage,
      runtime.readerMode,
      runtime.readingStates,
      runtime.searchIndex,
      runtime.searchOpen,
      runtime.selectedBlockIds,
      runtime.selectionMode,
      runtime.setChapterSearch,
      runtime.setCurrentBlockId,
      runtime.setCurrentTextPage,
      runtime.setReaderMode,
      runtime.setSearchIndex,
      runtime.setSearchOpen,
      runtime.setSelectionMode,
      clearEnhancementError,
      clearSelection,
      toggleBlockSelection,
      toggleHighlighter,
      toggleSelection,
    ],
  );
  const assistant = useMemo<AssistantDomain>(
    () => ({
      query: runtime.query,
      messages: runtime.messages,
      chatHydratingDocumentId: runtime.chatHydratingDocumentId,
      isThinking: runtime.isThinking,
      searchScope: runtime.searchScope,
      changeQuery: runtime.setQuery,
      changeSearchScope: runtime.setSearchScope,
      cancelQuestion: () => runtime.questionControllerRef.current?.abort(),
    }),
    [
      runtime.chatHydratingDocumentId,
      runtime.isThinking,
      runtime.messages,
      runtime.query,
      runtime.questionControllerRef,
      runtime.searchScope,
      runtime.setQuery,
      runtime.setSearchScope,
    ],
  );
  const notes = useMemo<NotesDomain>(
    () => ({
      notes: runtime.notes,
      noteDraft: runtime.noteDraft,
      noteQuote: runtime.noteQuote,
      noteError: runtime.noteError,
      editingNoteId: runtime.editingNoteId,
      noteSearch: runtime.noteSearch,
      pendingDeleteNoteId: runtime.pendingDeleteNoteId,
      changeDraft: runtime.setNoteDraft,
      changeSearch: runtime.setNoteSearch,
      cancelEditing,
      requestNoteDelete: runtime.setPendingDeleteNoteId,
      clearQuote,
      startNote,
    }),
    [
      runtime.editingNoteId,
      runtime.noteDraft,
      runtime.noteError,
      runtime.noteQuote,
      runtime.noteSearch,
      runtime.notes,
      runtime.pendingDeleteNoteId,
      runtime.setNoteDraft,
      runtime.setNoteSearch,
      runtime.setPendingDeleteNoteId,
      cancelEditing,
      clearQuote,
      startNote,
    ],
  );
  const learning = useMemo<LearningDomain>(
    () => ({
      quizAttempts: runtime.quizAttempts,
      reviewSchedules: runtime.reviewSchedules,
      dailyMetrics: runtime.dailyMetrics,
      quizIndex: runtime.quizIndex,
      quizAnswer: runtime.quizAnswer,
      quizScore: runtime.quizScore,
      quizScores: runtime.quizScores,
      quizMastery: runtime.quizMastery,
      quizAttemptId: runtime.quizAttemptId,
      quiz: runtime.quiz,
      changeQuizAnswer: runtime.setQuizAnswer,
    }),
    [
      runtime.dailyMetrics,
      runtime.quiz,
      runtime.quizAnswer,
      runtime.quizAttemptId,
      runtime.quizAttempts,
      runtime.quizIndex,
      runtime.quizMastery,
      runtime.quizScore,
      runtime.quizScores,
      runtime.reviewSchedules,
      runtime.setQuizAnswer,
    ],
  );
  const intelligence = useMemo<IntelligenceDomain>(
    () => ({
      config: runtime.config,
      modelOnline: runtime.modelOnline,
      modelSupportsVision: runtime.modelSupportsVision,
      isTestingModel: runtime.isTestingModel,
      modelOptions: runtime.modelOptions,
      modelListState: runtime.modelListState,
      providerStatuses: runtime.providerStatuses,
      changeConfig: runtime.setConfig,
      setModelListMessage: runtime.setModelListState,
      chooseModel,
      resetConnectionDiscovery,
    }),
    [
      runtime.config,
      runtime.isTestingModel,
      runtime.modelListState,
      runtime.modelOnline,
      runtime.modelOptions,
      runtime.modelSupportsVision,
      runtime.providerStatuses,
      runtime.setConfig,
      runtime.setModelListState,
      chooseModel,
      resetConnectionDiscovery,
    ],
  );
  const preferences = useMemo<PreferencesDomain>(
    () => ({ preferences: runtime.preferences }),
    [runtime.preferences],
  );

  return (
    <ShellContext.Provider value={shell}>
      <LibraryContext.Provider value={library}>
        <ReaderContext.Provider value={reader}>
          <AssistantContext.Provider value={assistant}>
            <NotesContext.Provider value={notes}>
              <LearningContext.Provider value={learning}>
                <IntelligenceContext.Provider value={intelligence}>
                  <PreferencesContext.Provider value={preferences}>
                    {children}
                  </PreferencesContext.Provider>
                </IntelligenceContext.Provider>
              </LearningContext.Provider>
            </NotesContext.Provider>
          </AssistantContext.Provider>
        </ReaderContext.Provider>
      </LibraryContext.Provider>
    </ShellContext.Provider>
  );
}
