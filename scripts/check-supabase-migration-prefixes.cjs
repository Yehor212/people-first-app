#!/usr/bin/env node
"use strict";

/**
 * check-supabase-migration-prefixes.cjs
 *
 * Root cause:
 * Supabase migration history compares only the numeric version/timestamp prefix.
 * Historical ZenFlow migrations used date-only prefixes (YYYYMMDD), and some
 * dates were reused for multiple files. That makes local file history ambiguous
 * versus remote `supabase_migrations.schema_migrations`.
 *
 * This guard does two things:
 * 1. Allows the already-known historical duplicate groups unchanged.
 * 2. Fails if any new duplicate prefix is introduced.
 *
 * It does NOT rewrite history. It protects the repository from making the
 * existing migration debt worse.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");

const LEGACY_DUPLICATE_GROUPS = {
  "20260113": [
    "20260113_challenges_badges.sql",
    "20260113_initial_schema.sql",
  ],
  "20260125": [
    "20260125_app_config.sql",
    "20260125_feedback.sql",
    "20260125_leaderboards.sql",
    "20260125_user_settings.sql",
  ],
  "20260201": [
    "20260201_friend_challenges.sql",
    "20260201_reminder_settings_times.sql",
  ],
  "20260203": [
    "20260203_remaining_security_fixes.sql",
    "20260203_security_fixes_friend_challenges.sql",
  ],
  "20260215": [
    "20260215_journal_cloud_sync.sql",
    "20260215_journal_storage_buckets.sql",
    "20260215_pgvector_journal.sql",
  ],
  "20260307": [
    "20260307_fix_get_user_stats.sql",
    "20260307_push_tables.sql",
  ],
  "20260311": [
    "20260311_fix_reminder_inner_world.sql",
    "20260311_fix_user_settings.sql",
  ],
  "20260314": [
    "20260314_data_integrity.sql",
    "20260314_index_optimization.sql",
    "20260314_security_hardening.sql",
  ],
};

function sortStrings(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function main() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error("[supabase-migration-prefixes] ERROR: supabase/migrations not found.");
    process.exit(2);
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  const groups = new Map();
  for (const file of files) {
    const underscoreIndex = file.indexOf("_");
    if (underscoreIndex === -1) {
      console.error(
        `[supabase-migration-prefixes] FAIL: migration file has no numeric prefix: ${file}`,
      );
      process.exit(1);
    }

    const prefix = file.slice(0, underscoreIndex);
    if (!groups.has(prefix)) groups.set(prefix, []);
    groups.get(prefix).push(file);
  }

  const errors = [];
  const legacyMatches = [];

  for (const [prefix, prefixedFiles] of groups.entries()) {
    if (prefixedFiles.length <= 1) continue;

    const expectedLegacy = LEGACY_DUPLICATE_GROUPS[prefix];
    const actual = sortStrings(prefixedFiles);

    if (!expectedLegacy) {
      errors.push(
        `Unexpected duplicate migration prefix "${prefix}": ${actual.join(", ")}`,
      );
      continue;
    }

    const expected = sortStrings(expectedLegacy);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      errors.push(
        `Legacy duplicate group "${prefix}" changed.\n` +
          `  Expected: ${expected.join(", ")}\n` +
          `  Actual:   ${actual.join(", ")}`,
      );
      continue;
    }

    legacyMatches.push(`${prefix} (${actual.length} files)`);
  }

  if (errors.length > 0) {
    console.error("[supabase-migration-prefixes] FAIL");
    console.error("");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    console.error("");
    console.error("Fix:");
    console.error("- Do not create another migration with a reused date prefix.");
    console.error("- Prefer `supabase migration new <name>` so the CLI generates a unique timestamp.");
    console.error("- If the schema was changed remotely, run `supabase db pull` before creating new local migrations.");
    process.exit(1);
  }

  console.log(
    `[supabase-migration-prefixes] OK — ${files.length} migration files scanned; ` +
      `${legacyMatches.length} known legacy duplicate groups unchanged.`,
  );
  if (legacyMatches.length > 0) {
    console.log(`[supabase-migration-prefixes] Legacy groups: ${legacyMatches.join(", ")}`);
  }
}

main();
