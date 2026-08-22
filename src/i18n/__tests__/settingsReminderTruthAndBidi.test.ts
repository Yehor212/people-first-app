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

const safeRefreshFailureDescriptions = {
  en: "The app could not refresh safely, so it stayed open. Wait a moment, then try again.",
  uk: "Не вдалося безпечно оновити застосунок, тому він залишився відкритим. Зачекайте трохи й спробуйте ще раз.",
  es: "La app no pudo actualizarse de forma segura, así que siguió abierta. Espera un momento y vuelve a intentarlo.",
  de: "Die App konnte nicht sicher aktualisiert werden und blieb daher geöffnet. Warte einen Moment und versuche es erneut.",
  fr: "L’app n’a pas pu s’actualiser en toute sécurité, elle est donc restée ouverte. Patientez un instant, puis réessayez.",
  ja: "安全に更新できなかったため、アプリを開いたままにしました。少し待ってから、もう一度お試しください。",
  ar: "تعذّر تحديث التطبيق بأمان، لذلك ظل مفتوحًا. انتظر قليلًا ثم حاول مرة أخرى.",
  he: "לא ניתן היה לרענן את האפליקציה בבטחה, ולכן היא נשארה פתוחה. המתינו רגע ונסו שוב.",
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

  it("does not claim that user changes were unsaved when a safe refresh is blocked", () => {
    for (const [language, translations] of Object.entries(locales)) {
      expect(
        translations.updateRequiredRefreshFailed,
        `${language}.updateRequiredRefreshFailed`,
      ).toBe(
        safeRefreshFailureDescriptions[
          language as keyof typeof safeRefreshFailureDescriptions
        ],
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

  it("documents both Apple-supported Safari install paths and isolates fixed LTR names", () => {
    const safariInstallPathTokens = {
      en: ["File > Add to Dock", "Share button"],
      uk: ["Файл", "Поширити"],
      es: ["Archivo", "Compartir"],
      de: ["Ablage", "Teilen"],
      fr: ["Fichier", "Partager"],
      ja: ["ファイル", "共有"],
      ar: ["ملف", "مشاركة"],
      he: ["קובץ", "שיתוף"],
    } as const;

    for (const [language, translations] of Object.entries(locales)) {
      for (const token of safariInstallPathTokens[
        language as keyof typeof safariInstallPathTokens
      ]) {
        expect(translations.installOnMacSafariSteps, `${language}.${token}`).toContain(token);
      }
    }

    for (const [language, translations] of Object.entries({ ar, he })) {
      expect(translations.installOnMac, `${language}.installOnMac.Mac`).toContain(
        "\u2066Mac\u2069",
      );
      for (const token of ["ZenFlow", "Safari", "Mac"]) {
        expect(
          translations.installOnMacStorageWarning,
          `${language}.installOnMacStorageWarning.${token}`,
        ).toContain(`\u2066${token}\u2069`);
      }
      for (const token of ["macOS Sonoma 14", "Safari", "Dock", "ZenFlow"]) {
        expect(
          translations.installOnMacSafariSteps,
          `${language}.installOnMacSafariSteps.${token}`,
        ).toContain(`\u2066${token}\u2069`);
      }
    }
  });

  it("states that a manual Safari recovery backup must be imported before account connection", () => {
    const preAccountImportTokens = {
      en: "import it before connecting an account",
      uk: "імпортуйте його до підключення акаунта",
      es: "impórtalo antes de conectar una cuenta",
      de: "importiere sie, bevor du ein Konto verbindest",
      fr: "importez-le avant de connecter un compte",
      ja: "アカウントに接続する前に読み込んでください",
      ar: "استوردها قبل ربط أي حساب",
      he: "ייבאו אותו לפני חיבור חשבון",
    } as const;

    for (const [language, translations] of Object.entries(locales)) {
      expect(
        translations.installOnMacStorageWarning,
        `${language}.installOnMacStorageWarning.accountBoundary`,
      ).toContain(preAccountImportTokens[language as keyof typeof preAccountImportTokens]);
    }
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
