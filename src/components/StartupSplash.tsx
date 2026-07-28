import { useEffect, useState } from "react";

interface StartupSplashProps {
  onComplete: () => void;
}

export function StartupSplash({ onComplete }: StartupSplashProps) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const leaveTimer = window.setTimeout(
      () => setLeaving(true),
      reduceMotion ? 120 : 1050,
    );
    const completeTimer = window.setTimeout(
      onComplete,
      reduceMotion ? 180 : 1420,
    );
    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div
      className={`startup-splash ${leaving ? "is-leaving" : ""}`}
      aria-hidden="true"
    >
      <div className="startup-splash__stage" aria-hidden="true">
        <div className="startup-splash__halo" />
        <img
          className="startup-splash__mark"
          src={`${import.meta.env.BASE_URL}brand/logo-mark.svg`}
          alt=""
        />
        <div className="startup-splash__rule" />
        <div className="startup-splash__wordmark">
          <strong>知页</strong>
          <span>让每一页，都成为你的知识</span>
        </div>
      </div>
    </div>
  );
}
