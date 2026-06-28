"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_RLS_EVIDENCE_FILE = "supabase/migrations/20260420055001_authenticated_scope_rls.sql";
const REQUIRED_USER_RLS = [
  { table: "profiles", ownerColumn: "id", mutationGuard: false },
  { table: "moods", ownerColumn: "user_id", mutationGuard: true },
  { table: "habits", ownerColumn: "user_id", mutationGuard: true },
  { table: "habit_completions", ownerColumn: "user_id", mutationGuard: true },
  { table: "habit_reminders", ownerColumn: "user_id", mutationGuard: true },
  { table: "focus_sessions", ownerColumn: "user_id", mutationGuard: true },
  { table: "gratitude_entries", ownerColumn: "user_id", mutationGuard: true },
  { table: "journal_entries", ownerColumn: "user_id", mutationGuard: true },
  { table: "journal_photos", ownerColumn: "user_id", mutationGuard: true },
  { table: "journal_audio", ownerColumn: "user_id", mutationGuard: true },
  { table: "user_settings", ownerColumn: "user_id", mutationGuard: true },
  { table: "user_data", ownerColumn: "user_id", mutationGuard: true },
  { table: "push_subscriptions", ownerColumn: "user_id", mutationGuard: true },
  { table: "push_device_tokens", ownerColumn: "user_id", mutationGuard: true },
  { table: "user_inner_world", ownerColumn: "user_id", mutationGuard: true },
  { table: "user_reminder_settings", ownerColumn: "user_id", mutationGuard: true },
  { table: "sync_events", ownerColumn: "user_id", mutationGuard: true },
  { table: "journal_embeddings", ownerColumn: "user_id", mutationGuard: true },
];
const REQUIRED_STORAGE_BUCKETS = ["journal-photos", "journal-audio"];

function normalizeSql(sql) {
  return sql
    .replace(/--.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function resolveProjectPath(rootDir, relativePath) {
  const target = path.resolve(rootDir, relativePath || DEFAULT_RLS_EVIDENCE_FILE);
  if (!target.startsWith(rootDir + path.sep)) {
    return null;
  }
  return target;
}

function getPolicyBlocks(sql, tableName) {
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean)
    .filter((statement) => {
      const normalized = normalizeSql(statement);
      return normalized.includes("create policy") &&
        (normalized.includes(" on public." + tableName + " ") || normalized.includes(" on " + tableName + " "));
    })
    .map((statement) => statement + ";");
}

function hasOwnerPredicate(block, ownerColumn) {
  const normalized = normalizeSql(block);
  const authUidForms = ["(select auth.uid())", "select auth.uid()", "auth.uid()"];
  return authUidForms.some((authUid) =>
    normalized.includes(ownerColumn + " = " + authUid) || normalized.includes(authUid + " = " + ownerColumn)
  );
}

function hasStorageOwnerPredicate(block, bucketName) {
  const normalized = normalizeSql(block);
  return normalized.includes("to authenticated") &&
    normalized.includes("bucket_id = '" + bucketName + "'") &&
    normalized.includes("storage.foldername(name)") &&
    normalized.includes("auth.uid()");
}

function checkSupabaseRlsEvidence(rootDir, evidenceFile = process.env.ZENFLOW_SUPABASE_RLS_EVIDENCE_FILE) {
  const relativeFile = evidenceFile || DEFAULT_RLS_EVIDENCE_FILE;
  const target = resolveProjectPath(rootDir, relativeFile);
  if (!target || !fs.existsSync(target)) {
    return {
      ok: false,
      file: relativeFile,
      reason: "RLS evidence file is missing or outside the project",
      missing: [relativeFile],
    };
  }

  const sql = fs.readFileSync(target, "utf8");
  const missing = [];

  for (const requirement of REQUIRED_USER_RLS) {
    const blocks = getPolicyBlocks(sql, requirement.table).map(normalizeSql);
    const scopedBlocks = blocks.filter((block) => block.includes("to authenticated"));
    const ownerBlocks = scopedBlocks.filter((block) => hasOwnerPredicate(block, requirement.ownerColumn));
    const hasReadGuard = ownerBlocks.some((block) => block.includes("using"));
    const hasWriteGuard = !requirement.mutationGuard || ownerBlocks.some((block) => block.includes("with check"));

    if (!hasReadGuard || !hasWriteGuard) {
      missing.push(requirement.table);
    }
  }

  const storageBlocks = sql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean)
    .filter((statement) => {
      const normalized = normalizeSql(statement);
      return normalized.includes("create policy") && normalized.includes(" on storage.objects ");
    })
    .map((statement) => statement + ";");
  for (const bucket of REQUIRED_STORAGE_BUCKETS) {
    if (!storageBlocks.some((block) => hasStorageOwnerPredicate(block, bucket))) {
      missing.push("storage.objects:" + bucket);
    }
  }

  return {
    ok: missing.length === 0,
    file: relativeFile,
    reason: missing.length === 0
      ? "Authenticated RLS ownership evidence found for public browser key surfaces"
      : "Authenticated RLS ownership evidence is incomplete",
    missing,
  };
}

module.exports = {
  DEFAULT_RLS_EVIDENCE_FILE,
  checkSupabaseRlsEvidence,
};
