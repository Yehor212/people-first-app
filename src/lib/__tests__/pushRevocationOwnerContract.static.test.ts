import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260718150000_owner_bound_push_revoke.sql",
);

describe("owner-bound push revocation migration", () => {
  it("removes the owner-agnostic RPC and deletes only the expected owner's row", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(
      /DROP FUNCTION IF EXISTS public\.revoke_push_install\(text, text\)/i,
    );
    expect(sql).toMatch(
      /CREATE FUNCTION public\.revoke_push_install\(\s*p_device_id text,\s*p_expected_owner_user_id uuid,\s*p_token text\s*\)/i,
    );
    expect(sql).toMatch(/SECURITY DEFINER/i);
    expect(sql).toMatch(/SET search_path = ''/i);
    expect(sql).toMatch(/caller_id uuid := auth\.uid\(\)/i);
    expect(sql).toMatch(/IF caller_id IS NULL THEN/i);
    expect(sql).toMatch(/IF p_token IS NULL OR \(pg_catalog\.length\(p_token\) < 8/i);
    expect(sql).toMatch(
      /DELETE FROM public\.push_device_tokens[\s\S]*WHERE user_id = p_expected_owner_user_id[\s\S]*AND device_id = p_device_id[\s\S]*AND token = p_token/i,
    );
    expect(sql).toMatch(/IF\s+deleted_count\s*=\s*0\s+AND\s+EXISTS\s*\(/i);
    expect(sql).toMatch(
      /EXISTS\s*\([\s\S]*user_id\s*=\s*p_expected_owner_user_id[\s\S]*device_id\s*=\s*p_device_id/i,
    );
    expect(sql).toMatch(/RAISE\s+EXCEPTION\s+'Push installation token changed'/i);
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.revoke_push_install\(text, uuid, text\) FROM PUBLIC/i,
    );
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.revoke_push_install\(text, uuid, text\) FROM anon/i,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.revoke_push_install\(text, uuid, text\) TO authenticated/i,
    );
    expect(sql).toMatch(/NOTIFY pgrst, 'reload schema'/i);

    const deviceLock = sql.indexOf("hashtextextended(p_device_id, 0)");
    const tokenLock = sql.indexOf("hashtextextended(p_token, 1)");
    const ownerDelete = sql.indexOf("WHERE user_id = p_expected_owner_user_id");
    expect(deviceLock).toBeGreaterThan(-1);
    expect(tokenLock).toBeGreaterThan(deviceLock);
    expect(ownerDelete).toBeGreaterThan(tokenLock);
  });
});
