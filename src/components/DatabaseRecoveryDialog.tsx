/**
 * DatabaseRecoveryDialog
 *
 * Shows when IndexedDB needs recovery (e.g., after user cleared browser data).
 * Offers options to restore from cloud or start fresh.
 */

import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { Database, CloudDownload, RefreshCw } from 'lucide-react';
import { pullFromCloud } from '@/storage/realtimeSync';
import { getCurrentUserId } from '@/lib/supabaseClient';
import { toast } from 'sonner';

export function DatabaseRecoveryDialog() {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    const handleRecoveryNeeded = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      console.log('[DatabaseRecovery] Recovery needed:', detail);
      setIsOpen(true);
    };

    const handleRecoveryFailed = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      console.error('[DatabaseRecovery] Recovery failed:', detail);
      toast.error(t.storageError || 'Storage error', {
        description: t.storageErrorDesc || 'Could not recover local database.',
      });
    };

    window.addEventListener('zenflow:database-recovery-needed', handleRecoveryNeeded);
    window.addEventListener('zenflow:database-recovery-failed', handleRecoveryFailed);

    return () => {
      window.removeEventListener('zenflow:database-recovery-needed', handleRecoveryNeeded);
      window.removeEventListener('zenflow:database-recovery-failed', handleRecoveryFailed);
    };
  }, [t]);

  const handleRestoreFromCloud = async () => {
    setIsRestoring(true);
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        toast.error(t.syncError || 'Sync error', {
          description: t.authRequired || 'Please sign in to restore from cloud.',
        });
        setIsOpen(false);
        return;
      }

      const success = await pullFromCloud();
      if (success) {
        toast.success(t.syncPulled || 'Data restored from cloud');
      } else {
        toast.error(t.syncError || 'Sync error', {
          description: t.syncFailedLocal || 'Could not restore data from cloud.',
        });
      }
    } catch (error) {
      console.error('[DatabaseRecovery] Restore failed:', error);
      toast.error(t.syncError || 'Sync error');
    } finally {
      setIsRestoring(false);
      setIsOpen(false);
    }
  };

  const handleStartFresh = () => {
    // Just close the dialog - app will continue with empty local DB
    setIsOpen(false);
    toast.info(t.databaseRecoveryStartFresh || 'Starting fresh', {
      description: t.databaseRecoveryStartFreshDesc || 'Local data has been reset.',
    });
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-amber-500/10">
              <Database className="h-6 w-6 text-amber-500" />
            </div>
            <AlertDialogTitle>
              {t.databaseRecoveryTitle || 'Local data was reset'}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left">
            {t.databaseRecoveryDesc ||
              'Your local storage was cleared (possibly from clearing browser data). We can try to restore your data from the cloud if you have an account.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel
            onClick={handleStartFresh}
            disabled={isRestoring}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            {t.databaseRecoveryStartFresh || 'Start fresh'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRestoreFromCloud}
            disabled={isRestoring}
            className="flex items-center gap-2"
          >
            {isRestoring ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <CloudDownload className="h-4 w-4" />
            )}
            {isRestoring
              ? (t.syncSyncing || 'Restoring...')
              : (t.databaseRecoveryRestore || 'Restore from cloud')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
