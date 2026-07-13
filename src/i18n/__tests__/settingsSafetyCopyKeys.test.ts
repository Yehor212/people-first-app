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
const timeoutKeys = [
  "journalLockTimeoutImmediately",
  "journalLockTimeoutOneMinute",
  "journalLockTimeoutFiveMinutes",
  "journalLockTimeoutFifteenMinutes",
  "journalLockTimeoutThirtyMinutes",
] as const;
const backupsReportsHeadings = {
  en: "Backups & reports",
  uk: "Резервні копії та звіти",
  es: "Copias de seguridad e informes",
  de: "Backups und Berichte",
  fr: "Sauvegardes et rapports",
  ja: "バックアップとレポート",
  ar: "النسخ الاحتياطية والتقارير",
  he: "גיבויים ודוחות",
} as const;
const remindersNativeOnly = {
  en: "To set reminders, open the ZenFlow mobile app.",
  uk: "Щоб налаштувати нагадування, відкрийте мобільний застосунок ZenFlow.",
  es: "Para configurar los recordatorios, abre la app móvil de ZenFlow.",
  de: "Richte Erinnerungen in der mobilen ZenFlow-App ein.",
  fr: "Pour régler les rappels, ouvrez l’app mobile ZenFlow.",
  ja: "リマインダーはモバイル版ZenFlowで設定できます。",
  ar: "يمكن إعداد التذكيرات في تطبيق ZenFlow للهاتف.",
  he: "אפשר להגדיר תזכורות באפליקציית ZenFlow לנייד.",
} as const;
const groundedSettingsCopyKeys = [
  "profileNamePlaceholder",
  "settingsAboutProductSummary",
  "themeAdvancedAppearanceTitle",
] as const;
const changedExistingCopyKeys = [
  "settingsOverviewDescription",
  "settingsGroupHelpAbout",
  "remindersDescription",
  "remindersNativeOnly",
  "pushPermissionDenied",
  "notificationSystemSettingsTitle",
  "notificationSystemSettingsAndroidDescription",
  "notificationSystemSettingsIosDescription",
  "settingsSoundDescription",
  "settingsSoundMasterDesc",
  "settingsSoundComfortTitle",
  "settingsSoundComfortDescription",
  "settingsSoundProfileQuiet",
  "settingsSoundProfileQuietDesc",
  "settingsSoundProfileBalanced",
  "settingsSoundProfileBalancedDesc",
  "settingsSoundAmbientToggleDesc",
  "settingsSoundAmbienceTitle",
  "settingsSoundAmbienceNote",
  "settingsSoundCompletionCues",
  "settingsSoundCompletionCuesDesc",
  "settingsSoundReminderCues",
  "settingsSoundReminderCuesDesc",
  "settingsSoundMilestoneCues",
  "settingsSoundMilestoneCuesDesc",
  "settingsSoundTextureTitle",
  "settingsSoundTextureDescription",
  "settingsSoundAmbientOff",
  "themeStyleDescription",
  "themeAccentDescription",
  "privacyAds",
  "privacyAdsHint",
  "privacyPushNotifications",
  "privacyPushNotificationsHint",
  "settingsExportImportTitle",
  "settingsExportTitle",
  "settingsImportTitle",
  "importMode",
  "importMerge",
  "importReplace",
  "importConfirmTitle",
  "importConfirmMessage",
  "settingsImportReplaceTooltip",
  "settingsAboutSupportLegalTitle",
  "settingsAboutSupportLegalDescription",
  "settingsWebUpdateDescription",
  "settingsNativeUpdateDescription",
  "openSourceLicenses",
] as const;
const newV2Keys = [
  "themeModeTitle",
  "themeModeDescription",
  "themeBlack",
  "themeChangeSaved",
  "settingsPreferenceSaveError",
  "settingsReduceMotion",
  "settingsReduceMotionDescription",
  "settingsReduceMotionSystemDescription",
  "settingsOverviewDescriptionWithoutReminders",
  "settingsReminderDaysMissing",
  "settingsSoundRestoreTitle",
  "settingsSoundRestoreDescription",
  "settingsSoundRestoreAction",
  "settingsSoundMasterDisabledHint",
  "settingsMoodCheckIns",
  "settingsMoodCheckInsDescription",
  "settingsFocusReminder",
  "settingsFocusReminderDescription",
  "settingsReminderChooseDay",
  "settingsSoundBackgroundTitle",
  "settingsSoundBackgroundDescription",
  "settingsSoundActivityTitle",
  "settingsSoundActivityDescription",
  "settingsAccountBackupTitle",
  "settingsAccountBackupDescription",
  "settingsAccountSignedIn",
  "settingsAccountSignedOut",
  "settingsAccountDataOnDevice",
  "settingsAccountBackupChecking",
  "settingsAccountBackupCheckingDescription",
  "settingsAccountCheckFailed",
  "settingsAccountCheckFailedDescription",
  "settingsAccountBackupUnavailable",
  "settingsAccountBackupUnavailableDescription",
  "settingsRemindersMobileApp",
  "settingsPrivacyDataDescription",
  "settingsDataBackupReportsDescription",
  "settingsBackupRestoreTitle",
  "settingsReportsTitle",
  "settingsReportsDescription",
  "settingsReportSpreadsheetAction",
  "settingsReportProgressAction",
  "settingsSoundDiaryRainOff",
  "settingsSoundDiaryReady",
  "notificationSoundUpdateUncertain",
] as const;
const platformSpecificRecoveryAndStoreKeys = new Set<string>([
  "notificationSystemSettingsAndroidDescription",
  "notificationSystemSettingsIosDescription",
  "settingsNativeUpdateDescription",
]);
const approvedGermanPrivacyAdsHint =
  "Sie werden nur geladen, wenn du sie aktivierst. Google kann dich bei Bedarf nach deinen Datenschutzeinstellungen fragen.";
const germanFormalAddressTokens = new Set([
  "Sie",
  "Ihr",
  "Ihre",
  "Ihren",
  "Ihrem",
  "Ihres",
  "Ihnen",
]);

type SettingsCopyEntry = readonly [key: string, value: string];

const findGermanFormalAddressViolations = (
  entries: ReadonlyArray<SettingsCopyEntry>
) =>
  entries.flatMap(([key, value]) => {
    if (key === "privacyAdsHint") return [];

    return (value.match(/\p{L}+/gu) ?? [])
      .filter((token) => germanFormalAddressTokens.has(token))
      .map((token) => `${key}:${token}`);
  });

describe("Settings safety copy", () => {
  it("keeps every journal auto-lock option localized in all eight languages", () => {
    for (const [language, translations] of Object.entries(locales)) {
      for (const key of timeoutKeys) {
        const value = translations[key];
        expect(value, `${language}.${key}`).toBeTruthy();
        if (language !== "en") {
          expect(value, `${language}.${key}`).not.toBe(en[key]);
        }
      }
    }
  });

  it("uses one complete data-summary sentence with the same safe placeholders in every language", () => {
    for (const [language, translations] of Object.entries(locales)) {
      const template = translations.settingsDataSummary;
      expect(template, `${language}.settingsDataSummary`).toBeTruthy();
      expect(Array.from(template.matchAll(/\{(\w+)\}/g), (match) => match[1]).sort()).toEqual([
        "focus",
        "habits",
        "moods",
      ]);
    }
  });

  it("uses a precise localized Backups & reports heading in all eight languages", () => {
    for (const [language, translations] of Object.entries(locales)) {
      expect(
        (translations as unknown as Record<string, string>).settingsExportImportTitle,
        `${language}.settingsExportImportTitle`
      ).toBe(backupsReportsHeadings[language as keyof typeof backupsReportsHeadings]);
    }
  });

  it("uses one exact mobile-app reminder instruction in all eight languages", () => {
    for (const [language, translations] of Object.entries(locales)) {
      expect(
        (translations as unknown as Record<string, string>).remindersNativeOnly,
        `${language}.remindersNativeOnly`
      ).toBe(remindersNativeOnly[language as keyof typeof remindersNativeOnly]);
    }
  });

  it("separates signed-in auth truth from backup success in every language", () => {
    for (const [language, translations] of Object.entries(locales)) {
      const record = translations as unknown as Record<string, string>;
      expect.soft(record.settingsAccountSignedIn, `${language}.settingsAccountSignedIn`).toBeTruthy();
      expect.soft(record, `${language}.settingsAccountBackupEnabled`).not.toHaveProperty(
        "settingsAccountBackupEnabled"
      );
    }

    const english = en as unknown as Record<string, string>;
    expect.soft(english.settingsAccountSignedIn).toBe("Signed in");
    expect.soft(english.settingsAccountBackupDescription).toBe(
      "Your account is connected. If ZenFlow can’t save an update online, your changes stay on this device."
    );
  });

  it("distinguishes German object pronouns from formal direct address", () => {
    expect(
      findGermanFormalAddressViolations([
        [
          "settingsAccountDataOnDevice",
          "Melde dich an, um sie zu sichern.",
        ],
        ["privacyAdsHint", approvedGermanPrivacyAdsHint],
      ])
    ).toEqual([]);
    expect(
      findGermanFormalAddressViolations([
        ["settingsAccountDataOnDevice", "Melden Sie sich an."],
      ])
    ).toEqual(["settingsAccountDataOnDevice:Sie"]);
  });

  it("uses natural German copy when diary rain is turned off", () => {
    expect(de.settingsSoundDiaryRainOff).toBe(
      "Regen ist bei den Hintergrundklängen ausgeschaltet."
    );
  });

  it("uses familiar, outcome-focused labels for the simplified Settings controls", () => {
    expect(en.themeModeTitle).toBe("Color mode");
    expect(en.themeAccentTeal).toBe("Green");
    expect(en.settingsSoundBackgroundTitle).toBe("Background sounds");
    expect(en.settingsSoundActivityTitle).toBe("Activity sounds");
    expect(en.settingsMoodCheckIns).toBe("Mood check-ins");
    expect(en.settingsReminderChooseDay).toContain("No reminders");

    expect(uk.themeModeTitle).toBe("Режим оформлення");
    expect(uk.themeAccentClay).toBe("Синій");
    expect(uk.settingsSoundBackgroundTitle).toBe("Фонові звуки");
    expect(uk.settingsSoundActivityTitle).toBe("Звуки дій");
    expect(uk.settingsMoodCheckIns).toBe("Нагадування про настрій");
  });

  it("uses neutral French Sound copy and accented Appearance copy", () => {
    const themePreviewingWords =
      fr.themePreviewing.toLocaleLowerCase("fr").match(/\p{L}+/gu) ?? [];

    expect.soft(fr.themePreviewing).toBe("Aperçu du style");
    expect.soft(themePreviewingWords).not.toContain("apercu");
    expect.soft(fr.settingsSoundMasterDesc).toBe(
      "Diffuser les sons dans ZenFlow."
    );
    expect.soft(fr.settingsSoundProfileBalancedDesc).toBe(
      "Diffuser les sons d’ambiance, d’activité, d’alerte et d’étape."
    );
    expect.soft(fr.settingsSoundAmbientToggleDesc).toBe(
      "Diffuser les sons d’ambiance dans ZenFlow, sauf pendant une séance de concentration."
    );
    expect.soft(fr.settingsSoundCompletionCuesDesc).toBe(
      "Diffuser un son discret après une activité terminée."
    );
    expect.soft(fr.settingsSoundReminderCuesDesc).toBe(
      "Diffuser les alertes du minuteur et les aperçus de rappels dans ZenFlow. Cela ne modifie pas le son des notifications de votre téléphone."
    );
    expect.soft(fr.settingsSoundMilestoneCuesDesc).toBe(
      "Diffuser un son lors de certains paliers de série et de réussite."
    );
  });

  it("localizes grounded profile, About, and advanced-appearance copy", () => {
    for (const [language, translations] of Object.entries(locales)) {
      for (const key of groundedSettingsCopyKeys) {
        expect(translations[key], `${language}.${key}`).toBeTruthy();
        if (language !== "en") {
          expect(translations[key], `${language}.${key}`).not.toBe(en[key]);
        }
      }
    }
  });

  it("uses the approved natural Settings copy and locale registers", () => {
    const changedCopyByLocale = {
      en: {
        remindersNativeOnly: "To set reminders, open the ZenFlow mobile app.",
        settingsAccountBackupTitle: "Account & backup",
        settingsAccountBackupDescription:
          "Your account is connected. If ZenFlow can’t save an update online, your changes stay on this device.",
        settingsAccountSignedIn: "Signed in",
        settingsAccountSignedOut: "You’re not signed in",
        settingsAccountDataOnDevice:
          "Your data stays on this device. Sign in to back it up and use it on your other devices.",
        settingsAccountBackupChecking: "Checking your account…",
        settingsAccountBackupCheckingDescription:
          "Your data stays on this device while ZenFlow checks your account.",
        settingsAccountCheckFailed: "We couldn’t check your account",
        settingsAccountCheckFailedDescription:
          "Your data stays on this device. Check your connection and try again.",
        settingsAccountBackupUnavailable:
          "Backup isn’t available in this version",
        settingsAccountBackupUnavailableDescription:
          "Your data stays on this device.",
        settingsRemindersMobileApp: "Mobile app",
        settingsPrivacyDataDescription:
          "Choose which optional services ZenFlow may use.",
        settingsDataBackupReportsDescription:
          "Save a backup you can import later, or create a report.",
        settingsBackupRestoreTitle: "Backup & restore",
        settingsReportsTitle: "Reports",
        settingsReportsDescription:
          "Reports include mood, habits, focus, and gratitude. The PDF is currently in English. Reports are not backups.",
        settingsExportImportTitle: "Backups & reports",
        settingsReportSpreadsheetAction: "Spreadsheet data (CSV)",
        settingsReportProgressAction: "Progress report (PDF)",
        settingsSoundDiaryRainOff:
          "Rain is turned off under Background sounds.",
        settingsSoundDiaryReady: "Ready to play.",
        settingsGroupHelpAbout: "Help & information",
      },
      uk: {
        remindersNativeOnly:
          "Щоб налаштувати нагадування, відкрийте мобільний застосунок ZenFlow.",
        settingsAccountBackupTitle: "Акаунт і резервна копія",
        settingsAccountBackupDescription:
          "Ваш акаунт підключено. Якщо ZenFlow не зможе зберегти зміни онлайн, вони залишаться на цьому пристрої.",
        settingsAccountSignedIn: "Ви ввійшли",
        settingsAccountSignedOut: "Ви не ввійшли",
        settingsAccountDataOnDevice:
          "Ваші дані залишаються на цьому пристрої. Увійдіть, щоб створити резервну копію та користуватися ними на інших пристроях.",
        settingsAccountBackupChecking: "Перевіряємо ваш акаунт…",
        settingsAccountBackupCheckingDescription:
          "Поки ZenFlow перевіряє ваш акаунт, дані залишаються на цьому пристрої.",
        settingsAccountCheckFailed: "Не вдалося перевірити ваш акаунт",
        settingsAccountCheckFailedDescription:
          "Ваші дані залишаються на цьому пристрої. Перевірте з’єднання й спробуйте знову.",
        settingsAccountBackupUnavailable:
          "У цій версії резервне копіювання недоступне",
        settingsAccountBackupUnavailableDescription:
          "Ваші дані залишаються на цьому пристрої.",
        settingsRemindersMobileApp: "Мобільний застосунок",
        settingsPrivacyDataDescription:
          "Ви вирішуєте, які додаткові сервіси може використовувати ZenFlow.",
        settingsDataBackupReportsDescription:
          "Збережіть резервну копію для подальшого імпорту або створіть звіт.",
        settingsBackupRestoreTitle: "Резервне копіювання й відновлення",
        settingsReportsTitle: "Звіти",
        settingsReportsDescription:
          "Звіти містять дані про настрій, звички, фокус і подяки. PDF-файл наразі англійською. Звіти не є резервними копіями.",
        settingsExportImportTitle: "Резервні копії та звіти",
        settingsReportSpreadsheetAction: "Дані для таблиці (CSV)",
        settingsReportProgressAction: "Звіт про прогрес (PDF)",
        settingsSoundDiaryRainOff:
          "Звук дощу вимкнено в розділі фонових звуків.",
        settingsSoundDiaryReady: "Готово до відтворення.",
        settingsGroupHelpAbout: "Допомога та інформація",
      },
      es: {
        remindersNativeOnly:
          "Para configurar los recordatorios, abre la app móvil de ZenFlow.",
        settingsAccountBackupTitle: "Cuenta y copia de seguridad",
        settingsAccountBackupDescription:
          "Tu cuenta está conectada. Si ZenFlow no puede guardar tus cambios en línea, se quedan en este dispositivo.",
        settingsAccountSignedIn: "Has iniciado sesión",
        settingsAccountSignedOut: "No has iniciado sesión",
        settingsAccountDataOnDevice:
          "Tus datos se quedan en este dispositivo. Inicia sesión para hacer una copia y usarlos en tus otros dispositivos.",
        settingsAccountBackupChecking: "Comprobando tu cuenta…",
        settingsAccountBackupCheckingDescription:
          "Tus datos se quedan en este dispositivo mientras ZenFlow comprueba tu cuenta.",
        settingsAccountCheckFailed: "No pudimos comprobar tu cuenta",
        settingsAccountCheckFailedDescription:
          "Tus datos se quedan en este dispositivo. Revisa tu conexión e inténtalo de nuevo.",
        settingsAccountBackupUnavailable:
          "La copia de seguridad no está disponible en esta versión",
        settingsAccountBackupUnavailableDescription:
          "Tus datos se quedan en este dispositivo.",
        settingsRemindersMobileApp: "App móvil",
        settingsPrivacyDataDescription:
          "Tú eliges qué servicios opcionales puede usar ZenFlow.",
        settingsDataBackupReportsDescription:
          "Guarda una copia para importarla más adelante o crea un informe.",
        settingsBackupRestoreTitle: "Copia de seguridad y restauración",
        settingsReportsTitle: "Informes",
        settingsReportsDescription:
          "Los informes incluyen datos de estado de ánimo, hábitos, concentración y gratitud. El PDF está disponible actualmente en inglés. Los informes no son copias de seguridad.",
        settingsExportImportTitle: "Copias de seguridad e informes",
        settingsReportSpreadsheetAction:
          "Datos para hoja de cálculo (CSV)",
        settingsReportProgressAction: "Informe de progreso (PDF)",
        settingsSoundDiaryRainOff:
          "La lluvia está desactivada en Sonidos de fondo.",
        settingsSoundDiaryReady: "Listo para reproducir.",
        settingsGroupHelpAbout: "Ayuda e información",
      },
      de: {
        remindersNativeOnly:
          "Richte Erinnerungen in der mobilen ZenFlow-App ein.",
        settingsAccountBackupTitle: "Konto & Backup",
        settingsAccountBackupDescription:
          "Dein Konto ist verbunden. Wenn ZenFlow Änderungen nicht online speichern kann, bleiben sie auf diesem Gerät.",
        settingsAccountSignedIn: "Du bist angemeldet",
        settingsAccountSignedOut: "Du bist nicht angemeldet",
        settingsAccountDataOnDevice:
          "Deine Daten bleiben auf diesem Gerät. Melde dich an, um sie zu sichern und auf deinen anderen Geräten zu verwenden.",
        settingsAccountBackupChecking: "Konto wird geprüft…",
        settingsAccountBackupCheckingDescription:
          "Während ZenFlow dein Konto prüft, bleiben deine Daten auf diesem Gerät.",
        settingsAccountCheckFailed: "Dein Konto konnte nicht geprüft werden",
        settingsAccountCheckFailedDescription:
          "Deine Daten bleiben auf diesem Gerät. Prüfe deine Verbindung und versuche es erneut.",
        settingsAccountBackupUnavailable:
          "Backup ist in dieser Version nicht verfügbar",
        settingsAccountBackupUnavailableDescription:
          "Deine Daten bleiben auf diesem Gerät.",
        settingsRemindersMobileApp: "Mobile App",
        settingsPrivacyDataDescription:
          "Du entscheidest, welche optionalen Dienste ZenFlow verwenden darf.",
        settingsDataBackupReportsDescription:
          "Speichere ein Backup für einen späteren Import oder erstelle einen Bericht.",
        settingsBackupRestoreTitle: "Backup und Wiederherstellung",
        settingsReportsTitle: "Berichte",
        settingsReportsDescription:
          "Berichte enthalten Daten zu Stimmung, Gewohnheiten, Fokus und Dankbarkeit. Der PDF-Bericht ist derzeit auf Englisch. Berichte sind keine Backups.",
        settingsExportImportTitle: "Backups und Berichte",
        settingsReportSpreadsheetAction: "Tabellendaten (CSV)",
        settingsReportProgressAction: "Fortschrittsbericht (PDF)",
        settingsSoundDiaryRainOff:
          "Regen ist bei den Hintergrundklängen ausgeschaltet.",
        settingsSoundDiaryReady: "Bereit zur Wiedergabe.",
        settingsGroupHelpAbout: "Hilfe & Informationen",
      },
      fr: {
        remindersNativeOnly:
          "Pour régler les rappels, ouvrez l’app mobile ZenFlow.",
        settingsAccountBackupTitle: "Compte et sauvegarde",
        settingsAccountBackupDescription:
          "Votre compte est connecté. Si ZenFlow ne peut pas enregistrer vos modifications en ligne, elles restent sur cet appareil.",
        settingsAccountSignedIn: "Vous êtes connecté",
        settingsAccountSignedOut: "Vous n’êtes pas connecté",
        settingsAccountDataOnDevice:
          "Vos données restent sur cet appareil. Connectez-vous pour les sauvegarder et les retrouver sur vos autres appareils.",
        settingsAccountBackupChecking: "Vérification de votre compte…",
        settingsAccountBackupCheckingDescription:
          "Vos données restent sur cet appareil pendant que ZenFlow vérifie votre compte.",
        settingsAccountCheckFailed: "Nous n’avons pas pu vérifier votre compte",
        settingsAccountCheckFailedDescription:
          "Vos données restent sur cet appareil. Vérifiez votre connexion et réessayez.",
        settingsAccountBackupUnavailable:
          "La sauvegarde n’est pas disponible dans cette version",
        settingsAccountBackupUnavailableDescription:
          "Vos données restent sur cet appareil.",
        settingsRemindersMobileApp: "App mobile",
        settingsPrivacyDataDescription:
          "Vous choisissez les services facultatifs que ZenFlow peut utiliser.",
        settingsDataBackupReportsDescription:
          "Enregistrez une sauvegarde à importer plus tard ou créez un rapport.",
        settingsBackupRestoreTitle: "Sauvegarde et restauration",
        settingsReportsTitle: "Rapports",
        settingsReportsDescription:
          "Les rapports contiennent des données sur l’humeur, les habitudes, la concentration et la gratitude. Le rapport PDF est actuellement en anglais. Les rapports ne sont pas des sauvegardes.",
        settingsExportImportTitle: "Sauvegardes et rapports",
        settingsReportSpreadsheetAction: "Données pour tableur (CSV)",
        settingsReportProgressAction: "Rapport de progression (PDF)",
        settingsSoundDiaryRainOff:
          "La pluie est désactivée dans Sons d’ambiance.",
        settingsSoundDiaryReady: "Prêt à l’écoute.",
        settingsGroupHelpAbout: "Aide et informations",
      },
      ja: {
        remindersNativeOnly:
          "リマインダーはモバイル版ZenFlowで設定できます。",
        settingsAccountBackupTitle: "アカウントとバックアップ",
        settingsAccountBackupDescription:
          "アカウントに接続されています。ZenFlowが変更をオンラインに保存できない場合、その変更はこの端末に残ります。",
        settingsAccountSignedIn: "サインイン済み",
        settingsAccountSignedOut: "サインインしていません",
        settingsAccountDataOnDevice:
          "データはこの端末に保存されています。サインインするとバックアップされ、ほかの端末でも使えます。",
        settingsAccountBackupChecking: "アカウントを確認しています…",
        settingsAccountBackupCheckingDescription:
          "ZenFlowがアカウントを確認している間、データはこの端末に保存されます。",
        settingsAccountCheckFailed: "アカウントを確認できませんでした",
        settingsAccountCheckFailedDescription:
          "データはこの端末に保存されています。接続を確認して、もう一度お試しください。",
        settingsAccountBackupUnavailable:
          "このバージョンではバックアップを利用できません",
        settingsAccountBackupUnavailableDescription:
          "データはこの端末に保存されます。",
        settingsRemindersMobileApp: "モバイル版",
        settingsPrivacyDataDescription:
          "ZenFlowで使用する任意のサービスを選べます。",
        settingsDataBackupReportsDescription:
          "後でインポートできるバックアップを保存するか、レポートを作成します。",
        settingsBackupRestoreTitle: "バックアップと復元",
        settingsReportsTitle: "レポート",
        settingsReportsDescription:
          "レポートには、気分、習慣、集中、感謝のデータが含まれます。PDFは現在英語で作成されます。レポートはバックアップではありません。",
        settingsExportImportTitle: "バックアップとレポート",
        settingsReportSpreadsheetAction: "表計算用データ（CSV）",
        settingsReportProgressAction: "進捗レポート（PDF）",
        settingsSoundDiaryRainOff:
          "「背景音」で雨音がオフになっています。",
        settingsSoundDiaryReady: "再生できます。",
        settingsGroupHelpAbout: "ヘルプとアプリ情報",
      },
      ar: {
        remindersNativeOnly:
          "يمكن إعداد التذكيرات في تطبيق ZenFlow للهاتف.",
        settingsAccountBackupTitle: "الحساب والنسخ الاحتياطي",
        settingsAccountBackupDescription:
          "حسابك متصل. إذا تعذّر على ZenFlow حفظ تغييراتك عبر الإنترنت، فستبقى على هذا الجهاز.",
        settingsAccountSignedIn: "تم تسجيل الدخول",
        settingsAccountSignedOut: "لم يتم تسجيل الدخول",
        settingsAccountDataOnDevice:
          "تبقى بياناتك على هذا الجهاز. يتيح تسجيل الدخول نسخها احتياطيًا واستخدامها على أجهزتك الأخرى.",
        settingsAccountBackupChecking: "جارٍ التحقق من الحساب…",
        settingsAccountBackupCheckingDescription:
          "تبقى بياناتك على هذا الجهاز أثناء تحقق ZenFlow من الحساب.",
        settingsAccountCheckFailed: "تعذّر التحقق من حسابك",
        settingsAccountCheckFailedDescription:
          "تبقى بياناتك على هذا الجهاز. يُرجى التحقق من الاتصال والمحاولة مرة أخرى.",
        settingsAccountBackupUnavailable:
          "النسخ الاحتياطي غير متاح في هذا الإصدار",
        settingsAccountBackupUnavailableDescription:
          "تبقى بياناتك على هذا الجهاز.",
        settingsRemindersMobileApp: "تطبيق الهاتف",
        settingsPrivacyDataDescription:
          "يمكن اختيار الخدمات الاختيارية التي يستخدمها ZenFlow.",
        settingsDataBackupReportsDescription:
          "يمكن حفظ نسخة احتياطية لاستيرادها لاحقًا أو إنشاء تقرير.",
        settingsBackupRestoreTitle: "النسخ الاحتياطي والاستعادة",
        settingsReportsTitle: "التقارير",
        settingsReportsDescription:
          "تتضمن التقارير بيانات المزاج والعادات والتركيز والامتنان. يُنشأ ملف PDF حاليًا باللغة الإنجليزية. التقارير ليست نسخًا احتياطية.",
        settingsExportImportTitle: "النسخ الاحتياطية والتقارير",
        settingsReportSpreadsheetAction: "بيانات جدول بيانات (CSV)",
        settingsReportProgressAction: "تقرير التقدّم (PDF)",
        settingsSoundDiaryRainOff:
          "صوت المطر متوقف ضمن أصوات الخلفية.",
        settingsSoundDiaryReady: "جاهز للتشغيل.",
        settingsGroupHelpAbout: "المساعدة والمعلومات",
      },
      he: {
        remindersNativeOnly:
          "אפשר להגדיר תזכורות באפליקציית ZenFlow לנייד.",
        settingsAccountBackupTitle: "חשבון וגיבוי",
        settingsAccountBackupDescription:
          "החשבון שלך מחובר. אם ZenFlow לא יכול לשמור שינויים באינטרנט, הם נשארים במכשיר הזה.",
        settingsAccountSignedIn: "החשבון מחובר",
        settingsAccountSignedOut: "אין כניסה לחשבון",
        settingsAccountDataOnDevice:
          "הנתונים נשארים במכשיר הזה. לאחר הכניסה הם יגובו ויהיו זמינים גם במכשירים האחרים.",
        settingsAccountBackupChecking: "בודקים את החשבון…",
        settingsAccountBackupCheckingDescription:
          "הנתונים נשארים במכשיר הזה בזמן ש-ZenFlow בודק את החשבון.",
        settingsAccountCheckFailed: "לא הצלחנו לבדוק את החשבון",
        settingsAccountCheckFailedDescription:
          "הנתונים נשארים במכשיר הזה. יש לבדוק את החיבור ולנסות שוב.",
        settingsAccountBackupUnavailable:
          "הגיבוי לא זמין בגרסה הזאת",
        settingsAccountBackupUnavailableDescription:
          "הנתונים נשארים במכשיר הזה.",
        settingsRemindersMobileApp: "אפליקציה לנייד",
        settingsPrivacyDataDescription:
          "אפשר לבחור באילו שירותים אופציונליים ZenFlow ישתמש.",
        settingsDataBackupReportsDescription:
          "אפשר לשמור גיבוי לייבוא מאוחר יותר או ליצור דוח.",
        settingsBackupRestoreTitle: "גיבוי ושחזור",
        settingsReportsTitle: "דוחות",
        settingsReportsDescription:
          "הדוחות כוללים נתוני מצב רוח, הרגלים, מיקוד והכרת תודה. קובץ ה-PDF נוצר כרגע באנגלית. הדוחות אינם גיבויים.",
        settingsExportImportTitle: "גיבויים ודוחות",
        settingsReportSpreadsheetAction:
          "נתונים לגיליון אלקטרוני (CSV)",
        settingsReportProgressAction: "דוח התקדמות (PDF)",
        settingsSoundDiaryRainOff:
          "צליל הגשם כבוי תחת צלילי רקע.",
        settingsSoundDiaryReady: "מוכן להפעלה.",
        settingsGroupHelpAbout: "עזרה ומידע",
      },
    } as const;

    const words = (value: string, locale: string) =>
      value.toLocaleLowerCase(locale).match(/\p{L}+/gu) ?? [];

    const enRecord = en as unknown as Record<string, string>;

    for (const [locale, expectedValues] of Object.entries(
      changedCopyByLocale
    )) {
      const translations = locales[
        locale as keyof typeof locales
      ] as unknown as Record<string, string>;
      for (const [key, expected] of Object.entries(expectedValues)) {
        expect.soft(translations[key], `${locale}.${key}`).toBe(expected);
      }
      for (const key of newV2Keys) {
        expect.soft(translations[key], `${locale}.${key}`).toBeTruthy();
        if (locale !== "en") {
          expect
            .soft(translations[key], `${locale}.${key}`)
            .not.toBe(enRecord[key]);
        }
      }
      for (const key of changedExistingCopyKeys) {
        expect.soft(translations[key], `${locale}.${key}`).toBeTruthy();
        if (locale !== "en") {
          expect
            .soft(translations[key], `${locale}.${key}`)
            .not.toBe(enRecord[key]);
        }
      }
    }

    const changedEntries = (
      locale: keyof typeof changedCopyByLocale
    ): SettingsCopyEntry[] => {
      const translations = locales[locale] as unknown as Record<string, string>;
      return [
        ...Object.entries(changedCopyByLocale[locale]).map(
          ([key, value]) => [key, value] as const
        ),
        ...changedExistingCopyKeys.map(
          (key) => [key, translations[key]] as const
        ),
      ];
    };
    const changedValues = (locale: keyof typeof changedCopyByLocale) =>
      changedEntries(locale).map(([, value]) => value);
    const changedWords = (locale: keyof typeof changedCopyByLocale) =>
      changedValues(locale).flatMap((value) => words(value, locale));
    const ordinaryChangedValues = (
      locale: keyof typeof changedCopyByLocale
    ) => {
      const translations = locales[locale] as unknown as Record<string, string>;
      return [
        ...Object.values(changedCopyByLocale[locale]),
        ...changedExistingCopyKeys
          .filter((key) => !platformSpecificRecoveryAndStoreKeys.has(key))
          .map((key) => translations[key]),
      ];
    };

    for (const forbidden of [
      "ти",
      "тебе",
      "тобі",
      "твій",
      "твоя",
      "твоє",
      "твої",
    ]) {
      expect.soft(changedWords("uk")).not.toContain(forbidden);
    }
    expect.soft(de.privacyAdsHint).toBe(approvedGermanPrivacyAdsHint);
    expect
      .soft(findGermanFormalAddressViolations(changedEntries("de")))
      .toEqual([]);
    for (const forbidden of ["tu", "te", "ton", "ta", "tes", "toi"]) {
      expect.soft(changedWords("fr")).not.toContain(forbidden);
    }
    expect.soft(changedValues("he").join(" ")).not.toMatch(
      /\p{L}+\s*\/\s*\p{L}+/u
    );

    expect.soft(en.remindersNativeOnly).not.toMatch(/\b(?:Android|iOS)\b/);
    expect.soft(ordinaryChangedValues("en").join(" ")).not.toMatch(
      /\b(?:native|platform|supported devices?|system(?: notification)? controls?|final control|sync queue|PWA|renderer|GPU|cache|database)\b/i
    );

    expect.soft(es.themeAccentAmber).toBe("Ámbar");
    expect.soft(es.themeReduceGlowHint).toContain("más");
    expect.soft(words(es.themeReduceGlowHint, "es")).not.toContain("mas");
    expect.soft(es.themeReduceTransparencyHint).toContain("más sólidos");
    expect
      .soft(words(es.themeReduceTransparencyHint, "es"))
      .not.toContain("mas");
    expect
      .soft(words(es.themeReduceTransparencyHint, "es"))
      .not.toContain("solidos");
    expect.soft(de.themeAccentDescription).toBe(
      "Farbe für Schaltflächen, Auswahlen und Hervorhebungen."
    );
    expect.soft(de.themeIntensityTitle).toBe("Intensität");
    expect.soft(de.themeResetAction).toBe("Akzentfarbe und Kontrast zurücksetzen");
    expect.soft(de.themeUndoAction).toBe("Rückgängig");
    expect.soft(de.themeReset).toContain("zurückgesetzt");
    expect.soft(words(de.themeReset, "de")).not.toContain("zuruckgesetzt");
    expect.soft(de.themeHighContrastHint).toContain("Verstärkt");
    expect
      .soft(words(de.themeHighContrastHint, "de"))
      .not.toContain("verstarkt");
    expect.soft(de.themeReduceGlowHint).toContain("Hält Oberflächen");
    expect.soft(words(de.themeReduceGlowHint, "de")).not.toContain("halt");
    expect
      .soft(words(de.themeReduceGlowHint, "de"))
      .not.toContain("oberflachen");
    expect.soft(de.themeReduceTransparencyHint).toContain("Flächen für");
    expect
      .soft(words(de.themeReduceTransparencyHint, "de"))
      .not.toContain("flachen");
    expect
      .soft(words(de.themeReduceTransparencyHint, "de"))
      .not.toContain("fur");
    expect.soft(fr.themeAccentTitle).toBe("Couleur d’accent");
    expect.soft(fr.themeIntensityTitle).toBe("Intensité");
    expect.soft(fr.themePreviewAction).toBe("Aperçu");
    expect.soft(fr.themeResetAction).toBe(
      "Réinitialiser la couleur d’accent et le contraste",
    );
    expect.soft(fr.themeMoreActions).toBe("Plus d’actions d’apparence");
    expect.soft(fr.themeApplied).toContain("appliqué");
    expect.soft(words(fr.themeApplied, "fr")).not.toContain("applique");
    expect.soft(fr.themeReset).toContain("réinitialisé");
    expect.soft(words(fr.themeReset, "fr")).not.toContain("reinitialise");
    expect.soft(fr.themeUndone).toContain("restauré");
    expect.soft(words(fr.themeUndone, "fr")).not.toContain("restaure");
    expect.soft(fr.themePreviewChanged).toContain("effacé après");
    expect.soft(words(fr.themePreviewChanged, "fr")).not.toContain("efface");
    expect.soft(words(fr.themePreviewChanged, "fr")).not.toContain("apres");
    expect.soft(fr.themeIntensityBalanced).toBe("Équilibré");
    expect.soft(fr.themeHighContrast).toContain("élevé");
    expect.soft(words(fr.themeHighContrast, "fr")).not.toContain("eleve");
    expect.soft(fr.themeReduceGlow).toBe("Réduire la lueur");
    expect.soft(fr.themeReduceGlowHint).toContain("lumière");
    expect
      .soft(words(fr.themeReduceGlowHint, "fr"))
      .not.toContain("lumiere");
    expect.soft(fr.themeReduceTransparency).toBe(
      "Réduire la transparence"
    );
    expect.soft(fr.themeReduceTransparencyHint).toContain("lisibilité");
    expect
      .soft(words(fr.themeReduceTransparencyHint, "fr"))
      .not.toContain("lisibilite");
    expect.soft(fr.oledDarkModeHint).toContain("Thème");
    expect.soft(words(fr.oledDarkModeHint, "fr")).not.toContain("theme");
    expect.soft(fr.oledDarkModeHint).toContain("écrans");
    expect.soft(words(fr.oledDarkModeHint, "fr")).not.toContain("ecrans");
    expect.soft(fr.oledDarkModeHint).toContain("économiser");
    expect.soft(words(fr.oledDarkModeHint, "fr")).not.toContain("economiser");
  });
});
