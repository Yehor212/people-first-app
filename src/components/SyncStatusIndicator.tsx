/**
 * SyncStatusIndicator - Visual sync status display
 *
 * Shows:
 * - Cloud icon with status colors (green/yellow/red)
 * - "Syncing..." animation
 * - Last sync timestamp
 * - Current sync operation
 */

import { useSyncOrchestrator } from '@/lib/syncOrchestrator';
import { useLanguage } from '@/contexts/LanguageContext';
import { isCloudSyncEnabled } from '@/lib/cloudSyncSettings';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { Cloud, CloudOff, AlertCircle, CheckCircle, Loader, WifiOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru, enUS, uk, es, de, fr } from 'date-fns/locale';
import { getLocale } from '@/lib/timeUtils';

const localeMap = {
  ru,
  en: enUS,
  uk,
  es,
  de,
  fr,
};

export function SyncStatusIndicator() {
  const { state } = useSyncOrchestrator();
  const { t, language } = useLanguage();

  // Don't show if never synced and queue is empty
  if (!state.lastSyncTime && state.queueLength === 0 && state.status === 'idle') {
    return null;
  }

  // Get icon and color based on status
  const getStatusIcon = () => {
    // Check if cloud sync is disabled by user
    if (!isCloudSyncEnabled()) {
      return { Icon: CloudOff, color: 'text-muted-foreground', bgColor: 'bg-muted/50' };
    }

    if (!state.isOnline) {
      return { Icon: CloudOff, color: 'text-gray-400', bgColor: 'bg-gray-100' };
    }

    switch (state.status) {
      case 'syncing':
        return { Icon: Loader, color: 'text-blue-500', bgColor: 'bg-blue-50', animate: true };
      case 'success':
        return { Icon: CheckCircle, color: 'text-green-500', bgColor: 'bg-green-50' };
      case 'error':
      case 'conflict':
        return { Icon: AlertCircle, color: 'text-red-500', bgColor: 'bg-red-50' };
      default:
        return { Icon: Cloud, color: 'text-gray-400', bgColor: 'bg-gray-100' };
    }
  };

  const { Icon, color, bgColor, animate } = getStatusIcon();

  // Format last sync time
  const getLastSyncText = () => {
    if (!state.lastSyncTime) return null;

    try {
      const locale = localeMap[language as keyof typeof localeMap] || enUS;
      return formatDistanceToNow(state.lastSyncTime, { addSuffix: true, locale });
    } catch {
      return new Date(state.lastSyncTime).toLocaleTimeString(getLocale(language));
    }
  };

  // Get status text
  const getStatusText = () => {
    // Check if cloud sync is disabled by user
    if (!isCloudSyncEnabled()) {
      return t.settingsCloudSyncDisabledByUser || 'Sync disabled';
    }

    if (!state.isOnline) {
      return t.syncOffline || 'Offline';
    }

    if (state.status === 'syncing' && state.currentOperation) {
      const operationName = getSyncOperationName(state.currentOperation);
      return t.syncSyncing || `Syncing ${operationName}...`;
    }

    if (state.status === 'error') {
      return t.syncError || 'Sync error';
    }

    if (state.lastSyncTime) {
      const timeText = getLastSyncText();
      return `${t.syncLastSync || 'Synced'} ${timeText}`;
    }

    return t.syncReady || 'Ready to sync';
  };

  // Get friendly sync operation names
  const getSyncOperationName = (operation: string) => {
    const names: Record<string, string> = {
      backup: t.syncBackup || 'backup',
      reminders: t.syncReminders || 'reminders',
      challenges: t.syncChallenges || 'challenges',
      tasks: t.syncTasks || 'tasks',
      innerWorld: t.syncInnerWorld || 'progress',
      badges: t.syncBadges || 'badges',
    };
    return names[operation] || operation;
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border zen-shadow-sm">
      {/* Icon */}
      <div className={`p-1 rounded-md ${bgColor}`}>
        <Icon
          className={`w-4 h-4 ${color} ${animate ? 'animate-spin' : ''}`}
        />
      </div>

      {/* Status text */}
      <div className="flex flex-col">
        <span className="text-xs font-medium text-foreground">
          {getStatusText()}
        </span>

        {/* Queue info */}
        {state.queueLength > 0 && (
          <span className="text-xs text-muted-foreground">
            {state.queueLength} {t.syncPending || 'pending'}
          </span>
        )}

        {/* Error message */}
        {state.status === 'error' && state.lastError && (
          <span className="text-xs text-red-500 line-clamp-1">
            {state.lastError}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Compact version for header
 * Shows sync status + offline queue pending count
 */
export function SyncStatusIndicatorCompact() {
  const { state } = useSyncOrchestrator();
  const { pendingCount, isOnline, isProcessing } = useOfflineQueue();
  const { t } = useLanguage();

  // Check if cloud sync is disabled by user
  if (!isCloudSyncEnabled()) {
    return (
      <CloudOff className="w-5 h-5 text-muted-foreground" aria-label={t.cloudSyncDisabled || 'Sync disabled'} />
    );
  }

  // Offline with pending actions
  if (!isOnline && pendingCount > 0) {
    return (
      <div className="relative" aria-label={`${t.syncOffline || 'Offline'} - ${pendingCount}`}>
        <WifiOff className="w-5 h-5 text-amber-500" />
        <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold" aria-hidden="true">
          {pendingCount > 9 ? '9+' : pendingCount}
        </span>
      </div>
    );
  }

  // Offline without pending
  if (!isOnline || !state.isOnline) {
    return (
      <WifiOff className="w-5 h-5 text-gray-400" aria-label={t.syncOffline || 'Offline'} />
    );
  }

  // Processing offline queue
  if (isProcessing) {
    return (
      <div className="relative" aria-label={`${t.syncSyncing || 'Syncing'} ${pendingCount}`}>
        <Loader className="w-5 h-5 text-blue-500 animate-spin" />
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold" aria-hidden="true">
            {pendingCount > 9 ? '9+' : pendingCount}
          </span>
        )}
      </div>
    );
  }

  switch (state.status) {
    case 'syncing':
      return (
        <Loader className="w-5 h-5 text-blue-500 animate-spin" aria-label={t.syncSyncing || 'Syncing'} />
      );
    case 'success':
      return (
        <Cloud className="w-5 h-5 text-green-500" aria-label={t.syncSuccess || 'Synced'} />
      );
    case 'error':
    case 'conflict':
      return (
        <AlertCircle className="w-5 h-5 text-red-500" aria-label={t.syncError || 'Sync error'} />
      );
    default:
      return (
        <Cloud className="w-5 h-5 text-gray-400" aria-label={t.syncReady || 'Ready'} />
      );
  }
}
