import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("T170 production runtime reachability", () => {
  it("mounts one automation lifecycle owner in the shared app shell", () => {
    const source = read("src/pages/Index.tsx");
    expect(source).toMatch(
      /import\s+\{\s*useAutomation\s*\}\s+from\s+["']@\/features\/automation["']/u
    );
    expect(source).toMatch(/useAutomation\(\{\s*localizedMoodJournalTitle:/u);
  });

  it("routes ordinary mood, focus and habit commits through persistence-first adapters", () => {
    const moodHandlers = read("src/hooks/useMoodHandlers.ts");
    expect(moodHandlers).toContain("persistMoodSourceRecord");
    expect(moodHandlers).not.toContain("syncMood(");
    expect(read("src/hooks/useFocusHandlers.ts")).toContain("persistFocusSourceRecord");
    expect(read("src/hooks/useHabitHandlers.ts")).toContain("commitHabitEntry");
    expect(read("src/pages/nav-v2/habits/HabitsPage.tsx")).toContain("commitHabitEntry");
  });

  it("atomically detaches every manual automation target before its critical outbox wakes", () => {
    const sourcePersistence = read("src/features/automation/automationSourcePersistence.ts");
    const targetPersistence = read("src/features/automation/automationTargetPersistence.ts");
    const journalStorage = read("src/features/journal/journalStorage.ts");
    const planning = read("src/pages/nav-v2/planning/PlanningPage.tsx");

    expect(sourcePersistence).toContain("persistManualMoodOutboxInCurrentTransaction");
    expect(sourcePersistence).toContain("persistManualHabitCompletionOutboxInCurrentTransaction");
    expect(sourcePersistence).toContain("offlineQueue.wakeFromDurableStorage");
    expect(targetPersistence).toContain("detachAutomationRecordRevisionInCurrentTransaction");
    expect(targetPersistence).toContain("persistCriticalOfflineActionInCurrentTransaction");
    expect(targetPersistence).toContain("settingSyncRevisionKey");
    expect(journalStorage).toContain(
      'detachAutomationRecordRevisionInCurrentTransaction("journal"'
    );
    expect(journalStorage).toContain('"SYNC_JOURNAL_ENTRY"');
    expect(planning).toContain("commitManualScheduleEvents");
    expect(planning).not.toContain("syncSetting(");
  });

  it("binds journal save and update transactions to source-intent persistence", () => {
    const source = read("src/features/journal/journalStorage.ts");
    expect(source).toContain("prepareJournalAutomationSourceCommit");
    expect(source).toContain("persistAutomationSourceIntentInCurrentTransaction");
    expect(source).toContain("signalAutomationSourceReady");
  });

  it("connects source-ready and vault-session changes to owner-scoped reconciliation", () => {
    const hook = read("src/features/automation/useAutomation.ts");
    const runtime = read("src/features/automation/automationRuntime.ts");
    const remoteSync = read("src/features/automation/automationRemoteSync.ts");
    const eventSync = read("src/storage/eventSync.ts");
    expect(hook).toContain("AUTOMATION_SOURCE_READY_EVENT");
    expect(hook).toContain("JOURNAL_CONTENT_SESSION_CHANGED_EVENT");
    expect(runtime).toContain("processAutomationSourceIntent");
    expect(runtime).toContain("recoverDeferredAutomationSourceIntents");
    expect(runtime).toContain("bootstrapAutomationHistoryOnce(ownerUserId, { force: true })");
    expect(runtime).toContain("reconcilePendingAutomationEvents");
    expect(runtime).toMatch(
      /import\s+\{[^}]*reconcilePendingAutomationEvents[^}]*\}\s+from\s+["']@\/storage\/eventSync["']/su
    );
    expect(runtime).not.toContain('from "./automationRemoteSync"');
    expect(remoteSync).toContain("markAutomationDataRefreshPendingInCurrentTransaction");
    expect(eventSync).toContain("flushPendingAutomationDataRefresh");
    expect(eventSync).toContain("signalAutomationSourceReady");
  });

  it("keeps automation recovery diagnostics free of raw errors and private identifiers", () => {
    const preferences = read("src/features/automation/automationPreferences.ts");
    const historyClear = read("src/features/automation/automationHistoryClear.ts");
    const legacyHabits = read("src/hooks/useHabitHandlers.ts");
    const v2Habits = read("src/pages/nav-v2/habits/HabitsPage.tsx");
    const eventSync = read("src/storage/eventSync.ts");
    const journalStorage = read("src/features/journal/journalStorage.ts");
    const journalSync = read("src/storage/sync/syncJournal.ts");
    const focusSync = read("src/storage/sync/syncFocus.ts");

    expect(preferences).not.toMatch(/logger\.warn\([^;]*,\s*error\s*\)/su);
    expect(historyClear).not.toMatch(/logger\.warn\([^;]*(?:operationId|error\.message)[^;]*\)/su);
    expect(legacyHabits).not.toMatch(/logger\.(?:warn|error)\([^;]*,\s*err\s*\)/su);
    expect(v2Habits).not.toMatch(/logger\.(?:warn|error)\([^;]*,\s*err\s*\)/su);
    expect(eventSync).not.toMatch(/logger\.warn\([^;]*row\.id[^;]*\)/su);
    expect(journalStorage).not.toMatch(
      /logger\.warn\("\[JournalSync\]"[^;]*,\s*(?:photoId|audioId|error|err)\s*\)/su
    );
    expect(journalStorage).not.toMatch(
      /logger\.(?:log|warn|error)\([^;]*,\s*(?:photo\.id|audio\.id|photoId|audioId|error|err)\s*\)/su
    );
    expect(journalStorage).not.toMatch(/no storage result:[^;]*\+\s*(?:photo|audio)\.id/su);
    expect(journalSync).not.toMatch(
      /logger\.(?:log|warn|error)\([^;]*,\s*(?:photo\.id|audio\.id|photoId|audioId|error)\s*\)/su
    );
    expect(focusSync).not.toMatch(/logger\.error\([^;]*,\s*(?:error|err)\s*\)/su);
    expect(preferences).toContain("AUTOMATION_PREFERENCE_REFRESH_DEFERRED");
    expect(preferences).toContain("AUTOMATION_PREFERENCE_REVOCATION_RETRY_QUEUED");
    expect(historyClear).toContain("AUTOMATION_HISTORY_PURGE_RETRY_DEFERRED");
  });
});
