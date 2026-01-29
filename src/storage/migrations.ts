import { db } from '@/storage/db';
import { logger } from '@/lib/logger';
import { DATA_SCHEMA_VERSION } from '@/lib/appVersion';

export interface Migration {
  version: number;
  name: string;
  migrate: () => Promise<void>;
}

// Migration from version 1 to version 2
const migration_1_to_2: Migration = {
  version: 2,
  name: 'Add schema version tracking and validate data structure',
  migrate: async () => {
    logger.log('[Migration] Running migration 1→2: Add schema version tracking');

    // Ensure all settings have proper structure
    const settings = await db.settings.toArray();

    for (const setting of settings) {
      // Ensure value is properly structured
      if (setting.value && typeof setting.value === 'object') {
        await db.settings.put(setting);
      }
    }

    logger.log('[Migration] Migration 1→2 completed');
  }
};

// Add future migrations here
const migrations: Migration[] = [
  migration_1_to_2,
  // migration_2_to_3,
  // migration_3_to_4,
];

// Run all pending migrations
export const runMigrations = async (fromVersion: number, toVersion: number): Promise<void> => {
  logger.log(`[Migration] Running migrations from version ${fromVersion} to ${toVersion}`);

  const pendingMigrations = migrations.filter(
    m => m.version > fromVersion && m.version <= toVersion
  );

  if (pendingMigrations.length === 0) {
    logger.log('[Migration] No migrations needed');
    return;
  }

  // Sort migrations by version
  pendingMigrations.sort((a, b) => a.version - b.version);

  // Run migrations sequentially
  for (const migration of pendingMigrations) {
    try {
      logger.log(`[Migration] Starting: ${migration.name} (v${migration.version})`);
      await migration.migrate();
      logger.log(`[Migration] Completed: ${migration.name} (v${migration.version})`);
    } catch (error) {
      logger.error(`[Migration] Failed: ${migration.name} (v${migration.version})`, error);
      throw new Error(`Migration failed: ${migration.name}`);
    }
  }

  logger.log('[Migration] All migrations completed successfully');
};

// Check if migrations are needed
export const needsMigration = (currentVersion: number, targetVersion: number): boolean => {
  return migrations.some(m => m.version > currentVersion && m.version <= targetVersion);
};

// Validate data integrity after migration
export const validateDataIntegrity = async (): Promise<boolean> => {
  try {
    // Check if all tables are accessible
    await db.moods.count();
    await db.habits.count();
    await db.focusSessions.count();
    await db.gratitudeEntries.count();
    await db.settings.count();

    logger.log('[Migration] Data integrity check passed');
    return true;
  } catch (error) {
    logger.error('[Migration] Data integrity check failed:', error);
    return false;
  }
};
