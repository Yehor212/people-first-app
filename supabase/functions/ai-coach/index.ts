/**
 * Supabase Edge Function: AI Coach
 *
 * Provides AI-powered coaching using Gemini API (free tier).
 * Analyzes user context and provides personalized responses.
 *
 * Required environment variables:
 *   - SUPABASE_URL: Supabase project URL
 *   - SUPABASE_ANON_KEY: For JWT verification
 *   - SUPABASE_SERVICE_ROLE_KEY: server-side project document retrieval
 *
 * Optional environment variables:
 *   - GEMINI_API_KEY: enables full generative coaching; Coach Lite is used when absent
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";
import { getCorsHeaders, parseJsonBody } from "../_shared/http.ts";
import { redactUserRef, redactError } from "../_shared/redaction.ts";
import { buildCoachLiteResponse } from "../_shared/coach_lite.ts";
import {
  DEFAULT_GEMINI_API_BASE,
  DEFAULT_GEMINI_CHAT_MODEL,
  buildGeminiGenerateContentUrl,
  generateGeminiEmbedding,
} from "../_shared/gemini.ts";
import type { RagChunk } from "../_shared/rag.ts";
import {
  retrieveRagChunks as retrieveRagChunksFromStore,
  type RagMatchRow,
} from "../_shared/ragRetriever.ts";
import { buildAICoachRagResponse } from "../_shared/aiCoachRagFlow.ts";
import type { GeminiContent } from "../_shared/ragChat.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY") || "";
const IS_PRODUCTION = Deno.env.get("ENVIRONMENT") === "production";
const GEMINI_CHAT_MODEL = Deno.env.get("GEMINI_CHAT_MODEL") || DEFAULT_GEMINI_CHAT_MODEL;
const GEMINI_API_BASE = Deno.env.get("GEMINI_API_BASE") || DEFAULT_GEMINI_API_BASE;
const RAG_EMBEDDING_MODEL = Deno.env.get("RAG_EMBEDDING_MODEL") || "gemini-embedding-001";
const RAG_EMBEDDING_DIMENSIONS = readPositiveIntEnv("RAG_EMBEDDING_DIMENSIONS", 768);
const RAG_MATCH_COUNT = readPositiveIntEnv("RAG_MATCH_COUNT", 5);
const RAG_MATCH_THRESHOLD = readThresholdEnv("RAG_MATCH_THRESHOLD", 0.35);

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

// Types
interface CoachRequest {
  message: string;
  context: UserContext;
  language: "en" | "uk" | "es" | "de" | "fr" | "ja" | "ar" | "he" | "ru";
  trigger: CoachTrigger;
  conversationHistory?: Array<{ role: "user" | "coach"; content: string }>;
}

type CoachTrigger =
  | "onboarding"
  | "daily_checkin"
  | "low_mood"
  | "streak_broken"
  | "habit_skip"
  | "manual";

interface UserContext {
  recentMoods?: Array<{ mood: string; emotion?: string; date: string }>;
  habits?: Array<{ name: string; completedToday: boolean; streak: number }>;
  currentStreak?: number;
  lastActiveDate?: string;
  goals?: string[];
  stressManagement?: string;
  daysAway?: number;
}

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = Deno.env.get(name);
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readThresholdEnv(name: string, fallback: number): number {
  const raw = Deno.env.get(name);
  if (!raw) return fallback;
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

async function retrieveRagChunks(
  ragSupabase: ReturnType<typeof createClient> | null,
  message: string
): Promise<RagChunk[]> {
  if (!GEMINI_API_KEY || !ragSupabase) return [];

  return retrieveRagChunksFromStore({
    message,
    matchThreshold: RAG_MATCH_THRESHOLD,
    matchCount: RAG_MATCH_COUNT,
    embedText: (text) =>
      generateGeminiEmbedding(text, {
        apiKey: GEMINI_API_KEY,
        model: RAG_EMBEDDING_MODEL,
        dimensions: RAG_EMBEDDING_DIMENSIONS,
      }),
    matchChunks: async ({ queryEmbedding, matchThreshold, matchCount }) => {
      const { data, error } = await ragSupabase.rpc("match_rag_chunks", {
        query_embedding: `[${queryEmbedding.join(",")}]`,
        match_threshold: matchThreshold,
        match_count: matchCount,
      });

      if (error) throw error;
      return (data || []) as RagMatchRow[];
    },
    onError: (error) => console.error("[AICoach] RAG retrieval skipped:", redactError(error)),
  });
}

async function generateCoachReply(contents: GeminiContent[]): Promise<string> {
  const geminiResponse = await fetch(
    buildGeminiGenerateContentUrl(GEMINI_CHAT_MODEL, GEMINI_API_BASE),
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY! },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 200,
          topP: 0.9,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
        ],
      }),
    }
  );

  if (!geminiResponse.ok) {
    const errorText = await geminiResponse.text();
    console.error("[AICoach] Gemini API error:", errorText);
    throw new Error("AI service error");
  }

  const result = await geminiResponse.json();
  return result.candidates?.[0]?.content?.parts?.[0]?.text || "";
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

  ja: `あなたはZenFlowアプリのプロフェッショナルコーチです。スタイル:
- 構造的でサポーティブ
- 力強いオープンクエスチョンを投げかける
- 答えを与えるのではなく、振り返りを助ける
- 簡潔に：最大2-3文
- 絵文字は控えめに（1メッセージに1-2個）
- ユーザーはADHDの可能性あり、具体的に

ユーザーコンテキストが提供されます。回答を適応させてください。`,

  ar: `أنت مدرب محترف لتطبيق ZenFlow. أسلوبك:
- منظم وداعم
- اطرح أسئلة مفتوحة قوية
- ساعد على التأمل بدلاً من تقديم إجابات جاهزة
- الإيجاز: حد أقصى 2-3 جمل
- استخدم الرموز التعبيرية باعتدال (1-2 لكل رسالة)
- تذكر: قد يعاني المستخدم من ADHD، كن محدداً

سيتم توفير سياق المستخدم. قم بتكييف إجابتك.`,

  he: `אתה מאמן מקצועי של אפליקציית ZenFlow. הסגנון שלך:
- מובנה ותומך
- שאל שאלות פתוחות חזקות
- עזור לרפלקציה במקום לתת תשובות מוכנות
- תמציתיות: מקסימום 2-3 משפטים
- השתמש באימוג'י במתינות (1-2 להודעה)
- זכור: למשתמש עשוי להיות ADHD, היה ספציפי

הקשר המשתמש יסופק. התאם את התשובה שלך.`,
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
    ja: "ユーザーが低い気分を記録しました。共感を示し、何が影響したか優しく聞いてください。アプリの具体的なテクニックを1つ提案してください。",
    ar: "سجل المستخدم مزاجاً منخفضاً. أظهر التعاطف واسأل بلطف عما قد أثر على حالته. اقترح تقنية واحدة محددة من التطبيق.",
    he: "המשתמש רשם מצב רוח נמוך. הפגן אמפתיה ושאל בעדינות מה עשוי להשפיע. הצע טכניקה אחת ספציפית מהאפליקציה.",
  },
  streak_broken: {
    ru: "Пользователь вернулся после {days} дней отсутствия и потерял стрик. Поддержи без осуждения. Помоги начать заново с маленького шага.",
    en: "User returned after {days} days away and lost their streak. Support without judgment. Help restart with a small step.",
    uk: "Користувач повернувся після {days} днів відсутності і втратив стрік. Підтримай без осуду.",
    es: "El usuario regresó después de {days} días y perdió su racha. Apoya sin juzgar.",
    de: "Der Nutzer kehrte nach {days} Tagen zurück und hat seinen Streak verloren. Unterstütze ohne zu urteilen.",
    fr: "L'utilisateur est revenu après {days} jours d'absence et a perdu sa série. Soutiens sans juger.",
    ja: "ユーザーが{days}日ぶりに戻り、ストリークを失いました。判断せずにサポートし、小さな一歩から再開を手伝ってください。",
    ar: "عاد المستخدم بعد {days} أيام وفقد سلسلته. ادعمه بدون حكم. ساعده على البدء من جديد بخطوة صغيرة.",
    he: "המשתמש חזר אחרי {days} ימים ואיבד את הרצף. תמוך ללא שיפוטיות. עזור להתחיל מחדש עם צעד קטן.",
  },
  daily_checkin: {
    ru: "Это ежедневный чек-ин. Спроси кратко о планах на сегодня или о чём-то конкретном из контекста. Максимум 1 вопрос.",
    en: "This is a daily check-in. Briefly ask about today's plans or something specific from context. Maximum 1 question.",
    uk: "Це щоденний чек-ін. Стисло запитай про плани на сьогодні.",
    es: "Este es un check-in diario. Pregunta brevemente sobre los planes de hoy.",
    de: "Das ist ein täglicher Check-in. Frage kurz nach den heutigen Plänen.",
    fr: "C'est un check-in quotidien. Demande brièvement les plans d'aujourd'hui.",
    ja: "これはデイリーチェックインです。今日の予定について簡潔に聞いてください。質問は最大1つ。",
    ar: "هذا فحص يومي. اسأل باختصار عن خطط اليوم. سؤال واحد كحد أقصى.",
    he: "זהו צ'ק-אין יומי. שאל בקצרה על התוכניות להיום. מקסימום שאלה אחת.",
  },
  habit_skip: {
    ru: "Пользователь пропустил привычку. Мягко спроси что помешало и предложи уменьшить до микро-версии (1 минута вместо 10).",
    en: "User skipped a habit. Gently ask what got in the way and suggest reducing to a micro-version (1 minute instead of 10).",
    uk: "Користувач пропустив звичку. М'яко запитай, що завадило.",
    es: "El usuario se saltó un hábito. Pregunta suavemente qué se interpuso.",
    de: "Der Nutzer hat eine Gewohnheit ausgelassen. Frage sanft, was im Weg stand.",
    fr: "L'utilisateur a sauté une habitude. Demande doucement ce qui s'est mis en travers.",
    ja: "ユーザーが習慣をスキップしました。何が邪魔したか優しく聞き、マイクロ版への縮小を提案してください。",
    ar: "تخطى المستخدم عادة. اسأل بلطف ما الذي منعه واقترح تقليصها إلى نسخة مصغرة.",
    he: "המשתמש דילג על הרגל. שאל בעדינות מה הפריע והצע לצמצם לגרסה מיקרו.",
  },
  onboarding: {
    ru: "Это онбординг. Представься кратко как AI-коуч ZenFlow. Спроси одну вещь для персонализации.",
    en: "This is onboarding. Briefly introduce yourself as ZenFlow AI coach. Ask one thing for personalization.",
    uk: "Це онбординг. Коротко представся як AI-коуч ZenFlow.",
    es: "Esto es onboarding. Preséntate brevemente como coach de IA de ZenFlow.",
    de: "Das ist das Onboarding. Stelle dich kurz als ZenFlow AI-Coach vor.",
    fr: "C'est l'onboarding. Présente-toi brièvement comme coach IA de ZenFlow.",
    ja: "これはオンボーディングです。ZenFlow AIコーチとして簡潔に自己紹介し、パーソナライズのために1つ質問してください。",
    ar: "هذا هو الإعداد الأولي. قدم نفسك باختصار كمدرب ذكاء اصطناعي لـ ZenFlow. اسأل شيئاً واحداً للتخصيص.",
    he: "זהו אונבורדינג. הצג את עצמך בקצרה כמאמן AI של ZenFlow. שאל דבר אחד להתאמה אישית.",
  },
  manual: {
    ru: "Пользователь сам открыл чат. Отвечай на его запрос, используя контекст его данных.",
    en: "User opened chat manually. Respond to their request using their data context.",
    uk: "Користувач сам відкрив чат. Відповідай на його запит.",
    es: "El usuario abrió el chat manualmente. Responde a su solicitud.",
    de: "Der Nutzer hat den Chat manuell geöffnet. Antworte auf seine Anfrage.",
    fr: "L'utilisateur a ouvert le chat manuellement. Réponds à sa demande.",
    ja: "ユーザーが手動でチャットを開きました。データコンテキストを使用してリクエストに応答してください。",
    ar: "فتح المستخدم الدردشة يدوياً. استجب لطلبه باستخدام سياق بياناته.",
    he: "המשתמש פתח את הצ'אט ידנית. הגב לבקשתו תוך שימוש בהקשר הנתונים שלו.",
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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    console.warn("[AICoach] Invalid token:", redactError(authError));
    return jsonResponse(401, { error: "Invalid token" });
  }

  // P0 Fix #5: Rate limiting check
  if (!checkRateLimit(user.id)) {
    console.warn(`[AICoach] Rate limit exceeded for ${redactUserRef(user.id)}`);
    return jsonResponse(429, {
      error: "Too many requests. Please wait a minute.",
    });
  }

  try {
    const [body, bodyErr] = await parseJsonBody<CoachRequest>(req, origin);
    if (bodyErr) return bodyErr;
    const { message, context, language, trigger, conversationHistory = [] } = body;

    if (!message) {
      return jsonResponse(400, { error: "Message is required" });
    }

    // P0 Fix: Validate message length to prevent abuse
    if (message.length > MAX_MESSAGE_LENGTH) {
      return jsonResponse(400, {
        error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters.`,
      });
    }

    if (!GEMINI_API_KEY) {
      console.warn("[AICoach] GEMINI_API_KEY not configured; using Coach Lite fallback");
      const coachLite = buildCoachLiteResponse({ message, context, language, trigger });
      return jsonResponse(200, {
        message: coachLite.message,
        mode: coachLite.mode,
        requiresPaidApi: coachLite.requiresPaidApi,
        sources: coachLite.sources,
      });
    }

    // Build prompts
    const systemPrompt = SYSTEM_PROMPTS[language] || SYSTEM_PROMPTS.en;
    const triggerPrompt = (
      TRIGGER_PROMPTS[trigger]?.[language] ||
      TRIGGER_PROMPTS[trigger]?.en ||
      ""
    ).replace("{days}", String(context.daysAway || 0));

    // Format context
    const contextString = formatUserContext(context, language);

    // Build conversation for Gemini
    const contents: GeminiContent[] = [
      {
        role: "user",
        parts: [
          {
            text: `${systemPrompt}\n\n${triggerPrompt}\n\nКонтекст пользователя:\n${contextString}`,
          },
        ],
      },
      {
        role: "model",
        parts: [{ text: "Понял. Готов помочь." }],
      },
      // Add conversation history (last 10 messages)
      ...conversationHistory.slice(-10).map((msg) => ({
        role: msg.role === "user" ? ("user" as const) : ("model" as const),
        parts: [{ text: msg.content }],
      })),
      // Current message
      { role: "user", parts: [{ text: message }] },
    ];

    const ragSupabase = SUPABASE_SERVICE_ROLE_KEY
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
      : null;

    const ragResponse = await buildAICoachRagResponse({
      message,
      systemPrompt,
      triggerPrompt,
      trustedUserContext: contextString,
      conversationHistory,
      retrieveChunks: (query) => retrieveRagChunks(ragSupabase, query),
      generateReply: generateCoachReply,
      fallbackContents: contents,
    });

    console.log(`[AICoach] Response generated for trigger: ${trigger}`);

    return jsonResponse(200, {
      message: ragResponse.message,
      sources: ragResponse.sources,
    });
  } catch (error) {
    console.error("[AICoach] Error:", error);
    // P0 Fix: Don't leak implementation details in production
    return jsonResponse(500, {
      error: "Internal error",
      // Only include details in non-production for debugging
      ...(IS_PRODUCTION
        ? {}
        : {
            details: error instanceof Error ? error.message : "Unknown error",
          }),
    });
  }
});

// Context labels for all 8 supported languages
const CONTEXT_LABELS: Record<
  string,
  {
    weekMoods: string;
    habits: string;
    streak: string;
    goals: string;
    stress: string;
    noContext: string;
  }
> = {
  ru: {
    weekMoods: "Настроения за неделю",
    habits: "Привычки",
    streak: "Текущий стрик",
    goals: "Цели",
    stress: "Способ справляться со стрессом",
    noContext: "Контекст не предоставлен",
  },
  uk: {
    weekMoods: "Настрої за тиждень",
    habits: "Звички",
    streak: "Поточний стрік",
    goals: "Цілі",
    stress: "Спосіб справлятися зі стресом",
    noContext: "Контекст не надано",
  },
  en: {
    weekMoods: "Week moods",
    habits: "Habits",
    streak: "Current streak",
    goals: "Goals",
    stress: "Stress management",
    noContext: "No context provided",
  },
  es: {
    weekMoods: "Estados de ánimo semanales",
    habits: "Hábitos",
    streak: "Racha actual",
    goals: "Metas",
    stress: "Gestión del estrés",
    noContext: "Sin contexto proporcionado",
  },
  de: {
    weekMoods: "Wochenstimmungen",
    habits: "Gewohnheiten",
    streak: "Aktueller Streak",
    goals: "Ziele",
    stress: "Stressbewältigung",
    noContext: "Kein Kontext bereitgestellt",
  },
  fr: {
    weekMoods: "Humeurs de la semaine",
    habits: "Habitudes",
    streak: "Série actuelle",
    goals: "Objectifs",
    stress: "Gestion du stress",
    noContext: "Aucun contexte fourni",
  },
  ja: {
    weekMoods: "週の気分",
    habits: "習慣",
    streak: "現在のストリーク",
    goals: "目標",
    stress: "ストレス管理",
    noContext: "コンテキストなし",
  },
  ar: {
    weekMoods: "مزاج الأسبوع",
    habits: "العادات",
    streak: "السلسلة الحالية",
    goals: "الأهداف",
    stress: "إدارة التوتر",
    noContext: "لم يتم توفير سياق",
  },
  he: {
    weekMoods: "מצבי רוח שבועיים",
    habits: "הרגלים",
    streak: "רצף נוכחי",
    goals: "מטרות",
    stress: "ניהול לחץ",
    noContext: "לא סופק הקשר",
  },
};

function formatUserContext(context: UserContext, lang: string): string {
  const labels = CONTEXT_LABELS[lang] || CONTEXT_LABELS.en;
  const lines: string[] = [];

  if (context.recentMoods && context.recentMoods.length > 0) {
    const moodSummary = context.recentMoods
      .slice(0, 7)
      .map((m) => `${m.date}: ${m.mood}${m.emotion ? ` (${m.emotion})` : ""}`)
      .join(", ");
    lines.push(`${labels.weekMoods}: ${moodSummary}`);
  }

  if (context.habits && context.habits.length > 0) {
    const habitsSummary = context.habits
      .map((h) => `${h.name} (${h.completedToday ? "✓" : "○"}, streak: ${h.streak})`)
      .join(", ");
    lines.push(`${labels.habits}: ${habitsSummary}`);
  }

  if (context.currentStreak !== undefined) {
    lines.push(`${labels.streak}: ${context.currentStreak}`);
  }

  if (context.goals && context.goals.length > 0) {
    lines.push(`${labels.goals}: ${context.goals.join(", ")}`);
  }

  if (context.stressManagement) {
    lines.push(`${labels.stress}: ${context.stressManagement}`);
  }

  return lines.length > 0 ? lines.join("\n") : labels.noContext;
}
