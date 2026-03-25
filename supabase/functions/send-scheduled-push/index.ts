import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import webpush from "npm:web-push@3.6.7";
import { isAuthorizedRequest, secureCompare } from "../_shared/auth.ts";
import {
  createJsonResponse,
  createNoContentResponse,
} from "../_shared/http.ts";
import { redactError, redactUserRef } from "../_shared/redaction.ts";

type ReminderType = "mood" | "habit" | "focus";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT");
const FCM_PROJECT_ID = Deno.env.get("FCM_PROJECT_ID");
const FCM_SERVICE_ACCOUNT_B64 = Deno.env.get("FCM_SERVICE_ACCOUNT_B64");
const CRON_SECRET = Deno.env.get("CRON_SECRET"); // Secret for cron job authentication

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const isQuiet = (current: number, start: number, end: number) => {
  if (start === end) return false;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
};

const isInWindow = (current: number, target: number, window: number) => {
  const start = target - window;
  const end = target + window;
  if (start < 0) return current >= 0 && current < end;
  if (end >= 1440) return current >= start || current < end - 1440;
  return current >= start && current < end;
};

const getLocalParts = (timezone: string) => {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  const parts = formatter.formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const dateKey = `${map.year}-${map.month}-${map.day}`;
  const hour = Number(map.hour);
  const minute = Number(map.minute);
  const weekday = map.weekday;
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return { dateKey, minutes: hour * 60 + minute, day: dayMap[weekday] ?? 0 };
};

const NOTIFICATION_STRINGS: Record<string, Record<ReminderType, string>> = {
  en: {
    mood: "How are you feeling today?",
    habit: "Time to check your habits.",
    focus: "Ready for a focus session?",
  },
  ru: {
    mood: "Как настроение сегодня?",
    habit: "Время отметить привычки.",
    focus: "Готовы к фокус-сессии?",
  },
  uk: {
    mood: "Як настрій сьогодні?",
    habit: "Час перевірити звички.",
    focus: "Готові до фокус-сесії?",
  },
  es: {
    mood: "¿Cómo te sientes hoy?",
    habit: "Hora de revisar tus hábitos.",
    focus: "¿Listo para una sesión de enfoque?",
  },
  de: {
    mood: "Wie fühlst du dich heute?",
    habit: "Zeit, deine Gewohnheiten zu prüfen.",
    focus: "Bereit für eine Fokus-Sitzung?",
  },
  fr: {
    mood: "Comment vous sentez-vous aujourd'hui ?",
    habit: "C'est l'heure de vérifier vos habitudes.",
    focus: "Prêt pour une session de concentration ?",
  },
  ja: {
    mood: "今日の気分はいかがですか？",
    habit: "習慣をチェックする時間です。",
    focus: "集中セッションの準備はできましたか？",
  },
  ar: {
    mood: "كيف حالك اليوم؟",
    habit: "حان وقت مراجعة عاداتك.",
    focus: "هل أنت مستعد لجلسة تركيز؟",
  },
  he: {
    mood: "איך אתה מרגיש היום?",
    habit: "הגיע הזמן לבדוק את ההרגלים.",
    focus: "מוכן לסשן מיקוד?",
  },
};

const getTitleBody = (type: ReminderType, language: string) => {
  const strings = NOTIFICATION_STRINGS[language] || NOTIFICATION_STRINGS.en;
  return { title: "ZenFlow", body: strings[type] };
};

const pemToArrayBuffer = (pem: string) => {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

const getFcmAccessToken = async () => {
  if (!FCM_SERVICE_ACCOUNT_B64 || !FCM_PROJECT_ID) return null;
  const serviceAccount = JSON.parse(atob(FCM_SERVICE_ACCOUNT_B64));
  const keyData = pemToArrayBuffer(serviceAccount.private_key);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const jwt = await create(
    { alg: "RS256", typ: "JWT" },
    {
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: getNumericDate(0),
      exp: getNumericDate(60 * 60),
    },
    key,
  );

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.access_token as string | undefined;
};

const sendFcmNotifications = async (
  accessToken: string,
  tokens: string[],
  content: { title: string; body: string },
) => {
  if (!FCM_PROJECT_ID) return 0;
  const url = `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`;
  const results = await Promise.all(
    tokens.map((token) =>
      fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token,
            notification: {
              title: content.title,
              body: content.body,
            },
          },
        }),
      })
        .then((res) => (res.ok ? 1 : 0))
        .catch(() => 0),
    ),
  );

  return results.reduce((total, value) => total + value, 0);
};

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");

  try {
    if (req.method === "OPTIONS") {
      return createNoContentResponse(origin);
    }
    if (req.method !== "POST") {
      return createJsonResponse(origin, 405, { error: "Method not allowed" });
    }

    // ============================================
    // AUTHENTICATION: Require cron secret or service role
    // ============================================
    const authHeader = req.headers.get("Authorization");
    const cronSecretHeader = req.headers.get("X-Cron-Secret");

    // P1 Diagnostics: Log request details (NO secrets!)
    console.log("[ScheduledPush] Request received", {
      hasAuthHeader: !!authHeader,
      hasBearerPrefix: authHeader?.startsWith("Bearer ") ?? false,
      hasCronSecret: !!cronSecretHeader,
      hasCronSecretEnv: !!CRON_SECRET,
      userAgent: req.headers.get("User-Agent"),
      origin: req.headers.get("Origin"),
      timestamp: new Date().toISOString(),
    });

    // P0 Fix: Use secure comparison to prevent timing attacks
    const isAuthorized = isAuthorizedRequest({
      authHeader,
      cronSecretHeader,
      serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
      cronSecret: CRON_SECRET,
    });

    if (!isAuthorized) {
      console.warn("[ScheduledPush] Unauthorized request - details:", {
        cronSecretMatch: CRON_SECRET
          ? secureCompare(cronSecretHeader, CRON_SECRET)
          : "no_env",
        authHeaderMatch: authHeader?.startsWith("Bearer ")
          ? "has_bearer"
          : "no_bearer",
      });
      return createJsonResponse(origin, 401, { error: "Unauthorized" });
    }

    console.log("[ScheduledPush] Authorized successfully");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: settings, error } = await supabase
      .from("user_reminder_settings")
      .select("*")
      .eq("enabled", true);

    if (error) {
      return createJsonResponse(origin, 500, {
        error: "Failed to load settings",
      });
    }

    const fcmAccessToken = await getFcmAccessToken();
    if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT) {
      webpush.setVapidDetails(
        VAPID_SUBJECT,
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY,
      );
    }

    for (const item of settings || []) {
      const timezone = item.timezone || "UTC";
      const { dateKey, minutes, day } = getLocalParts(timezone);

      if (!item.days?.includes(day)) continue;

      const quietStart = toMinutes(item.quiet_start || "00:00");
      const quietEnd = toMinutes(item.quiet_end || "00:00");
      if (isQuiet(minutes, quietStart, quietEnd)) continue;

      const checks: Array<{ type: ReminderType; time: string }> = [
        { type: "mood", time: item.mood_time },
        { type: "habit", time: item.habit_time },
        { type: "focus", time: item.focus_time },
      ];

      for (const check of checks) {
        const target = toMinutes(check.time || "00:00");
        if (!isInWindow(minutes, target, 15)) continue;
        if (
          check.type === "habit" &&
          (!item.habit_ids || item.habit_ids.length === 0)
        )
          continue;

        // Atomic dedup: upsert with ignoreDuplicates avoids 409 errors in API analytics
        // Root cause: plain INSERT → PostgREST 409 on PK (user_id, type, date_key) conflict
        // Fix: upsert + ignoreDuplicates → 200 + empty data when row already exists
        const { data: logData, error: logError } = await supabase
          .from("push_logs")
          .upsert(
            {
              user_id: item.user_id,
              type: check.type,
              date_key: dateKey,
              sent_at: new Date().toISOString(),
            },
            { onConflict: "user_id,type,date_key", ignoreDuplicates: true },
          )
          .select("sent_at");

        if (logError) {
          console.error(
            `[ScheduledPush] Failed to log push for ${redactUserRef(item.user_id)}:`,
            logError,
          );
          continue;
        }

        // ignoreDuplicates: true → returns empty array if row already existed
        if (!logData || logData.length === 0) {
          continue; // Already sent today — skip silently (no 409)
        }

        const { data: subs } = await supabase
          .from("push_subscriptions")
          .select("endpoint, keys")
          .eq("user_id", item.user_id);

        const { data: deviceTokens } = await supabase
          .from("push_device_tokens")
          .select("token")
          .eq("user_id", item.user_id);

        if (
          (!subs || subs.length === 0) &&
          (!deviceTokens || deviceTokens.length === 0)
        ) {
          continue;
        }

        const content = getTitleBody(check.type, item.language || "en");

        if (
          VAPID_PUBLIC_KEY &&
          VAPID_PRIVATE_KEY &&
          VAPID_SUBJECT &&
          subs &&
          subs.length > 0
        ) {
          await Promise.all(
            subs.map((sub) =>
              webpush
                .sendNotification(
                  { endpoint: sub.endpoint, keys: sub.keys },
                  JSON.stringify(content),
                )
                .catch(() => null),
            ),
          );
        }

        if (fcmAccessToken && deviceTokens && deviceTokens.length > 0) {
          await sendFcmNotifications(
            fcmAccessToken,
            deviceTokens.map((row) => row.token),
            content,
          );
        }

        // P0 Fix: Log was already inserted atomically above, no need to upsert here
      }
    }

    return createJsonResponse(origin, 200, { ok: true });
  } catch (err) {
    console.error("[ScheduledPush] Error", err);
    return createJsonResponse(origin, 500, {
      error: "Internal error",
      requestId: redactError(err),
    });
  }
});
