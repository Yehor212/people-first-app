import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import webpush from "npm:web-push@3.6.7";

type ReminderType = "mood" | "habit" | "focus";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT");
const FCM_PROJECT_ID = Deno.env.get("FCM_PROJECT_ID");
const FCM_SERVICE_ACCOUNT_B64 = Deno.env.get("FCM_SERVICE_ACCOUNT_B64");
const CRON_SECRET = Deno.env.get("CRON_SECRET"); // Secret for cron job authentication

// P0 Fix: Constant-time comparison to prevent timing attacks
function secureCompare(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// Allowed origins for CORS (production only - no http://localhost)
const ALLOWED_ORIGINS = [
  "https://yehor212.github.io",
  "capacitor://localhost", // Required for mobile app
];

const getCorsHeaders = (origin: string | null) => {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  };
};

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
    weekday: "short"
  });
  const parts = formatter.formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const dateKey = `${map.year}-${map.month}-${map.day}`;
  const hour = Number(map.hour);
  const minute = Number(map.minute);
  const weekday = map.weekday;
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { dateKey, minutes: hour * 60 + minute, day: dayMap[weekday] ?? 0 };
};

const getTitleBody = (type: ReminderType, language: string) => {
  if (language === "ru") {
    if (type === "mood") return { title: "ZenFlow", body: "Как настроение сегодня?" };
    if (type === "habit") return { title: "ZenFlow", body: "Время отметить привычки." };
    return { title: "ZenFlow", body: "Готовы к фокус-сессии?" };
  }
  if (type === "mood") return { title: "ZenFlow", body: "How are you feeling today?" };
  if (type === "habit") return { title: "ZenFlow", body: "Time to check your habits." };
  return { title: "ZenFlow", body: "Ready for a focus session?" };
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
    ["sign"]
  );

  const jwt = await create(
    { alg: "RS256", typ: "JWT" },
    {
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: getNumericDate(0),
      exp: getNumericDate(60 * 60)
    },
    key
  );

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.access_token as string | undefined;
};

const sendFcmNotifications = async (
  accessToken: string,
  tokens: string[],
  content: { title: string; body: string }
) => {
  if (!FCM_PROJECT_ID) return 0;
  const url = `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`;
  const results = await Promise.all(
    tokens.map((token) =>
      fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: {
            token,
            notification: {
              title: content.title,
              body: content.body
            }
          }
        })
      })
        .then((res) => (res.ok ? 1 : 0))
        .catch(() => 0)
    )
  );

  return results.reduce((total, value) => total + value, 0);
};

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  const jsonResponse = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    // ============================================
    // AUTHENTICATION: Require cron secret or service role
    // ============================================
    const authHeader = req.headers.get("Authorization");
    const cronSecretHeader = req.headers.get("X-Cron-Secret");

    // P0 Fix: Use secure comparison to prevent timing attacks
    const isAuthorized =
      (CRON_SECRET && secureCompare(cronSecretHeader, CRON_SECRET)) ||
      secureCompare(authHeader, `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`);

    if (!isAuthorized) {
      console.warn("[ScheduledPush] Unauthorized request attempt");
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: settings, error } = await supabase
      .from("user_reminder_settings")
      .select("*")
      .eq("enabled", true);

    if (error) {
      return jsonResponse({ error: "Failed to load settings" }, 500);
    }

  const fcmAccessToken = await getFcmAccessToken();
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
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
      { type: "focus", time: item.focus_time }
    ];

    for (const check of checks) {
      const target = toMinutes(check.time || "00:00");
      if (!isInWindow(minutes, target, 15)) continue;
      if (check.type === "habit" && (!item.habit_ids || item.habit_ids.length === 0)) continue;

      // P0 Fix: Atomic check with INSERT ON CONFLICT to prevent race conditions
      // Try to insert first - if it fails with unique violation, notification was already sent
      const { error: logError } = await supabase.from("push_logs").insert({
        user_id: item.user_id,
        type: check.type,
        date_key: dateKey,
        sent_at: new Date().toISOString()
      });

      // If insert failed due to unique constraint, notification was already sent
      if (logError?.code === '23505') {
        continue; // Skip - already sent
      }
      if (logError) {
        console.error(`[ScheduledPush] Failed to log push for ${item.user_id}:`, logError);
        continue;
      }

      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("endpoint, keys")
        .eq("user_id", item.user_id);

      const { data: deviceTokens } = await supabase
        .from("push_device_tokens")
        .select("token")
        .eq("user_id", item.user_id);

      if ((!subs || subs.length === 0) && (!deviceTokens || deviceTokens.length === 0)) {
        continue;
      }

      const content = getTitleBody(check.type, item.language || "en");

      if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && subs && subs.length > 0) {
        await Promise.all(
          subs.map((sub) =>
            webpush
              .sendNotification(
                { endpoint: sub.endpoint, keys: sub.keys },
                JSON.stringify(content)
              )
              .catch(() => null)
          )
        );
      }

      if (fcmAccessToken && deviceTokens && deviceTokens.length > 0) {
        await sendFcmNotifications(
          fcmAccessToken,
          deviceTokens.map((row) => row.token),
          content
        );
      }

      // P0 Fix: Log was already inserted atomically above, no need to upsert here
    }
  }

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
});
