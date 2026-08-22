import { logger } from "@/lib/logger";
import { isAccountBoundaryChangedError } from "@/storage/accountBoundaryRuntime";

type DurablePersistenceDomain = "Focus" | "Habits" | "Mood" | "Planning" | "V2 Habits";

interface DurablePersistenceFailureOptions {
  readonly domain: DurablePersistenceDomain;
  readonly localizedMessage: string;
}

/**
 * Keeps a completed write from an expired account generation out of the new
 * account's UI without misreporting it as storage loss. Raw persistence errors
 * never cross the logging or recovery-event boundary.
 */
export function reportDurablePersistenceFailure(
  error: unknown,
  { domain, localizedMessage }: DurablePersistenceFailureOptions,
): void {
  if (isAccountBoundaryChangedError(error)) {
    logger.info(`[${domain}] Stale account result discarded`);
    return;
  }

  logger.error(`[${domain}] Durable persistence failed`);
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("zenflow:storage-error", {
      detail: {
        type: "write_failed",
        message: localizedMessage,
      },
    }),
  );
}
