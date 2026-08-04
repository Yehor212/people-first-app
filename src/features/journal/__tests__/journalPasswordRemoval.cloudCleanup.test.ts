import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ownerUserId: "account-a",
  operationRevision: "removal-revision-1",
  supabase: null as {
    from?: ReturnType<typeof vi.fn>;
    rpc?: ReturnType<typeof vi.fn>;
  } | null,
  validateSyncOwner: vi.fn(),
  exportBackup: vi.fn(),
  getLocalDataOwnerId: vi.fn(),
  getRemovalIntent: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  get supabase() {
    return mocks.supabase;
  },
}));

vi.mock("@/storage/db", () => ({
  getLocalDataOwnerId: mocks.getLocalDataOwnerId,
  db: {
    settings: {
      get: mocks.getRemovalIntent,
    },
  },
}));

vi.mock("@/storage/backup", () => ({
  exportBackup: mocks.exportBackup,
}));

vi.mock("@/storage/sync/syncOwner", () => ({
  validateSyncOwner: mocks.validateSyncOwner,
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
  finalizeRemoteJournalPasswordRemoval,
  patchJournalBackupForPasswordRemoval,
  recoverRemoteJournalPasswordRemoval,
  RemoteProtectedJournalDataError,
  verifyRemoteJournalIsUnprotected,
} from "@/storage/sync/journalRemovalRemote";

const input = () => ({
  expectedOwnerUserId: mocks.ownerUserId,
  operationRevision: mocks.operationRevision,
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
  const mutationMaybeSingle = vi.fn(async () => ({ data: committed, error: null }));
  const mutationQuery = { maybeSingle: mutationMaybeSingle };
  const updateChain: {
    eq: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
  } = {
    eq: vi.fn(),
    select: vi.fn(() => mutationQuery),
  };
  updateChain.eq.mockReturnValue(updateChain);
  const insertChain = { select: vi.fn(() => mutationQuery) };
  const table = {
    select: vi.fn(() => ({ eq: fetchEq })),
    update: vi.fn(() => updateChain),
    insert: vi.fn(() => insertChain),
  };
  return { supabase: { from: vi.fn(() => table) }, table, updateChain };
}

type RemoteResult = { data: Array<Record<string, unknown>>; error: null };

function pagedQuery(
  pages: RemoteResult[],
  rangeCalls: Array<[number, number]>,
  abortCalls: AbortSignal[],
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
    then: (
      resolve: (value: RemoteResult) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve(pages[pageIndex] ?? { data: [], error: null }).then(resolve, reject),
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

function rpcSupabase(status: string, error: unknown = null) {
  const signalCalls: AbortSignal[] = [];
  const result = { data: status, error };
  const request = {
    abortSignal: vi.fn((signal: AbortSignal) => {
      signalCalls.push(signal);
      return Promise.resolve(result);
    }),
    then: (
      resolve: (value: typeof result) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  const rpc = vi.fn(() => request);
  return { supabase: { rpc }, rpc, request, signalCalls };
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
    mocks.exportBackup.mockResolvedValue(localBackup);
  });

  it("patches only journal backup domains and requires the remote updated_at CAS", async () => {
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
          journalEntries: [{ id: "old-encrypted-entry" }],
        },
        deletedMoodIds: ["remote-deleted-mood"],
        deletedJournalEntryIds: ["entry-deleted-remote"],
      },
      updated_at: "2026-08-02T12:00:00.000Z",
    };
    const setup = backupMutationSupabase(remote, { user_id: mocks.ownerUserId });
    mocks.supabase = setup.supabase;

    await expect(patchJournalBackupForPasswordRemoval(input())).resolves.toEqual({
      status: "committed",
    });

    expect(setup.table.update).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          data: expect.objectContaining({
            moods: remote.payload.data.moods,
            habits: remote.payload.data.habits,
            focusSessions: remote.payload.data.focusSessions,
            gratitudeEntries: remote.payload.data.gratitudeEntries,
            settings: remote.payload.data.settings,
            journalEntries: localBackup.data.journalEntries,
          }),
          deletedMoodIds: remote.payload.deletedMoodIds,
          deletedJournalEntryIds: [
            "entry-deleted-remote",
            "entry-deleted-local",
          ],
        }),
        updated_at: expect.any(String),
      }),
    );
    expect(setup.updateChain.eq).toHaveBeenNthCalledWith(1, "user_id", mocks.ownerUserId);
    expect(setup.updateChain.eq).toHaveBeenNthCalledWith(
      2,
      "updated_at",
      remote.updated_at,
    );
  });

  it("treats a zero-row backup CAS acknowledgement as stale", async () => {
    const setup = backupMutationSupabase(
      {
        payload: { ...localBackup, data: { ...localBackup.data } },
        updated_at: "2026-08-02T12:00:00.000Z",
      },
      null,
    );
    mocks.supabase = setup.supabase;

    await expect(patchJournalBackupForPasswordRemoval(input())).rejects.toMatchObject({
      name: "RequiredRemoteCommitError",
      outcome: "stale",
    });
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
      RemoteProtectedJournalDataError,
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
      verifyRemoteJournalIsUnprotected({ ...input(), signal: controller.signal }),
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
      }),
    ).resolves.toBe("ready");

    expect(setup.rpc).toHaveBeenCalledWith("begin_journal_password_removal", {
      p_expected_vault_revision: 101,
      p_operation_revision: mocks.operationRevision,
      p_inventory: emptyInventory,
    });
  });

  it("maps atomic finalization protected-data without exposing remote rows", async () => {
    const setup = rpcSupabase("protected-data");
    mocks.supabase = setup.supabase;

    await expect(
      finalizeRemoteJournalPasswordRemoval({
        ...input(),
        expectedVaultRevision: 101,
      }),
    ).rejects.toBeInstanceOf(RemoteProtectedJournalDataError);
    expect(setup.rpc).toHaveBeenCalledWith("finalize_journal_password_removal", {
      p_expected_vault_revision: 101,
      p_operation_revision: mocks.operationRevision,
    });
  });

  it("binds cancellation to the atomic finalization RPC", async () => {
    const controller = new AbortController();
    const setup = rpcSupabase("complete");
    mocks.supabase = setup.supabase;

    await expect(
      finalizeRemoteJournalPasswordRemoval({
        ...input(),
        expectedVaultRevision: 101,
        signal: controller.signal,
      }),
    ).resolves.toEqual({ status: "committed" });
    expect(setup.signalCalls).toEqual([controller.signal]);
  });

  it("reads only typed owner-bound forward-recovery metadata", async () => {
    const setup = rpcSupabase({
      status: "manual-recovery-required",
      operationRevision: "100:orphanoperation",
      vaultRevision: 101,
    } as unknown as string);
    mocks.supabase = setup.supabase;

    await expect(
      recoverRemoteJournalPasswordRemoval({ expectedOwnerUserId: mocks.ownerUserId }),
    ).resolves.toEqual({
      status: "manual-recovery-required",
      operationRevision: "100:orphanoperation",
      vaultRevision: 101,
    });
    expect(setup.rpc).toHaveBeenCalledWith("recover_journal_password_removal");
  });

  it("retains the completed server epoch so an offline protected device can converge locally", async () => {
    const setup = rpcSupabase({
      status: "complete",
      operationRevision: "100:orphanoperation",
      vaultRevision: 101,
    } as unknown as string);
    mocks.supabase = setup.supabase;

    await expect(
      recoverRemoteJournalPasswordRemoval({ expectedOwnerUserId: mocks.ownerUserId }),
    ).resolves.toEqual({
      status: "complete",
      operationRevision: "100:orphanoperation",
      vaultRevision: 101,
    });
  });
});
