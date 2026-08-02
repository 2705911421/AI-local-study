import { useCallback, useRef } from "react";
import type { WorkspaceRuntime } from "../WorkspaceRuntime";
import type {
  StudyCommand,
  WorkspaceSnapshot,
} from "../../lib/studyRepository";

export type PersistenceRuntime = Pick<
  WorkspaceRuntime,
  "repository" | "setNotice"
>;

export function usePersistence(runtime: PersistenceRuntime) {
  const { repository, setNotice } = runtime;
  const persistenceNoticeAtRef = useRef(0);

  const reportPersistenceFailure = useCallback(
    (message: string, background = false) => {
      const now = Date.now();
      if (background && now - persistenceNoticeAtRef.current < 3200) return;
      persistenceNoticeAtRef.current = now;
      setNotice(message);
    },
    [setNotice],
  );

  const persistCommand = useCallback(
    async (
      command: StudyCommand,
      failureMessage: string,
      background = false,
    ): Promise<WorkspaceSnapshot | null> => {
      try {
        return await repository.apply(command);
      } catch {
        reportPersistenceFailure(failureMessage, background);
        return null;
      }
    },
    [repository, reportPersistenceFailure],
  );

  const persistInBackground = useCallback(
    (command: StudyCommand, failureMessage: string) => {
      void persistCommand(command, failureMessage, true);
    },
    [persistCommand],
  );

  return { persistCommand, persistInBackground, reportPersistenceFailure };
}
