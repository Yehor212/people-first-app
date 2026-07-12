import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../journalCrypto", () => ({
  encryptJournalContent: vi.fn((value: string, key: string) =>
    Promise.resolve(`entry-enc:${key}:${value}`)
  ),
  decryptJournalContentIfNeeded: vi.fn(async (value: string, key: string) => {
    if (!value.startsWith("entry-enc:")) return value;
    const prefix = `entry-enc:${key}:`;
    if (!value.startsWith(prefix)) throw new Error("Journal content authentication failed");
    return value.slice(prefix.length);
  }),
  isEncryptedJournalContent: vi.fn((value: string) => value.startsWith("entry-enc:")),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), log: vi.fn() },
}));

import { SK } from "@/lib/storageKeys";
import { db } from "@/storage/db";
import { setJournalContentVaultKey } from "../journalContentSession";
import {
  createJournalSpaceCapture,
  decryptEncryptedJournalHubContent,
  encryptPlaintextJournalHubContent,
  getJournalSpaceCaptures,
  getJournalSpaces,
  hasEncryptedJournalHubContent,
  ensureGratitudeSpace,
  GRATITUDE_SPACE_ID,
  saveJournalSpace,
} from "../journalHubStorage";

function setVaultSession(key: string | null, revision: number | null = null): void {
  setJournalContentVaultKey(key, revision);
}

async function persistProtection(revision: number): Promise<void> {
  await db.settings.put({
    key: SK.JOURNAL_PASSWORD,
    value: { hash: "hash", salt: "salt", iterations: 600_000, createdAt: 1 },
  });
  await db.settings.put({
    key: SK.JOURNAL_VAULT_KEY,
    value: { wrappedKey: `wrapped-${revision}`, createdAt: revision, updatedAt: revision },
  });
}

const customSpace = {
  id: "space-private-project",
  name: "Private project",
  description: "Notes I do not want exposed",
  iconKey: "folder" as const,
  accent: "violet" as const,
  private: true,
  kind: "user" as const,
  sortOrder: 10,
};

describe("journal hub password-protection ingress", () => {
  beforeEach(async () => {
    setVaultSession(null);
    await db.transaction(
      "rw",
      [db.settings, db.journalSpaces, db.journalSpaceCaptures],
      async () => {
        await db.settings.clear();
        await db.journalSpaces.clear();
        await db.journalSpaceCaptures.clear();
      }
    );
  });

  afterAll(() => {
    setVaultSession(null);
    db.close();
  });

  it("encrypts custom Space and Capture fields at write ingress and reveals them only when unlocked", async () => {
    await persistProtection(11);
    setVaultSession("vault-key", 11);

    const savedSpace = await saveJournalSpace(customSpace);
    const savedCapture = await createJournalSpaceCapture({
      spaceId: customSpace.id,
      spaceName: customSpace.name,
      mode: "guided",
      title: "Decision I am considering",
      fields: [
        { prompt: "What matters?", value: "A private answer" },
        { prompt: "What is difficult?", value: "Another private answer" },
      ],
      date: "2026-07-11",
    });

    expect(savedSpace.name).toBe(customSpace.name);
    expect(savedCapture.title).toBe("Decision I am considering");
    await expect(db.journalSpaces.get(customSpace.id)).resolves.toMatchObject({
      name: "entry-enc:vault-key:Private project",
      description: "entry-enc:vault-key:Notes I do not want exposed",
    });
    await expect(db.journalSpaceCaptures.get(savedCapture.id)).resolves.toMatchObject({
      spaceName: "entry-enc:vault-key:Private project",
      title: "entry-enc:vault-key:Decision I am considering",
      fields: [
        {
          prompt: "entry-enc:vault-key:What matters?",
          value: "entry-enc:vault-key:A private answer",
        },
        {
          prompt: "entry-enc:vault-key:What is difficult?",
          value: "entry-enc:vault-key:Another private answer",
        },
      ],
    });

    await expect(getJournalSpaces()).resolves.toEqual([
      expect.objectContaining({ name: customSpace.name, description: customSpace.description }),
    ]);
    await expect(getJournalSpaceCaptures(customSpace.id)).resolves.toEqual([
      expect.objectContaining({
        spaceName: customSpace.name,
        title: "Decision I am considering",
        fields: [
          { prompt: "What matters?", value: "A private answer" },
          { prompt: "What is difficult?", value: "Another private answer" },
        ],
      }),
    ]);
  });

  it("redacts protected Space and Capture fields and refuses plaintext writes while this tab is locked", async () => {
    await persistProtection(11);
    await db.journalSpaces.put({
      ...customSpace,
      name: "entry-enc:vault-key:Private project",
      description: "entry-enc:vault-key:Notes I do not want exposed",
      createdAt: 1,
      updatedAt: 1,
    });
    await db.journalSpaceCaptures.put({
      id: "capture-locked",
      spaceId: customSpace.id,
      spaceName: "entry-enc:vault-key:Private project",
      mode: "guided",
      title: "entry-enc:vault-key:Decision I am considering",
      fields: [
        {
          prompt: "entry-enc:vault-key:What matters?",
          value: "entry-enc:vault-key:A private answer",
        },
      ],
      date: "2026-07-11",
      createdAt: 1,
      updatedAt: 1,
    });

    await expect(getJournalSpaces()).resolves.toEqual([
      expect.objectContaining({ name: undefined, description: undefined }),
    ]);
    await expect(getJournalSpaceCaptures(customSpace.id)).resolves.toEqual([
      expect.objectContaining({ spaceName: "", title: "", fields: [] }),
    ]);
    await expect(saveJournalSpace({ ...customSpace, id: "space-blocked" })).rejects.toThrow(
      /unlock|locked|protected/i
    );
    await expect(db.journalSpaces.get("space-blocked")).resolves.toBeUndefined();
  });

  it("rejects a stale key from the previous vault revision after remove and re-enable", async () => {
    await persistProtection(22);
    setVaultSession("old-vault-key", 11);

    await expect(saveJournalSpace(customSpace)).rejects.toThrow(/unlock|locked|protected/i);

    await expect(db.journalSpaces.get(customSpace.id)).resolves.toBeUndefined();
  });

  it("encrypts a repaired legacy gratitude-space name and never returns ciphertext", async () => {
    await persistProtection(11);
    setVaultSession("vault-key", 11);
    await db.journalSpaces.put({
      id: GRATITUDE_SPACE_ID,
      name: "Private gratitude room",
      iconKey: "sprout",
      accent: "mint",
      private: false,
      kind: "user",
      sortOrder: 15,
      createdAt: 1,
      updatedAt: 1,
    });

    await expect(ensureGratitudeSpace()).resolves.toMatchObject({
      id: GRATITUDE_SPACE_ID,
      name: "Private gratitude room",
      kind: "system",
      locked: true,
    });
    await expect(db.journalSpaces.get(GRATITUDE_SPACE_ID)).resolves.toMatchObject({
      name: "entry-enc:vault-key:Private gratitude room",
      kind: "system",
      locked: true,
    });

    setVaultSession(null);
    await expect(ensureGratitudeSpace()).resolves.toMatchObject({
      id: GRATITUDE_SPACE_ID,
      name: undefined,
    });
  });

  it("decrypts Space/Capture rows for removal and re-encrypts them for rollback", async () => {
    await db.journalSpaces.put({
      ...customSpace,
      name: "entry-enc:vault-key:Private project",
      description: "entry-enc:vault-key:Notes I do not want exposed",
      createdAt: 1,
      updatedAt: 1,
    });
    await db.journalSpaceCaptures.put({
      id: "capture-rollback",
      spaceId: customSpace.id,
      spaceName: "entry-enc:vault-key:Private project",
      mode: "guided",
      title: "entry-enc:vault-key:Decision I am considering",
      fields: [
        {
          prompt: "entry-enc:vault-key:What matters?",
          value: "entry-enc:vault-key:A private answer",
        },
      ],
      date: "2026-07-11",
      createdAt: 1,
      updatedAt: 1,
    });

    await expect(hasEncryptedJournalHubContent()).resolves.toBe(true);
    await expect(decryptEncryptedJournalHubContent("vault-key")).resolves.toBe(2);
    await expect(db.journalSpaces.get(customSpace.id)).resolves.toMatchObject({
      name: "Private project",
      description: "Notes I do not want exposed",
    });
    await expect(db.journalSpaceCaptures.get("capture-rollback")).resolves.toMatchObject({
      title: "Decision I am considering",
      fields: [{ prompt: "What matters?", value: "A private answer" }],
    });

    await expect(encryptPlaintextJournalHubContent("vault-key")).resolves.toBe(2);
    await expect(db.journalSpaces.get(customSpace.id)).resolves.toMatchObject({
      name: "entry-enc:vault-key:Private project",
      description: "entry-enc:vault-key:Notes I do not want exposed",
    });
    await expect(db.journalSpaceCaptures.get("capture-rollback")).resolves.toMatchObject({
      title: "entry-enc:vault-key:Decision I am considering",
      fields: [
        {
          prompt: "entry-enc:vault-key:What matters?",
          value: "entry-enc:vault-key:A private answer",
        },
      ],
    });
  });

  it("fails removal decryption closed and preserves ciphertext when authentication fails", async () => {
    await db.journalSpaces.put({
      ...customSpace,
      name: "entry-enc:vault-key:Private project",
      description: "entry-enc:vault-key:Notes I do not want exposed",
      createdAt: 1,
      updatedAt: 1,
    });
    await db.journalSpaceCaptures.put({
      id: "capture-corrupt",
      spaceId: customSpace.id,
      spaceName: "entry-enc:vault-key:Private project",
      mode: "guided",
      title: "entry-enc:vault-key:Decision I am considering",
      fields: [
        {
          prompt: "entry-enc:vault-key:What matters?",
          value: "entry-enc:vault-key:A private answer",
        },
      ],
      date: "2026-07-11",
      createdAt: 1,
      updatedAt: 1,
    });

    await expect(decryptEncryptedJournalHubContent("wrong-vault-key")).rejects.toThrow(
      /authentication failed/i
    );
    await expect(db.journalSpaces.get(customSpace.id)).resolves.toMatchObject({
      name: "entry-enc:vault-key:Private project",
      description: "entry-enc:vault-key:Notes I do not want exposed",
    });
    await expect(db.journalSpaceCaptures.get("capture-corrupt")).resolves.toMatchObject({
      title: "entry-enc:vault-key:Decision I am considering",
      fields: [
        {
          prompt: "entry-enc:vault-key:What matters?",
          value: "entry-enc:vault-key:A private answer",
        },
      ],
    });
  });

  it("preserves legitimate plaintext storage when diary protection is not enabled", async () => {
    const saved = await saveJournalSpace(customSpace);

    expect(saved.name).toBe(customSpace.name);
    await expect(db.journalSpaces.get(customSpace.id)).resolves.toMatchObject({
      name: customSpace.name,
      description: customSpace.description,
    });
  });
});
