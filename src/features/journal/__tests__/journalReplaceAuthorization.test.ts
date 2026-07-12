import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as journalContentSession from "../journalContentSession";
import { setJournalContentVaultKey } from "../journalContentSession";
import {
  importBackup,
  type BackupPayloadV3,
  type ImportMode,
  type ImportReport,
} from "@/storage/backup";
import { db } from "@/storage/db";
import { SK } from "@/lib/storageKeys";

type JournalReplaceAuthorizationInvalidationReason =
  | "manual-lock"
  | "background"
  | "sign-out";

interface JournalReplaceAuthorization {
  readonly id: string;
  readonly expiresAt: number;
  readonly vaultRevision: number;
  readonly sessionGeneration: number;
}

interface JournalReplaceAuthorizationApi {
  readonly JOURNAL_REPLACE_AUTHORIZATION_TTL_MS: number;
  issueJournalReplaceAuthorization: (
    vaultRevision: number,
    now?: number
  ) => JournalReplaceAuthorization;
  invalidateJournalReplaceAuthorization: (
    reason: JournalReplaceAuthorizationInvalidationReason
  ) => void;
}

interface ImportBackupAuthorizationOptions {
  journalReplaceAuthorization: JournalReplaceAuthorization;
  now?: number;
}

type ImportBackupWithAuthorization = (
  payload: BackupPayloadV3,
  mode: ImportMode,
  options: ImportBackupAuthorizationOptions
) => Promise<ImportReport>;

const sessionAuthorization = journalContentSession as typeof journalContentSession &
  Partial<JournalReplaceAuthorizationApi>;
const importBackupWithAuthorization = importBackup as unknown as ImportBackupWithAuthorization;

function requireAuthorizationApi(): JournalReplaceAuthorizationApi {
  expect(
    sessionAuthorization.JOURNAL_REPLACE_AUTHORIZATION_TTL_MS,
    "journalContentSession must export a fixed Journal Replace authorization TTL"
  ).toBeTypeOf("number");
  expect(
    sessionAuthorization.issueJournalReplaceAuthorization,
    "journalContentSession must export issueJournalReplaceAuthorization(vaultRevision, now?)"
  ).toBeTypeOf("function");
  expect(
    sessionAuthorization.invalidateJournalReplaceAuthorization,
    "journalContentSession must export invalidateJournalReplaceAuthorization(reason)"
  ).toBeTypeOf("function");
  return sessionAuthorization;
}

function makePayload(): BackupPayloadV3 {
  return {
    schemaVersion: 3,
    createdAt: "2026-07-10T00:00:00.000Z",
    deviceId: "settings-phase0-test",
    data: {
      moods: [],
      habits: [],
      focusSessions: [],
      gratitudeEntries: [],
      settings: [],
      journalEntries: [],
      journalPhotos: [],
      journalAudio: [],
    },
  };
}

async function establishProtectedJournal(vaultRevision: number): Promise<void> {
  await db.settings.bulkPut([
    {
      key: SK.JOURNAL_PASSWORD,
      value: { hash: "local-password-verifier" },
    },
    {
      key: SK.JOURNAL_VAULT_KEY,
      value: {
        wrappedKey: "wrapped-local-vault-key",
        createdAt: 1,
        updatedAt: vaultRevision,
      },
    },
  ]);
  setJournalContentVaultKey("active-vault-key-session", vaultRevision);
}

async function expectAuthorizationBlockBeforeTransaction(
  authorization: JournalReplaceAuthorization,
  now?: number
): Promise<void> {
  const transactionSpy = vi.spyOn(db, "transaction");

  await expect(
    importBackupWithAuthorization(makePayload(), "replace", {
      journalReplaceAuthorization: authorization,
      now,
    })
  ).rejects.toMatchObject({
    name: "BackupImportBlockedError",
    code: "JOURNAL_REPLACE_AUTHORIZATION_REQUIRED",
  });
  expect(transactionSpy).not.toHaveBeenCalled();
}

describe("protected Journal Replace authorization", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    sessionAuthorization.invalidateJournalReplaceAuthorization?.("manual-lock");
    setJournalContentVaultKey(null);
    await db.open();
    await Promise.all([
      db.moods.clear(),
      db.habits.clear(),
      db.focusSessions.clear(),
      db.gratitudeEntries.clear(),
      db.settings.clear(),
      db.journalEntries.clear(),
      db.journalPhotos.clear(),
      db.journalAudio.clear(),
    ]);
  });

  afterEach(() => {
    sessionAuthorization.invalidateJournalReplaceAuthorization?.("manual-lock");
    setJournalContentVaultKey(null);
    vi.restoreAllMocks();
  });

  it("allows one Replace with fresh authorization and blocks reuse before a second transaction", async () => {
    const api = requireAuthorizationApi();
    const vaultRevision = 11;
    const now = 1_000;
    await establishProtectedJournal(vaultRevision);
    const authorization = api.issueJournalReplaceAuthorization(vaultRevision, now);
    const transactionSpy = vi.spyOn(db, "transaction");

    await expect(
      importBackupWithAuthorization(makePayload(), "replace", {
        journalReplaceAuthorization: authorization,
        now,
      })
    ).resolves.toMatchObject({ mode: "replace" });
    expect(transactionSpy).toHaveBeenCalledTimes(1);

    await expect(
      importBackupWithAuthorization(makePayload(), "replace", {
        journalReplaceAuthorization: authorization,
        now: now + 1,
      })
    ).rejects.toMatchObject({
      name: "BackupImportBlockedError",
      code: "JOURNAL_REPLACE_AUTHORIZATION_REQUIRED",
    });
    expect(transactionSpy).toHaveBeenCalledTimes(1);
  });

  it("blocks expired authorization before the Replace transaction", async () => {
    const api = requireAuthorizationApi();
    const vaultRevision = 12;
    const issuedAt = 2_000;
    await establishProtectedJournal(vaultRevision);
    const authorization = api.issueJournalReplaceAuthorization(vaultRevision, issuedAt);

    await expectAuthorizationBlockBeforeTransaction(
      authorization,
      issuedAt + api.JOURNAL_REPLACE_AUTHORIZATION_TTL_MS + 1
    );
  });

  it("blocks authorization issued for an older vault revision before the Replace transaction", async () => {
    const api = requireAuthorizationApi();
    const issuedRevision = 13;
    await establishProtectedJournal(issuedRevision);
    const authorization = api.issueJournalReplaceAuthorization(issuedRevision, 3_000);
    await db.settings.put({
      key: SK.JOURNAL_VAULT_KEY,
      value: {
        wrappedKey: "rewrapped-local-vault-key",
        createdAt: 1,
        updatedAt: issuedRevision + 1,
      },
    });

    await expectAuthorizationBlockBeforeTransaction(authorization, 3_001);
  });

  it("blocks authorization from an older unlocked-session generation before the Replace transaction", async () => {
    const api = requireAuthorizationApi();
    const vaultRevision = 14;
    await establishProtectedJournal(vaultRevision);
    const authorization = api.issueJournalReplaceAuthorization(vaultRevision, 4_000);

    setJournalContentVaultKey("active-vault-key-session", vaultRevision);

    await expectAuthorizationBlockBeforeTransaction(authorization, 4_001);
  });

  it.each<JournalReplaceAuthorizationInvalidationReason>([
    "manual-lock",
    "background",
    "sign-out",
  ])("blocks authorization invalidated by %s before the Replace transaction", async (reason) => {
    const api = requireAuthorizationApi();
    const vaultRevision = 15;
    await establishProtectedJournal(vaultRevision);
    const authorization = api.issueJournalReplaceAuthorization(vaultRevision, 5_000);

    api.invalidateJournalReplaceAuthorization(reason);

    await expectAuthorizationBlockBeforeTransaction(authorization, 5_001);
  });
});
