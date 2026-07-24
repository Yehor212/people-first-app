import { describe, expect, it } from "vitest";

import { ar } from "@/i18n/languages/ar";
import { de } from "@/i18n/languages/de";
import { en } from "@/i18n/languages/en";
import { es } from "@/i18n/languages/es";
import { fr } from "@/i18n/languages/fr";
import { he } from "@/i18n/languages/he";
import { ja } from "@/i18n/languages/ja";
import { uk } from "@/i18n/languages/uk";

describe("automatic session timeout copy", () => {
  it.each([
    [en, "Automatic sign-out delayed"],
    [uk, "Автоматичний вихід відкладено"],
    [es, "Cierre de sesión automático aplazado"],
    [de, "Automatische Abmeldung verzögert"],
    [fr, "Déconnexion automatique reportée"],
    [ja, "自動ログアウトを延期しました"],
    [ar, "تأخر تسجيل الخروج التلقائي"],
    [he, "היציאה האוטומטית נדחתה"],
  ])("identifies the delayed action as automatic", (translations, expectedTitle) => {
    expect(translations.sessionTimeoutDelayedTitle).toBe(expectedTitle);
  });

  it.each([en, uk, es, de, fr, ja, ar, he])(
    "keeps automatic sign-out distinct from a manual sign-out recovery",
    (translations) => {
      expect(translations.sessionTimeoutDelayedTitle).not.toBe(
        translations.authSignOutRecoveryTitle,
      );
    },
  );

  it.each([
    [
      en,
      "ZenFlow kept you signed in because automatic sign-out could not finish safely. It will try again soon.",
    ],
    [
      uk,
      "Ви залишилися в системі, бо ZenFlow не вдалося безпечно завершити автоматичний вихід. Незабаром він спробує ще раз.",
    ],
    [
      es,
      "ZenFlow mantuvo tu sesión abierta porque no pudo completar el cierre de sesión automático de forma segura. Volverá a intentarlo pronto.",
    ],
    [
      de,
      "ZenFlow hat dich angemeldet gelassen, weil die automatische Abmeldung nicht sicher abgeschlossen werden konnte. Ein neuer Versuch folgt in Kürze.",
    ],
    [
      fr,
      "ZenFlow vous a laissé connecté, car la déconnexion automatique n’a pas pu se terminer en toute sécurité. Une nouvelle tentative aura lieu bientôt.",
    ],
    [
      ja,
      "自動ログアウトを安全に完了できなかったため、サインインしたままにしました。まもなく再試行します。",
    ],
    [
      ar,
      "أبقاك ZenFlow مسجّلًا لأنه تعذّر إكمال تسجيل الخروج التلقائي بأمان. سيحاول مرة أخرى قريبًا.",
    ],
    [
      he,
      "ZenFlow השאיר אותך מחובר כי לא ניתן היה להשלים את היציאה האוטומטית בבטחה. ניסיון נוסף יתבצע בקרוב.",
    ],
  ])("describes the sign-out outcome without implying device erasure", (translations, expected) => {
    expect(translations.sessionTimeoutCleanupFailed).toBe(expected);
  });
});
