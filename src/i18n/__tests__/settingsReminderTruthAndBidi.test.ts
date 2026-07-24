import { describe, expect, it } from "vitest";

import { ar } from "../languages/ar";
import { de } from "../languages/de";
import { en } from "../languages/en";
import { es } from "../languages/es";
import { fr } from "../languages/fr";
import { he } from "../languages/he";
import { ja } from "../languages/ja";
import { uk } from "../languages/uk";

const locales = { en, uk, es, de, fr, ja, ar, he } as const;

const moodReminderDescriptions = {
  en: "Three reminders on each selected day: morning, afternoon, and evening.",
  uk: "Три нагадування в кожен вибраний день: вранці, удень і ввечері.",
  es: "Tres recordatorios cada día seleccionado: por la mañana, por la tarde y por la noche.",
  de: "Drei Erinnerungen an jedem ausgewählten Tag: morgens, nachmittags und abends.",
  fr: "Trois rappels chaque jour sélectionné : le matin, l’après-midi et le soir.",
  ja: "選択した各日に、朝・昼・夜の3回リマインダーが届きます。",
  ar: "ثلاثة تذكيرات في كل يوم محدد: صباحًا وظهرًا ومساءً.",
  he: "שלוש תזכורות בכל יום שנבחר: בבוקר, אחר הצהריים ובערב.",
} as const;

const restoredReminderDescriptions = {
  en: "ZenFlow couldn't apply the latest reminder change. Only reminders that are still enabled will keep their previous schedule.",
  uk: "ZenFlow не вдалося застосувати останню зміну нагадувань. Попередній розклад зберігається лише для нагадувань, які досі ввімкнені.",
  es: "ZenFlow no pudo aplicar el último cambio de recordatorios. Solo los recordatorios que siguen activados conservan su horario anterior.",
  de: "ZenFlow konnte die letzte Erinnerungsänderung nicht übernehmen. Nur weiterhin aktivierte Erinnerungen behalten ihren bisherigen Zeitplan.",
  fr: "ZenFlow n’a pas pu appliquer la dernière modification des rappels. Seuls les rappels encore activés conservent leur ancien horaire.",
  ja: "最新のリマインダー変更を適用できませんでした。以前のスケジュールが維持されるのは、引き続き有効なリマインダーだけです。",
  ar: "تعذّر على ZenFlow تطبيق آخر تغيير على التذكيرات. لا تحتفظ بالجدول السابق سوى التذكيرات التي لا تزال مفعّلة.",
  he: "ZenFlow לא הצליח להחיל את השינוי האחרון בתזכורות. רק תזכורות שעדיין מופעלות ישמרו על לוח הזמנים הקודם שלהן.",
} as const;

describe("Settings reminder truth and RTL isolation", () => {
  it("states that mood check-ins create three reminders on every selected day", () => {
    for (const [language, translations] of Object.entries(locales)) {
      expect(
        translations.settingsMoodCheckInsDescription,
        `${language}.settingsMoodCheckInsDescription`,
      ).toBe(moodReminderDescriptions[language as keyof typeof moodReminderDescriptions]);
    }
  });

  it("limits restored-schedule claims to reminders that remain enabled", () => {
    for (const [language, translations] of Object.entries(locales)) {
      expect(
        translations.reminderReconcileRestored,
        `${language}.reminderReconcileRestored`,
      ).toBe(
        restoredReminderDescriptions[language as keyof typeof restoredReminderDescriptions],
      );
    }
  });

  it("isolates fixed LTR report abbreviations and restore limits in Arabic and Hebrew", () => {
    for (const [language, translations] of Object.entries({ ar, he })) {
      expect(
        translations.settingsReportsDescription,
        `${language}.settingsReportsDescription PDF`,
      ).toContain("\u2066PDF\u2069");
      expect(
        translations.settingsReportSpreadsheetAction,
        `${language}.settingsReportSpreadsheetAction CSV`,
      ).toContain("\u2066CSV\u2069");
      expect(
        translations.settingsReportProgressAction,
        `${language}.settingsReportProgressAction PDF`,
      ).toContain("\u2066PDF\u2069");
    }

    expect(ar.exportBackupTooLarge).toContain("\u206832\u2069");
    expect(ar.fileTooLarge).toContain("\u206832\u2069");
    expect(he.exportBackupTooLarge).toContain("\u206632 MB\u2069");
    expect(he.fileTooLarge).toContain("\u206632 MB\u2069");
  });

  it("isolates numeric Settings placeholders in Arabic and Hebrew", () => {
    const numericPlaceholders = {
      settingsDataSummary: ["moods", "habits", "focus"],
      importResultSummary: [
        "added",
        "updated",
        "skipped",
        "journalEntries",
        "journalPhotos",
        "journalAudio",
      ],
    } as const;

    for (const [language, translations] of Object.entries({ ar, he })) {
      for (const [key, placeholders] of Object.entries(numericPlaceholders)) {
        const value = translations[key as keyof typeof numericPlaceholders];
        for (const placeholder of placeholders) {
          expect(value, `${language}.${key}.${placeholder}`).toContain(
            `\u2068{${placeholder}}\u2069`,
          );
        }
      }
    }
  });
});
