#!/usr/bin/env node
"use strict";

/**
 * Applies the journal Magic Link redirect allow-list to hosted Supabase Auth.
 *
 * The script reads the current hosted Auth config, appends the required journal
 * reset callback URLs, and never prints tokens, private inboxes, or callback
 * URLs from the hosted project.
 */

const DEFAULT_MANAGEMENT_API_BASE_URL = "https://api.supabase.com/v1";
const {
  HOSTED_JOURNAL_REDIRECT_ALLOW_LIST_URLS,
  REQUIRED_JOURNAL_REDIRECT_URLS,
  inspectHostedAuthConfig,
  normalizeCsvList,
} = require("./check-journal-magic-link-live.cjs");

const PLACEHOLDERS = new Set([
  "todo",
  "changeme",
  "your-access-token",
  "your-project-ref",
  "set-in-shell-only",
]);

function line(status, message) {
  return "[supabase-auth-redirect-allow-list] " + status + " - " + message;
}

function isPlaceholderValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return true;
  const normalized = raw.toLowerCase();
  return (
    PLACEHOLDERS.has(normalized) ||
    /^<[^>]+>$/.test(raw) ||
    normalized.startsWith("your-") ||
    normalized.startsWith("your_") ||
    normalized.includes("placeholder")
  );
}

function addMissingOrPlaceholder(errors, env, key) {
  if (isPlaceholderValue(env[key])) errors.push(key + " is missing or placeholder");
}

function normalizeBoolean(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function getHostedRedirectUrls(config) {
  const candidate =
    config.uri_allow_list ||
    config.URI_ALLOW_LIST ||
    config.additional_redirect_urls ||
    config.ADDITIONAL_REDIRECT_URLS ||
    config.redirect_urls;
  return normalizeCsvList(candidate);
}

function uniqueUrls(urls) {
  const seen = new Set();
  const result = [];
  for (const rawUrl of urls) {
    const url = String(rawUrl || "").trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    result.push(url);
  }
  return result;
}

function compactJournalRedirectUrls(urls) {
  const redundantExactUrls = new Set(
    REQUIRED_JOURNAL_REDIRECT_URLS.filter((url) => !HOSTED_JOURNAL_REDIRECT_ALLOW_LIST_URLS.includes(url)),
  );
  return urls.filter((url) => !redundantExactUrls.has(url));
}

function buildRedirectAllowListPatch({ env = process.env, currentConfig = {} } = {}) {
  const errors = [];
  addMissingOrPlaceholder(errors, env, "SUPABASE_ACCESS_TOKEN");
  addMissingOrPlaceholder(errors, env, "SUPABASE_PROJECT_REF");

  if (!normalizeBoolean(env.ZENFLOW_AUTH_REDIRECT_ALLOW_LIST_CONFIRM_PRODUCTION)) {
    errors.push("ZENFLOW_AUTH_REDIRECT_ALLOW_LIST_CONFIRM_PRODUCTION must be true before applying hosted redirect URLs");
  }

  const currentUrls = compactJournalRedirectUrls(getHostedRedirectUrls(currentConfig));
  const mergedUrls = uniqueUrls([...currentUrls, ...HOSTED_JOURNAL_REDIRECT_ALLOW_LIST_URLS]);
  const patch = { uri_allow_list: mergedUrls.join(",") };

  return {
    errors,
    projectRef: String(env.SUPABASE_PROJECT_REF || "").trim(),
    token: String(env.SUPABASE_ACCESS_TOKEN || "").trim(),
    addedCount: mergedUrls.length - uniqueUrls(currentUrls).length,
    totalCount: mergedUrls.length,
    patch,
  };
}

function formatValidationErrors(errors) {
  return errors.map((error) => line("UNVERIFIED", error));
}

function sanitizeSupabaseErrorText(text) {
  return String(text || "")
    .replace(/sbp_[A-Za-z0-9_.-]{12,}/g, "<supabase-token>")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "<email>")
    .replace(/https?:\/\/[^\s"'<>]+/g, "<url>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
}

async function readAuthConfig(endpoint, headers, fetchImpl) {
  const response = await fetchImpl(endpoint, {
    method: "GET",
    headers: { Authorization: headers.Authorization, Accept: headers.Accept },
  });
  const text = await response.text();
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      body: null,
      message: "Supabase Auth config GET returned HTTP " + response.status + (text ? ": " + sanitizeSupabaseErrorText(text) : ""),
    };
  }
  try {
    return { ok: true, status: response.status, body: JSON.parse(text), message: "" };
  } catch {
    return { ok: false, status: response.status, body: null, message: "Supabase Auth config GET returned non-JSON config" };
  }
}

async function applySupabaseAuthRedirectAllowList({ env = process.env, dryRun = true, fetchImpl = fetch } = {}) {
  const preflight = buildRedirectAllowListPatch({ env, currentConfig: {} });
  if (preflight.errors.length > 0) {
    return { status: "UNVERIFIED", lines: formatValidationErrors(preflight.errors) };
  }

  const endpoint = DEFAULT_MANAGEMENT_API_BASE_URL + "/projects/" + encodeURIComponent(preflight.projectRef) + "/config/auth";
  const headers = {
    Authorization: "Bearer " + preflight.token,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  const currentConfig = await readAuthConfig(endpoint, headers, fetchImpl);
  if (!currentConfig.ok) {
    return { status: "UNVERIFIED", lines: [line("UNVERIFIED", currentConfig.message)] };
  }

  const packet = buildRedirectAllowListPatch({ env, currentConfig: currentConfig.body || {} });
  if (packet.errors.length > 0) {
    return { status: "UNVERIFIED", lines: formatValidationErrors(packet.errors) };
  }

  if (dryRun) {
    return {
      status: "PASS",
      lines: [
        line("DRY-RUN", "would add " + packet.addedCount + " hosted journal redirect URL(s); total allow-list size " + packet.totalCount),
        line("PASS", "validated Supabase Auth redirect allow-list patch packet"),
      ],
    };
  }

  const patchResponse = await fetchImpl(endpoint, {
    method: "PATCH",
    headers,
    body: JSON.stringify(packet.patch),
  });
  if (!patchResponse.ok) {
    let errorText = "";
    try {
      errorText = await patchResponse.text();
    } catch {
      errorText = "";
    }
    return {
      status: "FAIL",
      lines: [
        line(
          "FAIL",
          "Supabase Management API rejected Auth redirect allow-list patch with HTTP " +
            patchResponse.status +
            (errorText ? ": " + sanitizeSupabaseErrorText(errorText) : ""),
        ),
      ],
    };
  }

  const verifiedConfig = await readAuthConfig(endpoint, headers, fetchImpl);
  if (!verifiedConfig.ok) {
    return { status: "UNVERIFIED", lines: [line("UNVERIFIED", verifiedConfig.message)] };
  }

  const failures = inspectHostedAuthConfig(verifiedConfig.body || {}, { requireCustomSmtp: false }).filter((failure) =>
    failure.includes("Missing hosted journal Magic Link redirect URL"),
  );
  if (failures.length > 0) {
    return { status: "UNVERIFIED", lines: [line("UNVERIFIED", "Supabase Auth redirect allow-list still misses " + failures.length + " journal URL(s)")] };
  }

  return {
    status: "PASS",
    lines: [
      line("APPLY", "patched Supabase Auth redirect allow-list"),
      line("PASS", "verified hosted journal Magic Link redirect allow-list"),
    ],
  };
}

function parseArgs(argv) {
  return {
    dryRun: argv.includes("--dry-run") || !argv.includes("--apply"),
  };
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2));
  const result = await applySupabaseAuthRedirectAllowList({ env: process.env, dryRun });
  for (const outputLine of result.lines) console.log(outputLine);
  process.exit(result.status === "PASS" ? 0 : result.status === "FAIL" ? 1 : 2);
}

if (require.main === module) {
  main().catch(() => {
    console.log(line("FAIL", "unexpected Supabase Auth redirect allow-list bootstrap failure"));
    process.exit(1);
  });
}

module.exports = {
  applySupabaseAuthRedirectAllowList,
  buildRedirectAllowListPatch,
  formatValidationErrors,
  getHostedRedirectUrls,
  sanitizeSupabaseErrorText,
};
