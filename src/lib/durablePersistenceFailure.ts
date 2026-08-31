import { logger } from "@/lib/logger";
import { isAccountBoundaryChangedError } from "@/storage/accountBoundaryRuntime";

type DurablePersistenceDomain = "Focus" | "Habits" | "Mood" | "Planning" | "V2 Habits";

interface DurablePersistenceFailureOptions {
  readonly domain: DurablePersistenceDomain;
  readonly localizedMessage: string;
}

function logStaleAccountResult(domain: DurablePersistenceDomain): void {
  switch (domain) {
    case "Focus":
      logger.info("[Focus] Stale account result discarded");
      break;
    case "Habits":
      logger.info("[Habits] Stale account result discarded");
      break;
    case "Mood":
      logger.info("[Mood] Stale account result discarded");
      break;
    case "Planning":
      logger.info("[Planning] Stale account result discarded");
      break;
    case "V2 Habits":
      logger.info("[V2 Habits] Stale account result discarded");
      break;
  }
}

function logPersistenceFailure(domain: DurablePersistenceDomain): void {
  switch (domain) {
    case "Focus":
      logger.error("[Focus] Durable persistence failed");
      break;
    case "Habits":
      logger.error("[Habits] Durable persistence failed");
      break;
    case "Mood":
      logger.error("[Mood] Durable persistence failed");
      break;
    case "Planning":
      logger.error("[Planning] Durable persistence failed");
      break;
    case "V2 Habits":
      logger.error("[V2 Habits] Durable persistence failed");
      break;
  }
}

/**
 * Keeps a completed write from an expired account generation out of the new
 * account's UI without misreporting it as storage loss. Raw persistence errors
 * never cross the logging or recovery-event boundary.
 */
export function reportDurablePersistenceFailure(
  error: unknown,
  { domain, localizedMessage }: DurablePersistenceFailureOptions
): void {
  if (isAccountBoundaryChangedError(error)) {
    logStaleAccountResult(domain);
    return;
  }

  logPersistenceFailure(domain);
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("zenflow:storage-error", {
      detail: {
        type: "write_failed",
        message: localizedMessage,
      },
    })
  );
}
