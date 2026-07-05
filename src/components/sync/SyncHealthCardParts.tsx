import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  CloudOff,
  Loader2,
  WifiOff,
} from "lucide-react";
import type { OfflineAction } from "@/lib/offlineQueue";
import type { SyncHealthReceipt } from "@/observability/syncHealthRecorder";

export type SyncHealthState = "synced" | "syncing" | "pending" | "offline" | "paused" | "error";

export const MAX_RECENT_RECEIPTS = 4;
export const MAX_PENDING_ROWS = 3;

export const SYNC_HEALTH_SURFACE_CLASS = {
  default: "border-border bg-card",
  "settings-space": "border-[hsl(var(--zf-role-space)/0.24)] bg-[hsl(var(--card)/0.76)]",
} satisfies Record<string, string>;

export const STATUS_META: Record<
  SyncHealthState,
  {
    icon: typeof Cloud;
    className: string;
    fallback: string;
  }
> = {
  synced: {
    icon: CheckCircle2,
    className: "bg-primary/10 text-primary border-primary/25",
    fallback: "Up to date",
  },
  syncing: {
    icon: Loader2,
    className: "bg-primary/10 text-primary border-primary/25",
    fallback: "Updating",
  },
  pending: {
    icon: Cloud,
    className: "bg-muted text-foreground border-border",
    fallback: "Waiting",
  },
  offline: {
    icon: WifiOff,
    className: "bg-muted text-muted-foreground border-border",
    fallback: "Offline",
  },
  paused: {
    icon: CloudOff,
    className: "bg-muted text-muted-foreground border-border",
    fallback: "Paused",
  },
  error: {
    icon: AlertCircle,
    className: "bg-destructive/10 text-destructive border-destructive/25",
    fallback: "Needs attention",
  },
};

export function formatTime(value: number | null, locale: string): string {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleTimeString();
  }
}

export function actionDomainLabel(
  actionType: string | undefined,
  tx: Record<string, string>
): string {
  if (!actionType) return tx.syncDomainDefault || "Update";
  if (actionType.includes("MOOD")) return tx.syncDomainMood || "Mood";
  if (actionType.includes("HABIT")) return tx.syncDomainHabits || "Habits";
  if (actionType.includes("JOURNAL")) return tx.syncDomainJournal || "Journal";
  if (actionType.includes("FOCUS")) return tx.syncDomainFocus || "Focus";
  if (actionType.includes("GRATITUDE")) return tx.syncDomainGratitude || "Gratitude";
  if (actionType.includes("SETTINGS")) return tx.syncDomainSettings || "Settings";
  if (actionType.includes("SYNC_EVENT")) return tx.syncDomainEvent || "Update event";
  return tx.syncDomainDefault || "Update";
}

export function renderTemplate(
  template: string,
  values: Record<string, string | number>
): string {
  return Object.entries(values).reduce(
    (next, [key, value]) => next.split(`{${key}}`).join(String(value)),
    template
  );
}

export function receiptText(
  receipt: SyncHealthReceipt | null,
  tx: Record<string, string>
): string {
  if (!receipt) return tx.syncReady || "Ready";
  const domain = actionDomainLabel(receipt.actionType, tx);
  switch (receipt.kind) {
    case "queued":
      return renderTemplate(tx.syncActionSavedLocal || "{domain} saved on this device", { domain });
    case "processed":
      return renderTemplate(tx.syncActionSynced || "{domain} saved online", { domain });
    case "failed":
      return renderTemplate(tx.syncActionNeedsRetry || "{domain} needs another try", { domain });
    case "delta-applied":
      return receipt.applied
        ? tx.syncActionCloudApplied || "Account updates applied"
        : tx.syncActionUpToDate || "Already up to date";
    case "gap-recovered":
      return tx.syncActionGapRecovered || "Missing updates restored";
    case "leader-skipped":
      return tx.syncActionAnotherTab || "Another ZenFlow window is updating";
    case "queue-draining":
      return tx.syncActionQueueDraining || "Sending saved actions";
    case "queue-drained":
      return tx.syncActionQueueDrained || "Saved actions sent";
    case "queue-blocked":
      return tx.syncActionQueueBlocked || "Saved actions need attention";
    case "session-missing":
      return tx.syncActionSignIn || "Sign in to keep devices updated";
    case "offline":
      return tx.syncActionWaitingConnection || "Waiting for connection";
    case "error":
      return tx.syncActionNeedsAttention || "Device updates need attention";
    default:
      return tx.syncActionUpdated || "Updates changed";
  }
}

export function pendingActionText(action: OfflineAction, tx: Record<string, string>): string {
  const domain = actionDomainLabel(action.type, tx);
  if (action.lastError) {
    return renderTemplate(tx.syncActionNeedsRetry || "{domain} needs another try", { domain });
  }
  return renderTemplate(tx.syncActionSavedLocal || "{domain} saved on this device", { domain });
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/45 px-3 py-2">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
