import { SK } from "@/lib/storageKeys";
import { db } from "@/storage/db";
import { isEncryptedJournalContent } from "./journalCrypto";

const JOURNAL_BACKUP_EPOCH_COLLECTIONS = [
  "journalEntries",
  "journalPhotos",
  "journalAudio",
  "journalSpaces",
  "journalSpaceCaptures",
] as const;

export class JournalVaultEpochMismatchError extends Error {
  constructor(readonly surface: string) {
    super(`Diary ${surface} does not belong to the active vault epoch`);
    this.name = "JournalVaultEpochMismatchError";
  }
}

export function normalizeJournalVaultRevision(value: unknown): number | null {
  const revision = Number(value);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : null;
}

export function requireSafeJournalVaultRevision(
  value: unknown,
  surface: string,
): number {
  const revision = normalizeJournalVaultRevision(value);
  if (revision === null) throw new JournalVaultEpochMismatchError(surface);
  return revision;
}

function vaultRevisionFromSetting(value: unknown): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return normalizeJournalVaultRevision((value as { updatedAt?: unknown }).updatedAt);
}

export async function readDurableJournalVaultRevision(): Promise<{
  protected: boolean;
  vaultRevision: number | null;
}> {
  const [passwordRecord, vaultRecord, revisionRecord] = await Promise.all([
    db.settings.get(SK.JOURNAL_PASSWORD),
    db.settings.get(SK.JOURNAL_VAULT_KEY),
    db.settings.get(SK.JOURNAL_VAULT_REVISION),
  ]);
  const protectedJournal = Boolean(passwordRecord?.value || vaultRecord?.value);
  if (!protectedJournal) return { protected: false, vaultRevision: null };

  const vaultRevision = vaultRevisionFromSetting(vaultRecord?.value);
  const monotonicRevision = normalizeJournalVaultRevision(revisionRecord?.value);
  if (
    vaultRevision === null ||
    (monotonicRevision !== null && monotonicRevision !== vaultRevision)
  ) {
    throw new JournalVaultEpochMismatchError("vault metadata");
  }
  return { protected: true, vaultRevision };
}

/**
 * Sync ingress must fail closed for inconsistent vault metadata without
 * preventing unrelated entities or the sync cursor from progressing. Actual
 * storage failures still throw so callers do not misclassify I/O failure as a
 * vault mismatch.
 */
export async function readDurableJournalVaultEpochForIngress(): Promise<DurableJournalVaultEpoch> {
  try {
    return await readDurableJournalVaultRevision();
  } catch (error) {
    if (error instanceof JournalVaultEpochMismatchError) {
      return { protected: true, vaultRevision: null };
    }
    throw error;
  }
}

export interface DurableJournalVaultEpoch {
  protected: boolean;
  vaultRevision: number | null;
}

/**
 * Fail-closed guard for cloud rows entering a protected local diary. Ciphertext
 * shape alone is insufficient: the row must name the exact durable vault epoch.
 * Plaintext journals keep their existing compatibility path because activation
 * and removal are serialized by the journal security write lock.
 */
export function canApplyJournalEntryForVaultEpoch(
  entry: { content?: string | null; vaultRevision?: unknown },
  durable: DurableJournalVaultEpoch,
): boolean {
  if (!durable.protected) return true;
  return (
    durable.vaultRevision !== null &&
    normalizeJournalVaultRevision(entry.vaultRevision) === durable.vaultRevision &&
    (!entry.content || isEncryptedJournalContent(entry.content))
  );
}

/** Exact owner + row revision + object-path revision check for encrypted media metadata. */
export function canApplyJournalMediaForVaultEpoch(
  media: { storagePath?: string | null; vaultRevision?: unknown },
  durable: DurableJournalVaultEpoch,
  expectedOwnerUserId: string,
): boolean {
  if (!durable.protected) return true;
  const path = media.storagePath;
  if (
    durable.vaultRevision === null ||
    !path ||
    !path.startsWith(`${expectedOwnerUserId}/`) ||
    path.includes("..")
  ) {
    return false;
  }
  const rowRevision = normalizeJournalVaultRevision(media.vaultRevision);
  const pathRevision = parseJournalMediaVaultRevision(path);
  return rowRevision === durable.vaultRevision && pathRevision === durable.vaultRevision;
}

export async function requireJournalVaultEpochForCloudWrite(input: {
  surface: string;
  protectedPayload: boolean;
  vaultRevision: unknown;
}): Promise<number | null> {
  const durable = await readDurableJournalVaultRevision();
  const payloadRevision = normalizeJournalVaultRevision(input.vaultRevision);

  if (!durable.protected) {
    if (input.protectedPayload || payloadRevision !== null) {
      throw new JournalVaultEpochMismatchError(input.surface);
    }
    return null;
  }

  if (
    !input.protectedPayload ||
    payloadRevision === null ||
    payloadRevision !== durable.vaultRevision
  ) {
    throw new JournalVaultEpochMismatchError(input.surface);
  }
  return payloadRevision;
}

export function parseJournalMediaVaultRevision(path: string | null | undefined): number | null {
  if (!path) return null;
  const match = path.match(/\.v([0-9]+)\.bin$/i);
  return match ? normalizeJournalVaultRevision(match[1]) : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function validateJournalBackupVaultEpoch(
  data: unknown,
  expectedVaultRevision: number | null,
): number | null {
  const expected =
    expectedVaultRevision === null
      ? null
      : requireSafeJournalVaultRevision(expectedVaultRevision, "backup");
  const record = asRecord(data);
  if (!record) throw new JournalVaultEpochMismatchError("backup");

  for (const collectionName of JOURNAL_BACKUP_EPOCH_COLLECTIONS) {
    const collection = record[collectionName];
    if (collection === undefined) continue;
    if (!Array.isArray(collection)) throw new JournalVaultEpochMismatchError("backup");
    for (const item of collection) {
      const itemRecord = asRecord(item);
      if (!itemRecord) throw new JournalVaultEpochMismatchError("backup");
      const itemRevision = normalizeJournalVaultRevision(itemRecord.vaultRevision);
      if (itemRevision !== expected) throw new JournalVaultEpochMismatchError("backup");
    }
  }

  return expected;
}
