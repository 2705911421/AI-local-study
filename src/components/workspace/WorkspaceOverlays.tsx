import { memo } from "react";
import type { ReviewRating, UserPreferences } from "../../types";
import { ConfirmDialog } from "../ConfirmDialog";
import { ImportDialog } from "../ImportDialog";
import { MobileStudyTabs } from "../MobileStudyTabs";
import { QuizDialog } from "../QuizDialog";
import { ReviewDialog, type ReviewQueueItem } from "../ReviewDialog";
import { SettingsDialog } from "../SettingsDialog";
import { StatusToast } from "../StatusToast";
import { useShell } from "../../workspace/WorkspaceDomains";

interface WorkspaceOverlaysProps {
  onFile: (file?: File) => void;
  onTestModel: () => void;
  onFetchModelOptions: () => void;
  onSaveSettings: () => void;
  onChangeAgentLogin: (action: "login" | "logout") => void;
  onClearApiKey: () => Promise<boolean>;
  onExportBackup: (passphrase: string) => Promise<boolean>;
  onRestoreBackup: (
    file: File,
    passphrase?: string,
    mode?: "replace" | "merge",
  ) => Promise<boolean>;
  onSavePreferences: (preferences: UserPreferences) => void;
  onGradeQuiz: () => void;
  onNextQuiz: () => void;
  onSetMastery: (value: "mastered" | "review") => void;
  reviewItems: ReviewQueueItem[];
  onRateReview: (item: ReviewQueueItem, rating: ReviewRating) => Promise<void>;
  onOpenReviewEvidence: (item: ReviewQueueItem) => void;
  onDeleteNote: (id: string) => void;
  onDeleteDocument: (id: string) => void;
}

export const WorkspaceOverlays = memo(function WorkspaceOverlays(
  props: WorkspaceOverlaysProps,
) {
  const shell = useShell();

  return (
    <>
      <MobileStudyTabs
        value={shell.mobileView}
        onChange={(view) => {
          shell.selectMobileView(view);
          if (view !== "reader") shell.selectRightTab(view);
        }}
      />
      <StatusToast message={shell.notice} />
      <ImportDialog onFile={props.onFile} />
      <SettingsDialog
        onTestModel={props.onTestModel}
        onFetchModelOptions={props.onFetchModelOptions}
        onSaveSettings={props.onSaveSettings}
        onChangeAgentLogin={props.onChangeAgentLogin}
        onClearApiKey={props.onClearApiKey}
        onExportBackup={props.onExportBackup}
        onRestoreBackup={props.onRestoreBackup}
        onSavePreferences={props.onSavePreferences}
      />
      <QuizDialog
        onGrade={props.onGradeQuiz}
        onNext={props.onNextQuiz}
        onSetMastery={props.onSetMastery}
      />
      <ReviewDialog
        items={props.reviewItems}
        onRate={props.onRateReview}
        onOpenEvidence={props.onOpenReviewEvidence}
      />
      <ConfirmDialog type="note" onConfirm={props.onDeleteNote} />
      <ConfirmDialog type="document" onConfirm={props.onDeleteDocument} />
    </>
  );
});
