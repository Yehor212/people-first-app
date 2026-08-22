import { useEffect } from "react";
import { createRoot } from "react-dom/client";

import "@/index.css";
import { ParticipantsLeaderboard } from "@/components/challenges/ParticipantsLeaderboard";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import type { Language } from "@/i18n/translations";
import type { Challenge } from "@/lib/friendChallenge";

const params = new URLSearchParams(window.location.search);
const requestedLanguage = (params.get("lang") || "en") as Language;
const requestedTheme = params.get("theme") === "dark" ? "dark" : "light";
const requestedFontSize = params.get("scale") === "200" ? "200%" : "100%";

const CHALLENGE: Challenge = {
  id: "reflow-local-challenge-01",
  code: "ZEN-REFLOW",
  habitName: "Reflow challenge",
  habitIcon: "Leaf",
  duration: 365,
  startDate: "2026-01-01",
  endDate: "2027-01-01",
  myProgress: 242,
  isCreator: true,
  status: "active",
};

document.documentElement.classList.toggle("dark", requestedTheme === "dark");
document.documentElement.dataset.theme = requestedTheme === "dark" ? "ink" : "paper";
document.documentElement.style.colorScheme = requestedTheme;
document.documentElement.style.fontSize = requestedFontSize;

function ParticipantsLeaderboardReflowFixture() {
  const { language, setLanguage, t } = useLanguage();

  useEffect(() => {
    if (language !== requestedLanguage) setLanguage(requestedLanguage);
  }, [language, setLanguage]);

  if (language !== requestedLanguage) {
    return <p role="status">Loading locale…</p>;
  }

  return (
    <main
      className="min-h-[100dvh] overflow-x-hidden bg-background px-3 py-4 text-foreground"
      data-testid="participants-leaderboard-reflow-fixture"
      data-language={language}
      data-theme={requestedTheme}
    >
      <section
        aria-label={t.participants || "Participants"}
        className="mx-auto w-full max-w-md"
        data-testid="participants-leaderboard-card"
      >
        <ParticipantsLeaderboard
          challenge={CHALLENGE}
          t={t as unknown as Record<string, string>}
          username="ReflowFixtureOwner"
        />
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <LanguageProvider>
    <ParticipantsLeaderboardReflowFixture />
  </LanguageProvider>,
);
