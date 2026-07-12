import { SK } from "@/lib/storageKeys";
import { db } from "@/storage/db";
import { clearJournalContentSession } from "@/lib/journalContentSession";
import {
  getJournalContentVaultKey,
  getJournalContentVaultRevision,
} from "./journalContentSession";

export class JournalWriteLockedError extends Error {
  constructor() {
    super("Unlock the protected diary before writing private content");
    this.name = "JournalWriteLockedError";
  }
}

/**
 * Reports whether diary protection exists in durable storage. This deliberately
 * returns only a boolean so settings UI cannot observe wrapped key material or
 * confuse an unlocked tab session with the persisted protection state.
 */
export async function hasPersistentJournalProtection(): Promise<boolean> {
  const [passwordRecord, vaultRecord] = await Promise.all([
    db.settings.get(SK.JOURNAL_PASSWORD),
    db.settings.get(SK.JOURNAL_VAULT_KEY),
  ]);
  return Boolean(passwordRecord?.value || vaultRecord?.value);
}

/**
 * Returns the unlocked in-memory key, or proves that plaintext storage is
 * allowed because no persistent diary protection exists. A stale tab cannot
 * infer the unlocked key from another tab, so it must stop instead of writing
 * plaintext.
 */
export async function getJournalVaultKeyForWrite(): Promise<string | null> {
  const vaultKey = getJournalContentVaultKey();
  const vaultRevision = getJournalContentVaultRevision();
  const [passwordRecord, vaultRecord, revisionRecord] = await Promise.all([
    db.settings.get(SK.JOURNAL_PASSWORD),
    db.settings.get(SK.JOURNAL_VAULT_KEY),
    db.settings.get(SK.JOURNAL_VAULT_REVISION),
  ]);

  const hasPersistentProtection = Boolean(passwordRecord?.value || vaultRecord?.value);
  const persistentVaultRevision = Number(
    (vaultRecord?.value as { updatedAt?: unknown } | undefined)?.updatedAt
  );
  const monotonicVaultRevision = Number(revisionRecord?.value);
  const vaultRevisionIsCurrent =
    !Number.isSafeInteger(monotonicVaultRevision) ||
    monotonicVaultRevision === persistentVaultRevision;
  if (
    hasPersistentProtection &&
    vaultKey &&
    Number.isFinite(persistentVaultRevision) &&
    vaultRevision === persistentVaultRevision &&
    vaultRevisionIsCurrent
  ) {
    return vaultKey;
  }
  if (hasPersistentProtection) {
    if (vaultKey) clearJournalContentSession("manual-lock");
    throw new JournalWriteLockedError();
  }

  if (vaultKey) {
    // Another tab may have removed protection. Never use an ambient key after
    // the durable password/vault records disappear.
    clearJournalContentSession("manual-lock");
  }
  return null;
}
