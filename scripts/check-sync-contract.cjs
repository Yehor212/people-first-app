#!/usr/bin/env node
"use strict";

/**
 * Telegram-grade sync contract guard.
 *
 * This is a repo invariant check, not a runtime sync test. It protects the
 * durable building blocks future agents must preserve:
 * - ordered sync_events.seq deltas;
 * - first-run snapshot before advancing an empty cursor;
 * - server tombstones beating stale snapshots;
 * - docs and CI gates that make the contract visible before future edits.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

const failures = [];
let passCount = 0;

function relPath(file) {
  return file.replaceAll("\\", "/");
}

function abs(file) {
  return path.join(ROOT, file);
}

function read(file) {
  const target = abs(file);
  if (!fs.existsSync(target)) {
    failures.push(`${relPath(file)} is missing`);
    return "";
  }
  return fs.readFileSync(target, "utf8");
}

function pass() {
  passCount += 1;
}

function requireIncludes(file, snippets) {
  const source = read(file);
  if (!source) return;

  for (const snippet of snippets) {
    if (!source.includes(snippet)) {
      failures.push(`${relPath(file)} is missing required sync token: ${snippet}`);
    } else {
      pass();
    }
  }
}

function requireRegex(file, regex, label) {
  const source = read(file);
  if (!source) return;

  if (!regex.test(source)) {
    failures.push(`${relPath(file)} is missing required sync pattern: ${label}`);
  } else {
    pass();
  }
}

function requireNotIncludes(file, snippets) {
  const source = read(file);
  if (!source) return;

  for (const snippet of snippets) {
    if (source.includes(snippet)) {
      failures.push(`${relPath(file)} must not contain sync token: ${snippet}`);
    } else {
      pass();
    }
  }
}

function readMigrations() {
  const dir = abs("supabase/migrations");
  if (!fs.existsSync(dir)) {
    failures.push("supabase/migrations is missing");
    return "";
  }

  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b))
    .map((file) => fs.readFileSync(path.join(dir, file), "utf8"))
    .join("\n\n");
}

function requireMigrationToken(source, token) {
  if (!source.includes(token)) {
    failures.push(`supabase/migrations is missing required sync SQL token: ${token}`);
  } else {
    pass();
  }
}

function main() {
  requireIncludes("src/storage/eventSync.ts", [
    "sync_events",
    "seq",
    "fetchAllDeltas",
    "applyDelta",
    "await saveLastSeq(maxSeq)",
    "getDeletionTrackerKeyForSyncEntity",
    "WRITE_SYNC_EVENT",
    "writeQueuedEventAndBroadcast",
    "queueOnFailure",
    "idempotencyKey",
    "crypto.randomUUID()",
    "normalizeSyncEventWriteIntent",
    "sync_events_idempotency_idx",
  ]);
  requireNotIncludes("src/storage/eventSync.ts", [
    "${intent.deviceId}:${intent.entityType}:${intent.entityId}:${intent.op}",
  ]);

  requireIncludes("src/hooks/useDeltaSyncEffects.ts", [
    "bootstrapSnapshotThenDelta",
    "getLastSeq()",
    "fetchAllDeltas",
    "applyDelta",
    "SyncGapDetector",
    "onRemoteChange",
    "runWithSyncLeaderLock",
    "offlineQueue.processQueue()",
    "queue-blocked",
  ]);

  requireIncludes("src/lib/syncBroadcast.ts", [
    "sync-signal:${userId}",
    "config: { private: true }",
    "parseSyncSignal",
    "Only signals are broadcast, never data payloads",
  ]);

  requireIncludes("src/lib/syncLeader.ts", [
    "navigator as NavigatorWithLocks",
    "locks.request",
    "ifAvailable: true",
    "SK.SYNC_LEADER_LOCK",
    "expiresAt",
    "another tab owns delta sync",
  ]);

  requireIncludes("src/hooks/useTelegramGradeSyncRuntime.ts", [
    "useDeltaSyncEffects",
    "useDeviceSessionRuntime",
    "useSyncHealthRuntime",
    "V1 and V2 are one product state",
    "sync_events.seq",
  ]);

  requireIncludes("src/hooks/useDeviceSessionRuntime.ts", [
    "useDeviceSessionRuntime",
    "upsertCurrentDeviceSession",
    "DEVICE_SESSION_HEARTBEAT_INTERVAL_MS",
    "visibilitychange",
    "onAuthStateChange",
  ]);

  requireIncludes("src/storage/deviceSessions.ts", [
    "device_sessions",
    "getPersistentDeviceId",
    "getCurrentSessionUserId",
    "upsertCurrentDeviceSession",
    "listDeviceSessions",
    "revokeDeviceSession",
    "raw user-agent is not stored",
  ]);

  requireIncludes("src/hooks/useSyncHealthRuntime.ts", [
    "installSyncHealthRecorder",
    "offlineQueue.waitForInit()",
    "getCurrentSessionUserId",
    "getLastSeq",
    "SYNC_HEALTH_RECEIPT_EVENT",
  ]);

  requireIncludes("src/observability/syncHealthRecorder.ts", [
    "window.__zenflowSyncHealth",
    "shouldEnableSyncHealthRecorder",
    "syncHealth",
    "SYNC_HEALTH_RECEIPT_EVENT",
    "payload",
    "entity ids",
  ]);

  requireIncludes("src/components/sync/SyncHealthCard.tsx", [
    "data-testid=\"sync-inbox\"",
    "recentReceipts",
    "pendingActionText",
    "SYNC_HEALTH_RECEIPT_EVENT",
    "processQueue",
  ]);
  requireNotIncludes("src/components/sync/SyncHealthCard.tsx", [
    "action.entityId",
    "action.payload",
  ]);
  requireIncludes("src/components/sync/__tests__/SyncHealthCard.test.tsx", [
    "shows a bounded sync inbox",
    "not.toContain(\"journal-secret\")",
    "not.toContain(\"private journal body\")",
    "not.toContain(\"private habit\")",
  ]);

  requireIncludes("src/pages/Index.tsx", [
    "useTelegramGradeSyncRuntime",
    "useTelegramGradeSyncRuntime();",
  ]);

  requireIncludes("src/pages/IndexV1Impl.tsx", [
    "useTelegramGradeSyncRuntime",
    "useTelegramGradeSyncRuntime();",
  ]);

  requireIncludes("src/main.tsx", [
    "runWithSyncLeaderLock",
    "resume-delta-sync",
    "another tab owns sync",
  ]);

  requireNotIncludes("src/pages/Index.tsx", ['from "@/hooks/useDeltaSyncEffects"']);
  requireNotIncludes("src/pages/IndexV1Impl.tsx", ['from "@/hooks/useDeltaSyncEffects"']);

  requireIncludes("src/storage/initialDeltaSync.ts", [
    "getServerMaxSeq()",
    "pullFromCloud()",
    "fetchAllDeltas(baselineSeq",
    "saveLastSeq(baselineSeq)",
    "applyDelta(tailEvents",
  ]);

  requireIncludes("src/storage/realtimeSync.ts", [
    'from("sync_tombstones")',
    "select(\"entity_type, entity_id, deleted_seq\")",
    "mergeSyncTombstones",
    "deletedIds.mood",
    "deletedIds.habit",
    "deletedIds.focus",
    "deletedIds.gratitude",
    "deletedIds.journal",
  ]);

  requireIncludes("src/storage/sync/serverTombstones.ts", [
    "TombstonedSyncEntity",
    "collectSyncTombstoneIds",
    "mergeSyncTombstones",
    "mergeDeletedMoodIds",
    "mergeDeletedHabitIds",
    "mergeDeletedFocusSessionIds",
    "mergeDeletedGratitudeIds",
    "mergeDeletedJournalEntryIds",
  ]);

  requireIncludes("src/storage/__tests__/initialDeltaSync.test.ts", [
    "takes a snapshot baseline before fetching the delta tail",
    "saves the snapshot baseline when no tail events arrive",
    "does not advance the cursor when the snapshot bootstrap fails",
  ]);

  requireIncludes("src/lib/__tests__/syncLeader.test.ts", [
    "runs the task through Web Locks when this tab gets ownership",
    "skips the task when Web Locks reports another owner",
    "takes over an expired localStorage lease",
  ]);

  requireIncludes("src/lib/offlineQueueHandlers.ts", [
    "WRITE_SYNC_EVENT",
    "DELETE_SETTINGS",
    "deleteSettingFromCloud",
    "isSyncEventWriteIntent",
    "normalizeSyncEventWriteIntent",
    "action.payload = intent",
    "writeQueuedEventAndBroadcast",
  ]);

  requireIncludes("src/lib/offlineQueue.ts", [
    "WRITE_SYNC_EVENT",
    "syncEventActions",
    "deduplicate?: boolean; priority?: OfflineActionPriority",
    "await this.persistToStorage()",
    "priority: item.priority as OfflineActionPriority | undefined",
    "priority: action.priority",
    "Failed to persist queue to IndexedDB and localStorage",
    "Critical sync event blocked after max retries",
  ]);

  requireIncludes("src/storage/db.ts", ["priority?: string"]);

  requireIncludes("src/features/journal/journalDraftStorage.ts", [
    "getJournalDraftKey",
    "SK.journalDraft",
    "settingsRepo.put",
    "syncSetting(key, data)",
    "deleteSettingFromCloud(key)",
    "clearJournalDraft",
  ]);

  requireIncludes("src/storage/sync/syncSettings.ts", [
    "deleteSettingFromCloud",
    "\"DELETE_SETTINGS\"",
    "await writeEventAndBroadcast(\"setting\", key, \"delete\"",
  ]);

  requireIncludes("src/storage/sync/syncHabits.ts", [
    "Legacy habit delete tracked + evented",
    "await writeEventAndBroadcast(\"habit\", habitId, \"delete\", null, deviceId)",
  ]);

  for (const file of [
    "src/storage/sync/syncMoods.ts",
    "src/storage/sync/syncHabits.ts",
    "src/storage/sync/syncFocus.ts",
    "src/storage/sync/syncGratitude.ts",
    "src/storage/sync/syncJournal.ts",
    "src/storage/sync/syncSettings.ts",
  ]) {
    requireNotIncludes(file, [
      "void getPersistentDeviceId()",
      ".then((did) => writeEventAndBroadcast",
      ".then((deviceId) => writeEventAndBroadcast",
    ]);
    requireIncludes(file, ["await getPersistentDeviceId()", "await writeEventAndBroadcast"]);
  }

  requireIncludes("src/storage/sync/__tests__/serverTombstones.test.ts", [
    "collects only supported sync tombstone entity families",
    "merges server tombstones into every local anti-resurrection tracker",
  ]);

  requireIncludes("src/types/supabase.ts", [
    "sync_events",
    "sync_tombstones",
    "device_sessions",
    "deleted_seq",
  ]);

  const migrations = readMigrations();
  requireMigrationToken(migrations, "CREATE TABLE IF NOT EXISTS public.sync_events");
  requireMigrationToken(migrations, "sync_events_user_seq_idx");
  requireMigrationToken(migrations, "CREATE TABLE IF NOT EXISTS public.sync_tombstones");
  requireMigrationToken(migrations, "PRIMARY KEY (user_id, entity_type, entity_id)");
  requireMigrationToken(migrations, "trg_apply_sync_event_tombstone");
  requireMigrationToken(migrations, "CREATE TABLE IF NOT EXISTS public.device_sessions");
  requireMigrationToken(migrations, "device_sessions_select_own");
  requireMigrationToken(migrations, "GRANT SELECT, INSERT, UPDATE ON TABLE public.device_sessions TO authenticated");
  requireMigrationToken(migrations, "ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY");
  requireMigrationToken(migrations, "sync broadcast receive own topic");
  requireMigrationToken(migrations, "sync-signal:' || (SELECT auth.uid())::text");

  requireIncludes("docs/ai/SYNC_CONTRACT.md", [
    "sync_events.seq",
    "sync_tombstones",
    "WRITE_SYNC_EVENT",
    "smoke:sync-account",
    "smoke:telegram-sync-drill",
    "TELEGRAM_GRADE_20_IDEA_LEDGER.md",
    "__zenflowSyncHealth",
    "device_sessions",
    "TELEGRAM_GRADE_SYNC_100_PERCENT_CLOSURE.md",
    "broadcast is a wake-up signal",
    "V1 and V2 are one product state",
    "anti-resurrection",
    "runWithSyncLeaderLock",
  ]);

  requireIncludes("docs/ai/TELEGRAM_GRADE_RUNTIME_CONTRACT.md", [
    "docs/ai/SYNC_CONTRACT.md",
    "docs/ai/TASK_COMPLETION_PROTOCOL.md",
    "TELEGRAM_GRADE_SYNC_100_PERCENT_CLOSURE.md",
    "TELEGRAM_GRADE_20_IDEA_LEDGER.md",
    "__zenflowSyncHealth",
    "device_sessions",
    "sync_events.seq",
    "WRITE_SYNC_EVENT",
    "Tombstones beat stale snapshots",
    "Multi-tab browser",
    "smoke:telegram-sync-drill",
  ]);

  requireIncludes("docs/ai/TASK_COMPLETION_PROTOCOL.md", [
    "DONE is an evidence state",
    "No evidence = FAIL",
    "Done Packet",
    "PASS",
    "PARTIAL",
    "UNVERIFIED",
    "FAIL",
    "WAIVED",
    "telegram-sync-drill",
    "TELEGRAM_GRADE_RUNTIME_CONTRACT.md",
    "SYNC_CONTRACT.md",
    "TELEGRAM_GRADE_SYNC_100_PERCENT_CLOSURE.md",
    "TELEGRAM_GRADE_20_IDEA_LEDGER.md",
    "CANONICAL_ORB_INVARIANT.md",
    "GitHub Pages",
    "Snyk",
    "Supabase",
    "RLS",
    "smoke:telegram-sync-drill",
  ]);

  requireIncludes("docs/ai/TELEGRAM_GRADE_SYNC_100_PERCENT_CLOSURE.md", [
    "100 percent is a proof state",
    "sync_events.seq",
    "TELEGRAM_GRADE_20_IDEA_LEDGER.md",
    "__zenflowSyncHealth",
    "Device Sessions",
    "Sync Inbox And Action Receipts Are Privacy-Safe",
    "Supabase Broadcast wake clients only",
    "Deletes Cannot Resurrect",
    "One Sync Owner Applies Deltas",
    "Account Boundary Is Never Mixed",
    "Entity Coverage Matrix",
    "Platform Closure Matrix",
    "smoke:sync-account",
    "smoke:telegram-sync-drill",
    "check:canonical-orbs",
    "telegram-sync-drill",
  ]);

  requireIncludes("docs/ai/TELEGRAM_GRADE_20_IDEA_LEDGER.md", [
    "Sync Inbox",
    "Gap Recovery Dashboard",
    "Device Sessions",
    "Action Receipts",
    "Offline Outbox UX",
    "Snapshot Plus Delta Recovery",
    "Per-Domain Sync Ownership",
    "Cross-Platform Resume Protocol",
    "Performance Flight Recorder",
    "Adaptive Runtime Without Visual Regression",
    "Telegram-Style Local DB Discipline",
    "Fast Shell, Deferred Heavy Modules",
    "Conflict UX For Diary",
    "Anti-Resurrection Matrix",
    "Sync-Aware Notifications",
    "Draft Everywhere",
    "Command Queue For User Actions",
    "Public Deploy Proof Mode",
    "Service Worker Safety Layer",
    "Telegram Sync Drill Release Gate",
    "ZENFLOW_SYNC_TEST_EMAIL",
    "ZENFLOW_SYNC_TEST_PASSWORD",
    "setup:sync-test-account",
    "ValenceOrb",
    "MiniValenceOrb",
  ]);

  requireIncludes("docs/DEFINITION_OF_DONE.md", [
    "Sync contract invariant",
    "npm run check:sync-contract",
    "Sync 100 percent closure matrix",
    "Telegram sync drill",
    "Task completion protocol",
    "TASK_COMPLETION_PROTOCOL.md",
    "TELEGRAM_GRADE_20_IDEA_LEDGER.md",
  ]);

  requireIncludes("docs/RELEASE_CHECKLIST.md", [
    "Verify two active tabs converge",
    "smoke:telegram-sync-drill",
    "telegram-sync-drill",
    "TELEGRAM_GRADE_SYNC_100_PERCENT_CLOSURE.md",
    "TASK_COMPLETION_PROTOCOL.md",
    "TELEGRAM_GRADE_20_IDEA_LEDGER.md",
  ]);

  requireIncludes("package.json", [
    '"check:task-completion": "node scripts/check-task-completion-protocol.cjs"',
    '"check:sync-contract": "node scripts/check-sync-contract.cjs"',
    '"smoke:sync-health": "node scripts/smoke-sync-health.cjs"',
    '"smoke:sync-account": "node scripts/smoke-sync-account.cjs"',
    '"smoke:telegram-sync-drill": "node scripts/smoke-telegram-sync-drill.cjs"',
    '"check:github-sync-secrets": "node scripts/check-github-sync-secrets.cjs"',
    '"setup:sync-test-account": "node scripts/setup-sync-test-account.cjs"',
    "npm run check:task-completion",
    "npm run check:sync-contract",
  ]);

  requireIncludes("scripts/setup-sync-test-account.cjs", [
    "ZENFLOW_SYNC_TEST_ACCOUNT_APPLY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "ZENFLOW_SYNC_TEST_SET_GITHUB_SECRETS",
    "createUser",
    "updateUserById",
    "signInWithPassword",
    "gh",
    "secret",
    "never prints passwords",
  ]);

  requireIncludes("scripts/check-github-sync-secrets.cjs", [
    "ZENFLOW_GITHUB_SYNC_SECRETS_REQUIRED",
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
    "ZENFLOW_SYNC_TEST_EMAIL",
    "ZENFLOW_SYNC_TEST_PASSWORD",
    "gh",
    "secret",
    "never prints secret values",
  ]);

  requireIncludes("scripts/smoke-sync-account.cjs", [
    "crypto.randomUUID()",
    "ZENFLOW_SYNC_TEST_EMAIL",
    "sync_events",
    "sync_tombstones",
    "idempotency_key",
    "upsert,delete",
  ]);
  requireNotIncludes("scripts/smoke-sync-account.cjs", [
    "${deviceA}:journal:${entityId}:upsert",
    "${deviceB}:journal:${entityId}:delete",
  ]);

  requireIncludes("scripts/smoke-sync-health.cjs", [
    "ZENFLOW_SYNC_HEALTH_URL",
    "syncHealth=1",
    "window.__zenflowSyncHealth.snapshot",
    "FORBIDDEN_STRINGS",
    "private-journal-content",
    "private-habit-name",
    "zenflow:sync-health-receipt",
  ]);

  requireIncludes("scripts/smoke-telegram-sync-drill.cjs", [
    "Telegram-grade sync drill",
    "ZENFLOW_SYNC_DRILL_URL",
    "ZENFLOW_TELEGRAM_SYNC_DRILL_REQUIRED",
    "check:sync-contract",
    "check:canonical-orbs",
    "check:supabase-migration-prefixes",
    "smoke-sync-health.cjs",
    "smoke-sync-account.cjs",
    "UNVERIFIED",
    "PARTIAL",
    "GITHUB_STEP_SUMMARY",
  ]);

  requireIncludes(".github/workflows/deploy.yml", [
    "Check task completion protocol",
    "npm run check:task-completion",
    "Check Telegram-grade sync contract",
    "npm run check:sync-contract",
    "Run Telegram sync drill",
    "npm run smoke:telegram-sync-drill",
    "ZENFLOW_SYNC_DRILL_URL",
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_ANON_KEY",
    "telegram-sync-drill",
    "actions/upload-artifact",
  ]);

  requireRegex(
    "src/storage/eventSync.ts",
    /await db\.transaction\("rw", tables, async \(\) =>[\s\S]*await db\.settings\.put\(\{ key: SYNC_SEQ_KEY, value: maxSeq \}\);[\s\S]*\}\);/,
    "applyDelta saves the cursor inside the IndexedDB transaction"
  );

  if (failures.length > 0) {
    console.error("[sync-contract] FAIL");
    console.error("");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    console.error("");
    console.error("Fix: preserve Telegram-grade sync ordering, snapshot bootstrap, tombstones, docs, and CI gates.");
    process.exit(1);
  }

  console.log(`[sync-contract] OK - ${passCount} sync invariants verified.`);
}

main();
