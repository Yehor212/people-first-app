import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.4";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { isAuthorizedRequest } from "../_shared/auth.ts";
import { createJsonResponse, createNoContentResponse } from "../_shared/http.ts";
import { withPushDeliveryPermit } from "../_shared/pushDeletionBarrier.ts";
import {
  classifyPushProviderAttempts,
  noPushTargets,
  providerUnavailable,
  shouldReleasePushReservation,
  type PushProviderAttempt,
} from "../_shared/pushProviderOutcome.ts";
import {
  buildRealmBoundAndroidMessage,
  isAndroidPushTarget,
  type PushDeviceTarget,
  type PushNotificationType,
} from "../_shared/pushRealmMessage.ts";

type ReminderType = Exclude<PushNotificationType, "test">;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FCM_PROJECT_ID = Deno.env.get("FCM_PROJECT_ID");
const FCM_SERVICE_ACCOUNT_B64 = Deno.env.get("FCM_SERVICE_ACCOUNT_B64");
const FCM_REQUEST_TIMEOUT_MS = 10000;
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
  type: ReminderType,
  accessToken: string,
) => {
  if (!FCM_PROJECT_ID) return providerUnavailable(0);
  const url = `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`;
  const attempts = await Promise.all<PushProviderAttempt>(
    targets.map((target) =>
      fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildRealmBoundAndroidMessage(target, type)),
        signal: AbortSignal.timeout(FCM_REQUEST_TIMEOUT_MS),
      })
        .then((res) => (res.ok ? "accepted" as const : "rejected" as const))
        .catch(() => "network-error" as const)
    )
  );

  const dispatch = classifyPushProviderAttempts(attempts);
  if (dispatch.state === "provider-unavailable") {
    console.warn("[ScheduledPush] FCM batch unavailable");
  }
  return dispatch;
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

    // P0 Fix: Use secure comparison to prevent timing attacks
    const isAuthorized = isAuthorizedRequest({
      authHeader,
      cronSecretHeader,
      serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
      cronSecret: CRON_SECRET,
    });

    if (!isAuthorized) {
      console.warn("[ScheduledPush] Unauthorized request");
      return createJsonResponse(origin, 401, { error: "Unauthorized" });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    let hadRetryableFailure = false;

    const { data: settings, error } = await supabase
      .from("user_reminder_settings")
      .select("*")
      .eq("enabled", true);

    if (error) {
      return createJsonResponse(origin, 500, {
        error: "Failed to load settings",
      });
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
        if (check.type === "habit" && (!item.habit_ids || item.habit_ids.length === 0)) continue;

        const delivery = await withPushDeliveryPermit(
          item.user_id,
          {
            rpc: (functionName, args) => supabase.rpc(functionName, args),
            randomUUID: () => crypto.randomUUID(),
          },
          async () => {
            const { data: deviceTokens, error: tokenError } = await supabase
              .from("push_device_tokens")
              .select("id, token, platform")
              .eq("user_id", item.user_id)
              .eq("platform", "android");
            if (tokenError) {
              console.warn("[ScheduledPush] Push targets unavailable");
              return providerUnavailable(0);
            }

            const targets = (deviceTokens || []).filter(isAndroidPushTarget);
            if (targets.length === 0) return noPushTargets();

            let accessToken: string | null | undefined;
            try {
              accessToken = await getFcmAccessToken();
            } catch {
              console.warn("[ScheduledPush] FCM credentials unavailable");
              return providerUnavailable(0);
            }
            if (!accessToken || !FCM_PROJECT_ID) {
              console.warn("[ScheduledPush] FCM credentials unavailable");
              return providerUnavailable(0);
            }

            const releasePushReservation = async (
              ownerId: string,
              type: ReminderType,
              dateKey: string,
              sentAt: string,
            ) => {
              try {
                const { data: releasedRows, error: releaseError } = await supabase
                  .from("push_logs")
                  .delete()
                  .eq("user_id", ownerId)
                  .eq("type", type)
                  .eq("date_key", dateKey)
                  .eq("sent_at", sentAt)
                  .select("sent_at");
                if (
                  releaseError ||
                  !releasedRows ||
                  releasedRows.length !== 1
                ) {
                  console.error("[ScheduledPush] Failed to release delivery reservation");
                  return false;
                }
                return true;
              } catch {
                console.error("[ScheduledPush] Failed to release delivery reservation");
                return false;
              }
            };

            // Dedup belongs inside the permit: a deletion block must not leave
            // behind a false "sent" row after refusing provider admission.
            const reservationSentAt = new Date().toISOString();
            const { data: logData, error: logError } = await supabase
              .from("push_logs")
              .upsert(
                {
                  user_id: item.user_id,
                  type: check.type,
                  date_key: dateKey,
                  sent_at: reservationSentAt,
                },
                { onConflict: "user_id,type,date_key", ignoreDuplicates: true }
              )
              .select("sent_at");

            if (logError) {
              console.error("[ScheduledPush] Failed to record delivery attempt");
              return providerUnavailable(0);
            }

            // ignoreDuplicates returns no row when this reminder was already handled.
            if (!logData || logData.length === 0) {
              return { state: "skipped" } as const;
            }

            const reservedSentAt = logData[0]?.sent_at;
            if (
              typeof reservedSentAt !== "string" ||
              !Number.isFinite(Date.parse(reservedSentAt))
            ) {
              console.error("[ScheduledPush] Invalid delivery reservation");
              await releasePushReservation(
                item.user_id,
                check.type,
                dateKey,
                reservationSentAt,
              );
              return providerUnavailable(0);
            }

            const dispatch = await sendFcmNotifications(
              targets,
              check.type,
              accessToken,
            );

            if (shouldReleasePushReservation(dispatch)) {
              const released = await releasePushReservation(
                item.user_id,
                check.type,
                dateKey,
                reservedSentAt,
              );
              if (!released) {
                return providerUnavailable(
                  dispatch.state === "no-targets" ? 0 : dispatch.attempted,
                );
              }
            }
            return dispatch;
          },
        );

        if (delivery.state === "blocked") continue;
        if (delivery.state === "unavailable") {
          hadRetryableFailure = true;
          continue;
        }
        if (!delivery.releaseConfirmed) {
          console.warn("[ScheduledPush] Permit release unconfirmed");
        }
        const dispatch = delivery.value;
        if (
          dispatch.state === "no-targets" ||
          dispatch.state === "provider-unavailable"
        ) {
          hadRetryableFailure = true;
        }
      }
    }

    if (hadRetryableFailure) {
      return createJsonResponse(origin, 503, {
        error: "Push temporarily unavailable",
      });
    }
    return createJsonResponse(origin, 200, { ok: true });
  } catch {
    console.error("[ScheduledPush] Internal failure");
    return createJsonResponse(origin, 500, {
      error: "Internal error",
    });
  }
});
