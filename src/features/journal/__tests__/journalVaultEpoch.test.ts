import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  settings: new Map<string, { key: string; value: unknown }>(),
}));

vi.mock("@/storage/db", () => ({
  db: {
    settings: {
      get: vi.fn((key: string) => Promise.resolve(mocks.settings.get(key))),
    },
  },
}));

import {
  JournalVaultEpochMismatchError,
  parseJournalMediaVaultRevision,
  requireJournalVaultEpochForCloudWrite,
  validateJournalBackupVaultEpoch,
} from "../journalVaultEpoch";

describe("journal vault epoch", () => {
  beforeEach(() => {
    mocks.settings.clear();
  });

  function protectAt(revision: number): void {
    mocks.settings.set("journal_password", {
      key: "journal_password",
      value: { hash: "stored" },
    });
    mocks.settings.set("journal_vault_key", {
      key: "journal_vault_key",
      value: { wrappedKey: "wrapped", createdAt: revision, updatedAt: revision },
    });
    mocks.settings.set("journal_vault_revision_v1", {
      key: "journal_vault_revision_v1",
      value: revision,
    });
  }

  it("accepts protected E2 content only when its row revision is exactly E2", async () => {
    protectAt(2);

    await expect(
      requireJournalVaultEpochForCloudWrite({
        surface: "entry",
        protectedPayload: true,
        vaultRevision: 2,
      }),
    ).resolves.toBe(2);
  });

  it("rejects stale E1 content after protection is removed and enabled again as E2", async () => {
    protectAt(2);

    await expect(
      requireJournalVaultEpochForCloudWrite({
        surface: "entry",
        protectedPayload: true,
        vaultRevision: 1,
      }),
    ).rejects.toBeInstanceOf(JournalVaultEpochMismatchError);
  });

  it("rejects plaintext and missing epoch metadata while persistent protection is active", async () => {
    protectAt(2);

    await expect(
      requireJournalVaultEpochForCloudWrite({
        surface: "entry",
        protectedPayload: false,
        vaultRevision: null,
      }),
    ).rejects.toBeInstanceOf(JournalVaultEpochMismatchError);
    await expect(
      requireJournalVaultEpochForCloudWrite({
        surface: "entry",
        protectedPayload: true,
        vaultRevision: undefined,
      }),
    ).rejects.toBeInstanceOf(JournalVaultEpochMismatchError);
  });

  it("accepts plaintext only after durable protection has been removed", async () => {
    await expect(
      requireJournalVaultEpochForCloudWrite({
        surface: "entry",
        protectedPayload: false,
        vaultRevision: undefined,
      }),
    ).resolves.toBeNull();
    await expect(
      requireJournalVaultEpochForCloudWrite({
        surface: "entry",
        protectedPayload: false,
        vaultRevision: 1,
      }),
    ).rejects.toBeInstanceOf(JournalVaultEpochMismatchError);
  });

  it("parses only versioned protected media paths", () => {
    expect(parseJournalMediaVaultRevision("user-1/photo-1.v27.bin")).toBe(27);
    expect(parseJournalMediaVaultRevision("user-1/photo-1.bin")).toBeNull();
    expect(parseJournalMediaVaultRevision("user-1/photo-1.v2.jpg")).toBeNull();
  });

  it("rejects a protected backup with a mixed or missing journal epoch", () => {
    const valid = {
      journalEntries: [{ id: "entry-1", vaultRevision: 2 }],
      journalPhotos: [{ id: "photo-1", vaultRevision: 2 }],
      journalAudio: [{ id: "audio-1", vaultRevision: 2 }],
      journalSpaces: [{ id: "space-1", vaultRevision: 2 }],
      journalSpaceCaptures: [{ id: "capture-1", vaultRevision: 2 }],
    };
    expect(validateJournalBackupVaultEpoch(valid, 2)).toBe(2);
    expect(() =>
      validateJournalBackupVaultEpoch(
        { ...valid, journalEntries: [{ id: "entry-1", vaultRevision: 1 }] },
        2,
      ),
    ).toThrow(JournalVaultEpochMismatchError);
    expect(() =>
      validateJournalBackupVaultEpoch(
        { ...valid, journalPhotos: [{ id: "photo-1" }] },
        2,
      ),
    ).toThrow(JournalVaultEpochMismatchError);
  });
});
