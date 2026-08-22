import { useEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";

import "@/index.css";
import { HabitCalendar } from "@/components/stats/HabitCalendar";
import { CalendarGrid } from "@/components/stats/CalendarGrid";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import type { Language } from "@/i18n/translations";

const params = new URLSearchParams(window.location.search);
const requestedLanguage = (params.get("lang") || "en") as Language;
const requestedTheme = params.get("theme") === "dark" ? "dark" : "light";
const requestedFontSize = params.get("scale") === "200" ? "200%" : "100%";

document.documentElement.classList.toggle("dark", requestedTheme === "dark");
document.documentElement.dataset.theme = requestedTheme === "dark" ? "ink" : "paper";
document.documentElement.style.colorScheme = requestedTheme;
document.documentElement.style.fontSize = requestedFontSize;

function CalendarReflowFixture() {
  const { language, setLanguage, t } = useLanguage();
  const calendarDays = useMemo(
    () =>
      Array.from({ length: 35 }, (_, index) => ({
        dateKey: `2026-08-${String(index + 1).padStart(2, "0")}`,
        day: index + 1,
      })),
    [],
  );
  const monthNames = [
    t.january,
    t.february,
    t.march,
    t.april,
    t.may,
    t.june,
    t.july,
    t.august,
    t.september,
    t.october,
    t.november,
    t.december,
  ];

  useEffect(() => {
    if (language !== requestedLanguage) setLanguage(requestedLanguage);
  }, [language, setLanguage]);

  if (language !== requestedLanguage) {
    return <p role="status">Loading locale…</p>;
  }

  return (
    <main
      className="min-h-[100dvh] overflow-x-hidden bg-background px-3 py-4 text-foreground"
      data-testid="calendar-reflow-fixture"
      data-language={language}
      data-theme={requestedTheme}
    >
      <div className="mx-auto w-full max-w-md space-y-5">
        <section
          className="min-w-0 rounded-2xl border border-border/50 bg-card p-3"
          data-testid="calendar-grid-surface"
        >
          <h1 className="mb-3 break-words text-lg font-semibold">{t.calendarTitle}</h1>
          <CalendarGrid
            calendarDays={calendarDays}
            moodByDate={new Map()}
            focusMinutesByDate={new Map()}
            habitCompletionMap={new Map()}
            gratitudeByDate={new Map()}
            todayKey="2026-08-09"
            selectedDate="2026-08-09"
            onSelectDate={() => undefined}
            monthNames={monthNames}
            selectedMonth={7}
            selectedYear={2026}
            t={t as unknown as Record<string, string>}
          />
        </section>

        <section className="min-w-0" data-testid="habit-calendar-surface">
          <HabitCalendar habits={[]} />
        </section>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <LanguageProvider>
    <CalendarReflowFixture />
  </LanguageProvider>,
);
