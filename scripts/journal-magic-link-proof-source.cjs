#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const JOURNAL_MAGIC_LINK_PROOF_SOURCE_FILES = [
  ".github/workflows/journal-magic-link-live-proof.yml",
  "package.json",
  "scripts/apply-supabase-auth-magic-link-template.cjs",
  "scripts/apply-supabase-auth-redirect-allow-list.cjs",
  "scripts/apply-supabase-auth-smtp.cjs",
  "scripts/check-github-journal-magic-link-secrets.cjs",
  "scripts/check-journal-magic-link-live.cjs",
  "scripts/check-journal-magic-link-proof-status.cjs",
  "scripts/journal-magic-link-proof-source.cjs",
  "scripts/write-journal-magic-link-proof-status.cjs",
  "src/App.tsx",
  "src/components/auth/JournalMagicLinkConfirmGate.tsx",
  "src/features/journal/JournalLockScreen.tsx",
  "src/features/journal/JournalModule.tsx",
  "src/hooks/useAuthSession.ts",
  "src/hooks/useDeepLinkHandler.ts",
  "src/i18n/languages/ar.ts",
  "src/i18n/languages/de.ts",
  "src/i18n/languages/en.ts",
  "src/i18n/languages/es.ts",
  "src/i18n/languages/fr.ts",
  "src/i18n/languages/he.ts",
  "src/i18n/languages/ja.ts",
  "src/i18n/languages/uk.ts",
  "src/i18n/types.ts",
  "src/lib/authRedirect.ts",
  "src/lib/journalMagicLinkConfirmation.ts",
  "src/lib/journalPasswordResetHandoff.ts",
].sort((left, right) => left.localeCompare(right));

function computeJournalMagicLinkProofSourceSha256(rootDir = ROOT) {
  const digest = crypto.createHash("sha256");
  digest.update("zenflow-journal-magic-link-proof-source/v1\0");

  for (const relativePath of JOURNAL_MAGIC_LINK_PROOF_SOURCE_FILES) {
    const absolutePath = path.join(rootDir, relativePath);
    digest.update(`${relativePath}\0`);
    if (!fs.existsSync(absolutePath)) {
      digest.update("MISSING\0");
      continue;
    }
    const stat = fs.lstatSync(absolutePath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`Journal Magic Link proof source must be a regular file: ${relativePath}`);
    }
    const bytes = fs.readFileSync(absolutePath);
    digest.update(`${bytes.byteLength}\0`);
    digest.update(bytes);
    digest.update("\0");
  }

  return digest.digest("hex");
}

module.exports = {
  JOURNAL_MAGIC_LINK_PROOF_SOURCE_FILES,
  computeJournalMagicLinkProofSourceSha256,
};
