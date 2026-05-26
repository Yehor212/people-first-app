import type { Env } from "./types";

export type SetupStatus = "PASS" | "UNVERIFIED" | "FAIL";

export interface SetupCheck {
  name: string;
  status: SetupStatus;
  evidence: string;
}

export interface SetupReport {
  status: SetupStatus;
  checks: SetupCheck[];
}

const REQUIRED_SECRETS = [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_WEBHOOK_SECRET",
  "TELEGRAM_ADMIN_IDS",
  "GITHUB_APP_ID",
  "GITHUB_INSTALLATION_ID",
  "GITHUB_APP_PRIVATE_KEY",
  "GITHUB_WEBHOOK_SECRET",
  "TELEGRAM_CONTROL_CALLBACK_SECRET",
] as const;

export function validateRuntimeConfig(
  env: Env,
  options: { hasKvNamespaceId: boolean; hasWorkflowFile: boolean; hasWorkerConfig: boolean },
): SetupReport {
  const checks: SetupCheck[] = [];

  for (const secretName of REQUIRED_SECRETS) {
    checks.push({
      name: secretName,
      status: env[secretName] ? "PASS" : "UNVERIFIED",
      evidence: env[secretName] ? "configured without exposing value" : "missing from environment",
    });
  }

  checks.push({
    name: "CONTROL_STATE_KV_ID",
    status: options.hasKvNamespaceId ? "PASS" : "UNVERIFIED",
    evidence: options.hasKvNamespaceId
      ? "wrangler.jsonc has a non-placeholder KV namespace id"
      : "wrangler.jsonc still uses placeholder KV namespace id",
  });
  checks.push({
    name: "WORKER_CONFIG",
    status: options.hasWorkerConfig ? "PASS" : "FAIL",
    evidence: options.hasWorkerConfig ? "wrangler.jsonc exists" : "wrangler.jsonc is missing",
  });
  checks.push({
    name: "GITHUB_WORKFLOW",
    status: options.hasWorkflowFile ? "PASS" : "FAIL",
    evidence: options.hasWorkflowFile
      ? ".github/workflows/telegram-control.yml exists"
      : ".github/workflows/telegram-control.yml is missing",
  });

  return {
    status: foldStatus(checks),
    checks,
  };
}

export function buildTelegramWebhookPayload(input: {
  webhookUrl: string;
  webhookSecret: string;
}): {
  url: string;
  secret_token: string;
  allowed_updates: ["message", "callback_query"];
  drop_pending_updates: boolean;
} {
  const url = new URL(input.webhookUrl);

  if (url.protocol !== "https:") {
    throw new Error("Telegram webhook URL must use HTTPS");
  }

  if (input.webhookSecret.length < 1 || input.webhookSecret.length > 256) {
    throw new Error("Telegram webhook secret token must be 1-256 characters");
  }

  return {
    url: url.toString(),
    secret_token: input.webhookSecret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
  };
}

export function redactWebhookPayload(payload: ReturnType<typeof buildTelegramWebhookPayload>): Record<string, unknown> {
  return {
    url: payload.url,
    webhookHeaderConfigured: Boolean(payload.secret_token),
    allowed_updates: payload.allowed_updates,
    drop_pending_updates: payload.drop_pending_updates,
  };
}

function foldStatus(checks: SetupCheck[]): SetupStatus {
  if (checks.some((check) => check.status === "FAIL")) {
    return "FAIL";
  }

  if (checks.some((check) => check.status === "UNVERIFIED")) {
    return "UNVERIFIED";
  }

  return "PASS";
}
