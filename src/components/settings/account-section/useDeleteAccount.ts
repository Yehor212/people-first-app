import { useCallback, useEffect, useState } from 'react';
import { getCurrentSessionUserId, supabase } from '@/lib/supabaseClient';
import { deleteAccount } from '@/lib/accountService';
import { logger } from '@/lib/logger';
import { clearJournalContentSession } from '@/lib/journalContentSession';
import {
  quiesceCloudSync,
  resumeCloudSync,
  startAutoSync,
} from '@/storage/cloudSync';
import { removePushToken } from '@/lib/pushNotifications';
import { offlineQueue } from '@/lib/offlineQueue';
import { clearNativeJournalBiometricCredential } from '@/lib/journalBiometricCredentials';
import {
  clearAccountNotificationsForBoundary,
  resumeAccountNotifications,
} from '@/lib/localNotifications';
import { clearAccountDeviceSurfaces } from '@/lib/accountDeviceCleanup';

interface UseDeleteAccountOptions {
  onResetData: () => void | Promise<void>;
  t: Record<string, string>;
  activeUserId: string | null;
}

export function useDeleteAccount({ onResetData, t, activeUserId }: UseDeleteAccountOptions) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePromptOwnerUserId, setDeletePromptOwnerUserId] = useState<string | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const deleteConfirmWord = (t.deleteConfirmWord || 'DELETE').trim();
  const deleteConfirmMatches = deleteConfirmInput.trim() === deleteConfirmWord;

  const clearDeleteConfirmation = useCallback(() => {
    setShowDeleteConfirm(false);
    setDeleteConfirmInput('');
    setDeletePromptOwnerUserId(null);
  }, []);

  const openDeleteConfirmation = useCallback(() => {
    if (!activeUserId) {
      clearDeleteConfirmation();
      setDeleteStatus(t.deleteAccountError);
      return false;
    }

    setDeletePromptOwnerUserId(activeUserId);
    setDeleteConfirmInput('');
    setDeleteStatus(null);
    setShowDeleteConfirm(true);
    return true;
  }, [activeUserId, clearDeleteConfirmation, t.deleteAccountError]);

  const closeDeleteConfirmation = useCallback(() => {
    if (isDeletingAccount) return false;
    clearDeleteConfirmation();
    return true;
  }, [clearDeleteConfirmation, isDeletingAccount]);

  useEffect(() => {
    if (!showDeleteConfirm || deletePromptOwnerUserId === activeUserId) return;
    if (isDeletingAccount) return;
    clearDeleteConfirmation();
    setDeleteStatus(t.deleteAccountError);
  }, [
    activeUserId,
    clearDeleteConfirmation,
    deletePromptOwnerUserId,
    isDeletingAccount,
    showDeleteConfirm,
    t.deleteAccountError,
  ]);

  const handleDeleteAccount = async () => {
    const expectedOwnerUserId = deletePromptOwnerUserId;
    if (
      !showDeleteConfirm ||
      !expectedOwnerUserId ||
      activeUserId !== expectedOwnerUserId ||
      !deleteConfirmMatches
    ) {
      clearDeleteConfirmation();
      setDeleteStatus(t.deleteAccountError);
      return;
    }
    if (!supabase) {
      setDeleteStatus(t.deleteAccountError);
      return;
    }

    let authoritativeOwnerUserId: string | null = null;
    try {
      authoritativeOwnerUserId = await getCurrentSessionUserId();
    } catch (error) {
      logger.error('[AccountSection] Could not verify account before deletion:', error);
    }
    if (authoritativeOwnerUserId !== expectedOwnerUserId) {
      logger.warn?.(
        '[AccountSection] Account changed after deletion confirmation; request cancelled',
      );
      clearDeleteConfirmation();
      setDeleteStatus(t.deleteAccountError);
      return;
    }

    setIsDeletingAccount(true);
    setDeleteStatus(null);
    let cleanupFailed = false;
    let cloudQuiesced = false;
    let queueSuspended = false;
    let remoteDeleted = false;

    const recoverWriters = () => {
      if (cloudQuiesced) {
        resumeCloudSync();
        startAutoSync();
        cloudQuiesced = false;
      }
      if (queueSuspended) {
        offlineQueue.resumeAfterAccountBoundary();
        queueSuspended = false;
      }
      resumeAccountNotifications();
    };

    try {
      await quiesceCloudSync();
      cloudQuiesced = true;
      await offlineQueue.suspendForAccountBoundary();
      queueSuspended = true;

      try {
        await clearAccountNotificationsForBoundary();
        await clearNativeJournalBiometricCredential();
        await clearAccountDeviceSurfaces();
      } catch (error) {
        logger.error(
          '[AccountSection] Native journal credential cleanup before account deletion failed:',
          error,
        );
        recoverWriters();
        setDeleteStatus(t.deleteAccountError);
        return;
      }

      if ((await getCurrentSessionUserId()) !== expectedOwnerUserId) {
        logger.warn?.('[AccountSection] Account changed before deletion; request cancelled');
        recoverWriters();
        setDeleteStatus(t.deleteAccountError);
        return;
      }

      try {
        const pushRevocation = await removePushToken();
        if (pushRevocation.status !== 'revoked') {
          cleanupFailed = true;
          logger.error('[AccountSection] Push cleanup before account deletion was incomplete:', {
            status: pushRevocation.status,
            remote: pushRevocation.remote,
            native: pushRevocation.native,
          });
        }
      } catch (error) {
        cleanupFailed = true;
        logger.error('[AccountSection] Push cleanup before account deletion failed:', error);
      }

      try {
        await clearAccountNotificationsForBoundary();
      } catch (error) {
        cleanupFailed = true;
        logger.error(
          '[AccountSection] Notification cleanup after push revocation failed:',
          error,
        );
      }

      const result = await deleteAccount(expectedOwnerUserId);
      if (result.status !== 'deleted') {
        recoverWriters();
        setDeleteStatus(t.deleteAccountError);
        return;
      }
      remoteDeleted = true;

      if ((await getCurrentSessionUserId()) !== expectedOwnerUserId) {
        logger.warn?.(
          '[AccountSection] Account changed after remote deletion; local cleanup skipped',
        );
        clearDeleteConfirmation();
        setDeleteStatus(t.deleteAccountDeletedCleanupFailed || t.deleteAccountError);
        return;
      }

      try {
        await clearAccountNotificationsForBoundary();
      } catch (error) {
        cleanupFailed = true;
        logger.error(
          '[AccountSection] Final notification cleanup after account deletion failed:',
          error,
        );
      }

      try {
        await offlineQueue.discardSuspendedActionsForAccountBoundary();
      } catch (error) {
        cleanupFailed = true;
        logger.error('[AccountSection] Offline queue cleanup after account deletion failed:', error);
      }
      clearJournalContentSession('sign-out');
      try {
        const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
        if (signOutError) {
          cleanupFailed = true;
          logger.error('[AccountSection] Local sign-out after account deletion failed:', signOutError);
        }
      } catch (error) {
        cleanupFailed = true;
        logger.error('[AccountSection] Local sign-out after account deletion failed:', error);
      }

      try {
        await onResetData();
      } catch (error) {
        cleanupFailed = true;
        logger.error('[AccountSection] Device cleanup after account deletion failed:', error);
      }

      clearDeleteConfirmation();
      setDeleteStatus(
        cleanupFailed
          ? t.deleteAccountDeletedCleanupFailed || t.deleteAccountError
          : t.deleteAccountSuccess
      );
    } catch (error) {
      logger.error('[AccountSection] Delete account failed:', error);
      if (!remoteDeleted) recoverWriters();
      setDeleteStatus(t.deleteAccountError);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return {
    showDeleteConfirm,
    deleteStatus,
    deleteConfirmInput,
    setDeleteConfirmInput,
    deleteConfirmMatches,
    isDeletingAccount,
    openDeleteConfirmation,
    closeDeleteConfirmation,
    handleDeleteAccount,
  };
}
