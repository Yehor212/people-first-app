import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const scriptPath = join(process.cwd(), "scripts/check-types-freshness.cjs");

function writeFixture(root: string, file: string, source: string) {
  const path = join(root, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, source);
}

function git(root: string, args: string[], env: NodeJS.ProcessEnv = {}) {
  execFileSync("git", args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: "pipe",
  });
}

function createRepoWithCommittedTypes() {
  const root = mkdtempSync(join(tmpdir(), "types-freshness-"));
  mkdirSync(join(root, "scripts"), { recursive: true });
  copyFileSync(scriptPath, join(root, "scripts/check-types-freshness.cjs"));
  writeFixture(root, "src/types/supabase.ts", "export type Database = { old: true };\n");
  writeFixture(root, "supabase/migrations/20260101000000_initial.sql", "select 1;\n");

  git(root, ["init"]);
  git(root, ["config", "user.email", "codex@example.invalid"]);
  git(root, ["config", "user.name", "Codex Test"]);
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "initial"], {
    GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z",
    GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z",
  });

  writeFixture(root, "supabase/migrations/20260618022951_index_advisor_foreign_keys.sql", "create index example_idx on example(id);\n");
  const migrationTime = new Date("2026-06-18T02:29:51Z");
  utimesSync(join(root, "supabase/migrations/20260618022951_index_advisor_foreign_keys.sql"), migrationTime, migrationTime);
  return root;
}

describe("check-types-freshness", () => {
  it("uses filesystem time for modified tracked files before they are committed", () => {
    const root = createRepoWithCommittedTypes();
    writeFixture(root, "src/types/supabase.ts", "export type Database = { regenerated: true };\n");

    const typesTime = new Date("2026-06-18T02:31:00Z");
    utimesSync(join(root, "src/types/supabase.ts"), typesTime, typesTime);

    const result = spawnSync(process.execPath, ["scripts/check-types-freshness.cjs"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[types-freshness] OK");
    expect(readFileSync(join(root, "src/types/supabase.ts"), "utf8")).toContain("regenerated");
  });
  it("allows a freshly rewritten generated file when uncommitted migrations are present", () => {
    const root = createRepoWithCommittedTypes();
    const originalTypes = readFileSync(join(root, "src/types/supabase.ts"), "utf8");
    writeFixture(root, "src/types/supabase.ts", originalTypes);
    const typesTime = new Date("2026-06-18T02:31:00Z");
    utimesSync(join(root, "src/types/supabase.ts"), typesTime, typesTime);

    const result = spawnSync(process.execPath, ["scripts/check-types-freshness.cjs"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[types-freshness] OK");
  });

  it("does not require regenerated types for grants-only migrations", () => {
    const root = createRepoWithCommittedTypes();
    writeFixture(
      root,
      "supabase/migrations/20260618043532_harden_sync_events_api_grants.sql",
      [
        "-- Harden sync_events Data API grants to the minimum client surface.",
        "REVOKE ALL PRIVILEGES ON TABLE public.sync_events FROM anon;",
        "REVOKE ALL PRIVILEGES ON TABLE public.sync_events FROM authenticated;",
        "GRANT SELECT, INSERT ON TABLE public.sync_events TO authenticated;",
        "",
      ].join("\n"),
    );
    const typesTime = new Date("2026-06-18T02:31:00Z");
    utimesSync(join(root, "src/types/supabase.ts"), typesTime, typesTime);

    const migrationTime = new Date("2026-06-18T04:35:32Z");
    utimesSync(
      join(root, "supabase/migrations/20260618043532_harden_sync_events_api_grants.sql"),
      migrationTime,
      migrationTime,
    );

    const result = spawnSync(process.execPath, ["scripts/check-types-freshness.cjs"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[types-freshness] OK");
    expect(result.stdout).toContain("newest type-affecting migration");
  });

  it("does not require regenerated types for storage bucket metadata updates", () => {
    const root = createRepoWithCommittedTypes();
    writeFixture(
      root,
      "supabase/migrations/20260618130000_allow_encrypted_journal_media_storage.sql",
      [
        "-- Allow encrypted journal media payloads in private Storage buckets.",
        "UPDATE storage.buckets",
        "SET",
        "  file_size_limit = 1052672,",
        "  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/octet-stream']",
        "WHERE id = 'journal-photos';",
        "",
        "UPDATE storage.buckets",
        "SET",
        "  file_size_limit = 20975616,",
        "  allowed_mime_types = ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'application/octet-stream']",
        "WHERE id = 'journal-audio';",
        "",
      ].join("\n"),
    );
    const typesTime = new Date("2026-06-18T02:31:00Z");
    utimesSync(join(root, "src/types/supabase.ts"), typesTime, typesTime);

    const migrationTime = new Date("2026-06-18T13:00:00Z");
    utimesSync(
      join(root, "supabase/migrations/20260618130000_allow_encrypted_journal_media_storage.sql"),
      migrationTime,
      migrationTime,
    );

    const result = spawnSync(process.execPath, ["scripts/check-types-freshness.cjs"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("[types-freshness] OK");
    expect(result.stdout).toContain("20260618022951_index_advisor_foreign_keys.sql");
  });

});
