import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { SK } from "@/lib/storageKeys";
import { db } from "@/storage/db";
import { applyIncomingAccountSetting } from "../journalVaultSyncPolicy";

const legacyVault = {
  wrappedKey: "wrapped:old-password:vault-key",
  createdAt: 100,
  updatedAt: 101,
};

describe("journal vault wrapper convergence", () => {
  beforeEach(async () => {
    await db.settings.clear();
  });

  afterAll(() => {
    db.close();
  });

  it("accepts a newer wrapper generation without relabelling the content epoch", async () => {
    await db.settings.bulkPut([
      { key: SK.JOURNAL_VAULT_KEY, value: legacyVault },
      { key: SK.JOURNAL_VAULT_REVISION, value: 101 },
      {
        key: SK.JOURNAL_PASSWORD,
        value: { hash: "old-hash", salt: "old-salt", iterations: 600_000, createdAt: 100 },
      },
    ]);
    const incoming = {
      ...legacyVault,
      wrappedKey: "wrapped:new-password:vault-key",
      wrapperRevision: 1,
    };

    await expect(
      applyIncomingAccountSetting(SK.JOURNAL_VAULT_KEY, incoming),
    ).resolves.toBe(true);

    await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toEqual({
      key: SK.JOURNAL_VAULT_KEY,
      value: incoming,
    });
    await expect(db.settings.get(SK.JOURNAL_VAULT_REVISION)).resolves.toMatchObject({
      value: 101,
    });
    await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toBeUndefined();
  });

  it("rejects an equal-generation conflicting wrapper without an owned pending CAS", async () => {
    const local = { ...legacyVault, wrappedKey: "wrapped:local:vault-key", wrapperRevision: 1 };
    await db.settings.bulkPut([
      { key: SK.JOURNAL_VAULT_KEY, value: local },
      { key: SK.JOURNAL_VAULT_REVISION, value: 101 },
      {
        key: SK.JOURNAL_PASSWORD,
        value: { hash: "local-hash", salt: "local-salt", iterations: 600_000, createdAt: 100 },
      },
    ]);

    await expect(
      applyIncomingAccountSetting(SK.JOURNAL_VAULT_KEY, {
        ...local,
        wrappedKey: "wrapped:conflict:vault-key",
      }),
    ).resolves.toBe(false);

    await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toMatchObject({ value: local });
    await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toBeDefined();
  });

  it("adopts the server winner and clears a conflicting local CAS retry", async () => {
    const localCandidate = {
      ...legacyVault,
      wrappedKey: "wrapped:local-candidate:vault-key",
      wrapperRevision: 1,
    };
    const serverWinner = {
      ...legacyVault,
      wrappedKey: "wrapped:server-winner:vault-key",
      wrapperRevision: 1,
    };
    await db.settings.bulkPut([
      { key: SK.DATA_OWNER_ID, value: "account-a" },
      { key: SK.JOURNAL_VAULT_KEY, value: localCandidate },
      { key: SK.JOURNAL_VAULT_REVISION, value: 101 },
      {
        key: SK.JOURNAL_PASSWORD,
        value: { hash: "candidate-hash", salt: "candidate-salt", iterations: 600_000, createdAt: 100 },
      },
      {
        key: SK.JOURNAL_VAULT_SYNC_PENDING,
        value: {
          version: 1,
          ownerUserId: "account-a",
          expectedVaultSetting: legacyVault,
          vaultSetting: localCandidate,
          createdAt: 102,
        },
      },
    ]);

    await expect(
      applyIncomingAccountSetting(SK.JOURNAL_VAULT_KEY, serverWinner),
    ).resolves.toBe(true);

    await expect(db.settings.get(SK.JOURNAL_VAULT_KEY)).resolves.toMatchObject({
      value: serverWinner,
    });
    await expect(db.settings.get(SK.JOURNAL_PASSWORD)).resolves.toBeUndefined();
    await expect(db.settings.get(SK.JOURNAL_VAULT_SYNC_PENDING)).resolves.toBeUndefined();
  });
});
