import { readFileSync } from "node:fs";

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

const accountModeImportCopy = {
  en: "Backup import is available only while you use ZenFlow without a connected account.",
  uk: "Імпортувати резервну копію можна лише тоді, коли ви користуєтеся ZenFlow без підключеного акаунту.",
  es: "Solo puedes importar una copia de seguridad cuando usas ZenFlow sin una cuenta conectada.",
  de: "Ein Backup kannst du nur importieren, wenn du ZenFlow ohne verbundenes Konto nutzt.",
  fr: "Vous pouvez importer une sauvegarde uniquement lorsque vous utilisez ZenFlow sans compte connecté.",
  ja: "バックアップをインポートできるのは、アカウントを接続せずにZenFlowを使用している場合のみです。",
  ar: "لا يمكن استيراد نسخة احتياطية إلا عند استخدام \u2066ZenFlow\u2069 من دون حساب متصل.",
  he: "אפשר לייבא גיבוי רק כשמשתמשים ב-\u2066ZenFlow\u2069 ללא חשבון מחובר.",
} as const;

const accountScopedDeletionCopy = {
  en: "Deleting your account removes your ZenFlow sign-in, data saved with that account, and this account’s data from this device. This can’t be undone. Feedback you sent is stored separately and isn’t deleted automatically.",
  uk: "Після видалення акаунту ви більше не зможете входити з ним у ZenFlow. Дані, збережені в цьому акаунті, і дані цього акаунту на цьому пристрої буде видалено. Цю дію неможливо скасувати. Надіслані вами відгуки зберігаються окремо й не видаляються автоматично.",
  es: "Al eliminar tu cuenta, ya no podrás iniciar sesión con ella en ZenFlow. Se borrarán los datos guardados en esa cuenta y los datos de esa cuenta en este dispositivo. Esta acción no se puede deshacer. Los comentarios que hayas enviado se guardan por separado y no se eliminan automáticamente.",
  de: "Wenn du dein Konto löschst, kannst du dich damit nicht mehr bei ZenFlow anmelden. Die in diesem Konto gespeicherten Daten und die Daten dieses Kontos auf diesem Gerät werden gelöscht. Das lässt sich nicht rückgängig machen. Gesendetes Feedback wird getrennt gespeichert und nicht automatisch gelöscht.",
  fr: "Si vous supprimez votre compte, vous ne pourrez plus vous connecter à ZenFlow avec ce compte. Les données enregistrées dans ce compte et les données de ce compte sur cet appareil seront supprimées. Cette action est irréversible. Les retours que vous avez envoyés sont conservés séparément et ne sont pas supprimés automatiquement.",
  ja: "アカウントを削除すると、そのアカウントではZenFlowにサインインできなくなります。アカウントに保存されたデータと、この端末にあるそのアカウントのデータも削除されます。この操作は元に戻せません。送信したフィードバックは別に保存され、自動的には削除されません。",
  ar: "عند حذف حسابك، لن تتمكن من تسجيل الدخول إلى \u2066ZenFlow\u2069 باستخدامه. ستُحذف البيانات المحفوظة في هذا الحساب وبياناته من هذا الجهاز. لا يمكن التراجع عن ذلك. تُحفظ الملاحظات التي أرسلتها بشكل منفصل ولا تُحذف تلقائيًا.",
  he: "מחיקת החשבון תמנע כניסה ל-\u2066ZenFlow\u2069 באמצעותו. הנתונים שנשמרו בחשבון והנתונים שלו במכשיר הזה יימחקו. אי אפשר לבטל את הפעולה. המשוב ששלחת נשמר בנפרד ואינו נמחק אוטומטית.",
} as const;

const importedBackupChoiceCopy = {
  en: "ZenFlow will try to combine this backup with data in {account} and save the result there. If the first attempt fails, this backup will stay on this device. You can retry or continue and let ZenFlow retry automatically. After the data is combined, ZenFlow cannot separate it automatically.",
  uk: "ZenFlow спробує об’єднати цю резервну копію з даними в обліковому записі {account} і зберегти результат там. Якщо перша спроба не вдасться, резервна копія залишиться на цьому пристрої. Ви зможете повторити спробу або продовжити й дозволити ZenFlow повторити її автоматично. Після об’єднання ZenFlow не зможе автоматично розділити дані.",
  es: "ZenFlow intentará combinar esta copia de seguridad con los datos de {account} y guardar allí el resultado. Si el primer intento falla, esta copia permanecerá en este dispositivo. Puedes volver a intentarlo o continuar para que ZenFlow lo reintente automáticamente. Una vez combinados los datos, ZenFlow no podrá separarlos automáticamente.",
  de: "ZenFlow versucht, diese Sicherung mit den Daten in {account} zusammenzuführen und das Ergebnis dort zu speichern. Falls der erste Versuch fehlschlägt, bleibt diese Sicherung auf diesem Gerät. Du kannst es erneut versuchen oder fortfahren, damit ZenFlow es automatisch erneut versucht. Nach dem Zusammenführen kann ZenFlow die Daten nicht automatisch wieder trennen.",
  fr: "ZenFlow va essayer de fusionner cette sauvegarde avec les données de {account} et d’y enregistrer le résultat. Si la première tentative échoue, cette sauvegarde restera sur cet appareil. Vous pourrez réessayer ou continuer pour laisser ZenFlow réessayer automatiquement. Une fois les données fusionnées, ZenFlow ne pourra pas les séparer automatiquement.",
  ja: "ZenFlow は、このバックアップを {account} のデータと統合して結果を保存しようとします。最初の試行に失敗しても、このバックアップはこのデバイスに残ります。今すぐ再試行するか、そのまま続けると ZenFlow が自動で再試行します。データを統合した後は、自動で元に分けることはできません。",
  ar: "سيحاول ZenFlow دمج هذه النسخة الاحتياطية مع بيانات الحساب ⁨{account}⁩ وحفظ النتيجة فيه. إذا فشلت المحاولة الأولى، فستبقى هذه النسخة الاحتياطية على هذا الجهاز. يمكنك إعادة المحاولة أو المتابعة ليعيد ZenFlow المحاولة تلقائيًا. بعد دمج البيانات، لن يتمكن ZenFlow من فصلها تلقائيًا.",
  he: "ZenFlow ינסה למזג את הגיבוי הזה עם הנתונים בחשבון ⁨{account}⁩ ולשמור שם את התוצאה. אם הניסיון הראשון ייכשל, הגיבוי הזה יישאר במכשיר. אפשר לנסות שוב או להמשיך כדי ש-ZenFlow ינסה שוב אוטומטית. לאחר מיזוג הנתונים, ZenFlow לא יוכל להפריד אותם אוטומטית.",
} as const;

const importedBackupSaveFailureCopy = {
  en: "ZenFlow linked this backup to {account}, but could not finish combining and saving it online. This backup remains on this device. Retry now, or continue and let ZenFlow retry automatically.",
  uk: "ZenFlow пов’язав цю резервну копію з {account}, але не зміг завершити об’єднання та онлайн-збереження. Резервна копія залишається на цьому пристрої. Спробуйте ще раз зараз або продовжте, щоб ZenFlow повторив спробу автоматично.",
  es: "ZenFlow vinculó esta copia de seguridad a {account}, pero no pudo terminar de combinarla ni guardarla en línea. Esta copia permanece en este dispositivo. Inténtalo de nuevo ahora o continúa para que ZenFlow lo reintente automáticamente.",
  de: "ZenFlow hat diese Sicherung mit {account} verknüpft, konnte sie aber nicht vollständig zusammenführen und online speichern. Diese Sicherung bleibt auf diesem Gerät. Versuche es jetzt erneut oder fahre fort, damit ZenFlow es automatisch erneut versucht.",
  fr: "ZenFlow a lié cette sauvegarde à {account}, mais n’a pas pu terminer la fusion ni l’enregistrement en ligne. Cette sauvegarde reste sur cet appareil. Réessayez maintenant, ou continuez pour laisser ZenFlow réessayer automatiquement.",
  ja: "ZenFlow はこのバックアップを {account} に関連付けましたが、データの統合とオンライン保存を完了できませんでした。このバックアップはこのデバイスに残っています。今すぐ再試行するか、そのまま続けると ZenFlow が自動で再試行します。",
  ar: "ربط ZenFlow هذه النسخة الاحتياطية بالحساب ⁨{account}⁩، لكنه لم يتمكن من إكمال دمجها وحفظها عبر الإنترنت. تبقى هذه النسخة الاحتياطية على هذا الجهاز. أعد المحاولة الآن، أو تابع ليعيد ZenFlow المحاولة تلقائيًا.",
  he: "ZenFlow קישר את הגיבוי הזה לחשבון ⁨{account}⁩, אבל לא הצליח להשלים את המיזוג והשמירה המקוונת. הגיבוי הזה נשאר במכשיר. אפשר לנסות שוב עכשיו, או להמשיך כדי ש-ZenFlow ינסה שוב אוטומטית.",
} as const;

const placeholders = (value: string) =>
  Array.from(value.matchAll(/\{([^}]+)\}/gu), (match) => match[1]).sort();

describe("Settings account-boundary copy", () => {
  it("does not present signing out as a supported path to file import", () => {
    for (const [language, translations] of Object.entries(locales)) {
      expect(translations.importAccountUnavailable, language).toBe(
        accountModeImportCopy[language as keyof typeof accountModeImportCopy]
      );
    }
  });

  it("limits deletion claims to account-scoped data and discloses separately stored feedback", () => {
    for (const [language, translations] of Object.entries(locales)) {
      expect(translations.deleteAccountWarning, language).toBe(
        accountScopedDeletionCopy[language as keyof typeof accountScopedDeletionCopy]
      );
    }
  });

  it("describes imported-backup recovery without claiming an unproven merge", () => {
    for (const [language, translations] of Object.entries(locales)) {
      expect(translations.authImportedBackupAccountChoice, language).toBe(
        importedBackupChoiceCopy[language as keyof typeof importedBackupChoiceCopy]
      );
      expect(translations.authImportedBackupSaveFailed, language).toBe(
        importedBackupSaveFailureCopy[language as keyof typeof importedBackupSaveFailureCopy]
      );
    }
  });

  it("keeps the account deletion presenter wired to the truthful canonical fallback", () => {
    const accountPanel = readFileSync(
      "src/pages/nav-v2/settings/V2SettingsAccountPanel.tsx",
      "utf8"
    );
    const accountDeletion = readFileSync(
      "src/pages/nav-v2/settings/V2SettingsAccountDeletion.tsx",
      "utf8"
    );

    expect(accountPanel).toContain(
      'import { V2SettingsAccountDeletion } from "./V2SettingsAccountDeletion"'
    );
    expect(accountPanel).toContain("<V2SettingsAccountDeletion");
    expect(accountDeletion.replace(/\s+/g, " ")).toContain(
      `tx.deleteAccountWarning || ${JSON.stringify(en.deleteAccountWarning)}`
    );
  });

  it("keeps placeholders aligned across all eight locales", () => {
    for (const [language, translations] of Object.entries(locales)) {
      expect(
        placeholders(translations.importAccountUnavailable),
        `${language}.importAccountUnavailable`
      ).toEqual(placeholders(en.importAccountUnavailable));
      expect(
        placeholders(translations.deleteAccountWarning),
        `${language}.deleteAccountWarning`
      ).toEqual(placeholders(en.deleteAccountWarning));
      expect(
        placeholders(translations.authImportedBackupAccountChoice),
        `${language}.authImportedBackupAccountChoice`
      ).toEqual(placeholders(en.authImportedBackupAccountChoice));
      expect(
        placeholders(translations.authImportedBackupSaveFailed),
        `${language}.authImportedBackupSaveFailed`
      ).toEqual(placeholders(en.authImportedBackupSaveFailed));
    }
  });

  it("isolates the Latin brand name in Arabic and Hebrew without bidi overrides", () => {
    for (const [language, translations] of Object.entries({ ar, he })) {
      expect(translations.importAccountUnavailable, language).toContain("\u2066ZenFlow\u2069");
      expect(translations.deleteAccountWarning, language).toContain("\u2066ZenFlow\u2069");
      expect(translations.authImportedBackupAccountChoice, language).toContain(
        "⁨{account}⁩"
      );
      expect(translations.authImportedBackupSaveFailed, language).toContain("⁨{account}⁩");
      expect(translations.authImportedBackupDecisionSettled, language).toContain(
        "\u2066ZenFlow\u2069"
      );
      expect(translations.authImportedBackupRecoveryRequired, language).toContain(
        "\u2066ZenFlow\u2069"
      );
      expect(
        `${translations.importAccountUnavailable}\n${translations.deleteAccountWarning}\n${translations.authImportedBackupAccountChoice}\n${translations.authImportedBackupSaveFailed}\n${translations.authImportedBackupDecisionSettled}\n${translations.authImportedBackupRecoveryRequired}`,
        language
      ).not.toMatch(/[\u202A-\u202E]/u);
    }
  });
});
