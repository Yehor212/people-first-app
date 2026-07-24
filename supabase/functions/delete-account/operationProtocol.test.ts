import { describe, expect, it, vi } from "vitest";

import {
  hashAccountDeletionRecoverySecret,
  isAuthUserNotFound,
  parseAccountDeletionCapability,
  parseAccountDeletionClaim,
  runClaimedAccountDeletion,
} from "./operationProtocol";

const OPERATION_ID = "5bbbcf4f-3f44-4f3b-89eb-7f779c2ad85a";
const USER_ID = "a5b6f9e1-a7cc-487d-a64b-f730e4514c39";
const LEASE_TOKEN = "89b7dd47-1c28-4d9e-b4f9-87929247a2bd";
const RECOVERY_SECRET = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

describe("account deletion operation protocol", () => {
  it("accepts only a UUID plus an exact canonical 32-byte base64url capability", () => {
    expect(
      parseAccountDeletionCapability({
        operationId: OPERATION_ID,
        recoverySecret: RECOVERY_SECRET,
      }),
    ).toEqual({
      operationId: OPERATION_ID,
      recoverySecret: RECOVERY_SECRET,
    });

    expect(parseAccountDeletionCapability({ expectedOwnerUserId: USER_ID })).toBeNull();
    expect(
      parseAccountDeletionCapability({
        operationId: OPERATION_ID,
        recoverySecret: RECOVERY_SECRET,
        expectedOwnerUserId: USER_ID,
      }),
    ).toBeNull();
    expect(
      parseAccountDeletionCapability({
        operationId: OPERATION_ID,
        recoverySecret: `${RECOVERY_SECRET.slice(0, 42)}B`,
      }),
    ).toBeNull();
    expect(
      parseAccountDeletionCapability({
        operationId: "not-a-uuid",
        recoverySecret: RECOVERY_SECRET,
      }),
    ).toBeNull();
  });

  it("hashes the recovery capability without returning the raw value", async () => {
    const hash = await hashAccountDeletionRecoverySecret(RECOVERY_SECRET);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(RECOVERY_SECRET);
    await expect(
      hashAccountDeletionRecoverySecret("owner-id-is-not-authority"),
    ).rejects.toThrow("Invalid account deletion recovery secret");
  });

  it("treats only Supabase's explicit user_not_found code as terminal", () => {
    expect(isAuthUserNotFound({ code: "user_not_found", status: 404 })).toBe(true);
    expect(isAuthUserNotFound({ message: "not found", status: 404 })).toBe(false);
    expect(isAuthUserNotFound(new Error("user_not_found"))).toBe(false);
  });

  it("fails closed on malformed database claim rows", () => {
    expect(
      parseAccountDeletionClaim([
        {
          state: "claimed",
          user_id: USER_ID,
          lease_token: LEASE_TOKEN,
          lease_epoch: 2,
          phase: "push-drain",
        },
      ]),
    ).toEqual({
      state: "claimed",
      userId: USER_ID,
      leaseToken: LEASE_TOKEN,
      leaseEpoch: 2,
      phase: "push-drain",
    });
    expect(
      parseAccountDeletionClaim([
        {
          state: "claimed",
          user_id: USER_ID,
          lease_token: LEASE_TOKEN,
          lease_epoch: 3,
          phase: "media-before-rows",
        },
      ]),
    ).toEqual({
      state: "claimed",
      userId: USER_ID,
      leaseToken: LEASE_TOKEN,
      leaseEpoch: 3,
      phase: "media-before-rows",
    });
    expect(parseAccountDeletionClaim([{ state: "deleted" }])).toEqual({
      state: "deleted",
    });
    expect(parseAccountDeletionClaim([{ state: "pending" }])).toEqual({
      state: "pending",
    });
    expect(parseAccountDeletionClaim([{ state: "claimed", user_id: USER_ID }])).toEqual({
      state: "invalid",
    });
    expect(parseAccountDeletionClaim(null)).toEqual({ state: "invalid" });
  });

  it("advances durable phases and completes only with the current fence", async () => {
    const events: string[] = [];
    const completeOperation = vi.fn(async () => {
      events.push("complete");
      return true;
    });

    const result = await runClaimedAccountDeletion({
      phase: "push-drain",
      renewLease: async () => true,
      drainPushDeliveries: async () => {
        events.push("drain-push");
        return true;
      },
      purgeMediaBatch: async () => {
        events.push("purge-media");
        return { complete: true };
      },
      purgeRows: async () => events.push("purge-rows"),
      deleteAuthUser: async () => events.push("delete-auth"),
      advancePhase: async (phase) => {
        events.push(`advance:${phase}`);
        return true;
      },
      completeOperation,
      releaseOperation: vi.fn(async () => true),
    });

    expect(result).toBe("deleted");
    expect(events).toEqual([
      "drain-push",
      "advance:media-before-rows",
      "purge-media",
      "advance:rows",
      "purge-rows",
      "advance:media-after-rows",
      "purge-media",
      "advance:auth",
      "delete-auth",
      "complete",
    ]);
  });

  it("releases and retries without destructive work while a pre-admitted push permit is live", async () => {
    const releaseOperation = vi.fn(async () => true);
    const purgeMediaBatch = vi.fn(async () => ({ complete: true }));
    const purgeRows = vi.fn(async () => undefined);
    const deleteAuthUser = vi.fn(async () => undefined);
    const advancePhase = vi.fn(async () => true);

    const result = await runClaimedAccountDeletion({
      phase: "push-drain",
      renewLease: vi.fn(async () => true),
      drainPushDeliveries: vi.fn(async () => false),
      purgeMediaBatch,
      purgeRows,
      deleteAuthUser,
      advancePhase,
      completeOperation: vi.fn(async () => true),
      releaseOperation,
    });

    expect(result).toBe("pending");
    expect(releaseOperation).toHaveBeenCalledTimes(1);
    expect(advancePhase).not.toHaveBeenCalled();
    expect(purgeMediaBatch).not.toHaveBeenCalled();
    expect(purgeRows).not.toHaveBeenCalled();
    expect(deleteAuthUser).not.toHaveBeenCalled();
  });

  it("yields an incomplete media batch without advancing its durable phase", async () => {
    const advancePhase = vi.fn(async () => true);
    const releaseOperation = vi.fn(async () => true);

    const result = await runClaimedAccountDeletion({
      phase: "media-before-rows",
      renewLease: vi.fn(async () => true),
      drainPushDeliveries: vi.fn(async () => true),
      purgeMediaBatch: vi.fn(async () => ({ complete: false })),
      purgeRows: vi.fn(async () => undefined),
      deleteAuthUser: vi.fn(async () => undefined),
      advancePhase,
      completeOperation: vi.fn(async () => true),
      releaseOperation,
    });

    expect(result).toBe("pending");
    expect(advancePhase).not.toHaveBeenCalled();
    expect(releaseOperation).toHaveBeenCalledTimes(1);
  });

  it("never reports deletion when a stale fence cannot commit the receipt", async () => {
    const releaseOperation = vi.fn(async () => true);

    const result = await runClaimedAccountDeletion({
      phase: "auth",
      renewLease: vi.fn(async () => true),
      drainPushDeliveries: vi.fn(async () => true),
      purgeMediaBatch: vi.fn(async () => ({ complete: true })),
      purgeRows: vi.fn(async () => undefined),
      deleteAuthUser: vi.fn(async () => undefined),
      advancePhase: vi.fn(async () => true),
      completeOperation: vi.fn(async () => false),
      releaseOperation,
    });

    expect(result).toBe("pending");
    expect(releaseOperation).not.toHaveBeenCalled();
  });

  it("releases only the current fenced claim after a destructive-step failure", async () => {
    const originalError = new Error("row purge failed");
    const releaseOperation = vi.fn(async () => true);

    await expect(
      runClaimedAccountDeletion({
        phase: "rows",
        renewLease: vi.fn(async () => true),
        drainPushDeliveries: vi.fn(async () => true),
        purgeMediaBatch: vi.fn(async () => ({ complete: true })),
        purgeRows: vi.fn(async () => {
          throw originalError;
        }),
        deleteAuthUser: vi.fn(async () => undefined),
        advancePhase: vi.fn(async () => true),
        completeOperation: vi.fn(async () => true),
        releaseOperation,
      }),
    ).rejects.toBe(originalError);
    expect(releaseOperation).toHaveBeenCalledTimes(1);
  });
});
