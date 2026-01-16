import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:egorsamraev@gmail.com";
const FCM_PROJECT_ID = Deno.env.get("FCM_PROJECT_ID");
const FCM_SERVICE_ACCOUNT_B64 = Deno.env.get("FCM_SERVICE_ACCOUNT_B64");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });

const getTitleBody = (type: string, language: string) => {
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

const sendFcmNotifications = async (tokens: string[], content: { title: string; body: string }) => {
  const accessToken = await getFcmAccessToken();
  if (!accessToken || !FCM_PROJECT_ID) return 0;

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

// Simple web push implementation without external dependency
const sendWebPush = async (
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  vapidSubject: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<boolean> => {
  try {
    // For now, we'll skip web push as it requires complex VAPID signing
    // This can be implemented later with proper crypto handling
    console.log("Web push would be sent to:", subscription.endpoint);
    return false;
  } catch (error) {
    console.error("Web push error:", error);
    return false;
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return jsonResponse(401, { error: "Unauthorized" });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return jsonResponse(401, { error: "Unauthorized" });
    }

    const { data: settings } = await supabase
      .from("user_reminder_settings")
      .select("language")
      .eq("user_id", data.user.id)
      .maybeSingle();

    const { data: subs, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("endpoint, keys")
      .eq("user_id", data.user.id);

    if (subsError) {
      return jsonResponse(500, { error: "Failed to load subscriptions" });
    }

    const { data: deviceTokens, error: tokenError } = await supabase
      .from("push_device_tokens")
      .select("token")
      .eq("user_id", data.user.id);

    if (tokenError) {
      return jsonResponse(500, { error: "Failed to load device tokens" });
    }

    const payload = await req.json().catch(() => ({} as { type?: string }));
    const type = payload.type || "mood";
    const content = getTitleBody(type, settings?.language || "en");

    let sent = 0;

    if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && subs && subs.length > 0) {
      const results = await Promise.all(
        subs.map((sub) =>
          sendWebPush(
            { endpoint: sub.endpoint, keys: sub.keys },
            JSON.stringify(content),
            VAPID_SUBJECT,
            VAPID_PUBLIC_KEY,
            VAPID_PRIVATE_KEY
          )
        )
      );
      sent += results.filter(Boolean).length;
    }

    if (deviceTokens && deviceTokens.length > 0) {
      sent += await sendFcmNotifications(
        deviceTokens.map((item) => item.token),
        content
      );
    }

    if (sent === 0) {
      return jsonResponse(404, { error: "No subscriptions" });
    }

    return jsonResponse(200, { sent });
  } catch (_err) {
    return jsonResponse(500, { error: "Internal error" });
  }
});
