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

  it("keeps English reminder copy and runtime fallbacks calm and evidence-scoped", () => {
    const en = read("src/i18n/languages/en.ts");
    const smartReminderI18n = readBlock(en, "// Smart Reminders", "// Sync status");
    const smartReminders = read("src/components/SmartRemindersCard.tsx");
    const copySources = `${smartReminderI18n}\n${smartReminders}`;

    expect(copySources).not.toMatch(
      /crush it|hero mode|high confidence|personalized(?: reminder)? suggestions|usage patterns|well optimized|great work|optimal habit times/i,
    );
    expect(en).toContain("A small step is enough. Ready when you are.");
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
});
