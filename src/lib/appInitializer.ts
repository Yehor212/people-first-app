import { initializeAppMetadata, getAppMetadata, wasAppUpdated, DATA_SCHEMA_VERSION } from '@/lib/appVersion';
import { logger } from '@/lib/logger';
import { scheduleIdle } from '@/lib/scheduleIdle';

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

    // Fast path: normal launches must not wait on IndexedDB health checks.
    // Storage hooks already have local fallbacks; deep DB checks run after paint.
    const oldMetadata = getAppMetadata();
    const wasUpdated = wasAppUpdated();
    const newMetadata = initializeAppMetadata();

    if (!wasUpdated) {
      scheduleIdle(() => {
        void import('@/storage/db')
          .then(({ checkDatabaseHealth }) => checkDatabaseHealth())
          .then((dbHealthy) => {
            if (!dbHealthy) {
              logger.warn('[AppInit] Background database health check failed');
            }
          })
          .catch((error) => {
            logger.warn('[AppInit] Background database health check error:', error);
          });
      }, 5000, 3000);

      logger.log('[AppInit] App initialization completed on fast path');
      return {
        success: true,
        wasUpdated: false,
        needsReload: false,
      };
    }

    const [{ checkDatabaseHealth }, { runMigrations, validateDataIntegrity }] = await Promise.all([
      import('@/storage/db'),
      import('@/storage/migrations'),
    ]);

    // Updated installs still need DB validation before migrations.
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
