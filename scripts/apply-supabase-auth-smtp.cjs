#!/usr/bin/env node
"use strict";

/**
 * Applies Supabase Auth custom SMTP settings through the Management API.
 *
 * Values are read from environment variables and never printed. The script
 * defaults to dry-run unless --apply is present, and requires an explicit
 * production confirmation before building a patch packet.
 */

const DEFAULT_MANAGEMENT_API_BASE_URL = "https://api.supabase.com/v1";
const MIN_EMAIL_SEND_RATE_LIMIT_PER_HOUR = 30;
const PLACEHOLDERS = new Set([
  "todo",
  "changeme",
  "your-access-token",
  "your-project-ref",
  "your-smtp-host",
  "smtp.example.com",
  "your-smtp-user",
  "your-smtp-password",
  "your-api-key",
  "set-in-shell-only",
]);

function line(status, message) {
  return "[supabase-auth-smtp] " + status + " - " + message;
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

function isValidEmail(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email || ""));
}

function isValidHost(host) {
  const raw = String(host || "").trim();
  if (!raw || raw.includes("://") || raw.includes("/") || raw.includes("?") || raw.includes("#")) return false;
  return /^[A-Za-z0-9.-]+$/.test(raw) && raw.includes(".");
}

function parsePort(value) {
  const port = Number(String(value || "").trim());
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : 0;
}

function normalizeBoolean(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function addMissingOrPlaceholder(errors, env, key) {
  if (isPlaceholderValue(env[key])) errors.push(key + " is missing or placeholder");
}

function buildSmtpPatchPacket(env = process.env) {
  const errors = [];
  addMissingOrPlaceholder(errors, env, "SUPABASE_ACCESS_TOKEN");
  addMissingOrPlaceholder(errors, env, "SUPABASE_PROJECT_REF");
  addMissingOrPlaceholder(errors, env, "ZENFLOW_AUTH_SMTP_HOST");
  addMissingOrPlaceholder(errors, env, "ZENFLOW_AUTH_SMTP_USER");
  addMissingOrPlaceholder(errors, env, "ZENFLOW_AUTH_SMTP_PASS");
  addMissingOrPlaceholder(errors, env, "ZENFLOW_AUTH_SMTP_SENDER_NAME");

  if (!normalizeBoolean(env.ZENFLOW_AUTH_SMTP_CONFIRM_PRODUCTION)) {
    errors.push("ZENFLOW_AUTH_SMTP_CONFIRM_PRODUCTION must be true before applying production SMTP");
  }

  const adminEmail = String(env.ZENFLOW_AUTH_SMTP_ADMIN_EMAIL || "").trim();
  if (!isValidEmail(adminEmail)) errors.push("ZENFLOW_AUTH_SMTP_ADMIN_EMAIL must be a valid From email address");

  const host = String(env.ZENFLOW_AUTH_SMTP_HOST || "").trim();
  if (host && !isValidHost(host)) {
    errors.push(host.includes("://") ? "ZENFLOW_AUTH_SMTP_HOST must be a hostname, not a URL" : "ZENFLOW_AUTH_SMTP_HOST must be a valid hostname");
  }

  const port = parsePort(env.ZENFLOW_AUTH_SMTP_PORT);
  if (!port) errors.push("ZENFLOW_AUTH_SMTP_PORT must be an integer from 1 to 65535");

  const patch = {
    external_email_enabled: true,
    mailer_secure_email_change_enabled: true,
    mailer_autoconfirm: false,
    smtp_admin_email: adminEmail,
    smtp_host: host,
    smtp_port: String(port),
    smtp_user: String(env.ZENFLOW_AUTH_SMTP_USER || "").trim(),
    smtp_pass: String(env.ZENFLOW_AUTH_SMTP_PASS || "").trim(),
    smtp_sender_name: String(env.ZENFLOW_AUTH_SMTP_SENDER_NAME || "").trim(),
    rate_limit_email_sent: MIN_EMAIL_SEND_RATE_LIMIT_PER_HOUR,
  };

  return { errors, projectRef: String(env.SUPABASE_PROJECT_REF || "").trim(), token: String(env.SUPABASE_ACCESS_TOKEN || "").trim(), patch };
}

function formatValidationErrors(errors) {
  return errors.map((error) => line("UNVERIFIED", error));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function redactLiteral(text, value, replacement) {
  const raw = String(value || "").trim();
  if (!raw || isPlaceholderValue(raw)) return text;
  return text.replace(new RegExp(escapeRegExp(raw), "gi"), replacement);
}

function sanitizeSupabaseErrorText(text, env = process.env) {
  let sanitized = String(text || "").trim();
  if (!sanitized) return "";

  const redactions = [
    ["SUPABASE_ACCESS_TOKEN", "<supabase-token>"],
    ["ZENFLOW_AUTH_SMTP_ADMIN_EMAIL", "<smtp-admin-email>"],
    ["ZENFLOW_AUTH_SMTP_HOST", "<smtp-host>"],
    ["ZENFLOW_AUTH_SMTP_USER", "<smtp-user>"],
    ["ZENFLOW_AUTH_SMTP_PASS", "<smtp-password>"],
    ["ZENFLOW_AUTH_SMTP_SENDER_NAME", "<smtp-sender-name>"],
  ];

  for (const [key, replacement] of redactions) {
    sanitized = redactLiteral(sanitized, env[key], replacement);
  }

  sanitized = sanitized
    .replace(/sbp_[A-Za-z0-9_.-]{12,}/g, "<supabase-token>")
    .replace(/re_[A-Za-z0-9_.-]{8,}/g, "<smtp-password>")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "<email>")
    .replace(/https?:\/\/[^\s"'<>]+/g, "<url>")
    .replace(/\s+/g, " ")
    .trim();

  return sanitized.slice(0, 600);
}
function hasCustomSmtp(config) {
  if (!config || typeof config !== "object") return false;
  const host = config.smtp_host || config.mailer_smtp_host || config.SMTP_HOST || config.MAILER_SMTP_HOST;
  const identity =
    config.smtp_user ||
    config.mailer_smtp_user ||
    config.SMTP_USER ||
    config.MAILER_SMTP_USER ||
    config.smtp_admin_email ||
    config.MAILER_SMTP_ADMIN_EMAIL ||
    config.smtp_sender_name ||
    config.SMTP_SENDER_NAME;
  return Boolean(host && identity);
}

function hasProductionEmailSendRateLimit(config) {
  if (!config || typeof config !== "object") return false;
  const value = Number(config.rate_limit_email_sent || config.RATE_LIMIT_EMAIL_SENT || 0);
  return Number.isFinite(value) && value >= MIN_EMAIL_SEND_RATE_LIMIT_PER_HOUR;
}

async function applySupabaseAuthSmtp({ env = process.env, dryRun = true, fetchImpl = fetch } = {}) {
  const packet = buildSmtpPatchPacket(env);
  if (packet.errors.length > 0) {
    return { status: "UNVERIFIED", lines: formatValidationErrors(packet.errors) };
  }

  if (dryRun) {
    return {
      status: "PASS",
      lines: [
        line("DRY-RUN", "would PATCH Supabase Auth SMTP config using owner-provided environment values"),
        line("PASS", "validated Supabase Auth SMTP patch packet"),
      ],
    };
  }

  const endpoint = DEFAULT_MANAGEMENT_API_BASE_URL + "/projects/" + encodeURIComponent(packet.projectRef) + "/config/auth";
  const headers = {
    Authorization: "Bearer " + packet.token,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

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
    const diagnostic = sanitizeSupabaseErrorText(errorText, env);
    return {
      status: "FAIL",
      lines: [
        line(
          "FAIL",
          "Supabase Management API rejected Auth SMTP patch with HTTP " +
            patchResponse.status +
            (diagnostic ? ": " + diagnostic : ""),
        ),
      ],
    };
  }

  const verifyResponse = await fetchImpl(endpoint, {
    method: "GET",
    headers: { Authorization: headers.Authorization, Accept: headers.Accept },
  });
  if (!verifyResponse.ok) {
    return { status: "UNVERIFIED", lines: [line("UNVERIFIED", "Supabase Auth SMTP verification GET returned HTTP " + verifyResponse.status)] };
  }

  let body = {};
  try {
    body = await verifyResponse.json();
  } catch {
    return { status: "UNVERIFIED", lines: [line("UNVERIFIED", "Supabase Auth SMTP verification returned non-JSON config")] };
  }

  if (!hasCustomSmtp(body)) {
    return { status: "UNVERIFIED", lines: [line("UNVERIFIED", "Supabase Auth config did not report custom SMTP after patch")] };
  }

  if (!hasProductionEmailSendRateLimit(body)) {
    return {
      status: "UNVERIFIED",
      lines: [
        line(
          "UNVERIFIED",
          "Supabase Auth email send rate limit is below " + MIN_EMAIL_SEND_RATE_LIMIT_PER_HOUR + " per hour after patch",
        ),
      ],
    };
  }

  return {
    status: "PASS",
    lines: [
      line("APPLY", "patched Supabase Auth SMTP config"),
      line("PASS", "verified Supabase Auth custom SMTP presence and email send rate limit"),
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
  const result = await applySupabaseAuthSmtp({ env: process.env, dryRun });
  for (const outputLine of result.lines) console.log(outputLine);
  process.exit(result.status === "PASS" ? 0 : result.status === "FAIL" ? 1 : 2);
}

if (require.main === module) {
  main().catch(() => {
    console.log(line("FAIL", "unexpected Supabase Auth SMTP bootstrap failure"));
    process.exit(1);
  });
}

module.exports = {
  applySupabaseAuthSmtp,
  buildSmtpPatchPacket,
  formatValidationErrors,
  hasCustomSmtp,
  hasProductionEmailSendRateLimit,
  sanitizeSupabaseErrorText,
};
