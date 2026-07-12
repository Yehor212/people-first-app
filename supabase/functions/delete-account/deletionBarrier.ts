export interface AccountDeletionBarrierSteps {
  blockStorageWrites: () => Promise<unknown>;
  purgeMedia: () => Promise<unknown>;
  purgeRows: () => Promise<unknown>;
  deleteAuthUser: () => Promise<unknown>;
  releaseStorageBlock: () => Promise<unknown>;
}

/**
 * Prevents an already-issued user JWT from recreating Storage objects while
 * account deletion is emptying buckets. The second media pass catches a request
 * that committed concurrently with the first pass but before the block existed.
 */
export async function runAccountDeletionBarrier(
  steps: AccountDeletionBarrierSteps,
): Promise<void> {
  await steps.blockStorageWrites();

  try {
    await steps.purgeMedia();
    await steps.purgeRows();
    await steps.purgeMedia();
    await steps.deleteAuthUser();
  } catch (error) {
    try {
      await steps.releaseStorageBlock();
    } catch (releaseError) {
      const combined = new Error(
        "Account deletion failed and its temporary storage block could not be released",
      );
      (combined as Error & { cause?: unknown }).cause = { error, releaseError };
      throw combined;
    }
    throw error;
  }
}
