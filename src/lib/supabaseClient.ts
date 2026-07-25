import { createClient, SupabaseClient, User } from "@supabase/supabase-js";
import { isNative } from "@/lib/platform";
import { Database } from "@/types/supabase";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { SUPABASE_URL, SUPABASE_PUBLIC_API_KEY, IS_DEV } from "@/lib/env";
import {
  configureAuthTransitionClient,
  createOriginWideAuthLock,
} from "@/lib/authTransitionCoordinator";
import { createAttemptScopedAuthStorage } from "@/lib/pkceAttemptStorage";

/**
 * Zod schema for validating Supabase user object
 * Ensures the user object has the expected shape before using it
 */
const supabaseUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().optional().nullable(),
  app_metadata: z.record(z.unknown()).optional(),
  user_metadata: z.record(z.unknown()).optional(),
  created_at: z.string().optional(),
});

/**
 * Validate user object from Supabase auth response
 * Returns the validated user or null if validation fails
 */
export function validateSupabaseUser(user: unknown): User | null {
  if (!user) return null;

  const result = supabaseUserSchema.safeParse(user);
  if (!result.success) {
    // Log validation error in development
    if (IS_DEV) {
      logger.warn("[Supabase] User validation failed:", result.error.issues);
    }
    return null;
  }

  // Return the original user (with full Supabase type) since it passed validation
  return user as User;
}

/**
 * Validate Supabase environment variables
 * Returns validation status for use in UI notifications
 */
export interface SupabaseConfigStatus {
  isConfigured: boolean;
  missingUrl: boolean;
  missingKey: boolean;
}

export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  const missingUrl =
    !SUPABASE_URL || typeof SUPABASE_URL !== "string" || SUPABASE_URL.trim() === "";
  const missingKey =
    !SUPABASE_PUBLIC_API_KEY ||
    typeof SUPABASE_PUBLIC_API_KEY !== "string" ||
    SUPABASE_PUBLIC_API_KEY.trim() === "";

  return {
    isConfigured: !missingUrl && !missingKey,
    missingUrl,
    missingKey,
  };
}

// Emit event if Supabase is not configured so UI can show notification
const configStatus = getSupabaseConfigStatus();
if (!configStatus.isConfigured && typeof window !== "undefined") {
  // Log warning in development
  if (IS_DEV) {
    logger.warn(
      "[Supabase] Cloud sync disabled - environment variables not configured.",
      configStatus.missingUrl ? "Missing VITE_SUPABASE_URL." : "",
      configStatus.missingKey
        ? "Missing VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY."
        : ""
    );
  }
  // Emit event for UI to show notification (async to not block initialization)
  setTimeout(() => {
    window.dispatchEvent(
      new CustomEvent("zenflow:supabase-not-configured", {
        detail: configStatus,
      })
    );
  }, 0);
}

/**
 * Get storage adapter for auth persistence.
 * SECURITY (OWASP M9): Auth tokens stored in localStorage on web.
 * Risk: XSS could exfiltrate tokens. Mitigated by CSP (script-src 'self' — no inline/eval).
 * On native Capacitor: WebView sandbox provides OS-level protection.
 * Future hardening: migrate to @capacitor-community/secure-storage for Android Keystore / iOS Keychain.
 */
const getAuthStorage = () => {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
};

/**
 * Keep this derivation aligned with the pinned @supabase/supabase-js client.
 * Supplying the key explicitly lets the owner-bound transition coordinator
 * address the exact same persisted realm without inspecting private fields.
 */
export function getSupabaseAuthStorageKey(supabaseUrl: string): string {
  const hostname = new URL(supabaseUrl).hostname;
  const projectRef = hostname.split(".")[0];
  if (!projectRef) throw new Error("Unable to derive the Supabase auth storage key");
  return `sb-${projectRef}-auth-token`;
}

/**
 * Determine if we should detect session from URL
 * - Web: true (handles OAuth callback in URL)
 * - Native: false (handled via deep links separately)
 */
const shouldDetectSessionInUrl = (): boolean => {
  return !isNative;
};

function createConfiguredSupabaseClient(): SupabaseClient<Database> | null {
  if (!SUPABASE_URL || !SUPABASE_PUBLIC_API_KEY) return null;

  const storage = getAuthStorage();
  const storageKey = getSupabaseAuthStorageKey(SUPABASE_URL);
  const attemptScopedStorage = storage
    ? createAttemptScopedAuthStorage(storage, storageKey, {
        initialCallbackUrl:
          typeof window !== "undefined" ? window.location.href : undefined,
      })
    : null;
  const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLIC_API_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: shouldDetectSessionInUrl(),
      storage: attemptScopedStorage?.storage,
      storageKey,
      flowType: "pkce",
      // The custom adapter does not steal an in-flight owner transition when
      // the SDK timeout elapses; it waits for the origin-wide lock to finish.
      lock: createOriginWideAuthLock({ pkceControl: attemptScopedStorage }),
      lockAcquireTimeout: -1,
    },
  });

  if (attemptScopedStorage) {
    configureAuthTransitionClient(client.auth, {
      storage: attemptScopedStorage.storage,
      storageKey,
    });
  }
  return client;
}

// Export null if not configured - app works in local-only mode.
export const supabase: SupabaseClient<Database> | null = createConfiguredSupabaseClient();

// Helper to check if user is authenticated
// Validates user object shape before returning
export const getCurrentUser = async () => {
  if (!supabase) return null;
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Log errors for debugging
  if (error) {
    if (IS_DEV) {
      logger.warn("[Supabase] getUser error:", error.message);
    }
    return null;
  }

  // Validate user object shape
  return validateSupabaseUser(user);
};

/**
 * Lightweight local-session check for client-side sync scheduling.
 *
 * This only decides whether background sync should wake up. Actual cloud reads
 * and writes still call getCurrentUserId(), which verifies the user with
 * Supabase before touching RLS-protected data.
 */
export const getCurrentSessionUserId = async (): Promise<string | null> => {
  if (!supabase) return null;

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    if (IS_DEV) {
      logger.warn("[Supabase] getSession error:", error.message);
    }
    return null;
  }

  return validateSupabaseUser(session?.user)?.id ?? null;
};

function createSessionVerificationError(message: string, cause?: unknown): Error {
  const error = new Error(message);
  if (cause !== undefined) {
    (error as Error & { cause?: unknown }).cause = cause;
  }
  return error;
}

/**
 * Fail-closed session-owner read for account-bound device mutations.
 *
 * Unlike getCurrentSessionUserId(), this must not collapse an auth adapter
 * failure or malformed session into the signed-out realm. Callers use null
 * only after Supabase explicitly returns `session: null` (or when cloud auth
 * is not configured and the app is deliberately local-only).
 */
export const getVerifiedCurrentSessionUserId = async (): Promise<string | null> => {
  if (!supabase) return null;

  let response: unknown;
  try {
    response = await supabase.auth.getSession();
  } catch (error) {
    throw createSessionVerificationError("Unable to verify the active session", error);
  }

  if (!response || typeof response !== "object") {
    throw createSessionVerificationError("Unable to verify the active session");
  }

  const candidate = response as { data?: unknown; error?: unknown };
  if (candidate.error) {
    throw createSessionVerificationError(
      "Unable to verify the active session",
      candidate.error,
    );
  }
  if (!candidate.data || typeof candidate.data !== "object") {
    throw createSessionVerificationError("Unable to verify the active session");
  }

  const data = candidate.data as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(data, "session")) {
    throw createSessionVerificationError("Unable to verify the active session");
  }
  if (data.session === null) return null;
  if (!data.session || typeof data.session !== "object") {
    throw createSessionVerificationError("Unable to verify the active session");
  }

  const session = data.session as Record<string, unknown>;
  const user = validateSupabaseUser(session.user);
  if (!user) {
    throw createSessionVerificationError(
      "The active session has no valid account owner",
    );
  }
  return user.id;
};

// Helper to get user ID
export const getCurrentUserId = async (): Promise<string | null> => {
  const user = await getCurrentUser();
  return user?.id ?? null;
};
