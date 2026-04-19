#!/usr/bin/env node
/**
 * check-types-freshness.cjs — Supabase type drift guard (tech-debt audit §10.9).
 *
 * Compares mtime of `src/types/supabase.ts` vs the newest `supabase/migrations/*.sql`.
 * Fails with exit 1 if types are older than the newest migration by more than
 * DRIFT_MAX_MINUTES (default 60). Zero-config: doesn't need Supabase auth — it
 * uses filesystem mtimes only.
 *
 * Rationale: runtime `column does not exist` errors on shipped mobile builds
 * cannot be hot-patched. Catch the drift locally before CI.
 *
 * Usage:
 *   node scripts/check-types-freshness.cjs           # exit 1 if drift > 60 min
 *   node scripts/check-types-freshness.cjs --minutes 1440   # allow 24h drift
 *   node scripts/check-types-freshness.cjs --print  # print snapshot, no exit
 *
 * Fix when failed:
 *   npx supabase gen types typescript --project-id <id> > src/types/supabase.ts
 *   git add src/types/supabase.ts && git commit -m "chore: regen supabase types"
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const TYPES = path.join(ROOT, "src/types/supabase.ts");
const MIGRATIONS_DIR = path.join(ROOT, "supabase/migrations");

/**
 * Return file timestamp (ms) preferring Git committer-time over filesystem mtime.
 * Rationale: after `git clone` (e.g. in CI), fs.statSync mtime is the clone
 * time, not the content's change time — making filesystem-mtime-based drift
 * checks useless in CI. Git committer-time survives clones.
 * Falls back to fs.statSync.mtimeMs if git metadata is unavailable (e.g. file
 * untracked or outside a working tree).
 */
function getContentTime(absFile) {
  try {
    const rel = path.relative(ROOT, absFile).replace(/\\/g, "/");
    const out = execSync(`git log -1 --format=%ct -- "${rel}"`, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    if (out) return parseInt(out, 10) * 1000;
  } catch {
    /* fall through to fs mtime */
  }
  try {
    return fs.statSync(absFile).mtimeMs;
  } catch {
    return 0;
  }
}

function newestMigrationMtime() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return { mtime: 0, file: null };
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => /\.sql$/.test(f));
  let newest = { mtime: 0, file: null };
  for (const f of files) {
    const t = getContentTime(path.join(MIGRATIONS_DIR, f));
    if (t > newest.mtime) newest = { mtime: t, file: f };
  }
  return newest;
}

function main() {
  const args = process.argv.slice(2);
  const minutesIdx = args.indexOf("--minutes");
  const driftMaxMinutes = minutesIdx >= 0 ? parseInt(args[minutesIdx + 1], 10) || 60 : 60;
  const printOnly = args.includes("--print");

  if (!fs.existsSync(TYPES)) {
    console.error(`[types-freshness] ERROR: ${path.relative(ROOT, TYPES)} not found.`);
    process.exit(2);
  }

  const typesMtime = getContentTime(TYPES);
  const newest = newestMigrationMtime();
  const driftMs = newest.mtime - typesMtime;
  const driftMinutes = Math.round(driftMs / 60_000);
  const thresholdMs = driftMaxMinutes * 60_000;

  const snapshot = {
    typesFile: path.relative(ROOT, TYPES),
    typesMtime: new Date(typesMtime).toISOString(),
    newestMigration: newest.file,
    newestMigrationMtime: newest.mtime > 0 ? new Date(newest.mtime).toISOString() : null,
    driftMinutes,
    thresholdMinutes: driftMaxMinutes,
    status: driftMs <= thresholdMs ? "fresh" : "stale",
    timeSource: "git-log-fallback-to-fs-mtime",
  };

  if (printOnly) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  if (driftMs <= thresholdMs) {
    console.log(
      `[types-freshness] OK — types ${driftMinutes >= 0 ? driftMinutes + "m older than" : -driftMinutes + "m newer than"} newest migration (${newest.file}). Threshold: ${driftMaxMinutes}m.`,
    );
    return;
  }

  console.error(
    `[types-freshness] FAIL — src/types/supabase.ts is ${driftMinutes} minutes older than supabase/migrations/${newest.file} (threshold ${driftMaxMinutes}m).`,
  );
  console.error("");
  console.error("  Fix:");
  console.error("    npx supabase gen types typescript --project-id <id> > src/types/supabase.ts");
  console.error("    git add src/types/supabase.ts && git commit -m 'chore: regen supabase types'");
  console.error("");
  console.error(`  Or raise threshold: node scripts/check-types-freshness.cjs --minutes ${driftMinutes + 5}`);
  process.exit(1);
}

main();
