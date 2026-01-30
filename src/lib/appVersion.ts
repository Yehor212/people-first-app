// Application version management
import { safeJsonParse } from './safeJson';
import { logger } from './logger';

export const APP_VERSION = '1.5.8'; // Synced with package.json - "Feature Toggles & Security" release
export const DATA_SCHEMA_VERSION = 2; // Data schema version
export const MIN_SUPPORTED_VERSION = '1.0.0'; // Minimum supported version

// Key for storing app metadata
export const APP_METADATA_KEY = 'zenflow-app-metadata';

export interface AppMetadata {
  appVersion: string;
  dataSchemaVersion: number;
  lastUpdateDate: string;
  installDate: string;
  updateCount: number;
}

// Get current app metadata
export const getAppMetadata = (): AppMetadata | null => {
  const stored = localStorage.getItem(APP_METADATA_KEY);
  if (!stored) return null;
  return safeJsonParse<AppMetadata | null>(stored, null);
};

// Save app metadata
export const saveAppMetadata = (metadata: AppMetadata): void => {
  try {
    localStorage.setItem(APP_METADATA_KEY, JSON.stringify(metadata));
  } catch (error) {
    logger.error('[AppVersion] Failed to save metadata:', error);
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
