import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SUPPORT_EMAIL = "zenflow.app@gmail.com";
const LEGACY_CONTACTS = ["egorsamraev@gmail.com", "zenflowtrack@gmail.com"];

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function readBlock(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Expected block ${startMarker}..${endMarker}`);
  }
  return source.slice(start, end);
}

describe("Settings trust copy", () => {
  it("keeps public legal pages readable and aligned on one support address", () => {
    const pages = ["public/privacy.html", "public/privacy-policy.html", "public/terms.html", "public/delete-account.html"];

    for (const page of pages) {
      const html = read(page);
      expect(html).toContain(`mailto:${SUPPORT_EMAIL}`);
      for (const legacyContact of LEGACY_CONTACTS) {
        expect(html).not.toContain(legacyContact);
      }
    }

    const terms = read("public/terms.html");
    expect(terms).toContain("Terms of Service - ZenFlow");
    for (const mojibake of ["РЈ", "Рџ", "Р’", "вЂ", "СЃ"]) {
      expect(terms).not.toContain(mojibake);
    }
  });

  it("uses the same support address for feedback email defaults", () => {
    const edgeFunction = read("supabase/functions/send-feedback-email/index.ts");
    expect(edgeFunction).toContain(`default: ${SUPPORT_EMAIL}`);
    expect(edgeFunction).toContain(`|| "${SUPPORT_EMAIL}"`);
    for (const legacyContact of LEGACY_CONTACTS) {
      expect(edgeFunction).not.toContain(legacyContact);
    }
  });

  it("explains feedback data use without logging the raw feedback payload", () => {
    const form = read("src/components/FeedbackForm.tsx");
    expect(form).toContain("feedbackPrivacyNotice");
    expect(form).not.toContain("logger.log(\"[Feedback] Submitting:\"");
  });

  it("keeps public privacy copy aligned with the retired analytics controls", () => {
    const privacy = read("public/privacy.html");
    const privacyAlias = read("public/privacy-policy.html");

    expect(privacyAlias).toBe(privacy);
    expect(privacy).not.toMatch(/audio comfort feedback/i);
    expect(privacy).not.toMatch(/no-tracking mode|no-tracking exceptions/i);
    expect(privacy).toContain(
      "ZenFlow does not initialize its optional in-app behavioral analytics runtime.",
    );
    expect(privacy).toContain(
      "The optional Habits-list banner is controlled separately through the Optional ads setting",
    );
    expect(privacy).not.toMatch(/rewarded ads|rewarded video/i);
  });

  it("disables automatic Firebase Analytics collection in the Android app artifact", () => {
    const manifest = read("android/app/src/main/AndroidManifest.xml");

    expect(manifest).toMatch(
      /android:name="firebase_analytics_collection_enabled"\s+android:value="false"/,
    );
  });

  it("keeps English reminder copy and runtime fallbacks calm and evidence-scoped", () => {
    const en = read("src/i18n/languages/en.ts");
    const smartReminderI18n = readBlock(en, "// Smart Reminders", "// Sync status");
    const smartReminders = read("src/components/SmartRemindersCard.tsx");
    const copySources = `${smartReminderI18n}\n${smartReminders}`;

    expect(copySources).not.toMatch(
      /crush it|hero mode|high confidence|personalized(?: reminder)? suggestions|usage patterns|well optimized|great work|optimal habit times/i,
    );
    expect(en).toContain("If you'd like, note how you're feeling.");
    expect(copySources).toContain("Stronger signal");
    expect(copySources).toContain("Suggestions based on recent app activity");
    expect(copySources).toContain("Suggested habit times");
  });

  it("keeps localized Smart Reminder copy calm and evidence-scoped", () => {
    const localeExpectations = [
      {
        file: "src/i18n/languages/uk.ts",
        expected: [
          "нещодавньої активності",
          "відповідає вашим останнім патернам",
          "Сильніший сигнал",
          "Запропонований час для звичок",
        ],
        forbidden: ["персоналізовані", "оптимальний", "Висока впевненість", "Чудова робота"],
      },
      {
        file: "src/i18n/languages/es.ts",
        expected: [
          "actividad reciente",
          "coinciden con tus patrones recientes",
          "Señal más fuerte",
          "Horarios sugeridos para hábitos",
        ],
        forbidden: ["personalizadas", "bien optimizados", "Alta confianza", "óptimos"],
      },
      {
        file: "src/i18n/languages/de.ts",
        expected: [
          "aktueller Aktivität",
          "passen zu deinen jüngsten Mustern",
          "Stärkeres Signal",
          "Vorgeschlagene Gewohnheitszeiten",
        ],
        forbidden: ["personalisierte", "gut optimiert", "Hohe Sicherheit", "Optimale"],
      },
      {
        file: "src/i18n/languages/fr.ts",
        expected: [
          "activité récente",
          "correspondent à vos habitudes récentes",
          "Signal plus fort",
          "Horaires d'habitudes suggérés",
        ],
        forbidden: ["personnalisées", "bien optimisés", "Haute confiance", "optimaux"],
      },
      {
        file: "src/i18n/languages/ja.ts",
        expected: ["最近のアクティビティ", "最近のパターン", "より強いシグナル", "提案された習慣時間"],
        forbidden: ["パーソナル", "最適化", "高信頼度", "最適な習慣時間"],
      },
      {
        file: "src/i18n/languages/ar.ts",
        expected: ["النشاط الأخير", "أنماطك الأخيرة", "إشارة أقوى", "أوقات مقترحة للعادات"],
        forbidden: ["محسنة", "ثقة عالية", "أوقات مثلى"],
      },
      {
        file: "src/i18n/languages/he.ts",
        expected: ["פעילות אחרונה", "לדפוסים האחרונים", "סימן חזק יותר", "שעות מוצעות להרגלים"],
        forbidden: ["מותאמות היטב", "ביטחון גבוה", "אופטימליות", "עבודה מצוינת"],
      },
    ];

    for (const { file, expected, forbidden } of localeExpectations) {
      const source = read(file);
      const block = readBlock(source, "// Smart Reminders", "// Sync");

      for (const phrase of expected) {
        expect(block, `${file} should include ${phrase}`).toContain(phrase);
      }
      for (const phrase of forbidden) {
        expect(block, `${file} should not include ${phrase}`).not.toContain(phrase);
      }
    }
  });

  it("keeps V2 account copy separate from shared sync copy", () => {
    const settingsPage = read("src/pages/nav-v2/SettingsPage.tsx");
    const overviewModules = read(
      "src/pages/nav-v2/settings/useSettingsOverviewModules.ts",
    );
    const accountPanel = read("src/pages/nav-v2/settings/V2SettingsAccountPanel.tsx");
    const v2AccountSources = `${settingsPage}\n${overviewModules}\n${accountPanel}`;

    for (const required of [
      "settingsAccountBackupTitle",
      "settingsAccountBackupDescription",
      "settingsAccountSignedIn",
      "settingsAccountSignedOut",
      "settingsAccountDataOnDevice",
      "settingsAccountBackupChecking",
      "settingsAccountBackupCheckingDescription",
      "settingsAccountBackupUnavailable",
      "settingsAccountBackupUnavailableDescription",
    ]) {
      expect(v2AccountSources).toContain(required);
    }
    expect(v2AccountSources).not.toMatch(/\bsettingsCloudSync[A-Za-z0-9_]*/);
    expect(v2AccountSources).not.toMatch(/\b(?:is|has been) backed up\b/i);
    for (const forbidden of [
      "settingsGroupAccountSync",
      "settingsAccountBackupEnabled",
      "sessionExpiredSettings",
      "localDataSafe",
      "weeklyDigestTitle",
      "useAccountSync",
    ]) {
      expect(v2AccountSources).not.toContain(forbidden);
    }
  });

  it("keeps native reminder recovery out of web and removes dead quick actions", () => {
    const source = read("src/pages/nav-v2/settings/V2SettingsNotificationsPanel.tsx");

    expect(source).toContain("if (!isNative) return null;");
    expect(source).toContain("<NotificationSystemGuidance");
    expect(source).toContain('title={tx.settingsGroupReminders || "Reminders"}');
    for (const forbidden of [
      "useQuickActions",
      "quickActions.",
      "settings-v2-quick-actions-toggle",
    ]) {
      expect(source).not.toContain(forbidden);
    }
    expect(source).not.toMatch(/\bZap\b/);
  });

  it("keeps V2 sound choices and diary availability truthful", () => {
    const sound = read("src/pages/nav-v2/settings/V2SettingsSoundPanel.tsx");
    const diary = read("src/features/journal/JournalAmbienceSetting.tsx");

    expect(sound).toContain("settingsSoundBackgroundTitle");
    expect(sound).toContain("settingsSoundActivityTitle");
    expect(sound).not.toContain("applyProfile");
    expect(sound).not.toContain("profileMatchesEffectiveSettings");
    expect(sound).not.toContain("settingsSoundProfileRich");
    expect(sound).not.toContain("settingsSoundProfileRichDesc");
    expect(diary).toContain("settingsSoundDiaryRainOff");
    expect(diary).toContain("useUserStartedAmbienceAudio");
    expect(diary).toContain('preload="none"');
    expect(diary).not.toContain("settingsSoundFeedbackOn");
    expect(diary).not.toContain("settingsSoundFeedbackOff");
  });

  it("keeps the V2 privacy description separate from legacy security copy", () => {
    const source = read("src/pages/nav-v2/settings/V2SettingsPrivacyPanel.tsx");

    expect(source).toContain("settingsPrivacyDataDescription");
    expect(source).not.toContain("settingsSecurityDesc");
  });

  it("keeps V2 privacy fallbacks aligned with the approved Settings copy", () => {
    const privacy = read("src/pages/nav-v2/settings/V2SettingsPrivacyPanel.tsx");
    const reminders = read("src/pages/nav-v2/settings/V2SettingsNotificationsPanel.tsx");

    for (const expected of [
      'title={tx.privacyAds || "Habit list banner"}',
      "Shows a small banner below your habit list after you turn it on.",
      "It stays out of mood check-ins, journal, focus, and menus.",
    ]) {
      expect.soft(privacy).toContain(expected);
    }
    for (const expected of [
      'title={tx.privacyPushNotifications || "Account reminders"}',
      "Receive reminders from your account on this device. Reminders you set here work separately.",
    ]) {
      expect.soft(reminders).toContain(expected);
    }
    for (const legacy of [
      'title={tx.privacyAds || "Rewarded ads"}',
      'title={tx.privacyAds || "Rewarded videos"}',
      "Optional videos only. Ad requests stay off unless this is enabled",
      'title={tx.privacyPushNotifications || "Remote push notifications"}',
      "Register this device for account-based push reminders",
    ]) {
      expect.soft(`${privacy}\n${reminders}`).not.toContain(legacy);
    }
    expect(privacy).not.toContain("privacyPushNotifications");
  });

  it("keeps backup and report actions distinct without rewiring handlers", () => {
    const source = read("src/pages/nav-v2/settings/V2SettingsDataPanels.tsx");

    for (const required of [
      "settings-v2-backup-restore-group",
      "settings-v2-reports-group",
      "exp.handleExport()",
      "exp.handleExportCSV",
      "exp.handleExportPDF()",
      "imp.handleImportClick",
    ]) {
      expect(source).toContain(required);
    }
    expect(source).not.toContain("tx.exportCSV");
    expect(source).not.toContain("tx.exportPDF");
  });

  it("keeps V2 help, license, and update fallbacks modest and actionable", () => {
    const source = read("src/pages/nav-v2/settings/V2SettingsAboutPanel.tsx");

    for (const required of [
      '"Help and information"',
      '"Send feedback"',
      '"Licenses"',
      '"Check for updates"',
    ]) {
      expect(source).toContain(required);
    }
    expect(source).not.toMatch(/Open-source library licenses|all libraries|complete license/i);
  });
});
