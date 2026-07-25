#!/usr/bin/env node
"use strict";

/**
 * Applies a scanner-safe Supabase Auth Magic Link template.
 *
 * The email opens ZenFlow with a token hash in the URL fragment. ZenFlow only
 * exchanges that hash after the user presses the confirmation button in-app,
 * so mailbox link previews cannot consume the one-time token.
 */

const DEFAULT_MANAGEMENT_API_BASE_URL = "https://api.supabase.com/v1";
const PLACEHOLDERS = new Set([
  "todo",
  "changeme",
  "your-access-token",
  "your-project-ref",
  "set-in-shell-only",
]);

const MAGIC_LINK_SUBJECT = "Confirm your ZenFlow email link";
const MAGIC_LINK_TEMPLATE = [
  "<h2>Confirm this ZenFlow email link</h2>",
  "<p>Use the button below to continue in ZenFlow. No diary setting changes until you confirm inside the app.</p>",
  '<p><a href="{{ .RedirectTo }}#zenflowConfirm=1&amp;token_hash={{ .TokenHash }}&amp;type=email">Continue in ZenFlow</a></p>',
  "<p>If you did not request this email, you can ignore it.</p>",
].join("\n");

function line(status, message) {
  return "[supabase-auth-magic-link-template] " + status + " - " + message;
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

function normalizeBoolean(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function buildMagicLinkTemplatePatch(env = process.env) {
  const errors = [];
  if (isPlaceholderValue(env.SUPABASE_ACCESS_TOKEN)) {
    errors.push("SUPABASE_ACCESS_TOKEN is missing or placeholder");
  }
  if (isPlaceholderValue(env.SUPABASE_PROJECT_REF)) {
    errors.push("SUPABASE_PROJECT_REF is missing or placeholder");
  }
  if (!normalizeBoolean(env.ZENFLOW_AUTH_MAGIC_LINK_TEMPLATE_CONFIRM_PRODUCTION)) {
    errors.push(
      "ZENFLOW_AUTH_MAGIC_LINK_TEMPLATE_CONFIRM_PRODUCTION must be true before applying the hosted template",
    );
  }

  return {
    errors,
    projectRef: String(env.SUPABASE_PROJECT_REF || "").trim(),
    token: String(env.SUPABASE_ACCESS_TOKEN || "").trim(),
    patch: {
      mailer_subjects_magic_link: MAGIC_LINK_SUBJECT,
      mailer_templates_magic_link_content: MAGIC_LINK_TEMPLATE,
    },
  };
}

function inspectHostedMagicLinkTemplate(config) {
  const html = String(config?.mailer_templates_magic_link_content || "");
  const scannerSafe =
    html.includes("{{ .RedirectTo }}#zenflowConfirm=1") &&
    html.includes("token_hash={{ .TokenHash }}") &&
    html.includes("type=email") &&
    !html.includes("{{ .ConfirmationURL }}");

  return scannerSafe ? [] : ["Hosted Magic Link template is not scanner-safe"];
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

async function readHostedAuthConfig(endpoint, authorization, fetchImpl) {
  const response = await fetchImpl(endpoint, {
    method: "GET",
    headers: { Authorization: authorization, Accept: "application/json" },
  });
  const text = await response.text();
  if (!response.ok) {
    return {
      ok: false,
      body: null,
      message:
        "Supabase Auth config GET returned HTTP " +
        response.status +
        (text ? ": " + sanitizeSupabaseErrorText(text) : ""),
    };
  }

  try {
    return { ok: true, body: JSON.parse(text), message: "" };
  } catch {
    return {
      ok: false,
      body: null,
      message: "Supabase Auth config GET returned non-JSON config",
    };
  }
}

async function applySupabaseAuthMagicLinkTemplate({
  env = process.env,
  dryRun = true,
  fetchImpl = fetch,
} = {}) {
  const packet = buildMagicLinkTemplatePatch(env);
  if (packet.errors.length > 0) {
    return {
      status: "UNVERIFIED",
      lines: packet.errors.map((error) => line("UNVERIFIED", error)),
    };
  }

  if (dryRun) {
    return {
      status: "PASS",
      lines: [
        line("DRY-RUN", "would PATCH the hosted scanner-safe Magic Link template"),
        line("PASS", "validated the Magic Link template patch packet"),
      ],
    };
  }

  const endpoint =
    DEFAULT_MANAGEMENT_API_BASE_URL +
    "/projects/" +
    encodeURIComponent(packet.projectRef) +
    "/config/auth";
  const authorization = "Bearer " + packet.token;
  const patchResponse = await fetchImpl(endpoint, {
    method: "PATCH",
    headers: {
      Authorization: authorization,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
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
          "Supabase Management API rejected the Magic Link template with HTTP " +
            patchResponse.status +
            (errorText ? ": " + sanitizeSupabaseErrorText(errorText) : ""),
        ),
      ],
    };
  }

  const hosted = await readHostedAuthConfig(endpoint, authorization, fetchImpl);
  if (!hosted.ok) {
    return { status: "UNVERIFIED", lines: [line("UNVERIFIED", hosted.message)] };
  }

  const failures = inspectHostedMagicLinkTemplate(hosted.body || {});
  if (failures.length > 0) {
    return {
      status: "UNVERIFIED",
      lines: failures.map((failure) => line("UNVERIFIED", failure)),
    };
  }

  return {
    status: "PASS",
    lines: [
      line("APPLY", "patched the hosted Supabase Auth Magic Link template"),
      line("PASS", "verified the hosted scanner-safe Magic Link template"),
    ],
  };
}

function parseArgs(argv) {
  return { dryRun: argv.includes("--dry-run") || !argv.includes("--apply") };
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2));
  const result = await applySupabaseAuthMagicLinkTemplate({ env: process.env, dryRun });
  for (const outputLine of result.lines) console.log(outputLine);
  process.exit(result.status === "PASS" ? 0 : result.status === "FAIL" ? 1 : 2);
}

if (require.main === module) {
  main().catch(() => {
    console.log(line("FAIL", "unexpected Magic Link template bootstrap failure"));
    process.exit(1);
  });
}

module.exports = {
  applySupabaseAuthMagicLinkTemplate,
  buildMagicLinkTemplatePatch,
  inspectHostedMagicLinkTemplate,
  sanitizeSupabaseErrorText,
};
