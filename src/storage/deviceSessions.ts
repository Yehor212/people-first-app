import { APP_VERSION } from "@/lib/appVersion";
import { platform } from "@/lib/platform";
import { supabase, getCurrentSessionUserId } from "@/lib/supabaseClient";
import { readPendingLocalBackupAccountClaim } from "@/storage/accountBoundaryRuntime";
import { getLocalDataOwnerId } from "@/storage/db";
import { getPersistentDeviceId } from "@/storage/eventSync";

export type DeviceSessionPlatform =
  | "web"
  | "pwa"
  | "desktop"
  | "android"
  | "ios"
  | "unknown";

export interface DeviceSession {
  id: string;
  user_id: string;
  device_id: string;
  label: string;
  platform: DeviceSessionPlatform;
  app_version: string | null;
  first_seen_at: string;
  last_seen_at: string;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export const DEVICE_SESSIONS_UPDATED_EVENT = "zenflow:device-sessions-updated";
export const DEVICE_SESSION_HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000;

type UpsertReason = "mount" | "auth" | "online" | "visible" | "resume" | "manual";

function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function detectBrowser(): string {
  if (typeof navigator === "undefined") return "Browser";
  const ua = navigator.userAgent;
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("OPR/") || ua.includes("Opera")) return "Opera";
  if (ua.includes("Firefox/")) return "Firefox";
  if (ua.includes("Chrome/") || ua.includes("CriOS/")) return "Chrome";
  if (ua.includes("Safari/")) return "Safari";
  return "Browser";
}

function detectOs(): string {
  if (platform === "android") return "Android";
  if (platform === "ios") return "iOS";
  if (typeof navigator === "undefined") return "Unknown";
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Win/i.test(ua)) return "Windows";
  if (/Mac/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown";
}

export function detectDeviceSessionPlatform(): DeviceSessionPlatform {
  if (platform === "android" || platform === "ios") return platform;
  if (isStandalonePwa()) return "pwa";
  if (typeof window !== "undefined" && window.innerWidth >= 1024) return "desktop";
  return "web";
}

export function detectDeviceSessionLabel(): string {
  // Use the user-agent only for coarse local classification; the raw user-agent is not stored.
  const prefix = isStandalonePwa() ? "PWA" : detectBrowser();
  const label = `${prefix} on ${detectOs()}`;
  return label.slice(0, 80);
}

function emitDeviceSessionsUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DEVICE_SESSIONS_UPDATED_EVENT));
}

async function resolveDeviceSessionOwner(
  expectedOwnerUserId?: string
): Promise<string | null> {
  if (readPendingLocalBackupAccountClaim().status !== "none") return null;

  const [activeOwnerUserId, localOwnerUserId] = await Promise.all([
    getCurrentSessionUserId(),
    getLocalDataOwnerId(),
  ]);
  const ownerUserId = expectedOwnerUserId ?? activeOwnerUserId;
  if (
    !ownerUserId ||
    activeOwnerUserId !== ownerUserId ||
    localOwnerUserId !== ownerUserId ||
    readPendingLocalBackupAccountClaim().status !== "none"
  ) {
    return null;
  }
  return ownerUserId;
}

export async function getCurrentDeviceSessionId(): Promise<string> {
  return getPersistentDeviceId();
}

export async function upsertCurrentDeviceSession(
  _reason: UpsertReason = "manual",
): Promise<DeviceSession | null> {
  if (!supabase) return null;
  const userId = await resolveDeviceSessionOwner();
  if (!userId) return null;

  const deviceId = await getPersistentDeviceId();
  if ((await resolveDeviceSessionOwner(userId)) !== userId) return null;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("device_sessions")
    .upsert(
      {
        user_id: userId,
        device_id: deviceId,
        label: detectDeviceSessionLabel(),
        platform: detectDeviceSessionPlatform(),
        app_version: APP_VERSION,
        last_seen_at: now,
        updated_at: now,
      },
      { onConflict: "user_id,device_id" },
    )
    .select(
      "id,user_id,device_id,label,platform,app_version,first_seen_at,last_seen_at,revoked_at,created_at,updated_at",
    )
    .single();

  if (error) {
    throw new Error(`[DeviceSessions] upsert failed: ${error.message}`);
  }

  emitDeviceSessionsUpdated();
  return data as DeviceSession;
}

export async function listDeviceSessions(limit = 10): Promise<DeviceSession[]> {
  if (!supabase) return [];
  const userId = await resolveDeviceSessionOwner();
  if (!userId) return [];

  const { data, error } = await supabase
    .from("device_sessions")
    .select(
      "id,user_id,device_id,label,platform,app_version,first_seen_at,last_seen_at,revoked_at,created_at,updated_at",
    )
    .eq("user_id", userId)
    .order("last_seen_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`[DeviceSessions] list failed: ${error.message}`);
  }

  return (data ?? []) as DeviceSession[];
}

export async function revokeDeviceSession(sessionId: string): Promise<DeviceSession | null> {
  if (!supabase) return null;
  const userId = await resolveDeviceSessionOwner();
  if (!userId) return null;

  const currentDeviceId = await getPersistentDeviceId();
  if ((await resolveDeviceSessionOwner(userId)) !== userId) return null;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("device_sessions")
    .update({ revoked_at: now, updated_at: now })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .neq("device_id", currentDeviceId)
    .select(
      "id,user_id,device_id,label,platform,app_version,first_seen_at,last_seen_at,revoked_at,created_at,updated_at",
    )
    .maybeSingle();

  if (error) {
    throw new Error(`[DeviceSessions] revoke failed: ${error.message}`);
  }

  emitDeviceSessionsUpdated();
  return data as DeviceSession | null;
}
