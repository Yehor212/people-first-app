import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { deleteAccount } from '@/lib/accountService';
import { logger } from '@/lib/logger';

interface UseDeleteAccountOptions {
  onResetData: () => void | Promise<void>;
  t: Record<string, string>;
}

export function useDeleteAccount({ onResetData, t }: UseDeleteAccountOptions) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Auto-clear delete status after 3s
  useEffect(() => {
    if (!deleteStatus) return;
    const timer = window.setTimeout(() => setDeleteStatus(null), 3000);
    return () => window.clearTimeout(timer);
  }, [deleteStatus]);

  const handleDeleteAccount = async () => {
    if (!supabase) {
      setDeleteStatus(t.deleteAccountError);
      return;
    }
    setIsDeletingAccount(true);
    setDeleteStatus(null);
    try {
      const result = await deleteAccount();
      if (!result.success) throw new Error(result.error || 'Delete failed');
      await onResetData();
      setShowDeleteConfirm(false);
      setDeleteStatus(t.deleteAccountSuccess);
    } catch (error) {
      logger.error('[AccountSection] Delete account failed:', error);
      setDeleteStatus(t.deleteAccountError);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return {
    showDeleteConfirm,
    setShowDeleteConfirm,
    deleteStatus,
    deleteConfirmInput,
    setDeleteConfirmInput,
    isDeletingAccount,
    handleDeleteAccount,
  };
}
