import { logger } from "@/lib/logger";
import { getCurrentSessionUserId } from "@/lib/supabaseClient";

export class SettingsOwnerBoundaryError extends Error {
  constructor(operation: string) {
    super(`${operation} stopped at an account boundary`);
    this.name = "SettingsOwnerBoundaryError";
  }
}

/**
 * Re-check the cached session owner around local Settings side effects.
 * `null` is a real local-only owner state and must not silently become a newly
 * signed-in account while an import or export is in flight.
 */
export async function assertSettingsOwnerCurrent(
  expectedOwnerUserId: string | null,
  operation: string,
): Promise<void> {
  const activeOwnerUserId = await getCurrentSessionUserId();
  if (activeOwnerUserId === expectedOwnerUserId) return;

  logger.warn(`[Settings] ${operation} stopped at an account boundary`);
  throw new SettingsOwnerBoundaryError(operation);
}
