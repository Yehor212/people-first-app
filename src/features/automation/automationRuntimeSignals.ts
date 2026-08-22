import { logger } from "@/lib/logger";

export const AUTOMATION_SOURCE_READY_EVENT = "zenflow:automation-source-ready";

/**
 * Wakes the mounted owner-scoped runtime without putting record IDs, owner IDs,
 * rule IDs, or user content on the global event boundary.
 */
export function signalAutomationSourceReady(): void {
  if (typeof window === "undefined" || typeof Event === "undefined") return;
  try {
    window.dispatchEvent(new Event(AUTOMATION_SOURCE_READY_EVENT));
  } catch {
    logger.warn("[AutomationRuntime] Source-ready signal unavailable");
  }
}
