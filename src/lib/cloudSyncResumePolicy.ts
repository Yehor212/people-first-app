export function shouldRunLegacyBackupSyncOnNativeResume(isDeltaSyncEnabled: boolean): boolean {
  return !isDeltaSyncEnabled;
}
