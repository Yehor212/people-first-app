import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
function readMigration(path: string) {
  const fullPath = join(root, path);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
}

const baseMigration = readMigration(
  "supabase/migrations/20260618020658_harden_security_definer_execute_and_rls_initplan.sql",
);
const explicitRoleMigration = readMigration(
  "supabase/migrations/20260618020915_revoke_security_definer_api_roles_explicitly.sql",
);
const invokerMigration = readMigration(
  "supabase/migrations/20260618022314_security_invoker_app_rpcs_and_vector_extension.sql",
);
const foreignKeyIndexMigration = readMigration(
  "supabase/migrations/20260618022951_index_advisor_foreign_keys.sql",
);
const combinedMigrations = [baseMigration, explicitRoleMigration, invokerMigration, foreignKeyIndexMigration].join("\n");

const triggerOnlyFunctions = [
  "assign_sync_seq()",
  "handle_new_user()",
  "handle_user_login()",
  "reset_monthly_leaderboard()",
  "reset_weekly_leaderboard()",
];

const authenticatedRpcFunctions = [
  "calculate_streak(uuid)",
  "get_user_stats(uuid)",
  "get_user_weekly_summary(date)",
  "get_challenge_leaderboard(uuid)",
  "update_member_progress(uuid, uuid, integer, integer)",
  "match_journal_entries(extensions.vector, uuid, double precision, integer)",
];

function expectRevokedFromPublic(signature: string) {
  expect(baseMigration).toContain(`REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC;`);
}

describe("Supabase hardening migrations", () => {
  it("revokes PUBLIC execute on every original advisor-reported SECURITY DEFINER function", () => {
    for (const signature of [
      ...triggerOnlyFunctions,
      "calculate_streak(uuid)",
      "match_journal_entries(public.vector, uuid, double precision, integer)",
      "get_user_stats(uuid)",
      "get_user_weekly_summary(date)",
      "get_challenge_leaderboard(uuid)",
      "update_member_progress(uuid, uuid, integer, integer)",
    ]) {
      expectRevokedFromPublic(signature);
    }
  });

  it("explicitly revokes trigger-only and background functions from API roles", () => {
    for (const signature of [
      ...triggerOnlyFunctions,
      "calculate_streak(uuid)",
      "match_journal_entries(public.vector, uuid, double precision, integer)",
    ]) {
      expect(explicitRoleMigration).toContain(`REVOKE ALL ON FUNCTION public.${signature} FROM anon, authenticated;`);
    }

    for (const signature of triggerOnlyFunctions) {
      expect(combinedMigrations).not.toContain(`GRANT EXECUTE ON FUNCTION public.${signature} TO authenticated;`);
      expect(combinedMigrations).not.toContain(`GRANT EXECUTE ON FUNCTION public.${signature} TO anon;`);
    }
  });

  it("removes anonymous execute while keeping authenticated execute for app-used RPCs", () => {
    for (const signature of [
      "get_user_stats(uuid)",
      "get_user_weekly_summary(date)",
      "get_challenge_leaderboard(uuid)",
      "update_member_progress(uuid, uuid, integer, integer)",
    ]) {
      expect(explicitRoleMigration).toContain(`REVOKE ALL ON FUNCTION public.${signature} FROM anon;`);
      expect(combinedMigrations).toContain(`GRANT EXECUTE ON FUNCTION public.${signature} TO authenticated;`);
      expect(combinedMigrations).not.toContain(`GRANT EXECUTE ON FUNCTION public.${signature} TO anon;`);
    }
  });

  it("converts app-used RPCs to SECURITY INVOKER and restores search RPC execute safely", () => {
    expect(invokerMigration).toContain("ALTER EXTENSION vector SET SCHEMA extensions;");
    expect(invokerMigration).toContain("GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;");

    for (const functionName of [
      "public.calculate_streak",
      "public.get_user_stats",
      "public.get_user_weekly_summary",
      "public.get_challenge_leaderboard",
      "public.update_member_progress",
      "public.match_journal_entries",
    ]) {
      expect(invokerMigration).toContain(`CREATE OR REPLACE FUNCTION ${functionName}`);
    }

    expect(invokerMigration.match(/SECURITY INVOKER/g)).toHaveLength(6);
    expect(invokerMigration).not.toContain("SECURITY DEFINER");
    expect(invokerMigration).toContain("GRANT EXECUTE ON FUNCTION public.match_journal_entries(extensions.vector, uuid, double precision, integer) TO authenticated;");

    for (const signature of authenticatedRpcFunctions) {
      expect(combinedMigrations).toContain(`GRANT EXECUTE ON FUNCTION public.${signature} TO authenticated;`);
      expect(combinedMigrations).not.toContain(`GRANT EXECUTE ON FUNCTION public.${signature} TO anon;`);
    }
  });

  it("uses initplan-safe auth.uid wrappers in advisor-covered policies", () => {
    expect(baseMigration).toContain('DROP POLICY IF EXISTS "Users can update own embeddings"');
    expect(baseMigration).toContain('DROP POLICY IF EXISTS "friend_challenges_select"');
    expect(baseMigration).toContain('DROP POLICY IF EXISTS "user_profiles_select"');

    expect(baseMigration).toContain("USING (user_id = (select auth.uid()))");
    expect(baseMigration).toContain("WITH CHECK (user_id = (select auth.uid()))");
    expect(baseMigration).toContain("creator_id = (select auth.uid())");
    expect(baseMigration).toContain("member.user_id = (select auth.uid())");

    expect(baseMigration).not.toContain("USING (user_id = auth.uid())");
    expect(baseMigration).not.toContain("WITH CHECK (user_id = auth.uid())");
    expect(baseMigration).not.toContain("creator_id = auth.uid()");
  });

  it("does not include secrets or destructive table-level operations", () => {
    expect(combinedMigrations).not.toMatch(/SUPABASE_SERVICE|secret|password|token/i);
    expect(combinedMigrations).not.toMatch(/DROP\s+TABLE|TRUNCATE|DELETE\s+FROM|DISABLE\s+ROW\s+LEVEL\s+SECURITY/i);
  });

  it("adds covering indexes for advisor-reported foreign keys without broad schema changes", () => {
    for (const expectedIndex of [
      "CREATE INDEX IF NOT EXISTS challenges_user_id_idx ON public.challenges (user_id);",
      "CREATE INDEX IF NOT EXISTS challenges_habit_id_idx ON public.challenges (habit_id);",
      "CREATE INDEX IF NOT EXISTS design_flags_updated_by_idx ON public.design_flags (updated_by);",
      "CREATE INDEX IF NOT EXISTS habit_reminders_habit_id_idx ON public.habit_reminders (habit_id);",
      "CREATE INDEX IF NOT EXISTS mystery_boxes_user_id_idx ON public.mystery_boxes (user_id);",
      "CREATE INDEX IF NOT EXISTS sync_tombstones_deleted_event_id_idx ON public.sync_tombstones (deleted_event_id);",
    ]) {
      expect(foreignKeyIndexMigration).toContain(expectedIndex);
    }

    expect(foreignKeyIndexMigration).toContain("NOTIFY pgrst, 'reload schema';");
    expect(foreignKeyIndexMigration).not.toMatch(/DROP\s+INDEX|DROP\s+TABLE|ALTER\s+TABLE|DELETE\s+FROM|TRUNCATE/i);
  });
});
