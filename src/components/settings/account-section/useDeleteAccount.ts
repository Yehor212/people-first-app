import { useCallback, useEffect, useRef, useState } from "react";
import { performOwnerSafeAccountDeletion } from "@/lib/accountSignOutCleanup";
import { logger } from "@/lib/logger";
import { initializePushNotifications } from "@/lib/pushNotifications";
import { useUserDataStore } from "@/stores";

interface UseDeleteAccountOptions {
  t: Record<string, string>;
  activeUserId: string | null;
}

export function useDeleteAccount({ t, activeUserId }: UseDeleteAccountOptions) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePromptOwnerUserId, setDeletePromptOwnerUserId] = useState<
    string | null
  >(null);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const activeUserIdRef = useRef(activeUserId);
  activeUserIdRef.current = activeUserId;
  const pushNotificationsEnabled = useUserDataStore(
    (state) => state.privacy.pushNotifications === true,
  );
  const deleteConfirmWord = (t.deleteConfirmWord || "DELETE").trim();
  const deleteConfirmMatches = deleteConfirmInput.trim() === deleteConfirmWord;

  const clearDeleteConfirmation = useCallback(() => {
    setShowDeleteConfirm(false);
    setDeleteConfirmInput("");
    setDeletePromptOwnerUserId(null);
  }, []);

  const openDeleteConfirmation = useCallback(() => {
    if (!activeUserId) {
      clearDeleteConfirmation();
      setDeleteStatus(t.deleteAccountError);
      return false;
    }

    setDeletePromptOwnerUserId(activeUserId);
    setDeleteConfirmInput("");
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

    setIsDeletingAccount(true);
    setDeleteStatus(null);
    try {
      const result = await performOwnerSafeAccountDeletion(
        expectedOwnerUserId,
        {
          restorePushRegistration: pushNotificationsEnabled
            ? initializePushNotifications
            : undefined,
        },
      );

      const activeOwnerAfterDeletion = activeUserIdRef.current;
      const expectedSessionClearedAfterConfirmedDeletion =
        activeOwnerAfterDeletion === null && result.remoteDeletion === "confirmed";
      if (
        activeOwnerAfterDeletion !== expectedOwnerUserId &&
        !expectedSessionClearedAfterConfirmedDeletion
      ) {
        clearDeleteConfirmation();
        setDeleteStatus(null);
        return;
      }

      if (result.status === "deleted") {
        clearDeleteConfirmation();
        setDeleteStatus(t.deleteAccountSuccess);
        return;
      }

      if (
        result.status === "cleanup-failed" &&
        result.remoteDeletion === "confirmed"
      ) {
        clearDeleteConfirmation();
        setDeleteStatus(
          t.deleteAccountDeletedCleanupFailed || t.deleteAccountError,
        );
        return;
      }

      if (result.remoteDeletion === "unknown") {
        setDeleteStatus(
          t.deleteAccountOutcomeUnknown ||
            "We couldn’t confirm whether account deletion finished. Try again to check and finish it.",
        );
        return;
      }

      if (
        result.status === "session-changed" ||
        result.status === "no-session"
      ) {
        clearDeleteConfirmation();
      }

      setDeleteStatus(t.deleteAccountError);
    } catch (error) {
      if (activeUserIdRef.current !== expectedOwnerUserId) {
        clearDeleteConfirmation();
        setDeleteStatus(null);
        return;
      }
      logger.error("[AccountSection] Delete account failed:", error);
      setDeleteStatus(
        t.deleteAccountOutcomeUnknown ||
          "We couldn’t confirm whether account deletion finished. Try again to check and finish it.",
      );
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
