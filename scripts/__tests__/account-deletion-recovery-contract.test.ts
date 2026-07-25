import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const MIGRATION_PATH = "supabase/migrations/20260718113000_account_deletion_recovery_barrier.sql";
const STORAGE_ADMISSION_MIGRATION_PATH =
  "supabase/migrations/20260718153000_linearize_journal_media_deletion_admission.sql";
const RECOVERY_ADMISSION_MIGRATION_PATH =
  "supabase/migrations/20260718154000_harden_account_deletion_recovery_admission.sql";

function section(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  expect(startIndex, `missing section start: ${start}`).toBeGreaterThanOrEqual(0);
  expect(endIndex, `missing section end: ${end}`).toBeGreaterThan(startIndex);

  return source.slice(startIndex, endIndex);
}

function readCurrentText(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

const baseMigration = readFileSync(MIGRATION_PATH, "utf8");

describe("account deletion recovery database contract", () => {
  const migration = baseMigration;
  const config = readFileSync("supabase/config.toml", "utf8");
  const recoveryEndpoint = readFileSync(
    "supabase/functions/resume-account-deletion/index.ts",
    "utf8"
  );

  it("keeps the capability receipt outside the auth.users deletion cascade", () => {
    expect(migration).toContain("CREATE TABLE private.account_deletion_operations");
    expect(migration).toContain("recovery_secret_hash");
    expect(migration).toContain("octet_length(recovery_secret_hash) = 32");
    expect(migration).toContain("lease_token");
    expect(migration).toContain("lease_expires_at");
    expect(migration).not.toMatch(
      /private\.account_deletion_operations[\s\S]{0,1400}REFERENCES\s+auth\.users/i
    );
    expect(migration).toContain(
      "REVOKE ALL ON TABLE private.account_deletion_operations FROM PUBLIC, anon, authenticated"
    );
  });

  it("retains a one-way owner binding so a completed receipt cannot confirm another account", () => {
    expect(migration).toContain("owner_binding_hash");
    expect(migration).toContain("octet_length(owner_binding_hash) = 32");
    expect(migration).toMatch(
      /owner_binding_hash\s*<>\s*extensions\.digest\([\s\S]*p_user_id[\s\S]*p_recovery_secret_hash/i
    );
    expect(migration.indexOf("v_operation.owner_binding_hash <>")).toBeLessThan(
      migration.indexOf("IF v_operation.status = 'deleted'")
    );
  });

  it("allows independently authorized devices to converge with their own capabilities", () => {
    expect(migration).not.toContain(
      "CREATE UNIQUE INDEX account_deletion_operations_one_active_owner"
    );
    expect(migration).not.toMatch(
      /WHERE operation_row\.operation_id = p_operation_id\s+OR operation_row\.user_id = p_user_id/i
    );
    expect(migration).toMatch(/WHERE operation_row\.operation_id = p_operation_id\s+FOR UPDATE/i);
    expect(migration).toMatch(/pg_advisory_xact_lock[\s\S]*p_user_id/i);
    expect(migration).toMatch(/count\(\*\)[\s\S]*user_id\s*=\s*p_user_id[\s\S]*>=\s*8/i);
  });

  it("binds the deletion barrier and operation atomically and fences every terminal transition", () => {
    expect(migration).toContain("begin_account_deletion_operation");
    expect(migration).toContain("claim_account_deletion_operation");
    expect(migration).toContain("complete_account_deletion_operation");
    expect(migration).toContain("release_account_deletion_operation");
    expect(migration).toMatch(/FOR\s+UPDATE/i);
    expect(migration).toMatch(/lease_token\s*=\s*p_lease_token/i);
    expect(migration).toMatch(/lease_expires_at\s*>\s*now\(\)/i);
    expect(migration).toMatch(/SECURITY\s+INVOKER/i);
    expect(migration).toMatch(/account_deletion_blocks[\s\S]*account_deletion_operations/i);
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.begin_account_deletion_operation[\s\S]*GRANT EXECUTE ON FUNCTION public\.begin_account_deletion_operation[\s\S]*TO service_role/i
    );
  });

  it("blocks stale authenticated principals in Data API and Realtime without replacing an unknown pre-request hook", () => {
    expect(migration).toContain("pgrst.db_pre_request");
    expect(migration).toContain("enforce_account_deletion_api_barrier");
    expect(migration).toMatch(/RAISE EXCEPTION[\s\S]*existing/i);
    expect(migration).toMatch(/realtime\.messages[\s\S]*account_deletion_blocks/i);
  });

  it("detects a conflicting database-wide pre-request hook before setting the authenticator role", () => {
    expect(migration).toMatch(/database_setting\.setrole\s*=\s*0/i);
    expect(migration).toMatch(
      /database_setting\.setdatabase\s+IN\s*\([\s\S]*current_database\(\)/i
    );
  });

  it("exposes only the recovery capability on the public recovery endpoint", () => {
    expect(config).toMatch(/\[functions\.resume-account-deletion\]\s*\nverify_jwt\s*=\s*false/);
    expect(recoveryEndpoint).toContain("parseAccountDeletionCapability");
    expect(recoveryEndpoint).not.toContain("expectedOwnerUserId");
    expect(recoveryEndpoint).not.toContain("getUser(");
  });

  it("reloads the PostgREST schema after adding recovery RPCs", () => {
    expect(migration.trimEnd()).toMatch(/NOTIFY\s+pgrst,\s*'reload schema'\s*;$/i);
  });
});

describe("account deletion recovery abuse and abandonment hardening", () => {
  const storageAdmissionMigration = readFileSync(STORAGE_ADMISSION_MIGRATION_PATH, "utf8");
  const recoveryAdmissionMigration = readCurrentText(RECOVERY_ADMISSION_MIGRATION_PATH);
  const recoveryEndpoint = readFileSync(
    "supabase/functions/resume-account-deletion/index.ts",
    "utf8"
  );
  const recoveryAdmissionHelper = readFileSync(
    "supabase/functions/resume-account-deletion/recoveryAdmission.ts",
    "utf8"
  );

  it("retires inactive operations before the eight-capability admission count without removing the permanent block", () => {
    const begin = section(
      recoveryAdmissionMigration,
      "CREATE OR REPLACE FUNCTION public.begin_account_deletion_operation",
      "REVOKE ALL ON FUNCTION public.begin_account_deletion_operation"
    );

    expect(recoveryAdmissionMigration).toMatch(/status\s+IN\s*\([^)]*'abandoned'/i);
    expect(begin).toContain("interval '15 minutes'");
    expect(15 * 60).toBeGreaterThan(400);
    expect(begin).toMatch(
      /status\s*=\s*'abandoned'[\s\S]*user_id\s*=\s*NULL[\s\S]*lease_token\s*=\s*NULL[\s\S]*lease_epoch\s*=\s*abandoned_operation\.lease_epoch\s*\+\s*1/i
    );
    expect(begin).toMatch(
      /status\s*=\s*'pending'[\s\S]*updated_at\s*<=\s*v_abandon_before[\s\S]*status\s*=\s*'running'[\s\S]*lease_expires_at\s*<=\s*v_now[\s\S]*updated_at\s*<=\s*v_abandon_before/i
    );
    expect(begin.indexOf("status = 'abandoned'")).toBeLessThan(begin.indexOf("SELECT count(*)"));
    expect(begin).toContain("ON CONFLICT ON CONSTRAINT account_deletion_blocks_pkey DO NOTHING");
    expect(begin).not.toContain("ON CONFLICT (user_id)");
    expect(recoveryAdmissionMigration).not.toMatch(
      /DELETE\s+FROM\s+public\.account_deletion_blocks/i
    );
  });

  it("fences an old worker when an authenticated replacement abandons and rotates a stale capability", () => {
    const begin = section(
      recoveryAdmissionMigration,
      "CREATE OR REPLACE FUNCTION public.begin_account_deletion_operation",
      "REVOKE ALL ON FUNCTION public.begin_account_deletion_operation"
    );
    const fencedTransitions = [
      "renew_account_deletion_operation_lease",
      "advance_account_deletion_operation_phase",
      "complete_account_deletion_operation",
      "release_account_deletion_operation",
    ];

    expect(begin).toMatch(/pg_advisory_xact_lock[\s\S]*p_user_id/i);
    expect(begin).toMatch(
      /status\s*=\s*'abandoned'[\s\S]*lease_epoch\s*=\s*abandoned_operation\.lease_epoch\s*\+\s*1/i
    );
    for (const functionName of fencedTransitions) {
      const transition = section(
        baseMigration,
        `CREATE OR REPLACE FUNCTION public.${functionName}`,
        "$$;"
      );
      expect(transition).toMatch(/status\s*=\s*'running'/i);
      expect(transition).toMatch(/lease_token\s*=\s*p_lease_token/i);
      expect(transition).toMatch(/lease_epoch\s*=\s*p_lease_epoch/i);
    }
  });

  it("filters invalid capabilities before either the recovery owner lock or distributed admission lock", () => {
    const begin = section(
      recoveryAdmissionMigration,
      "CREATE OR REPLACE FUNCTION public.begin_account_deletion_operation",
      "REVOKE ALL ON FUNCTION public.begin_account_deletion_operation"
    );
    const claim = section(
      storageAdmissionMigration,
      "CREATE OR REPLACE FUNCTION public.claim_account_deletion_operation",
      'DROP POLICY IF EXISTS "journal_photos_upload"'
    );
    const admission = section(
      recoveryAdmissionMigration,
      "CREATE OR REPLACE FUNCTION public.admit_account_deletion_recovery_attempt",
      "REVOKE ALL ON FUNCTION public.admit_account_deletion_recovery_attempt"
    );

    const beginRowLock = begin.indexOf("FOR UPDATE");
    const beginCapability = begin.indexOf(
      "recovery_secret_hash = decode(p_recovery_secret_hash, 'hex')"
    );
    const beginOwnerBinding = begin.indexOf("owner_binding_hash = extensions.digest(");
    expect(beginRowLock).toBeGreaterThanOrEqual(0);
    expect(beginCapability).toBeGreaterThanOrEqual(0);
    expect(beginOwnerBinding).toBeGreaterThanOrEqual(0);
    expect(beginCapability).toBeLessThan(beginRowLock);
    expect(beginOwnerBinding).toBeLessThan(beginRowLock);
    expect(begin.slice(0, beginRowLock)).toMatch(
      /status\s+IN\s*\('pending',\s*'running'\)[\s\S]*user_id\s*=\s*p_user_id[\s\S]*status\s*=\s*'deleted'/i
    );

    const claimCapability = claim.indexOf(
      "recovery_secret_hash = decode(p_recovery_secret_hash, 'hex')"
    );
    expect(claimCapability).toBeGreaterThanOrEqual(0);
    expect(claimCapability).toBeLessThan(claim.indexOf("pg_advisory_xact_lock"));
    expect(claimCapability).toBeLessThan(claim.indexOf("FOR UPDATE"));
    expect(claim).toContain("ON CONFLICT ON CONSTRAINT account_deletion_blocks_pkey DO NOTHING");
    expect(claim).not.toContain("ON CONFLICT (user_id)");

    const limiterInsert = admission.indexOf(
      "INSERT INTO private.account_deletion_recovery_admission"
    );
    const limiterCapability = admission.indexOf(
      "recovery_secret_hash = decode(p_recovery_secret_hash, 'hex')",
      limiterInsert
    );
    expect(limiterInsert).toBeGreaterThanOrEqual(0);
    expect(limiterCapability).toBeGreaterThan(limiterInsert);
    expect(limiterCapability).toBeLessThan(
      admission.indexOf("ON CONFLICT (operation_id)", limiterInsert)
    );
    expect(admission).not.toMatch(
      /WHERE\s+operation_row\.operation_id\s*=\s*p_operation_id\s*\n\s*FOR UPDATE/i
    );
  });

  it("uses a bounded distributed token bucket and fails closed before recovery work", () => {
    const admission = section(
      recoveryAdmissionMigration,
      "CREATE OR REPLACE FUNCTION public.admit_account_deletion_recovery_attempt",
      "REVOKE ALL ON FUNCTION public.admit_account_deletion_recovery_attempt"
    );

    expect(recoveryAdmissionMigration).toContain(
      "CREATE TABLE private.account_deletion_recovery_admission"
    );
    expect(recoveryAdmissionMigration).toMatch(
      /tokens\s+numeric[\s\S]*refilled_at\s+timestamptz[\s\S]*last_seen_at\s+timestamptz/i
    );
    expect(admission).toMatch(/LEAST\([\s\S]*tokens[\s\S]*EXTRACT\(EPOCH/i);
    expect(admission).toMatch(
      /DELETE\s+FROM\s+private\.account_deletion_recovery_admission[\s\S]*last_seen_at[\s\S]*LIMIT\s+32/i
    );
    expect(recoveryAdmissionMigration).not.toMatch(
      /(?:ip_address|client_ip|x_forwarded_for|recovery_secret\s+text)/i
    );
    expect(recoveryAdmissionMigration).toMatch(
      /REVOKE ALL ON TABLE private\.account_deletion_recovery_admission\s+FROM PUBLIC, anon, authenticated/i
    );
    expect(recoveryAdmissionMigration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.admit_account_deletion_recovery_attempt[\s\S]*TO service_role/i
    );

    const admissionCall = recoveryEndpoint.indexOf('"admit_account_deletion_recovery_attempt"');
    const recoveryCall = recoveryEndpoint.indexOf("executeRecoveryAccountDeletion(");
    expect(admissionCall).toBeGreaterThanOrEqual(0);
    expect(admissionCall).toBeLessThan(recoveryCall);
    expect(recoveryEndpoint).toContain("createRecoveryAdmissionRejectionResponse");
    expect(recoveryAdmissionHelper).toMatch(/admission\.state\s*===\s*"invalid"[\s\S]*404/i);
    expect(recoveryAdmissionHelper).toMatch(
      /state:\s*"limited"[\s\S]*createJsonResponse\(origin,\s*429[\s\S]*Retry-After/i
    );
    expect(recoveryEndpoint).toMatch(/if\s*\(admissionError\)[\s\S]*throw new Error/i);
    expect(`${recoveryEndpoint}\n${recoveryAdmissionHelper}`).not.toMatch(/new\s+(?:Map|Set)\s*\(/);
  });
});
