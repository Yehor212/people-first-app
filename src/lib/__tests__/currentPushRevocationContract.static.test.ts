import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260902000013_revoke_current_push_install.sql",
);
const generatedTypesPath = resolve(process.cwd(), "src/types/supabase.ts");

describe("current-install push revocation migration", () => {
  it("keeps the RPC invoker-scoped to the authenticated owner and one installation capability", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(
      /CREATE FUNCTION public\.revoke_current_push_install\(\s*p_expected_owner_user_id uuid,\s*p_device_id text DEFAULT NULL,\s*p_token text DEFAULT NULL\s*\)/i,
    );
    expect(sql).toMatch(/SECURITY INVOKER/i);
    expect(sql).not.toMatch(/SECURITY DEFINER/i);
    expect(sql).toMatch(/SET search_path = ''/i);
    expect(sql).toMatch(/caller_id uuid := \(select auth\.uid\(\)\)/i);
    expect(sql).toMatch(/IF caller_id IS NULL THEN/i);
    expect(sql).toMatch(/IF caller_id <> p_expected_owner_user_id THEN/i);
    expect(sql).toMatch(/IF p_device_id IS NULL AND p_token IS NULL THEN/i);
    expect(sql).toMatch(
      /DELETE FROM public\.push_device_tokens[\s\S]*WHERE user_id = caller_id[\s\S]*p_device_id IS NOT NULL[\s\S]*device_id = p_device_id[\s\S]*p_device_id IS NULL[\s\S]*token = p_token/i,
    );
    expect(sql).not.toMatch(/DELETE FROM public\.push_device_tokens\s+WHERE user_id = caller_id\s*;/i);
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.revoke_current_push_install\(uuid, text, text\) FROM PUBLIC/i,
    );
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.revoke_current_push_install\(uuid, text, text\) FROM anon/i,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.revoke_current_push_install\(uuid, text, text\) TO authenticated/i,
    );
    expect(sql).toMatch(/NOTIFY pgrst, 'reload schema'/i);
  });

  it("contains no production seed, fake record, or privilege broadening statement", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).not.toMatch(/\b(?:INSERT|COPY|TRUNCATE)\b/i);
    expect(sql).not.toMatch(/\bGRANT\s+EXECUTE\s+ON\s+FUNCTION[^;]+\s+TO\s+(?:anon|PUBLIC)\s*;/i);
    expect(sql).not.toMatch(/\bGRANT\s+(?:SELECT|INSERT|UPDATE|DELETE|ALL)\s+ON\s+TABLE\b/i);
  });

  it("keeps the generated Supabase client contract fresh for the current-install RPC", () => {
    const types = readFileSync(generatedTypesPath, "utf8");

    expect(types).toMatch(
      /revoke_current_push_install:\s*\{\s*Args:\s*\{[\s\S]*?p_device_id\?: string \| null;[\s\S]*?p_expected_owner_user_id: string;[\s\S]*?p_token\?: string \| null;[\s\S]*?Returns: number;/,
    );
  });
});
