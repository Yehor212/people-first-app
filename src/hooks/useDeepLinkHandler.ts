import { useEffect, useRef } from "react";
import {
  useAppStore,
  useUIStore,
  useUserDataStore,
  getModalToggle,
} from "@/stores";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { logger } from "@/lib/logger";
import { App } from "@capacitor/app";
import {
  handleAuthCallback,
  notifyAuthComplete,
  setPendingAuthUrl,
} from "@/lib/authRedirect";
import { isNative } from "@/lib/platform";
import { supabase } from "@/lib/supabaseClient";
import { decodeInviteData } from "@/lib/friendChallenge";
import { endAuthFlow } from "@/lib/authGuard";

const setShowChallengeModal = getModalToggle("showChallengeModal");

/**
 * Handles all deep link processing:
 * - Auth deep links (login-callback URLs)
 * - Challenge deep links (zenflow://challenge or https://zenflow.app/challenge)
 * - Launch URL processing (cold start)
 * - Runtime appUrlOpen events
 */
export function useDeepLinkHandler(): void {
  const { isFeatureVisible } = useFeatureFlags();
  const setAuthBypassFlag = useAppStore((s) => s.setAuthBypassFlag);
  const setHasValidSession = useAppStore((s) => s.setHasValidSession);
  const setWebOAuthError = useAppStore((s) => s.setWebOAuthError);
  const setUserName = useUserDataStore((s) => s.setUserName);
  const setUserNameCustom = useUserDataStore((s) => s.setUserNameCustom);
  const setGoogleAuthChecked = useUserDataStore((s) => s.setGoogleAuthChecked);
  const setChallengeInvite = useUIStore((s) => s.setChallengeInvite);
  const handledAuthKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isNative) return;

    let removeListener = () => {};

    // Event-based session wait: 1 cache check + onAuthStateChange listener + 15s timeout
    // Replaces polling loop (was 20 × getSession() at 400ms intervals)
    const waitForSession = (): Promise<
      import("@supabase/supabase-js").Session | null
    > => {
      return new Promise((resolve) => {
        if (!supabase) {
          resolve(null);
          return;
        }

        let settled = false;

        const trySettle = (
          session: import("@supabase/supabase-js").Session | null,
        ) => {
          if (settled) return;
          settled = true;
          resolve(session);
        };

        // 1. Check if session already exists (local cache, no network call)
        supabase.auth
          .getSession()
          .then(({ data }) => {
            if (data.session?.user) trySettle(data.session);
          })
          .catch(() => trySettle(null)); // graceful: cached session fetch may fail offline — settle with null to proceed to auth listener

        // 2. Listen for auth state change (fires when code exchange completes)
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
          if (
            (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") &&
            session?.user
          ) {
            subscription?.unsubscribe();
            clearTimeout(timeoutId);
            trySettle(session);
          }
        });

        // 3. Timeout after 15s
        const timeoutId = setTimeout(() => {
          subscription?.unsubscribe();
          trySettle(null);
        }, 15_000);
      });
    };

    const getAuthDedupeKey = (url: string): string => {
      try {
        const parsed = new URL(url);
        const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
        const code = parsed.searchParams.get("code") || hash.get("code") || "";
        const state =
          parsed.searchParams.get("state") || hash.get("state") || "";
        const hasToken =
          hash.get("access_token") && hash.get("refresh_token") ? "1" : "0";
        const error =
          parsed.searchParams.get("error") || hash.get("error") || "";
        return `${parsed.protocol}//${parsed.host}${parsed.pathname}|code=${code}|state=${state}|token=${hasToken}|error=${error}`;
      } catch {
        return url;
      }
    };

    const handleAuthUrl = async (
      url: string,
      source: "launch" | "appUrlOpen" | "appState" = "appUrlOpen",
    ): Promise<boolean> => {
      // Check if URL is auth callback
      if (!url.includes("login-callback")) return false;

      const dedupeKey = getAuthDedupeKey(url);
      if (handledAuthKeysRef.current.has(dedupeKey)) {
        logger.log("[Index] Duplicate auth URL skipped:", source);
        return true;
      }
      handledAuthKeysRef.current.add(dedupeKey);
      if (handledAuthKeysRef.current.size > 50) {
        handledAuthKeysRef.current.clear();
        handledAuthKeysRef.current.add(dedupeKey);
      }

      logger.log(
        "[Index] Auth URL received from",
        source,
        new URL(url).pathname,
      );

      // If supabase not ready, store for later
      if (!supabase) {
        logger.log("[Index] Supabase not ready, storing pending URL");
        setPendingAuthUrl(url);
        return true;
      }

      let callbackError: unknown = null;
      try {
        await handleAuthCallback(supabase, url);
      } catch (error) {
        callbackError = error;
        logger.error("[Index] Failed to handle auth callback:", error);
      }

      const session = await waitForSession();
      if (session?.user) {
        const metadata = session.user.user_metadata;
        const name =
          metadata?.full_name ||
          metadata?.name ||
          session.user.email?.split("@")[0] ||
          "Friend";

        logger.log("[Auth] OAuth callback session established");
        setAuthBypassFlag(true);
        setHasValidSession(true);
        setWebOAuthError(null);
        notifyAuthComplete();
        setUserName(name);
        setUserNameCustom(false);
        setGoogleAuthChecked(true);
        endAuthFlow();
        return true;
      }

      logger.error("[Auth] Callback processed but no session established");
      if (callbackError instanceof Error) {
        setWebOAuthError(
          callbackError.message || "Google sign-in failed. Please try again.",
        );
      } else {
        setWebOAuthError("Google sign-in did not complete. Please try again.");
      }
      endAuthFlow();
      return true;
    };

    // Handle challenge deep links
    const handleChallengeUrl = (url: string): boolean => {
      try {
        const parsedUrl = new URL(url);
        // Check if it's a challenge invite URL
        // Support both: zenflow://challenge?data=... and https://zenflow.app/challenge?data=...
        const isCustomScheme =
          parsedUrl.protocol === "zenflow:" &&
          parsedUrl.hostname === "challenge";
        const isHttpsScheme =
          parsedUrl.hostname === "zenflow.app" &&
          parsedUrl.pathname.startsWith("/challenge");

        if (isCustomScheme || isHttpsScheme) {
          const data = parsedUrl.searchParams.get("data");
          if (data) {
            const invite = decodeInviteData(data);
            if (invite) {
              logger.log("[Index] Challenge invite received:", invite.code);
              // Only open challenge modal if challenges feature is enabled
              if (isFeatureVisible("challenges")) {
                setChallengeInvite(invite);
                setShowChallengeModal(true);
                return true;
              } else {
                logger.log(
                  "[Index] Challenges feature disabled, ignoring invite",
                );
              }
            }
          }
        }
      } catch (error) {
        logger.error("[Index] Failed to parse challenge URL:", error);
      }
      return false;
    };

    const setup = async () => {
      try {
        // Check launch URL (cold start with deep link)
        const launch = await App.getLaunchUrl();
        if (launch?.url) {
          logger.log("[Index] Launch URL found:", new URL(launch.url).pathname);
          // Try challenge URL first, then auth URL
          if (!handleChallengeUrl(launch.url)) {
            await handleAuthUrl(launch.url, "launch");
          }
        }
      } catch (error) {
        logger.error("[Index] Failed to read launch URL:", error);
      }

      // Listen for future deep links
      const listener = await App.addListener("appUrlOpen", (event) => {
        if (event?.url) {
          logger.log("[Index] appUrlOpen event:", new URL(event.url).pathname);
          // Try challenge URL first, then auth URL
          if (!handleChallengeUrl(event.url)) {
            void handleAuthUrl(event.url, "appUrlOpen");
          }
        }
      });

      const stateListener = await App.addListener(
        "appStateChange",
        ({ isActive }) => {
          if (!isActive) return;

          void App.getLaunchUrl()
            .then((launch) => {
              if (launch?.url && launch.url.includes("login-callback")) {
                void handleAuthUrl(launch.url, "appState");
              }
            })
            .catch((error) =>
              logger.error(
                "[Index] Failed to read launch URL on resume:",
                error,
              ),
            );
        },
      );

      removeListener = () => {
        void listener.remove();
        void stateListener.remove();
      };
    };

    void setup();
    return () => {
      removeListener();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: register deep link listener once
  }, []); // Listener registers ONCE, no dependencies
}
