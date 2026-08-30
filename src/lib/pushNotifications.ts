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
import type { PluginListenerHandle } from "@capacitor/core";
import { isNative, isAndroid } from "@/lib/platform";
import { supabase, getCurrentUserId } from "./supabaseClient";
import { logger } from "./logger";
import { SK } from "./storageKeys";
import { storageGetRaw, storageReadRaw, storageRemove, storageSetRaw } from "./safeJson";
import { SUPABASE_URL } from "@/lib/env";
import { getLocalDataOwnerId } from "@/storage/db";
import { readPendingLocalBackupAccountClaim } from "@/storage/accountBoundaryRuntime";
import { getCurrentChannelId } from "./notificationSounds";
import {
  activateNativePushRealm,
  isCanonicalPushRealmId,
  isPushRealmChannelId,
  isPushRealmLanguage,
  suspendNativePushRealm,
  type PushRealmLanguage,
} from "./nativePushRealm";

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
let pushListenerHandles: PluginListenerHandle[] = [];
let stalePushListenerHandles: PluginListenerHandle[] = [];
let activePushListenerEpoch = 0;

interface OwnerBoundPushRevocationRpcClient {
  rpc(
    functionName: "revoke_push_install",
    args: {
      p_device_id: string;
      p_expected_owner_user_id: string;
      p_token: string | null;
    },
  ): PromiseLike<{ data: unknown; error: unknown }>;
}

interface OwnerBoundPushClaimRpcClient {
  rpc(
    functionName: "claim_push_install",
    args: {
      p_token: string;
      p_device_id: string;
      p_expected_owner_user_id: string;
      p_platform: "android" | "ios";
    },
  ): PromiseLike<{ data: unknown; error: unknown }>;
}

function claimOwnedPushInstall(
  client: unknown,
  args: {
    p_token: string;
    p_device_id: string;
    p_expected_owner_user_id: string;
    p_platform: "android" | "ios";
  },
): PromiseLike<{ data: unknown; error: unknown }> {
  return (client as OwnerBoundPushClaimRpcClient).rpc("claim_push_install", args);
}

function revokeOwnedPushInstall(
  client: unknown,
  args: {
    p_device_id: string;
    p_expected_owner_user_id: string;
    p_token: string | null;
  },
): PromiseLike<{ data: unknown; error: unknown }> {
  // This narrow forward contract is kept beside the call until canonical
  // Supabase type generation includes the owner-bound migration. Runtime data
  // is validated below; the generated database file is never hand-edited.
  return (client as OwnerBoundPushRevocationRpcClient).rpc(
    "revoke_push_install",
    args,
  );
}

function isValidRevocationCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function getCurrentPushRealmPresentation(): {
  language: PushRealmLanguage;
  channelId:
    | "zenflow_default_v4"
    | "zenflow_furin_v5"
    | "zenflow_gentle_v4"
    | "zenflow_silent_v4";
} {
  const storedLanguage = storageGetRaw(SK.LANGUAGE, "en");
  const language = isPushRealmLanguage(storedLanguage) ? storedLanguage : "en";
  const selectedChannelId = getCurrentChannelId();
  const channelId = isPushRealmChannelId(selectedChannelId)
    ? selectedChannelId
    : "zenflow_default_v4";
  return { language, channelId };
}

function removePersistedPushTokenIfExact(token: string): void {
  const stored = storageReadRaw(SK.PUSH_TOKEN);
  if (stored.ok && stored.value === token) {
    storageRemove(SK.PUSH_TOKEN);
  }
}

async function suspendAndRevokeOwnedPushInstall(
  client: unknown,
  args: {
    p_device_id: string;
    p_expected_owner_user_id: string;
    p_token: string;
  },
): Promise<boolean> {
  try {
    await suspendNativePushRealm();
  } catch (error) {
    logger.error("[Push] Native push realm suspension failed:", error);
    return false;
  }

  try {
    const { data, error } = await revokeOwnedPushInstall(client, args);
    if (error) {
      logger.error("[Push] Failed to revoke the push installation:", error);
      return false;
    }
    if (data !== 1) {
      logger.error(
        isValidRevocationCount(data)
          ? "[Push] Push rollback did not remove the claimed installation"
          : "[Push] Push revocation returned an invalid result",
      );
      return false;
    }
    return true;
  } catch (error) {
    logger.error("[Push] Push installation rollback failed:", error);
    return false;
  }
}

function isCurrentPushGeneration(expectedGeneration?: number): boolean {
  return expectedGeneration === undefined || expectedGeneration === pushRegistrationGeneration;
}

async function resolveAdmittedPushOwner(
  expectedUserId?: string,
): Promise<string | null> {
  if (readPendingLocalBackupAccountClaim().status !== "none") return null;

  try {
    const [activeUserId, localOwnerUserId] = await Promise.all([
      getCurrentUserId(),
      getLocalDataOwnerId(),
    ]);
    if (
      !activeUserId ||
      localOwnerUserId !== activeUserId ||
      (expectedUserId !== undefined && activeUserId !== expectedUserId) ||
      readPendingLocalBackupAccountClaim().status !== "none"
    ) {
      return null;
    }
    return activeUserId;
  } catch (error) {
    logger.warn("[Push] Could not verify the active local owner:", error);
    return null;
  }
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
  expectedOwnerUserId?: string,
): Promise<string | null> {
  if (!isPushAvailable()) {
    return null;
  }

  try {
    const admittedOwnerUserId =
      expectedOwnerUserId ?? (await resolveAdmittedPushOwner());
    if (!admittedOwnerUserId) return null;

    // Check/request permission
    const hasPermission = await requestPushPermission();
    if (!hasPermission) {
      logger.warn("[Push] Permission not granted");
      return null;
    }

    if (!isCurrentPushGeneration(expectedGeneration)) return null;
    if ((await resolveAdmittedPushOwner(admittedOwnerUserId)) !== admittedOwnerUserId) {
      return null;
    }

    // Register with FCM
    await PushNotifications.register();
    if (
      !isCurrentPushGeneration(expectedGeneration) ||
      (await resolveAdmittedPushOwner(admittedOwnerUserId)) !== admittedOwnerUserId
    ) {
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

  const userId = await resolveAdmittedPushOwner();
  if (requestId !== latestPushTokenSaveRequestId) return false;
  if (!userId) {
    logger.warn("[Push] User not authenticated");
    return false;
  }

  try {
    const deviceIdValue = await getPushInstallId();
    if (requestId !== latestPushTokenSaveRequestId) return false;
    if (!isCurrentPushGeneration(expectedGeneration)) return false;
    if ((await resolveAdmittedPushOwner(userId)) !== userId) return false;

    const rollbackCurrentInstall = async (): Promise<boolean> => {
      const remoteRevocationConfirmed = await suspendAndRevokeOwnedPushInstall(client, {
        p_device_id: deviceIdValue,
        p_expected_owner_user_id: userId,
        p_token: token,
      });

      if (remoteRevocationConfirmed) {
        removePersistedPushTokenIfExact(token);
      } else if (!storageSetRaw(SK.PUSH_TOKEN, token)) {
        logger.error("[Push] Push rollback is unconfirmed and its token could not be retained");
      }
      return remoteRevocationConfirmed;
    };

    const { data: claimedInstallationId, error } = await claimOwnedPushInstall(client, {
      p_token: token,
      p_device_id: deviceIdValue,
      p_platform: "android",
      p_expected_owner_user_id: userId,
    });

    if (error) {
      logger.error("[Push] Failed to save token:", error);
      return false;
    }

    if (!isCanonicalPushRealmId(claimedInstallationId)) {
      logger.error("[Push] Push claim returned an invalid installation identifier");
      await rollbackCurrentInstall();
      return false;
    }

    if (
      requestId !== latestPushTokenSaveRequestId ||
      !isCurrentPushGeneration(expectedGeneration) ||
      (await resolveAdmittedPushOwner(userId)) !== userId
    ) {
      await rollbackCurrentInstall();
      return false;
    }

    if (!storageSetRaw(SK.PUSH_TOKEN, token)) {
      logger.error("[Push] Token was claimed remotely but could not be persisted locally");
      await rollbackCurrentInstall();
      return false;
    }

    if (
      requestId !== latestPushTokenSaveRequestId ||
      !isCurrentPushGeneration(expectedGeneration) ||
      (await resolveAdmittedPushOwner(userId)) !== userId
    ) {
      await rollbackCurrentInstall();
      return false;
    }

    try {
      await activateNativePushRealm({
        installationId: claimedInstallationId,
        ...getCurrentPushRealmPresentation(),
      });
    } catch (error) {
      logger.error("[Push] Native push realm activation failed:", error);
      await rollbackCurrentInstall();
      return false;
    }

    if (
      requestId !== latestPushTokenSaveRequestId ||
      !isCurrentPushGeneration(expectedGeneration) ||
      (await resolveAdmittedPushOwner(userId)) !== userId
    ) {
      await rollbackCurrentInstall();
      return false;
    }

    logger.log("[Push] Token saved successfully");
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
      native: "unregistered" | "not-applicable" | "owner-changed";
    }
  | {
      status: "partial";
      remote: "deleted" | "not-registered" | "owner-changed" | "failed";
      native: "unregistered" | "not-applicable" | "owner-changed" | "failed";
    };

async function removePushTokenNow(
  expectedOwnerUserId?: string,
): Promise<PushRevocationResult> {
  await pushTokenSaveTail;
  try {
    await suspendNativePushRealm();
  } catch (error) {
    logger.error("[Push] Native push realm suspension failed:", error);
    return {
      status: "partial",
      remote: "failed",
      native: "failed",
    };
  }

  const tokenRead = storageReadRaw(SK.PUSH_TOKEN);
  const installRead = pushInstallId
    ? ({ ok: true, value: pushInstallId } as const)
    : storageReadRaw(SK.PUSH_INSTALL_ID);
  const currentToken = tokenRead.ok ? tokenRead.value ?? "" : "";
  const currentInstallId = installRead.ok ? installRead.value ?? "" : "";
  let remote: PushRevocationResult["remote"] = "failed";
  let revocationOwnerUserId: string | null = null;
  let remoteRevocationConfirmed = false;

  if (currentToken || currentInstallId) {
    if (!supabase) {
      remote = "failed";
    } else {
      const userId = await getCurrentUserId();
      if (!userId) {
        remote = "failed";
      } else {
        revocationOwnerUserId = expectedOwnerUserId ?? userId;
      }

      if (revocationOwnerUserId && currentInstallId) {
        try {
          const { data, error } = await revokeOwnedPushInstall(supabase, {
            p_device_id: currentInstallId,
            p_expected_owner_user_id: revocationOwnerUserId,
            p_token: currentToken || null,
          });
          if (error) {
            remote = "failed";
            logger.error("[Push] Failed to revoke the remote installation:", error);
          } else if (!isValidRevocationCount(data)) {
            remote = "failed";
            logger.error("[Push] Push revocation returned an invalid result");
          } else {
            remote = data > 0 ? "deleted" : "not-registered";
            remoteRevocationConfirmed = true;
          }
        } catch (error) {
          remote = "failed";
          logger.error("[Push] Remote installation revocation failed:", error);
        }
      } else if (revocationOwnerUserId && expectedOwnerUserId && userId !== expectedOwnerUserId) {
        remote = "owner-changed";
      } else if (revocationOwnerUserId) {
        remote = "failed";
        logger.warn("[Push] The install identifier is absent; remote revocation cannot be proven");
      }
    }
  } else {
    revocationOwnerUserId = expectedOwnerUserId ?? (await getCurrentUserId());
    logger.warn(
      tokenRead.ok && installRead.ok
        ? "[Push] Local identifiers are absent; remote revocation cannot be proven"
        : "[Push] Local identifiers are unavailable; remote revocation cannot be proven"
    );
  }

  let native: PushRevocationResult["native"] = "not-applicable";
  let activeOwnerAfterRemote: string | null = null;
  if (revocationOwnerUserId) {
    activeOwnerAfterRemote = await getCurrentUserId();
  }
  const ownerStillMatches =
    revocationOwnerUserId !== null &&
    activeOwnerAfterRemote === revocationOwnerUserId;

  const shouldUnregisterNative =
    isPushAvailable() &&
    (ownerStillMatches || (expectedOwnerUserId !== undefined && !remoteRevocationConfirmed));

  if (shouldUnregisterNative) {
    try {
      await PushNotifications.unregister();
      native = "unregistered";
    } catch (error) {
      native = "failed";
      logger.error("[Push] Native registration revocation failed:", error);
    }
  } else if (revocationOwnerUserId && !ownerStillMatches) {
    native = "owner-changed";
  }

  if (remoteRevocationConfirmed && ownerStillMatches) {
    storageRemove(SK.PUSH_TOKEN);
    storageRemove(SK.PUSH_INSTALL_ID);
    pushInstallId = null;
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
 * Revokes only the previous account's server row across an account switch. The
 * RPC carries that expected owner, and native/local state is preserved whenever
 * the active session has already moved to another account.
 */
export function revokePushForAccountBoundary(
  expectedOwnerUserId: string,
): Promise<PushRevocationResult> {
  if (!expectedOwnerUserId.trim()) {
    return Promise.reject(new Error("Push account-boundary owner is required"));
  }
  return enqueuePushRevocation(expectedOwnerUserId);
}

type PushNotificationKind = "mood" | "habit" | "focus" | "test";

function readPushNotificationKind(
  notification: PushNotificationSchema,
): PushNotificationKind | null {
  const data = notification.data as Record<string, unknown> | undefined;
  const value = data?.zenflow_notification_type;
  return value === "mood" || value === "habit" || value === "focus" || value === "test"
    ? value
    : null;
}

/**
 * Handle push notification tap action
 */
function handlePushAction(notification: PushNotificationSchema): void {
  const type = readPushNotificationKind(notification);

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
    case "test":
      logger.log("[Push] Test notification tapped");
      break;
    default:
      logger.log("[Push] Generic notification tapped");
  }
}

async function removePushListenerHandles(
  handles: readonly PluginListenerHandle[],
): Promise<PluginListenerHandle[]> {
  const failedHandles: PluginListenerHandle[] = [];
  for (const handle of handles) {
    try {
      await handle.remove();
    } catch (error) {
      failedHandles.push(handle);
      logger.error("[Push] Listener removal failed:", error);
    }
  }
  return failedHandles;
}

/**
 * Setup push notification listeners
 * Call this once on app start
 */
export async function setupPushListeners(
  expectedGeneration: number = pushRegistrationGeneration,
): Promise<void> {
  if (!isPushAvailable()) return;

  const previousHandles = pushListenerHandles;
  const previousStaleHandles = stalePushListenerHandles;
  const nextListenerEpoch = activePushListenerEpoch + 1;
  const nextHandles: PluginListenerHandle[] = [];
  try {
    nextHandles.push(
      await PushNotifications.addListener("registration", async (token: Token) => {
        if (activePushListenerEpoch !== nextListenerEpoch) return;
        logger.log("[Push] Token received (length:", token.value.length, ")");
        await savePushToken(token.value, expectedGeneration);
      }),
    );
    nextHandles.push(
      await PushNotifications.addListener("registrationError", (error) => {
        if (activePushListenerEpoch !== nextListenerEpoch) return;
        logger.error("[Push] Registration error:", error);
      }),
    );
    nextHandles.push(
      await PushNotifications.addListener("pushNotificationReceived", (notification) => {
        if (activePushListenerEpoch !== nextListenerEpoch) return;
        const kind = readPushNotificationKind(notification);
        logger.log(kind ? `[Push] Foreground ${kind} notification` : "[Push] Foreground notification");
      }),
    );
    nextHandles.push(
      await PushNotifications.addListener(
        "pushNotificationActionPerformed",
        (action: ActionPerformed) => {
          if (activePushListenerEpoch !== nextListenerEpoch) return;
          handlePushAction(action.notification);
        },
      ),
    );
  } catch (error) {
    stalePushListenerHandles = [
      ...previousStaleHandles,
      ...(await removePushListenerHandles(nextHandles)),
    ];
    throw error;
  }

  pushListenerHandles = nextHandles;
  activePushListenerEpoch = nextListenerEpoch;
  stalePushListenerHandles = await removePushListenerHandles([
    ...previousStaleHandles,
    ...previousHandles,
  ]);
  if (stalePushListenerHandles.length > 0) {
    logger.warn("[Push] Inactive listener cleanup will be retried");
  }

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

    const userId = await resolveAdmittedPushOwner();
    if (!isCurrentPushGeneration(expectedGeneration)) return;
    if (!userId) {
      logger.log("[Push] Skipping - user not authenticated");
      return;
    }

    await setupPushListeners(expectedGeneration);
    await registerPushNotifications(expectedGeneration, userId);
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
      body: JSON.stringify({ type: "test" }),
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
