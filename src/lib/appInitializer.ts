import { initializeAppMetadata, getAppMetadata, wasAppUpdated, DATA_SCHEMA_VERSION } from '@/lib/appVersion';
import { runMigrations, validateDataIntegrity } from '@/storage/migrations';
import { checkDatabaseHealth } from '@/storage/db';
import { logger } from '@/lib/logger';

export interface InitializationResult {
  success: boolean;
  wasUpdated: boolean;
  needsReload: boolean;
  error?: string;
}

// Initialize app with migrations
export const initializeApp = async (): Promise<InitializationResult> => {
  try {
    logger.log('[AppInit] Starting app initialization...');

    // Step 1: Check database health
    const dbHealthy = await checkDatabaseHealth();
    if (!dbHealthy) {
      logger.error('[AppInit] Database is not healthy');
      return {
        success: false,
        wasUpdated: false,
        needsReload: false,
        error: 'Database initialization failed. Please reinstall the app.'
      };
    }

    // Step 2: Get or initialize app metadata
    const oldMetadata = getAppMetadata();
    const newMetadata = initializeAppMetadata();

    const wasUpdated = wasAppUpdated();

    if (wasUpdated && oldMetadata) {
      logger.log(`[AppInit] App updated from ${oldMetadata.appVersion} to ${newMetadata.appVersion}`);

      // Step 3: Run migrations if needed
      const oldDataVersion = oldMetadata.dataSchemaVersion || 1;
      const newDataVersion = DATA_SCHEMA_VERSION;

      if (oldDataVersion < newDataVersion) {
        logger.log(`[AppInit] Running migrations from data schema v${oldDataVersion} to v${newDataVersion}`);

        try {
          await runMigrations(oldDataVersion, newDataVersion);
        } catch (error) {
          logger.error('[AppInit] Migration failed:', error);
          return {
            success: false,
            wasUpdated: true,
            needsReload: false,
            error: 'Data migration failed. Please contact support.'
          };
        }

        // Step 4: Validate data integrity after migration
        const isValid = await validateDataIntegrity();
        if (!isValid) {
          logger.error('[AppInit] Data integrity check failed after migration');
          return {
            success: false,
            wasUpdated: true,
            needsReload: false,
            error: 'Data validation failed after migration.'
          };
        }
      }
    }

    logger.log('[AppInit] App initialization completed successfully');

    return {
      success: true,
      wasUpdated,
      needsReload: false
    };
  } catch (error) {
    logger.error('[AppInit] Unexpected error during initialization:', error);
    return {
      success: false,
      wasUpdated: false,
      needsReload: false,
      error: 'Unexpected error during initialization.'
    };
  }
};
