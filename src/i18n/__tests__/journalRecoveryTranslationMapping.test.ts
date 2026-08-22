import { describe, expect, it } from "vitest";

import { ar } from "../languages/ar";
import { de } from "../languages/de";
import { en } from "../languages/en";
import { es } from "../languages/es";
import { fr } from "../languages/fr";
import { he } from "../languages/he";
import { ja } from "../languages/ja";
import { uk } from "../languages/uk";

const recoveryCopy = {
  en: {
    fresh: "Verify this account again before removing diary protection. Nothing was changed.",
    verified: "Account verified",
    partial:
      "Diary protection is off on this device. Cleanup for biometric unlock and your other signed-in devices is still pending. Keep the app open, stay signed in, and try again when online.",
  },
  uk: {
    fresh:
      "Перш ніж вимикати захист щоденника, ще раз підтвердьте цей акаунт. Нічого не змінилося.",
    verified: "Акаунт підтверджено",
    partial:
      "На цьому пристрої захист щоденника вимкнено. Очищення біометричного розблокування та зміна для інших ваших пристроїв ще тривають. Залиште застосунок відкритим, не виходьте з акаунта й повторіть спробу після підключення до інтернету.",
  },
  es: {
    fresh:
      "Verifica de nuevo esta cuenta antes de quitar la protección del diario. No se cambió nada.",
    verified: "Cuenta verificada",
    partial:
      "La protección del diario está desactivada en este dispositivo. La limpieza del desbloqueo biométrico y el cambio para tus otros dispositivos siguen pendientes. Mantén la aplicación abierta, no cierres sesión e inténtalo de nuevo cuando tengas conexión.",
  },
  de: {
    fresh:
      "Bestätige dieses Konto erneut, bevor du den Tagebuchschutz entfernst. Es wurde nichts geändert.",
    verified: "Konto bestätigt",
    partial:
      "Der Tagebuchschutz ist auf diesem Gerät ausgeschaltet. Die Bereinigung der biometrischen Entsperrung und die Änderung für deine anderen Geräte stehen noch aus. Lass die App geöffnet, bleib angemeldet und versuche es mit Internetverbindung erneut.",
  },
  fr: {
    fresh:
      "Vérifiez de nouveau ce compte avant de retirer la protection du journal. Rien n’a été modifié.",
    verified: "Compte vérifié",
    partial:
      "La protection du journal est désactivée sur cet appareil. Le nettoyage du déverrouillage biométrique et la modification pour vos autres appareils restent à terminer. Gardez l’application ouverte, restez connecté et réessayez avec une connexion internet.",
  },
  ja: {
    fresh:
      "日記の保護を解除する前に、このアカウントをもう一度確認してください。変更は行われていません。",
    verified: "アカウントを確認しました",
    partial:
      "この端末では日記の保護が解除されています。生体認証の後処理と他のログイン済み端末への反映が残っています。アプリを開いたままログイン状態を保ち、インターネット接続後にもう一度お試しください。",
  },
  ar: {
    fresh: "تحقق من هذا الحساب مرة أخرى قبل إزالة حماية اليوميات. لم يتغير شيء.",
    verified: "تم التحقق من الحساب",
    partial:
      "تم إيقاف حماية اليوميات على هذا الجهاز. ما زال تنظيف الفتح بالمقاييس الحيوية وتطبيق التغيير على أجهزتك الأخرى معلقين. أبقِ التطبيق مفتوحًا وحسابك مسجّلًا، ثم حاول مجددًا عند الاتصال بالإنترنت.",
  },
  he: {
    fresh: "יש לאמת שוב את החשבון הזה לפני הסרת הגנת היומן. לא בוצע שום שינוי.",
    verified: "החשבון אומת",
    partial:
      "הגנת היומן כבויה במכשיר הזה. ניקוי הפתיחה הביומטרית והשינוי במכשירים האחרים שלך עדיין ממתינים. השאר את האפליקציה פתוחה, הישאר מחובר ונסה שוב כשיש חיבור לאינטרנט.",
  },
} as const;

const locales = { en, uk, es, de, fr, ja, ar, he } as const;

describe("journal recovery translation mapping", () => {
  it.each(Object.keys(locales) as Array<keyof typeof locales>)(
    "keeps security and partial-success copy bound to the intended %s keys",
    (language) => {
      const translations = locales[language];
      const expected = recoveryCopy[language];

      expect(translations.journalLockRemoveFreshAuth).toBe(expected.fresh);
      expect(translations.journalLockReauthVerifiedTitle).toBe(expected.verified);
      expect(translations.journalLockRemovePartialBoth).toBe(expected.partial);
    }
  );
});
