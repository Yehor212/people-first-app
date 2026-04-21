/**
 * Native Google Sign-In for Android via @capgo/capacitor-social-login
 *
 * Uses Google's native sign-in dialog (no browser redirect).
 * Gets an ID token from Google, then passes it to Supabase via signInWithIdToken().
 *
 * Flow:
 * 1. Generate cryptographic nonce pair (raw + SHA-256 digest)
 * 2. Show native Google account picker
 * 3. Get ID token from Google
 * 4. Validate token audience and nonce
 * 5. Pass token to Supabase signInWithIdToken()
 */

import { SocialLogin } from "@capgo/capacitor-social-login";
import { supabase } from "./supabaseClient";
import { logger } from "./logger";
import { GOOGLE_WEB_CLIENT_ID } from "./env";

/**
 * Generate a URL-safe random nonce (64 hex characters)
 */
function getUrlSafeNonce(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

/**
 * SHA-256 hash of a string, returned as hex
 */
async function sha256Hash(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate nonce pair: rawNonce (for Supabase) and nonceDigest (for Google Sign-In)
 */
async function getNonce(): Promise<{ rawNonce: string; nonceDigest: string }> {
  const rawNonce = getUrlSafeNonce();
  const nonceDigest = await sha256Hash(rawNonce);
  return { rawNonce, nonceDigest };
}

/**
 * Decode JWT payload without verification (for client-side validation only)
 */
function decodeJWT(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    logger.error("[NativeAuth] Error decoding JWT:", error);
    return null;
  }
}

let initialized = false;

/**
 * Initialize the SocialLogin plugin (call once)
 */
async function ensureInitialized(): Promise<void> {
  if (initialized) return;

  await SocialLogin.initialize({
    google: {
      webClientId: GOOGLE_WEB_CLIENT_ID,
      mode: "online",
    },
  });
  initialized = true;
  logger.log("[NativeAuth] SocialLogin initialized");
}

/**
 * Authenticate with Google natively and sign in to Supabase.
 *
 * @param retry - Internal: whether this is a retry attempt (for cached token invalidation)
 * @returns Object with success status, optional user data, or error message
 */
export async function authenticateWithGoogleNative(retry = false): Promise<{
  success: boolean;
  error?: string;
  user?: { name: string; email: string };
}> {
  if (!supabase) {
    return { success: false, error: "Supabase not configured" };
  }

  try {
    const { rawNonce, nonceDigest } = await getNonce();

    await ensureInitialized();

    logger.log("[NativeAuth] Starting native Google Sign-In...");

    const response = await SocialLogin.login({
      provider: "google",
      options: {
        scopes: ["email", "profile"],
        nonce: nonceDigest,
      },
    });

    if (response.result.responseType !== "online") {
      return { success: false, error: "Offline mode not supported" };
    }

    const googleResponse = response.result as {
      idToken?: string;
      responseType: string;
    };

    if (!googleResponse.idToken) {
      return { success: false, error: "Failed to get Google ID token" };
    }

    // Validate token audience matches our Web Client ID
    const decoded = decodeJWT(googleResponse.idToken);
    if (decoded) {
      const aud = decoded.aud as string;
      if (aud && aud !== GOOGLE_WEB_CLIENT_ID) {
        logger.warn("[NativeAuth] Token audience mismatch:", aud);

        // On first attempt, logout and retry (cached token from different client)
        if (!retry) {
          logger.log("[NativeAuth] Retrying after logout...");
          try {
            await SocialLogin.logout({ provider: "google" });
          } catch {
            // Ignore logout errors
          }
          initialized = false;
          return authenticateWithGoogleNative(true);
        }
        return { success: false, error: "Token audience mismatch" };
      }

      // Validate nonce if present
      const tokenNonce = decoded.nonce as string;
      if (tokenNonce && tokenNonce !== nonceDigest) {
        logger.warn("[NativeAuth] Nonce mismatch, retrying...");

        if (!retry) {
          try {
            await SocialLogin.logout({ provider: "google" });
          } catch {
            // Ignore logout errors
          }
          initialized = false;
          return authenticateWithGoogleNative(true);
        }
        return { success: false, error: "Nonce validation failed" };
      }
    }

    // Sign in to Supabase with the Google ID token
    const signInOptions: { provider: "google"; token: string; nonce?: string } =
      {
        provider: "google",
        token: googleResponse.idToken,
      };

    // Only pass nonce if Google included it in the token
    if (decoded?.nonce) {
      signInOptions.nonce = rawNonce;
    }

    const { data, error } =
      await supabase.auth.signInWithIdToken(signInOptions);

    if (error) {
      logger.error(
        "[NativeAuth] Supabase signInWithIdToken error:",
        error.message,
      );
      return { success: false, error: error.message };
    }

    if (!data.user) {
      return {
        success: false,
        error: "Sign-in succeeded but no user returned",
      };
    }

    const metadata = data.user.user_metadata;
    const name = metadata?.full_name || metadata?.name || "Friend";
    const email = data.user.email || "";

    logger.log(
      "[NativeAuth] Successfully signed in, user:",
      `user:${data.user.id.slice(0, 8)}`,
    );

    return {
      success: true,
      user: { name, email },
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Google authentication failed";

    // User cancelled the sign-in dialog
    if (
      message.includes("cancel") ||
      message.includes("Cancel") ||
      message.includes("CANCELED")
    ) {
      logger.log("[NativeAuth] User cancelled sign-in");
      return { success: false, error: "cancelled" };
    }

    logger.error("[NativeAuth] Google authentication error:", String(message));
    return { success: false, error: message };
  }
}
