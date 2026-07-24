export interface AccountDeletionBarrierSteps {
  blockStorageWrites: () => Promise<unknown>;
  purgeMedia: () => Promise<unknown>;
  purgeRows: () => Promise<unknown>;
  deleteAuthUser: () => Promise<unknown>;
}

/**
 * Prevents an already-issued user JWT from recreating Storage objects while
 * account deletion is emptying buckets. The second media pass catches a request
 * that committed concurrently with the first pass but before the block existed.
 *
 * Once the block is durable, failure is a retryable deletion state: never
 * release it from this request. Releasing after rows or media were partially
 * removed would let a still-valid JWT recreate data and turn a recoverable
 * compensating transaction into an inconsistent live account.
 */
export async function runAccountDeletionBarrier(
  steps: AccountDeletionBarrierSteps,
): Promise<void> {
  await steps.blockStorageWrites();
  await steps.purgeMedia();
  await steps.purgeRows();
  await steps.purgeMedia();
  await steps.deleteAuthUser();
}
