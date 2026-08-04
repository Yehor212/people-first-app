import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260803194600_guard_journal_entry_deletion.sql",
);

function migrationSource(): string {
  expect(existsSync(migrationPath), "journal deletion permanence migration must exist").toBe(true);
  return existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
}

describe("journal entry deletion permanence migration", () => {
  it("seeds a private permanent lifecycle registry from rows and tombstones", () => {
    const sql = migrationSource();

    expect(sql).toMatch(/^\s*(?:--[^\n]*\n)*\s*BEGIN;/i);
    expect(sql).toMatch(/COMMIT;\s*$/i);
    expect(sql).toMatch(
      /LOCK TABLE\s+public\.journal_entries,\s*public\.sync_tombstones,\s*public\.sync_events\s+IN SHARE ROW EXCLUSIVE MODE/i,
    );
    const cutoverLock = sql.indexOf("LOCK TABLE");
    expect(cutoverLock).toBeGreaterThan(-1);
    expect(cutoverLock).toBeLessThan(sql.indexOf("DO $$"));
    expect(cutoverLock).toBeLessThan(sql.indexOf("CREATE TRIGGER guard_journal_entry_lifecycle"));
    expect(cutoverLock).toBeLessThan(
      sql.indexOf("CREATE TRIGGER record_permanent_journal_entry_delete"),
    );

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS private.journal_entry_lifecycles");
    expect(sql).toMatch(/PRIMARY KEY \(user_id, entry_id\)/i);
    expect(sql).toMatch(/state\s+text\s+NOT NULL[\s\S]*'live'[\s\S]*'deleted'/i);
    expect(sql).toMatch(/INSERT INTO private\.journal_entry_lifecycles[\s\S]*FROM public\.journal_entries/i);
    expect(sql).toMatch(/FROM public\.sync_tombstones[\s\S]*entity_type\s*=\s*'journal'/i);
    expect(sql).toMatch(/REVOKE ALL ON (?:TABLE )?private\.journal_entry_lifecycles/i);
    expect(sql).toMatch(
      /FROM public\.journal_entries[\s\S]*JOIN public\.sync_tombstones[\s\S]*RAISE EXCEPTION 'Journal deletion lifecycle preflight failed: % contradictory rows'/i,
    );
  });

  it("serializes every upsert with permanent deleted state", () => {
    const sql = migrationSource();
    const writeGuard = sql.match(
      /CREATE OR REPLACE FUNCTION private\.guard_journal_entry_lifecycle\(\)[\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";

    expect(writeGuard).toMatch(/INSERT INTO private\.journal_entry_lifecycles/i);
    expect(writeGuard).toMatch(/ON CONFLICT \(user_id, entry_id\)[\s\S]*state = 'live'/i);
    expect(writeGuard).toMatch(/WHERE private\.journal_entry_lifecycles\.state = 'live'/i);
    expect(writeGuard).toMatch(/RAISE EXCEPTION 'Journal entry identifier was permanently deleted'/i);
    expect(writeGuard).toMatch(
      /TG_OP\s*=\s*'UPDATE'[\s\S]*NEW\.id\s+IS\s+DISTINCT\s+FROM\s+OLD\.id[\s\S]*RAISE EXCEPTION 'Journal entry identity is immutable'/i,
    );
    expect(writeGuard).toMatch(/NEW\.user_id\s+IS\s+DISTINCT\s+FROM\s+OLD\.user_id/i);
    expect(sql).toMatch(/BEFORE INSERT OR UPDATE ON public\.journal_entries/i);
  });

  it("records the lifecycle, cascaded row deletion, and durable event in one owner-only RPC", () => {
    const sql = migrationSource();
    const helper = sql.match(
      /CREATE OR REPLACE FUNCTION private\.record_permanent_journal_entry_delete\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";
    const rpc = sql.match(
      /CREATE OR REPLACE FUNCTION public\.delete_journal_entry_permanently\([\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";

    expect(helper).toMatch(/state\s*=\s*'deleted'/i);
    expect(helper).toMatch(/INSERT INTO public\.sync_events/i);
    expect(helper).toMatch(/'journal',[\s\S]*p_entry_id,[\s\S]*'delete'/i);
    expect(helper).toMatch(/ON CONFLICT \(user_id, idempotency_key\) DO NOTHING/i);
    expect(helper).toMatch(/GET DIAGNOSTICS[\s\S]*ROW_COUNT/i);
    expect(helper).toMatch(
      /FROM public\.sync_events[\s\S]*entity_type\s*=\s*'journal'[\s\S]*entity_id\s*=\s*p_entry_id[\s\S]*op\s*=\s*'delete'/i,
    );
    expect(helper).toMatch(/RAISE EXCEPTION 'Journal delete event idempotency collision'/i);
    expect(helper).not.toMatch(/length\(p_entry_id\)\s+NOT BETWEEN\s+1\s+AND\s+512/i);
    expect(helper).not.toMatch(/events\.device_id\s*=\s*p_device_id/i);
    expect(sql).toMatch(/BEFORE DELETE ON public\.journal_entries/i);
    expect(rpc).toMatch(/SELECT auth\.uid\(\)/i);
    expect(rpc).toMatch(/FOR UPDATE/i);
    expect(rpc).toMatch(/private\.record_permanent_journal_entry_delete/i);
    expect(rpc).toMatch(/DELETE FROM public\.journal_entries/i);
    expect(rpc).not.toMatch(/length\(p_entry_id\)\s+NOT BETWEEN\s+1\s+AND\s+512/i);
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.delete_journal_entry_permanently\(text, text\)[\s\S]*FROM PUBLIC, anon, authenticated, service_role/i,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.delete_journal_entry_permanently\(text, text\)[\s\S]*TO authenticated/i,
    );
    expect(rpc.indexOf("FROM public.journal_entries")).toBeLessThan(
      rpc.indexOf("FROM public.journal_security_states"),
    );
  });
});
