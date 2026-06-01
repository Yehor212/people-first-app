// Application version management
import { safeLocalStorageGet, safeLocalStorageSet } from './safeJson';
import { SK } from '@/lib/storageKeys';
import { logger } from './logger';

export const APP_VERSION = '2.0.0'; // Synced with package.json
export const DATA_SCHEMA_VERSION = 2; // Data schema version
export const MIN_SUPPORTED_VERSION = '1.0.0'; // Minimum supported version

export interface AppMetadata {
  appVersion: string;
  dataSchemaVersion: number;
  lastUpdateDate: string;
  installDate: string;
  updateCount: number;
}

// Get current app metadata
export const getAppMetadata = (): AppMetadata | null => {
  return safeLocalStorageGet<AppMetadata | null>(SK.APP_METADATA, null);
};

// Save app metadata
export const saveAppMetadata = (metadata: AppMetadata): void => {
  if (!safeLocalStorageSet(SK.APP_METADATA, metadata)) {
    logger.error('[AppVersion] Failed to save metadata');
  }
};

// Check if app was updated
export const wasAppUpdated = (): boolean => {
  const metadata = getAppMetadata();
  if (!metadata) return false;
  return metadata.appVersion !== APP_VERSION;
};

// Initialize or update app metadata
export const initializeAppMetadata = (): AppMetadata => {
  const existing = getAppMetadata();
  const now = new Date().toISOString();

  if (!existing) {
    // First install
    const newMetadata: AppMetadata = {
      appVersion: APP_VERSION,
      dataSchemaVersion: DATA_SCHEMA_VERSION,
      lastUpdateDate: now,
      installDate: now,
      updateCount: 0
    };
    saveAppMetadata(newMetadata);
    return newMetadata;
  }

  if (existing.appVersion !== APP_VERSION) {
    // App was updated
    const updatedMetadata: AppMetadata = {
      ...existing,
      appVersion: APP_VERSION,
      dataSchemaVersion: DATA_SCHEMA_VERSION,
      lastUpdateDate: now,
      updateCount: existing.updateCount + 1
    };
    saveAppMetadata(updatedMetadata);
    return updatedMetadata;
  }

  return existing;
};
