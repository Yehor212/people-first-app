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

function templateEn(
  trigger: string | null | undefined,
  habitName: string,
  mood: string | null
): string {
  if (trigger === "habit_skip") {
    return `Coach Lite (free local mode): make ${habitName} tiny today, even 1 minute counts. What is the smallest next step you can do before the day ends?`;
  }

  if (trigger === "low_mood") {
    const moodPart = mood ? ` I see ${mood} in your recent context.` : "";
    return `Coach Lite (free local mode):${moodPart} Try one slow breath, then write one honest sentence about what would help right now.`;
  }

  return `Coach Lite (free local mode): pick one small action connected to ${habitName}, then check in with yourself after it is done.`;
}

function templateRu(
  trigger: string | null | undefined,
  habitName: string,
  mood: string | null
): string {
  if (trigger === "habit_skip") {
    return `Coach Lite (бесплатный локальный режим): уменьши "${habitName}" до микро-шага, даже 1 минута считается. Какой самый маленький следующий шаг ты можешь сделать сегодня?`;
  }

  if (trigger === "low_mood") {
    const moodPart = mood ? ` В контексте вижу: ${mood}.` : "";
    return `Coach Lite (бесплатный локальный режим):${moodPart} Сделай один медленный вдох и запиши одну честную фразу о том, что сейчас поможет.`;
  }

  return `Coach Lite (бесплатный локальный режим): выбери один маленький шаг рядом с "${habitName}" и отметь, что изменилось после него.`;
}

function templateUk(
  trigger: string | null | undefined,
  habitName: string,
  mood: string | null
): string {
  if (trigger === "habit_skip") {
    return `Coach Lite (безкоштовний локальний режим): зменш "${habitName}" до мікрокроку, навіть 1 хвилина рахується. Який найменший наступний крок ти можеш зробити сьогодні?`;
  }

  if (trigger === "low_mood") {
    const moodPart = mood ? ` У контексті бачу: ${mood}.` : "";
    return `Coach Lite (безкоштовний локальний режим):${moodPart} Зроби один повільний вдих і запиши одну чесну фразу про те, що зараз допоможе.`;
  }

  return `Coach Lite (безкоштовний локальний режим): обери один маленький крок поруч із "${habitName}" і відміть, що змінилося після нього.`;
}

function buildMessage(
  language: CoachLiteLanguage,
  trigger: string | null | undefined,
  habitName: string,
  mood: string | null
): string {
  if (language === "ru") return templateRu(trigger, habitName, mood);
  if (language === "uk") return templateUk(trigger, habitName, mood);
  return templateEn(trigger, habitName, mood);
}

export function buildCoachLiteResponse(request: CoachLiteRequest): CoachLiteResponse {
  const context = asCoachLiteContext(request.context);
  const habitName = pickHabitName(context);
  const mood = pickMood(context);
  const sources: CoachLiteSource[] = [{ id: "user_message", label: "Current message" }];

  if (hasLocalContext(context)) {
    sources.push({ id: "local_user_context", label: "Local app context" });
  }

  return {
    mode: "coach_lite",
    requiresPaidApi: false,
    message: buildMessage(request.language ?? "en", request.trigger, habitName, mood),
    sources,
  };
}
