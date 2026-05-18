import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  CloudOff,
  Loader2,
  RefreshCw,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { isCloudSyncEnabled } from "@/lib/cloudSyncSettings";
import { useSyncOrchestrator } from "@/lib/syncOrchestrator";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores";
import {
  SYNC_HEALTH_RECEIPT_EVENT,
  type SyncHealthReceipt,
} from "@/observability/syncHealthRecorder";

type SyncHealthState = "synced" | "syncing" | "pending" | "offline" | "paused" | "error";

interface SyncHealthCardProps {
  className?: string;
  dense?: boolean;
}

const STATUS_META: Record<
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
    fallback: "Synced",
  },
  syncing: {
    icon: Loader2,
    className: "bg-primary/10 text-primary border-primary/25",
    fallback: "Syncing",
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

function formatTime(value: number | null, locale: string): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleTimeString();
  }
}

function actionDomainLabel(actionType: string | undefined): string {
  if (!actionType) return "Sync";
  if (actionType.includes("MOOD")) return "Mood";
  if (actionType.includes("HABIT")) return "Habits";
  if (actionType.includes("JOURNAL")) return "Journal";
  if (actionType.includes("FOCUS")) return "Focus";
  if (actionType.includes("GRATITUDE")) return "Gratitude";
  if (actionType.includes("SETTINGS")) return "Settings";
  if (actionType.includes("SYNC_EVENT")) return "Sync event";
  return "Sync";
}

function receiptText(receipt: SyncHealthReceipt | null): string {
  if (!receipt) return "Ready";
  const domain = actionDomainLabel(receipt.actionType);
  switch (receipt.kind) {
    case "queued":
      return `${domain} saved locally`;
    case "processed":
      return `${domain} synced`;
    case "failed":
      return `${domain} needs retry`;
    case "delta-applied":
      return receipt.applied ? "Cloud changes applied" : "Already up to date";
    case "gap-recovered":
      return "Sync gap recovered";
    case "leader-skipped":
      return "Another tab is syncing";
    case "session-missing":
      return "Sign in to sync";
    case "offline":
      return "Waiting for connection";
    case "error":
      return "Sync needs attention";
    default:
      return "Sync updated";
  }
}

export function SyncHealthCard({ className, dense = false }: SyncHealthCardProps) {
  const { t, language } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const { state: orchestratorState } = useSyncOrchestrator();
  const {
    actions,
    pendingCount,
    isOnline,
    isProcessing,
    lastProcessedAt,
    processQueue,
  } = useOfflineQueue();
  const hasValidSession = useAppStore((s) => s.hasValidSession);
  const [lastReceipt, setLastReceipt] = useState<SyncHealthReceipt | null>(() => {
    if (typeof window === "undefined") return null;
    return window.__zenflowSyncHealth?.snapshot().lastReceipt ?? null;
  });

  useEffect(() => {
    const handleReceipt = (event: Event) => {
      const detail = (event as CustomEvent<Partial<SyncHealthReceipt>>).detail;
      if (!detail?.kind || !detail.source) return;
      setLastReceipt({
        ...detail,
        at: detail.at ?? Date.now(),
        route:
          detail.route ??
          `${window.location.pathname}${window.location.search}`,
      } as SyncHealthReceipt);
    };

    window.addEventListener(SYNC_HEALTH_RECEIPT_EVENT, handleReceipt);
    return () => window.removeEventListener(SYNC_HEALTH_RECEIPT_EVENT, handleReceipt);
  }, []);

  const cloudEnabled = isCloudSyncEnabled();
  const criticalPending = useMemo(
    () => actions.filter((action) => action.priority === "critical").length,
    [actions],
  );
  const failedPending = useMemo(
    () => actions.filter((action) => Boolean(action.lastError)).length,
    [actions],
  );

  const status: SyncHealthState = useMemo(() => {
    if (!supabase || !cloudEnabled || hasValidSession === false) return "paused";
    if (!isOnline || !orchestratorState.isOnline) return "offline";
    if (failedPending > 0 || orchestratorState.status === "error") return "error";
    if (isProcessing || orchestratorState.status === "syncing") return "syncing";
    if (pendingCount > 0 || orchestratorState.queueLength > 0) return "pending";
    return "synced";
  }, [
    cloudEnabled,
    failedPending,
    hasValidSession,
    isOnline,
    isProcessing,
    orchestratorState.isOnline,
    orchestratorState.queueLength,
    orchestratorState.status,
    pendingCount,
  ]);

  const meta = STATUS_META[status];
  const Icon = meta.icon;
  const latestQueuedAt = useMemo(
    () => actions.reduce<number | null>((latest, action) => Math.max(latest ?? 0, action.timestamp), null),
    [actions],
  );
  const lastActivityAt = lastReceipt?.at ?? latestQueuedAt ?? lastProcessedAt ?? null;
  const statusLabel =
    status === "synced"
      ? tx.syncSuccess || meta.fallback
      : status === "syncing"
        ? tx.syncNow || meta.fallback
        : status === "pending"
          ? tx.syncPending || meta.fallback
          : status === "offline"
            ? tx.syncOffline || meta.fallback
            : status === "error"
              ? tx.syncError || meta.fallback
              : tx.sessionExpired || tx.cloudSyncDisabled || meta.fallback;

  const canRetry = cloudEnabled && isOnline && pendingCount > 0 && !isProcessing;

  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card p-5 shadow-[var(--zen-shadow-card)]",
        dense && "p-4",
        className,
      )}
      data-testid="sync-health-card"
      aria-labelledby="sync-health-card-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 id="sync-health-card-title" className="text-base font-semibold text-foreground">
              {tx.settingsCloudSyncTitle || "Cloud sync"}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {tx.settingsCloudSyncDescription || "Sync your data across devices."}
            </p>
          </div>
        </div>

        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
            meta.className,
          )}
          role="status"
          aria-live="polite"
        >
          <Icon
            className={cn("h-3.5 w-3.5", status === "syncing" && "motion-safe:animate-spin")}
            aria-hidden="true"
          />
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2" data-testid="sync-health-metrics">
        <Metric label={tx.syncPending || "Waiting"} value={String(pendingCount)} />
        <Metric label={tx.syncPriority || "Important"} value={String(criticalPending)} />
        <Metric label={tx.syncLastSync || "Last sync"} value={formatTime(lastActivityAt, language)} />
      </div>

      <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {tx.syncLatestAction || "Latest action"}
        </p>
        <p className="mt-1 text-sm font-medium text-foreground" data-testid="sync-health-receipt">
          {receiptText(lastReceipt)}
        </p>
        {failedPending > 0 && (
          <p className="mt-1 text-xs text-destructive">
            {tx.syncRetryHint || "Some local actions need another sync attempt."}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          void processQueue();
        }}
        disabled={!canRetry}
        className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground motion-safe:transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-55"
        aria-label={tx.syncNow || "Sync now"}
      >
        <RefreshCw className={cn("h-4 w-4", isProcessing && "motion-safe:animate-spin")} aria-hidden="true" />
        {tx.syncNow || "Sync now"}
      </button>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/45 px-3 py-2">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
