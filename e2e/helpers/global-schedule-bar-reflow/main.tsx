import { useEffect } from "react";
import { createRoot } from "react-dom/client";

import "@/index.css";
import { GlobalScheduleBar } from "@/components/GlobalScheduleBar";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import type { Language } from "@/i18n/translations";
import type { ScheduleEvent } from "@/types";

const params = new URLSearchParams(window.location.search);
const requestedLanguage = (params.get("lang") || "en") as Language;
const requestedTheme = params.get("theme") === "dark" ? "dark" : "light";
const requestedFontSize = params.get("scale") === "200" ? "200%" : "100%";

const EVENT_TITLES: Record<Language, string> = {
  en: "Deep planning review without losing the next step",
  uk: "Детальний перегляд плану без втрати наступного кроку",
  es: "Revisión detallada del plan sin perder el siguiente paso",
  de: "Ausführliche Planungsübersicht ohne den nächsten Schritt zu verlieren",
  fr: "Révision détaillée du planning sans perdre la prochaine étape",
  ja: "次のステップを見失わないための詳しい計画レビュー",
  ar: "مراجعة تفصيلية للخطة من دون فقدان الخطوة التالية",
  he: "סקירה מפורטת של התכנון בלי לאבד את הצעד הבא",
};

document.documentElement.classList.toggle("dark", requestedTheme === "dark");
document.documentElement.dataset.theme = requestedTheme === "dark" ? "ink" : "paper";
document.documentElement.style.colorScheme = requestedTheme;
document.documentElement.style.fontSize = requestedFontSize;

function GlobalScheduleBarReflowFixture() {
  const { language, setLanguage } = useLanguage();

  useEffect(() => {
    if (language !== requestedLanguage) setLanguage(requestedLanguage);
  }, [language, setLanguage]);

  if (language !== requestedLanguage) {
    return <p role="status">Loading locale…</p>;
  }

  const currentEvent: ScheduleEvent = {
    id: "reflow-current-event",
    title: EVENT_TITLES[language],
    emoji: "🧭",
    startHour: 0,
    startMinute: 0,
    endHour: 24,
    endMinute: 0,
    color: "var(--primary)",
    date: "2026-08-09",
  };

  return (
    <main
      className="min-h-[100dvh] overflow-x-hidden bg-background px-3 py-4 text-foreground"
      data-testid="global-schedule-bar-reflow-fixture"
      data-language={language}
      data-theme={requestedTheme}
      data-event-title={currentEvent.title}
    >
      <div className="mx-auto w-full max-w-md space-y-3">
        <h1 className="break-words text-lg font-semibold">ZenFlow schedule summary</h1>
        <GlobalScheduleBar events={[currentEvent]} onTap={() => undefined} />
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <LanguageProvider>
    <GlobalScheduleBarReflowFixture />
  </LanguageProvider>,
);
