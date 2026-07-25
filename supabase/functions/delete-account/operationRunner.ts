import {
  type AccountDeletionCapability,
  type AccountDeletionPhase,
  hashAccountDeletionRecoverySecret,
  parseAccountDeletionClaim,
  runClaimedAccountDeletion,
} from "./operationProtocol.ts";

export interface AccountDeletionLeaseContext {
  operationId: string;
  recoveryHash: string;
  leaseToken: string;
  leaseEpoch: number;
}

export interface AccountDeletionOperationDependencies {
  acquire: (operationId: string, recoveryHash: string) => Promise<unknown>;
  renewLease: (context: AccountDeletionLeaseContext) => Promise<boolean>;
  drainPushDeliveries: (
    context: AccountDeletionLeaseContext,
  ) => Promise<boolean>;
  purgeMediaBatch: (userId: string) => Promise<{ complete: boolean }>;
  purgeRows: (userId: string) => Promise<unknown>;
  deleteAuthUser: (userId: string) => Promise<unknown>;
  advancePhase: (
    context: AccountDeletionLeaseContext,
    phase: AccountDeletionPhase,
  ) => Promise<boolean>;
  completeOperation: (context: AccountDeletionLeaseContext) => Promise<boolean>;
  releaseOperation: (context: AccountDeletionLeaseContext) => Promise<boolean>;
}

export type ContinueAccountDeletionResult =
  | { status: "deleted" }
  | { status: "pending" }
  | { status: "invalid" };

export async function continueAccountDeletionOperation(
  capability: AccountDeletionCapability,
  dependencies: AccountDeletionOperationDependencies,
): Promise<ContinueAccountDeletionResult> {
  const recoveryHash = await hashAccountDeletionRecoverySecret(
    capability.recoverySecret,
  );
  const claim = parseAccountDeletionClaim(
    await dependencies.acquire(capability.operationId, recoveryHash),
  );

  if (claim.state === "invalid") return { status: "invalid" };
  if (claim.state === "deleted") return { status: "deleted" };
  if (claim.state === "pending") return { status: "pending" };

  const context: AccountDeletionLeaseContext = {
    operationId: capability.operationId,
    recoveryHash,
    leaseToken: claim.leaseToken,
    leaseEpoch: claim.leaseEpoch,
  };
  const result = await runClaimedAccountDeletion({
    phase: claim.phase,
    renewLease: () => dependencies.renewLease(context),
    drainPushDeliveries: () => dependencies.drainPushDeliveries(context),
    purgeMediaBatch: () => dependencies.purgeMediaBatch(claim.userId),
    purgeRows: () => dependencies.purgeRows(claim.userId),
    deleteAuthUser: () => dependencies.deleteAuthUser(claim.userId),
    advancePhase: (phase) => dependencies.advancePhase(context, phase),
    completeOperation: () => dependencies.completeOperation(context),
    releaseOperation: () => dependencies.releaseOperation(context),
  });
  return { status: result };
}
