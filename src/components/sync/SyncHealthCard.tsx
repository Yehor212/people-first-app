import { useEffect, useMemo, useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { isCloudSyncEnabled } from "@/lib/cloudSyncSettings";
import { useSyncOrchestrator } from "@/lib/syncOrchestrator";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores";
import {
  SYNC_HEALTH_RECEIPT_EVENT,
  SYNC_HEALTH_RESET_EVENT,
  sanitizeSyncHealthReceipt,
  type SyncHealthReceipt,
} from "@/observability/syncHealthRecorder";
import {
  formatTime,
  MAX_PENDING_ROWS,
  MAX_RECENT_RECEIPTS,
  Metric,
  pendingActionText,
  receiptText,
  renderTemplate,
  STATUS_META,
  SYNC_HEALTH_SURFACE_CLASS,
  type SyncHealthState,
} from "./SyncHealthCardParts";

interface SyncHealthCardProps {
  dense?: boolean;
  compact?: boolean;
  showHeader?: boolean;
  allowManualRetry?: boolean;
  quietWhenIdle?: boolean;
  hideWhenIdle?: boolean;
  surface?: "default" | "settings-space";
}


export function SyncHealthCard({
  dense = false,
  compact = false,
  showHeader = true,
  allowManualRetry = true,
  quietWhenIdle = false,
  hideWhenIdle = false,
  surface = "default",
}: SyncHealthCardProps) {
  const { t, language } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const { state: orchestratorState } = useSyncOrchestrator();
  const { actions, pendingCount, isOnline, isProcessing, lastProcessedAt, processQueue } =
    useOfflineQueue();
  const hasValidSession = useAppStore((s) => s.hasValidSession);
  const [lastReceipt, setLastReceipt] = useState<SyncHealthReceipt | null>(() => {
    if (typeof window === "undefined") return null;
    return window.__zenflowSyncHealth?.snapshot().lastReceipt ?? null;
  });
  const [recentReceipts, setRecentReceipts] = useState<SyncHealthReceipt[]>(() => {
    if (typeof window === "undefined") return [];
    return window.__zenflowSyncHealth?.snapshot().receipts.slice(-MAX_RECENT_RECEIPTS) ?? [];
  });

  useEffect(() => {
    const handleReceipt = (event: Event) => {
      const detail = (event as CustomEvent<Partial<SyncHealthReceipt>>).detail;
      if (!detail?.kind || !detail.source) return;
      const receipt = sanitizeSyncHealthReceipt({
        ...detail,
        at: detail.at ?? Date.now(),
        route: detail.route ?? window.location.href,
      });
      if (!receipt) return;
      setLastReceipt(receipt);
      setRecentReceipts((prev) => [...prev, receipt].slice(-MAX_RECENT_RECEIPTS));
    };

    window.addEventListener(SYNC_HEALTH_RECEIPT_EVENT, handleReceipt);
    const handleReset = () => {
      setLastReceipt(null);
      setRecentReceipts([]);
    };
    window.addEventListener(SYNC_HEALTH_RESET_EVENT, handleReset);
    return () => {
      window.removeEventListener(SYNC_HEALTH_RECEIPT_EVENT, handleReceipt);
      window.removeEventListener(SYNC_HEALTH_RESET_EVENT, handleReset);
    };
  }, []);

  const cloudEnabled = isCloudSyncEnabled();
  const criticalPending = useMemo(
    () => actions.filter((action) => action.priority === "critical").length,
    [actions]
  );
  const failedPending = useMemo(
    () => actions.filter((action) => Boolean(action.lastError)).length,
    [actions]
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
    () =>
      actions.reduce<number | null>(
        (latest, action) => Math.max(latest ?? 0, action.timestamp),
        null
      ),
    [actions]
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
  const pendingRows = actions.slice(0, MAX_PENDING_ROWS);
  const pendingRemainder = Math.max(0, actions.length - pendingRows.length);
  const waitingCount = Math.max(pendingCount, orchestratorState.queueLength);
  const hasActionableSyncState =
    status === "syncing" ||
    status === "pending" ||
    status === "offline" ||
    status === "paused" ||
    status === "error" ||
    actions.length > 0 ||
    waitingCount > 0 ||
    criticalPending > 0 ||
    failedPending > 0;
  const useQuietIdle = compact && quietWhenIdle && !hasActionableSyncState;
  const showMetrics =
    !useQuietIdle &&
    (!compact ||
      waitingCount > 0 ||
      criticalPending > 0 ||
      failedPending > 0 ||
      Boolean(lastActivityAt));
  const showLatestAction =
    !useQuietIdle && (!compact || waitingCount > 0 || failedPending > 0 || Boolean(lastReceipt));
  const title = tx.settingsCloudSyncTitle || "Account updates";
  const description = tx.settingsCloudSyncDescription || "Keep your data available on your devices.";

  if (compact && hideWhenIdle && !hasActionableSyncState) {
    return null;
  }

  const statusBadge = (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        meta.className
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
  );

  return (
    <section
      className={cn(
        "rounded-2xl border p-5 shadow-[var(--zen-shadow-card)]",
        SYNC_HEALTH_SURFACE_CLASS[surface],
        dense && "p-4",
        compact && "shadow-none"
      )}
      data-testid="sync-health-card"
      data-compact={compact ? "true" : "false"}
      data-allow-manual-retry={allowManualRetry ? "true" : "false"}
      aria-labelledby={showHeader ? "sync-health-card-title" : undefined}
      aria-label={showHeader ? undefined : title}
    >
      {showHeader ? (
        <div className="flex flex-col gap-3 min-[520px]:flex-row min-[520px]:items-start min-[520px]:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 id="sync-health-card-title" className="text-base font-semibold text-foreground">
                {title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
            </div>
          </div>

          {statusBadge}
        </div>
      ) : (
        <div className="flex justify-start">{statusBadge}</div>
      )}

      {showMetrics && (
        <div
          className={cn(
            "mt-4 grid gap-2",
            compact
              ? "grid-cols-[repeat(auto-fit,minmax(5.75rem,1fr))]"
              : "grid-cols-1 min-[420px]:grid-cols-3"
          )}
          data-testid="sync-health-metrics"
        >
          {(!compact || waitingCount > 0 || status === "pending") && (
            <Metric label={tx.syncPending || "Waiting"} value={String(waitingCount)} />
          )}
          {(!compact || criticalPending > 0 || failedPending > 0) && (
            <Metric label={tx.syncPriority || "Important"} value={String(criticalPending)} />
          )}
          {(!compact || lastActivityAt) && (
            <Metric
              label={tx.syncLastSync || "Last sync"}
              value={formatTime(lastActivityAt, language)}
            />
          )}
        </div>
      )}

      {showLatestAction && (
        <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {tx.syncLatestAction || "Latest action"}
          </p>
          <p
            className="mt-1 text-sm font-medium text-foreground"
            data-testid="sync-health-receipt"
          >
            {receiptText(lastReceipt, tx)}
          </p>
          {failedPending > 0 && (
            <p className="mt-1 text-xs text-destructive">
              {tx.syncRetryHint || "Some changes need another try."}
            </p>
          )}
        </div>
      )}

      {(!compact || pendingRows.length > 0 || waitingCount > 0) && (
        <div
          className="mt-4 rounded-xl border border-border bg-background/35 p-3"
          data-testid="sync-inbox"
        >
          <div className="flex flex-col items-start gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
            <p className="min-w-0 whitespace-normal break-words text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground [hyphens:manual] [overflow-wrap:normal]">
              {tx.syncInboxTitle || "Updates from your devices"}
            </p>
            <span className="self-end rounded-full bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground min-[420px]:self-auto">
              {waitingCount}
            </span>
          </div>

          {pendingRows.length === 0 && waitingCount === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {tx.syncOutboxEmpty || "No changes are waiting."}
            </p>
          ) : pendingRows.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {tx.syncActionQueueDraining || "Sending saved actions"}
            </p>
          ) : (
            <ul className="mt-3 space-y-2" aria-label={tx.syncInboxTitle || "Updates from your devices"}>
              {pendingRows.map((action) => (
                <li
                  key={action.id}
                  className="flex flex-col items-stretch gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block whitespace-normal break-words text-sm font-medium text-foreground [hyphens:manual] [overflow-wrap:normal]">
                      {pendingActionText(action, tx)}
                    </span>
                    <span className="block whitespace-normal break-words text-xs text-muted-foreground [hyphens:manual] [overflow-wrap:normal]">
                      {action.priority === "critical"
                        ? tx.syncPriorityCritical || "Important"
                        : tx.syncOutboxWaiting || "Waiting to save online"}
                    </span>
                  </span>
                  {action.retries > 0 && (
                    <span className="inline-flex max-w-full self-end whitespace-normal break-words rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground [hyphens:manual] [overflow-wrap:normal] min-[420px]:self-auto">
                      {renderTemplate(tx.syncRetryCount || "{count} try", {
                        count: action.retries,
                      })}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {pendingRemainder > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {renderTemplate(tx.syncOutboxMore || "{count} more waiting", {
                count: pendingRemainder,
              })}
            </p>
          )}
        </div>
      )}

      {!compact && recentReceipts.length > 0 && (
        <div
          className="mt-4 rounded-xl border border-border bg-background/35 p-3"
          data-testid="sync-recent-activity"
        >
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {tx.syncRecentActivity || "Recent device updates"}
          </p>
          <ul
            className="mt-3 space-y-2"
            aria-label={tx.syncRecentActivity || "Recent device updates"}
          >
            {recentReceipts.map((receipt, index) => (
              <li
                key={`${receipt.kind}-${receipt.at}-${index}`}
                className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-foreground"
              >
                {receiptText(receipt, tx)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {allowManualRetry && (pendingCount > 0 || status === "error") && (
        <button
          type="button"
          onClick={() => {
            void processQueue();
          }}
          disabled={!canRetry}
          className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-semibold text-secondary-foreground motion-safe:transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-55"
          aria-label={tx.syncNow || "Sync now"}
        >
          <RefreshCw
            className={cn("h-4 w-4", isProcessing && "motion-safe:animate-spin")}
            aria-hidden="true"
          />
          {tx.syncNow || "Sync now"}
        </button>
      )}
    </section>
  );
}
