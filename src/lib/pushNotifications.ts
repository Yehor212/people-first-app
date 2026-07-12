/**
 * Push Notifications Service - FCM for Android
 * Part of Phase 5.17
 *
 * Handles:
 * - FCM token registration
 * - Token sync to Supabase
 * - Push notification handling
 */

import {
  PushNotifications,
  Token,
  ActionPerformed,
  PushNotificationSchema,
} from "@capacitor/push-notifications";
import { isNative, isAndroid } from "@/lib/platform";
import { supabase, getCurrentUserId } from "./supabaseClient";
import { logger } from "./logger";
import { SK } from "./storageKeys";
import { storageGetRaw, storageRemove, storageSetRaw } from "./safeJson";
import { SUPABASE_URL } from "@/lib/env";

/**
 * Generate a cryptographically secure random hex string.
 * Uses crypto.getRandomValues() instead of Math.random() for security.
 */
function cryptoRandomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Per-install ID for token management. App id/build is not unique enough for cleanup.
let pushInstallId: string | null = null;
let pushRegistrationGeneration = 0;
let latestPushTokenSaveRequestId = 0;
let pushTokenSaveTail: Promise<void> = Promise.resolve();
let pushInitializationTail: Promise<void> = Promise.resolve();
let pushRevocationTail: Promise<void> = Promise.resolve();

function isCurrentPushGeneration(expectedGeneration?: number): boolean {
  return expectedGeneration === undefined || expectedGeneration === pushRegistrationGeneration;
}

/**
 * Get or generate a stable per-install push ID.
 */
async function getPushInstallId(): Promise<string> {
  if (pushInstallId) return pushInstallId;

  const stored = storageGetRaw(SK.PUSH_INSTALL_ID);
  if (stored) {
    pushInstallId = stored;
    return pushInstallId;
  }

  pushInstallId = `push-${Date.now()}-${cryptoRandomHex(16)}`;
  storageSetRaw(SK.PUSH_INSTALL_ID, pushInstallId);
  return pushInstallId;
}

/**
 * Check if push notifications are available
 */
export function isPushAvailable(): boolean {
  return isNative && isAndroid;
}

/**
 * Request push notification permissions
 */
export async function requestPushPermission(): Promise<boolean> {
  if (!isPushAvailable()) {
    logger.log("[Push] Not available on this platform");
    return false;
  }

  try {
    const permission = await PushNotifications.checkPermissions();

    if (permission.receive === "granted") {
      return true;
    }

    if (permission.receive === "prompt") {
      const result = await PushNotifications.requestPermissions();
      return result.receive === "granted";
    }

    return false;
  } catch (error) {
    logger.error("[Push] Permission check failed:", error);
    return false;
  }
}

/**
 * Register for push notifications and get FCM token
 */
export async function registerPushNotifications(
  expectedGeneration: number = pushRegistrationGeneration,
): Promise<string | null> {
  if (!isPushAvailable()) {
    return null;
  }

  try {
    // Check/request permission
    const hasPermission = await requestPushPermission();
    if (!hasPermission) {
      logger.warn("[Push] Permission not granted");
      return null;
    }

    if (!isCurrentPushGeneration(expectedGeneration)) return null;

    // Register with FCM
    await PushNotifications.register();
    if (!isCurrentPushGeneration(expectedGeneration)) {
      await PushNotifications.unregister();
      return null;
    }

    // Token is received via listener, return null here
    // The actual token will be saved via the 'registration' listener
    logger.log("[Push] Registration initiated");
    return null;
  } catch (error) {
    logger.error("[Push] Registration failed:", error);
    return null;
  }
}

/**
 * Save FCM token to Supabase
 */
async function savePushTokenNow(
  token: string,
  expectedGeneration: number | undefined,
  requestId: number,
): Promise<boolean> {
  if (requestId !== latestPushTokenSaveRequestId) return false;
  if (!isCurrentPushGeneration(expectedGeneration)) return false;
  if (!supabase) {
    logger.warn("[Push] Supabase not configured");
    return false;
  }
  const client = supabase;

  const userId = await getCurrentUserId();
  if (requestId !== latestPushTokenSaveRequestId) return false;
  if (!userId) {
    logger.warn("[Push] User not authenticated");
    return false;
  }

  try {
    const deviceIdValue = await getPushInstallId();
    if (requestId !== latestPushTokenSaveRequestId) return false;
    if (!isCurrentPushGeneration(expectedGeneration)) return false;

    const revokeCurrentInstall = async (): Promise<boolean> => {
      const { error } = await client.rpc("revoke_push_install", {
        p_device_id: deviceIdValue,
        p_token: token,
      });
      if (error) {
        logger.error("[Push] Failed to revoke the push installation:", error);
        return false;
      }
      return true;
    };

    const { error } = await client.rpc("claim_push_install", {
      p_token: token,
      p_device_id: deviceIdValue,
      p_platform: "android",
    });

    if (error) {
      logger.error("[Push] Failed to save token:", error);
      return false;
    }

    if (
      requestId !== latestPushTokenSaveRequestId ||
      !isCurrentPushGeneration(expectedGeneration)
    ) {
      await revokeCurrentInstall();
      return false;
    }

    logger.log("[Push] Token saved successfully");
    storageSetRaw(SK.PUSH_TOKEN, token);
    return true;
  } catch (error) {
    logger.error("[Push] Token save error:", error);
    return false;
  }
}

export function savePushToken(
  token: string,
  expectedGeneration?: number,
): Promise<boolean> {
  const requestId = ++latestPushTokenSaveRequestId;
  const result = pushTokenSaveTail.then(() =>
    savePushTokenNow(token, expectedGeneration, requestId),
  );
  pushTokenSaveTail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/**
 * Remove push token on logout
 */
export type PushRevocationResult =
  | {
      status: "revoked";
      remote: "deleted" | "not-registered";
      native: "unregistered" | "not-applicable";
    }
  | {
      status: "partial";
      remote: "deleted" | "not-registered" | "owner-changed" | "failed";
      native: "unregistered" | "not-applicable" | "failed";
    };

async function removePushTokenNow(
  expectedOwnerUserId?: string,
): Promise<PushRevocationResult> {
  await pushTokenSaveTail;
  const currentToken = storageGetRaw(SK.PUSH_TOKEN);
  const currentInstallId = pushInstallId ?? storageGetRaw(SK.PUSH_INSTALL_ID);
  let remote: PushRevocationResult["remote"] = "not-registered";

  if (currentToken || currentInstallId) {
    if (!supabase) {
      remote = "failed";
    } else {
      const userId = await getCurrentUserId();
      if (!userId) {
        remote = "failed";
      } else if (currentInstallId) {
        try {
          const { error } = await supabase.rpc("revoke_push_install", {
            p_device_id: currentInstallId,
            p_token: currentToken || null,
          });
          if (error) {
            remote = "failed";
            logger.error("[Push] Failed to revoke the remote installation:", error);
          } else {
            remote = "deleted";
            storageRemove(SK.PUSH_TOKEN);
            storageRemove(SK.PUSH_INSTALL_ID);
            pushInstallId = null;
          }
        } catch (error) {
          remote = "failed";
          logger.error("[Push] Remote installation revocation failed:", error);
        }
      } else if (expectedOwnerUserId && userId !== expectedOwnerUserId) {
        remote = "owner-changed";
      } else {
        try {
          let deleteQuery = supabase
            .from("push_device_tokens")
            .delete()
            .eq("user_id", userId);

          deleteQuery = currentInstallId
            ? deleteQuery.eq("device_id", currentInstallId)
            : deleteQuery.eq("token", currentToken);

          const { error } = await deleteQuery;
          if (error) {
            remote = "failed";
            logger.error("[Push] Failed to revoke the remote registration:", error);
          } else {
            remote = "deleted";
            storageRemove(SK.PUSH_TOKEN);
            storageRemove(SK.PUSH_INSTALL_ID);
            pushInstallId = null;
          }
        } catch (error) {
          remote = "failed";
          logger.error("[Push] Remote registration revocation failed:", error);
        }
      }
    }
  }

  let native: PushRevocationResult["native"] = "not-applicable";
  if (isPushAvailable()) {
    try {
      await PushNotifications.unregister();
      native = "unregistered";
    } catch (error) {
      native = "failed";
      logger.error("[Push] Native registration revocation failed:", error);
    }
  }

  if (remote !== "failed" && remote !== "owner-changed" && native !== "failed") {
    logger.log("[Push] Registration revoked");
    return { status: "revoked", remote, native };
  }

  return { status: "partial", remote, native };
}

function enqueuePushRevocation(expectedOwnerUserId?: string): Promise<PushRevocationResult> {
  // Invalidate an older registration immediately. Cleanup itself is serialized so
  // a later enable operation can wait until every already-started revoke settles.
  pushRegistrationGeneration += 1;
  latestPushTokenSaveRequestId += 1;
  const revocation = pushRevocationTail.then(() => removePushTokenNow(expectedOwnerUserId));
  pushRevocationTail = revocation.then(
    () => undefined,
    () => undefined,
  );
  return revocation;
}

export function removePushToken(): Promise<PushRevocationResult> {
  return enqueuePushRevocation();
}

/**
 * Revokes the previous account's native registration after Supabase has already
 * switched sessions. Remote deletion is attempted only while RLS owner identity
 * still matches, avoiding accidental deletion attempts against the new account.
 */
export function revokePushForAccountBoundary(
  expectedOwnerUserId: string,
): Promise<PushRevocationResult> {
  if (!expectedOwnerUserId.trim()) {
    return Promise.reject(new Error("Push account-boundary owner is required"));
  }
  return enqueuePushRevocation(expectedOwnerUserId);
}

/**
 * Handle push notification tap action
 */
function handlePushAction(notification: PushNotificationSchema): void {
  logger.log("[Push] Action:", notification);

  // Get notification data
  const data = notification.data as Record<string, string> | undefined;
  const type = data?.type;

  // Navigate based on notification type
  switch (type) {
    case "mood":
      // Could emit event or use navigation
      logger.log("[Push] Mood reminder tapped");
      break;
    case "habit":
      logger.log("[Push] Habit reminder tapped");
      break;
    case "focus":
      logger.log("[Push] Focus reminder tapped");
      break;
    default:
      logger.log("[Push] Generic notification tapped");
  }
}

/**
 * Setup push notification listeners
 * Call this once on app start
 */
export function setupPushListeners(
  expectedGeneration: number = pushRegistrationGeneration,
): void {
  if (!isPushAvailable()) return;

  // Token received
  // Don't log token values, even partially
  void PushNotifications.addListener("registration", async (token: Token) => {
    logger.log("[Push] Token received (length:", token.value.length, ")");
    await savePushToken(token.value, expectedGeneration);
  });

  // Registration error
  void PushNotifications.addListener("registrationError", (error) => {
    logger.error("[Push] Registration error:", error);
  });

  // Notification received while app is in foreground
  void PushNotifications.addListener("pushNotificationReceived", (notification) => {
    logger.log("[Push] Foreground notification:", notification.title);
    // In foreground, we might want to show a toast instead
    // The system won't show a heads-up notification when app is open
  });

  // Notification tapped
  void PushNotifications.addListener(
    "pushNotificationActionPerformed",
    (action: ActionPerformed) => {
      logger.log("[Push] Notification tapped");
      handlePushAction(action.notification);
    }
  );

  logger.log("[Push] Listeners setup complete");
}

/**
 * Initialize push notifications
 * Call on app start for authenticated users
 */
export function initializePushNotifications(): Promise<void> {
  if (!isPushAvailable()) return Promise.resolve();

  const expectedGeneration = pushRegistrationGeneration + 1;
  pushRegistrationGeneration = expectedGeneration;
  const pendingRevocations = pushRevocationTail;
  const initialization = pushInitializationTail.then(async () => {
    await pendingRevocations;
    if (!isCurrentPushGeneration(expectedGeneration)) return;

    const userId = await getCurrentUserId();
    if (!isCurrentPushGeneration(expectedGeneration)) return;
    if (!userId) {
      logger.log("[Push] Skipping - user not authenticated");
      return;
    }

    setupPushListeners(expectedGeneration);
    await registerPushNotifications(expectedGeneration);
  });
  pushInitializationTail = initialization.then(
    () => undefined,
    () => undefined,
  );
  return initialization;
}

/**
 * Send a test push via Supabase Edge Function
 */
export async function sendTestPush(): Promise<boolean> {
  if (!supabase) return false;

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return false;

    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-push-now`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "test",
        title: "🧪 Test Push",
        body: "Push notifications work! 🎉",
      }),
    });

    if (!response.ok) {
      logger.error("[Push] Test failed:", await response.text());
      return false;
    }

    logger.log("[Push] Test push sent");
    return true;
  } catch (error) {
    logger.error("[Push] Test push error:", error);
    return false;
  }
}

export default {
  isPushAvailable,
  requestPushPermission,
  registerPushNotifications,
  savePushToken,
  removePushToken,
  setupPushListeners,
  initializePushNotifications,
  sendTestPush,
};
