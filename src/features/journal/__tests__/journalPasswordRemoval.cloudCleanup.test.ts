import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ownerUserId: "account-a",
  operationRevision: "100:removalrevision1",
  supabase: null as {
    from?: ReturnType<typeof vi.fn>;
    rpc?: ReturnType<typeof vi.fn>;
  } | null,
  validateSyncOwner: vi.fn(),
  localJournalBackup: {
    journalEntries: [] as Array<Record<string, unknown>>,
    journalPhotos: [] as Array<Record<string, unknown>>,
    journalAudio: [] as Array<Record<string, unknown>>,
    journalSpaces: [] as Array<Record<string, unknown>>,
    journalSpaceCaptures: [] as Array<Record<string, unknown>>,
  },
  getLocalDataOwnerId: vi.fn(),
  getRemovalIntent: vi.fn(),
  writeExactEvent: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  get supabase() {
    return mocks.supabase;
  },
}));

vi.mock("@/storage/db", () => {
  const table = (field: keyof typeof mocks.localJournalBackup) => ({
    toArray: vi.fn(async () => mocks.localJournalBackup[field]),
  });
  return {
    getLocalDataOwnerId: mocks.getLocalDataOwnerId,
    db: {
      settings: {
        get: mocks.getRemovalIntent,
      },
      journalEntries: table("journalEntries"),
      journalPhotos: table("journalPhotos"),
      journalAudio: table("journalAudio"),
      journalSpaces: table("journalSpaces"),
      journalSpaceCaptures: table("journalSpaceCaptures"),
      transaction: vi.fn(async (...args: unknown[]) => {
        const operation = args.at(-1) as () => unknown;
        return operation();
      }),
    },
  };
});

vi.mock("@/storage/sync/syncOwner", () => ({
  validateSyncOwner: mocks.validateSyncOwner,
}));

vi.mock("@/storage/eventSync", () => ({
  writeExactEventAndBroadcast: mocks.writeExactEvent,
}));

vi.mock("../journalCrypto", () => ({
  isEncryptedJournalContent: (value: unknown) =>
    typeof value === "string" && value.startsWith("entry-enc:"),
}));

vi.mock("../journalMediaCrypto", () => ({
  isEncryptedJournalMediaData: (value: unknown) =>
    typeof value === "string" && value.startsWith("media-enc:"),
}));

import {
  beginRemoteJournalPasswordRemoval,
  commitRemoteJournalPasswordRemovalEntry,
  deleteRemoteJournalPasswordRemovalArtifact,
  finalizeRemoteJournalPasswordRemoval,
  patchJournalBackupForPasswordRemoval,
  recoverRemoteJournalPasswordRemoval,
  reserveRemoteJournalPasswordRemovalMedia,
  RemoteProtectedJournalDataError,
  verifyRemoteJournalIsUnprotected,
} from "@/storage/sync/journalRemovalRemote";

const input = () => ({
  expectedOwnerUserId: mocks.ownerUserId,
  expectedVaultRevision: 101,
  operationRevision: mocks.operationRevision,
  localCommitInventory: {
    version: 1 as const,
    entryIds: ["entry-local"],
    photoIds: [],
    audioIds: [],
    spaceIds: [],
    captureIds: [],
    postimages: {
      entries: [
        {
          id: "entry-local",
          postimageBackupSha256:
            "46f592919bedff994e3f1d0d55dd2dba424159416af802ee364a1f71fa20ff30",
        },
      ],
      photos: [],
      audios: [],
      spaces: [],
      captures: [],
    },
  },
});

const emptyInventory = {
  version: 1 as const,
  entries: [],
  photos: [],
  audios: [],
  spaces: [],
  captures: [],
  storageObjects: [],
};

const localBackup = {
  schemaVersion: 3,
  createdAt: "2026-08-03T00:00:00.000Z",
  deviceId: "test-device",
  data: {
    moods: [{ id: "local-mood" }],
    habits: [{ id: "local-habit" }],
    focusSessions: [],
    gratitudeEntries: [],
    settings: [],
    journalEntries: [{ id: "entry-local", content: "plain" }],
    journalPhotos: [],
    journalAudio: [],
    journalHubPreferences: [],
    journalSpaces: [],
    journalPracticeSessions: [],
    journalEntryLinks: [],
    journalSpaceCaptures: [],
  },
  deletedJournalEntryIds: ["entry-deleted-local"],
};

function backupMutationSupabase(remote: unknown, committed: unknown) {
  const fetchMaybeSingle = vi.fn(async () => ({ data: remote, error: null }));
  const fetchQuery = { maybeSingle: fetchMaybeSingle };
  const fetchEq = vi.fn(() => fetchQuery);
  const table = {
    select: vi.fn(() => ({ eq: fetchEq })),
    update: vi.fn(),
    insert: vi.fn(),
  };
  const rpcResult = { data: committed, error: null };
  const rpcRequest = {
    abortSignal: vi.fn(() => Promise.resolve(rpcResult)),
    then: (
      resolve: (value: typeof rpcResult) => unknown,
      reject: (reason: unknown) => unknown
    ) => Promise.resolve(rpcResult).then(resolve, reject),
  };
  const rpc = vi.fn(() => rpcRequest);
  return { supabase: { from: vi.fn(() => table), rpc }, table, rpc };
}

type RemoteResult = { data: Array<Record<string, unknown>>; error: null };

function pagedQuery(
  pages: RemoteResult[],
  rangeCalls: Array<[number, number]>,
  abortCalls: AbortSignal[]
) {
  let pageIndex = 0;
  const query = {
    eq: vi.fn(() => query),
    range: vi.fn((from: number, to: number) => {
      rangeCalls.push([from, to]);
      pageIndex = Math.floor(from / 500);
      return query;
    }),
    abortSignal: vi.fn((signal: AbortSignal) => {
      abortCalls.push(signal);
      return query;
    }),
    then: (resolve: (value: RemoteResult) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(pages[pageIndex] ?? { data: [], error: null }).then(resolve, reject),
  };
  return query;
}

function verificationSupabase(options: {
  entryPages?: RemoteResult[];
  signalCalls?: AbortSignal[];
}) {
  const rangeCalls: Record<string, Array<[number, number]>> = {
    journal_entries: [],
    journal_photos: [],
    journal_audio: [],
  };
  const signalCalls = options.signalCalls ?? [];
  const pages: Record<string, RemoteResult[]> = {
    journal_entries: options.entryPages ?? [{ data: [], error: null }],
    journal_photos: [{ data: [], error: null }],
    journal_audio: [{ data: [], error: null }],
  };
  const backupQuery = {
    maybeSingle: vi.fn(async () => ({
      data: { payload: { schemaVersion: 3, data: {} } },
      error: null,
    })),
    abortSignal: vi.fn((signal: AbortSignal) => {
      signalCalls.push(signal);
      return backupQuery;
    }),
  };
  const from = vi.fn((table: string) => ({
    select: vi.fn(() => {
      if (table === "user_backups") {
        return { eq: vi.fn(() => backupQuery) };
      }
      return pagedQuery(pages[table], rangeCalls[table], signalCalls);
    }),
  }));
  return { supabase: { from }, rangeCalls, signalCalls };
}

function rpcSupabase(status: unknown, error: unknown = null) {
  const signalCalls: AbortSignal[] = [];
  const result = { data: status, error };
  const request = {
    abortSignal: vi.fn((signal: AbortSignal) => {
      signalCalls.push(signal);
      return Promise.resolve(result);
    }),
    then: (resolve: (value: typeof result) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  const rpc = vi.fn(() => request);
  return { supabase: { rpc }, rpc, request, signalCalls };
}

function rpcSequenceSupabase(responses: unknown[]) {
  const signalCalls: AbortSignal[] = [];
  let responseIndex = 0;
  const rpc = vi.fn(() => {
    const result = {
      data: responses[responseIndex++],
      error: null,
    };
    return {
      abortSignal: vi.fn((signal: AbortSignal) => {
        signalCalls.push(signal);
        return Promise.resolve(result);
      }),
      then: (
        resolve: (value: typeof result) => unknown,
        reject: (reason: unknown) => unknown
      ) => Promise.resolve(result).then(resolve, reject),
    };
  });
  return { supabase: { rpc }, rpc, signalCalls };
}

function canonicalReceiptJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalReceiptJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.entries(record)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalReceiptJson(item)}`)
    .join(",")}}`;
}

async function buildEventReceipt(input: {
  entityType: "journal" | "setting";
  entityId: string;
  op: "upsert" | "delete";
  payload: Record<string, unknown>;
  idempotencyKey: string;
}) {
  const payloadSha256 = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(canonicalReceiptJson(input.payload))
      )
    ),
    (byte) => byte.toString(16).padStart(2, "0")
  ).join("");
  return {
    ...input,
    deviceId: "server:journal-password-removal",
    payloadSha256,
  };
}

async function buildVaultReceipt(
  operationRevision = mocks.operationRevision,
  vaultRevision = 101
) {
  return buildEventReceipt({
    entityType: "setting",
    entityId: "journal_vault_key",
    op: "delete",
    payload: {
      key: "journal_vault_key",
      operationRevision,
      removalOperationRevision: operationRevision,
      vaultRevision,
    },
    idempotencyKey: "00000000-0000-3000-8000-000000000001",
  });
}

describe("journal password removal cloud cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getLocalDataOwnerId.mockResolvedValue(mocks.ownerUserId);
    mocks.getRemovalIntent.mockResolvedValue({
      value: {
        version: 2,
        operationRevision: mocks.operationRevision,
      },
    });
    mocks.validateSyncOwner.mockResolvedValue(mocks.ownerUserId);
    mocks.localJournalBackup.journalEntries = [...localBackup.data.journalEntries];
    mocks.localJournalBackup.journalPhotos = [...localBackup.data.journalPhotos];
    mocks.localJournalBackup.journalAudio = [...localBackup.data.journalAudio];
    mocks.localJournalBackup.journalSpaces = [...localBackup.data.journalSpaces];
    mocks.localJournalBackup.journalSpaceCaptures = [
      ...localBackup.data.journalSpaceCaptures,
    ];
    mocks.writeExactEvent.mockResolvedValue({ seq: 1 });
  });

  it("keeps the removal backup patch scoped to journal tables instead of the whole backup runtime", () => {
    const source = readFileSync("src/storage/sync/journalRemovalRemote.ts", "utf8");

    expect(source).not.toMatch(/from\s+["']@\/storage\/backup["']/);
    expect(source).toContain("db.journalEntries");
    expect(source).toContain("db.journalPhotos");
    expect(source).toContain("db.journalAudio");
    expect(source).toContain("db.journalSpaces");
    expect(source).toContain("db.journalSpaceCaptures");
  });

  it("sends only the five journal collections to the server-side backup patch", async () => {
    const remote = {
      payload: {
        schemaVersion: 3,
        createdAt: "2026-08-01T00:00:00.000Z",
        deviceId: "remote-device",
        data: {
          moods: [{ id: "remote-mood" }],
          habits: [{ id: "remote-habit" }],
          focusSessions: [{ id: "remote-focus" }],
          gratitudeEntries: [{ id: "remote-gratitude" }],
          settings: [{ key: "remote-setting" }],
          journalEntries: [{ id: "entry-local", content: "entry-enc:vault:plain" }],
        },
        deletedMoodIds: ["remote-deleted-mood"],
        deletedJournalEntryIds: ["entry-deleted-remote"],
      },
      updated_at: "2026-08-02T12:00:00.000Z",
      vault_revision: 101,
    };
    const setup = backupMutationSupabase(remote, { status: "committed" });
    mocks.supabase = setup.supabase;

    await expect(patchJournalBackupForPasswordRemoval(input())).resolves.toEqual({
      status: "committed",
    });

    expect(setup.rpc).toHaveBeenCalledWith(
      "commit_journal_password_removal_backup",
      expect.objectContaining({
        p_expected_vault_revision: 101,
        p_operation_revision: mocks.operationRevision,
        p_journal_patch: expect.objectContaining({
            journalEntries: localBackup.data.journalEntries,
            journalPhotos: [],
            journalAudio: [],
            journalSpaces: [],
            journalSpaceCaptures: [],
        }),
        p_deleted_inventory: { entryIds: [], photoIds: [], audioIds: [] },
      })
    );
    const rpcArgs = (
      setup.rpc.mock.calls as unknown as Array<[string, Record<string, unknown>]>
    )[0]?.[1];
    expect(rpcArgs).not.toHaveProperty("p_payload");
    expect(rpcArgs).not.toHaveProperty("p_expected_updated_at");
    expect(rpcArgs).not.toHaveProperty("p_updated_at");
    expect(setup.table.update).not.toHaveBeenCalled();
    expect(setup.table.insert).not.toHaveBeenCalled();
  });

  it("refuses a valid-shaped same-id backup postimage that differs from the local commit receipt", async () => {
    mocks.localJournalBackup.journalEntries = [
      { id: "entry-local", content: "different but valid plaintext" },
    ];
    const setup = backupMutationSupabase(
      {
        payload: { ...localBackup, data: { ...localBackup.data } },
        vault_revision: 101,
      },
      { status: "committed" }
    );
    mocks.supabase = setup.supabase;

    await expect(patchJournalBackupForPasswordRemoval(input())).rejects.toMatchObject({
      name: "RequiredRemoteCommitError",
      outcome: "stale",
    });
    expect(setup.rpc).not.toHaveBeenCalled();
  });

  it("refuses a new local journal item that has no operation-bound postimage receipt", async () => {
    mocks.localJournalBackup.journalEntries = [
      ...localBackup.data.journalEntries,
      { id: "entry-created-after-commit", content: "valid plaintext" },
    ];
    const setup = backupMutationSupabase(
      {
        payload: { ...localBackup, data: { ...localBackup.data } },
        vault_revision: 101,
      },
      { status: "committed" }
    );
    mocks.supabase = setup.supabase;

    await expect(patchJournalBackupForPasswordRemoval(input())).rejects.toMatchObject({
      name: "RequiredRemoteCommitError",
      outcome: "stale",
    });
    expect(setup.rpc).not.toHaveBeenCalled();
  });

  it("treats a zero-row backup CAS acknowledgement as stale", async () => {
    const setup = backupMutationSupabase(
      {
        payload: { ...localBackup, data: { ...localBackup.data } },
        updated_at: "2026-08-02T12:00:00.000Z",
      },
      null
    );
    mocks.supabase = setup.supabase;

    await expect(patchJournalBackupForPasswordRemoval(input())).rejects.toMatchObject({
      name: "RequiredRemoteCommitError",
      outcome: "stale",
    });
  });

  it("never replaces protected backup-only spaces or captures from an incomplete local snapshot", async () => {
    mocks.localJournalBackup.journalEntries = [];
    mocks.localJournalBackup.journalSpaces = [];
    mocks.localJournalBackup.journalSpaceCaptures = [];
    const remote = {
      payload: {
        ...localBackup,
        data: {
          ...localBackup.data,
          journalEntries: [],
          journalSpaces: [{ id: "remote-space", name: "entry-enc:vault:private space" }],
          journalSpaceCaptures: [
            {
              id: "remote-capture",
              spaceId: "remote-space",
              spaceName: "entry-enc:vault:private space",
              title: "entry-enc:vault:private capture",
              fields: [],
            },
          ],
        },
      },
      updated_at: "2026-08-02T12:00:00.000Z",
      vault_revision: 101,
    };
    const setup = backupMutationSupabase(remote, "committed");
    mocks.supabase = setup.supabase;

    await expect(patchJournalBackupForPasswordRemoval(input())).rejects.toMatchObject({
      name: "RequiredRemoteCommitError",
      outcome: "stale",
    });

    expect(setup.table.update).not.toHaveBeenCalled();
  });

  it("fails closed on remote-only plaintext journal items without a deletion receipt", async () => {
    mocks.localJournalBackup.journalEntries = [];
    mocks.localJournalBackup.journalSpaces = [];
    mocks.localJournalBackup.journalSpaceCaptures = [];
    const remoteSpace = { id: "remote-space", name: "Recovered private space" };
    const remoteCapture = {
      id: "remote-capture",
      spaceId: "remote-space",
      spaceName: "Recovered private space",
      title: "Recovered capture",
      fields: [],
    };
    const remote = {
      payload: {
        ...localBackup,
        data: {
          ...localBackup.data,
          journalEntries: [],
          journalSpaces: [remoteSpace],
          journalSpaceCaptures: [remoteCapture],
        },
      },
      updated_at: "2026-08-02T12:00:00.000Z",
      vault_revision: null,
    };
    const setup = backupMutationSupabase(remote, "committed");
    mocks.supabase = setup.supabase;

    await expect(patchJournalBackupForPasswordRemoval(input())).rejects.toMatchObject({
      name: "RequiredRemoteCommitError",
      outcome: "stale",
    });

    expect(setup.table.update).not.toHaveBeenCalled();
  });

  it("does not create an incomplete backup when export omits an inventory member", async () => {
    const setup = backupMutationSupabase(null, "committed");
    mocks.supabase = setup.supabase;

    await expect(
      patchJournalBackupForPasswordRemoval({
        ...input(),
        localCommitInventory: {
          ...input().localCommitInventory,
          photoIds: ["photo-missing-from-export"],
        },
      })
    ).rejects.toMatchObject({
      name: "RequiredRemoteCommitError",
      outcome: "stale",
    });

    expect(setup.table.insert).not.toHaveBeenCalled();
    expect(setup.table.update).not.toHaveBeenCalled();
  });

  it("does not replace a good remote item with a malformed same-id local projection", async () => {
    mocks.localJournalBackup.journalEntries = [
      { id: "entry-local", content: { corrupt: true } },
    ];
    const remote = {
      payload: {
        ...localBackup,
        data: {
          ...localBackup.data,
          journalEntries: [{ id: "entry-local", content: "good remote entry" }],
        },
      },
      updated_at: "2026-08-02T12:00:00.000Z",
      vault_revision: 101,
    };
    const setup = backupMutationSupabase(remote, "committed");
    mocks.supabase = setup.supabase;

    await expect(patchJournalBackupForPasswordRemoval(input())).rejects.toMatchObject({
      name: "RequiredRemoteCommitError",
      outcome: "stale",
    });
    expect(setup.table.update).not.toHaveBeenCalled();
  });

  it("checks pages after the Supabase row limit before acknowledging cleanup", async () => {
    const firstPage = Array.from({ length: 500 }, (_, index) => ({
      content: `plain-${index}`,
    }));
    const setup = verificationSupabase({
      entryPages: [
        { data: firstPage, error: null },
        { data: [{ content: "entry-enc:still-protected" }], error: null },
      ],
    });
    mocks.supabase = setup.supabase;

    await expect(verifyRemoteJournalIsUnprotected(input())).rejects.toBeInstanceOf(
      RemoteProtectedJournalDataError
    );
    expect(setup.rangeCalls.journal_entries).toEqual([
      [0, 499],
      [500, 999],
    ]);
  });

  it("binds an AbortSignal to every paged table and backup verification read", async () => {
    const controller = new AbortController();
    const signalCalls: AbortSignal[] = [];
    const setup = verificationSupabase({ signalCalls });
    mocks.supabase = setup.supabase;

    await expect(
      verifyRemoteJournalIsUnprotected({ ...input(), signal: controller.signal })
    ).resolves.toEqual({ status: "committed" });

    expect(signalCalls).toHaveLength(4);
    expect(signalCalls.every((signal) => signal === controller.signal)).toBe(true);
  });

  it("starts the exact owner-bound server fence before remote cleanup", async () => {
    const setup = rpcSupabase("ready");
    mocks.supabase = setup.supabase;

    await expect(
      beginRemoteJournalPasswordRemoval({
        ...input(),
        expectedVaultRevision: 101,
        inventory: emptyInventory,
      })
    ).resolves.toBe("ready");

    expect(setup.rpc).toHaveBeenCalledWith("begin_journal_password_removal", {
      p_expected_vault_revision: 101,
      p_operation_revision: mocks.operationRevision,
      p_inventory: emptyInventory,
    });
  });

  it("rejects the server fence before RPC when the local diary owner is not adopted", async () => {
    const setup = rpcSupabase("ready");
    mocks.supabase = setup.supabase;
    mocks.getLocalDataOwnerId.mockResolvedValue(null);

    await expect(
      beginRemoteJournalPasswordRemoval({
        ...input(),
        expectedVaultRevision: 101,
        inventory: emptyInventory,
      })
    ).rejects.toMatchObject({
      name: "RequiredRemoteCommitError",
      outcome: "stale",
    });

    expect(setup.rpc).not.toHaveBeenCalled();
  });

  it("binds a media reservation to the exact path, digest, size, and MIME", async () => {
    const setup = rpcSupabase("reserved");
    mocks.supabase = setup.supabase;

    await expect(
      reserveRemoteJournalPasswordRemovalMedia({
        ...input(),
        bucket: "journal-photos",
        entityId: "photo-1",
        storagePath: "account-a/removal/100:removalrevision1/photo-1.jpg",
        contentSha256: "a".repeat(64),
        contentSize: 128,
        mimeType: "image/jpeg",
      })
    ).resolves.toEqual({ status: "committed" });

    expect(setup.rpc).toHaveBeenCalledWith("reserve_journal_password_removal_media", {
      p_expected_vault_revision: 101,
      p_operation_revision: mocks.operationRevision,
      p_bucket_id: "journal-photos",
      p_entity_id: "photo-1",
      p_storage_path: "account-a/removal/100:removalrevision1/photo-1.jpg",
      p_content_sha256: "a".repeat(64),
      p_content_size: 128,
      p_mime_type: "image/jpeg",
    });
  });

  it("does not publish journal content or an event before atomic finalization", async () => {
    const setup = rpcSupabase({ status: "committed" });
    mocks.supabase = setup.supabase;

    await expect(
      commitRemoteJournalPasswordRemovalEntry({
        ...input(),
        entry: {
          id: "entry-local",
          date: "2026-08-03",
          title: "",
          content: "plain",
          stickers: [],
          photoIds: [],
          tags: [],
          createdAt: 1,
          updatedAt: 2,
        },
      })
    ).resolves.toEqual({ status: "committed" });

    expect(mocks.writeExactEvent).not.toHaveBeenCalled();
  });

  it("binds frozen entry, photo, and audio deletions to the exact removal operation", async () => {
    const setup = rpcSupabase({ status: "committed" });
    mocks.supabase = setup.supabase;
    const parentEntry = {
      id: "entry-local",
      date: "2026-08-03",
      title: "",
      content: "plain",
      stickers: [],
      photoIds: [],
      audioIds: [],
      tags: [],
      createdAt: 1,
      updatedAt: 2,
    };

    await expect(
      deleteRemoteJournalPasswordRemovalArtifact({
        ...input(),
        surface: "entry",
        entityId: "entry-deleted",
      }),
    ).resolves.toEqual({ status: "committed" });
    await expect(
      deleteRemoteJournalPasswordRemovalArtifact({
        ...input(),
        surface: "photo",
        entityId: "photo-deleted",
        parentEntry,
      }),
    ).resolves.toEqual({ status: "committed" });
    await expect(
      deleteRemoteJournalPasswordRemovalArtifact({
        ...input(),
        surface: "audio",
        entityId: "audio-deleted",
        parentEntry,
      }),
    ).resolves.toEqual({ status: "committed" });

    expect(setup.rpc).toHaveBeenNthCalledWith(1, "delete_journal_password_removal_artifact", {
      p_expected_vault_revision: 101,
      p_operation_revision: mocks.operationRevision,
      p_surface: "entry",
      p_entity_id: "entry-deleted",
      p_parent_entry: null,
    });
    expect(setup.rpc).toHaveBeenNthCalledWith(2, "delete_journal_password_removal_artifact", {
      p_expected_vault_revision: 101,
      p_operation_revision: mocks.operationRevision,
      p_surface: "photo",
      p_entity_id: "photo-deleted",
      p_parent_entry: expect.objectContaining({
        id: "entry-local",
        user_id: mocks.ownerUserId,
        photo_ids: [],
        audio_ids: [],
        vault_revision: null,
      }),
    });
    expect(setup.rpc).toHaveBeenNthCalledWith(3, "delete_journal_password_removal_artifact", {
      p_expected_vault_revision: 101,
      p_operation_revision: mocks.operationRevision,
      p_surface: "audio",
      p_entity_id: "audio-deleted",
      p_parent_entry: expect.objectContaining({
        id: "entry-local",
        user_id: mocks.ownerUserId,
        photo_ids: [],
        audio_ids: [],
        vault_revision: null,
      }),
    });
    expect(mocks.writeExactEvent).not.toHaveBeenCalled();
  });

  it("publishes the privacy-safe manifest in vault-first order before server acknowledgement", async () => {
    const vaultReceipt = await buildVaultReceipt();
    const refetchReceipt = await buildEventReceipt({
      entityType: "journal",
      entityId: "entry-local",
      op: "upsert",
      payload: {
        journalRemovalRefetch: true,
        removalOperationRevision: mocks.operationRevision,
        vaultRevision: 101,
      },
      idempotencyKey: "00000000-0000-3000-8000-000000000002",
    });
    const setup = rpcSequenceSupabase([
      { status: "complete", eventReceipts: [vaultReceipt, refetchReceipt] },
      "acknowledged",
    ]);
    mocks.supabase = setup.supabase;

    await expect(finalizeRemoteJournalPasswordRemoval(input())).resolves.toEqual({
      status: "committed",
    });

    expect(mocks.writeExactEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        entityType: "setting",
        entityId: "journal_vault_key",
        op: "delete",
      }),
      mocks.ownerUserId
    );
    expect(mocks.writeExactEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        entityType: "journal",
        entityId: "entry-local",
        op: "upsert",
        payload: {
          journalRemovalRefetch: true,
          removalOperationRevision: mocks.operationRevision,
          vaultRevision: 101,
        },
      }),
      mocks.ownerUserId
    );
    expect(setup.rpc).toHaveBeenNthCalledWith(
      2,
      "acknowledge_journal_password_removal_events",
      {
        p_expected_vault_revision: 101,
        p_operation_revision: mocks.operationRevision,
      }
    );
    expect(mocks.writeExactEvent.mock.invocationCallOrder[1]).toBeLessThan(
      setup.rpc.mock.invocationCallOrder[1]
    );
  });

  it("maps atomic finalization protected-data without exposing remote rows", async () => {
    const setup = rpcSupabase({ status: "protected-data" });
    mocks.supabase = setup.supabase;

    await expect(
      finalizeRemoteJournalPasswordRemoval({
        ...input(),
        expectedVaultRevision: 101,
      })
    ).rejects.toBeInstanceOf(RemoteProtectedJournalDataError);
    expect(setup.rpc).toHaveBeenCalledWith("finalize_journal_password_removal", {
      p_expected_vault_revision: 101,
      p_operation_revision: mocks.operationRevision,
    });
  });

  it("binds cancellation to the atomic finalization RPC", async () => {
    const controller = new AbortController();
    const setup = rpcSequenceSupabase([
      { status: "complete", eventReceipts: [await buildVaultReceipt()] },
      "acknowledged",
    ]);
    mocks.supabase = setup.supabase;

    await expect(
      finalizeRemoteJournalPasswordRemoval({
        ...input(),
        expectedVaultRevision: 101,
        signal: controller.signal,
      })
    ).resolves.toEqual({ status: "committed" });
    expect(setup.signalCalls).toEqual([controller.signal, controller.signal]);
  });

  it("reads only typed owner-bound forward-recovery metadata", async () => {
    const setup = rpcSupabase({
      status: "manual-recovery-required",
      operationRevision: "100:orphanoperation",
      vaultRevision: 101,
    });
    mocks.supabase = setup.supabase;

    await expect(
      recoverRemoteJournalPasswordRemoval({ expectedOwnerUserId: mocks.ownerUserId })
    ).resolves.toEqual({
      status: "manual-recovery-required",
      operationRevision: "100:orphanoperation",
      vaultRevision: 101,
    });
    expect(setup.rpc).toHaveBeenCalledWith("recover_journal_password_removal");
  });

  it("retains the completed server epoch so an offline protected device can converge locally", async () => {
    const operationRevision = "100:orphanoperation";
    const setup = rpcSequenceSupabase([
      {
        status: "complete",
        operationRevision,
        vaultRevision: 101,
        eventReceipts: [await buildVaultReceipt(operationRevision)],
      },
      "acknowledged",
    ]);
    mocks.supabase = setup.supabase;

    await expect(
      recoverRemoteJournalPasswordRemoval({ expectedOwnerUserId: mocks.ownerUserId })
    ).resolves.toEqual({
      status: "complete",
      operationRevision: "100:orphanoperation",
      vaultRevision: 101,
    });
  });
});
