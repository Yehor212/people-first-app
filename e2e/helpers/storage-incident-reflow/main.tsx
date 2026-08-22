import { useEffect } from "react";
import { createRoot } from "react-dom/client";

import "@/index.css";
import { StorageErrorBanner } from "@/components/StorageErrorBanner";
import { AuthScreen } from "@/components/auth-screen/AuthScreen";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import type { Language } from "@/i18n/translations";

const params = new URLSearchParams(window.location.search);
const requestedLanguage = (params.get("lang") || "en") as Language;
const requestedTheme = params.get("theme") === "dark" ? "dark" : "light";

document.documentElement.classList.toggle("dark", requestedTheme === "dark");
document.documentElement.dataset.theme = requestedTheme === "dark" ? "ink" : "paper";
document.documentElement.style.colorScheme = requestedTheme;

function StorageIncidentReflowFixture() {
  const { language, setLanguage } = useLanguage();

  useEffect(() => {
    if (language !== requestedLanguage) setLanguage(requestedLanguage);
  }, [language, setLanguage]);

  useEffect(() => {
    if (language !== requestedLanguage) return;
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        window.dispatchEvent(
          new CustomEvent("zenflow:indexeddb-timeout", {
            detail: {
              code: "IDB_OPERATION_TIMEOUT",
              phase: "read",
              deadlineMs: 30_000,
              recoveryState: "unavailable",
            },
          }),
        );
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [language]);

  if (language !== requestedLanguage) {
    return <p role="status">Loading locale…</p>;
  }

  return (
    <>
      <StorageErrorBanner />
      <AuthScreen
        onComplete={() => undefined}
        webOAuthError={null}
        onClearError={() => undefined}
      />
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <LanguageProvider>
    <StorageIncidentReflowFixture />
  </LanguageProvider>,
);
