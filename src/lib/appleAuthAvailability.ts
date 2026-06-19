import { SUPABASE_PUBLIC_API_KEY, SUPABASE_URL } from "@/lib/env";
import { logger } from "@/lib/logger";

export type AppleAuthAvailabilityStatus = "available" | "disabled" | "unconfigured" | "unknown";

export interface AppleAuthAvailability {
  status: AppleAuthAvailabilityStatus;
  reason?: string;
  checkedAt: number;
}

interface CheckAppleAuthAvailabilityOptions {
  supabaseUrl?: string;
  anonKey?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  cacheTtlMs?: number;
  timeoutMs?: number;
}

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 1500;

let cachedAvailability:
  | {
      key: string;
      expiresAt: number;
      value: AppleAuthAvailability;
    }
  | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildAuthSettingsUrl(supabaseUrl: string): string | null {
  try {
    return new URL("/auth/v1/settings", supabaseUrl).toString();
  } catch {
    return null;
  }
}

function getCacheKey(settingsUrl: string, anonKey: string): string {
  return `${settingsUrl}:${anonKey.length}`;
}

function availability(
  status: AppleAuthAvailabilityStatus,
  checkedAt: number,
  reason?: string,
): AppleAuthAvailability {
  return { status, checkedAt, ...(reason ? { reason } : {}) };
}

export function clearAppleAuthAvailabilityCache(): void {
  cachedAvailability = null;
}

export function inspectAppleAuthSettings(settings: unknown, checkedAt = Date.now()): AppleAuthAvailability {
  if (!isRecord(settings) || !isRecord(settings.external)) {
    return availability("unknown", checkedAt, "settings_shape_unknown");
  }

  if (settings.external.apple === true) {
    return availability("available", checkedAt);
  }

  if (settings.external.apple === false) {
    return availability("disabled", checkedAt, "provider_disabled");
  }

  return availability("disabled", checkedAt, "provider_missing");
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  if (timeoutMs <= 0 || typeof AbortController === "undefined") {
    return fetchImpl(url, init);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function checkAppleAuthAvailability({
  supabaseUrl = SUPABASE_URL,
  anonKey = SUPABASE_PUBLIC_API_KEY,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  now = Date.now,
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: CheckAppleAuthAvailabilityOptions = {}): Promise<AppleAuthAvailability> {
  const checkedAt = now();

  if (!supabaseUrl || !anonKey) {
    return availability("unconfigured", checkedAt, "missing_public_supabase_config");
  }

  const settingsUrl = buildAuthSettingsUrl(supabaseUrl);
  if (!settingsUrl) {
    return availability("unconfigured", checkedAt, "invalid_supabase_url");
  }

  if (!fetchImpl) {
    return availability("unknown", checkedAt, "fetch_unavailable");
  }

  const cacheKey = getCacheKey(settingsUrl, anonKey);
  if (cachedAvailability?.key === cacheKey && cachedAvailability.expiresAt > checkedAt) {
    return cachedAvailability.value;
  }

  try {
    const response = await fetchWithTimeout(
      fetchImpl,
      settingsUrl,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        cache: "no-store",
      },
      timeoutMs,
    );

    if (!response.ok) {
      return availability("unknown", checkedAt, `settings_http_${response.status}`);
    }

    const result = inspectAppleAuthSettings(await response.json(), checkedAt);
    if (result.status === "available" || result.status === "disabled") {
      cachedAvailability = {
        key: cacheKey,
        expiresAt: checkedAt + cacheTtlMs,
        value: result,
      };
    }
    return result;
  } catch (err) {
    const reason = err instanceof DOMException && err.name === "AbortError"
      ? "settings_timeout"
      : "settings_unreachable";
    logger.warn("[Auth] Apple public provider settings unavailable", { reason });
    return availability("unknown", checkedAt, reason);
  }
}
