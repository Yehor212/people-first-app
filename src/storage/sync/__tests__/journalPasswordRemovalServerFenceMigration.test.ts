import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260803194500_fence_journal_password_removal.sql",
);

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
      /security\.authorize_journal_media_write\(\(SELECT auth\.uid\(\)\),\s*name\)/i,
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

  it("atomically publishes an idempotent vault-delete event from finalization and recovery", () => {
    const sql = migrationSource();
    const eventHelper = sql.match(
      /CREATE OR REPLACE FUNCTION private\.record_journal_vault_removal_event\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";
    const finalizeFunction = sql.match(
      /CREATE OR REPLACE FUNCTION public\.finalize_journal_password_removal\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";
    const recoveryFunction = sql.match(
      /CREATE OR REPLACE FUNCTION public\.recover_journal_password_removal\(\)[\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";

    expect(eventHelper).toMatch(/INSERT INTO public\.sync_events/i);
    expect(eventHelper).toMatch(/'setting',[\s\S]*'journal_vault_key',[\s\S]*'delete'/i);
    expect(eventHelper).toMatch(/idempotency_key/i);
    expect(eventHelper).toMatch(/ON CONFLICT \(user_id, idempotency_key\) DO NOTHING/i);
    expect(eventHelper).toMatch(/GET DIAGNOSTICS[\s\S]*ROW_COUNT/i);
    expect(eventHelper).toMatch(
      /FROM public\.sync_events[\s\S]*entity_type\s*=\s*'setting'[\s\S]*entity_id\s*=\s*'journal_vault_key'[\s\S]*op\s*=\s*'delete'/i,
    );
    expect(eventHelper).toMatch(/RAISE EXCEPTION 'Journal vault event idempotency collision'/i);
    expect(finalizeFunction.match(/private\.record_journal_vault_removal_event/g)).toHaveLength(2);
    expect(recoveryFunction.match(/private\.record_journal_vault_removal_event/g)).toHaveLength(2);
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
    expect(sql).toContain("'manual-recovery-required'");
    const recoveryFunction = sql.match(
      /CREATE OR REPLACE FUNCTION public\.recover_journal_password_removal\(\)[\s\S]*?\$\$;/i,
    )?.[0] ?? "";
    expect(recoveryFunction).not.toContain("'cancelled'");
    expect(recoveryFunction).not.toMatch(
      /UPDATE public\.journal_security_states[\s\S]*protection_state\s*=\s*'protected'/i,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.recover_journal_password_removal\(\)[\s\S]*TO authenticated/i,
    );
  });
});
