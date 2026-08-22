import { SK } from "@/lib/storageKeys";
import { DELETION_TRACKER_KEYS } from "@/storage/deletionTracker";
import {
  AUTOMATION_LOCAL_REFRESH_SETTING_KEY,
  AUTOMATION_PREFERENCE_SETTING_KEY,
  AUTOMATION_SOURCE_RESCAN_SETTING_KEY,
} from "@/features/automation/types";

const LOCAL_ONLY_SETTING_KEYS = new Set<string>([
  "sync-last-seq",
  "sync-cursor-v2",
  "zenflow-device-id",
  AUTOMATION_LOCAL_REFRESH_SETTING_KEY,
  AUTOMATION_SOURCE_RESCAN_SETTING_KEY,
  SK.DEVICE_ID,
  SK.DATA_OWNER_ID,
  SK.PENDING_LOCAL_BACKUP_ACCOUNT_CLAIM,
  SK.LAST_SYNC_SEQ,
  SK.SYNC_LEADER_LOCK,
  SK.JOURNAL_PASSWORD,
  SK.JOURNAL_PASSWORD_COOLDOWN,
  SK.JOURNAL_PASSWORD_RESET,
  SK.JOURNAL_PASSWORD_RESET_PROOF,
  SK.JOURNAL_SECURITY_MIGRATION,
  SK.JOURNAL_SECURITY_REMOVAL,
  SK.JOURNAL_VAULT_REVISION,
  SK.JOURNAL_BIOMETRIC,
  SK.JOURNAL_SCREENSHOT_BLOCK,
  SK.JOURNAL_PENDING_ENTRY_DELETES,
  SK.PRIVACY,
  ...Object.values(DELETION_TRACKER_KEYS),
]);

export const SETTING_SYNC_REVISION_PREFIX = "zenflow-setting-sync-revision:";

const LOCAL_ONLY_SETTING_KEY_PREFIXES = [
  "journal_draft_",
  SK.JOURNAL_AI_REVOCATION_PREFIX,
  SETTING_SYNC_REVISION_PREFIX,
];
const LEGACY_CLOUD_DELETE_SETTING_PREFIXES = ["journal_draft_"];
const LEGACY_CLOUD_DELETE_SETTING_KEYS = new Set<string>([SK.PRIVACY]);
const DEDICATED_SYNC_SETTING_KEYS = new Set<string>([AUTOMATION_PREFERENCE_SETTING_KEY]);

function hasAnyPrefix(key: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => key.startsWith(prefix));
}

export function isLocalOnlySettingKey(key: string): boolean {
  return LOCAL_ONLY_SETTING_KEYS.has(key) || hasAnyPrefix(key, LOCAL_ONLY_SETTING_KEY_PREFIXES);
}

export function isDedicatedSyncSettingKey(key: string): boolean {
  return DEDICATED_SYNC_SETTING_KEYS.has(key);
}

export function isAccountSyncedSettingKey(key: string): boolean {
  return !isLocalOnlySettingKey(key) && !isDedicatedSyncSettingKey(key);
}

export function shouldDeleteSettingFromCloud(key: string): boolean {
  return (
    isAccountSyncedSettingKey(key) ||
    LEGACY_CLOUD_DELETE_SETTING_KEYS.has(key) ||
    hasAnyPrefix(key, LEGACY_CLOUD_DELETE_SETTING_PREFIXES)
  );
}

export function settingSyncRevisionKey(key: string): string {
  return `${SETTING_SYNC_REVISION_PREFIX}${key}`;
}
