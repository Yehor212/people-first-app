#!/usr/bin/env node
"use strict";

/**
 * Provision the dedicated same-account sync smoke user and GitHub secrets.
 *
 * Safety model:
 * - dry-run by default;
 * - requires a server-only Supabase service-role key for Auth Admin calls;
 * - never prints passwords, service-role keys, or anon keys;
 * - refuses likely real-user emails unless explicitly overridden;
 * - writes GitHub secrets through stdin, not command arguments.
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { createClient } = require("@supabase/supabase-js");
const { evidenceFailureCode } = require("./lib/diagnostic-evidence-privacy.cjs");

const ROOT = path.join(__dirname, "..");
const APPLY = process.env.ZENFLOW_SYNC_TEST_ACCOUNT_APPLY === "true";
const SET_GITHUB_SECRETS = process.env.ZENFLOW_SYNC_TEST_SET_GITHUB_SECRETS === "true";
const ALLOW_NON_SMOKE_EMAIL = process.env.ZENFLOW_SYNC_TEST_ALLOW_NON_SMOKE_EMAIL === "true";

function loadEnvFile(file) {
  const target = path.join(ROOT, file);
  if (!fs.existsSync(target)) return;

  for (const line of fs.readFileSync(target, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env.production");

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.ZENFLOW_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY;
const email = process.env.ZENFLOW_SYNC_TEST_EMAIL;
const providedPassword = process.env.ZENFLOW_SYNC_TEST_PASSWORD;
const password = providedPassword || crypto.randomBytes(32).toString("base64url");

function log(status, message) {
  console.log(`[sync-test-account] ${status} - ${message}`);
}

function fail(message, error) {
  console.error(`[sync-test-account] FAIL - ${message}`);
  if (error) console.error(`[sync-test-account] code=${evidenceFailureCode(error)}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    ...options,
  });
}

function resolveRepo() {
  if (process.env.ZENFLOW_GITHUB_REPO) return process.env.ZENFLOW_GITHUB_REPO;

  const repoView = run("gh", ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]);
  if (repoView.status === 0 && repoView.stdout.trim()) return repoView.stdout.trim();

  const origin = run("git", ["remote", "get-url", "origin"], { cwd: ROOT });
  if (origin.status !== 0) return "";

  const raw = origin.stdout.trim();
  const httpsMatch = raw.match(/github\.com[:/](.+?)(?:\.git)?$/i);
  return httpsMatch ? httpsMatch[1] : "";
}

function assertSafeEmail(value) {
  if (!value) fail("ZENFLOW_SYNC_TEST_EMAIL is required");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) fail("ZENFLOW_SYNC_TEST_EMAIL is not a valid email");
  if (ALLOW_NON_SMOKE_EMAIL) return;

  const lower = value.toLowerCase();
  const looksDedicated =
    lower.includes("sync") ||
    lower.includes("smoke") ||
    lower.includes("test") ||
    lower.includes("ci") ||
    lower.includes("zenflow");

  if (!looksDedicated) {
    fail(
      "refusing to use an email that does not look like a dedicated sync smoke account; set ZENFLOW_SYNC_TEST_ALLOW_NON_SMOKE_EMAIL=true only if this is intentional"
    );
  }
}

function setGitHubSecret(repo, name, value) {
  const result = run("gh", ["secret", "set", name, "--repo", repo], {
    input: value,
  });
  if (result.status !== 0) {
    fail(`could not set GitHub secret ${name}`, result.error || new Error("secret-write-failed"));
  }
}

async function findUserByEmail(admin, targetEmail) {
  const perPage = 1000;
  let page = 1;

  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users || [];
    const match = users.find((user) => user.email?.toLowerCase() === targetEmail.toLowerCase());
    if (match) return match;
    if (users.length < perPage) return null;
    page += 1;
  }

  throw new Error("could not scan auth users safely within 10 pages");
}

async function verifySignIn() {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.user?.id) throw new Error("sign-in returned no user");
  await client.auth.signOut();
}

async function runAccountSmoke() {
  const smoke = run("node", ["scripts/smoke-sync-account.cjs"], {
    cwd: ROOT,
    env: {
      ...process.env,
      ZENFLOW_SYNC_TEST_EMAIL: email,
      ZENFLOW_SYNC_TEST_PASSWORD: password,
      ZENFLOW_SYNC_ACCOUNT_REQUIRED: "true",
    },
  });

  if (smoke.status !== 0) fail("same-account sync smoke failed", smoke.error || new Error("sync-smoke-failed"));
  log("PASS", "same-account sync smoke completed");
}

async function main() {
  if (!supabaseUrl || !supabaseAnonKey) fail("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required");
  assertSafeEmail(email);

  if (!APPLY) {
    log(
      "DRY-RUN",
      "set ZENFLOW_SYNC_TEST_ACCOUNT_APPLY=true with a server-only SUPABASE_SERVICE_ROLE_KEY to create/update the dedicated test account"
    );
    log("DRY-RUN", SET_GITHUB_SECRETS ? "GitHub secret write requested but skipped in dry-run" : "GitHub secret write not requested");
    return;
  }

  if (!serviceRoleKey) {
    fail("SUPABASE_SERVICE_ROLE_KEY is required for Auth Admin provisioning and must stay server-only");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const existing = await findUserByEmail(admin, email);
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: {
        ...(existing.user_metadata || {}),
        zenflow_sync_smoke: true,
      },
    });
    if (error) throw error;
    log("PASS", "dedicated sync test account exists and password was refreshed");
  } else {
    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { zenflow_sync_smoke: true },
    });
    if (error) throw error;
    log("PASS", "dedicated sync test account created");
  }

  await verifySignIn();
  log("PASS", "dedicated sync test account can sign in");

  await runAccountSmoke();

  if (SET_GITHUB_SECRETS) {
    const repo = resolveRepo();
    if (!repo) fail("could not resolve GitHub repository for secret write");
    setGitHubSecret(repo, "ZENFLOW_SYNC_TEST_EMAIL", email);
    setGitHubSecret(repo, "ZENFLOW_SYNC_TEST_PASSWORD", password);
    log("PASS", "GitHub secret names updated for the configured repository");
  } else if (!providedPassword) {
    log(
      "UNVERIFIED",
      "password was generated for this process only; set ZENFLOW_SYNC_TEST_SET_GITHUB_SECRETS=true to persist it as a GitHub secret"
    );
  }
}

main().catch((error) => fail("unexpected setup error", error));
