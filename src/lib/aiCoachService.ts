/**
 * AI Coach Service
 * Handles HTTP communication with the AI Coach edge function.
 * Pure service — no React hooks or state.
 */

import { supabase } from "@/lib/supabaseClient";
import { SUPABASE_URL } from "@/lib/env";
import { logger } from "@/lib/logger";

export interface AICoachRequest {
  message: string;
  context: object;
  language: string;
  trigger: string | null;
  conversationHistory: Array<{ role: string; content: string }>;
}

export interface AICoachResponse {
  reply: string;
}

type ClientCoachLiteTemplate = (
  trigger: string | null | undefined,
  habitName: string,
  mood: string | null
) => string;

const CLIENT_COACH_LITE_TEMPLATES: Record<string, ClientCoachLiteTemplate> = {
  en: (trigger, habitName, mood) => {
    if (trigger === "low_mood") {
      const moodPart = mood ? " I see " + mood + " in your recent context." : "";
      return (
        "Coach Lite (free local mode):" +
        moodPart +
        " Try one slow breath, then write one honest sentence about what would help right now."
      );
    }
    return (
      "Coach Lite (free local mode): make " +
      habitName +
      " tiny today, even 1 minute counts. What is the smallest next step you can do before the day ends?"
    );
  },
  ru: (trigger, habitName, mood) => {
    if (trigger === "low_mood") {
      const moodPart = mood ? " В контексте вижу: " + mood + "." : "";
      return (
        "Coach Lite (бесплатный локальный режим):" +
        moodPart +
        " Сделай один медленный вдох и запиши одну честную фразу о том, что сейчас поможет."
      );
    }
    return (
      'Coach Lite (бесплатный локальный режим): уменьши "' +
      habitName +
      '" до микро-шага, даже 1 минута считается. Какой самый маленький следующий шаг ты можешь сделать сегодня?'
    );
  },
  uk: (trigger, habitName, mood) => {
    if (trigger === "low_mood") {
      const moodPart = mood ? " У контексті бачу: " + mood + "." : "";
      return (
        "Coach Lite (безкоштовний локальний режим):" +
        moodPart +
        " Зроби один повільний вдих і запиши одну чесну фразу про те, що зараз допоможе."
      );
    }
    return (
      'Coach Lite (безкоштовний локальний режим): зменш "' +
      habitName +
      '" до мікрокроку, навіть 1 хвилина рахується. Який найменший наступний крок ти можеш зробити сьогодні?'
    );
  },
  es: (trigger, habitName, mood) => {
    if (trigger === "low_mood") {
      const moodPart = mood ? " Veo en tu contexto: " + mood + "." : "";
      return (
        "Coach Lite (modo local gratuito):" +
        moodPart +
        " Haz una respiración lenta y escribe una frase honesta sobre lo que ayudaría ahora."
      );
    }
    return (
      'Coach Lite (modo local gratuito): reduce "' +
      habitName +
      '" a un micro-paso; incluso 1 minuto cuenta. ¿Cuál es el paso más pequeño que puedes hacer hoy?'
    );
  },
  de: (trigger, habitName, mood) => {
    if (trigger === "low_mood") {
      const moodPart = mood ? " In deinem Kontext sehe ich: " + mood + "." : "";
      return (
        "Coach Lite (kostenloser lokaler Modus):" +
        moodPart +
        " Nimm einen langsamen Atemzug und schreibe einen ehrlichen Satz darüber, was jetzt helfen würde."
      );
    }
    return (
      'Coach Lite (kostenloser lokaler Modus): mach "' +
      habitName +
      '" heute winzig; auch 1 Minute zählt. Was ist der kleinste nächste Schritt?'
    );
  },
  fr: (trigger, habitName, mood) => {
    if (trigger === "low_mood") {
      const moodPart = mood ? " Je vois dans ton contexte : " + mood + "." : "";
      return (
        "Coach Lite (mode local gratuit) :" +
        moodPart +
        " Prends une respiration lente, puis écris une phrase honnête sur ce qui aiderait maintenant."
      );
    }
    return (
      'Coach Lite (mode local gratuit) : rends "' +
      habitName +
      "\" minuscule aujourd'hui ; même 1 minute compte. Quel est le plus petit prochain pas ?"
    );
  },
  ja: (trigger, habitName, mood) => {
    if (trigger === "low_mood") {
      const moodPart = mood ? " 最近の記録では「" + mood + "」が見えます。" : "";
      return (
        "Coach Lite（無料ローカルモード）:" +
        moodPart +
        " ゆっくり一呼吸して、今助けになることを正直に一文だけ書いてみましょう。"
      );
    }
    return (
      "Coach Lite（無料ローカルモード）: 今日は「" +
      habitName +
      "」を小さな一歩にしてみましょう。1分でも十分です。今できる一番小さな次の行動は何ですか？"
    );
  },
  ar: (trigger, habitName, mood) => {
    if (trigger === "low_mood") {
      const moodPart = mood ? " أرى في سياقك: " + mood + "." : "";
      return (
        "Coach Lite (الوضع المحلي المجاني):" +
        moodPart +
        " خذ نفساً بطيئاً، ثم اكتب جملة صادقة واحدة عمّا قد يساعدك الآن."
      );
    }
    return (
      'Coach Lite (الوضع المحلي المجاني): اجعل "' +
      habitName +
      '" خطوة صغيرة جداً اليوم؛ حتى دقيقة واحدة تُحسب. ما أصغر خطوة يمكنك فعلها الآن؟'
    );
  },
  he: (trigger, habitName, mood) => {
    if (trigger === "low_mood") {
      const moodPart = mood ? " אני רואה בהקשר שלך: " + mood + "." : "";
      return (
        "Coach Lite (מצב מקומי חינמי):" +
        moodPart +
        " קח נשימה איטית וכתוב משפט כן אחד על מה שיכול לעזור עכשיו."
      );
    }
    return (
      'Coach Lite (מצב מקומי חינמי): הקטן היום את "' +
      habitName +
      '" לצעד זעיר; גם דקה אחת נחשבת. מה הצעד הכי קטן שאפשר לעשות עכשיו?'
    );
  },
};

function getFirstIncompleteHabitName(context: object): string {
  const maybeContext = context as { habits?: Array<{ name?: string; completedToday?: boolean }> };
  const habits = Array.isArray(maybeContext.habits) ? maybeContext.habits : [];
  const incomplete = habits.find((habit) => habit?.completedToday === false);
  return incomplete?.name || habits[0]?.name || "your next habit";
}

function getLatestMood(context: object): string | null {
  const maybeContext = context as { recentMoods?: Array<{ mood?: string; emotion?: string }> };
  const moods = Array.isArray(maybeContext.recentMoods) ? maybeContext.recentMoods : [];
  const latest = moods[0];
  return latest?.emotion || latest?.mood || null;
}

function resolveClientCoachLiteLanguage(language: string): string {
  return CLIENT_COACH_LITE_TEMPLATES[language] ? language : "en";
}

function buildClientCoachLiteReply(request: AICoachRequest): string {
  const habitName = getFirstIncompleteHabitName(request.context);
  const mood = getLatestMood(request.context);
  const language = resolveClientCoachLiteLanguage(request.language);
  return CLIENT_COACH_LITE_TEMPLATES[language](request.trigger, habitName, mood);
}

function isMissingPaidAiConfigError(errorMessage: string): boolean {
  return errorMessage === "AI service not configured";
}

/**
 * Send a message to the AI Coach edge function.
 * Handles auth token retrieval and request formatting.
 */
export async function sendAICoachMessage(
  request: AICoachRequest,
  signal?: AbortSignal
): Promise<AICoachResponse> {
  if (!supabase) {
    throw new Error("Not authenticated");
  }

  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  if (!token) {
    throw new Error("Not authenticated");
  }

  if (!SUPABASE_URL) {
    throw new Error("SUPABASE_URL is not configured");
  }

  logger.log("[AICoach] Sending message to edge function");

  const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-coach`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})); // graceful: response may not be JSON (e.g. 502 proxy error)
    const errorMessage = typeof errorData.error === "string" ? errorData.error : "API error";

    if (isMissingPaidAiConfigError(errorMessage)) {
      logger.warn("[AICoach] Paid AI provider is not configured; using Coach Lite fallback");
      return { reply: buildClientCoachLiteReply(request) };
    }

    throw new Error(errorMessage);
  }

  const data = await response.json().catch(() => {
    throw new Error("Invalid JSON response from AI Coach");
  });
  return { reply: data.message || "" };
}
