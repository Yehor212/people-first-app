import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260718160000_fence_account_deletion_terminal_transitions.sql",
);

const readMigration = (): string => {
  expect(
    existsSync(migrationPath),
    "terminal-transition fence migration must exist",
  ).toBe(true);
  return existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
};

function functionBody(source: string, name: string, nextMarker: string): string {
  const start = source.indexOf(`FUNCTION public.${name}`);
  const end = source.indexOf(nextMarker, start + 1);
  expect(start, `missing function ${name}`).toBeGreaterThanOrEqual(0);
  expect(end, `missing marker after ${name}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("account-deletion terminal transition database fences", () => {
  it("fails journal-media admission closed outside READ COMMITTED before locking", () => {
    const sql = readMigration();
    const start = sql.indexOf(
      "FUNCTION security.authorize_journal_media_write",
    );
    const end = sql.indexOf(
      "FUNCTION public.acquire_push_delivery_permit",
      start + 1,
    );
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const authorizeMedia = sql.slice(start, end);

    const callerCheck = authorizeMedia.indexOf("p_owner_id <> v_caller_id");
    const isolationGuard = authorizeMedia.indexOf("transaction_isolation");
    const ownerLock = authorizeMedia.indexOf(
      "pg_catalog.pg_advisory_xact_lock",
    );
    const tombstoneRead = authorizeMedia.indexOf(
      "public.account_deletion_blocks",
    );

    expect(authorizeMedia).toMatch(/SECURITY DEFINER/i);
    expect(authorizeMedia).toMatch(/SET search_path = ''/i);
    expect(authorizeMedia).toMatch(
      /current_setting\('transaction_isolation'\)/i,
    );
    expect(authorizeMedia).toMatch(/<>\s*'read committed'/i);
    expect(callerCheck).toBeGreaterThanOrEqual(0);
    expect(isolationGuard).toBeGreaterThan(callerCheck);
    expect(ownerLock).toBeGreaterThan(isolationGuard);
    expect(tombstoneRead).toBeGreaterThan(ownerLock);
    expect(authorizeMedia).toMatch(/RETURN false/i);
    expect(sql.replace(/\s+/g, " ")).toContain(
      "GRANT EXECUTE ON FUNCTION security.authorize_journal_media_write(uuid) TO authenticated",
    );
  });

  it("fails closed outside READ COMMITTED before any snapshot-dependent permit decision", () => {
    const sql = readMigration();
    const acquire = functionBody(
      sql,
      "acquire_push_delivery_permit",
      "FUNCTION public.drain_account_push_delivery_permits",
    );
    const drain = functionBody(
      sql,
      "drain_account_push_delivery_permits",
      "FUNCTION public.advance_account_deletion_operation_phase",
    );

    for (const body of [acquire, drain]) {
      const isolationGuard = body.indexOf("transaction_isolation");
      const ownerLock = body.indexOf("pg_catalog.pg_advisory_xact_lock");
      const firstProtectedRead = Math.min(
        ...[
          body.indexOf("public.account_deletion_blocks"),
          body.indexOf("private.push_delivery_permits"),
          body.indexOf("private.account_deletion_operations"),
        ].filter((index) => index >= 0),
      );

      expect(body).toMatch(/current_setting\('transaction_isolation'\)/i);
      expect(body).toMatch(/<>\s*'read committed'/i);
      expect(isolationGuard).toBeGreaterThanOrEqual(0);
      expect(ownerLock).toBeGreaterThan(isolationGuard);
      expect(firstProtectedRead).toBeGreaterThan(isolationGuard);
    }
    expect(acquire).toMatch(/'unavailable'::text/i);
    expect(drain).toMatch(/RETURN false/i);
  });

  it("cannot advance past push-drain while a live delivery permit exists", () => {
    const sql = readMigration();
    const advance = functionBody(
      sql,
      "advance_account_deletion_operation_phase",
      "FUNCTION public.complete_account_deletion_operation",
    );

    const capabilityLookup = advance.indexOf(
      "recovery_secret_hash = decode(p_recovery_secret_hash, 'hex')",
    );
    const ownerLock = advance.indexOf("pg_catalog.pg_advisory_xact_lock");
    const operationRowLock = advance.indexOf("FOR UPDATE", ownerLock);
    const livePermitFence = advance.indexOf(
      "private.push_delivery_permits",
      operationRowLock,
    );
    const phaseWrite = advance.indexOf(
      "UPDATE private.account_deletion_operations",
      operationRowLock,
    );

    expect(advance).toMatch(/SECURITY DEFINER/i);
    expect(advance).toMatch(/SET search_path = ''/i);
    expect(advance).toMatch(/current_setting\('transaction_isolation'\)/i);
    expect(advance).toMatch(/<>\s*'read committed'/i);
    expect(capabilityLookup).toBeGreaterThanOrEqual(0);
    expect(ownerLock).toBeGreaterThan(capabilityLookup);
    expect(operationRowLock).toBeGreaterThan(ownerLock);
    expect(livePermitFence).toBeGreaterThan(operationRowLock);
    expect(phaseWrite).toBeGreaterThan(livePermitFence);
    expect(advance).toMatch(
      /phase = 'push-drain'[\s\S]*p_next_phase = 'media-before-rows'[\s\S]*NOT EXISTS[\s\S]*private\.push_delivery_permits[\s\S]*lease_expires_at > /i,
    );
  });

  it("cannot publish a deleted receipt while Auth or a live permit still exists", () => {
    const sql = readMigration();
    const complete = functionBody(
      sql,
      "complete_account_deletion_operation",
      "REVOKE ALL ON FUNCTION public.advance_account_deletion_operation_phase",
    );

    const capabilityLookup = complete.indexOf(
      "recovery_secret_hash = decode(p_recovery_secret_hash, 'hex')",
    );
    const ownerLock = complete.indexOf("pg_catalog.pg_advisory_xact_lock");
    const operationRowLock = complete.indexOf("FOR UPDATE", ownerLock);
    const authFence = complete.indexOf("auth.users", operationRowLock);
    const permitFence = complete.indexOf(
      "private.push_delivery_permits",
      operationRowLock,
    );
    const terminalWrite = complete.indexOf(
      "UPDATE private.account_deletion_operations",
      operationRowLock,
    );

    expect(complete).toMatch(/SECURITY DEFINER/i);
    expect(complete).toMatch(/SET search_path = ''/i);
    expect(complete).toMatch(/current_setting\('transaction_isolation'\)/i);
    expect(complete).toMatch(/<>\s*'read committed'/i);
    expect(capabilityLookup).toBeGreaterThanOrEqual(0);
    expect(ownerLock).toBeGreaterThan(capabilityLookup);
    expect(operationRowLock).toBeGreaterThan(ownerLock);
    expect(authFence).toBeGreaterThan(operationRowLock);
    expect(permitFence).toBeGreaterThan(operationRowLock);
    expect(terminalWrite).toBeGreaterThan(authFence);
    expect(terminalWrite).toBeGreaterThan(permitFence);
    expect(complete).toMatch(/NOT EXISTS[\s\S]*auth\.users/i);
    expect(complete).toMatch(
      /NOT EXISTS[\s\S]*private\.push_delivery_permits[\s\S]*lease_expires_at > /i,
    );
  });

  it("keeps both hardened RPCs service-role only and refreshes PostgREST", () => {
    const sql = readMigration().replace(/\s+/g, " ");

    for (const signature of [
      "acquire_push_delivery_permit(uuid, uuid)",
      "drain_account_push_delivery_permits(uuid, text, uuid, bigint)",
      "advance_account_deletion_operation_phase(uuid, text, uuid, bigint, text)",
      "complete_account_deletion_operation(uuid, text, uuid, bigint)",
    ]) {
      expect(sql).toContain(
        `REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated`,
      );
      expect(sql).toContain(
        `GRANT EXECUTE ON FUNCTION public.${signature} TO service_role`,
      );
    }
    expect(sql).toContain("NOTIFY pgrst, 'reload schema'");
  });
});
