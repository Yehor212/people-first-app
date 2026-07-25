import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.4";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { extractBearerToken } from "../_shared/auth.ts";
import { createJsonResponse, createNoContentResponse, parseJsonBody } from "../_shared/http.ts";
import { withPushDeliveryPermit } from "../_shared/pushDeletionBarrier.ts";
import {
  classifyPushProviderAttempts,
  noPushTargets,
  providerUnavailable,
  type PushProviderAttempt,
} from "../_shared/pushProviderOutcome.ts";
import {
  buildRealmBoundAndroidMessage,
  isAndroidPushTarget,
  isPushNotificationType,
  type PushDeviceTarget,
  type PushNotificationType,
} from "../_shared/pushRealmMessage.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FCM_PROJECT_ID = Deno.env.get("FCM_PROJECT_ID");
const FCM_SERVICE_ACCOUNT_B64 = Deno.env.get("FCM_SERVICE_ACCOUNT_B64");
const FCM_REQUEST_TIMEOUT_MS = 10000;
// Rate limiting is best-effort in serverless mode.
const RATE_LIMIT = 10; // Max 10 requests per user
const RATE_WINDOW = 60000; // Per 60 seconds
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Clean expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (value.resetAt < now) {
      rateLimitMap.delete(key);
    }
  }
}, 60000);

function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || entry.resetAt < now) {
    // New window
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW });
    return { allowed: true };
  }

  if (entry.count >= RATE_LIMIT) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count++;
  return { allowed: true };
}

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
      exp: getNumericDate(60 * 60),
    },
    key
  );

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
    signal: AbortSignal.timeout(FCM_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.access_token as string | undefined;
};

const sendFcmNotifications = async (
  targets: PushDeviceTarget[],
  type: PushNotificationType,
) => {
  let accessToken: string | null | undefined;
  try {
    accessToken = await getFcmAccessToken();
  } catch {
    console.warn("[SendPushNow] FCM credentials unavailable");
    return providerUnavailable(0);
  }
  if (!accessToken || !FCM_PROJECT_ID) {
    console.warn("[SendPushNow] FCM credentials unavailable");
    return providerUnavailable(0);
  }

  const url = `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`;
  const attempts = await Promise.all<PushProviderAttempt>(
    targets.map((target) =>
      fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          buildRealmBoundAndroidMessage(target, type),
        ),
        signal: AbortSignal.timeout(FCM_REQUEST_TIMEOUT_MS),
      })
        .then((res) => (res.ok ? "accepted" as const : "rejected" as const))
        .catch(() => "network-error" as const)
    )
  );

  const dispatch = classifyPushProviderAttempts(attempts);
  if (dispatch.state === "provider-unavailable") {
    console.warn("[SendPushNow] FCM batch unavailable");
  }
  return dispatch;
};

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return createNoContentResponse(origin);
  }
  if (req.method !== "POST") {
    return createJsonResponse(origin, 405, { error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const token = extractBearerToken(authHeader);
    if (!token) return createJsonResponse(origin, 401, { error: "Unauthorized" });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return createJsonResponse(origin, 401, { error: "Unauthorized" });
    }

    const ownerId = data.user.id;

    // P0 Fix: Check rate limit
    const rateLimitResult = checkRateLimit(ownerId);
    if (!rateLimitResult.allowed) {
      return createJsonResponse(origin, 429, {
        error: "Rate limit exceeded",
        retryAfter: rateLimitResult.retryAfter,
      });
    }

    const [payload, bodyErr] = await parseJsonBody<{ type?: unknown }>(req, origin);
    if (bodyErr) return bodyErr;
    const type = isPushNotificationType(payload.type) ? payload.type : "mood";

    const delivery = await withPushDeliveryPermit(
      ownerId,
      {
        rpc: (functionName, args) => supabase.rpc(functionName, args),
        randomUUID: () => crypto.randomUUID(),
      },
      async () => {
        const { data: deviceTokens, error: tokenError } = await supabase
          .from("push_device_tokens")
          .select("id, token, platform")
          .eq("user_id", ownerId)
          .eq("platform", "android");
        if (tokenError) {
          console.warn("[SendPushNow] Push targets unavailable");
          return providerUnavailable(0);
        }

        const targets = (deviceTokens || []).filter(isAndroidPushTarget);
        if (targets.length === 0) return noPushTargets();
        return await sendFcmNotifications(targets, type);
      },
    );

    if (delivery.state === "blocked") {
      return createJsonResponse(origin, 410, { error: "Account unavailable" });
    }
    if (delivery.state === "unavailable") {
      return createJsonResponse(origin, 503, { error: "Push temporarily unavailable" });
    }
    if (!delivery.releaseConfirmed) {
      console.warn("[SendPushNow] Permit release unconfirmed");
    }
    const dispatch = delivery.value;
    if (dispatch.state === "no-targets") {
      return createJsonResponse(origin, 404, { error: "No subscriptions" });
    }
    if (dispatch.state === "provider-unavailable") {
      return createJsonResponse(origin, 503, { error: "Push temporarily unavailable" });
    }

    return createJsonResponse(origin, 200, { accepted: dispatch.accepted });
  } catch {
    console.error("[SendPushNow] Internal failure");
    return createJsonResponse(origin, 500, { error: "Internal error" });
  }
});
