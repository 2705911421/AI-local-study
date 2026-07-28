import { StrictMode, useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import LandingPage from "./LandingPage";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { StartupSplash } from "./components/StartupSplash";
import "./styles.css";

function RootApp() {
  const isDesktop = Boolean(
    (
      window as typeof window & {
        zhiyeDesktop?: { isDesktop?: boolean };
      }
    ).zhiyeDesktop?.isDesktop,
  );
  const isStudyWorkspace =
    isDesktop ||
    window.location.pathname === "/app" ||
    window.location.pathname === "/app/";
  const [showSplash, setShowSplash] = useState(
    () => isDesktop,
  );
  const completeSplash = useCallback(() => setShowSplash(false), []);

  if (!isStudyWorkspace) {
    return <LandingPage />;
  }

  return (
    <>
      <App />
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
