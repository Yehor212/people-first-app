import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { History, LoaderCircle, RotateCcw, Trash2 } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBackHandler } from "@/hooks/useBackHandler";
import { db, getLocalDataOwnerId } from "@/storage/db";
import { getPersistentDeviceId } from "@/storage/eventSync";
import {
  SettingsButtonGrid,
  SettingsDialog,
  SettingsInlineButton,
  SettingsStatus,
} from "@/pages/nav-v2/settings/components/V2SettingsControlPrimitives";
import { clearAllAutomationHistory, forgetAutomationTransactions } from "./automationHistoryClear";
import { requestAutomationUndo } from "./automationUndo";
import {
  automationTransactionSchema,
  type AutomationRuleId,
  type AutomationTransactionStoreRow,
  type AutomationTransactionStatus,
} from "./types";

interface AutomationHistorySheetProps {
  open: boolean;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

type Confirmation =
  | { kind: "forget"; transactionId: string }
  | { kind: "all" }
  | null;

function parseHistoryRow(value: unknown): AutomationTransactionStoreRow | null {
  if (!value || typeof value !== "object" || (value as { kind?: unknown }).kind !== "transaction") {
    return null;
  }
  const { kind: _kind, ...candidate } = value as Record<string, unknown>;
  const parsed = automationTransactionSchema.safeParse(candidate);
  return parsed.success ? { kind: "transaction", ...parsed.data } : null;
}

function statusKey(status: AutomationTransactionStatus): string {
  if (status === "committed") return "automationHistoryStatusConnected";
  if (status === "undone") return "automationHistoryStatusReverted";
  if (status === "commit_pending" || status === "undo_pending" || status === "sync_blocked") {
    return "automationHistoryStatusPending";
  }
  return "automationHistoryStatusNeedsReview";
}

function ruleKey(ruleId: AutomationRuleId): string {
  switch (ruleId) {
    case "mood.note-to-journal.v1":
      return "connectedRecordsRuleMoodJournal";
    case "journal.mood-to-checkin.v1":
      return "connectedRecordsRuleJournalMood";
    case "focus.to-mapped-habit.v1":
      return "connectedRecordsRuleFocusHabit";
    case "habit.to-planning.v1":
      return "connectedRecordsRuleHabitPlanning";
  }
}

export function AutomationHistorySheet({
  open,
  onClose,
  returnFocusRef,
}: AutomationHistorySheetProps) {
  const { t, language } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<AutomationTransactionStoreRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingUndoIds, setPendingUndoIds] = useState<Set<string>>(() => new Set());
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [error, setError] = useState<string | null>(null);
  const actionInFlightRef = useRef(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const owner = await getLocalDataOwnerId();
      if (!owner) {
        setOwnerUserId(null);
        setRows([]);
        setError(tx.automationHistorySignInRequired || "Sign in to view connected-record history.");
        return;
      }
      const stored = await db.automationTransactions
        .where("ownerUserId")
        .equals(owner)
        .toArray();
      const parsed = stored
        .map(parseHistoryRow)
        .filter((row): row is AutomationTransactionStoreRow => row !== null)
        .sort((left, right) => right.updatedAt - left.updatedAt || right.id.localeCompare(left.id));
      setOwnerUserId(owner);
      setRows(parsed);
    } catch {
      setError(tx.automationHistoryError || "Connected-record history is unavailable right now.");
    } finally {
      setLoading(false);
    }
  }, [tx.automationHistoryError, tx.automationHistorySignInRequired]);

  useEffect(() => {
    if (!open) return;
    void loadHistory();
  }, [loadHistory, open]);

  useBackHandler(open && confirmation === null, onClose);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(language, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [language],
  );

  const handleUndo = async (transactionId: string) => {
    if (!ownerUserId || actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setBusyId(transactionId);
    setError(null);
    try {
      const deviceId = await getPersistentDeviceId();
      await requestAutomationUndo(transactionId, ownerUserId, deviceId);
      setPendingUndoIds((current) => new Set(current).add(transactionId));
    } catch {
      setError(tx.automationHistoryActionError || "That change could not be completed.");
    } finally {
      actionInFlightRef.current = false;
      setBusyId(null);
    }
  };

  const confirmDestructiveAction = async () => {
    if (!confirmation || !ownerUserId || actionInFlightRef.current) return;
    const activeConfirmation = confirmation;
    actionInFlightRef.current = true;
    setBusyId(activeConfirmation.kind === "all" ? "all" : activeConfirmation.transactionId);
    setError(null);
    try {
      const deviceId = await getPersistentDeviceId();
      if (activeConfirmation.kind === "all") {
        await clearAllAutomationHistory(ownerUserId, deviceId);
      } else {
        await forgetAutomationTransactions(
          [activeConfirmation.transactionId],
          ownerUserId,
          deviceId,
        );
      }
      setConfirmation(null);
      await loadHistory();
    } catch (caught) {
      const code =
        caught && typeof caught === "object" && "code" in caught
          ? (caught as { code?: unknown }).code
          : null;
      setError(
        code === "AUTOMATION_HISTORY_CLEAR_VAULT_LOCKED"
          ? tx.automationHistoryVaultRequired || "Unlock your protected diary to change history."
          : tx.automationHistoryActionError || "That change could not be completed.",
      );
    } finally {
      actionInFlightRef.current = false;
      setBusyId(null);
    }
  };

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) onClose();
        }}
      >
        <SheetContent
          side="bottom"
          onCloseAutoFocus={(event) => {
            if (!returnFocusRef?.current) return;
            event.preventDefault();
            returnFocusRef.current.focus({ preventScroll: true });
          }}
          className="max-h-[calc(var(--app-viewport-height)-var(--safe-top)-0.75rem)] gap-3 overflow-y-auto overscroll-contain rounded-t-[24px] border-[hsl(var(--settings-v2-border)/0.58)] bg-[hsl(var(--settings-v2-card)/0.98)] px-[max(1rem,var(--safe-inline-start))] pb-[calc(var(--safe-bottom)+1rem)] pe-[max(1rem,var(--safe-inline-end))] pt-5 lg:max-w-3xl"
          data-testid="automation-history-sheet"
        >
          <SheetHeader className="pr-12 text-start">
            <SheetTitle className="flex min-w-0 items-center gap-2">
              <History className="h-5 w-5 shrink-0 text-[hsl(var(--settings-v2-accent))]" aria-hidden="true" />
              <span className="break-words [overflow-wrap:break-word]">
                {tx.automationHistoryTitle || "Connected-record history"}
              </span>
            </SheetTitle>
            <SheetDescription className="break-words [overflow-wrap:break-word]">
              {tx.automationHistoryDescription || "Encrypted history of automatic writes."}
            </SheetDescription>
          </SheetHeader>

          {error ? (
            <p role="alert" className="break-words text-sm text-destructive [overflow-wrap:break-word]">
              {error}
            </p>
          ) : null}

          {loading ? (
            <div className="flex min-h-24 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
              <LoaderCircle className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
              {tx.automationHistoryLoading || "Loading history…"}
            </div>
          ) : rows.length === 0 ? (
            <SettingsStatus center>
              {tx.automationHistoryEmpty || "No connected-record history yet."}
            </SettingsStatus>
          ) : (
            <ul className="grid min-w-0 gap-2" data-testid="automation-history-list">
              {rows.map((row) => {
                const undoPending = row.status === "undo_pending" || pendingUndoIds.has(row.id);
                const canUndo = row.status === "committed" && !undoPending;
                return (
                  <li
                    key={row.id}
                    className="min-w-0 rounded-[12px] border border-[hsl(var(--settings-v2-border)/0.46)] bg-[hsl(var(--settings-v2-shell)/0.46)] p-3"
                  >
                    <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-foreground [overflow-wrap:break-word]">
                          {tx[ruleKey(row.ruleId)] || row.ruleId}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {dateFormatter.format(new Date(row.createdAt))}
                        </p>
                      </div>
                      <span className="rounded-full border border-[hsl(var(--settings-v2-border)/0.5)] px-2 py-1 text-xs text-muted-foreground">
                        {undoPending
                          ? tx.automationHistoryUndoPending || "Undo requested"
                          : tx[statusKey(row.status)] || row.status}
                      </span>
                    </div>
                    <SettingsButtonGrid columns="two">
                      <SettingsInlineButton
                        onClick={() => void handleUndo(row.id)}
                        disabled={!canUndo || busyId !== null}
                        isLoading={busyId === row.id && confirmation === null}
                        icon={RotateCcw}
                        testId={`automation-history-undo-${row.id}`}
                      >
                        {tx.automationHistoryUndo || "Undo"}
                      </SettingsInlineButton>
                      <SettingsInlineButton
                        onClick={() => setConfirmation({ kind: "forget", transactionId: row.id })}
                        disabled={busyId !== null}
                        icon={Trash2}
                        variant="danger"
                        testId={`automation-history-forget-${row.id}`}
                      >
                        {tx.automationHistoryForget || "Forget"}
                      </SettingsInlineButton>
                    </SettingsButtonGrid>
                  </li>
                );
              })}
            </ul>
          )}

          {rows.length > 0 ? (
            <SettingsInlineButton
              onClick={() => setConfirmation({ kind: "all" })}
              disabled={busyId !== null}
              icon={Trash2}
              variant="danger"
              testId="automation-history-clear-all"
            >
              {tx.automationHistoryClearAll || "Clear all history"}
            </SettingsInlineButton>
          ) : null}
        </SheetContent>
      </Sheet>

      {confirmation ? (
        <SettingsDialog
          titleId={
            confirmation.kind === "all"
              ? "automation-history-clear-title"
              : "automation-history-forget-title"
          }
          title={
            confirmation.kind === "all"
              ? tx.automationHistoryClearTitle || "Clear all connected history?"
              : tx.automationHistoryForgetTitle || "Forget this history item?"
          }
          description={
            confirmation.kind === "all"
              ? tx.automationHistoryClearDescription ||
                "This permanently removes every connected-record undo and turns connected records off."
              : tx.automationHistoryForgetDescription ||
                "This removes this undo history but keeps your mood, diary, focus, and habit records."
          }
          cancelLabel={tx.cancel || "Cancel"}
          confirmLabel={
            confirmation.kind === "all"
              ? tx.automationHistoryClearConfirm || "Clear all"
              : tx.automationHistoryForgetConfirm || "Forget"
          }
          confirmVariant="danger"
          onCancel={() => setConfirmation(null)}
          onConfirm={() => void confirmDestructiveAction()}
        />
      ) : null}
    </>
  );
}
