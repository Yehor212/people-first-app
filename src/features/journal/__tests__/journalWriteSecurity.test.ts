import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  vaultKey: null as string | null,
  vaultRevision: null as number | null,
  settings: new Map<string, { key: string; value: unknown }>(),
  clearJournalContentSession: vi.fn(() => {
    mocks.vaultKey = null;
    mocks.vaultRevision = null;
  }),
}));

vi.mock("@/storage/db", () => ({
  db: {
    settings: {
      get: vi.fn((key: string) => Promise.resolve(mocks.settings.get(key))),
    },
  },
}));

vi.mock("../journalContentSession", () => ({
  getJournalContentVaultKey: () => mocks.vaultKey,
  getJournalContentVaultRevision: () => mocks.vaultRevision,
}));

vi.mock("@/lib/journalContentSession", () => ({
  clearJournalContentSession: mocks.clearJournalContentSession,
}));

import {
  getJournalVaultKeyForWrite,
  hasPersistentJournalProtection,
  JournalWriteLockedError,
} from "../journalWriteSecurity";

describe("journal write protection authority", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.settings.clear();
    mocks.vaultKey = null;
    mocks.vaultRevision = null;
  });

  it("rejects plaintext writes when persistent protection exists but this tab is locked", async () => {
    mocks.settings.set("journal_password", { key: "journal_password", value: { hash: "stored" } });

    await expect(getJournalVaultKeyForWrite()).rejects.toBeInstanceOf(JournalWriteLockedError);
  });

  it("reports durable password or vault protection without requiring an unlocked key", async () => {
    await expect(hasPersistentJournalProtection()).resolves.toBe(false);

    mocks.settings.set("journal_password", {
      key: "journal_password",
      value: { hash: "stored" },
    });
    await expect(hasPersistentJournalProtection()).resolves.toBe(true);

    mocks.settings.delete("journal_password");
    mocks.settings.set("journal_vault_key", {
      key: "journal_vault_key",
      value: { wrappedKey: "persisted", createdAt: 1, updatedAt: 2 },
    });
    await expect(hasPersistentJournalProtection()).resolves.toBe(true);
  });

  it("accepts an unlocked key only while persistent protection still exists", async () => {
    mocks.vaultKey = "active-vault-key";
    mocks.vaultRevision = 2;
    mocks.settings.set("journal_vault_key", {
      key: "journal_vault_key",
      value: { wrappedKey: "wrapped", createdAt: 1, updatedAt: 2 },
    });

    await expect(getJournalVaultKeyForWrite()).resolves.toBe("active-vault-key");
    expect(mocks.clearJournalContentSession).not.toHaveBeenCalled();
  });

  it("blocks a newly started edit after a remote password-removal wake is durable", async () => {
    mocks.vaultKey = "active-vault-key";
    mocks.vaultRevision = 2;
    mocks.settings.set("journal_vault_key", {
      key: "journal_vault_key",
      value: { wrappedKey: "wrapped", createdAt: 1, updatedAt: 2 },
    });
    mocks.settings.set("journal_security_removal_v1", {
      key: "journal_security_removal_v1",
      value: {
        version: 2,
        operationRevision: "100:remoteoperation",
        phase: "remote-recovery",
      },
    });

    await expect(getJournalVaultKeyForWrite()).rejects.toBeInstanceOf(JournalWriteLockedError);
    expect(mocks.clearJournalContentSession).toHaveBeenCalledWith("manual-lock");
  });

  it("rejects a key from an older vault revision after protection is removed and re-enabled", async () => {
    mocks.vaultKey = "stale-vault-key";
    mocks.vaultRevision = 1;
    mocks.settings.set("journal_vault_key", {
      key: "journal_vault_key",
      value: { wrappedKey: "new-wrapped-key", createdAt: 2, updatedAt: 2 },
    });

    await expect(getJournalVaultKeyForWrite()).rejects.toBeInstanceOf(JournalWriteLockedError);

    expect(mocks.clearJournalContentSession).toHaveBeenCalledWith("manual-lock");
    expect(mocks.vaultKey).toBeNull();
  });

  it("rejects a vault record older than the persisted monotonic revision marker", async () => {
    mocks.vaultKey = "stale-vault-key";
    mocks.vaultRevision = 2;
    mocks.settings.set("journal_vault_key", {
      key: "journal_vault_key",
      value: { wrappedKey: "stale-wrapped-key", createdAt: 1, updatedAt: 2 },
    });
    mocks.settings.set("journal_vault_revision_v1", {
      key: "journal_vault_revision_v1",
      value: 3,
    });

    await expect(getJournalVaultKeyForWrite()).rejects.toBeInstanceOf(JournalWriteLockedError);
    expect(mocks.clearJournalContentSession).toHaveBeenCalledWith("manual-lock");
  });

  it("invalidates a stale tab key after another tab removes persistent protection", async () => {
    mocks.vaultKey = "stale-vault-key";

    await expect(getJournalVaultKeyForWrite()).resolves.toBeNull();

    expect(mocks.clearJournalContentSession).toHaveBeenCalledWith("manual-lock");
    expect(mocks.vaultKey).toBeNull();
  });
});
