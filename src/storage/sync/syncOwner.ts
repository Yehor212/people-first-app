import { logger } from "@/lib/logger";
import { getCurrentUserId } from "@/lib/supabaseClient";
import { readPendingLocalBackupAccountClaim } from "@/storage/accountBoundaryRuntime";

export class SyncOwnerBoundaryError extends Error {
  constructor(operation: string) {
    super(`${operation} stopped at an account boundary`);
    this.name = "SyncOwnerBoundaryError";
  }
}

/**
 * Resolve and verify the account that owns a cloud mutation.
 *
 * Queue handlers always provide an expected owner. Existing foreground callers
 * may omit it, in which case the first verified account becomes the operation
 * owner. Call this again with the returned id immediately before each Supabase
 * mutation so an account switch can never substitute a different user id.
 */
export async function validateSyncOwner(
  expectedOwnerUserId: string | undefined,
  operation: string
): Promise<string | null> {
  const activeUserId = await getCurrentUserId();
  const ownerUserId = expectedOwnerUserId ?? activeUserId;

  if (!ownerUserId) {
    logger.warn(`[Sync] ${operation} stopped: user is not authenticated`);
    return null;
  }

  if (!activeUserId || activeUserId !== ownerUserId) {
    logger.warn(`[Sync] ${operation} stopped at an account boundary`);
    throw new SyncOwnerBoundaryError(operation);
  }

  const importedBackupClaim = readPendingLocalBackupAccountClaim();
  if (importedBackupClaim.status !== "none") {
    logger.warn(`[Sync] ${operation} stopped while an imported backup awaits an account choice`);
    throw new SyncOwnerBoundaryError(operation);
  }

  return ownerUserId;
}
