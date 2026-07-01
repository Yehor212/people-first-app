export type CoachLiteLanguage =
  | "ru"
  | "en"
  | "uk"
  | "es"
  | "de"
  | "fr"
  | "ja"
  | "ar"
  | "he"
  | string;

export interface CoachLiteHabit {
  name: string;
  completedToday?: boolean;
  streak?: number;
}

export interface CoachLiteMood {
  mood: string;
  emotion?: string;
  date?: string;
}

export interface CoachLiteContext {
  recentMoods?: CoachLiteMood[];
  habits?: CoachLiteHabit[];
  currentStreak?: number;
  goals?: string[];
  daysAway?: number;
}

export interface CoachLiteRequest {
  message: string;
  context?: CoachLiteContext | Record<string, unknown>;
  language?: CoachLiteLanguage;
  trigger?: string | null;
}

export interface CoachLiteSource {
  id: string;
  label: string;
}

export interface CoachLiteResponse {
  mode: "coach_lite";
  requiresPaidApi: false;
  message: string;
  sources: CoachLiteSource[];
}

const FALLBACK_HABIT = "your next habit";

function asCoachLiteContext(context: CoachLiteRequest["context"]): CoachLiteContext {
  if (!context || typeof context !== "object") return {};
  return context as CoachLiteContext;
}

function pickHabitName(context: CoachLiteContext): string {
  const habits = Array.isArray(context.habits) ? context.habits : [];
  const incomplete = habits.find((habit) => habit && habit.completedToday === false);
  return incomplete?.name || habits[0]?.name || FALLBACK_HABIT;
}

function pickMood(context: CoachLiteContext): string | null {
  const moods = Array.isArray(context.recentMoods) ? context.recentMoods : [];
  const latestMood = moods[0];
  if (!latestMood) return null;
  return latestMood.emotion || latestMood.mood || null;
}

function hasLocalContext(context: CoachLiteContext): boolean {
  return Boolean(
    (Array.isArray(context.habits) && context.habits.length > 0) ||
    (Array.isArray(context.recentMoods) && context.recentMoods.length > 0) ||
    (Array.isArray(context.goals) && context.goals.length > 0) ||
    typeof context.currentStreak === "number" ||
    typeof context.daysAway === "number"
  );
}

type CoachLiteTemplate = (
  trigger: string | null | undefined,
  habitName: string,
  mood: string | null
) => string;

const coachLiteTemplates: Record<string, CoachLiteTemplate> = {
  en: (trigger, habitName, mood) => {
    if (trigger === "habit_skip") {
      return (
        "Coach Lite (free local mode): make " +
        habitName +
        " tiny today, even 1 minute counts. What is the smallest next step you can do before the day ends?"
      );
    }

    if (trigger === "low_mood") {
      const moodPart = mood ? " I see " + mood + " in your recent context." : "";
      return (
        "Coach Lite (free local mode):" +
        moodPart +
        " Try one slow breath, then write one honest sentence about what would help right now."
      );
    }

    return (
      "Coach Lite (free local mode): pick one small action connected to " +
      habitName +
      ", then check in with yourself after it is done."
    );
  },
  ru: (trigger, habitName, mood) => {
    if (trigger === "habit_skip") {
      return (
        'Coach Lite (бесплатный локальный режим): уменьши "' +
        habitName +
        '" до микро-шага, даже 1 минута считается. Какой самый маленький следующий шаг ты можешь сделать сегодня?'
      );
    }

    if (trigger === "low_mood") {
      const moodPart = mood ? " В контексте вижу: " + mood + "." : "";
      return (
        "Coach Lite (бесплатный локальный режим):" +
        moodPart +
        " Сделай один медленный вдох и запиши одну честную фразу о том, что сейчас поможет."
      );
    }

    return (
      'Coach Lite (бесплатный локальный режим): выбери один маленький шаг рядом с "' +
      habitName +
      '" и отметь, что изменилось после него.'
    );
  },
  uk: (trigger, habitName, mood) => {
    if (trigger === "habit_skip") {
      return (
        'Coach Lite (безкоштовний локальний режим): зменш "' +
        habitName +
        '" до мікрокроку, навіть 1 хвилина рахується. Який найменший наступний крок ти можеш зробити сьогодні?'
      );
    }

    if (trigger === "low_mood") {
      const moodPart = mood ? " У контексті бачу: " + mood + "." : "";
      return (
        "Coach Lite (безкоштовний локальний режим):" +
        moodPart +
        " Зроби один повільний вдих і запиши одну чесну фразу про те, що зараз допоможе."
      );
    }

    return (
      'Coach Lite (безкоштовний локальний режим): обери один маленький крок поруч із "' +
      habitName +
      '" і відміть, що змінилося після нього.'
    );
  },
  es: (trigger, habitName, mood) => {
    if (trigger === "habit_skip") {
      return (
        'Coach Lite (modo local gratuito): reduce "' +
        habitName +
        '" a un micro-paso; incluso 1 minuto cuenta. ¿Cuál es el paso más pequeño que puedes hacer hoy?'
      );
    }

    if (trigger === "low_mood") {
      const moodPart = mood ? " Veo en tu contexto: " + mood + "." : "";
      return (
        "Coach Lite (modo local gratuito):" +
        moodPart +
        " Haz una respiración lenta y escribe una frase honesta sobre lo que ayudaría ahora."
      );
    }

    return (
      'Coach Lite (modo local gratuito): elige una acción pequeña conectada con "' +
      habitName +
      '" y observa qué cambia después.'
    );
  },
  de: (trigger, habitName, mood) => {
    if (trigger === "habit_skip") {
      return (
        'Coach Lite (kostenloser lokaler Modus): mach "' +
        habitName +
        '" heute winzig; auch 1 Minute zählt. Was ist der kleinste nächste Schritt?'
      );
    }

    if (trigger === "low_mood") {
      const moodPart = mood ? " In deinem Kontext sehe ich: " + mood + "." : "";
      return (
        "Coach Lite (kostenloser lokaler Modus):" +
        moodPart +
        " Nimm einen langsamen Atemzug und schreibe einen ehrlichen Satz darüber, was jetzt helfen würde."
      );
    }

    return (
      'Coach Lite (kostenloser lokaler Modus): wähle eine kleine Aktion rund um "' +
      habitName +
      '" und prüfe danach, was sich verändert hat.'
    );
  },
  fr: (trigger, habitName, mood) => {
    if (trigger === "habit_skip") {
      return (
        'Coach Lite (mode local gratuit) : rends "' +
        habitName +
        "\" minuscule aujourd'hui ; même 1 minute compte. Quel est le plus petit prochain pas ?"
      );
    }

    if (trigger === "low_mood") {
      const moodPart = mood ? " Je vois dans ton contexte : " + mood + "." : "";
      return (
        "Coach Lite (mode local gratuit) :" +
        moodPart +
        " Prends une respiration lente, puis écris une phrase honnête sur ce qui aiderait maintenant."
      );
    }

    return (
      'Coach Lite (mode local gratuit) : choisis une petite action liée à "' +
      habitName +
      '" et observe ce qui change après.'
    );
  },
  ja: (trigger, habitName, mood) => {
    if (trigger === "habit_skip") {
      return (
        "Coach Lite（無料ローカルモード）: 今日は「" +
        habitName +
        "」を小さな一歩にしてみましょう。1分でも十分です。今できる一番小さな次の行動は何ですか？"
      );
    }

    if (trigger === "low_mood") {
      const moodPart = mood ? " 最近の記録では「" + mood + "」が見えます。" : "";
      return (
        "Coach Lite（無料ローカルモード）:" +
        moodPart +
        " ゆっくり一呼吸して、今助けになることを正直に一文だけ書いてみましょう。"
      );
    }

    return (
      "Coach Lite（無料ローカルモード）: 「" +
      habitName +
      "」につながる小さな行動を一つ選び、終わったあとに気分を確認しましょう。"
    );
  },
  ar: (trigger, habitName, mood) => {
    if (trigger === "habit_skip") {
      return (
        'Coach Lite (الوضع المحلي المجاني): اجعل "' +
        habitName +
        '" خطوة صغيرة جداً اليوم؛ حتى دقيقة واحدة تُحسب. ما أصغر خطوة يمكنك فعلها الآن؟'
      );
    }

    if (trigger === "low_mood") {
      const moodPart = mood ? " أرى في سياقك: " + mood + "." : "";
      return (
        "Coach Lite (الوضع المحلي المجاني):" +
        moodPart +
        " خذ نفساً بطيئاً، ثم اكتب جملة صادقة واحدة عمّا قد يساعدك الآن."
      );
    }

    return (
      'Coach Lite (الوضع المحلي المجاني): اختر فعلاً صغيراً مرتبطاً بـ "' +
      habitName +
      '"، ثم لاحظ ما تغيّر بعده.'
    );
  },
  he: (trigger, habitName, mood) => {
    if (trigger === "habit_skip") {
      return (
        'Coach Lite (מצב מקומי חינמי): הקטן היום את "' +
        habitName +
        '" לצעד זעיר; גם דקה אחת נחשבת. מה הצעד הכי קטן שאפשר לעשות עכשיו?'
      );
    }

    if (trigger === "low_mood") {
      const moodPart = mood ? " אני רואה בהקשר שלך: " + mood + "." : "";
      return (
        "Coach Lite (מצב מקומי חינמי):" +
        moodPart +
        " קח נשימה איטית וכתוב משפט כן אחד על מה שיכול לעזור עכשיו."
      );
    }

    return (
      'Coach Lite (מצב מקומי חינמי): בחר פעולה קטנה שקשורה ל-"' +
      habitName +
      '", ואז בדוק מה השתנה אחריה.'
    );
  },
};

const coachLiteSourceLabels: Record<string, { userMessage: string; localContext: string }> = {
  en: { userMessage: "Current message", localContext: "Local app context" },
  ru: { userMessage: "Текущее сообщение", localContext: "Локальный контекст приложения" },
  uk: { userMessage: "Поточне повідомлення", localContext: "Локальний контекст застосунку" },
  es: { userMessage: "Mensaje actual", localContext: "Contexto local de la app" },
  de: { userMessage: "Aktuelle Nachricht", localContext: "Lokaler App-Kontext" },
  fr: { userMessage: "Message actuelle", localContext: "Contexte local de l'app" },
  ja: { userMessage: "現在のメッセージ", localContext: "アプリ内のローカル情報" },
  ar: { userMessage: "الرسالة الحالية", localContext: "سياق التطبيق المحلي" },
  he: { userMessage: "ההודעה הנוכחית", localContext: "הקשר מקומי של האפליקציה" },
};

function resolveCoachLiteLanguage(language: CoachLiteLanguage | undefined): string {
  return typeof language === "string" && coachLiteTemplates[language] ? language : "en";
}

function buildMessage(
  language: CoachLiteLanguage,
  trigger: string | null | undefined,
  habitName: string,
  mood: string | null
): string {
  return coachLiteTemplates[resolveCoachLiteLanguage(language)](trigger, habitName, mood);
}

export function buildCoachLiteResponse(request: CoachLiteRequest): CoachLiteResponse {
  const context = asCoachLiteContext(request.context);
  const habitName = pickHabitName(context);
  const mood = pickMood(context);
  const language = resolveCoachLiteLanguage(request.language);
  const labels = coachLiteSourceLabels[language] ?? coachLiteSourceLabels.en;
  const sources: CoachLiteSource[] = [{ id: "user_message", label: labels.userMessage }];

  if (hasLocalContext(context)) {
    sources.push({ id: "local_user_context", label: labels.localContext });
  }

  return {
    mode: "coach_lite",
    requiresPaidApi: false,
    message: buildMessage(language, request.trigger, habitName, mood),
    sources,
  };
}
