export type WorkspaceRegion = "library" | "reader" | "assistant" | "shell";

type WorkspaceRenderObserver = (region: WorkspaceRegion) => void;

let observer: WorkspaceRenderObserver | null = null;

export function observeWorkspaceRenders(
  nextObserver: WorkspaceRenderObserver,
): () => void {
  observer = nextObserver;
  return () => {
    if (observer === nextObserver) observer = null;
  };
}

export function markWorkspaceRender(region: WorkspaceRegion): void {
  observer?.(region);
}
