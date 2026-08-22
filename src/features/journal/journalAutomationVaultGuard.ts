import { db } from "@/storage/db";

export class JournalAutomationHistoryRequiresVaultError extends Error {
  readonly code = "AUTOMATION_HISTORY_REQUIRES_VAULT" as const;

  constructor() {
    super("Clear connected-record history before removing diary password protection.");
    this.name = "JournalAutomationHistoryRequiresVaultError";
  }
}

/**
 * The connected-record ledger uses the diary vault for encrypted undo data.
 * Call once before decryption work and again from the vault-removal transaction.
 */
export async function assertAutomationHistoryClearedForVaultRemoval(): Promise<void> {
  const [vaultDependentRowCount, deferredRemoteEventCount] = await Promise.all([
    db.automationTransactions.where("kind").anyOf("transaction", "source_pending").count(),
    db.automationRemoteEvents.count(),
  ]);
  if (vaultDependentRowCount > 0 || deferredRemoteEventCount > 0) {
    throw new JournalAutomationHistoryRequiresVaultError();
  }
}
