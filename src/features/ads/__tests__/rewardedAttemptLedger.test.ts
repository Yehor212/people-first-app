import { beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  current: true,
  generation: "boundary-a",
  owner: "11111111-1111-4111-8111-111111111111",
}));

vi.mock("@/storage/sync/syncOwner", () => ({
  validateSyncOwner: vi.fn(async (expectedOwnerUserId?: string) => {
    if (expectedOwnerUserId && expectedOwnerUserId !== boundary.owner) {
      throw new Error("owner changed");
    }
    return boundary.owner;
  }),
}));

vi.mock("@/storage/accountBoundaryRuntime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/storage/accountBoundaryRuntime")>();
  return {
    ...actual,
    captureOriginAccountBoundaryGeneration: vi.fn(() => boundary.generation),
    isOriginAccountBoundaryGenerationCurrent: vi.fn(
      (generation: string) => boundary.current && generation === boundary.generation,
    ),
  };
});

vi.mock("@/lib/originExclusiveLock", () => ({
  runWithOriginExclusiveLock: vi.fn(async (_name: string, operation: () => unknown) => operation()),
}));

import {
  REWARDED_ATTEMPT_LEDGER_KEY,
  beginRewardedAdAttempt,
  settleRewardedAdAttempt,
} from "../rewardedAttemptLedger";
import { createDefaultInnerWorld } from "@/lib/innerWorldHelpers";
import { SK } from "@/lib/storageKeys";
import { isLocalOnlySettingKey } from "@/storage/sync/settingSyncPolicy";
import { clearLocalUserData, db } from "@/storage/db";

const OWNER_ID = boundary.owner;
const ATTEMPT_ID = "22222222-2222-4222-8222-222222222222";

async function seedWallet(): Promise<void> {
  const world = createDefaultInnerWorld();
  world.currentActiveStreak = 10;
  world.treats.balance = 7;
  world.treats.lifetimeEarned = 11;
  await db.settings.put({ key: SK.INNER_WORLD, value: world });
}

describe("durable rewarded-ad attempt ledger", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    boundary.current = true;
    boundary.generation = "boundary-a";
    boundary.owner = OWNER_ID;
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(ATTEMPT_ID);
    await db.open();
    await db.settings.clear();
    await seedWallet();
  });

  it("persists one owner-bound attempt before show and blocks a concurrent attempt", async () => {
    await expect(beginRewardedAdAttempt(100)).resolves.toEqual({
      status: "created",
      attemptId: ATTEMPT_ID,
      ownerUserId: OWNER_ID,
    });

    await expect(db.settings.get(REWARDED_ATTEMPT_LEDGER_KEY)).resolves.toMatchObject({
      value: {
        schemaVersion: 1,
        ownerUserId: OWNER_ID,
        attempts: [
          {
            id: ATTEMPT_ID,
            status: "prepared",
            createdAt: 100,
            updatedAt: 100,
          },
        ],
      },
    });
    await expect(beginRewardedAdAttempt(101)).resolves.toEqual({
      status: "blocked",
      reason: "attempt_in_progress",
    });
  });

  it("atomically grants the exact advertised reward once across duplicate callbacks and reload", async () => {
    await beginRewardedAdAttempt(100);

    await expect(
      settleRewardedAdAttempt({
        attemptId: ATTEMPT_ID,
        expectedOwnerUserId: OWNER_ID,
        outcome: "earned",
        settledAt: 120,
      }),
    ).resolves.toEqual({ status: "earned", amount: 20 });

    const firstWorld = (await db.settings.get(SK.INNER_WORLD))?.value as ReturnType<
      typeof createDefaultInnerWorld
    >;
    expect(firstWorld.treats).toMatchObject({
      balance: 27,
      lifetimeEarned: 31,
      lastEarnedAt: 120,
    });
    expect(firstWorld.treats.transactions[0]).toEqual({
      id: `rewarded-ad:${ATTEMPT_ID}`,
      amount: 20,
      source: "ad",
      timestamp: 120,
    });

    await expect(
      settleRewardedAdAttempt({
        attemptId: ATTEMPT_ID,
        expectedOwnerUserId: OWNER_ID,
        outcome: "earned",
        settledAt: 130,
      }),
    ).resolves.toEqual({ status: "already-earned", amount: 20 });

    const reloadedWorld = (await db.settings.get(SK.INNER_WORLD))?.value as ReturnType<
      typeof createDefaultInnerWorld
    >;
    expect(reloadedWorld.treats.balance).toBe(27);
    expect(
      reloadedWorld.treats.transactions.filter(
        (transaction) => transaction.id === `rewarded-ad:${ATTEMPT_ID}`,
      ),
    ).toHaveLength(1);
  });

  it("settles dismiss without reward and rejects a stale owner realm", async () => {
    await beginRewardedAdAttempt(100);
    boundary.owner = "33333333-3333-4333-8333-333333333333";

    await expect(
      settleRewardedAdAttempt({
        attemptId: ATTEMPT_ID,
        expectedOwnerUserId: OWNER_ID,
        outcome: "earned",
        settledAt: 110,
      }),
    ).rejects.toThrow("owner changed");
    expect(
      ((await db.settings.get(SK.INNER_WORLD))?.value as ReturnType<
        typeof createDefaultInnerWorld
      >).treats.balance,
    ).toBe(7);

    boundary.owner = OWNER_ID;
    await expect(
      settleRewardedAdAttempt({
        attemptId: ATTEMPT_ID,
        expectedOwnerUserId: OWNER_ID,
        outcome: "dismissed",
        settledAt: 120,
      }),
    ).resolves.toEqual({ status: "dismissed" });
    expect(
      ((await db.settings.get(SK.INNER_WORLD))?.value as ReturnType<
        typeof createDefaultInnerWorld
      >).treats.balance,
    ).toBe(7);
  });

  it("keeps the ledger out of sync/backup and clears it at the account boundary", async () => {
    await beginRewardedAdAttempt(100);

    expect(isLocalOnlySettingKey(REWARDED_ATTEMPT_LEDGER_KEY)).toBe(true);
    await clearLocalUserData();
    await expect(db.settings.get(REWARDED_ATTEMPT_LEDGER_KEY)).resolves.toBeUndefined();
  });
});
