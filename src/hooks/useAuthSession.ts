import { useEffect, useRef } from "react";
import { useAppStore, useUserDataStore } from "@/stores";
import { supabase as _supabase } from "@/lib/supabaseClient";

const supabase = _supabase;
import {
  handleAuthCallback,
  isNativePlatform,
  notifyAuthComplete,
  getPendingAuthUrl,
  getCleanAuthCallbackUrl,
  sanitizeAuthErrorMessage,
} from "@/lib/authRedirect";
import {
  getJournalPasswordResetNonceFromUrl,
  persistJournalPasswordResetProofFromUrl,
} from "@/lib/journalPasswordResetHandoff";
import { AUTH_SESSION_EXPIRED_EVENT } from "@/lib/apiClient";
import {
  quiesceCloudSync,
  resumeCloudSync,
  syncWithCloud,
  startAutoSync,
  stopAutoSync,
} from "@/storage/cloudSync";
import { clearLocalUserData, getLocalDataOwnerId, setLocalDataOwnerId } from "@/storage/db";
import { runWithDataWriteBarrier } from "@/hooks/useIndexedDB";
import { pullPreferences } from "@/storage/preferenceSync";
import { syncOrchestrator } from "@/lib/syncOrchestrator";
import { joinPresence, leavePresence } from "@/lib/presenceService";
import { migrateExistingUser } from "@/lib/cloudSyncSettings";
import { logger } from "@/lib/logger";
import { endAuthFlow } from "@/lib/authGuard";
import { APP_VERSION } from "@/lib/appVersion";
import { getAuthUserDisplayName } from "@/lib/authUser";
import { closeOAuthBrowser } from "@/lib/nativeOAuthBrowser";
import { clearJournalContentSession } from "@/lib/journalContentSession";
import { offlineQueue } from "@/lib/offlineQueue";
import { revokePushForAccountBoundary } from "@/lib/pushNotifications";
import {
  AUTH_ACCOUNT_SWITCH_PENDING_WRITES_ERROR,
  LEGACY_OFFLINE_QUEUE_CANCEL_EVENT,
  LEGACY_OFFLINE_QUEUE_RECOVERY_EVENT,
} from "@/lib/authErrors";
import { clearNativeJournalBiometricCredential } from "@/lib/journalBiometricCredentials";
import { hasPendingJournalSecurityMigrationForOwner } from "@/features/journal";
import { clearAccountNotificationsForBoundary } from "@/lib/localNotifications";
import { clearAccountDeviceSurfaces } from "@/lib/accountDeviceCleanup";
import { reconcilePendingAccountSignOutCleanup } from "@/lib/accountSignOutCleanup";

/**
 * Manages Supabase auth session lifecycle:
 * - Session check on mount
 * - Web OAuth callback handling
 * - Pending auth URL processing
 * - Cloud sync on auth change
 * - User name sync from Supabase metadata
 * - Session expired handler (401 events)
 */
export function useAuthSession(isLoading: boolean): void {
  const setHasValidSession = useAppStore((s) => s.setHasValidSession);
  const setAccountBoundaryInProgress = useAppStore((s) => s.setAccountBoundaryInProgress);
  const setAuthBypassFlag = useAppStore((s) => s.setAuthBypassFlag);
  const setIsProcessingWebOAuth = useAppStore((s) => s.setIsProcessingWebOAuth);
  const setWebOAuthError = useAppStore((s) => s.setWebOAuthError);

  const authGateChecked = useUserDataStore((s) => s.authGateChecked);
  const setAuthGateChecked = useUserDataStore((s) => s.setAuthGateChecked);
  const isLoadingUserData = useUserDataStore((s) => s.isLoading);
  const userName = useUserDataStore((s) => s.userName);
  const setUserName = useUserDataStore((s) => s.setUserName);
  const userNameCustom = useUserDataStore((s) => s.userNameCustom);
  const setUserNameCustom = useUserDataStore((s) => s.setUserNameCustom);

  const lastSyncedUserIdRef = useRef<string | null>(null);
  const hadSignOutRef = useRef(false);
  const lastSessionExpiredRef = useRef<number>(0);
  const syncIfNeededRef = useRef<((userId?: string | null) => Promise<void>) | null>(null);

  // Refs for values used inside effects to prevent listener re-subscription
  const authGateCheckedRef = useRef(authGateChecked);
  authGateCheckedRef.current = authGateChecked;
  const isLoadingUserDataRef = useRef(isLoadingUserData);
  isLoadingUserDataRef.current = isLoadingUserData;
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;
  const userNameCustomRef = useRef(userNameCustom);
  userNameCustomRef.current = userNameCustom;
  const userNameRef = useRef(userName);
  userNameRef.current = userName;

  // Check Supabase session on mount - restore auth state if session exists
  // Note: continuous auth state listening is consolidated in the cloud sync useEffect below
  useEffect(() => {
    if (!supabase) {
      setHasValidSession(false);
      return;
    }

    let active = true;

    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;

        const sessionExists = !!data.session;
        if (!sessionExists) {
          setHasValidSession(false);
        }

        // If session exists but the auth gate flag is false, restore it
        // This prevents the login loop after OAuth redirect
        if (sessionExists && !authGateCheckedRef.current && !isLoadingUserDataRef.current) {
          logger.log("[Index] Session exists but auth not checked - restoring state");
          setAuthGateChecked(true);
        }
      } catch (error) {
        logger.error("[Index] Error checking session:", error);
        if (active) {
          setHasValidSession(false);
        }
      }
    };

    void checkSession();

    return () => {
      active = false;
    };
  }, [setAuthGateChecked, setHasValidSession]);

  // Web OAuth callback detection — runs ONCE on mount
  // Detects OAuth code/error in query or hash params (from provider redirects).
  useEffect(() => {
    if (isNativePlatform() || !supabase) return;

    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
    const hasQueryCode = url.searchParams.has("code");
    const hasHashCode = hashParams.has("code");
    const hasImplicitTokens = hashParams.has("access_token") && hashParams.has("refresh_token");
    const hasCode = hasQueryCode || hasHashCode;
    const hasError = url.searchParams.has("error") || hashParams.has("error");
    const requiresVerifiedJournalResetCallback = Boolean(
      getJournalPasswordResetNonceFromUrl(window.location.href)
    );
    const errorDescription =
      url.searchParams.get("error_description") || hashParams.get("error_description");

    if (!hasCode && !hasError && !hasImplicitTokens) return;

    // Handle error case immediately
    if (hasError) {
      logger.error(
        "[Index] OAuth error in URL:",
        url.searchParams.get("error") || hashParams.get("error"),
        errorDescription
      );
      setWebOAuthError(
        errorDescription
          ? sanitizeAuthErrorMessage(errorDescription)
          : "Authentication failed. Please try again."
      );
      setIsProcessingWebOAuth(false);
      endAuthFlow();
      window.history.replaceState({}, "", getCleanAuthCallbackUrl(window.location.href));
      return;
    }

    // Has ?code= — wait for Supabase to exchange it
    logger.log("[Index] Web OAuth callback detected, waiting for code exchange...");
    setIsProcessingWebOAuth(true);

    let settled = false;

    const completeWebOAuthSession = (session: import("@supabase/supabase-js").Session) => {
      const name = getAuthUserDisplayName(session.user);

      setAuthBypassFlag(true);
      setHasValidSession(false);
      setWebOAuthError(null);
      setIsProcessingWebOAuth(false);
      setAuthGateChecked(true);

      if (!userNameCustomRef.current) {
        setUserName(name);
        setUserNameCustom(false);
      }

      persistJournalPasswordResetProofFromUrl(window.location.href);
      notifyAuthComplete();
      endAuthFlow();
      window.history.replaceState({}, "", getCleanAuthCallbackUrl(window.location.href));
      void syncIfNeededRef.current?.(session.user.id);
    };

    const failWebOAuthSession = (message: string) => {
      setIsProcessingWebOAuth(false);
      setWebOAuthError(message);
      endAuthFlow();
      window.history.replaceState({}, "", getCleanAuthCallbackUrl(window.location.href));
    };

    const completeManualWebOAuthCallback = async (source: "hash" | "fallback") => {
      const completeFromCurrentSession = async () => {
        const { data } = await supabase.auth.getSession();
        if (settled) return true;

        if (data.session) {
          settled = true;
          logger.log(`[Index] Web OAuth ${source} callback processed successfully`);
          completeWebOAuthSession(data.session);
          return true;
        }

        return false;
      };

      try {
        await handleAuthCallback(supabase, window.location.href);
        if (settled) return;

        if (await completeFromCurrentSession()) return;

        settled = true;
        logger.error(`[Index] Web OAuth ${source} callback had no session`);
        failWebOAuthSession("Sign-in did not complete. Please try again.");
      } catch (error) {
        if (settled) return;

        try {
          if (!requiresVerifiedJournalResetCallback && (await completeFromCurrentSession())) return;
        } catch (sessionError) {
          logger.warn("[Index] Web OAuth fallback session check failed:", sessionError);
        }

        if (settled) return;
        settled = true;
        logger.error(`[Index] Failed to process web OAuth ${source} callback:`, error);
        failWebOAuthSession("Sign-in failed. Please try again.");
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (settled) return;

      if (
        (event === "SIGNED_IN" ||
          (!requiresVerifiedJournalResetCallback && event === "INITIAL_SESSION")) &&
        session
      ) {
        settled = true;
        logger.log("[Index] Web OAuth code exchange succeeded (event:", event, ")");
        completeWebOAuthSession(session);
      }
    });

    if (!hasQueryCode && (hasHashCode || hasImplicitTokens)) {
      void completeManualWebOAuthCallback("hash");
    }

    // Fallback: if no auth event fires within 5s, proactively check session
    const fallbackCheck = setTimeout(async () => {
      if (settled) return;
      try {
        const { data } = await supabase.auth.getSession();
        if (settled) return;
        if (data.session && !requiresVerifiedJournalResetCallback) {
          settled = true;
          logger.log("[Index] Web OAuth: fallback session check found valid session");
          completeWebOAuthSession(data.session);
          return;
        }
      } catch (e) {
        logger.warn("[Index] Web OAuth fallback check failed:", e);
      }

      if (settled) return;
      if (hasCode || hasImplicitTokens) {
        logger.warn("[Index] Web OAuth fallback exchanging callback directly");
        await completeManualWebOAuthCallback("fallback");
      }
    }, 5000);

    // Timeout: if no session after 30 seconds, exchange likely failed
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      logger.error("[Index] Web OAuth code exchange timed out after 30s");
      setIsProcessingWebOAuth(false);
      setWebOAuthError("Sign-in took too long. Please try again.");
      endAuthFlow();
      window.history.replaceState({}, "", getCleanAuthCallbackUrl(window.location.href));
    }, 30000);

    return () => {
      settled = true;
      subscription.unsubscribe();
      clearTimeout(fallbackCheck);
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: check OAuth redirect once
  }, []); // Run once on mount

  // Process pending auth URL when supabase becomes ready
  useEffect(() => {
    if (!supabase || !isNativePlatform()) return;

    let active = true;
    const pendingUrl = getPendingAuthUrl();
    if (pendingUrl) {
      logger.log("[Index] Processing pending auth URL");

      void (async () => {
        try {
          await handleAuthCallback(supabase, pendingUrl);

          if (!active) return;

          const { data } = await supabase.auth.getSession();
          if (!active) return;

          if (data.session?.user) {
            const name = getAuthUserDisplayName(data.session.user);

            logger.log("[Auth] Pending auth processed successfully");
            void closeOAuthBrowser();
            setAuthBypassFlag(true);
            setHasValidSession(false);
            setWebOAuthError(null);
            notifyAuthComplete();
            if (!userNameCustomRef.current) {
              setUserName(name);
              setUserNameCustom(false);
            }
            setAuthGateChecked(true);
            endAuthFlow();
            void syncIfNeededRef.current?.(data.session.user.id);
          } else {
            logger.error("[Index] Pending auth callback had no session");
            setWebOAuthError("Sign-in did not complete. Please try again.");
            void closeOAuthBrowser();
            endAuthFlow();
          }
        } catch (error) {
          logger.error("[Index] Failed to process pending auth:", error);
          void closeOAuthBrowser();
          setWebOAuthError(
            error instanceof Error ? error.message : "Sign-in failed. Please try again."
          );
          endAuthFlow();
        }
      })();
    }

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: subscribe to auth state once
  }, [supabase, setUserName, setUserNameCustom, setAuthGateChecked]);

  // Cloud sync on auth change
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let transitionGeneration = 0;
    let activeSessionUserId: string | null = null;
    let transitionTail: Promise<void> = Promise.resolve();

    const isCurrentTransition = (userId: string, generation: number): boolean =>
      active && transitionGeneration === generation && activeSessionUserId === userId;

    const reportCleanupBlocked = () => {
      if (typeof window === "undefined") return;
      window.dispatchEvent(
        new CustomEvent("zenflow:account-cleanup-blocked", {
          detail: {
            retry: () => {
              void supabase.auth
                .getSession()
                .then(({ data, error }) => {
                  if (error) {
                    logger.error("[Auth] Cleanup retry could not verify the session:", error);
                    reportCleanupBlocked();
                    return;
                  }
                  void scheduleSync(data.session?.user?.id ?? null);
                })
                .catch((error) => {
                  logger.error("[Auth] Cleanup retry could not verify the session:", error);
                  reportCleanupBlocked();
                });
            },
          },
        }),
      );
    };

    const syncIfNeeded = async (
      userId: string,
      generation: number,
      allowLegacyQueueClaim: boolean,
    ) => {
      if (!isCurrentTransition(userId, generation)) return;

      const pendingCleanup = await reconcilePendingAccountSignOutCleanup(userId);
      if (!isCurrentTransition(userId, generation)) return;
      if (pendingCleanup.status === "blocked") {
        setHasValidSession(false);
        setAccountBoundaryInProgress(true);
        reportCleanupBlocked();
        return;
      }

      if (isLoadingRef.current) return;
      if (lastSyncedUserIdRef.current === userId) return;

      // Use 'replace' if: (a) sign-out happened, or (b) different user was synced before
      const previousSyncedUserId = lastSyncedUserIdRef.current;
      const previousHadSignOut = hadSignOutRef.current;
      const persistedOwnerUserId = await getLocalDataOwnerId();
      if (!isCurrentTransition(userId, generation) || lastSyncedUserIdRef.current === userId)
        return;
      const hasUnownedLegacyActions = await offlineQueue.hasUnownedLegacyActionsReady();
      if (!isCurrentTransition(userId, generation) || lastSyncedUserIdRef.current === userId)
        return;

      let localOwnerEstablished = persistedOwnerUserId !== null;
      let recoveredLegacyQueueForCurrentUser = false;
      try {
        if (hasUnownedLegacyActions && persistedOwnerUserId === null) {
          if (!allowLegacyQueueClaim) {
            setHasValidSession(false);
            setAuthBypassFlag(false);
            setAuthGateChecked(false);
            setWebOAuthError(AUTH_ACCOUNT_SWITCH_PENDING_WRITES_ERROR);
            setAccountBoundaryInProgress(false);
            lastSyncedUserIdRef.current = null;
            hadSignOutRef.current = true;
            return;
          }

          // Only a session already present at cold start may establish the first
          // owner marker for a pre-owner-schema database. Later interactive
          // sign-ins must not guess which account created legacy queued work.
          await runWithDataWriteBarrier(async () => {
            if (!isCurrentTransition(userId, generation)) return;
            await setLocalDataOwnerId(userId);
          });
          if (!isCurrentTransition(userId, generation)) return;
          await offlineQueue.claimLegacyActionsForOwner(userId);
          if (!isCurrentTransition(userId, generation)) return;
          localOwnerEstablished = true;
          recoveredLegacyQueueForCurrentUser = true;
        } else if (hasUnownedLegacyActions && persistedOwnerUserId === userId) {
          await offlineQueue.claimLegacyActionsForOwner(userId);
          if (!isCurrentTransition(userId, generation)) return;
          recoveredLegacyQueueForCurrentUser = true;
        }
      } catch (error) {
        if (!isCurrentTransition(userId, generation)) return;
        setHasValidSession(false);
        setAuthBypassFlag(false);
        setAuthGateChecked(false);
        setWebOAuthError(AUTH_ACCOUNT_SWITCH_PENDING_WRITES_ERROR);
        setAccountBoundaryInProgress(false);
        logger.error("[Auth] Legacy offline queue ownership recovery failed:", error);
        return;
      }

      const isAccountSwitch =
        !recoveredLegacyQueueForCurrentUser &&
        (persistedOwnerUserId !== null
          ? persistedOwnerUserId !== userId
          : previousHadSignOut ||
            (previousSyncedUserId !== null && previousSyncedUserId !== userId));
      const previousOwnerUserId = persistedOwnerUserId ?? previousSyncedUserId;

      if (
        isAccountSwitch &&
        previousOwnerUserId &&
        previousOwnerUserId !== userId &&
        ((await offlineQueue.hasPendingActionsForOwnerReady(previousOwnerUserId)) ||
          (await hasPendingJournalSecurityMigrationForOwner(previousOwnerUserId)))
      ) {
        setHasValidSession(false);
        setAuthBypassFlag(false);
        setAuthGateChecked(false);
        setWebOAuthError(AUTH_ACCOUNT_SWITCH_PENDING_WRITES_ERROR);
        setAccountBoundaryInProgress(false);
        lastSyncedUserIdRef.current = null;
        hadSignOutRef.current = true;
        const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
        if (signOutError) {
          logger.error(
            "[Auth] Failed to close the new session while preserving pending writes:",
            signOutError
          );
        }
        return;
      }

      lastSyncedUserIdRef.current = userId;
      hadSignOutRef.current = false;
      let accountBoundaryPrepared = false;
      let boundarySuspended = false;

      try {
        if (isAccountSwitch) {
          await quiesceCloudSync();
          if (!isCurrentTransition(userId, generation)) return;
          try {
            await offlineQueue.suspendForAccountBoundary();
            boundarySuspended = true;
            if (!isCurrentTransition(userId, generation)) return;
            if (
              previousOwnerUserId &&
              previousOwnerUserId !== userId &&
              ((await offlineQueue.hasPendingActionsForOwnerReady(previousOwnerUserId)) ||
                (await hasPendingJournalSecurityMigrationForOwner(previousOwnerUserId)))
            ) {
              setHasValidSession(false);
              setAuthBypassFlag(false);
              setAuthGateChecked(false);
              setWebOAuthError(AUTH_ACCOUNT_SWITCH_PENDING_WRITES_ERROR);
              const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
              if (signOutError) {
                logger.error(
                  "[Auth] Failed to close the new session while preserving pending writes:",
                  signOutError
                );
              }
              lastSyncedUserIdRef.current = previousOwnerUserId;
              hadSignOutRef.current = false;
              resumeCloudSync();
              offlineQueue.resumeAfterAccountBoundary();
              boundarySuspended = false;
              setAccountBoundaryInProgress(false);
              return;
            }
            if (previousOwnerUserId && previousOwnerUserId !== userId) {
              await clearAccountNotificationsForBoundary();
              if (!isCurrentTransition(userId, generation)) return;
              const pushCleanup = await revokePushForAccountBoundary(previousOwnerUserId);
              if (!isCurrentTransition(userId, generation)) return;
              if (pushCleanup.native === "failed") {
                throw new Error("Unable to unregister the previous account's push token");
              }
              if (pushCleanup.remote === "failed" || pushCleanup.remote === "owner-changed") {
                logger.warn(
                  "[Auth] Previous push row could not be removed after the session changed; native token was invalidated",
                  { remote: pushCleanup.remote }
                );
              }
              await clearAccountNotificationsForBoundary();
              if (!isCurrentTransition(userId, generation)) return;
            }
            await offlineQueue.discardSuspendedActionsForAccountBoundary();
            if (!isCurrentTransition(userId, generation)) return;
            await clearNativeJournalBiometricCredential();
            if (!isCurrentTransition(userId, generation)) return;
            await clearAccountDeviceSurfaces();
            if (!isCurrentTransition(userId, generation)) return;
            await runWithDataWriteBarrier(
              async () => {
                clearJournalContentSession("sign-out");
                const { clearDeviceIdCache } = await import("@/storage/eventSync");
                clearDeviceIdCache();
                await clearLocalUserData();
                if (!isCurrentTransition(userId, generation)) return;
                await setLocalDataOwnerId(userId);
              },
              { deferredWrites: "discard" }
            );
            if (!isCurrentTransition(userId, generation)) return;
            setAuthGateChecked(true);
          } catch (cleanupError) {
            setHasValidSession(false);
            setAuthBypassFlag(false);
            setAuthGateChecked(false);
            try {
              const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
              if (signOutError) {
                logger.error(
                  "[Auth] Failed to close the new session after boundary cleanup:",
                  signOutError
                );
              }
            } catch (signOutError) {
              logger.error(
                "[Auth] Failed to close the new session after boundary cleanup:",
                signOutError
              );
            }
            setAccountBoundaryInProgress(false);
            throw cleanupError;
          }
          if (!isCurrentTransition(userId, generation)) return;
          resumeCloudSync();
          offlineQueue.resumeAfterAccountBoundary();
          boundarySuspended = false;
          accountBoundaryPrepared = true;
        }

        // Enable sync only after any previous account has been fully removed.
        migrateExistingUser();

        // Use 'replace' on account switch to avoid merging different users' data
        await syncWithCloud(isAccountSwitch ? "replace" : "merge", userId);
        if (!isCurrentTransition(userId, generation)) return;
        if (!isAccountSwitch && !localOwnerEstablished) {
          await setLocalDataOwnerId(userId);
          if (!isCurrentTransition(userId, generation)) return;
        }
        // Start auto-sync after successful initial sync
        startAutoSync();
        // Join Presence channel for friend online status
        joinPresence().catch((err) => logger.warn("[Auth]", "Presence join failed:", err));
        if (active) {
          setAuthGateChecked(true);
          setAccountBoundaryInProgress(false);
          setHasValidSession(true);
        }
      } catch (error) {
        if (!isCurrentTransition(userId, generation)) return;
        if (boundarySuspended) {
          // Remain suspended: local cleanup did not complete, so no old-account
          // work may resume under the new session.
        } else if (accountBoundaryPrepared) {
          // Local data is already clean and bound to the new account. Keep the
          // session safe and let periodic Merge retry a transient pull failure.
          startAutoSync();
          if (active) {
            setAuthGateChecked(true);
            setAccountBoundaryInProgress(false);
            setHasValidSession(true);
          }
        } else if (lastSyncedUserIdRef.current === userId) {
          lastSyncedUserIdRef.current = previousSyncedUserId;
          hadSignOutRef.current = previousHadSignOut;
          if (active) {
            setAuthGateChecked(true);
            setAccountBoundaryInProgress(false);
            setHasValidSession(true);
          }
        }
        logger.error("Cloud sync failed:", error);
      }
    };

    const scheduleSync = (
      userId?: string | null,
      options: { allowLegacyQueueClaim?: boolean } = {},
    ): Promise<void> => {
      const normalizedUserId = userId ?? null;
      const previousSessionUserId = activeSessionUserId;
      const generation = ++transitionGeneration;
      activeSessionUserId = normalizedUserId;

      if (!normalizedUserId) {
        if (active) setHasValidSession(false);
        const scheduled = transitionTail
          .catch(() => undefined)
          .then(async () => {
            if (!active || transitionGeneration !== generation) return;
            const pendingCleanup = await reconcilePendingAccountSignOutCleanup(null);
            if (!active || transitionGeneration !== generation) return;
            if (pendingCleanup.status === "blocked") {
              setAccountBoundaryInProgress(true);
              reportCleanupBlocked();
              return;
            }
            setAccountBoundaryInProgress(false);
          });
        transitionTail = scheduled.then(
          () => undefined,
          () => undefined
        );
        return scheduled;
      }

      if (
        previousSessionUserId !== normalizedUserId ||
        lastSyncedUserIdRef.current !== normalizedUserId
      ) {
        setAccountBoundaryInProgress(true);
        setHasValidSession(false);
      }

      const scheduled = transitionTail
        .catch(() => undefined)
        .then(() =>
          syncIfNeeded(
            normalizedUserId,
            generation,
            options.allowLegacyQueueClaim === true,
          ),
        );
      transitionTail = scheduled.then(
        () => undefined,
        () => undefined
      );
      return scheduled;
    };

    syncIfNeededRef.current = scheduleSync;

    const handleLegacyQueueRecovery = () => {
      void supabase.auth
        .getSession()
        .then(({ data, error }) => {
          if (error || !data.session?.user?.id) {
            logger.error(
              "[Auth] Could not verify the account selected for legacy queue recovery:",
              error,
            );
            return;
          }
          setWebOAuthError(null);
          void scheduleSync(data.session.user.id, { allowLegacyQueueClaim: true });
        })
        .catch((error) => {
          logger.error(
            "[Auth] Could not verify the account selected for legacy queue recovery:",
            error,
          );
        });
    };
    const handleLegacyQueueRecoveryCancel = () => {
      void supabase.auth
        .signOut({ scope: "local" })
        .then(({ error }) => {
          if (error) {
            logger.error("[Auth] Could not cancel legacy queue recovery:", error);
            return;
          }
          setWebOAuthError(null);
        })
        .catch((error) => {
          logger.error("[Auth] Could not cancel legacy queue recovery:", error);
        });
    };
    window.addEventListener(LEGACY_OFFLINE_QUEUE_RECOVERY_EVENT, handleLegacyQueueRecovery);
    window.addEventListener(
      LEGACY_OFFLINE_QUEUE_CANCEL_EVENT,
      handleLegacyQueueRecoveryCancel,
    );

    const initialLookupGeneration = transitionGeneration;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active || transitionGeneration !== initialLookupGeneration) return;
        offlineQueue.observeAuthStateOwner(data.session?.user?.id ?? null);
        void scheduleSync(data.session?.user?.id ?? null, {
          allowLegacyQueueClaim: Boolean(data.session?.user?.id),
        });
      })
      .catch((err) => logger.warn("[Auth]", "Session check failed:", err));

    // Consolidated auth subscription: session validity + cloud sync + app_version tracking
    // (Previously 3 separate onAuthStateChange subscriptions)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      offlineQueue.observeAuthStateOwner(session?.user?.id ?? null);
      // Reset sync refs on sign-out so next sign-in uses 'replace' mode
      if (event === "SIGNED_OUT") {
        clearJournalContentSession("sign-out");
        lastSyncedUserIdRef.current = null;
        hadSignOutRef.current = true;
      }
      if (session) {
        // Reset sync orchestrator's session-expired flag so 401 errors
        // are properly surfaced again after re-authentication
        syncOrchestrator.resetSessionExpired();
      }
      void scheduleSync(session?.user?.id ?? null, {
        allowLegacyQueueClaim: event === "INITIAL_SESSION" && Boolean(session?.user?.id),
      }).then(() => {
        if (
          session &&
          active &&
          activeSessionUserId === session.user.id &&
          useAppStore.getState().hasValidSession
        ) {
          // Preferences can only enter local state after the account boundary.
          void pullPreferences();
          void offlineQueue.replayBlockedCriticalActionsForActiveOwner().catch((error) => {
            logger.warn("[Auth] Failed to replay blocked sync actions:", error);
          });
        }
      });

      // Track app_version in profiles on login (was separate subscription)
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user?.id) {
        supabase
          .from("profiles")
          .update({
            app_version: APP_VERSION,
          })
          .eq("id", session.user.id)
          .then(({ error }) => {
            if (error) logger.warn("[Auth] Failed to track app_version:", error.message);
          });
      }
    });

    return () => {
      active = false;
      transitionGeneration += 1;
      activeSessionUserId = null;
      if (syncIfNeededRef.current === scheduleSync) {
        syncIfNeededRef.current = null;
      }
      window.removeEventListener(
        LEGACY_OFFLINE_QUEUE_RECOVERY_EVENT,
        handleLegacyQueueRecovery,
      );
      window.removeEventListener(
        LEGACY_OFFLINE_QUEUE_CANCEL_EVENT,
        handleLegacyQueueRecoveryCancel,
      );
      subscription?.unsubscribe();
      stopAutoSync();
      leavePresence().catch((err) => logger.warn("[Auth]", "Presence leave failed:", err));
    };
  }, [
    setAccountBoundaryInProgress,
    setAuthBypassFlag,
    setAuthGateChecked,
    setHasValidSession,
    setWebOAuthError,
  ]);

  // Sync user name from Supabase metadata (uses cached session, no network call)
  useEffect(() => {
    if (!supabase) return;
    let active = true;

    // Initial sync from cached session
    const syncNameFromSession = async () => {
      if (userNameCustomRef.current) return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!active || !session?.user) return;
      const candidate = getAuthUserDisplayName(session.user, "");
      if (candidate && candidate !== userNameRef.current) {
        setUserName(candidate);
      }
    };
    void syncNameFromSession();

    // Listen: use session directly from callback (no network call)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active || !session?.user || userNameCustomRef.current) return;
      const candidate = getAuthUserDisplayName(session.user, "");
      if (candidate && candidate !== userNameRef.current) {
        setUserName(candidate);
      }
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [setUserName]);

  // Session expired handler - listens for 401 errors from API/sync
  // Verify actual session state before resetting auth
  useEffect(() => {
    if (!supabase) return;

    const handleSessionExpired = async () => {
      // Throttle - ignore if we just handled one
      const now = Date.now();
      if (now - lastSessionExpiredRef.current < 5000) {
        logger.log("[Index] Session expired event throttled");
        return;
      }
      lastSessionExpiredRef.current = now;

      logger.warn("[Index] Session expired event received, verifying session...");

      // Check if session is actually expired before resetting
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          logger.log("[Index] Session still valid, ignoring expired event");
          return;
        }
      } catch (error) {
        logger.error("[Index] Error checking session:", error);
      }

      // Session truly expired - reset auth state
      logger.warn("[Index] Session confirmed expired, resetting auth state");
      setHasValidSession(false);
      setAuthBypassFlag(false);
      setAuthGateChecked(false);
    };

    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [setAuthGateChecked, setHasValidSession, setAuthBypassFlag]);
}
