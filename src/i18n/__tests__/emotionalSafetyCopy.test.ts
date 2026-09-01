import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

const scopedReminderDayCopy = {
  en: "Choose days for mood and focus reminders.",
  uk: "Оберіть дні для нагадувань про настрій і фокус.",
  es: "Elige los días para los recordatorios de ánimo y concentración.",
  de: "Wähle Tage für Stimmungs- und Fokus-Erinnerungen.",
  fr: "Choisissez les jours des rappels d’humeur et de concentration.",
  ja: "気分と集中のリマインダーを受け取る曜日を選んでください。",
  ar: "اختر أيام تذكيرات المزاج والتركيز.",
  he: "יש לבחור ימים לתזכורות על מצב הרוח והמיקוד.",
} as const;

const masterReminderScopeCopy = {
  en: "Turns mood, focus, and habit reminders on or off. Set each habit’s time in its own menu.",
  uk: "Вмикає або вимикає нагадування про настрій, фокус і звички. Час для звички задається в її меню.",
  es: "Activa o desactiva los recordatorios de ánimo, concentración y hábitos. Ajusta la hora de cada hábito en su menú.",
  de: "Schaltet Erinnerungen für Stimmung, Fokus und Gewohnheiten ein oder aus. Die Zeit stellst du im Menü der jeweiligen Gewohnheit ein.",
  fr: "Active ou désactive les rappels d’humeur, de concentration et d’habitudes. L’heure de chaque habitude se règle dans son menu.",
  ja: "気分・集中・習慣のリマインダーをまとめてオン／オフにします。習慣の時刻は各習慣のメニューで設定できます。",
  ar: "يشغّل أو يوقف تذكيرات المزاج والتركيز والعادات. اضبط وقت كل عادة من قائمتها.",
  he: "מפעיל או מכבה תזכורות למצב הרוח, למיקוד ולהרגלים. את השעה לכל הרגל מגדירים בתפריט שלו.",
} as const;

const quietHoursScopeCopy = {
  en: "Quiet hours for mood and focus",
  uk: "Тихі години для настрою та фокусу",
  es: "Horas sin avisos de ánimo y concentración",
  de: "Ruhezeiten für Stimmung und Fokus",
  fr: "Heures calmes pour l’humeur et la concentration",
  ja: "気分・集中リマインダーの通知休止時間",
  ar: "ساعات هدوء لتذكيرات المزاج والتركيز",
  he: "שעות שקט לתזכורות מצב רוח ומיקוד",
} as const;

const habitReminderDayGuardCopy = {
  en: "Keep at least one day selected. To turn this reminder off, remove it.",
  uk: "Залиште вибраним хоча б один день. Щоб вимкнути це нагадування, видаліть його.",
  es: "Deja al menos un día seleccionado. Para desactivar este recordatorio, elimínalo.",
  de: "Lass mindestens einen Tag ausgewählt. Um diese Erinnerung auszuschalten, entferne sie.",
  fr: "Gardez au moins un jour sélectionné. Pour désactiver ce rappel, supprimez-le.",
  ja: "少なくとも1日を選択してください。このリマインダーをオフにするには削除してください。",
  ar: "أبقِ يومًا واحدًا على الأقل محددًا. لإيقاف هذا التذكير، احذفه.",
  he: "יש להשאיר לפחות יום אחד מסומן. כדי לכבות את התזכורת, יש למחוק אותה.",
} as const;

const activitySoundRecoveryCopy = {
  en: {
    title: "Some activity sounds are off",
    description: "Sounds you turned off earlier stay off until you turn them back on.",
    action: "Turn all activity sounds on",
  },
  uk: {
    title: "Деякі звуки дій вимкнено",
    description: "Звуки, які ви вимкнули раніше, залишаються вимкненими, доки ви не ввімкнете їх знову.",
    action: "Увімкнути всі звуки дій",
  },
  es: {
    title: "Algunos sonidos de actividad están desactivados",
    description: "Los sonidos que desactivaste antes seguirán así hasta que vuelvas a activarlos.",
    action: "Activar todos los sonidos de actividad",
  },
  de: {
    title: "Einige Aktivitätstöne sind ausgeschaltet",
    description: "Töne, die du zuvor ausgeschaltet hast, bleiben aus, bis du sie wieder einschaltest.",
    action: "Alle Aktivitätstöne einschalten",
  },
  fr: {
    title: "Certains sons d’activité sont désactivés",
    description: "Les sons désactivés auparavant restent coupés jusqu’à ce que vous les réactiviez.",
    action: "Activer tous les sons d’activité",
  },
  ja: {
    title: "一部の操作音がオフになっています",
    description: "以前オフにした音は、もう一度オンにするまで再生されません。",
    action: "すべての操作音をオンにする",
  },
  ar: {
    title: "بعض أصوات الأنشطة متوقفة",
    description: "تظل الأصوات التي أوقفتها سابقًا متوقفة حتى تعيد تشغيلها.",
    action: "تشغيل جميع أصوات الأنشطة",
  },
  he: {
    title: "חלק מצלילי הפעילות כבויים",
    description: "צלילים שכיבית בעבר יישארו כבויים עד שתפעיל אותם שוב.",
    action: "הפעלת כל צלילי הפעילות",
  },
} as const;

const notificationPermissionCapabilityCopy = {
  en: {
    title: "Allow reminders?",
    description:
      "ZenFlow can send the mood, focus, and habit reminders you turn on.",
    moodTitle: "Mood reminders",
    moodDescription: "On the days and at the time you choose",
    habitTitle: "Habit reminders",
    habitDescription: "On each habit’s saved days and time",
    focusTitle: "Focus timer",
    focusDescription: "When a timed focus session finishes",
    allow: "Allow reminders",
    deny: "Not now",
    privacy:
      "These reminders are scheduled on this device. You can change them in Settings.",
  },
  uk: {
    title: "Дозволити нагадування?",
    description:
      "ZenFlow може надсилати нагадування про настрій, фокус і звички, які ви вмикаєте.",
    moodTitle: "Нагадування про настрій",
    moodDescription: "У вибрані вами дні та час",
    habitTitle: "Нагадування про звички",
    habitDescription: "У збережені для кожної звички дні та час",
    focusTitle: "Таймер фокусу",
    focusDescription: "Коли завершиться фокус-сесія з таймером",
    allow: "Дозволити нагадування",
    deny: "Не зараз",
    privacy:
      "Ці нагадування заплановані на цьому пристрої. Їх можна змінити в Налаштуваннях.",
  },
  es: {
    title: "¿Permitir recordatorios?",
    description:
      "ZenFlow puede enviar los recordatorios de ánimo, concentración y hábitos que actives.",
    moodTitle: "Recordatorios de ánimo",
    moodDescription: "En los días y a la hora que elijas",
    habitTitle: "Recordatorios de hábitos",
    habitDescription: "En los días y a la hora guardados para cada hábito",
    focusTitle: "Temporizador de concentración",
    focusDescription: "Cuando termina una sesión de concentración cronometrada",
    allow: "Permitir recordatorios",
    deny: "Ahora no",
    privacy:
      "Estos recordatorios se programan en este dispositivo. Puedes cambiarlos en Ajustes.",
  },
  de: {
    title: "Erinnerungen erlauben?",
    description:
      "ZenFlow kann die Stimmungs-, Fokus- und Gewohnheitserinnerungen senden, die du einschaltest.",
    moodTitle: "Stimmungserinnerungen",
    moodDescription: "An den Tagen und zu der Uhrzeit, die du auswählst",
    habitTitle: "Gewohnheitserinnerungen",
    habitDescription:
      "An den für jede Gewohnheit gespeicherten Tagen und Uhrzeiten",
    focusTitle: "Fokus-Timer",
    focusDescription: "Wenn eine zeitgesteuerte Fokussitzung endet",
    allow: "Erinnerungen erlauben",
    deny: "Jetzt nicht",
    privacy:
      "Diese Erinnerungen werden auf diesem Gerät geplant. Du kannst sie in den Einstellungen ändern.",
  },
  fr: {
    title: "Autoriser les rappels ?",
    description:
      "ZenFlow peut envoyer les rappels d’humeur, de concentration et d’habitudes que vous activez.",
    moodTitle: "Rappels d’humeur",
    moodDescription: "Aux jours et à l’heure que vous choisissez",
    habitTitle: "Rappels d’habitudes",
    habitDescription:
      "Aux jours et à l’heure enregistrés pour chaque habitude",
    focusTitle: "Minuteur de concentration",
    focusDescription:
      "À la fin d’une session de concentration chronométrée",
    allow: "Autoriser les rappels",
    deny: "Pas maintenant",
    privacy:
      "Ces rappels sont programmés sur cet appareil. Vous pouvez les modifier dans les paramètres.",
  },
  ja: {
    title: "リマインダーを許可しますか？",
    description:
      "ZenFlowは、設定でオンにした気分・集中・習慣のリマインダーを通知できます。",
    moodTitle: "気分リマインダー",
    moodDescription: "選んだ曜日と時刻に通知します",
    habitTitle: "習慣リマインダー",
    habitDescription: "各習慣に保存した曜日と時刻に通知します",
    focusTitle: "集中タイマー",
    focusDescription: "時間を設定した集中セッションの終了時に通知します",
    allow: "リマインダーを許可",
    deny: "今はしない",
    privacy:
      "これらのリマインダーはこのデバイスでスケジュールされます。設定から変更できます。",
  },
  ar: {
    title: "هل تريد السماح بالتذكيرات؟",
    description:
      "يمكن لتطبيق ZenFlow إرسال تذكيرات المزاج والتركيز والعادات التي تشغّلها.",
    moodTitle: "تذكيرات المزاج",
    moodDescription: "في الأيام التي تختارها وفي الوقت الذي تحدده",
    habitTitle: "تذكيرات العادات",
    habitDescription: "في الأيام المحددة والوقت المحفوظ لكل عادة",
    focusTitle: "مؤقت التركيز",
    focusDescription: "عند انتهاء جلسة تركيز محددة الوقت",
    allow: "السماح بالتذكيرات",
    deny: "ليس الآن",
    privacy:
      "تُجدول هذه التذكيرات على هذا الجهاز. يمكنك تغييرها من الإعدادات.",
  },
  he: {
    title: "לאפשר תזכורות?",
    description:
      "ZenFlow יכול לשלוח את תזכורות מצב הרוח, המיקוד וההרגלים שמפעילים בהגדרות.",
    moodTitle: "תזכורות מצב רוח",
    moodDescription: "בימים ובשעה שבוחרים",
    habitTitle: "תזכורות הרגלים",
    habitDescription: "בימים ובשעה שנשמרו לכל הרגל",
    focusTitle: "טיימר מיקוד",
    focusDescription: "כשמסתיים מפגש מיקוד מתוזמן",
    allow: "לאפשר תזכורות",
    deny: "לא עכשיו",
    privacy:
      "התזכורות האלה מתוזמנות במכשיר הזה. אפשר לשנות אותן בהגדרות.",
  },
} as const;

const reminderKeys = [
  "reminderMoodTitle",
  "reminderMoodBody",
  "reminderHabitTitle",
  "reminderHabitBody",
  "reminderFocusTitle",
  "reminderFocusBody",
] as const;

const reminderPressurePatterns = {
  en: /brain (?:will )?thank|hero|power[ -]?up|crush it|win(?:ner|ning)?/iu,
  uk: /мозок.*(?:подяку|дяку)|геро|суперсил|перемог/iu,
  es: /agradecer.*cerebro|modo héroe|poder de enfoque|gran victoria/iu,
  de: /Gehirn.*dank|Helden|Fokus-Power|großer Sieg/iu,
  fr: /remercier.*cerveau|mode héros|power focus|grande victoire/iu,
  ja: /脳.*感謝|ヒーロー|パワーアップ|大きな成果/u,
  ar: /بطل|قوة خارقة|انتصار كبير|يشكرك.*دماغ/u,
  he: /להודות.*מוח|מצב גיבור|כוח מיקוד|ניצחון גדול/u,
} as const;

const timeHelperKeys = [
  "timeBlindnessHelper",
  "visualTimeAwareness",
  "adhdTimeManagement",
  "adhdTip1",
  "adhdTip2",
  "adhdTip3",
  "adhdTip4",
] as const;

const unsupportedTimeBenefitPatterns = {
  en: /ADHD|time blindness|reduces anxiety|better planning/iu,
  uk: /СДУГ|СДВГ|зменшує тривог|краще планування/iu,
  es: /TDAH|ceguera temporal|reduce la ansiedad|mejor planificación/iu,
  de: /ADHS|Zeitblindheit|reduziert Angst|bessere Planung/iu,
  fr: /TDAH|cécité temporelle|réduit l.anxiété|meilleure planification/iu,
  ja: /ADHD|注意欠如|不安を軽減|計画を改善/u,
  ar: /اضطراب فرط|يقلل القلق|تخطيط أفضل/u,
  he: /הפרעת קשב|מפחיתה חרדה|תכנון טוב יותר/u,
} as const;

describe("emotionally safe runtime copy", () => {
  it("keeps every active mood, habit, and focus reminder free from virtue and brain-approval pressure", () => {
    for (const [language, translations] of Object.entries(locales)) {
      const payload = reminderKeys.map((key) => translations[key]).join("\n");

      for (const key of reminderKeys) {
        expect(translations[key], `${language}.${key}`).toBeTruthy();
      }
      expect(Array.from(translations.reminderHabitTitle).length, language).toBeLessThanOrEqual(30);
      expect(translations.reminderHabitTitle, language).not.toMatch(/\{[^}]+\}/u);
      expect(translations.reminderHabitBody, language).not.toContain("{habit}");
      expect(payload, language).not.toMatch(
        reminderPressurePatterns[language as keyof typeof reminderPressurePatterns]
      );
    }
  });

  it("scopes empty global days to mood and focus reminders instead of all reminders", () => {
    for (const [language, translations] of Object.entries(locales)) {
      expect(translations.settingsReminderChooseDay, language).toBe(
        scopedReminderDayCopy[language as keyof typeof scopedReminderDayCopy],
      );
    }
  });

  it("makes the master reminder toggle's habit dependency explicit in every locale", () => {
    for (const [language, translations] of Object.entries(locales)) {
      expect(translations.remindersDescription, language).toBe(
        masterReminderScopeCopy[language as keyof typeof masterReminderScopeCopy],
      );
    }
  });

  it("names quiet hours as a mood-and-focus rule in every locale", () => {
    for (const [language, translations] of Object.entries(locales)) {
      expect(translations.quietHours, language).toBe(
        quietHoursScopeCopy[language as keyof typeof quietHoursScopeCopy],
      );
    }
  });

  it("explains the one-day habit reminder guard in every locale", () => {
    for (const [language, translations] of Object.entries(locales)) {
      expect(translations.habitReminderAtLeastOneDay, language).toBe(
        habitReminderDayGuardCopy[language as keyof typeof habitReminderDayGuardCopy],
      );
    }
  });

  it("offers truthful mixed activity-sound recovery in every locale", () => {
    for (const [language, translations] of Object.entries(locales)) {
      const expected = activitySoundRecoveryCopy[
        language as keyof typeof activitySoundRecoveryCopy
      ];
      expect(translations.settingsSoundActivityRestoreTitle, language).toBe(expected.title);
      expect(translations.settingsSoundActivityRestoreDescription, language).toBe(
        expected.description,
      );
      expect(translations.settingsSoundActivityRestoreAction, language).toBe(expected.action);
    }
  });

  it("describes only the reminder capabilities that the native permission enables", () => {
    for (const [language, translations] of Object.entries(locales)) {
      const expected =
        notificationPermissionCapabilityCopy[
          language as keyof typeof notificationPermissionCapabilityCopy
        ];

      expect(translations.notificationPermissionTitle, language).toBe(expected.title);
      expect(translations.notificationPermissionDescription, language).toBe(
        expected.description,
      );
      expect(translations.notificationFeature1Title, language).toBe(expected.moodTitle);
      expect(translations.notificationFeature1Desc, language).toBe(
        expected.moodDescription,
      );
      expect(translations.notificationFeature2Title, language).toBe(expected.habitTitle);
      expect(translations.notificationFeature2Desc, language).toBe(
        expected.habitDescription,
      );
      expect(translations.notificationFeature3Title, language).toBe(expected.focusTitle);
      expect(translations.notificationFeature3Desc, language).toBe(
        expected.focusDescription,
      );
      expect(translations.notificationAllow, language).toBe(expected.allow);
      expect(translations.notificationDeny, language).toBe(expected.deny);
      expect(translations.notificationPrivacyNote, language).toBe(expected.privacy);
    }
  });

  it("describes TimeHelper controls without clinical labels or universal benefit promises", () => {
    for (const [language, translations] of Object.entries(locales)) {
      const visibleCopy = timeHelperKeys.map((key) => translations[key]).join("\n");

      expect(visibleCopy, language).not.toMatch(
        unsupportedTimeBenefitPatterns[language as keyof typeof unsupportedTimeBenefitPatterns]
      );
    }
  });

  it("keeps TimeHelper functional copy exact and prevents an English fallback inside another locale", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/TimeHelper.tsx"), "utf8");

    expect(en.timeBlindnessHelper).toBe("Visual timer");
    expect(en.adhdTip2).toBe("The countdown shows how much time remains");
    expect(en.adhdTip3).toBe("The expected finish time appears while the timer runs");
    for (const key of timeHelperKeys) {
      expect(source, key).not.toMatch(new RegExp(`t\\.${key}\\s*\\|\\|`, "u"));
    }
  });

  it("does not replace locale-complete notification values with inline English", () => {
    const hookSource = readFileSync(
      resolve(process.cwd(), "src/hooks/useNotificationSetup.ts"),
      "utf8"
    );
    const settingsSource = readFileSync(
      resolve(process.cwd(), "src/pages/nav-v2/settings/V2SettingsNotificationsPanel.tsx"),
      "utf8"
    );

    expect(hookSource).not.toMatch(
      /t\.(?:howAreYouNow|journalReminderNotifTitle|journalReminderNotifBody)\s*\|\|/u
    );
    expect(settingsSource).not.toMatch(/t\.howAreYouNow\s*\|\|/u);
  });
});
