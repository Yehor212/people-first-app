import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ar } from "@/i18n/languages/ar";
import { de } from "@/i18n/languages/de";
import { en } from "@/i18n/languages/en";
import { es } from "@/i18n/languages/es";
import { fr } from "@/i18n/languages/fr";
import { he } from "@/i18n/languages/he";
import { ja } from "@/i18n/languages/ja";
import { uk } from "@/i18n/languages/uk";

describe("Planning action copy", () => {
  it("formats Planning numbers through the active locale and isolates user labels", () => {
    const pulse = readFileSync(
      "src/pages/nav-v2/planning/PlanningDayPulse.tsx",
      "utf8"
    );
    const review = readFileSync(
      "src/pages/nav-v2/planning/PlanningReviewLane.tsx",
      "utf8"
    );

    expect(pulse).toContain("new Intl.NumberFormat(language");
    expect(pulse).not.toContain("String(pulse.eventCount)");
    expect(review).toContain("new Intl.NumberFormat(language");
    expect(review).toMatch(/<bdi dir="auto"[\s\S]*?lastFocusSession\.label/);
    expect(review).not.toContain("` · ${lastFocusSession.label}`");
  });

  it("describes the immediate navigation effect in every shipped locale", () => {
    expect([
      [en.planningActionAddEvent, en.planningActionStartFocus],
      [uk.planningActionAddEvent, uk.planningActionStartFocus],
      [es.planningActionAddEvent, es.planningActionStartFocus],
      [de.planningActionAddEvent, de.planningActionStartFocus],
      [fr.planningActionAddEvent, fr.planningActionStartFocus],
      [ja.planningActionAddEvent, ja.planningActionStartFocus],
      [ar.planningActionAddEvent, ar.planningActionStartFocus],
      [he.planningActionAddEvent, he.planningActionStartFocus],
    ]).toEqual([
      ["Open schedule to add an event", "Open focus timer"],
      ["Відкрити розклад, щоб додати подію", "Відкрити таймер фокусу"],
      ["Abrir el horario para añadir un evento", "Abrir el temporizador de concentración"],
      ["Zeitplan öffnen, um einen Termin hinzuzufügen", "Fokus-Timer öffnen"],
      ["Ouvrir le planning pour ajouter un événement", "Ouvrir le minuteur de concentration"],
      ["予定を追加するためにスケジュールを開く", "集中タイマーを開く"],
      ["افتح الجدول لإضافة حدث", "افتح مؤقت التركيز"],
      ["פתיחת לוח הזמנים כדי להוסיף אירוע", "פתיחת טיימר הריכוז"],
    ]);
  });

  it("provides complete localized schedule-source and event-presence states", () => {
    expect([
      [en.scheduleDayHasEvents, en.googleCalendarEventsLoading, en.googleCalendarEventsUnavailable],
      [uk.scheduleDayHasEvents, uk.googleCalendarEventsLoading, uk.googleCalendarEventsUnavailable],
      [es.scheduleDayHasEvents, es.googleCalendarEventsLoading, es.googleCalendarEventsUnavailable],
      [de.scheduleDayHasEvents, de.googleCalendarEventsLoading, de.googleCalendarEventsUnavailable],
      [fr.scheduleDayHasEvents, fr.googleCalendarEventsLoading, fr.googleCalendarEventsUnavailable],
      [ja.scheduleDayHasEvents, ja.googleCalendarEventsLoading, ja.googleCalendarEventsUnavailable],
      [ar.scheduleDayHasEvents, ar.googleCalendarEventsLoading, ar.googleCalendarEventsUnavailable],
      [he.scheduleDayHasEvents, he.googleCalendarEventsLoading, he.googleCalendarEventsUnavailable],
    ]).toEqual([
      [
        "Events scheduled",
        "Loading Google Calendar events…",
        "Google Calendar events are unavailable right now.",
      ],
      [
        "Є заплановані події",
        "Завантажуємо події Google Календаря…",
        "Події Google Календаря зараз недоступні.",
      ],
      [
        "Hay eventos programados",
        "Cargando eventos de Google Calendar…",
        "Los eventos de Google Calendar no están disponibles ahora.",
      ],
      [
        "Termine vorhanden",
        "Google-Kalender-Termine werden geladen…",
        "Google-Kalender-Termine sind derzeit nicht verfügbar.",
      ],
      [
        "Des événements sont prévus",
        "Chargement des événements Google Agenda…",
        "Les événements Google Agenda sont indisponibles pour le moment.",
      ],
      [
        "予定があります",
        "Google カレンダーの予定を読み込んでいます…",
        "Google カレンダーの予定は現在利用できません。",
      ],
      [
        "توجد أحداث مجدولة",
        "جارٍ تحميل أحداث تقويم Google…",
        "أحداث تقويم Google غير متاحة الآن.",
      ],
      [
        "יש אירועים מתוכננים",
        "אירועי יומן Google נטענים…",
        "אירועי יומן Google אינם זמינים כרגע.",
      ],
    ]);
  });
});
