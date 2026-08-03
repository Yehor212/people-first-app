import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const MIGRATION_PATH =
  "supabase/migrations/20260718153000_linearize_journal_media_deletion_admission.sql";

const source = readFileSync(MIGRATION_PATH, "utf8");

function section(start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  expect(startIndex, `missing section start: ${start}`).toBeGreaterThanOrEqual(0);
  expect(endIndex, `missing section end: ${end}`).toBeGreaterThan(startIndex);

  return source.slice(startIndex, endIndex);
}

describe("journal media deletion admission migration", () => {
  it("makes Storage write authority caller-bound and refreshes the block check after locking", () => {
    const authorization = section(
      "CREATE OR REPLACE FUNCTION security.authorize_journal_media_write",
      "REVOKE ALL ON FUNCTION security.authorize_journal_media_write",
    );

    expect(authorization).toMatch(/LANGUAGE\s+plpgsql/i);
    expect(authorization).toMatch(/VOLATILE/i);
    expect(authorization).toMatch(/SECURITY\s+DEFINER/i);
    expect(authorization).toContain("SET search_path = ''");
    expect(authorization).toContain(
      "https://www.postgresql.org/docs/current/xfunc-volatility.html",
    );

    const callerGuard = authorization.indexOf("p_owner_id <> v_caller_id");
    const ownerLock = authorization.indexOf("pg_advisory_xact_lock");
    const freshBlockRead = authorization.indexOf(
      "FROM public.account_deletion_blocks",
    );

    expect(callerGuard).toBeGreaterThanOrEqual(0);
    expect(ownerLock).toBeGreaterThan(callerGuard);
    expect(freshBlockRead).toBeGreaterThan(ownerLock);
    expect(authorization).toMatch(
      /pg_catalog\.hashtextextended\(p_owner_id::text,\s*0\)/i,
    );
  });

  it("serializes every tombstone insert on the identical owner key before conflict arbitration", () => {
    const triggerFunction = section(
      "CREATE OR REPLACE FUNCTION private.serialize_account_deletion_block_insert",
      "REVOKE ALL ON FUNCTION private.serialize_account_deletion_block_insert",
    );

    expect(triggerFunction).toMatch(/VOLATILE/i);
    expect(triggerFunction).toMatch(/SECURITY\s+DEFINER/i);
    expect(triggerFunction).toContain("SET search_path = ''");
    expect(triggerFunction).toMatch(
      /pg_catalog\.hashtextextended\(NEW\.user_id::text,\s*0\)/i,
    );
    expect(source).toMatch(
      /CREATE TRIGGER serialize_account_deletion_block_insert\s+BEFORE INSERT ON public\.account_deletion_blocks/i,
    );
    expect(source).toContain(
      "ON CONFLICT reaches this BEFORE ROW trigger before PostgreSQL performs conflict arbitration",
    );
    expect(source).toContain(
      "https://www.postgresql.org/docs/current/sql-insert.html#SQL-ON-CONFLICT",
    );
  });

  it("preserves owner folders and latest journal parent membership for photo and audio writes", () => {
    const photoUpload = section(
      'CREATE POLICY "journal_photos_upload"',
      'DROP POLICY IF EXISTS "journal_photos_update"',
    );
    const photoUpdate = section(
      'CREATE POLICY "journal_photos_update"',
      'DROP POLICY IF EXISTS "journal_audio_upload"',
    );
    const audioUpload = section(
      'CREATE POLICY "journal_audio_upload"',
      'DROP POLICY IF EXISTS "journal_audio_update"',
    );
    const audioUpdate = section(
      'CREATE POLICY "journal_audio_update"',
      "REVOKE ALL ON FUNCTION public.claim_account_deletion_operation",
    );

    for (const policy of [photoUpload, photoUpdate, audioUpload, audioUpdate]) {
      expect(policy).toContain(
        "security.authorize_journal_media_write((SELECT auth.uid()))",
      );
      expect(policy).toContain(
        "(storage.foldername(name))[1] = (SELECT auth.uid())::text",
      );
      expect(policy).toContain("split_part(storage.filename(name), '.', 1)");
    }

    expect(photoUpload).toContain("COALESCE(entries.photo_ids, '{}'::text[])");
    expect(photoUpdate.match(/authorize_journal_media_write/g)).toHaveLength(2);
    expect(photoUpdate.match(/COALESCE\(entries\.photo_ids/g)).toHaveLength(2);
    expect(audioUpload).toContain("COALESCE(entries.audio_ids, '{}'::text[])");
    expect(audioUpdate.match(/authorize_journal_media_write/g)).toHaveLength(2);
    expect(audioUpdate.match(/COALESCE\(entries\.audio_ids/g)).toHaveLength(2);
  });

  it("normalizes recovery to owner-lock then operation-row-lock order", () => {
    const claim = section(
      "CREATE OR REPLACE FUNCTION public.claim_account_deletion_operation",
      "DROP POLICY IF EXISTS \"journal_photos_upload\"",
    );

    const capabilityLookup = claim.indexOf("v_owner_user_id");
    const ownerLock = claim.indexOf("pg_advisory_xact_lock");
    const rowLock = claim.indexOf("FOR UPDATE");

    expect(capabilityLookup).toBeGreaterThanOrEqual(0);
    expect(claim).toMatch(
      /recovery_secret_hash\s*=\s*decode\(p_recovery_secret_hash,\s*'hex'\)/i,
    );
    expect(ownerLock).toBeGreaterThan(capabilityLookup);
    expect(rowLock).toBeGreaterThan(ownerLock);
    expect(claim).toMatch(
      /pg_catalog\.hashtextextended\(v_owner_user_id::text,\s*0\)/i,
    );
    expect(claim).toMatch(/SECURITY\s+INVOKER/i);
    expect(claim).toContain("SET search_path = ''");
  });

  it("keeps privileged helpers off the exposed API and leaves Storage metadata read-only", () => {
    const config = readFileSync("supabase/config.toml", "utf8");

    expect(config).toContain('schemas = ["public", "graphql_public"]');
    expect(config).not.toMatch(/schemas\s*=\s*\[[^\]]*"security"/i);
    expect(source).toContain(
      "REVOKE ALL ON SCHEMA security FROM PUBLIC, anon, authenticated, service_role",
    );
    expect(source).toContain("GRANT USAGE ON SCHEMA security TO authenticated");
    expect(source).toMatch(
      /GRANT EXECUTE ON FUNCTION security\.authorize_journal_media_write\(uuid\)\s+TO authenticated/i,
    );
    expect(source).toMatch(
      /REVOKE ALL ON FUNCTION private\.serialize_account_deletion_block_insert\(\)\s+FROM PUBLIC, anon, authenticated, service_role/i,
    );
    expect(source).not.toMatch(/(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+storage\.objects/i);
    expect(source).not.toMatch(/ALTER\s+TABLE\s+storage\.objects/i);
    expect(source.trimEnd()).toMatch(/NOTIFY\s+pgrst,\s*'reload schema'\s*;$/i);
  });
});
