import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = resolve(
  process.cwd(),
  "supabase/migrations/20260812093000_private_friend_challenge_join.sql",
);

describe("private friend challenge join RPC contract", () => {
  it("keeps RLS closed and joins atomically through an authenticated rate-limited RPC", () => {
    const sql = readFileSync(MIGRATION, "utf8");

    expect(sql).toContain("CREATE TABLE public.friend_challenge_join_attempts");
    expect(sql).toContain("ALTER TABLE public.friend_challenge_join_attempts ENABLE ROW LEVEL SECURITY");
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.is_friend_challenge_participant\([\s\S]*SECURITY DEFINER[\s\S]*SET search_path = ''/);
    expect(sql).toMatch(/FROM public\.friend_challenge_members AS member[\s\S]*member\.challenge_id = p_challenge_id[\s\S]*member\.user_id = \(SELECT auth\.uid\(\)\)/);
    expect(sql).toContain('DROP POLICY IF EXISTS "friend_challenge_members_select" ON public.friend_challenge_members');
    expect(sql).toMatch(/CREATE POLICY "friend_challenge_members_select"[\s\S]*TO authenticated[\s\S]*is_friend_challenge_participant\(friend_challenge_members\.challenge_id\)/);
    expect(sql).toMatch(/CREATE POLICY "friend_challenges_select"[\s\S]*creator_id = \(SELECT auth\.uid\(\)\)[\s\S]*is_friend_challenge_participant\(friend_challenges\.id\)/);
    expect(sql).toContain("GRANT SELECT ON TABLE public.friend_challenges TO authenticated");
    expect(sql).toContain("GRANT SELECT ON TABLE public.friend_challenge_members TO authenticated");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.is_friend_challenge_participant(uuid) FROM anon");
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET search_path = ''");
    expect(sql).toContain("auth.uid()");
    expect(sql).toContain("attempt_count");
    expect(sql).toContain("INTERVAL '5 minutes'");
    expect(sql).toContain("INTERVAL '1 day'");
    expect(sql).toMatch(/CREATE INDEX friend_challenge_join_attempts_retention_idx[\s\S]*window_started_at/);
    expect(sql).toMatch(/DELETE FROM public\.friend_challenge_join_attempts[\s\S]*window_started_at < clock_timestamp\(\) - INTERVAL '1 day'/);
    expect(sql).toContain("ON DELETE CASCADE");
    expect(sql).toContain("v_attempt_count > 10");
    expect(sql).toContain("^ZEN-[A-HJ-NP-Z2-9]{6}$");
    expect(sql).toMatch(/INSERT INTO public\.friend_challenge_members[\s\S]*ON CONFLICT \(challenge_id, user_id\) DO NOTHING/);
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.join_friend_challenge_by_code(text) FROM PUBLIC");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.join_friend_challenge_by_code(text) FROM anon");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.join_friend_challenge_by_code(text) TO authenticated");
    expect(sql).not.toMatch(/CREATE POLICY[\s\S]*friend_challenges[\s\S]*USING \(true\)/);
    expect(sql).not.toMatch(/CREATE POLICY "friend_challenge_members_select"[\s\S]*FROM public\.friend_challenge_members AS m/);
  });

  it("returns no distinguishing error for invalid, expired, missing, or rate-limited codes", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    expect(sql.match(/RETURN;/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(sql).not.toContain("RAISE EXCEPTION");
    expect(sql).toMatch(/status = 'active'[\s\S]*end_date >= CURRENT_DATE/);
  });
});
