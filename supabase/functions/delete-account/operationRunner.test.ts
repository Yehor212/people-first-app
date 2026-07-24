import { describe, expect, it, vi } from "vitest";

import { continueAccountDeletionOperation } from "./operationRunner";

const capability = {
  operationId: "5bbbcf4f-3f44-4f3b-89eb-7f779c2ad85a",
  recoverySecret: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
};
const claimRow = {
  state: "claimed",
  user_id: "a5b6f9e1-a7cc-487d-a64b-f730e4514c39",
  lease_token: "89b7dd47-1c28-4d9e-b4f9-87929247a2bd",
  lease_epoch: 2,
  phase: "auth",
};

function makeDependencies(acquireResult: unknown) {
  return {
    acquire: vi.fn(async () => acquireResult),
    renewLease: vi.fn(async () => true),
    drainPushDeliveries: vi.fn(async () => true),
    purgeMediaBatch: vi.fn(async () => ({ complete: true })),
    purgeRows: vi.fn(async () => undefined),
    deleteAuthUser: vi.fn(async () => undefined),
    advancePhase: vi.fn(async () => true),
    completeOperation: vi.fn(async () => true),
    releaseOperation: vi.fn(async () => true),
  };
}

describe("continueAccountDeletionOperation", () => {
  it("returns a terminal receipt without repeating destructive work", async () => {
    const dependencies = makeDependencies([{ state: "deleted" }]);

    const result = await continueAccountDeletionOperation(capability, dependencies);

    expect(result).toEqual({ status: "deleted" });
    expect(dependencies.deleteAuthUser).not.toHaveBeenCalled();
    expect(dependencies.purgeRows).not.toHaveBeenCalled();
  });

  it("keeps invalid or actively leased capabilities indistinguishable from work", async () => {
    const invalid = makeDependencies([{ state: "invalid" }]);
    const busy = makeDependencies([{ state: "pending" }]);

    await expect(continueAccountDeletionOperation(capability, invalid)).resolves.toEqual({
      status: "invalid",
    });
    await expect(continueAccountDeletionOperation(capability, busy)).resolves.toEqual({
      status: "pending",
    });
    expect(invalid.deleteAuthUser).not.toHaveBeenCalled();
    expect(busy.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("binds every lease transition to operation, hash, token and epoch", async () => {
    const dependencies = makeDependencies([claimRow]);

    const result = await continueAccountDeletionOperation(capability, dependencies);

    expect(result).toEqual({ status: "deleted" });
    expect(dependencies.renewLease).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: capability.operationId,
        recoveryHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        leaseToken: claimRow.lease_token,
        leaseEpoch: claimRow.lease_epoch,
      }),
    );
    expect(dependencies.completeOperation).toHaveBeenCalledWith(
      expect.objectContaining({ leaseEpoch: claimRow.lease_epoch }),
    );
    expect(dependencies.deleteAuthUser).toHaveBeenCalledWith(claimRow.user_id);
  });

  it("passes the current operation fence to push drain and yields while a permit is active", async () => {
    const dependencies = makeDependencies([
      { ...claimRow, phase: "push-drain" },
    ]);
    dependencies.drainPushDeliveries.mockResolvedValue(false);

    const result = await continueAccountDeletionOperation(capability, dependencies);

    expect(result).toEqual({ status: "pending" });
    expect(dependencies.drainPushDeliveries).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: capability.operationId,
        recoveryHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        leaseToken: claimRow.lease_token,
        leaseEpoch: claimRow.lease_epoch,
      }),
    );
    expect(dependencies.releaseOperation).toHaveBeenCalledWith(
      expect.objectContaining({ leaseEpoch: claimRow.lease_epoch }),
    );
    expect(dependencies.purgeMediaBatch).not.toHaveBeenCalled();
    expect(dependencies.purgeRows).not.toHaveBeenCalled();
    expect(dependencies.deleteAuthUser).not.toHaveBeenCalled();
  });
});
