import { SK } from "@/lib/storageKeys";
import { db } from "@/storage/db";

interface JournalVaultSyncValue {
  wrappedKey: string;
  createdAt: number;
  updatedAt: number;
}

interface JournalRemovalSyncIntent {
  revision: string;
  ownerUserId: string;
}

function readSafeRevision(value: unknown): number | null {
  const revision = Number(value);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : null;
}

function readVaultValue(value: unknown): JournalVaultSyncValue | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<JournalVaultSyncValue>;
  const createdAt = readSafeRevision(candidate.createdAt);
  const updatedAt = readSafeRevision(candidate.updatedAt);
  if (
    typeof candidate.wrappedKey !== "string" ||
    candidate.wrappedKey.length === 0 ||
    createdAt === null ||
    updatedAt === null
  ) {
    return null;
  }
  return {
    wrappedKey: candidate.wrappedKey,
    createdAt,
    updatedAt,
  };
}

function readRemovalIntent(value: unknown): JournalRemovalSyncIntent | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<JournalRemovalSyncIntent>;
  return typeof candidate.revision === "string" &&
    candidate.revision.length > 0 &&
    typeof candidate.ownerUserId === "string" &&
    candidate.ownerUserId.length > 0
    ? { revision: candidate.revision, ownerUserId: candidate.ownerUserId }
    : null;
}

function sameVaultValue(
  left: JournalVaultSyncValue,
  right: JournalVaultSyncValue,
): boolean {
  return (
    left.wrappedKey === right.wrappedKey &&
    left.createdAt === right.createdAt &&
    left.updatedAt === right.updatedAt
  );
}

/**
 * Applies a cloud setting inside the caller's owner-bound Dexie transaction.
 * JOURNAL_VAULT_REVISION doubles as a durable removal tombstone: once the local
 * vault is absent, an equal/older cloud value can never resurrect it.
 */
export async function applyIncomingAccountSetting(
  key: string,
  value: unknown,
): Promise<boolean> {
  if (key !== SK.JOURNAL_VAULT_KEY) {
    await db.settings.put({ key, value });
    return true;
  }

  const incomingVault = readVaultValue(value);
  if (!incomingVault) return false;

  const [localVaultRecord, revisionRecord, removalRecord] = await Promise.all([
    db.settings.get(SK.JOURNAL_VAULT_KEY),
    db.settings.get(SK.JOURNAL_VAULT_REVISION),
    db.settings.get(SK.JOURNAL_SECURITY_REMOVAL),
  ]);
  if (readRemovalIntent(removalRecord?.value)) return false;

  const localVault = readVaultValue(localVaultRecord?.value);
  const persistedRevision = readSafeRevision(revisionRecord?.value);
  const comparisonRevision = persistedRevision ?? localVault?.updatedAt ?? null;

  if (comparisonRevision !== null) {
    if (incomingVault.updatedAt < comparisonRevision) return false;
    if (
      incomingVault.updatedAt === comparisonRevision &&
      (!localVault || !sameVaultValue(localVault, incomingVault))
    ) {
      return false;
    }
  }

  await db.settings.put({ key, value: incomingVault });
  await db.settings.put({
    key: SK.JOURNAL_VAULT_REVISION,
    value: incomingVault.updatedAt,
  });
  return true;
}

/**
 * Drops stale queued/push-all vault writes after password removal. The payload
 * must still be the exact current local vault and its monotonic revision must
 * still be active; a retained revision with no vault is a deletion tombstone.
 */
export async function canUploadAccountSetting(
  key: string,
  value: unknown,
): Promise<boolean> {
  if (key !== SK.JOURNAL_VAULT_KEY) return true;

  const outgoingVault = readVaultValue(value);
  if (!outgoingVault) return false;
  const [localVaultRecord, revisionRecord, removalRecord] = await Promise.all([
    db.settings.get(SK.JOURNAL_VAULT_KEY),
    db.settings.get(SK.JOURNAL_VAULT_REVISION),
    db.settings.get(SK.JOURNAL_SECURITY_REMOVAL),
  ]);
  if (readRemovalIntent(removalRecord?.value)) return false;

  const localVault = readVaultValue(localVaultRecord?.value);
  const persistedRevision = readSafeRevision(revisionRecord?.value);
  return Boolean(
    localVault &&
      persistedRevision === localVault.updatedAt &&
      sameVaultValue(localVault, outgoingVault),
  );
}

export async function canDeleteRemoteJournalVault(
  removalRevision: string,
  ownerUserId: string,
): Promise<boolean> {
  const [passwordRecord, vaultRecord, removalRecord] = await Promise.all([
    db.settings.get(SK.JOURNAL_PASSWORD),
    db.settings.get(SK.JOURNAL_VAULT_KEY),
    db.settings.get(SK.JOURNAL_SECURITY_REMOVAL),
  ]);
  const removalIntent = readRemovalIntent(removalRecord?.value);
  return Boolean(
    removalIntent &&
      removalIntent.revision === removalRevision &&
      removalIntent.ownerUserId === ownerUserId &&
      !passwordRecord?.value &&
      !vaultRecord?.value,
  );
}
