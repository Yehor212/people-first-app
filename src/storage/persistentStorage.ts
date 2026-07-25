import { logger } from "@/lib/logger";

let persistenceRequest: Promise<boolean> | null = null;

async function requestPersistence(): Promise<boolean> {
  const storage = typeof navigator !== "undefined" ? navigator.storage : undefined;
  if (!storage?.persisted || !storage.persist) return false;

  try {
    if (await storage.persisted()) return true;
    const granted = await storage.persist();
    if (!granted) {
      logger.warn("[Storage] Persistent storage was not granted; local data remains best effort");
    }
    return granted;
  } catch (error) {
    logger.warn("[Storage] Persistent storage request failed", error);
    return false;
  }
}

export function requestPersistentStorageForCriticalData(): Promise<boolean> {
  persistenceRequest ??= requestPersistence();
  return persistenceRequest;
}
