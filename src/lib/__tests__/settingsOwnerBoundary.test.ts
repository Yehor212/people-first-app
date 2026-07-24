import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertOriginGeneration: vi.fn(),
  captureOriginGeneration: vi.fn(() => "settings-generation-a"),
  getDataOwner: vi.fn(),
  getVerifiedCurrentSessionUserId: vi.fn<() => Promise<string | null>>(),
  readCleanupMarker: vi.fn<() => { ok: true; value: string | null } | { ok: false; value: null }>(
    () => ({ ok: true, value: null })
  ),
  runWithSettledDataRead: vi.fn(async <T>(operation: () => Promise<T>): Promise<T> => operation()),
}));

vi.mock("@/lib/supabaseClient", () => ({
  getVerifiedCurrentSessionUserId: mocks.getVerifiedCurrentSessionUserId,
}));

vi.mock("@/hooks/useIndexedDB", () => ({
  runWithSettledDataRead: mocks.runWithSettledDataRead,
}));

vi.mock("@/lib/safeJson", () => ({
  storageReadRaw: mocks.readCleanupMarker,
}));

vi.mock("@/storage/accountBoundaryRuntime", () => ({
  assertOriginAccountBoundaryGeneration: mocks.assertOriginGeneration,
  captureOriginAccountBoundaryGeneration: mocks.captureOriginGeneration,
}));

vi.mock("@/storage/db", () => ({
  db: {
    settings: {
      get: mocks.getDataOwner,
    },
  },
}));

import {
  assertSettingsDataOwnerCurrentWithinTransaction,
  assertSettingsExternalOwnerCurrentWithinDataWriteBarrier,
  assertSettingsOwnerCurrent,
  assertSettingsOwnerCurrentWithinDataWriteBarrier,
  readVerifiedSettingsOwnerRealm,
  SettingsOwnerBoundaryError,
} from "@/lib/settingsOwnerBoundary";
import { SK } from "@/lib/storageKeys";

const ACCOUNT_A = "1d4fe896-fd48-4f4f-a32e-f12d5618ed7a";
const ACCOUNT_B = "404f1914-ce47-4c35-bdd2-b9461a560244";

describe("settingsOwnerBoundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.captureOriginGeneration.mockReturnValue("settings-generation-a");
    mocks.getVerifiedCurrentSessionUserId.mockResolvedValue(null);
    mocks.getDataOwner.mockResolvedValue(undefined);
    mocks.readCleanupMarker.mockReturnValue({ ok: true, value: null });
    mocks.runWithSettledDataRead.mockImplementation(
      async <T>(operation: () => Promise<T>): Promise<T> => operation()
    );
  });

  it.each([
    ["getSession returns an auth error", new Error("auth storage unavailable")],
    ["getSession throws", new Error("auth adapter threw")],
  ])("fails closed when Supabase %s", async (_label, authFailure) => {
    mocks.getVerifiedCurrentSessionUserId.mockRejectedValue(authFailure);

    await expect(readVerifiedSettingsOwnerRealm("Backup export")).rejects.toMatchObject({
      name: "SettingsOwnerBoundaryError",
      cause: authFailure,
    });
  });

  it("rejects a confirmed null session while durable data belongs to an account", async () => {
    mocks.getVerifiedCurrentSessionUserId.mockResolvedValue(null);
    mocks.getDataOwner.mockResolvedValue({ key: SK.DATA_OWNER_ID, value: ACCOUNT_A });

    await expect(readVerifiedSettingsOwnerRealm("Local data reset")).rejects.toBeInstanceOf(
      SettingsOwnerBoundaryError
    );
  });

  it("rejects different confirmed session and durable account owners", async () => {
    mocks.getVerifiedCurrentSessionUserId.mockResolvedValue(ACCOUNT_A);
    mocks.getDataOwner.mockResolvedValue({ key: SK.DATA_OWNER_ID, value: ACCOUNT_B });

    await expect(readVerifiedSettingsOwnerRealm("Profile name save")).rejects.toBeInstanceOf(
      SettingsOwnerBoundaryError
    );
  });

  it.each([
    ["cannot be read", { ok: false as const, value: null }],
    ["is still present", { ok: true as const, value: '{"userId":"pending"}' }],
  ])("fails closed when the account cleanup marker %s", async (_label, marker) => {
    mocks.readCleanupMarker.mockReturnValue(marker);

    await expect(readVerifiedSettingsOwnerRealm("Backup export")).rejects.toBeInstanceOf(
      SettingsOwnerBoundaryError
    );
    expect(mocks.getVerifiedCurrentSessionUserId).not.toHaveBeenCalled();
    expect(mocks.getDataOwner).not.toHaveBeenCalled();
  });

  it("accepts only a confirmed signed-out and unowned local realm", async () => {
    await expect(readVerifiedSettingsOwnerRealm("Backup import")).resolves.toEqual({
      kind: "local",
      ownerUserId: null,
      generation: "settings-generation-a",
    });
    expect(mocks.getDataOwner).toHaveBeenCalledWith(SK.DATA_OWNER_ID);
  });

  it("accepts an account realm only when session and durable owners match", async () => {
    mocks.getVerifiedCurrentSessionUserId.mockResolvedValue(ACCOUNT_A);
    mocks.getDataOwner.mockResolvedValue({ key: SK.DATA_OWNER_ID, value: ACCOUNT_A });

    await expect(readVerifiedSettingsOwnerRealm("Backup import")).resolves.toEqual({
      kind: "account",
      ownerUserId: ACCOUNT_A,
      generation: "settings-generation-a",
    });
  });

  it("uses a settled DATA read when revalidating outside the write barrier", async () => {
    const realm = await readVerifiedSettingsOwnerRealm("Backup export");
    mocks.runWithSettledDataRead.mockClear();

    await assertSettingsOwnerCurrent(realm, "Backup export");

    expect(mocks.runWithSettledDataRead).toHaveBeenCalledTimes(1);
  });

  it("revalidates directly inside the DATA write barrier without a nested settled read", async () => {
    const realm = await readVerifiedSettingsOwnerRealm("Backup import");
    mocks.runWithSettledDataRead.mockClear();

    await assertSettingsOwnerCurrentWithinDataWriteBarrier(realm, "Backup import");

    expect(mocks.runWithSettledDataRead).not.toHaveBeenCalled();
    expect(mocks.getVerifiedCurrentSessionUserId).toHaveBeenCalledTimes(2);
    expect(mocks.getDataOwner).toHaveBeenCalledTimes(2);
  });

  it("keeps the Dexie.waitFor-compatible realm check free of IndexedDB reads", async () => {
    const realm = await readVerifiedSettingsOwnerRealm("Backup import");
    mocks.getVerifiedCurrentSessionUserId.mockClear();
    mocks.getDataOwner.mockClear();

    await assertSettingsExternalOwnerCurrentWithinDataWriteBarrier(realm, "Backup import");

    expect(mocks.getVerifiedCurrentSessionUserId).toHaveBeenCalledTimes(1);
    expect(mocks.getDataOwner).not.toHaveBeenCalled();
  });

  it("checks the durable data owner directly without a Supabase await", async () => {
    const realm = await readVerifiedSettingsOwnerRealm("Backup import");
    mocks.getVerifiedCurrentSessionUserId.mockClear();
    mocks.getDataOwner.mockClear();

    await assertSettingsDataOwnerCurrentWithinTransaction(realm, "Backup import");

    expect(mocks.getVerifiedCurrentSessionUserId).not.toHaveBeenCalled();
    expect(mocks.getDataOwner).toHaveBeenCalledTimes(1);
  });
});
