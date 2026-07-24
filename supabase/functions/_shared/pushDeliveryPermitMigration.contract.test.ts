import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260718155000_push_delivery_permit_barrier.sql",
);

const readMigration = (): string => {
  expect(existsSync(migrationPath), "push-delivery permit migration must exist").toBe(
    true,
  );
  return existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
};

function functionBody(source: string, name: string, nextName: string): string {
  const start = source.indexOf(`FUNCTION public.${name}`);
  const end = source.indexOf(`FUNCTION public.${nextName}`, start + 1);
  expect(start, `missing function ${name}`).toBeGreaterThanOrEqual(0);
  expect(end, `missing function ${nextName}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("push-delivery permit migration contract", () => {
  it("stores only bounded, expiring, globally fenced permits", () => {
    const sql = readMigration();

    expect(sql).toMatch(/CREATE SEQUENCE private\.push_delivery_permit_epoch_seq/i);
    expect(sql).toMatch(/CREATE TABLE private\.push_delivery_permits/i);
    expect(sql).toMatch(/PRIMARY KEY\s*\(user_id,\s*permit_token\)/i);
    expect(sql).toMatch(
      /FOREIGN KEY\s*\(user_id\)\s*REFERENCES auth\.users\(id\)\s*ON DELETE CASCADE/i,
    );
    expect(sql).toMatch(/lease_expires_at timestamptz NOT NULL/i);
    expect(sql).toMatch(/nextval\('private\.push_delivery_permit_epoch_seq'/i);
    expect(sql).toMatch(
      /v_lease_expires_at\s*:=\s*v_now \+ interval '10 minutes'/i,
    );
    expect(sql).toMatch(/LIMIT 256/i);
    expect(sql).toMatch(/FOR UPDATE SKIP LOCKED/i);
    expect(sql).toMatch(/v_active_permit_count\s*>=\s*32/i);
  });

  it("serializes permit admission with the permanent deletion tombstone", () => {
    const sql = readMigration();
    const acquire = functionBody(
      sql,
      "acquire_push_delivery_permit",
      "release_push_delivery_permit",
    );

    expect(acquire).toMatch(/SECURITY DEFINER/i);
    expect(acquire).toMatch(/SET search_path = ''/i);
    const ownerLock = acquire.indexOf(
      "pg_catalog.pg_advisory_xact_lock",
    );
    const blockRead = acquire.indexOf("public.account_deletion_blocks");
    const permitInsert = acquire.indexOf("private.push_delivery_permits");
    expect(ownerLock).toBeGreaterThanOrEqual(0);
    expect(blockRead).toBeGreaterThan(ownerLock);
    expect(permitInsert).toBeGreaterThan(blockRead);
    expect(acquire).toMatch(/p_owner_id[\s\S]*p_permit_token/i);
    expect(acquire).toMatch(/RETURN QUERY[\s\S]*'blocked'/i);
    const capGuard = acquire.indexOf("v_active_permit_count >= 32");
    const capFailure = acquire.indexOf("'unavailable'::text", capGuard);
    expect(capGuard).toBeGreaterThanOrEqual(0);
    expect(capFailure).toBeGreaterThan(capGuard);
  });

  it("releases only the exact owner, token and lease epoch", () => {
    const sql = readMigration();
    const release = functionBody(
      sql,
      "release_push_delivery_permit",
      "drain_account_push_delivery_permits",
    );

    expect(release).toMatch(/SECURITY DEFINER/i);
    expect(release).toMatch(/SET search_path = ''/i);
    expect(release).toMatch(/WHERE permit\.user_id = p_owner_id/i);
    expect(release).toMatch(/AND permit\.permit_token = p_permit_token/i);
    expect(release).toMatch(/AND permit\.lease_epoch = p_lease_epoch/i);
    const ownerLock = release.indexOf("pg_catalog.pg_advisory_xact_lock");
    const exactDelete = release.indexOf(
      "DELETE FROM private.push_delivery_permits",
    );
    expect(ownerLock).toBeGreaterThanOrEqual(0);
    expect(exactDelete).toBeGreaterThan(ownerLock);
    expect(release).toMatch(
      /p_permit_token IS NULL[\s\S]*p_lease_epoch IS NULL[\s\S]*p_lease_epoch <= 0[\s\S]*RETURN false/i,
    );
  });

  it("makes deletion drain active permits under its current operation fence", () => {
    const sql = readMigration();
    const drain = functionBody(
      sql,
      "drain_account_push_delivery_permits",
      "advance_account_deletion_operation_phase",
    );

    expect(sql).toMatch(
      /phase IN \('push-drain', 'media-before-rows', 'rows', 'media-after-rows', 'auth'\)/i,
    );
    expect(sql).toMatch(/ALTER COLUMN phase SET DEFAULT 'push-drain'/i);
    expect(drain).toMatch(/SECURITY DEFINER/i);
    expect(drain).toMatch(/SET search_path = ''/i);
    expect(drain).toMatch(/operation_row\.lease_token = p_lease_token/i);
    expect(drain).toMatch(/operation_row\.lease_epoch = p_lease_epoch/i);
    expect(drain).toMatch(/operation_row\.phase = 'push-drain'/i);
    expect(drain).toMatch(/operation_row\.lease_expires_at > v_now/i);
    const ownerLock = drain.indexOf("pg_catalog.pg_advisory_xact_lock");
    const operationRowLock = drain.indexOf("FOR UPDATE", ownerLock);
    const expiredCleanup = drain.indexOf(
      "DELETE FROM private.push_delivery_permits",
      operationRowLock,
    );
    const livePermitRead = drain.indexOf("RETURN NOT EXISTS", expiredCleanup);
    expect(ownerLock).toBeGreaterThanOrEqual(0);
    expect(operationRowLock).toBeGreaterThan(ownerLock);
    expect(expiredCleanup).toBeGreaterThan(operationRowLock);
    expect(livePermitRead).toBeGreaterThan(expiredCleanup);
    expect(drain).toMatch(/NOT EXISTS[\s\S]*private\.push_delivery_permits/i);
    expect(sql).toMatch(
      /operation_row\.phase = 'push-drain' AND p_next_phase = 'media-before-rows'/i,
    );
  });

  it("exposes permit RPCs only to service_role and refreshes PostgREST", () => {
    const sql = readMigration();
    const normalizedSql = sql.replace(/\s+/g, " ");

    for (const signature of [
      "acquire_push_delivery_permit(uuid, uuid)",
      "release_push_delivery_permit(uuid, uuid, bigint)",
      "drain_account_push_delivery_permits(uuid, text, uuid, bigint)",
    ]) {
      expect(normalizedSql).toContain(
        `REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated`,
      );
      expect(normalizedSql).toContain(
        `GRANT EXECUTE ON FUNCTION public.${signature} TO service_role`,
      );
    }
    expect(sql).toMatch(/NOTIFY pgrst, 'reload schema'/i);
  });
});
