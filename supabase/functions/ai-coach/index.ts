/**
 * Supabase Edge Function: AI Coach
 *
 * Provides AI-powered coaching using Gemini API (free tier).
 * Analyzes user context and provides personalized responses.
 *
 * Required secrets:
 *   - GEMINI_API_KEY: Get from https://makersuite.google.com/app/apikey
 *   - SUPABASE_URL: Supabase project URL
 *   - SUPABASE_ANON_KEY: For JWT verification
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// P0 Fix: Check environment for CORS
const IS_PRODUCTION = Deno.env.get("ENVIRONMENT") === "production";

// Allowed origins for CORS
// P0 Fix: Allow all Capacitor and common development origins
const ALLOWED_ORIGINS = [
  "https://yehor212.github.io",
  "capacitor://localhost",       // Capacitor iOS
  "http://localhost",            // Capacitor Android WebView
  "https://localhost",           // Capacitor Android HTTPS
  "http://localhost:5173",       // Vite dev server
  "http://localhost:8100",       // Ionic dev server
  "null",                        // Some Android WebViews send null origin
];

// P0 Fix #5: Rate limiting - 10 requests per minute per user
const RATE_LIMIT = 10;
const RATE_WINDOW = 60000; // 1 minute in ms
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Message length limit
const MAX_MESSAGE_LENGTH = 2000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  // Cleanup old entries periodically (simple garbage collection)
  if (rateLimitMap.size > 1000) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (now > value.resetAt) {
        rateLimitMap.delete(key);
      }
    }
  }

  if (!userLimit || now > userLimit.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT) {
    return false;
  }

  userLimit.count++;
  return true;
}

const getCorsHeaders = (origin: string | null) => {
  // P0 Fix: Better origin handling for Android/iOS apps
  const effectiveOrigin = origin || "null";
  const isAllowed = ALLOWED_ORIGINS.includes(effectiveOrigin);

  // Log origin for debugging (only in non-production)
  if (!IS_PRODUCTION) {
    console.log(`[AICoach] Origin: ${effectiveOrigin}, Allowed: ${isAllowed}`);
  }

  // If origin is allowed, echo it back. Otherwise use wildcard for Capacitor apps.
  const allowedOrigin = isAllowed ? effectiveOrigin : "*";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  };
};

// Types
interface CoachRequest {
  message: string;
  context: UserContext;
  language: 'ru' | 'en' | 'uk' | 'es' | 'de' | 'fr';
  trigger: CoachTrigger;
  conversationHistory?: Array<{ role: 'user' | 'coach'; content: string }>;
}

type CoachTrigger = 'onboarding' | 'daily_checkin' | 'low_mood' | 'streak_broken' | 'habit_skip' | 'manual';

interface UserContext {
  recentMoods?: Array<{ mood: string; emotion?: string; date: string }>;
  habits?: Array<{ name: string; completedToday: boolean; streak: number }>;
  currentStreak?: number;
  lastActiveDate?: string;
  goals?: string[];
  stressManagement?: string;
  daysAway?: number;
}

// System prompts by language
const SYSTEM_PROMPTS: Record<string, string> = {
  ru: `Ты — профессиональный коуч приложения ZenFlow. Твой стиль:
- Структурированный и поддерживающий
- Задаёшь сильные открытые вопросы
- Помогаешь рефлексировать, а не даёшь готовые ответы
- Краткость: максимум 2-3 предложения
- Используй эмодзи умеренно (1-2 на сообщение)
- Помни: пользователь может иметь ADHD, будь конкретным
- Если пользователь пишет о трудностях — прояви эмпатию

Контекст пользователя будет предоставлен. Адаптируй ответ.`,

  en: `You are a professional coach for the ZenFlow app. Your style:
- Structured and supportive
- Ask powerful open-ended questions
- Help reflect rather than give ready answers
- Brief: maximum 2-3 sentences
- Use emojis sparingly (1-2 per message)
- Remember: user may have ADHD, be specific
- If user writes about difficulties — show empathy

User context will be provided. Adapt your response.`,

  uk: `Ти — професійний коуч застосунку ZenFlow. Твій стиль:
- Структурований і підтримуючий
- Задаєш сильні відкриті питання
- Допомагаєш рефлексувати, а не даєш готові відповіді
- Стислість: максимум 2-3 речення
- Використовуй емодзі помірно (1-2 на повідомлення)
- Пам'ятай: користувач може мати ADHD, будь конкретним

Контекст користувача буде надано. Адаптуй відповідь.`,

  es: `Eres un coach profesional de la aplicación ZenFlow. Tu estilo:
- Estructurado y de apoyo
- Haz preguntas abiertas poderosas
- Ayuda a reflexionar en lugar de dar respuestas preparadas
- Brevedad: máximo 2-3 oraciones
- Usa emojis con moderación (1-2 por mensaje)
- Recuerda: el usuario puede tener ADHD, sé específico

Se proporcionará contexto del usuario. Adapta tu respuesta.`,

  de: `Du bist ein professioneller Coach für die ZenFlow-App. Dein Stil:
- Strukturiert und unterstützend
- Stelle kraftvolle offene Fragen
- Hilf beim Reflektieren statt fertige Antworten zu geben
- Kürze: maximal 2-3 Sätze
- Verwende Emojis sparsam (1-2 pro Nachricht)
- Denk daran: Der Nutzer kann ADHS haben, sei konkret

Benutzerkontext wird bereitgestellt. Passe deine Antwort an.`,

  fr: `Tu es un coach professionnel de l'application ZenFlow. Ton style:
- Structuré et bienveillant
- Pose des questions ouvertes puissantes
- Aide à réfléchir plutôt que donner des réponses toutes faites
- Brièveté: maximum 2-3 phrases
- Utilise les emojis avec modération (1-2 par message)
- Rappelle-toi: l'utilisateur peut avoir un TDAH, sois précis

Le contexte de l'utilisateur sera fourni. Adapte ta réponse.`,
};

// Trigger-specific prompts
const TRIGGER_PROMPTS: Record<CoachTrigger, Record<string, string>> = {
  low_mood: {
    ru: "Пользователь только что отметил низкое настроение. Прояви эмпатию и мягко спроси, что могло повлиять на состояние. Предложи одну конкретную технику из приложения (дыхание, журнал благодарности).",
    en: "User just logged a low mood. Show empathy and gently ask what might have influenced their state. Suggest one specific technique from the app (breathing, gratitude journal).",
    uk: "Користувач щойно відмітив низький настрій. Прояви емпатію і м'яко запитай, що могло вплинути на стан.",
    es: "El usuario acaba de registrar un estado de ánimo bajo. Muestra empatía y pregunta suavemente qué pudo haber influido.",
    de: "Der Nutzer hat gerade eine schlechte Stimmung protokolliert. Zeige Empathie und frage sanft, was den Zustand beeinflusst haben könnte.",
    fr: "L'utilisateur vient d'enregistrer une humeur basse. Montre de l'empathie et demande doucement ce qui a pu influencer son état.",
  },
  streak_broken: {
    ru: "Пользователь вернулся после {days} дней отсутствия и потерял стрик. Поддержи без осуждения. Помоги начать заново с маленького шага.",
    en: "User returned after {days} days away and lost their streak. Support without judgment. Help restart with a small step.",
    uk: "Користувач повернувся після {days} днів відсутності і втратив стрік. Підтримай без осуду.",
    es: "El usuario regresó después de {days} días y perdió su racha. Apoya sin juzgar.",
    de: "Der Nutzer kehrte nach {days} Tagen zurück und hat seinen Streak verloren. Unterstütze ohne zu urteilen.",
    fr: "L'utilisateur est revenu après {days} jours d'absence et a perdu sa série. Soutiens sans juger.",
  },
  daily_checkin: {
    ru: "Это ежедневный чек-ин. Спроси кратко о планах на сегодня или о чём-то конкретном из контекста. Максимум 1 вопрос.",
    en: "This is a daily check-in. Briefly ask about today's plans or something specific from context. Maximum 1 question.",
    uk: "Це щоденний чек-ін. Стисло запитай про плани на сьогодні.",
    es: "Este es un check-in diario. Pregunta brevemente sobre los planes de hoy.",
    de: "Das ist ein täglicher Check-in. Frage kurz nach den heutigen Plänen.",
    fr: "C'est un check-in quotidien. Demande brièvement les plans d'aujourd'hui.",
  },
  habit_skip: {
    ru: "Пользователь пропустил привычку. Мягко спроси что помешало и предложи уменьшить до микро-версии (1 минута вместо 10).",
    en: "User skipped a habit. Gently ask what got in the way and suggest reducing to a micro-version (1 minute instead of 10).",
    uk: "Користувач пропустив звичку. М'яко запитай, що завадило.",
    es: "El usuario se saltó un hábito. Pregunta suavemente qué se interpuso.",
    de: "Der Nutzer hat eine Gewohnheit ausgelassen. Frage sanft, was im Weg stand.",
    fr: "L'utilisateur a sauté une habitude. Demande doucement ce qui s'est mis en travers.",
  },
  onboarding: {
    ru: "Это онбординг. Представься кратко как AI-коуч ZenFlow. Спроси одну вещь для персонализации.",
    en: "This is onboarding. Briefly introduce yourself as ZenFlow AI coach. Ask one thing for personalization.",
    uk: "Це онбординг. Коротко представся як AI-коуч ZenFlow.",
    es: "Esto es onboarding. Preséntate brevemente como coach de IA de ZenFlow.",
    de: "Das ist das Onboarding. Stelle dich kurz als ZenFlow AI-Coach vor.",
    fr: "C'est l'onboarding. Présente-toi brièvement comme coach IA de ZenFlow.",
  },
  manual: {
    ru: "Пользователь сам открыл чат. Отвечай на его запрос, используя контекст его данных.",
    en: "User opened chat manually. Respond to their request using their data context.",
    uk: "Користувач сам відкрив чат. Відповідай на його запит.",
    es: "El usuario abrió el chat manualmente. Responde a su solicitud.",
    de: "Der Nutzer hat den Chat manuell geöffnet. Antworte auf seine Anfrage.",
    fr: "L'utilisateur a ouvert le chat manuellement. Réponds à sa demande.",
  },
};

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  const jsonResponse = (status: number, payload: Record<string, unknown>) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    console.warn("[AICoach] Missing authorization header");
    return jsonResponse(401, { error: "Unauthorized" });
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.warn("[AICoach] Invalid token:", authError?.message);
    return jsonResponse(401, { error: "Invalid token" });
  }

  // P0 Fix #5: Rate limiting check
  if (!checkRateLimit(user.id)) {
    console.warn(`[AICoach] Rate limit exceeded for user: ${user.id}`);
    return jsonResponse(429, { error: "Too many requests. Please wait a minute." });
  }

  // Check if Gemini is configured
  if (!GEMINI_API_KEY) {
    console.error("[AICoach] GEMINI_API_KEY not configured");
    return jsonResponse(500, { error: "AI service not configured" });
  }

  try {
    const body: CoachRequest = await req.json();
    const { message, context, language, trigger, conversationHistory = [] } = body;

    if (!message) {
      return jsonResponse(400, { error: "Message is required" });
    }

    // P0 Fix: Validate message length to prevent abuse
    if (message.length > MAX_MESSAGE_LENGTH) {
      return jsonResponse(400, { error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters.` });
    }

    // Build prompts
    const systemPrompt = SYSTEM_PROMPTS[language] || SYSTEM_PROMPTS.en;
    const triggerPrompt = (TRIGGER_PROMPTS[trigger]?.[language] || TRIGGER_PROMPTS[trigger]?.en || "")
      .replace("{days}", String(context.daysAway || 0));

    // Format context
    const contextString = formatUserContext(context, language);

    // Build conversation for Gemini
    const contents = [
      {
        role: "user",
        parts: [{ text: `${systemPrompt}\n\n${triggerPrompt}\n\nКонтекст пользователя:\n${contextString}` }],
      },
      {
        role: "model",
        parts: [{ text: "Понял. Готов помочь." }],
      },
      // Add conversation history (last 10 messages)
      ...conversationHistory.slice(-10).map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      })),
      // Current message
      { role: "user", parts: [{ text: message }] },
    ];

    // Call Gemini API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 200,
            topP: 0.9,
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          ],
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("[AICoach] Gemini API error:", errorText);
      return jsonResponse(500, { error: "AI service error" });
    }

    const result = await geminiResponse.json();
    const coachMessage = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!coachMessage) {
      console.error("[AICoach] Empty response from Gemini");
      return jsonResponse(500, { error: "Empty AI response" });
    }

    console.log(`[AICoach] Response generated for trigger: ${trigger}`);

    return jsonResponse(200, { message: coachMessage });

  } catch (error) {
    console.error("[AICoach] Error:", error);
    // P0 Fix: Don't leak implementation details in production
    return jsonResponse(500, {
      error: "Internal error",
      // Only include details in non-production for debugging
      ...(IS_PRODUCTION ? {} : { details: error instanceof Error ? error.message : "Unknown error" }),
    });
  }
});

function formatUserContext(context: UserContext, lang: string): string {
  const lines: string[] = [];
  const isRu = lang === "ru" || lang === "uk";

  if (context.recentMoods && context.recentMoods.length > 0) {
    const moodSummary = context.recentMoods.slice(0, 7).map(m =>
      `${m.date}: ${m.mood}${m.emotion ? ` (${m.emotion})` : ""}`
    ).join(", ");
    lines.push(isRu ? `Настроения за неделю: ${moodSummary}` : `Week moods: ${moodSummary}`);
  }

  if (context.habits && context.habits.length > 0) {
    const habitsSummary = context.habits.map(h =>
      `${h.name} (${h.completedToday ? "✓" : "○"}, streak: ${h.streak})`
    ).join(", ");
    lines.push(isRu ? `Привычки: ${habitsSummary}` : `Habits: ${habitsSummary}`);
  }

  if (context.currentStreak !== undefined) {
    lines.push(isRu ? `Текущий стрик: ${context.currentStreak} дней` : `Current streak: ${context.currentStreak} days`);
  }

  if (context.goals && context.goals.length > 0) {
    lines.push(isRu ? `Цели: ${context.goals.join(", ")}` : `Goals: ${context.goals.join(", ")}`);
  }

  if (context.stressManagement) {
    lines.push(isRu ? `Способ справляться со стрессом: ${context.stressManagement}` : `Stress management: ${context.stressManagement}`);
  }

  return lines.length > 0 ? lines.join("\n") : (isRu ? "Контекст не предоставлен" : "No context provided");
}
