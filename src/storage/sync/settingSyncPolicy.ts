import { SK } from "@/lib/storageKeys";
import { DELETION_TRACKER_KEYS } from "@/storage/deletionTracker";

const LOCAL_ONLY_SETTING_KEYS = new Set<string>([
  "sync-last-seq",
  "sync-cursor-v2",
  "zenflow-device-id",
  SK.DEVICE_ID,
  SK.LAST_SYNC_SEQ,
  SK.SYNC_LEADER_LOCK,
  SK.JOURNAL_PASSWORD,
  SK.JOURNAL_BIOMETRIC,
  SK.JOURNAL_SCREENSHOT_BLOCK,
  ...Object.values(DELETION_TRACKER_KEYS),
]);

export function isLocalOnlySettingKey(key: string): boolean {
  return LOCAL_ONLY_SETTING_KEYS.has(key);
}

export function isAccountSyncedSettingKey(key: string): boolean {
  return !isLocalOnlySettingKey(key);
}
