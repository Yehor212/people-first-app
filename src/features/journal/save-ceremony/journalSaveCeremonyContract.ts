import type { AppliedTheme } from "@/stores/themeStore";

export const JOURNAL_SAVE_COMMIT_RECEIPT_TTL_MS = 5_000;

export type JournalSaveOperation = "create" | "update";
export type JournalSaveCeremonyVariant = "night" | "day";
export type JournalSaveDeliveryState =
  | "local-saved"
  | "cloud-pending"
  | "cloud-failed";
export type JournalSaveSyncScheduleOutcome = "scheduled" | "unavailable";

export interface JournalSaveCommitReceipt {
  nonce: string;
  operation: JournalSaveOperation;
  /** Ephemeral only: used to mark the already-rendered saved card, never persisted or logged. */
  entryId: string;
  deliveryState: JournalSaveDeliveryState;
  committedAt: number;
  appliedTheme: AppliedTheme;
  variant: JournalSaveCeremonyVariant;
}

export interface JournalSaveCompletion {
  feedbackHandled: boolean;
  ceremonyReceipt: JournalSaveCommitReceipt | null;
}

export async function commitJournalSaveAndCaptureTheme<T>(
  commit: () => Promise<T>,
  readAppliedTheme: () => AppliedTheme,
): Promise<{ result: T; appliedTheme: AppliedTheme }> {
  const result = await commit();
  return {
    result,
    appliedTheme: readAppliedTheme(),
  };
}

function createReceiptNonce(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `save-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function resolveJournalSaveCeremonyVariant(
  appliedTheme: AppliedTheme,
): JournalSaveCeremonyVariant {
  return appliedTheme === "paper" ? "night" : "day";
}

export function resolveJournalSaveDeliveryState(
  schedule: () => JournalSaveSyncScheduleOutcome,
): JournalSaveDeliveryState {
  try {
    return schedule() === "scheduled" ? "cloud-pending" : "local-saved";
  } catch {
    return "cloud-failed";
  }
}

export function createJournalSaveCommitReceipt(input: {
  operation: JournalSaveOperation;
  entryId: string;
  deliveryState: JournalSaveDeliveryState;
  appliedTheme: AppliedTheme;
  committedAt?: number;
  nonce?: string;
}): JournalSaveCommitReceipt {
  const committedAt = input.committedAt ?? Date.now();
  return {
    nonce: input.nonce ?? createReceiptNonce(),
    operation: input.operation,
    entryId: input.entryId,
    deliveryState: input.deliveryState,
    committedAt,
    appliedTheme: input.appliedTheme,
    variant: resolveJournalSaveCeremonyVariant(input.appliedTheme),
  };
}

export function isJournalSaveCommitReceiptFresh(
  receipt: JournalSaveCommitReceipt,
  now = Date.now(),
): boolean {
  const age = now - receipt.committedAt;
  return age >= 0 && age <= JOURNAL_SAVE_COMMIT_RECEIPT_TTL_MS;
}
