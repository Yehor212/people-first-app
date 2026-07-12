import { runWithAccountBoundaryValidatedJournalWrite } from "@/storage/accountBoundaryRuntime";

/**
 * Serializes local diary writes with password activation. Writers that started
 * first finish before the encryption snapshot; writers that start during the
 * snapshot wait and then observe the newly active vault key.
 */
export async function runWithJournalSecurityWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  return runWithAccountBoundaryValidatedJournalWrite(operation);
}
