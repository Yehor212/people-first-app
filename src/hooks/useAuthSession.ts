import { useEffect, useRef } from "react";
import type { Session } from "@supabase/supabase-js";
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
  getCloudSyncAccountBoundaryEpoch,
  isCloudSyncSuspendedForAccountBoundary,
  quiesceCloudSync,
  resumeCloudSync,
  syncWithCloud,
  startAutoSync,
  stopAutoSync,
} from "@/storage/cloudSync";
import {
  clearLocalDataOwnerId,
  clearLocalUserData,
  getLocalDataOwnerId,
  setLocalDataOwnerId,
} from "@/storage/db";
import { runWithDataWriteBarrier, runWithSettledDataRead } from "@/hooks/useIndexedDB";
import { pullPreferences } from "@/storage/preferenceSync";
import { syncOrchestrator } from "@/lib/syncOrchestrator";
import {
  joinPresence,
  leavePresence,
  leavePresenceForAccountBoundary,
} from "@/lib/presenceService";
import { migrateExistingUser } from "@/lib/cloudSyncSettings";
import { logger } from "@/lib/logger";
import { endAuthFlow } from "@/lib/authGuard";
import { APP_VERSION } from "@/lib/appVersion";
import { getAuthUserAccountLabel, getAuthUserDisplayName } from "@/lib/authUser";
import { closeOAuthBrowser } from "@/lib/nativeOAuthBrowser";
import { clearJournalContentSession } from "@/lib/journalContentSession";
import { offlineQueue } from "@/lib/offlineQueue";
import { revokePushForAccountBoundary } from "@/lib/pushNotifications";
import {
  AUTH_ACCOUNT_SWITCH_PENDING_WRITES_ERROR,
  AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CANCEL_EVENT,
  AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CONFIRM_EVENT,
  AUTH_IMPORTED_BACKUP_DECISION_ALREADY_SETTLED,
  AUTH_IMPORTED_BACKUP_DECISION_SETTLED_ACK_EVENT,
  AUTH_IMPORTED_BACKUP_LOCAL_RECOVERY_EVENT,
  AUTH_IMPORTED_BACKUP_SAVE_CONTINUE_EVENT,
  createImportedBackupAccountClaimError,
  LEGACY_OFFLINE_QUEUE_CANCEL_EVENT,
  LEGACY_OFFLINE_QUEUE_RECOVERY_EVENT,
} from "@/lib/authErrors";
import { clearNativeJournalBiometricCredential } from "@/lib/journalBiometricCredentials";
import {
  ensureOwnerBoundJournalSecurityMigration,
  hasPendingInstallationJournalSecurityRemoval,
  hasPendingJournalSecurityMigrationForOwner,
  hasPendingJournalSecurityRemovalForOwner,
  resumePendingJournalPasswordRemoval,
  runJournalSecurityMigration,
} from "@/features/journal";
import { clearAccountNotificationsForBoundary } from "@/lib/localNotifications";
import { clearAccountDeviceSurfaces } from "@/lib/accountDeviceCleanup";
import { signOutExpectedOwnerLocally } from "@/lib/ownerBoundAuthSession";
import {
  commitPendingAccountSwitchCleanup,
  reconcilePendingAccountSignOutCleanup,
} from "@/lib/accountSignOutCleanup";
import {
  clearAccountCleanupRecovery,
  publishAccountCleanupRecovery,
} from "@/lib/accountCleanupRecoveryState";
import {
  clearPendingLocalBackupAccountClaim,
  markImportedBackupLocalOnlyAccess,
  markPendingLocalBackupAccountClaim,
  notifyAccountSessionTransition,
  readPendingLocalBackupAccountClaim,
  readImportedBackupLocalOnlyDecisionRevision,
  runWithImportedBackupAccountClaimLock,
} from "@/storage/accountBoundaryRuntime";

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
  const finalizeAdmittedSessionRef = useRef<
    ((session: Session, trackAppVersion: boolean) => Promise<void>) | null
  >(null);

  // Refs for values used inside effects to prevent listener re-subscription
  const authGateCheckedRef = useRef(authGateChecked);
  authGateCheckedRef.current = authGateChecked;
  const isLoadingUserDataRef = useRef(isLoadingUserData);
  isLoadingUserDataRef.current = isLoadingUserData;
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;
  const hydrationWasLoadingRef = useRef(isLoading);
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
        const { data, error } = await supabase.auth.getSession();
        if (!active) return;
        if (error) {
          throw error;
        }

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
          setHasValidSession(null);
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
      setAuthBypassFlag(true);
      setHasValidSession(false);
      setWebOAuthError(null);
      setIsProcessingWebOAuth(false);
      setAuthGateChecked(true);

      if (hasCode) {
        persistJournalPasswordResetProofFromUrl(window.location.href, session.user.id);
      }
      notifyAuthComplete();
      endAuthFlow();
      window.history.replaceState({}, "", getCleanAuthCallbackUrl(window.location.href));
      const syncCurrentSession = syncIfNeededRef.current;
      if (syncCurrentSession) {
        void syncCurrentSession(session.user.id).then(() =>
          finalizeAdmittedSessionRef.current?.(session, true)
        );
      }
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
            logger.log("[Auth] Pending auth processed successfully");
            void closeOAuthBrowser();
            setAuthBypassFlag(true);
            setHasValidSession(false);
            setWebOAuthError(null);
            notifyAuthComplete();
            setAuthGateChecked(true);
            endAuthFlow();
            const syncCurrentSession = syncIfNeededRef.current;
            if (syncCurrentSession) {
              void syncCurrentSession(data.session.user.id).then(() =>
                finalizeAdmittedSessionRef.current?.(data.session, true)
              );
            }
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
    type OwnedWriterSuspension = {
      sourceOwnerUserId: string | null;
      cloud: boolean;
      cloudEpoch: number | null;
      queue: boolean;
      queueEpoch: number | null;
      destructiveCommitStarted: boolean;
      destructiveCommitCompleted: boolean;
      localRealmOwnershipLost: boolean;
      blocked: boolean;
    };
    let ownedWriterSuspension: OwnedWriterSuspension | null = null;
    let importedBackupDecisionInFlight = false;
    let lastAppVersionUserId: string | null = null;

    const isCurrentTransition = (userId: string, generation: number): boolean =>
      active && transitionGeneration === generation && activeSessionUserId === userId;

    const reportCleanupBlocked = () => {
      if (typeof window === "undefined") return;
      publishAccountCleanupRecovery(async () => {
        try {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          await scheduleSync(data.session?.user?.id ?? null);
          if (useAppStore.getState().isAccountBoundaryInProgress || hasWriterSuspension()) {
            throw new Error("Account cleanup remains blocked");
          }
          clearAccountCleanupRecovery();
        } catch (error) {
          logger.error("[Auth] Cleanup retry could not verify the session:", error);
          reportCleanupBlocked();
          throw error;
        }
      });
    };

    const hasWriterSuspension = (): boolean =>
      ownedWriterSuspension?.blocked === true ||
      isCloudSyncSuspendedForAccountBoundary() ||
      offlineQueue.isSuspendedForAccountBoundary();

    const hasExactWriterSuspensionOwnership = (suspension: OwnedWriterSuspension): boolean =>
      ownedWriterSuspension === suspension &&
      (!suspension.cloud ||
        (suspension.cloudEpoch !== null &&
          getCloudSyncAccountBoundaryEpoch() === suspension.cloudEpoch &&
          isCloudSyncSuspendedForAccountBoundary())) &&
      (!suspension.queue ||
        (suspension.queueEpoch !== null &&
          offlineQueue.getAccountBoundaryEpoch() === suspension.queueEpoch &&
          offlineQueue.isSuspendedForAccountBoundary()));

    const ownsCurrentWriterSuspension = (suspension: OwnedWriterSuspension): boolean =>
      !suspension.blocked && hasExactWriterSuspensionOwnership(suspension);

    const assertOwnedWriterSuspension = (suspension: OwnedWriterSuspension): void => {
      if (ownsCurrentWriterSuspension(suspension)) return;
      suspension.blocked = true;
      throw new Error("Account-boundary writer suspension ownership changed");
    };

    const gateSessionForWriterSuspension = () => {
      setHasValidSession(false);
      setAccountBoundaryInProgress(true);
      reportCleanupBlocked();
    };

    const acquireOwnedWriterSuspension = async (sourceOwnerUserId: string | null) => {
      if (ownedWriterSuspension) {
        assertOwnedWriterSuspension(ownedWriterSuspension);
        return ownedWriterSuspension;
      }
      // A suspension that predates this transition belongs to another cleanup
      // coordinator (for example account deletion). Never claim or resume it.
      if (hasWriterSuspension()) {
        throw new Error("Account-boundary writers are already suspended");
      }

      const suspension: OwnedWriterSuspension = {
        sourceOwnerUserId,
        cloud: false,
        cloudEpoch: null,
        queue: false,
        queueEpoch: null,
        destructiveCommitStarted: false,
        destructiveCommitCompleted: false,
        localRealmOwnershipLost: false,
        blocked: false,
      };
      ownedWriterSuspension = suspension;
      try {
        // Mark ownership before awaiting because both suspension APIs publish
        // their fail-closed state synchronously and then wait for older work.
        const cloudEpochBefore = getCloudSyncAccountBoundaryEpoch();
        suspension.cloud = true;
        const cloudSuspension = quiesceCloudSync();
        suspension.cloudEpoch = cloudEpochBefore + 1;
        if (getCloudSyncAccountBoundaryEpoch() !== suspension.cloudEpoch) {
          throw new Error("Cloud writer suspension ownership changed during acquisition");
        }
        await cloudSuspension;
        if (getCloudSyncAccountBoundaryEpoch() !== suspension.cloudEpoch) {
          throw new Error("Cloud writer suspension ownership changed while quiescing");
        }
        const queueEpochBefore = offlineQueue.getAccountBoundaryEpoch();
        suspension.queue = true;
        const queueSuspension = offlineQueue.suspendForAccountBoundary();
        suspension.queueEpoch = queueEpochBefore + 1;
        if (offlineQueue.getAccountBoundaryEpoch() !== suspension.queueEpoch) {
          throw new Error("Offline writer suspension ownership changed during acquisition");
        }
        await queueSuspension;
        if (offlineQueue.getAccountBoundaryEpoch() !== suspension.queueEpoch) {
          throw new Error("Offline writer suspension ownership changed while quiescing");
        }
        return suspension;
      } catch (error) {
        suspension.blocked = true;
        throw error;
      }
    };

    const releaseOwnedWriterSuspension = (suspension = ownedWriterSuspension): boolean => {
      if (!suspension || ownedWriterSuspension !== suspension) return false;
      if (!ownsCurrentWriterSuspension(suspension)) {
        suspension.blocked = true;
        return false;
      }
      if (suspension.cloud) resumeCloudSync();
      if (suspension.queue) offlineQueue.resumeAfterAccountBoundary();
      ownedWriterSuspension = null;
      return true;
    };

    const closeExpectedReplacementSession = async (targetOwnerUserId: string): Promise<boolean> => {
      try {
        const result = await signOutExpectedOwnerLocally(targetOwnerUserId);
        if (result.status === "signed-out" || result.status === "no-session") {
          return true;
        }
        logger.error(
          "[Auth] Refused to close a replacement session without exact owner proof:",
          result
        );
      } catch (signOutError) {
        logger.error(
          "[Auth] Failed to close the replacement session after boundary cleanup:",
          signOutError
        );
      }
      return false;
    };

    const closeReplacementSessionAndSettleWriters = async (
      suspension: OwnedWriterSuspension,
      sourceOwnerUserId: string | null,
      targetOwnerUserId: string
    ): Promise<boolean> => {
      setHasValidSession(false);
      setAuthBypassFlag(false);
      setAuthGateChecked(false);

      const replacementSessionClosed = await closeExpectedReplacementSession(targetOwnerUserId);

      if (
        replacementSessionClosed &&
        !suspension.destructiveCommitStarted &&
        hasExactWriterSuspensionOwnership(suspension)
      ) {
        suspension.blocked = false;
        if (releaseOwnedWriterSuspension(suspension)) {
          lastSyncedUserIdRef.current = sourceOwnerUserId;
          hadSignOutRef.current = false;
          clearAccountCleanupRecovery();
          setAccountBoundaryInProgress(false);
          return true;
        }
      }

      suspension.blocked = true;
      setAccountBoundaryInProgress(true);
      reportCleanupBlocked();
      return false;
    };

    const reportAbandonedDestructiveCleanup = (
      suspension: OwnedWriterSuspension,
      targetOwnerUserId: string
    ): void => {
      publishAccountCleanupRecovery(async () => {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (data.session?.user?.id !== targetOwnerUserId) {
          throw new Error("The account changed before cleanup recovery");
        }
        assertOwnedWriterSuspension(suspension);
        if (!suspension.sourceOwnerUserId) {
          throw new Error("Cleanup recovery has no source owner");
        }
        const committed = await commitPendingAccountSwitchCleanup(
          suspension.sourceOwnerUserId,
          targetOwnerUserId,
          async (prepareCleanupIntent) => {
            await runWithDataWriteBarrier(
              async () => {
                assertOwnedWriterSuspension(suspension);
                if (
                  await hasPendingJournalSecurityRemovalForOwner(
                    suspension.sourceOwnerUserId!,
                  )
                ) {
                  throw new Error(
                    "Diary protection removal must finish before account-switch recovery",
                  );
                }
                const currentOwnerUserId = await getLocalDataOwnerId();
                if (
                  currentOwnerUserId !== suspension.sourceOwnerUserId &&
                  currentOwnerUserId !== null
                ) {
                  suspension.localRealmOwnershipLost = true;
                  throw new Error("Cleanup recovery source owner changed before local mutation");
                }
                if (!prepareCleanupIntent()) {
                  throw new Error("Cleanup recovery could not persist its durable marker");
                }
                suspension.destructiveCommitStarted = true;
                clearJournalContentSession("sign-out");
                const { clearDeviceIdCache } = await import("@/storage/eventSync");
                clearDeviceIdCache();
                await clearLocalUserData();
                assertOwnedWriterSuspension(suspension);
                await setLocalDataOwnerId(targetOwnerUserId);
              },
              { deferredWrites: "discard" }
            );
          }
        );
        if (!committed) {
          throw new Error("Cleanup recovery could not confirm its durable marker");
        }
        suspension.destructiveCommitCompleted = true;
        if (!releaseOwnedWriterSuspension(suspension)) {
          throw new Error("Cleanup recovery lost writer-suspension ownership");
        }
        setHasValidSession(false);
        setAccountBoundaryInProgress(false);
        clearAccountCleanupRecovery();
      });
    };

    const syncIfNeeded = async (
      userId: string,
      generation: number,
      allowLegacyQueueClaim: boolean,
      allowImportedBackupClaim: boolean,
      importedBackupAccountLabel?: string
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
      if (
        ownedWriterSuspension?.destructiveCommitStarted &&
        (pendingCleanup.status === "completed" || pendingCleanup.status === "cancelled") &&
        !isCloudSyncSuspendedForAccountBoundary() &&
        !offlineQueue.isSuspendedForAccountBoundary()
      ) {
        // Durable reconciliation already settled the global writer gates.
        // Retire the stale hook token without issuing a second resume.
        ownedWriterSuspension = null;
        lastSyncedUserIdRef.current = null;
      }
      clearAccountCleanupRecovery();

      if (isLoadingRef.current) return;

      // A persisted owner mismatch is the only destructive account switch. A
      // confirmed owner-null realm is local-first data and must be adopted with
      // merge after sign-in instead of being erased because a sign-out happened.
      const previousSyncedUserId = lastSyncedUserIdRef.current;
      const previousHadSignOut = hadSignOutRef.current;
      let persistedOwnerUserId: string | null;
      try {
        // A different tab may be between its committed clear and owner bind.
        // The settled read waits behind that origin-wide DATA boundary and
        // rejects if the account generation changes while it is queued.
        persistedOwnerUserId = await runWithSettledDataRead(getLocalDataOwnerId);
      } catch (error) {
        if (!isCurrentTransition(userId, generation)) return;
        gateSessionForWriterSuspension();
        logger.error("[Auth] Local data ownership could not be read safely:", error);
        return;
      }
      if (!isCurrentTransition(userId, generation)) return;
      if (ownedWriterSuspension?.blocked || (!ownedWriterSuspension && hasWriterSuspension())) {
        gateSessionForWriterSuspension();
        return;
      }
      if (lastSyncedUserIdRef.current === userId) return;
      const pendingImportedBackupClaim = readPendingLocalBackupAccountClaim();
      if (
        pendingImportedBackupClaim.status !== "none" &&
        !allowImportedBackupClaim
      ) {
        setHasValidSession(false);
        setAuthBypassFlag(false);
        setAuthGateChecked(false);
        setWebOAuthError(createImportedBackupAccountClaimError(importedBackupAccountLabel, userId));
        setAccountBoundaryInProgress(false);
        lastSyncedUserIdRef.current = null;
        return;
      }
      if (
        persistedOwnerUserId === null &&
        (await hasPendingInstallationJournalSecurityRemoval())
      ) {
        if (!isCurrentTransition(userId, generation)) return;
        setHasValidSession(false);
        setAuthBypassFlag(false);
        setAuthGateChecked(false);
        setWebOAuthError(AUTH_ACCOUNT_SWITCH_PENDING_WRITES_ERROR);
        setAccountBoundaryInProgress(false);
        lastSyncedUserIdRef.current = null;
        hadSignOutRef.current = true;
        logger.warn(
          "[Auth] Account adoption is blocked until installation-bound diary removal is recovered",
        );
        return;
      }
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
        persistedOwnerUserId !== null &&
        persistedOwnerUserId !== userId;
      const previousOwnerUserId = persistedOwnerUserId ?? previousSyncedUserId;

      if (ownedWriterSuspension && !isAccountSwitch) {
        const canRestorePersistedOwner =
          !ownedWriterSuspension.destructiveCommitStarted &&
          ownedWriterSuspension.sourceOwnerUserId === userId &&
          persistedOwnerUserId === userId;
        if (!canRestorePersistedOwner) {
          gateSessionForWriterSuspension();
          return;
        }
        if (!releaseOwnedWriterSuspension(ownedWriterSuspension)) {
          gateSessionForWriterSuspension();
          return;
        }
      }

      if (!ownedWriterSuspension && hasWriterSuspension()) {
        gateSessionForWriterSuspension();
        return;
      }

      if (
        isAccountSwitch &&
        previousOwnerUserId &&
        previousOwnerUserId !== userId &&
        ((await offlineQueue.hasPendingActionsForOwnerReady(previousOwnerUserId)) ||
          (await hasPendingJournalSecurityMigrationForOwner(previousOwnerUserId)) ||
          (await hasPendingJournalSecurityRemovalForOwner(previousOwnerUserId)))
      ) {
        setHasValidSession(false);
        setAuthBypassFlag(false);
        setAuthGateChecked(false);
        setWebOAuthError(AUTH_ACCOUNT_SWITCH_PENDING_WRITES_ERROR);
        setAccountBoundaryInProgress(false);
        lastSyncedUserIdRef.current = null;
        hadSignOutRef.current = true;
        if (!(await closeExpectedReplacementSession(userId))) {
          setAccountBoundaryInProgress(true);
          reportCleanupBlocked();
        } else {
          setAccountBoundaryInProgress(false);
        }
        return;
      }

      lastSyncedUserIdRef.current = userId;
      hadSignOutRef.current = false;
      let accountBoundaryPrepared = false;
      let boundarySuspended = false;

      try {
        if (isAccountSwitch) {
          let writerSuspension: OwnedWriterSuspension;
          try {
            writerSuspension = await acquireOwnedWriterSuspension(previousOwnerUserId);
          } catch (acquisitionError) {
            const partialSuspension = ownedWriterSuspension;
            if (
              partialSuspension &&
              (await closeReplacementSessionAndSettleWriters(
                partialSuspension,
                previousOwnerUserId,
                userId
              ))
            ) {
              logger.error(
                "[Auth] Account-switch writer quiescence failed; restored the intact source realm",
                acquisitionError
              );
              return;
            }
            throw acquisitionError;
          }
          boundarySuspended = true;
          if (!isCurrentTransition(userId, generation)) return;
          assertOwnedWriterSuspension(writerSuspension);
          try {
            if (
              previousOwnerUserId &&
              previousOwnerUserId !== userId &&
              ((await offlineQueue.hasPendingActionsForOwnerReady(previousOwnerUserId)) ||
                (await hasPendingJournalSecurityMigrationForOwner(previousOwnerUserId)) ||
                (await hasPendingJournalSecurityRemovalForOwner(previousOwnerUserId)))
            ) {
              setHasValidSession(false);
              setAuthBypassFlag(false);
              setAuthGateChecked(false);
              setWebOAuthError(AUTH_ACCOUNT_SWITCH_PENDING_WRITES_ERROR);
              if (!(await closeExpectedReplacementSession(userId))) {
                writerSuspension.blocked = true;
                setAccountBoundaryInProgress(true);
                reportCleanupBlocked();
                return;
              }
              lastSyncedUserIdRef.current = previousOwnerUserId;
              hadSignOutRef.current = false;
              if (!releaseOwnedWriterSuspension(writerSuspension)) {
                gateSessionForWriterSuspension();
                return;
              }
              boundarySuspended = false;
              setAccountBoundaryInProgress(false);
              return;
            }
            if (previousOwnerUserId && previousOwnerUserId !== userId) {
              await leavePresenceForAccountBoundary(previousOwnerUserId);
              if (!isCurrentTransition(userId, generation)) return;
              await clearAccountNotificationsForBoundary();
              if (!isCurrentTransition(userId, generation)) return;
              const pushCleanup = await revokePushForAccountBoundary(previousOwnerUserId);
              if (!isCurrentTransition(userId, generation)) return;
              const remotePushRevocationConfirmed =
                pushCleanup.remote === "deleted" || pushCleanup.remote === "not-registered";
              if (!remotePushRevocationConfirmed) {
                throw new Error(
                  "Unable to prove that the previous account's remote push registration was revoked"
                );
              }
              await clearAccountNotificationsForBoundary();
              if (!isCurrentTransition(userId, generation)) return;
            }
            await clearNativeJournalBiometricCredential();
            if (!isCurrentTransition(userId, generation)) return;
            assertOwnedWriterSuspension(writerSuspension);
            await clearAccountDeviceSurfaces();
            if (!isCurrentTransition(userId, generation)) return;
            assertOwnedWriterSuspension(writerSuspension);
            if (!previousOwnerUserId) {
              throw new Error("Account switch has no persisted source owner");
            }
            const committed = await commitPendingAccountSwitchCleanup(
              previousOwnerUserId,
              userId,
              async (prepareCleanupIntent) => {
                await runWithDataWriteBarrier(
                  async () => {
                    assertOwnedWriterSuspension(writerSuspension);
                    const queueFinalization =
                      await offlineQueue.discardSuspendedActionsForAccountBoundary({
                        onlyIfEmpty: true,
                      });
                    if (queueFinalization.status === "blocked") {
                      throw new Error(
                        "Offline writes appeared while the account boundary was being prepared"
                      );
                    }
                    if (
                      await hasPendingJournalSecurityRemovalForOwner(
                        previousOwnerUserId,
                      )
                    ) {
                      throw new Error(
                        "Diary protection removal must finish before account-switch cleanup",
                      );
                    }
                    assertOwnedWriterSuspension(writerSuspension);
                    const currentOwnerUserId = await getLocalDataOwnerId();
                    if (currentOwnerUserId !== previousOwnerUserId) {
                      writerSuspension.localRealmOwnershipLost = true;
                      throw new Error("Local data owner changed before account-switch cleanup");
                    }
                    if (!prepareCleanupIntent()) {
                      throw new Error("Unable to persist the account-switch cleanup intent");
                    }
                    writerSuspension.destructiveCommitStarted = true;
                    clearJournalContentSession("sign-out");
                    const { clearDeviceIdCache } = await import("@/storage/eventSync");
                    clearDeviceIdCache();
                    await clearLocalUserData();
                    // Once the destructive boundary commit starts, clearing data
                    // and binding that cleared state to its target owner are one
                    // logical mutation. A successor transition is serialized
                    // behind this cleanup coordinator and DATA boundary.
                    await setLocalDataOwnerId(userId);
                  },
                  { deferredWrites: "discard" }
                );
              }
            );
            if (!committed) {
              throw new Error("Unable to confirm the account-switch cleanup intent");
            }
            writerSuspension.destructiveCommitCompleted = true;
            if (!isCurrentTransition(userId, generation)) {
              if (
                !active &&
                writerSuspension.destructiveCommitCompleted &&
                !releaseOwnedWriterSuspension(writerSuspension)
              ) {
                writerSuspension.blocked = true;
                reportCleanupBlocked();
              }
              return;
            }
            setAuthGateChecked(true);
          } catch (cleanupError) {
            if (!isCurrentTransition(userId, generation)) {
              if (!active) {
                reportAbandonedDestructiveCleanup(writerSuspension, userId);
              } else {
                writerSuspension.blocked = true;
                reportCleanupBlocked();
              }
              logger.error(
                "[Auth] Account-boundary cleanup became ambiguous after its owner hook stopped",
                cleanupError
              );
              return;
            }
            // Before the durable/destructive boundary starts, account A still
            // owns intact local data. Close B and release only this coordinator's
            // exact epochs so the app returns to a stable signed-out A realm.
            if (
              await closeReplacementSessionAndSettleWriters(
                writerSuspension,
                previousOwnerUserId,
                userId
              )
            ) {
              logger.error(
                "[Auth] Pre-destructive account cleanup failed; restored the intact source realm",
                cleanupError
              );
              return;
            }

            writerSuspension.blocked = true;
            setHasValidSession(false);
            setAuthBypassFlag(false);
            setAuthGateChecked(false);
            setAccountBoundaryInProgress(true);
            reportCleanupBlocked();
            throw cleanupError;
          }
          if (!isCurrentTransition(userId, generation)) return;
          if (!releaseOwnedWriterSuspension(writerSuspension)) {
            gateSessionForWriterSuspension();
            return;
          }
          boundarySuspended = false;
          accountBoundaryPrepared = true;
        }

        // Enable sync only after any previous account has been fully removed.
        if (hasWriterSuspension()) {
          gateSessionForWriterSuspension();
          return;
        }
        migrateExistingUser();

        if (!isAccountSwitch && !localOwnerEstablished) {
          await runWithDataWriteBarrier(async () => {
            const currentOwnerUserId = await getLocalDataOwnerId();
            if (currentOwnerUserId !== null && currentOwnerUserId !== userId) {
              throw new Error("Local data owner changed before account adoption");
            }
            await setLocalDataOwnerId(userId);
            if (
              pendingImportedBackupClaim.status !== "none" &&
              !clearPendingLocalBackupAccountClaim()
            ) {
              await clearLocalDataOwnerId();
              throw new Error("Imported backup account-claim marker could not be cleared");
            }
          });
          if (!isCurrentTransition(userId, generation)) return;
          localOwnerEstablished = true;
        } else if (
          persistedOwnerUserId === userId &&
          pendingImportedBackupClaim.status !== "none" &&
          !clearPendingLocalBackupAccountClaim()
        ) {
          logger.warn("[Auth] Stale imported backup account-claim marker could not be cleared");
        }

        const journalRemovalRecovery = await resumePendingJournalPasswordRemoval();
        if (!isCurrentTransition(userId, generation)) return;
        if (journalRemovalRecovery === "pending") {
          lastSyncedUserIdRef.current = null;
          setHasValidSession(false);
          setAccountBoundaryInProgress(false);
          logger.warn(
            "[Auth] Cloud sync remains paused until diary protection removal is reconciled",
          );
          return;
        }

        const journalProtectionMigration =
          await ensureOwnerBoundJournalSecurityMigration(userId);
        let journalProtectionMigrationRan = false;
        if (journalProtectionMigration) {
          try {
            await runJournalSecurityMigration(
              { revision: journalProtectionMigration.revision },
              userId,
            );
            journalProtectionMigrationRan = true;
          } catch (error) {
            lastSyncedUserIdRef.current = null;
            setHasValidSession(false);
            setAccountBoundaryInProgress(false);
            logger.warn(
              "[Auth] Cloud sync remains paused until diary protection is reconciled",
              error,
            );
            return;
          }
        }

        // The authenticated shell is safe as soon as the current session owns
        // the local realm and all account/journal security fences above have
        // settled. The initial cloud merge is recovery/convergence work: it may
        // be slow or offline, so it must not hold the user on the sign-in gate.
        // Later owner changes and writer-suspension checks still close the gate
        // immediately through scheduleSync.
        if (!isCurrentTransition(userId, generation) || hasWriterSuspension()) {
          gateSessionForWriterSuspension();
          return;
        }
        setWebOAuthError(null);
        setAuthGateChecked(true);
        setAccountBoundaryInProgress(false);
        setHasValidSession(true);

        // Use 'replace' on account switch to avoid merging different users' data
        if (!journalProtectionMigrationRan) {
          await syncWithCloud(isAccountSwitch ? "replace" : "merge", userId);
        }
        if (!isCurrentTransition(userId, generation)) return;
        if (hasWriterSuspension()) {
          gateSessionForWriterSuspension();
          return;
        }
        // Presence publication is disabled until a private friend-scoped
        // protocol exists. This call proves that no legacy public channel is
        // retained before the authenticated surface is admitted.
        try {
          await joinPresence();
        } catch {
          lastSyncedUserIdRef.current = null;
          setHasValidSession(false);
          setAccountBoundaryInProgress(true);
          reportCleanupBlocked();
          logger.error("[Auth] Legacy Presence teardown was not acknowledged");
          return;
        }
        if (!isCurrentTransition(userId, generation)) return;
        if (hasWriterSuspension()) {
          gateSessionForWriterSuspension();
          return;
        }
        // Start auto-sync only after the privacy boundary is clean.
        startAutoSync();
        if (active) {
          setWebOAuthError(null);
          setAuthGateChecked(true);
          setAccountBoundaryInProgress(false);
          setHasValidSession(true);
        }
      } catch (error) {
        if (!isCurrentTransition(userId, generation)) return;
        if (
          allowImportedBackupClaim &&
          localOwnerEstablished &&
          !boundarySuspended &&
          !hasWriterSuspension()
        ) {
          lastSyncedUserIdRef.current = previousSyncedUserId;
          hadSignOutRef.current = previousHadSignOut;
          setHasValidSession(false);
          setAuthBypassFlag(false);
          setAuthGateChecked(false);
          setWebOAuthError(
            createImportedBackupAccountClaimError(importedBackupAccountLabel, userId, "save-failed")
          );
          setAccountBoundaryInProgress(false);
          logger.error("[CloudSync] Cloud sync failed after imported backup account binding:", error);
          return;
        }
        if (boundarySuspended) {
          // Remain suspended: local cleanup did not complete, so no old-account
          // work may resume under the new session.
        } else if (accountBoundaryPrepared && !hasWriterSuspension()) {
          // Local data is already clean and bound to the new account. Keep the
          // session safe and let periodic Merge retry a transient pull failure.
          startAutoSync();
          if (active) {
            setAuthGateChecked(true);
            setAccountBoundaryInProgress(false);
            setHasValidSession(true);
          }
        } else if (!localOwnerEstablished) {
          lastSyncedUserIdRef.current = previousSyncedUserId;
          hadSignOutRef.current = previousHadSignOut;
          setHasValidSession(false);
          setAuthBypassFlag(false);
          setAuthGateChecked(false);
          if (allowImportedBackupClaim && pendingImportedBackupClaim.status !== "none") {
            setWebOAuthError(
              createImportedBackupAccountClaimError(
                importedBackupAccountLabel,
                userId,
                "action-failed"
              )
            );
            setAccountBoundaryInProgress(false);
            return;
          }
          setAccountBoundaryInProgress(true);
          reportCleanupBlocked();
        } else if (lastSyncedUserIdRef.current === userId && !hasWriterSuspension()) {
          lastSyncedUserIdRef.current = previousSyncedUserId;
          hadSignOutRef.current = previousHadSignOut;
          if (active) {
            setAuthGateChecked(true);
            setAccountBoundaryInProgress(false);
            setHasValidSession(true);
          }
        }
        logger.error("[CloudSync] Cloud sync failed:", error);
      }
    };

    const scheduleSync = (
      userId?: string | null,
      options: {
        allowLegacyQueueClaim?: boolean;
        allowImportedBackupClaim?: boolean;
        importedBackupAccountLabel?: string;
      } = {}
    ): Promise<void> => {
      const normalizedUserId = userId ?? null;
      const previousSessionUserId = activeSessionUserId;
      if (previousSessionUserId !== normalizedUserId) {
        // Abort owner-sensitive transactions before any awaited transition
        // preflight. Their DATA lock cannot make Supabase auth publication
        // atomic with the final IndexedDB commit event.
        notifyAccountSessionTransition();
        // Stop the previous owner's periodic backup synchronously, before any
        // awaited owner/queue preflight can observe the replacement session.
        stopAutoSync();
        if (active) {
          setHasValidSession(false);
          setAccountBoundaryInProgress(true);
        }
      }
      // Token refreshes and duplicate SIGNED_IN events for the same authenticated
      // owner are observations of the active transition, not a new boundary.
      // Superseding that transition after its writers were suspended could leave
      // both cloud sync and the offline queue paused forever. Real owner changes
      // and every sign-out still receive a new generation and cancel stale work.
      const generation =
        normalizedUserId !== null && previousSessionUserId === normalizedUserId
          ? transitionGeneration
          : ++transitionGeneration;
      activeSessionUserId = normalizedUserId;

      if (!normalizedUserId) {
        if (active) setHasValidSession(false);
        const scheduled = transitionTail
          .catch(() => undefined)
          .then(async () => {
            if (!active || transitionGeneration !== generation) return;
            try {
              if (previousSessionUserId) {
                await leavePresenceForAccountBoundary(previousSessionUserId);
              } else {
                await leavePresence();
              }
            } catch {
              setAccountBoundaryInProgress(true);
              logger.error("[Auth] Presence teardown was not acknowledged during sign-out");
              reportCleanupBlocked();
              return;
            }
            if (!active || transitionGeneration !== generation) return;
            const pendingCleanup = await reconcilePendingAccountSignOutCleanup(null);
            if (!active || transitionGeneration !== generation) return;
            if (pendingCleanup.status === "blocked") {
              setAccountBoundaryInProgress(true);
              reportCleanupBlocked();
              return;
            }
            if (ownedWriterSuspension?.destructiveCommitCompleted) {
              const completedSuspension = ownedWriterSuspension;
              if (!hasExactWriterSuspensionOwnership(completedSuspension)) {
                completedSuspension.blocked = true;
                setAccountBoundaryInProgress(true);
                reportCleanupBlocked();
                return;
              }
              completedSuspension.blocked = false;
              if (!releaseOwnedWriterSuspension(completedSuspension)) {
                setAccountBoundaryInProgress(true);
                reportCleanupBlocked();
                return;
              }
            }
            if (
              ownedWriterSuspension &&
              !ownedWriterSuspension.destructiveCommitStarted &&
              hasExactWriterSuspensionOwnership(ownedWriterSuspension)
            ) {
              const intactSourceSuspension = ownedWriterSuspension;
              intactSourceSuspension.blocked = false;
              if (!releaseOwnedWriterSuspension(intactSourceSuspension)) {
                setAccountBoundaryInProgress(true);
                reportCleanupBlocked();
                return;
              }
            }
            if (
              ownedWriterSuspension?.destructiveCommitStarted &&
              (pendingCleanup.status === "completed" || pendingCleanup.status === "cancelled") &&
              !isCloudSyncSuspendedForAccountBoundary() &&
              !offlineQueue.isSuspendedForAccountBoundary()
            ) {
              // The durable reconciler completed the destructive handoff and
              // already settled the global writer gates. Retire only the stale
              // hook token; calling resume here would double-release another
              // coordinator's epochs.
              ownedWriterSuspension = null;
            }
            // A pre-destructive account switch can close the replacement session
            // while retaining its owned suspension for a safe retry. Signed-out
            // reconciliation must not erase that recovery authority or present the
            // account boundary as complete while writers are still quiesced.
            if (ownedWriterSuspension || hasWriterSuspension()) {
              setAccountBoundaryInProgress(true);
              reportCleanupBlocked();
              return;
            }
            clearAccountCleanupRecovery();
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
            options.allowImportedBackupClaim === true,
            options.importedBackupAccountLabel
          )
        );
      transitionTail = scheduled.then(
        () => undefined,
        () => undefined
      );
      return scheduled;
    };

    syncIfNeededRef.current = scheduleSync;

    type AccountClaimDecisionEvent = CustomEvent<{
      accountLabel?: string;
      expectedOwnerUserId?: string;
      expectedLocalOnlyDecisionRevision?: string | null;
      onSettled?: () => void;
    }>;
    const presentImportedBackupChoiceForSession = (session: NonNullable<Session>) => {
      setHasValidSession(false);
      setAuthBypassFlag(false);
      setAuthGateChecked(false);
      setWebOAuthError(
        createImportedBackupAccountClaimError(
          getAuthUserAccountLabel(session.user) ?? undefined,
          session.user.id
        )
      );
      setAccountBoundaryInProgress(false);
    };
    const presentImportedBackupDecisionAlreadySettled = () => {
      setWebOAuthError(AUTH_IMPORTED_BACKUP_DECISION_ALREADY_SETTLED);
      setHasValidSession(false);
      setAuthBypassFlag(false);
      setAuthGateChecked(false);
    };
    const handleImportedBackupAccountClaim = (event: Event) => {
      const {
        accountLabel,
        expectedOwnerUserId,
        expectedLocalOnlyDecisionRevision,
        onSettled,
      } =
        (event as AccountClaimDecisionEvent).detail ?? {};
      if (importedBackupDecisionInFlight) return;
      importedBackupDecisionInFlight = true;
      setAccountBoundaryInProgress(true);
      let syncOwnsBoundaryState = false;
      void runWithImportedBackupAccountClaimLock(async () => {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session?.user?.id) {
          if (
            readPendingLocalBackupAccountClaim().status !== "none" &&
            !markImportedBackupLocalOnlyAccess()
          ) {
            throw new Error("Imported backup local-only access could not be persisted");
          }
          setWebOAuthError(null);
          setHasValidSession(false);
          setAuthBypassFlag(true);
          setAuthGateChecked(true);
          return;
        }
        if (!expectedOwnerUserId || data.session.user.id !== expectedOwnerUserId) {
          presentImportedBackupChoiceForSession(data.session);
          return;
        }
        if (
          expectedLocalOnlyDecisionRevision !== undefined &&
          readImportedBackupLocalOnlyDecisionRevision() !==
            expectedLocalOnlyDecisionRevision
        ) {
          presentImportedBackupDecisionAlreadySettled();
          return;
        }
        if (readPendingLocalBackupAccountClaim().status === "none") {
          syncOwnsBoundaryState = true;
          await scheduleSync(data.session.user.id, {
            allowImportedBackupClaim: true,
            importedBackupAccountLabel: getAuthUserAccountLabel(data.session.user) ?? undefined,
          });
          return;
        }
        syncOwnsBoundaryState = true;
        await scheduleSync(data.session.user.id, {
          allowImportedBackupClaim: true,
          importedBackupAccountLabel: getAuthUserAccountLabel(data.session.user) ?? undefined,
        });
      })
        .catch((error) => {
          logger.error(
            "[Auth] Could not verify the account selected for imported backup transfer:",
            error
          );
          if (expectedOwnerUserId) {
            setWebOAuthError(
              createImportedBackupAccountClaimError(
                accountLabel,
                expectedOwnerUserId,
                "action-failed"
              )
            );
          }
          setAccountBoundaryInProgress(false);
        })
        .finally(() => {
          if (!syncOwnsBoundaryState) {
            setAccountBoundaryInProgress(false);
          }
          importedBackupDecisionInFlight = false;
          onSettled?.();
        });
    };
    const handleImportedBackupAccountClaimCancel = (event: Event) => {
      const {
        accountLabel,
        expectedOwnerUserId,
        expectedLocalOnlyDecisionRevision,
        onSettled,
      } =
        (event as AccountClaimDecisionEvent).detail ?? {};
      if (importedBackupDecisionInFlight) return;
      importedBackupDecisionInFlight = true;
      setAccountBoundaryInProgress(true);
      void runWithImportedBackupAccountClaimLock(async () => {
        const { data, error } = await supabase.auth.getSession();
        const ownerUserId = data.session?.user?.id;
        if (error) throw error;
        if (!ownerUserId) {
          if (
            readPendingLocalBackupAccountClaim().status !== "none" &&
            !markImportedBackupLocalOnlyAccess()
          ) {
            throw new Error("Imported backup local-only access could not be persisted");
          }
          setWebOAuthError(null);
          setHasValidSession(false);
          setAuthBypassFlag(true);
          setAuthGateChecked(true);
          return;
        }
        if (!expectedOwnerUserId || ownerUserId !== expectedOwnerUserId) {
          presentImportedBackupChoiceForSession(data.session!);
          return;
        }
        if (
          expectedLocalOnlyDecisionRevision !== undefined &&
          readImportedBackupLocalOnlyDecisionRevision() !==
            expectedLocalOnlyDecisionRevision
        ) {
          presentImportedBackupDecisionAlreadySettled();
          return;
        }
        if (readPendingLocalBackupAccountClaim().status === "none") {
          // Another realm already completed the serialized choice. A stale
          // cancel cannot undo a cloud merge, and must not silently report its
          // requested sign-out as successful. Surface first-decision-wins for
          // explicit acknowledgement instead of starting another sync.
          presentImportedBackupDecisionAlreadySettled();
          return;
        }
        const result = await signOutExpectedOwnerLocally(expectedOwnerUserId);
        if (result.status !== "signed-out" && result.status !== "no-session") {
          throw new Error(
            `Imported backup transfer cancellation was not confirmed: ${result.status}`
          );
        }
        if (!markImportedBackupLocalOnlyAccess()) {
          throw new Error("Imported backup local-only access could not be persisted");
        }
        setWebOAuthError(null);
        setHasValidSession(false);
        setAuthBypassFlag(true);
        setAuthGateChecked(true);
        setAccountBoundaryInProgress(false);
      })
        .catch((error) => {
          logger.error("[Auth] Could not cancel imported backup transfer:", error);
          if (expectedOwnerUserId) {
            setWebOAuthError(
              createImportedBackupAccountClaimError(
                accountLabel,
                expectedOwnerUserId,
                "action-failed"
              )
            );
          }
          setAccountBoundaryInProgress(false);
        })
        .finally(() => {
          setAccountBoundaryInProgress(false);
          importedBackupDecisionInFlight = false;
          onSettled?.();
        });
    };
    const handleImportedBackupDecisionSettledAcknowledgement = () => {
      if (importedBackupDecisionInFlight) return;
      importedBackupDecisionInFlight = true;
      setAccountBoundaryInProgress(true);
      void supabase.auth
        .getSession()
        .then(async ({ data, error }) => {
          if (error) throw error;
          const currentUserId = data.session?.user?.id;
          setWebOAuthError(null);
          if (!currentUserId) {
            setHasValidSession(false);
            setAuthBypassFlag(false);
            setAuthGateChecked(false);
            return;
          }
          const localOwnerUserId = await runWithSettledDataRead(getLocalDataOwnerId);
          const { data: verifiedSessionData, error: verifiedSessionError } =
            await supabase.auth.getSession();
          if (verifiedSessionError) throw verifiedSessionError;
          if (
            !active ||
            activeSessionUserId !== currentUserId ||
            verifiedSessionData.session?.user.id !== currentUserId ||
            localOwnerUserId !== currentUserId ||
            readPendingLocalBackupAccountClaim().status !== "none" ||
            hasWriterSuspension()
          ) {
            throw new Error("Settled backup choice no longer matches the active account");
          }
          startAutoSync();
          setAuthGateChecked(true);
          setAccountBoundaryInProgress(false);
          setHasValidSession(true);
        })
        .catch((error) => {
          logger.error("[Auth] Could not revalidate the settled backup choice:", error);
          setWebOAuthError(AUTH_IMPORTED_BACKUP_DECISION_ALREADY_SETTLED);
          setHasValidSession(false);
          setAuthBypassFlag(false);
          setAuthGateChecked(false);
        })
        .finally(() => {
          setAccountBoundaryInProgress(false);
          importedBackupDecisionInFlight = false;
        });
    };
    const handleImportedBackupLocalRecovery = (event: Event) => {
      const { onSettled } = (
        event as CustomEvent<{ onSettled?: (success: boolean) => void }>
      ).detail ?? { onSettled: undefined };
      if (importedBackupDecisionInFlight) {
        onSettled?.(false);
        return;
      }
      importedBackupDecisionInFlight = true;
      void runWithImportedBackupAccountClaimLock(async () => {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (data.session?.user?.id) {
          const currentClaim = readPendingLocalBackupAccountClaim();
          const claimReady =
            currentClaim.status === "pending" || markPendingLocalBackupAccountClaim();
          if (!claimReady || !markImportedBackupLocalOnlyAccess()) {
            throw new Error("Imported backup account choice could not be reconstructed");
          }
          presentImportedBackupChoiceForSession(data.session);
          return;
        }
        const currentClaim = readPendingLocalBackupAccountClaim();
        const claimReady =
          currentClaim.status === "pending" || markPendingLocalBackupAccountClaim();
        if (!claimReady || !markImportedBackupLocalOnlyAccess()) {
          throw new Error("Imported backup local recovery could not be persisted");
        }
        setWebOAuthError(null);
        setHasValidSession(false);
        setAuthBypassFlag(true);
        setAuthGateChecked(true);
      })
        .then(() => onSettled?.(true))
        .catch((error) => {
          logger.error("[Auth] Could not restore imported backup local access:", error);
          onSettled?.(false);
        })
        .finally(() => {
          importedBackupDecisionInFlight = false;
        });
    };
    const handleImportedBackupSaveContinue = (event: Event) => {
      const { accountLabel, expectedOwnerUserId, onSettled } =
        (event as AccountClaimDecisionEvent).detail ?? {};
      if (importedBackupDecisionInFlight) return;
      importedBackupDecisionInFlight = true;
      setAccountBoundaryInProgress(true);
      void runWithImportedBackupAccountClaimLock(async () => {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session?.user?.id) {
          setWebOAuthError(null);
          setHasValidSession(false);
          setAuthBypassFlag(true);
          setAuthGateChecked(true);
          return;
        }
        if (!expectedOwnerUserId || data.session.user.id !== expectedOwnerUserId) {
          presentImportedBackupChoiceForSession(data.session);
          return;
        }
        const localOwnerUserId = await runWithSettledDataRead(getLocalDataOwnerId);
        const { data: currentSessionData, error: currentSessionError } =
          await supabase.auth.getSession();
        if (currentSessionError) throw currentSessionError;
        if (
          currentSessionData.session?.user.id !== expectedOwnerUserId ||
          activeSessionUserId !== expectedOwnerUserId ||
          localOwnerUserId !== expectedOwnerUserId ||
          readPendingLocalBackupAccountClaim().status !== "none"
        ) {
          throw new Error("Imported backup save state is no longer current");
        }
        startAutoSync();
        setWebOAuthError(null);
        setAuthGateChecked(true);
        setAccountBoundaryInProgress(false);
        setHasValidSession(true);
      })
        .catch((error) => {
          logger.error("[Auth] Could not continue with imported backup save pending:", error);
          if (expectedOwnerUserId) {
            setWebOAuthError(
              createImportedBackupAccountClaimError(
                accountLabel,
                expectedOwnerUserId,
                "action-failed"
              )
            );
          }
          setAccountBoundaryInProgress(false);
        })
        .finally(() => {
          importedBackupDecisionInFlight = false;
          onSettled?.();
        });
    };
    const handleLegacyQueueRecovery = () => {
      void supabase.auth
        .getSession()
        .then(({ data, error }) => {
          if (error || !data.session?.user?.id) {
            logger.error(
              "[Auth] Could not verify the account selected for legacy queue recovery:",
              error
            );
            return;
          }
          setWebOAuthError(null);
          void scheduleSync(data.session.user.id, { allowLegacyQueueClaim: true });
        })
        .catch((error) => {
          logger.error(
            "[Auth] Could not verify the account selected for legacy queue recovery:",
            error
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
    window.addEventListener(LEGACY_OFFLINE_QUEUE_CANCEL_EVENT, handleLegacyQueueRecoveryCancel);
    window.addEventListener(
      AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CONFIRM_EVENT,
      handleImportedBackupAccountClaim
    );
    window.addEventListener(
      AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CANCEL_EVENT,
      handleImportedBackupAccountClaimCancel
    );
    window.addEventListener(
      AUTH_IMPORTED_BACKUP_SAVE_CONTINUE_EVENT,
      handleImportedBackupSaveContinue
    );
    window.addEventListener(
      AUTH_IMPORTED_BACKUP_DECISION_SETTLED_ACK_EVENT,
      handleImportedBackupDecisionSettledAcknowledgement
    );
    window.addEventListener(
      AUTH_IMPORTED_BACKUP_LOCAL_RECOVERY_EVENT,
      handleImportedBackupLocalRecovery
    );

    const isExactlyAdmittedSession = async (session: Session): Promise<boolean> => {
      const expectedUserId = session.user.id;
      if (
        !active ||
        activeSessionUserId !== expectedUserId ||
        !useAppStore.getState().hasValidSession ||
        readPendingLocalBackupAccountClaim().status !== "none"
      ) {
        return false;
      }

      const localOwnerUserId = await runWithSettledDataRead(getLocalDataOwnerId);
      return (
        active &&
        activeSessionUserId === expectedUserId &&
        useAppStore.getState().hasValidSession === true &&
        localOwnerUserId === expectedUserId &&
        readPendingLocalBackupAccountClaim().status === "none"
      );
    };

    const finalizeAdmittedSession = async (
      session: Session,
      trackAppVersion: boolean
    ): Promise<void> => {
      if (!(await isExactlyAdmittedSession(session))) return;

      if (!userNameCustomRef.current) {
        const candidate = getAuthUserDisplayName(session.user, "");
        if (candidate && candidate !== userNameRef.current) {
          setUserName(candidate);
          setUserNameCustom(false);
        }
      }

      // Preferences and queued writes can only enter local state after the
      // durable owner marker and current transition agree on the same account.
      void pullPreferences(session.user.id);
      void offlineQueue.replayBlockedCriticalActionsForActiveOwner(session.user.id).catch((error) => {
        logger.warn("[Auth] Failed to replay blocked sync actions:", error);
      });

      if (trackAppVersion && lastAppVersionUserId !== session.user.id) {
        // The preference pull and queue replay can publish a new boundary in
        // another same-origin context. Recheck at the last await boundary
        // before starting this authenticated profile mutation.
        if (!(await isExactlyAdmittedSession(session))) return;
        const { error } = await supabase
          .from("profiles")
          .update({ app_version: APP_VERSION })
          .eq("id", session.user.id);
        if (error) {
          logger.warn("[Auth] Failed to track app_version:", error.message);
        } else if (await isExactlyAdmittedSession(session)) {
          lastAppVersionUserId = session.user.id;
        }
      }
    };
    finalizeAdmittedSessionRef.current = finalizeAdmittedSession;

    const initialLookupGeneration = transitionGeneration;
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active || transitionGeneration !== initialLookupGeneration) return;
        if (error) {
          logger.warn("[Auth]", "Session check failed:", error);
          setHasValidSession(null);
          return;
        }
        offlineQueue.observeAuthStateOwner(data.session?.user?.id ?? null);
        const session = data.session;
        void scheduleSync(session?.user?.id ?? null, {
          allowLegacyQueueClaim: Boolean(session?.user?.id),
          importedBackupAccountLabel: getAuthUserAccountLabel(session?.user) ?? undefined,
        }).then(() => {
          if (session) void finalizeAdmittedSession(session, true);
        });
      })
      .catch((err) => {
        logger.warn("[Auth]", "Session check failed:", err);
        if (active && transitionGeneration === initialLookupGeneration) {
          setHasValidSession(null);
        }
      });

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
        lastAppVersionUserId = null;
      }
      if (session) {
        // Reset sync orchestrator's session-expired flag so 401 errors
        // are properly surfaced again after re-authentication
        syncOrchestrator.resetSessionExpired();
      }
      void scheduleSync(session?.user?.id ?? null, {
        allowLegacyQueueClaim: event === "INITIAL_SESSION" && Boolean(session?.user?.id),
        importedBackupAccountLabel: getAuthUserAccountLabel(session?.user) ?? undefined,
      }).then(() => {
        if (session) {
          void finalizeAdmittedSession(
            session,
            event === "SIGNED_IN" || event === "INITIAL_SESSION"
          );
        }
      });
    });

    return () => {
      active = false;
      transitionGeneration += 1;
      activeSessionUserId = null;
      const teardownSuspension = ownedWriterSuspension;
      if (
        teardownSuspension &&
        !teardownSuspension.destructiveCommitStarted &&
        !releaseOwnedWriterSuspension(teardownSuspension)
      ) {
        logger.error(
          "[Auth] Could not release the hook-owned pre-destructive writer suspension during teardown"
        );
        reportCleanupBlocked();
      }
      if (syncIfNeededRef.current === scheduleSync) {
        syncIfNeededRef.current = null;
      }
      if (finalizeAdmittedSessionRef.current === finalizeAdmittedSession) {
        finalizeAdmittedSessionRef.current = null;
      }
      window.removeEventListener(LEGACY_OFFLINE_QUEUE_RECOVERY_EVENT, handleLegacyQueueRecovery);
      window.removeEventListener(
        LEGACY_OFFLINE_QUEUE_CANCEL_EVENT,
        handleLegacyQueueRecoveryCancel
      );
      window.removeEventListener(
        AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CONFIRM_EVENT,
        handleImportedBackupAccountClaim
      );
      window.removeEventListener(
        AUTH_IMPORTED_BACKUP_ACCOUNT_CLAIM_CANCEL_EVENT,
        handleImportedBackupAccountClaimCancel
      );
      window.removeEventListener(
        AUTH_IMPORTED_BACKUP_SAVE_CONTINUE_EVENT,
        handleImportedBackupSaveContinue
      );
      window.removeEventListener(
        AUTH_IMPORTED_BACKUP_DECISION_SETTLED_ACK_EVENT,
        handleImportedBackupDecisionSettledAcknowledgement
      );
      window.removeEventListener(
        AUTH_IMPORTED_BACKUP_LOCAL_RECOVERY_EVENT,
        handleImportedBackupLocalRecovery
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
    setUserName,
    setUserNameCustom,
    setWebOAuthError,
  ]);

  // Auth events can arrive before IndexedDB and the rest of the local realm
  // finish hydrating. The account-boundary coordinator intentionally defers
  // owner binding in that state, so retry the current cached session exactly
  // when hydration releases. Re-reading the current session prevents a stale
  // SIGNED_IN event from admitting an account that has already signed out or
  // been replaced while hydration was in progress.
  useEffect(() => {
    const wasLoading = hydrationWasLoadingRef.current;
    hydrationWasLoadingRef.current = isLoading;
    if (isLoading || !wasLoading || !supabase) return;

    let active = true;

    const resumeCurrentSessionAfterHydration = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!active) return;
        if (error) throw error;

        const syncCurrentSession = syncIfNeededRef.current;
        if (!data.session) {
          await syncCurrentSession?.(null);
          if (active) setHasValidSession(false);
          return;
        }
        if (!syncCurrentSession) return;

        await syncCurrentSession(data.session.user.id);
        if (!active) return;
        await finalizeAdmittedSessionRef.current?.(data.session, true);
      } catch (error) {
        if (!active) return;
        logger.warn("[Auth] Session retry after hydration failed:", error);
        setHasValidSession(null);
      }
    };

    void resumeCurrentSessionAfterHydration();
    return () => {
      active = false;
    };
  }, [isLoading, setHasValidSession]);

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
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          throw error;
        }
        if (data.session) {
          logger.log("[Index] Session still valid, ignoring expired event");
          return;
        }
      } catch (error) {
        logger.error("[Index] Error checking session:", error);
        setHasValidSession(null);
        return;
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
