import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = join(
  process.cwd(),
  "supabase",
  "migrations",
);

function readCompatibilityMigration(): string {
  const matches = readdirSync(migrationsDir).filter((fileName) =>
    /^\d{14}_restore_legacy_push_rpc_compatibility[.]sql$/.test(fileName),
  );
  expect(matches).toHaveLength(1);
  return readFileSync(join(migrationsDir, matches[0]), "utf8");
}

function readFinalCompatibilityMigration(): string {
  const matches = readdirSync(migrationsDir).filter((fileName) => {
    const match = /^(\d{14})_restore_owner_bound_legacy_push_claim[.]sql$/.exec(fileName);
    return Boolean(match && match[1] > "20260722150000");
  });
  expect(matches).toHaveLength(1);
  return readFileSync(join(migrationsDir, matches[0]), "utf8");
}

describe("legacy push RPC compatibility migration", () => {
  it("restores the owner-bound legacy claim overload after delivery-realm hardening", () => {
    const sql = readFinalCompatibilityMigration();

    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public[.]claim_push_install\(\s*p_token text,\s*p_device_id text,\s*p_platform text DEFAULT 'android'\s*\)/i,
    );
    expect(sql).toMatch(/caller_id uuid := auth[.]uid\(\)/i);
    expect(sql).toMatch(/IF caller_id IS NULL[\s\S]*Authentication required/i);
    expect(sql).toMatch(
      /public[.]claim_push_install\(\s*p_token,\s*p_device_id,\s*caller_id,\s*p_platform\s*\)/i,
    );
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public[.]claim_push_install\(text, text, text\) FROM PUBLIC/i,
    );
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public[.]claim_push_install\(text, text, text\) FROM anon/i,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public[.]claim_push_install\(text, text, text\) TO authenticated/i,
    );
    expect(sql).not.toMatch(/GRANT EXECUTE[\s\S]{0,120}TO (?:PUBLIC|anon)/i);
  });

  it("keeps old clients on the owner-bound claim path", () => {
    const sql = readCompatibilityMigration();

    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public[.]claim_push_install\(\s*p_token text,\s*p_device_id text,\s*p_platform text DEFAULT 'android'\s*\)/i,
    );
    expect(sql).toMatch(/caller_id uuid := auth[.]uid\(\)/i);
    expect(sql).toMatch(
      /public[.]claim_push_install\(\s*p_token,\s*p_device_id,\s*caller_id,\s*p_platform\s*\)/i,
    );
  });

  it("requires both legacy capabilities and the authenticated owner", () => {
    const sql = readCompatibilityMigration();

    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public[.]revoke_push_install\(\s*p_device_id text,\s*p_token text DEFAULT NULL\s*\)/i,
    );
    expect(sql).toMatch(/p_token IS NULL[\s\S]*RAISE EXCEPTION 'Push token is required'/i);
    expect(sql).toMatch(/pg_advisory_xact_lock[\s\S]*hashtextextended\(p_device_id, 0\)/i);
    expect(sql).toMatch(/pg_advisory_xact_lock[\s\S]*hashtextextended\(p_token, 1\)/i);
    expect(sql).toMatch(
      /DELETE FROM public[.]push_device_tokens[\s\S]*WHERE user_id = caller_id[\s\S]*AND device_id = p_device_id[\s\S]*AND token = p_token/i,
    );
    expect(sql).not.toMatch(/WHERE[\s\S]{0,120}device_id = p_device_id[\s\S]{0,120}\bOR\b/i);
    expect(sql).toMatch(
      /deleted_count = 0[\s\S]*EXISTS[\s\S]*WHERE device_id = p_device_id[\s\S]*AND token = p_token[\s\S]*RAISE EXCEPTION 'Push owner changed'/i,
    );
  });

  it("keeps both overloads closed to public and anon", () => {
    const sql = readCompatibilityMigration();

    for (const signature of [
      "claim_push_install(text, text, text)",
      "revoke_push_install(text, text)",
    ]) {
      const escapedSignature = signature.replace(/[()]/g, "\\$&");
      expect(sql).toMatch(
        new RegExp(`REVOKE ALL ON FUNCTION public[.]${escapedSignature} FROM PUBLIC`, "i"),
      );
      expect(sql).toMatch(
        new RegExp(`REVOKE ALL ON FUNCTION public[.]${escapedSignature} FROM anon`, "i"),
      );
      expect(sql).toMatch(
        new RegExp(`GRANT EXECUTE ON FUNCTION public[.]${escapedSignature} TO authenticated`, "i"),
      );
    }
  });
});
