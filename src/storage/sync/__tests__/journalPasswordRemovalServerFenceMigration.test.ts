import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260803194500_fence_journal_password_removal.sql",
);
const generatedTypesPath = resolve(process.cwd(), "src/types/supabase.ts");

function migrationSource(): string {
  expect(
    existsSync(migrationPath),
    "journal password removal server-fence migration must exist",
  ).toBe(true);
  return existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
}

describe("journal password removal server fence migration", () => {
  it("keeps a private durable owner-bound removal epoch", () => {
    const sql = migrationSource();

    expect(sql).toMatch(/^\s*(?:--[^\n]*\n)*\s*BEGIN;/i);
    expect(sql).toMatch(/COMMIT;\s*$/i);

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.journal_security_states");
    expect(sql).toMatch(/user_id\s+uuid\s+PRIMARY KEY/i);
    expect(sql).toMatch(/vault_revision\s+bigint\s+NOT NULL/i);
    expect(sql).toMatch(/protection_state\s+text\s+NOT NULL/i);
    expect(sql).toMatch(/removal_operation_revision\s+text/i);
    expect(sql).toContain("ALTER TABLE public.journal_security_states ENABLE ROW LEVEL SECURITY");
    expect(sql).toMatch(
      /REVOKE ALL ON (?:TABLE )?public\.journal_security_states FROM PUBLIC, anon, authenticated/i,
    );
  });

  it("starts removal under a locked owner state and exact vault revision", () => {
    const sql = migrationSource();

    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.begin_journal_password_removal");
    expect(sql).toMatch(/SECURITY DEFINER\s+SET search_path = ''/i);
    expect(sql).toMatch(/SELECT auth\.uid\(\)/i);
    expect(sql).toMatch(/FROM public\.journal_security_states[\s\S]*FOR UPDATE/i);
    expect(sql).toContain("'removing'");
    expect(sql).toContain("p_expected_vault_revision");
    expect(sql).toContain("p_operation_revision");
    expect(sql).toMatch(
      /begin_journal_password_removal\(\s*p_expected_vault_revision bigint,\s*p_operation_revision text,\s*p_inventory jsonb\s*\)/i,
    );
    expect(sql).toContain("security.journal_removal_inventory_covers");
    expect(sql).toContain("security.journal_inventory_sha256");
    expect(sql).toContain("security.journal_inventory_security_projection");
    expect(sql).toMatch(
      /v_type = 'number'[\s\S]*pg_catalog\.trim_scale\(\(p_value::text\)::numeric\)::text/i,
    );
    expect(sql).toMatch(/ORDER BY item\.key COLLATE "C"/i);
    expect(sql).toMatch(
      /journal_inventory_security_projection\(\s*'entry-row',\s*pg_catalog\.to_jsonb\(entries\)\s*\)/i,
    );
    expect(sql).toMatch(
      /journal_inventory_security_projection\(\s*'photo-row',\s*pg_catalog\.to_jsonb\(photos\)\s*\)/i,
    );
    expect(sql).toMatch(
      /journal_inventory_security_projection\(\s*'audio-row',\s*pg_catalog\.to_jsonb\(audio\)\s*\)/i,
    );
    expect(sql).toMatch(/'entry-backup'[\s\S]*'capture-backup'/i);
    expect(sql).not.toMatch(
      /journal_inventory_sha256\(\s*pg_catalog\.to_jsonb\((?:entries|photos|audio)\)/i,
    );
    expect(sql).not.toMatch(
      /journal_inventory_sha256\(\s*backup_item\.value\s*\)/i,
    );
    expect(sql).toMatch(/item\.value\s*->>\s*'backupSha256'/i);
    expect(sql).toMatch(/item\.value\s*->>\s*'version'\s*=\s*objects\.version/i);
    expect(sql).toMatch(/item\.value\s*->>\s*'objectId'\s*=\s*objects\.id::text/i);
    const beginFunction = sql.match(
      /CREATE OR REPLACE FUNCTION public\.begin_journal_password_removal\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";
    expect(beginFunction.indexOf("security.journal_removal_inventory_covers")).toBeGreaterThan(-1);
    const removalTransition = beginFunction.search(
      /SET\s+protection_state\s*=\s*'removing'/i,
    );
    expect(removalTransition).toBeGreaterThan(-1);
    expect(beginFunction.indexOf("security.journal_removal_inventory_covers")).toBeLessThan(
      removalTransition,
    );
  });

  it("reuses only the frozen inventory for a same-operation retry", () => {
    const sql = migrationSource();
    const beginFunction = sql.match(
      /CREATE OR REPLACE FUNCTION public\.begin_journal_password_removal\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";
    const sameOperationBranch = beginFunction.match(
      /IF v_state\.protection_state = 'removing' THEN[\s\S]*?RETURN 'ready';/i,
    )?.[0] ?? "";

    expect(sameOperationBranch).toMatch(
      /journal_removal_inventory_without_revisions\(v_state\.removal_inventory\)[\s\S]*security\.canonical_journal_inventory_json\(p_inventory\)/i,
    );
    expect(sameOperationBranch).not.toContain("journal_removal_inventory_covers");
  });

  it("executes exact journal replay checks with owner-bound definer privileges", () => {
    const sql = migrationSource();
    const replayFunction = sql.match(
      /CREATE OR REPLACE FUNCTION public\.is_journal_entry_payload_current\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";

    expect(replayFunction).toMatch(/SECURITY DEFINER\s+SET search_path = ''/i);
    expect(replayFunction).toMatch(/v_user_id uuid := \(SELECT auth\.uid\(\)\)/i);
    expect(replayFunction).toMatch(/v_incoming\.user_id IS DISTINCT FROM v_user_id/i);
    expect(replayFunction).toMatch(
      /FROM public\.journal_entries AS entries[\s\S]*entries\.user_id = v_user_id/i,
    );
    expect(sql).toMatch(
      /REVOKE ALL ON (?:TABLE )?public\.journal_security_states FROM PUBLIC, anon, authenticated/i,
    );
  });

  it("serializes protected row and blob admission with finalization", () => {
    const sql = migrationSource();

    expect(sql).toContain("security.authorize_protected_journal_write");
    expect(sql).toMatch(/BEFORE INSERT OR UPDATE ON public\.journal_entries/i);
    expect(sql).toMatch(/BEFORE INSERT OR UPDATE ON public\.journal_photos/i);
    expect(sql).toMatch(/BEFORE INSERT OR UPDATE ON public\.journal_audio/i);
    expect(sql).toMatch(/BEFORE INSERT OR UPDATE ON public\.user_backups/i);
    expect(sql).toMatch(/zenflow:journal-content:v1:/i);
    expect(sql).toContain("journalSpaceCaptures");
    expect(sql).toMatch(/right\([^)]*,\s*4\)\s*=\s*'\.bin'/i);
    expect(sql).toMatch(
      /security\.authorize_journal_media_write\(\(SELECT auth\.uid\(\)\),\s*bucket_id,\s*name\)/i,
    );
  });

  it("requires recent non-refresh account authentication without exposing the vault key", () => {
    const sql = migrationSource();

    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION security\.journal_removal_recent_auth_is_valid\(/i,
    );
    const freshAuth = sql.match(
      /CREATE OR REPLACE FUNCTION security\.journal_removal_recent_auth_is_valid\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";
    expect(freshAuth).toMatch(/auth\.jwt\(\)\s*->\s*'amr'/i);
    expect(freshAuth).toMatch(/method[\s\S]*<>\s*'token_refresh'/i);
    expect(freshAuth).toMatch(/is_anonymous[\s\S]*'false'::jsonb/i);
    expect(freshAuth).toMatch(/timestamp[\s\S]*BETWEEN\s+v_now\s*-\s*600\s+AND\s+v_now/i);
    expect(freshAuth).not.toMatch(/v_now\s*\+|timestamp[^\n]*>\s*v_now/i);
    expect(freshAuth).toMatch(/600/i);
    const beginFunction = sql.match(
      /CREATE OR REPLACE FUNCTION public\.begin_journal_password_removal\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";
    expect(beginFunction).toMatch(
      /protection_state\s*=\s*'removing'[\s\S]*NOT security\.journal_removal_recent_auth_is_valid\(\)[\s\S]*RETURN 'fresh-auth-required-existing-fence'/i,
    );
    expect(beginFunction).toMatch(
      /protection_state\s*<>\s*'protected'[\s\S]*NOT security\.journal_removal_recent_auth_is_valid\(\)[\s\S]*RETURN 'fresh-auth-required-no-fence'/i,
    );
    expect(beginFunction.indexOf("fresh-auth-required-existing-fence")).toBeLessThan(
      beginFunction.indexOf("journal_write_mode = 'paused'"),
    );
    expect(sql).not.toMatch(/p_(?:vault_)?key\s+text|p_capability_token/i);
    expect(sql).not.toMatch(/p_device_id\s+text/i);
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.begin_journal_password_removal[\s\S]{0,300}TO authenticated/i,
    );
  });

  it("makes an exact pre-mutation abort idempotent after a lost client acknowledgement", () => {
    const sql = migrationSource();
    const abortFunction = sql.match(
      /CREATE OR REPLACE FUNCTION public\.abort_journal_password_removal\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";

    expect(sql).toContain("last_aborted_removal_operation_revision");
    expect(abortFunction).toMatch(
      /protection_state\s*=\s*'protected'[\s\S]*last_aborted_removal_operation_revision\s*=\s*p_operation_revision[\s\S]*RETURN 'aborted'/i,
    );
    expect(abortFunction).toMatch(
      /protection_state\s*=\s*'protected'[\s\S]*removal_operation_revision\s*=\s*NULL[\s\S]*last_aborted_removal_operation_revision\s*=\s*p_operation_revision/i,
    );
  });

  it("binds each replacement upload to one exact owner-operation-media path", () => {
    const sql = migrationSource();
    const mediaAuthorization = sql.match(
      /CREATE OR REPLACE FUNCTION security\.authorize_journal_media_write\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";

    expect(mediaAuthorization).not.toMatch(/protection_state\s*=\s*'removing'[\s\S]*RETURN true/i);
    expect(sql).toMatch(
      /reserve_journal_password_removal_media\([\s\S]*p_storage_path text[\s\S]*p_content_sha256 text[\s\S]*p_content_size bigint[\s\S]*p_mime_type text/i,
    );
    expect(sql).toMatch(
      /jsonb_build_object\([\s\S]*'bucket'[\s\S]*'id'[\s\S]*'path'[\s\S]*'sha256'[\s\S]*'size'[\s\S]*'mimeType'/i,
    );
    expect(mediaAuthorization).toMatch(
      /reservation\.value\s*->>\s*'path'\s*=\s*p_object_name/i,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.reserve_journal_password_removal_media[\s\S]{0,420}TO authenticated/i,
    );
  });

  it("never inserts user data from the password-removal migration", () => {
    const sql = migrationSource();

    expect(sql).not.toMatch(
      /\bINSERT\s+INTO\s+(?:public\.)?(?:journal_entries|journal_photos|journal_audio|user_backups|sync_events)\b/i,
    );
  });

  it("freezes an exact unique inventory and rechecks the server row revision", () => {
    const sql = migrationSource();
    const coverage = sql.match(
      /CREATE OR REPLACE FUNCTION security\.journal_removal_inventory_covers\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";

    expect(coverage).toMatch(/jsonb_object_has_exact_keys/i);
    expect(coverage).toMatch(/COUNT\(DISTINCT/i);
    expect(coverage).toMatch(/counts\.total\s*<>\s*counts\.unique_total/i);
    expect(sql).toMatch(
      /removal_inventory\s*=\s*security\.journal_removal_inventory_with_revisions/i,
    );
    expect(coverage).toMatch(/COUNT\(\*\)[\s\S]*journal_entries/i);
    expect(coverage).toMatch(/jsonb_array_length\(p_inventory\s*->\s*'entries'\)/i);
    const entryCommit = sql.match(
      /CREATE OR REPLACE FUNCTION public\.commit_journal_password_removal_entry\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";
    expect(entryCommit).toMatch(/row_revision[\s\S]*rowRevision/i);
    expect(entryCommit).toMatch(/UPDATE public\.journal_entries/i);
    expect(entryCommit).not.toMatch(/INSERT\s+INTO/i);
    for (const trigger of [
      "bump_journal_entry_row_revision",
      "bump_journal_photo_row_revision",
      "bump_journal_audio_row_revision",
    ]) {
      expect(sql).toContain(`CREATE TRIGGER ${trigger}`);
    }
    expect(sql).toMatch(
      /CREATE TRIGGER bump_journal_entry_row_revision[\s\S]*private\.bump_journal_row_revision\(\)/i,
    );
  });

  it("binds every protected remote surface to the exact vault epoch", () => {
    const sql = migrationSource();

    expect(sql).toMatch(/ALTER TABLE public\.journal_entries[\s\S]*ADD COLUMN IF NOT EXISTS vault_revision bigint/i);
    expect(sql).toMatch(/ALTER TABLE public\.journal_photos[\s\S]*ADD COLUMN IF NOT EXISTS vault_revision bigint/i);
    expect(sql).toMatch(/ALTER TABLE public\.journal_audio[\s\S]*ADD COLUMN IF NOT EXISTS vault_revision bigint/i);
    expect(sql).toMatch(/ALTER TABLE public\.user_backups[\s\S]*ADD COLUMN IF NOT EXISTS vault_revision bigint/i);
    expect(sql).toMatch(
      /security\.authorize_protected_journal_write\(\s*p_owner_id uuid,\s*p_vault_revision bigint\s*\)/i,
    );
    expect(sql).toMatch(
      /security\.authorize_protected_journal_write\(NEW\.user_id,\s*NEW\.vault_revision\)/i,
    );
    expect(sql).toContain("security.read_journal_media_vault_revision");
    expect(sql).toContain("security.validate_journal_backup_vault_epoch");
    expect(sql).toMatch(/is_journal_entry_payload_current[\s\S]*vault_revision/i);
  });

  it("fails closed for stale E1 and plaintext writes while E2 is protected", () => {
    const sql = migrationSource();
    const rowFence = sql.match(
      /CREATE OR REPLACE FUNCTION private\.enforce_journal_protected_write_fence\(\)[\s\S]*?\$\$;/i,
    )?.[0] ?? "";

    expect(rowFence).toContain("protection_state = 'protected'");
    expect(rowFence).toMatch(/NEW\.vault_revision\s+IS\s+DISTINCT\s+FROM\s+v_state\.vault_revision/i);
    expect(rowFence).toMatch(/RAISE EXCEPTION 'Journal vault epoch mismatch'/i);
    expect(sql).toContain("journal_write_mode");
    expect(sql).toContain("'paused'");
  });

  it("uses expand-and-contract rollout so the schema migration does not break old clients", () => {
    const sql = migrationSource();
    const vaultAdmission = sql.match(
      /CREATE OR REPLACE FUNCTION private\.admit_journal_vault_write\(\)[\s\S]*?\$\$;/i,
    )?.[0] ?? "";
    const strictActivation = sql.match(
      /CREATE OR REPLACE FUNCTION public\.enable_journal_strict_write_fence\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";

    expect(sql).toMatch(/journal_write_mode\s+text\s+NOT NULL\s+DEFAULT\s+'legacy'/i);
    expect(sql).toMatch(/journal_write_mode\s+IN\s*\(\s*'legacy',\s*'strict',\s*'paused'\s*\)/i);
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.enable_journal_strict_write_fence");
    expect(sql).toMatch(/journal_write_mode\s*=\s*'legacy'/i);
    expect(sql).toMatch(/journal_write_mode\s*=\s*'paused'/i);
    expect(sql).toMatch(/journal_write_mode\s*=\s*'strict'/i);
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.enable_journal_strict_write_fence\(bigint\)[\s\S]*TO authenticated/i,
    );
    expect(vaultAdmission).not.toMatch(/journal_write_mode\s*=\s*'strict'/i);
    expect(strictActivation).toMatch(/SELECT auth\.uid\(\)/i);
    expect(strictActivation).toMatch(/FROM public\.journal_entries/i);
    expect(strictActivation).toMatch(/FROM public\.journal_photos/i);
    expect(strictActivation).toMatch(/FROM public\.journal_audio/i);
    expect(strictActivation).toMatch(/FROM public\.user_backups/i);
    expect(strictActivation).toMatch(/FROM storage\.objects/i);
    expect(strictActivation).toContain("RETURN 'legacy-data'");
    expect(
      strictActivation.match(/security\.read_journal_vault_revision\(settings\.value\)/g),
    ).toHaveLength(1);
  });

  it("releases heavyweight schema locks before function install and bounds the final cutover", () => {
    const sql = migrationSource();
    const firstFunction = sql.search(/CREATE OR REPLACE FUNCTION/i);
    const firstCommit = sql.search(/COMMIT;/i);
    const cutoverMarker = sql.indexOf("-- Final bounded vault-admission cutover.");
    const beforeCutover = cutoverMarker >= 0 ? sql.slice(0, cutoverMarker) : sql;
    const cutover = cutoverMarker >= 0 ? sql.slice(cutoverMarker) : "";
    const schemaPhase = firstCommit >= 0 ? sql.slice(0, firstCommit + "COMMIT;".length) : sql;
    const validationPhase =
      firstCommit >= 0 && firstFunction > firstCommit
        ? sql.slice(firstCommit + "COMMIT;".length, firstFunction)
        : "";
    const lastBeginBeforeCutover = beforeCutover.lastIndexOf("BEGIN;");
    const functionPhase =
      lastBeginBeforeCutover >= 0 ? beforeCutover.slice(lastBeginBeforeCutover) : "";
    const vaultSettingsLock = cutover.search(
      /LOCK TABLE[\s\S]*public\.user_settings[\s\S]*IN SHARE ROW EXCLUSIVE MODE;/i,
    );
    const stateSeed = cutover.search(/INSERT INTO public\.journal_security_states\s*\(/i);
    const vaultDeleteTrigger = cutover.search(
      /CREATE TRIGGER admit_journal_vault_delete\s+BEFORE DELETE ON public\.user_settings/i,
    );
    const vaultTrigger = cutover.search(
      /CREATE TRIGGER admit_journal_vault_write\s+BEFORE INSERT OR UPDATE ON public\.user_settings/i,
    );

    expect(firstCommit).toBeGreaterThan(-1);
    expect(firstFunction).toBeGreaterThan(firstCommit);
    expect(schemaPhase).toMatch(/SET LOCAL lock_timeout = '10s';/i);
    expect(schemaPhase).toMatch(/SET LOCAL statement_timeout = '30s';/i);
    expect(schemaPhase).toMatch(
      /journal_entries_vault_revision_safe[\s\S]*NOT VALID/i,
    );
    expect(schemaPhase).toMatch(
      /journal_photos_vault_revision_safe[\s\S]*NOT VALID/i,
    );
    expect(schemaPhase).toMatch(
      /journal_audio_vault_revision_safe[\s\S]*NOT VALID/i,
    );
    expect(schemaPhase).toMatch(
      /user_backups_vault_revision_safe[\s\S]*NOT VALID/i,
    );
    expect(validationPhase).toMatch(
      /ALTER TABLE public\.journal_entries[\s\S]*VALIDATE CONSTRAINT journal_entries_vault_revision_safe/i,
    );
    expect(validationPhase).toMatch(
      /ALTER TABLE public\.journal_photos[\s\S]*VALIDATE CONSTRAINT journal_photos_vault_revision_safe/i,
    );
    expect(validationPhase).toMatch(
      /ALTER TABLE public\.journal_audio[\s\S]*VALIDATE CONSTRAINT journal_audio_vault_revision_safe/i,
    );
    expect(validationPhase).toMatch(
      /ALTER TABLE public\.user_backups[\s\S]*VALIDATE CONSTRAINT user_backups_vault_revision_safe/i,
    );
    expect(cutoverMarker).toBeGreaterThan(firstFunction);
    expect(beforeCutover).not.toMatch(
      /(?:DROP|CREATE) TRIGGER[^;]*ON public\.(?:user_settings|journal_entries|journal_photos|journal_audio|user_backups)/i,
    );
    expect(functionPhase).toMatch(/BEGIN;[\s\S]*SET LOCAL lock_timeout = '10s';/i);
    expect(functionPhase).toMatch(/SET LOCAL statement_timeout = '30s';/i);
    expect(vaultSettingsLock).toBeGreaterThan(-1);
    for (const trigger of [
      "enforce_journal_protected_write_fence",
      "enforce_journal_photo_protected_write_fence",
      "enforce_journal_audio_protected_write_fence",
      "enforce_journal_backup_protected_write_fence",
      "enforce_journal_entry_removal_delete_fence",
      "enforce_journal_photo_removal_delete_fence",
      "enforce_journal_audio_removal_delete_fence",
      "enforce_journal_backup_removal_delete_fence",
    ]) {
      expect(cutover).toContain(`CREATE TRIGGER ${trigger}`);
    }
    expect(vaultDeleteTrigger).toBeGreaterThan(vaultSettingsLock);
    expect(vaultTrigger).toBeGreaterThan(vaultSettingsLock);
    expect(vaultTrigger).toBeGreaterThan(vaultDeleteTrigger);
    expect(stateSeed).toBeGreaterThan(vaultTrigger);
    expect(cutover).not.toMatch(/CREATE OR REPLACE FUNCTION/i);
    expect(cutover).not.toMatch(/CREATE (?:UNIQUE )?INDEX/i);
    expect(cutover).not.toMatch(/ALTER TABLE/i);
    expect(cutover).toMatch(
      /INSERT INTO public\.journal_security_states[\s\S]*NOTIFY pgrst, 'reload schema';\s*COMMIT;\s*$/i,
    );
  });

  it("keeps generated journal security state types aligned with wrapper revisions", () => {
    const types = readFileSync(generatedTypesPath, "utf8");
    const table = types.match(
      /journal_security_states:\s*\{[\s\S]*?Relationships:\s*\[\]/,
    )?.[0] ?? "";

    expect(table.match(/wrapper_revision:\s*number/g)).toHaveLength(1);
    expect(table.match(/wrapper_revision\?:\s*number/g)).toHaveLength(2);
  });

  it("serializes password-wrapper changes with an owner-bound generation CAS", () => {
    const sql = migrationSource();
    const vaultAdmission = sql.match(
      /CREATE OR REPLACE FUNCTION private\.admit_journal_vault_write\(\)[\s\S]*?\$\$;/i,
    )?.[0] ?? "";
    const wrapperCas = sql.match(
      /CREATE OR REPLACE FUNCTION public\.compare_and_swap_journal_vault_wrapper\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";

    expect(sql).toMatch(/wrapper_revision\s+bigint\s+NOT NULL\s+DEFAULT\s+0/i);
    expect(sql).toContain("CREATE OR REPLACE FUNCTION security.read_journal_vault_wrapper_revision");
    expect(vaultAdmission).toMatch(/FOR UPDATE/i);
    expect(vaultAdmission).toMatch(/v_wrapper_revision\s*>\s*v_state\.wrapper_revision\s*\+\s*1/i);
    expect(vaultAdmission).toMatch(/Journal vault wrapper generation is stale/i);
    expect(wrapperCas).toMatch(/SELECT auth\.uid\(\)/i);
    expect(wrapperCas).toMatch(/FROM public\.journal_security_states[\s\S]*FOR UPDATE/i);
    expect(wrapperCas).toMatch(/FROM public\.user_settings[\s\S]*FOR UPDATE/i);
    expect(wrapperCas.indexOf("FROM public.user_settings")).toBeLessThan(
      wrapperCas.indexOf("FROM public.journal_security_states"),
    );
    expect(wrapperCas).toMatch(/p_expected_value[\s\S]*p_next_value/i);
    expect(wrapperCas).toMatch(/v_current_value\s*=\s*p_next_value[\s\S]*RETURN 'committed'/i);
    expect(wrapperCas).toMatch(/UPDATE public\.user_settings/i);
    expect(wrapperCas).not.toMatch(/upsert|ON CONFLICT/i);
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.compare_and_swap_journal_vault_wrapper\(jsonb, jsonb\)[\s\S]*TO authenticated/i,
    );
  });

  it("rejects every authenticated journal-security mutation after the permanent account-deletion tombstone", () => {
    const sql = migrationSource();
    const ownerGuard = sql.match(
      /CREATE OR REPLACE FUNCTION security\.assert_journal_owner_active\([\s\S]*?\$\$;/i,
    )?.[0] ?? "";

    expect(ownerGuard).toMatch(
      /pg_advisory_xact_lock\([\s\S]*hashtextextended\(p_owner_id::text,\s*0\)/i,
    );
    const ownerLock = ownerGuard.indexOf("pg_advisory_xact_lock");
    const tombstoneRead = ownerGuard.indexOf("FROM public.account_deletion_blocks");
    expect(ownerLock).toBeGreaterThan(-1);
    expect(tombstoneRead).toBeGreaterThan(ownerLock);
    expect(ownerGuard).toMatch(
      /RAISE EXCEPTION 'Account deletion is final'[\s\S]*ERRCODE = '42501'/i,
    );
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION security\.assert_journal_owner_active\(uuid\)[\s\S]*FROM PUBLIC, anon, authenticated, service_role/i,
    );
    expect(sql).not.toMatch(
      /GRANT EXECUTE ON FUNCTION security\.assert_journal_owner_active\(uuid\)[\s\S]*TO authenticated/i,
    );

    const guardedFunctions = [
      {
        pattern:
          /CREATE OR REPLACE FUNCTION private\.admit_journal_vault_write\(\)[\s\S]*?\$\$;/i,
        owner: "NEW.user_id",
      },
      {
        pattern:
          /CREATE OR REPLACE FUNCTION public\.compare_and_swap_journal_vault_wrapper\([\s\S]*?\n\$\$;/i,
        owner: "v_user_id",
      },
      {
        pattern:
          /CREATE OR REPLACE FUNCTION public\.enable_journal_strict_write_fence\([\s\S]*?\n\$\$;/i,
        owner: "v_user_id",
      },
      {
        pattern:
          /CREATE OR REPLACE FUNCTION public\.begin_journal_password_removal\([\s\S]*?\n\$\$;/i,
        owner: "v_user_id",
      },
      {
        pattern:
          /CREATE OR REPLACE FUNCTION public\.recover_journal_password_removal\(\)[\s\S]*?\n\$\$;/i,
        owner: "v_user_id",
      },
      {
        pattern:
          /CREATE OR REPLACE FUNCTION public\.finalize_journal_password_removal\([\s\S]*?\n\$\$;/i,
        owner: "v_user_id",
      },
    ];

    for (const { pattern, owner } of guardedFunctions) {
      const fn = sql.match(pattern)?.[0] ?? "";
      const guardCall = fn.indexOf(
        `security.assert_journal_owner_active(${owner})`,
      );
      const firstLockedOrMutableStatement = fn.search(
        /FROM public\.(?:user_settings|journal_security_states)[\s\S]*?FOR UPDATE|UPDATE public\.journal_security_states|INSERT INTO public\.journal_security_states|DELETE FROM public\.user_settings/i,
      );

      expect(guardCall, `missing terminal deletion guard for ${owner}`).toBeGreaterThan(-1);
      expect(firstLockedOrMutableStatement).toBeGreaterThan(-1);
      expect(guardCall).toBeLessThan(firstLockedOrMutableStatement);
    }
  });

  it("uses one user-settings-to-security-state lock order for wrapper CAS and removal finalization", () => {
    const sql = migrationSource();
    const wrapperCas = sql.match(
      /CREATE OR REPLACE FUNCTION public\.compare_and_swap_journal_vault_wrapper\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";
    const finalizeFunction = sql.match(
      /CREATE OR REPLACE FUNCTION public\.finalize_journal_password_removal\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";
    const recoveryFunction = sql.match(
      /CREATE OR REPLACE FUNCTION public\.recover_journal_password_removal\(\)[\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";

    for (const fn of [wrapperCas, finalizeFunction, recoveryFunction]) {
      expect(fn).toMatch(/FROM public\.user_settings[\s\S]*FOR UPDATE/i);
      expect(fn.indexOf("FROM public.user_settings")).toBeLessThan(
        fn.indexOf("FROM public.journal_security_states"),
      );
    }
  });

  it("pauses protected writes while admitting only plaintext removal conversion", () => {
    const sql = migrationSource();
    const beginFunction = sql.match(
      /CREATE OR REPLACE FUNCTION public\.begin_journal_password_removal\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";
    const finalizeFunction = sql.match(
      /CREATE OR REPLACE FUNCTION public\.finalize_journal_password_removal\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";
    const rowFence = sql.match(
      /CREATE OR REPLACE FUNCTION private\.enforce_journal_protected_write_fence\(\)[\s\S]*?\$\$;/i,
    )?.[0] ?? "";
    const mediaFence = sql.match(
      /CREATE OR REPLACE FUNCTION security\.authorize_journal_media_write\([\s\S]*?\$\$;/i,
    )?.[0] ?? "";

    expect(beginFunction).toMatch(/journal_write_mode\s*=\s*'paused'/i);
    expect(finalizeFunction).toMatch(/journal_write_mode\s*=\s*'legacy'/i);
    expect(rowFence).toMatch(
      /journal_write_mode\s*=\s*'paused'[\s\S]*v_is_protected[\s\S]*NEW\.vault_revision IS NOT NULL/i,
    );
    expect(rowFence).toMatch(
      /validate_journal_backup_vault_epoch\(NEW\.payload, NULL\)[\s\S]*RETURN NEW/i,
    );
    expect(mediaFence).toMatch(
      /journal_write_mode\s*=\s*'paused'[\s\S]*protection_state\s*=\s*'removing'[\s\S]*right\(p_object_name, 4\)\s*<>\s*'\.bin'/i,
    );
  });

  it("blocks row deletion while paused and admits only an unreferenced replaced blob", () => {
    const sql = migrationSource();
    const rowDeleteFence = sql.match(
      /CREATE OR REPLACE FUNCTION private\.enforce_journal_removal_delete_fence\(\)[\s\S]*?\$\$;/i,
    )?.[0] ?? "";
    const mediaDeleteFence = sql.match(
      /CREATE OR REPLACE FUNCTION security\.authorize_journal_media_delete\([\s\S]*?\$\$;/i,
    )?.[0] ?? "";

    expect(rowDeleteFence).toMatch(/OLD\.user_id/i);
    expect(rowDeleteFence).toMatch(/FROM public\.journal_security_states[\s\S]*FOR UPDATE/i);
    expect(rowDeleteFence).toMatch(
      /journal_write_mode\s*=\s*'paused'[\s\S]*RAISE EXCEPTION 'Journal deletion is paused for removal'/i,
    );
    expect(sql).toMatch(/BEFORE DELETE ON public\.journal_entries/i);
    expect(sql).toMatch(/BEFORE DELETE ON public\.journal_photos/i);
    expect(sql).toMatch(/BEFORE DELETE ON public\.journal_audio/i);
    expect(sql).toMatch(/BEFORE DELETE ON public\.user_backups/i);

    expect(mediaDeleteFence).toMatch(/p_bucket_id text,\s*p_object_name text/i);
    expect(mediaDeleteFence).toMatch(
      /journal_write_mode\s*<>\s*'paused'[\s\S]*RETURN true/i,
    );
    expect(mediaDeleteFence).toMatch(
      /right\(p_object_name, 4\)\s*<>\s*'\.bin'[\s\S]*RETURN false/i,
    );
    expect(mediaDeleteFence).toMatch(/FROM public\.journal_photos/i);
    expect(mediaDeleteFence).toMatch(/FROM public\.journal_audio/i);
    expect(mediaDeleteFence).toMatch(/storage_path\s*=\s*p_object_name/i);
    expect(sql).toMatch(
      /CREATE POLICY "journal_photos_delete"[\s\S]*authorize_journal_media_delete\(\s*\(SELECT auth\.uid\(\)\),\s*bucket_id,\s*name\s*\)/i,
    );
    expect(sql).toMatch(
      /CREATE POLICY "journal_audio_delete"[\s\S]*authorize_journal_media_delete\(\s*\(SELECT auth\.uid\(\)\),\s*bucket_id,\s*name\s*\)/i,
    );
  });

  it("preserves fail-closed Storage admission outside READ COMMITTED", () => {
    const sql = migrationSource();
    const mediaWriteFence = sql.match(
      /CREATE OR REPLACE FUNCTION security\.authorize_journal_media_write\([\s\S]*?\$\$;/i,
    )?.[0] ?? "";
    const mediaDeleteFence = sql.match(
      /CREATE OR REPLACE FUNCTION security\.authorize_journal_media_delete\([\s\S]*?\$\$;/i,
    )?.[0] ?? "";

    for (const fence of [mediaWriteFence, mediaDeleteFence]) {
      const isolationGuard = fence.search(
        /current_setting\('transaction_isolation'\)\s*<>\s*'read committed'[\s\S]*?RETURN false/i,
      );
      const ownerLock = fence.indexOf("pg_advisory_xact_lock");

      expect(isolationGuard).toBeGreaterThan(-1);
      expect(ownerLock).toBeGreaterThan(isolationGuard);
    }
  });

  it("atomically verifies every protected remote surface before vault deletion", () => {
    const sql = migrationSource();

    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.finalize_journal_password_removal");
    expect(sql).toMatch(/SECURITY DEFINER\s+SET search_path = ''/i);
    expect(sql).toMatch(/FROM public\.journal_entries/i);
    expect(sql).toMatch(/FROM public\.journal_photos/i);
    expect(sql).toMatch(/FROM public\.journal_audio/i);
    expect(sql).toMatch(/FROM public\.user_backups/i);
    expect(sql).toMatch(/FROM storage\.objects/i);
    expect(sql).toMatch(/DELETE FROM public\.user_settings[\s\S]*journal_vault_key/i);
    expect(sql).toMatch(/protection_state\s*=\s*'unprotected'/i);
    expect(sql).toContain("'protected-data'");
  });

  it("defers privacy-safe RFC-compatible event receipts until vault finalization", () => {
    const sql = migrationSource();
    const receiptHelper = sql.match(
      /CREATE OR REPLACE FUNCTION private\.journal_removal_event_receipt\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";
    const finalizeFunction = sql.match(
      /CREATE OR REPLACE FUNCTION public\.finalize_journal_password_removal\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";
    const recoveryFunction = sql.match(
      /CREATE OR REPLACE FUNCTION public\.recover_journal_password_removal\(\)[\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";

    expect(receiptHelper).toMatch(/idempotencyKey/i);
    expect(receiptHelper).toMatch(/payloadSha256/i);
    expect(receiptHelper).toMatch(/pg_catalog\.md5/i);
    expect(receiptHelper).toMatch(/substr\([\s\S]*'-3'[\s\S]*'-[89ab]'/i);
    expect(receiptHelper).not.toMatch(/INSERT\s+INTO/i);
    expect(sql).toMatch(/removal_event_receipts jsonb NOT NULL DEFAULT '\[\]'::jsonb/i);
    expect(sql).toMatch(/'journalRemovalRefetch'\s*,\s*true/i);
    expect(sql).not.toMatch(
      /journal_removal_event_receipt\([\s\S]{0,700}journal_entry_removal_event_payload/i,
    );
    expect(finalizeFunction).toMatch(/private\.journal_removal_event_receipt/i);
    expect(finalizeFunction).toMatch(/'eventReceipts'/i);
    expect(recoveryFunction).toMatch(/private\.journal_removal_event_receipt/i);
    expect(recoveryFunction).toMatch(/'eventReceipts'/i);
    expect(sql).toContain(
      "CREATE OR REPLACE FUNCTION public.acknowledge_journal_password_removal_events",
    );

    const fixedName = [
      "00000000-0000-0000-0000-000000000001",
      "100:removalrevision1",
      "journal-refetch:entry-1",
      "journal",
      "entry-1",
      "upsert",
      "a".repeat(64),
    ].join(":");
    const digest = createHash("md5").update(fixedName).digest("hex");
    const uuidV3 = [
      digest.slice(0, 8),
      digest.slice(8, 12),
      `3${digest.slice(13, 16)}`,
      `8${digest.slice(17, 20)}`,
      digest.slice(20),
    ].join("-");
    expect(uuidV3).toBe("e7f8424c-33c6-328e-8c84-a7d4373cae06");
  });

  it("patches only journal backup fields with a server timestamp", () => {
    const sql = migrationSource();
    const backupCommit = sql.match(
      /CREATE OR REPLACE FUNCTION public\.commit_journal_password_removal_backup\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";

    expect(backupCommit).toMatch(/p_journal_patch jsonb/i);
    expect(backupCommit).not.toMatch(/p_updated_at/i);
    expect(backupCommit).toMatch(/UPDATE public\.user_backups/i);
    expect(backupCommit).not.toMatch(/INSERT\s+INTO/i);
    expect(backupCommit).toMatch(/jsonb_set/i);
    expect(backupCommit).toMatch(/updated_at\s*=\s*now\(\)/i);
    expect(backupCommit).toMatch(/v_non_journal_sha256/i);
  });

  it("binds every backup postimage to the operation inventory before replacing protected data", () => {
    const sql = migrationSource();
    const inventoryValidator = sql.match(
      /CREATE OR REPLACE FUNCTION security\.journal_removal_inventory_covers\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";
    const backupCommit = sql.match(
      /CREATE OR REPLACE FUNCTION public\.commit_journal_password_removal_backup\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";

    expect(inventoryValidator).toContain("postimageBackupSha256");
    expect(inventoryValidator).toMatch(/postimageBackupSha256[\s\S]*\^\[0-9a-f\]\{64\}\$/i);
    expect(backupCommit).toMatch(
      /postimageBackupSha256[\s\S]*journal_inventory_sha256[\s\S]*journal_inventory_security_projection/i,
    );
    expect(backupCommit).toMatch(/RETURN pg_catalog\.jsonb_build_object\('status', 'stale'\)/i);
  });

  it("does not finalize while a replacement reservation or orphan object remains", () => {
    const sql = migrationSource();
    const finalizeFunction = sql.match(
      /CREATE OR REPLACE FUNCTION public\.finalize_journal_password_removal\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";

    expect(finalizeFunction).toMatch(/removal_media_reservations\s*<>\s*'\[\]'::jsonb/i);
    expect(finalizeFunction).toMatch(
      /storage\.objects[\s\S]*removal[\s\S]*NOT EXISTS[\s\S]*(?:journal_photos|journal_audio)/i,
    );
    expect(finalizeFunction).not.toMatch(
      /SET[\s\S]*removal_media_reservations\s*=\s*'\[\]'::jsonb[\s\S]*RETURN 'complete'/i,
    );
  });

  it("exposes only the caller-bound removal RPCs to authenticated clients", () => {
    const sql = migrationSource();

    expect(sql).toMatch(
      /DROP FUNCTION IF EXISTS public\.begin_journal_password_removal\(bigint, text\)/i,
    );
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.begin_journal_password_removal\(bigint, text, jsonb\)[\s\S]*FROM PUBLIC, anon, authenticated, service_role/i,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.begin_journal_password_removal\(bigint, text, jsonb\)[\s\S]*TO authenticated/i,
    );
    expect(sql).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\.begin_journal_password_removal\(bigint, text\)\s+TO authenticated/i,
    );
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.finalize_journal_password_removal\(bigint, text\)[\s\S]*FROM PUBLIC, anon, authenticated, service_role/i,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.finalize_journal_password_removal\(bigint, text\)[\s\S]*TO authenticated/i,
    );
  });

  it("allows only the permanent account-deletion barrier to bypass vault finalization", () => {
    const sql = migrationSource();
    const triggerFunction = sql.match(
      /CREATE OR REPLACE FUNCTION private\.admit_journal_vault_delete\(\)[\s\S]*?\$\$;/i,
    )?.[0] ?? "";

    expect(triggerFunction).toMatch(
      /EXISTS\s*\([\s\S]*FROM public\.account_deletion_blocks[\s\S]*user_id\s*=\s*OLD\.user_id[\s\S]*\)\s*THEN\s*RETURN OLD/i,
    );
    expect(triggerFunction).not.toMatch(/current_user|session_user|service_role/i);
  });

  it("provides an owner-only recovery path for a lost local removal intent", () => {
    const sql = migrationSource();

    expect(sql).toContain(
      "CREATE OR REPLACE FUNCTION public.recover_journal_password_removal",
    );
    expect(sql).not.toContain("removal_progress_started");
    expect(sql).toContain("'abortable'");
    expect(sql).toContain("'manual-recovery-required'");
    const recoveryFunction = sql.match(
      /CREATE OR REPLACE FUNCTION public\.recover_journal_password_removal\(\)[\s\S]*?\$\$;/i,
    )?.[0] ?? "";
    expect(recoveryFunction).not.toContain("'cancelled'");
    expect(recoveryFunction).toMatch(
      /NOT v_state\.removal_mutation_started[\s\S]*journal_removal_inventory_covers[\s\S]*'status', 'abortable'/i,
    );
    expect(recoveryFunction.indexOf("'status', 'abortable'")).toBeLessThan(
      recoveryFunction.indexOf("'status', 'manual-recovery-required'"),
    );
    expect(recoveryFunction).not.toMatch(
      /UPDATE public\.journal_security_states[\s\S]*protection_state\s*=\s*'protected'/i,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.recover_journal_password_removal\(\)[\s\S]*TO authenticated/i,
    );
  });
});
