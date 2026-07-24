import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260722013000_owner_bound_push_claim.sql"
);

describe("owner-bound push claim migration", () => {
  it("atomically rejects a JWT that differs from the expected admitted owner", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(/DROP FUNCTION IF EXISTS public\.claim_push_install\(text, text, text\)/i);
    expect(sql).toMatch(/p_expected_owner_user_id uuid/i);
    expect(sql).toMatch(/caller_id uuid := auth\.uid\(\)/i);
    expect(sql).toMatch(/caller_id <> p_expected_owner_user_id/i);
    expect(sql).toMatch(/SECURITY DEFINER/i);
    expect(sql).toMatch(/SET search_path = ''/i);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.claim_push_install\(text, text, uuid, text\) FROM PUBLIC/i);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.claim_push_install\(text, text, uuid, text\) FROM anon/i);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.claim_push_install\(text, text, uuid, text\) TO authenticated/i);
    expect(sql).toMatch(/NOTIFY pgrst, 'reload schema'/i);
  });
});
