import { useEffect } from "react";
import { createRoot } from "react-dom/client";

import "@/index.css";
import { HabitStreakTimeline } from "@/components/habit-hub/HabitStreakTimeline";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import type { Language } from "@/i18n/translations";
import type { HabitStreak } from "@/lib/habitScore";

const params = new URLSearchParams(window.location.search);
const requestedLanguage = (params.get("lang") || "en") as Language;
const requestedTheme = params.get("theme") === "dark" ? "dark" : "light";
const requestedFontSize = params.get("scale") === "200" ? "200%" : "100%";

const STREAKS: HabitStreak[] = [
  { start: "2026-07-29", end: "2026-08-09", length: 12 },
  { start: "2025-12-18", end: "2026-01-31", length: 45 },
  { start: "2025-09-03", end: "2025-10-14", length: 42 },
  { start: "2025-04-11", end: "2025-05-17", length: 37 },
  { start: "2024-11-23", end: "2024-12-28", length: 36 },
];

document.documentElement.classList.toggle("dark", requestedTheme === "dark");
document.documentElement.dataset.theme = requestedTheme === "dark" ? "ink" : "paper";
document.documentElement.style.colorScheme = requestedTheme;
document.documentElement.style.fontSize = requestedFontSize;

function HabitStreakTimelineReflowFixture() {
  const { language, setLanguage } = useLanguage();

  useEffect(() => {
    if (language !== requestedLanguage) setLanguage(requestedLanguage);
  }, [language, setLanguage]);

  if (language !== requestedLanguage) {
    return <p role="status">Loading locale…</p>;
  }

  return (
    <main
      className="min-h-[100dvh] overflow-x-hidden bg-background px-3 py-4 text-foreground"
      data-testid="habit-streak-timeline-reflow-fixture"
      data-language={language}
      data-theme={requestedTheme}
    >
      <section className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-3">
        <HabitStreakTimeline allStreaks={STREAKS} currentStreak={12} />
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <LanguageProvider>
    <HabitStreakTimelineReflowFixture />
  </LanguageProvider>,
);
