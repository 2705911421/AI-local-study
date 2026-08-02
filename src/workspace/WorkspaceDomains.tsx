import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { StudyNote } from "../types";
import type { WorkspaceRuntime } from "./WorkspaceRuntime";
import { useNoteManager } from "./operations/assistant";

function useStableCallback<T extends (...args: never[]) => unknown>(
  callback: T,
): T {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  return useCallback(
    ((...args: Parameters<T>) => callbackRef.current(...args)) as T,
    [],
  );
}

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
  | "furthestPercent"
  | "storageUsage"
  | "importState"
  | "importError"
  | "importProgress"
  | "importWithOcr"
  | "importOcrLanguages"
  | "pendingDeleteDocumentId"
> & {
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
  | "highlighterMode"
  | "highlights"
  | "isEnhancing"
  | "isRebuildingSegments"
  | "enhanceProgress"
  | "enhanceError"
> & {
  isExplainingImage: boolean;
  changeMode: (mode: WorkspaceRuntime["readerMode"]) => void;
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
  "messages" | "chatHydratingDocumentId" | "isThinking"
> & {
  cancelQuestion: () => void;
};

type NoteEditorSession = {
  editingNoteId: string | null;
  initialDraft: string;
  revision: number;
};

type NotesDomain = Pick<WorkspaceRuntime, "notes"> & {
  noteQuote: string;
  pendingDeleteNoteId: string | null;
  editor: NoteEditorSession;
  requestNoteDelete: (noteId: string | null) => void;
  startNewNote: (quote: string) => void;
  editNote: (note: StudyNote) => void;
  cancelEditing: () => void;
  clearQuote: () => void;
  saveNote: (draft: string) => Promise<boolean>;
  deleteNote: (noteId: string) => Promise<void>;
  exportNotes: () => void;
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

export function WorkspaceProvider({
  runtime,
  children,
}: {
  runtime: WorkspaceRuntime;
  children: ReactNode;
}) {
  const {
    setOverlay,
    setSidebarOpen,
    importControllerRef,
    highlighterMode,
    setHighlighterMode,
    selectionMode,
    setSelectionMode,
    setSelectedBlockIds,
    setEnhanceError,
    setConfig,
    setModelOnline,
    setModelOptions,
    setModelListState,
  } = runtime;
  const [noteQuote, setNoteQuote] = useState("");
  const [pendingDeleteNoteId, setPendingDeleteNoteId] = useState<string | null>(
    null,
  );
  const [noteEditor, setNoteEditor] = useState<NoteEditorSession>({
    editingNoteId: null,
    initialDraft: "",
    revision: 0,
  });
  const {
    addNote,
    deleteNote: deleteStoredNote,
    exportNotes,
  } = useNoteManager(runtime);
  const stableAddNote = useStableCallback(addNote);
  const stableDeleteStoredNote = useStableCallback(deleteStoredNote);
  const stableExportNotes = useStableCallback(exportNotes);
  const closeOverlay = useCallback(() => setOverlay(null), [setOverlay]);
  const toggleSidebar = useCallback(
    () => setSidebarOpen((open) => !open),
    [setSidebarOpen],
  );
  const closeSidebar = useCallback(
    () => setSidebarOpen(false),
    [setSidebarOpen],
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
  const clearQuote = useCallback(() => setNoteQuote(""), [setNoteQuote]);
  const resetNoteEditor = useCallback(() => {
    setNoteQuote("");
    setNoteEditor((current) => ({
      editingNoteId: null,
      initialDraft: "",
      revision: current.revision + 1,
    }));
  }, []);
  const startNewNote = useCallback(
    (quote: string) => {
      setNoteQuote(quote);
      setNoteEditor((current) => ({
        editingNoteId: null,
        initialDraft: "",
        revision: current.revision + 1,
      }));
    },
    [setNoteQuote],
  );
  const editNote = useCallback((note: StudyNote) => {
    setNoteQuote(note.quote || "");
    setNoteEditor((current) => ({
      editingNoteId: note.id,
      initialDraft: note.text,
      revision: current.revision + 1,
    }));
  }, []);
  const saveNote = useCallback(
    async (draft: string) => {
      const saved = await stableAddNote({
        draft,
        editingNoteId: noteEditor.editingNoteId,
        quote: noteQuote,
      });
      if (saved) resetNoteEditor();
      return saved;
    },
    [noteEditor.editingNoteId, noteQuote, resetNoteEditor, stableAddNote],
  );
  const deleteNote = useCallback(
    async (noteId: string) => {
      if (await stableDeleteStoredNote(noteId)) {
        setPendingDeleteNoteId(null);
      }
    },
    [stableDeleteStoredNote],
  );
  useEffect(() => {
    resetNoteEditor();
    setPendingDeleteNoteId(null);
  }, [runtime.activeChapter.id, runtime.activeDocument.id, resetNoteEditor]);
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
      furthestPercent: runtime.furthestPercent,
      storageUsage: runtime.storageUsage,
      importState: runtime.importState,
      importError: runtime.importError,
      importProgress: runtime.importProgress,
      importWithOcr: runtime.importWithOcr,
      importOcrLanguages: runtime.importOcrLanguages,
      pendingDeleteDocumentId: runtime.pendingDeleteDocumentId,
      requestDocumentDelete: runtime.setPendingDeleteDocumentId,
      configureImportOcr: runtime.setImportWithOcr,
      configureImportLanguages: runtime.setImportOcrLanguages,
      cancelImport,
    }),
    [
      runtime.activeChapter,
      runtime.activeDocument,
      runtime.documents,
      runtime.furthestPercent,
      runtime.importError,
      runtime.importOcrLanguages,
      runtime.importProgress,
      runtime.importState,
      runtime.importWithOcr,
      runtime.pendingDeleteDocumentId,
      runtime.setImportOcrLanguages,
      runtime.setImportWithOcr,
      runtime.setPendingDeleteDocumentId,
      runtime.storageUsage,
      runtime.trashedDocuments,
      cancelImport,
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
      runtime.selectedBlockIds,
      runtime.selectionMode,
      runtime.setCurrentBlockId,
      runtime.setCurrentTextPage,
      runtime.setReaderMode,
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
      messages: runtime.messages,
      chatHydratingDocumentId: runtime.chatHydratingDocumentId,
      isThinking: runtime.isThinking,
      cancelQuestion: () => runtime.questionControllerRef.current?.abort(),
    }),
    [
      runtime.chatHydratingDocumentId,
      runtime.isThinking,
      runtime.messages,
      runtime.questionControllerRef,
    ],
  );
  const notes = useMemo<NotesDomain>(
    () => ({
      notes: runtime.notes,
      noteQuote,
      pendingDeleteNoteId,
      editor: noteEditor,
      requestNoteDelete: setPendingDeleteNoteId,
      clearQuote,
      startNewNote,
      editNote,
      cancelEditing: resetNoteEditor,
      saveNote,
      deleteNote,
      exportNotes: stableExportNotes,
    }),
    [
      runtime.notes,
      noteQuote,
      pendingDeleteNoteId,
      noteEditor,
      clearQuote,
      startNewNote,
      editNote,
      resetNoteEditor,
      saveNote,
      deleteNote,
      stableExportNotes,
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
