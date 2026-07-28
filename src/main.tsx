import { lazy, StrictMode, Suspense, useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { StartupSplash } from "./components/StartupSplash";

const isDesktop = Boolean(
  (
    window as typeof window & {
      zhiyeDesktop?: { isDesktop?: boolean };
    }
  ).zhiyeDesktop?.isDesktop,
);
const normalizedPath = window.location.pathname.replace(/\/+$/, "") || "/";
const isStudyWorkspace = isDesktop || normalizedPath === "/app";
const Surface = lazy(() =>
  isStudyWorkspace ? import("./App") : import("./LandingPage"),
);

document.title = isStudyWorkspace
  ? "知页 · 本地教材伴学"
  : "知页 · 把问题问到原文里";

function RootApp() {
  const [showSplash, setShowSplash] = useState(
    () => isDesktop,
  );
  const completeSplash = useCallback(() => setShowSplash(false), []);

  return (
    <>
      <Suspense fallback={<div aria-label="正在载入知页" />}>
        <Surface />
      </Suspense>
      {showSplash ? <StartupSplash onComplete={completeSplash} /> : null}
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <RootApp />
    </AppErrorBoundary>
  </StrictMode>,
);
