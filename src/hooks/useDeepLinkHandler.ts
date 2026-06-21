import { useEffect, useRef } from "react";
import { useAppStore, useUIStore, useUserDataStore, getModalToggle } from "@/stores";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { logger } from "@/lib/logger";
import { App } from "@capacitor/app";
import {
  handleAuthCallback,
  isAllowedLocalOAuthOrigin,
  notifyAuthComplete,
  setPendingAuthUrl,
} from "@/lib/authRedirect";
import { isNative } from "@/lib/platform";
import { supabase } from "@/lib/supabaseClient";
import { decodeInviteData } from "@/lib/friendChallenge";
import { endAuthFlow } from "@/lib/authGuard";
import { subscribeToDeepLinks } from "@/lib/deepLinks";
import { requestDiaryEditorOpen } from "@/lib/diaryDeepLinkIntent";
import { getAuthUserDisplayName } from "@/lib/authUser";
import { closeOAuthBrowser } from "@/lib/nativeOAuthBrowser";

const setShowChallengeModal = getModalToggle("showChallengeModal");

const TRUSTED_AUTH_CALLBACK_WEB_ORIGINS = new Set([
  "https://yehor212.github.io",
  "https://zenflow.app",
]);

function hasLoginCallbackPath(parsedUrl: URL): boolean {
  return parsedUrl.pathname.split("/").filter(Boolean).includes("login-callback");
}

function getDeepLinkLogPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "(invalid-url)";
  }
}

function isTrustedAuthCallbackUrl(url: string): boolean {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return false;
  }

  if (parsedUrl.protocol === "com.zenflow.app:") {
    return (
      parsedUrl.hostname === "login-callback" &&
      (parsedUrl.pathname === "" || parsedUrl.pathname === "/")
    );
  }

  if (!hasLoginCallbackPath(parsedUrl)) return false;

  if (parsedUrl.protocol === "https:") {
    return TRUSTED_AUTH_CALLBACK_WEB_ORIGINS.has(parsedUrl.origin);
  }

  if (parsedUrl.protocol === "http:") {
    return isAllowedLocalOAuthOrigin(parsedUrl.origin);
  }

  return false;
}

interface UseDeepLinkHandlerOptions {
  handleDiaryDeepLinks?: boolean;
}

/**
 * Handles all deep link processing:
 * - Auth deep links (login-callback URLs)
 * - Challenge deep links (zenflow://challenge or https://zenflow.app/challenge)
 * - Launch URL processing (cold start)
 * - Runtime appUrlOpen events
 */
export function useDeepLinkHandler(options: UseDeepLinkHandlerOptions = {}): void {
  const { handleDiaryDeepLinks = true } = options;
  const { isFeatureVisible } = useFeatureFlags();
  const setAuthBypassFlag = useAppStore((s) => s.setAuthBypassFlag);
  const setHasValidSession = useAppStore((s) => s.setHasValidSession);
  const setWebOAuthError = useAppStore((s) => s.setWebOAuthError);
  const setUserName = useUserDataStore((s) => s.setUserName);
  const userNameCustom = useUserDataStore((s) => s.userNameCustom);
  const setUserNameCustom = useUserDataStore((s) => s.setUserNameCustom);
  const setGoogleAuthChecked = useUserDataStore((s) => s.setGoogleAuthChecked);
  const setChallengeInvite = useUIStore((s) => s.setChallengeInvite);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const handledAuthKeysRef = useRef<Set<string>>(new Set());
  const userNameCustomRef = useRef(userNameCustom);
  userNameCustomRef.current = userNameCustom;

  useEffect(() => {
    if (!isNative) return;

    let removeListener = () => {};

    // Event-based session wait: 1 cache check + onAuthStateChange listener + 15s timeout
    // Replaces polling loop (was 20 × getSession() at 400ms intervals)
    const waitForSession = (): Promise<import("@supabase/supabase-js").Session | null> => {
      return new Promise((resolve) => {
        if (!supabase) {
          resolve(null);
          return;
        }

        let settled = false;

        const trySettle = (session: import("@supabase/supabase-js").Session | null) => {
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
            (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") &&
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
        const state = parsed.searchParams.get("state") || hash.get("state") || "";
        const hasToken = hash.get("access_token") && hash.get("refresh_token") ? "1" : "0";
        const error = parsed.searchParams.get("error") || hash.get("error") || "";
        return `${parsed.protocol}//${parsed.host}${parsed.pathname}|code=${code}|state=${state}|token=${hasToken}|error=${error}`;
      } catch {
        return url;
      }
    };

    const handleAuthUrl = async (
      url: string,
      source: "launch" | "appUrlOpen" | "appState" = "appUrlOpen"
    ): Promise<boolean> => {
      // Check if URL is auth callback — validate scheme + trusted origin (OWASP deep link safety)
      if (!isTrustedAuthCallbackUrl(url)) return false;

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

      logger.log("[Index] Auth URL received from", source, getDeepLinkLogPath(url));

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
      await closeOAuthBrowser();
      if (session?.user) {
        const name = getAuthUserDisplayName(session.user);

        logger.log("[Auth] OAuth callback session established");
        setAuthBypassFlag(true);
        setHasValidSession(true);
        setWebOAuthError(null);
        notifyAuthComplete();
        if (!userNameCustomRef.current) {
          setUserName(name);
          setUserNameCustom(false);
        }
        setGoogleAuthChecked(true);
        endAuthFlow();
        return true;
      }

      logger.error("[Auth] Callback processed but no session established");
      if (callbackError instanceof Error) {
        setWebOAuthError(callbackError.message || "Sign-in failed. Please try again.");
      } else {
        setWebOAuthError("Sign-in did not complete. Please try again.");
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
          parsedUrl.protocol === "zenflow:" && parsedUrl.hostname === "challenge";
        const isHttpsScheme =
          parsedUrl.hostname === "zenflow.app" && parsedUrl.pathname.startsWith("/challenge");

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
                logger.log("[Index] Challenges feature disabled, ignoring invite");
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
          logger.log("[Index] Launch URL found:", getDeepLinkLogPath(launch.url));
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
          logger.log("[Index] appUrlOpen event:", getDeepLinkLogPath(event.url));
          // Try challenge URL first, then auth URL
          if (!handleChallengeUrl(event.url)) {
            void handleAuthUrl(event.url, "appUrlOpen");
          }
        }
      });

      const stateListener = await App.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) return;

        void App.getLaunchUrl()
          .then((launch) => {
            if (launch?.url && launch.url.includes("login-callback")) {
              void handleAuthUrl(launch.url, "appState");
            }
          })
          .catch((error) => logger.error("[Index] Failed to read launch URL on resume:", error));
      });

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

  // Handle diary deep links from widget taps (zenflow://diary/mood, zenflow://diary/editor)
  useEffect(() => {
    if (!handleDiaryDeepLinks) return undefined;

    const cleanup = subscribeToDeepLinks((data) => {
      if (data.type === "diary") {
        logger.log("[DeepLink] Diary deep link received, route:", data.route);
        // Navigate to home tab (diary/journal is on home)
        setActiveTab("home");
        // If route is "editor", dispatch a custom event so JournalModule can open the editor
        if (data.route === "editor") {
          requestDiaryEditorOpen();
        }
      }
    });
    return cleanup;
  }, [handleDiaryDeepLinks, setActiveTab]);
}
