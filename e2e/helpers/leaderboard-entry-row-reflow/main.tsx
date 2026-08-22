import { useEffect } from "react";
import { createRoot } from "react-dom/client";

import "@/index.css";
import { LeaderboardEntryRow } from "@/components/leaderboard/LeaderboardEntryRow";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import type { Language } from "@/i18n/translations";
import type { LeaderboardEntry } from "@/lib/leaderboard";

const params = new URLSearchParams(window.location.search);
const requestedLanguage = (params.get("lang") || "en") as Language;
const requestedTheme = params.get("theme") === "dark" ? "dark" : "light";
const requestedFontSize = params.get("scale") === "200" ? "200%" : "100%";

const SYNTHETIC_NAMES: Record<Language, string> = {
  en: "ReflowParticipant01",
  uk: "ТестУчасникМакет01",
  es: "ParticipantePrueba01",
  de: "LayoutTestPerson01",
  fr: "ParticipantTest01",
  ja: "レイアウト確認参加者01",
  ar: "مشاركاختبارالتدفق01",
  he: "משתתףבדיקתפריסה01",
};

document.documentElement.classList.toggle("dark", requestedTheme === "dark");
document.documentElement.dataset.theme = requestedTheme === "dark" ? "ink" : "paper";
document.documentElement.style.colorScheme = requestedTheme;
document.documentElement.style.fontSize = requestedFontSize;

function buildEntries(language: Language): LeaderboardEntry[] {
  return Array.from({ length: 5 }, (_, index) => ({
    id: `reflow-entry-${index + 1}`,
    userId: `reflow-user-${index + 1}`,
    displayName:
      index === 3 ? SYNTHETIC_NAMES[language] : `ReflowProbe${String(index + 1).padStart(2, "0")}`,
    weeklyXp: 987_654 - index * 12_345,
    monthlyXp: 8_765_432 - index * 123_456,
    allTimeXp: 98_765_432 - index * 1_234_567,
    currentStreak: 365 - index * 37,
    longestStreak: 730 - index * 41,
    optIn: true,
    rank: index + 1,
    isCurrentUser: index === 3,
  }));
}

function LeaderboardEntryRowReflowFixture() {
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
      data-testid="leaderboard-entry-row-reflow-fixture"
      data-language={language}
      data-theme={requestedTheme}
    >
      <section
        aria-label={t.leaderboard || "Leaderboard"}
        className="mx-auto w-full max-w-md space-y-2 rounded-2xl border border-border bg-card p-2"
        data-testid="leaderboard-entry-row-card"
      >
        {buildEntries(language).map((entry, index) => (
          <LeaderboardEntryRow
            key={entry.id}
            activeTab="streak"
            entry={entry}
            index={index}
            t={t as unknown as Record<string, string>}
          />
        ))}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <LanguageProvider>
    <LeaderboardEntryRowReflowFixture />
  </LanguageProvider>,
);
