import { type AccountDeletionCapability, type AccountDeletionPhase, isAuthUserNotFound } from "./operationProtocol.ts";
import {
  type AccountDeletionLeaseContext,
  continueAccountDeletionOperation,
  type ContinueAccountDeletionResult,
} from "./operationRunner.ts";
import { deleteUserJournalMediaBatch, type StorageClient } from "./storageCleanup.ts";
import { deleteAccountOwnedRows, type RowCleanupClient } from "./rowCleanup.ts";

const STORAGE_LIST_OPERATIONS_PER_REQUEST = 8;

interface ServiceError {
  code?: string;
  message?: string;
  status?: number;
}

interface AuthAdminClient {
  getUserById(userId: string): Promise<{
    data: { user: { id: string } | null };
    error: ServiceError | null;
  }>;
  deleteUser(userId: string): Promise<{
    data: unknown;
    error: ServiceError | null;
  }>;
}

export interface AccountDeletionServiceClient extends RowCleanupClient {
  storage: StorageClient;
  auth: { admin: AuthAdminClient };
  rpc(
    functionName: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: ServiceError | null }>;
}

export async function deleteAuthUserIdempotently(
  admin: AuthAdminClient,
  userId: string,
): Promise<void> {
  const existing = await admin.getUserById(userId);
  if (existing.error) {
    if (isAuthUserNotFound(existing.error)) return;
    throw new Error("Unable to verify account deletion state");
  }
  if (!existing.data.user || existing.data.user.id !== userId) {
    throw new Error("Unable to verify account deletion state");
  }

  const deleted = await admin.deleteUser(userId);
  if (deleted.error && !isAuthUserNotFound(deleted.error)) {
    throw new Error("Unable to delete account authentication record");
  }
}

async function readRpc(
  client: AccountDeletionServiceClient,
  functionName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await client.rpc(functionName, args);
  if (error) throw new Error(`Account deletion RPC failed: ${functionName}`);
  return data;
}

async function readRpcBoolean(
  client: AccountDeletionServiceClient,
  functionName: string,
  args: Record<string, unknown>,
): Promise<boolean> {
  return (await readRpc(client, functionName, args)) === true;
}

function leaseArgs(context: AccountDeletionLeaseContext): Record<string, unknown> {
  return {
    p_operation_id: context.operationId,
    p_recovery_secret_hash: context.recoveryHash,
    p_lease_token: context.leaseToken,
    p_lease_epoch: context.leaseEpoch,
  };
}

function execute(
  client: AccountDeletionServiceClient,
  capability: AccountDeletionCapability,
  acquire: (operationId: string, recoveryHash: string) => Promise<unknown>,
): Promise<ContinueAccountDeletionResult> {
  return continueAccountDeletionOperation(capability, {
    acquire,
    renewLease: (context) =>
      readRpcBoolean(
        client,
        "renew_account_deletion_operation_lease",
        leaseArgs(context),
      ),
    drainPushDeliveries: (context) =>
      readRpcBoolean(
        client,
        "drain_account_push_delivery_permits",
        leaseArgs(context),
      ),
    purgeMediaBatch: (userId) =>
      deleteUserJournalMediaBatch(
        client.storage,
        userId,
        STORAGE_LIST_OPERATIONS_PER_REQUEST,
      ),
    purgeRows: (userId) => deleteAccountOwnedRows(client, userId),
    deleteAuthUser: (userId) => deleteAuthUserIdempotently(client.auth.admin, userId),
    advancePhase: (context, phase: AccountDeletionPhase) =>
      readRpcBoolean(
        client,
        "advance_account_deletion_operation_phase",
        { ...leaseArgs(context), p_next_phase: phase },
      ),
    completeOperation: (context) =>
      readRpcBoolean(
        client,
        "complete_account_deletion_operation",
        leaseArgs(context),
      ),
    releaseOperation: (context) =>
      readRpcBoolean(
        client,
        "release_account_deletion_operation",
        leaseArgs(context),
      ),
  });
}

export function executeInitialAccountDeletion(
  client: AccountDeletionServiceClient,
  capability: AccountDeletionCapability,
  authenticatedUserId: string,
): Promise<ContinueAccountDeletionResult> {
  return execute(
    client,
    capability,
    (operationId, recoveryHash) =>
      readRpc(client, "begin_account_deletion_operation", {
        p_operation_id: operationId,
        p_user_id: authenticatedUserId,
        p_recovery_secret_hash: recoveryHash,
      }),
  );
}

export function executeRecoveryAccountDeletion(
  client: AccountDeletionServiceClient,
  capability: AccountDeletionCapability,
): Promise<ContinueAccountDeletionResult> {
  return execute(
    client,
    capability,
    (operationId, recoveryHash) =>
      readRpc(client, "claim_account_deletion_operation", {
        p_operation_id: operationId,
        p_recovery_secret_hash: recoveryHash,
      }),
  );
}
