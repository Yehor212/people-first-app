import { memo } from "react";
import { Cloud, CloudOff, Loader2, AlertCircle, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

export type SyncStatus = "synced" | "syncing" | "pending" | "offline" | "not-signed-in" | "error";

interface SyncStatusBadgeProps {
  status: SyncStatus;
  lastSyncAt?: Date;
  className?: string;
}

const STATUS_CONFIG: Record<
  SyncStatus,
  {
    icon: typeof Cloud;
    colorClass: string;
    pulseClass: string;
    labelKey: string;
    fallbackLabel: string;
  }
> = {
  synced: {
    icon: Cloud,
    colorClass: "text-green-500",
    pulseClass: "motion-safe:animate-pulse",
    labelKey: "syncStatusSynced",
    fallbackLabel: "Up to date",
  },
  syncing: {
    icon: Loader2,
    colorClass: "text-yellow-500",
    pulseClass: "animate-spin",
    labelKey: "syncStatusSyncing",
    fallbackLabel: "Updating...",
  },
  pending: {
    icon: Cloud,
    colorClass: "text-orange-500",
    pulseClass: "",
    labelKey: "syncStatusPending",
    fallbackLabel: "Changes pending",
  },
  offline: {
    icon: CloudOff,
    colorClass: "text-red-500",
    pulseClass: "",
    labelKey: "syncStatusOffline",
    fallbackLabel: "Offline",
  },
  "not-signed-in": {
    icon: UserX,
    colorClass: "text-muted-foreground",
    pulseClass: "",
    labelKey: "syncStatusNotSignedIn",
    fallbackLabel: "Not signed in",
  },
  error: {
    icon: AlertCircle,
    colorClass: "text-destructive",
    pulseClass: "",
    labelKey: "syncStatusError",
    fallbackLabel: "Sync error",
  },
};

/**
 * Sync status indicator — shows current sync state.
 * 5 states: synced (green pulse), syncing (yellow spin), pending (orange),
 * offline (red), not signed in (gray), error (destructive).
 */
/** Format relative time without external dependency */
function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const SyncStatusBadge = memo(function SyncStatusBadge({
  status,
  lastSyncAt,
  className,
}: SyncStatusBadgeProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  const timeLabel = status === "synced" && lastSyncAt ? ` · ${formatRelativeTime(lastSyncAt)}` : "";

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      role="status"
      aria-live="polite"
      aria-label={`${ts[config.labelKey] || config.fallbackLabel}${timeLabel}`}
    >
      <Icon
        className={cn("w-3.5 h-3.5", config.colorClass, config.pulseClass)}
        aria-hidden="true"
      />
      <span className={cn("text-xs", config.colorClass)}>
        {ts[config.labelKey] || config.fallbackLabel}
        {timeLabel && <span className="text-muted-foreground">{timeLabel}</span>}
      </span>
    </div>
  );
});
