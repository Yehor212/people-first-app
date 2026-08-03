/**
 * SyncStatusIndicator - Visual sync status display
 *
 * Shows:
 * - Cloud icon with status colors (green/yellow/red)
 * - "Syncing..." animation
 * - Last sync timestamp
 * - Current sync operation
 */

import { useSyncOrchestrator } from "@/lib/syncOrchestrator";
import { useLanguage } from "@/contexts/LanguageContext";
import { isCloudSyncEnabled } from "@/lib/cloudSyncSettings";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { useAppStore } from "@/stores";
import { Cloud, CloudOff, AlertCircle, CheckCircle, Loader, WifiOff } from "lucide-react";
import { getLocale } from "@/lib/timeUtils";

export function SyncStatusIndicator() {
  const { state } = useSyncOrchestrator();
  const { t, language } = useLanguage();

  // Don't show if never synced and queue is empty
  if (!state.lastSyncTime && state.queueLength === 0 && state.status === "idle") {
    return null;
  }

  // Get icon and color based on status
  const getStatusIcon = () => {
    // Check if cloud sync is disabled by user
    if (!isCloudSyncEnabled()) {
      return { Icon: CloudOff, color: "text-muted-foreground", bgColor: "bg-muted/50" };
    }

    if (!state.isOnline) {
      return { Icon: CloudOff, color: "text-muted-foreground", bgColor: "bg-muted" };
    }

    switch (state.status) {
      case "syncing":
        return {
          Icon: Loader,
          color: "text-blue-500 dark:text-blue-400",
          bgColor: "bg-blue-50 dark:bg-blue-500/10",
          animate: true,
        };
      case "success":
        return {
          Icon: CheckCircle,
          color: "text-green-500 dark:text-green-400",
          bgColor: "bg-green-50 dark:bg-green-500/10",
        };
      case "error":
      case "conflict":
        return {
          Icon: AlertCircle,
          color: "text-red-500 dark:text-red-400",
          bgColor: "bg-red-50 dark:bg-red-500/10",
        };
      default:
        return { Icon: Cloud, color: "text-muted-foreground", bgColor: "bg-muted" };
    }
  };

  const { Icon, color, bgColor, animate } = getStatusIcon();

  // Format last sync time using native Intl (eliminates 178kB date-fns dep)
  const getLastSyncText = () => {
    if (!state.lastSyncTime) return null;

    try {
      const seconds = Math.round((state.lastSyncTime - Date.now()) / 1000);
      const absSeconds = Math.abs(seconds);
      let value: number;
      let unit: Intl.RelativeTimeFormatUnit;

      if (absSeconds < 60) {
        value = seconds;
        unit = "second";
      } else if (absSeconds < 3600) {
        value = Math.round(seconds / 60);
        unit = "minute";
      } else if (absSeconds < 86400) {
        value = Math.round(seconds / 3600);
        unit = "hour";
      } else {
        value = Math.round(seconds / 86400);
        unit = "day";
      }

      const rtf = new Intl.RelativeTimeFormat(getLocale(language), { numeric: "auto" });
      return rtf.format(value, unit);
    } catch {
      return new Date(state.lastSyncTime).toLocaleTimeString(getLocale(language));
    }
  };

  // Get status text
  const getStatusText = () => {
    // Check if cloud sync is disabled by user
    if (!isCloudSyncEnabled()) {
      return t.settingsCloudSyncDisabledByUser || "Online backup is paused";
    }

    if (!state.isOnline) {
      return t.syncOffline || "Offline";
    }

    if (state.status === "syncing" && state.currentOperation) {
      const operationName = getSyncOperationName(state.currentOperation);
      return t.syncSyncing || `Updating ${operationName}...`;
    }

    if (state.status === "error") {
      return t.syncError || "Could not update devices";
    }

    if (state.lastSyncTime) {
      const timeText = getLastSyncText();
      return `${t.syncLastSync || "Last updated"} ${timeText}`;
    }

    return t.syncReady || "Ready to update devices";
  };

  // Get friendly sync operation names
  const getSyncOperationName = (operation: string) => {
    const names: Record<string, string> = {
      backup: t.syncBackup || "backup",
      reminders: t.syncReminders || "reminders",
      challenges: t.syncChallenges || "challenges",
      tasks: t.syncTasks || "tasks",
      innerWorld: t.syncInnerWorld || "progress",
      badges: t.syncBadges || "badges",
    };
    return names[operation] || operation;
  };

  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-1.5 zen-shadow-sm">
      {/* Icon */}
      <div className={`p-1 rounded-md ${bgColor}`}>
        <Icon className={`w-4 h-4 ${color} ${animate ? "motion-safe:animate-spin" : ""}`} />
      </div>

      {/* Status text */}
      <div className="min-w-0 flex-1">
        <span className="block whitespace-normal break-words text-xs font-medium text-foreground">
          {getStatusText()}
        </span>

        {/* Queue info */}
        {state.queueLength > 0 && (
          <span className="block whitespace-normal break-words text-xs text-muted-foreground">
            {state.queueLength} {t.syncPending || "pending"}
          </span>
        )}

        {/* Error message */}
        {state.status === "error" && (
          <span className="block whitespace-normal break-words text-xs text-red-500">
            {t.syncError}
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
  const hasSession = useAppStore((s) => s.hasValidSession);

  // Session expired: sync is enabled but no valid session
  if (isCloudSyncEnabled() && hasSession === false) {
    return (
      <div className="relative" aria-label={t.sessionExpired || "Account update paused"}>
        <CloudOff className="w-5 h-5 text-amber-500" />
        <span
          className="absolute -end-2 -top-2 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 py-0.5 text-xs font-bold leading-none text-white"
          aria-hidden="true"
        >
          !
        </span>
      </div>
    );
  }

  // Check if cloud sync is disabled by user
  if (!isCloudSyncEnabled()) {
    return (
      <CloudOff
        className="w-5 h-5 text-muted-foreground"
        aria-label={t.cloudSyncDisabled || "Sync disabled"}
      />
    );
  }

  // Offline with pending actions
  if (!isOnline && pendingCount > 0) {
    return (
      <div className="relative" aria-label={`${t.syncOffline || "Offline"} - ${pendingCount}`}>
        <WifiOff className="w-5 h-5 text-amber-500" />
        <span
          className="absolute -end-2 -top-2 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 py-0.5 text-xs font-bold leading-none text-white"
          aria-hidden="true"
        >
          {pendingCount > 9 ? "9+" : pendingCount}
        </span>
      </div>
    );
  }

  // Offline without pending
  if (!isOnline || !state.isOnline) {
    return (
      <WifiOff className="w-5 h-5 text-muted-foreground" aria-label={t.syncOffline || "Offline"} />
    );
  }

  // Processing offline queue
  if (isProcessing) {
    return (
      <div className="relative" aria-label={`${t.syncSyncing || "Updating"} ${pendingCount}`}>
        <Loader className="w-5 h-5 text-blue-500 motion-safe:animate-spin" />
        {pendingCount > 0 && (
          <span
            className="absolute -end-2 -top-2 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1 py-0.5 text-xs font-bold leading-none text-white"
            aria-hidden="true"
          >
            {pendingCount > 9 ? "9+" : pendingCount}
          </span>
        )}
      </div>
    );
  }

  switch (state.status) {
    case "syncing":
      return (
        <Loader
          className="w-5 h-5 text-blue-500 motion-safe:animate-spin"
          aria-label={t.syncSyncing || "Updating"}
        />
      );
    case "success":
      return <Cloud className="w-5 h-5 text-green-500" aria-label={t.syncSuccess || "Up to date"} />;
    case "error":
    case "conflict":
      return (
        <AlertCircle className="w-5 h-5 text-red-500" aria-label={t.syncError || "Could not update devices"} />
      );
    default:
      return (
        <Cloud className="w-5 h-5 text-muted-foreground" aria-label={t.syncReady || "Ready"} />
      );
  }
}
