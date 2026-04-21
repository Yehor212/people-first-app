import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_NAME = "20260420055001_authenticated_scope_rls.sql";
const migrationPath = path.resolve(
  process.cwd(),
  "supabase",
  "migrations",
  MIGRATION_NAME,
);

const PUBLIC_POLICY_NAMES = [
  "profiles_select",
  "profiles_insert",
  "profiles_update",
  "user_profiles_select",
  "user_profiles_insert",
  "user_profiles_update",
  "user_profiles_delete",
  "moods_all",
  "habits_all",
  "habit_completions_all",
  "habit_reminders_all",
  "focus_sessions_all",
  "gratitude_entries_all",
  "challenges_all",
  "badges_all",
  "adhd_state_all",
  "mystery_boxes_all",
  "time_challenges_all",
  "user_backups_all",
  "user_settings_all",
  "user_data_all",
  "push_subscriptions_all",
  "push_logs_select",
  "push_logs_insert",
  "push_device_tokens_all",
  "leaderboards_insert",
  "leaderboards_update",
  "leaderboards_delete",
  "user_challenges_all",
  "user_badges_all",
  "user_tasks_all",
  "user_quests_all",
  "user_stats_all",
  "journal_entries_all",
  "journal_photos_all",
  "journal_audio_all",
  "user_reminder_settings_all",
  "user_inner_world_all",
  "sync_seq_counters_select_own",
  "sync_events_select_own",
  "sync_events_insert_own",
  "analytics_events_insert",
  "analytics_events_select",
  "friend_challenges_insert",
  "friend_challenges_update",
  "friend_challenges_delete",
  "friend_challenge_members_insert",
  "friend_challenge_members_update",
  "friend_challenge_members_delete",
  "Users can read own embeddings",
  "Users can insert own embeddings",
  "Users can delete own embeddings",
] as const;

const STORAGE_POLICY_NAMES = [
  "journal_photos_upload",
  "journal_photos_select",
  "journal_photos_delete",
  "journal_audio_upload",
  "journal_audio_select",
  "journal_audio_delete",
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function expectAuthenticatedScopedPolicy(sql: string, policyName: string): void {
  const escapedName = escapeRegExp(policyName);
  expect(sql).toMatch(
    new RegExp(`DROP POLICY IF EXISTS "${escapedName}" ON [^;]+;`, "i"),
  );
  expect(sql).toMatch(
    new RegExp(
      `CREATE POLICY "${escapedName}"[\\s\\S]*?TO authenticated[\\s\\S]*?;`,
      "i",
    ),
  );
}

describe("authenticated RLS scope migration", () => {
  it("adds a dedicated migration for hot user-owned policies", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  it("recreates selected public-schema policies with TO authenticated", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");

    for (const policyName of PUBLIC_POLICY_NAMES) {
      expectAuthenticatedScopedPolicy(sql, policyName);
    }
  });

  it("recreates storage policies with TO authenticated", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");

    for (const policyName of STORAGE_POLICY_NAMES) {
      expectAuthenticatedScopedPolicy(sql, policyName);
    }
  });
});
