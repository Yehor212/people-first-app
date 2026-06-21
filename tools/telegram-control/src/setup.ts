import type { Env } from "./types";
import { validateTelegramWebhookSecret, validateTelegramWebhookUrl } from "./telegram-readiness";

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

export const TELEGRAM_BOT_USERPIC_RELATIVE_PATH =
  "docs/release/telegram/assets/zenflow-auth-bot-userpic.jpg";
const TELEGRAM_BOT_USERPIC_ATTACH_NAME = "zenflow_auth_bot_userpic";

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
  const urlErrors = validateTelegramWebhookUrl(input.webhookUrl);
  if (urlErrors.length > 0) {
    throw new Error(urlErrors.join("; "));
  }

  const secretErrors = validateTelegramWebhookSecret(input.webhookSecret);
  if (secretErrors.length > 0) {
    throw new Error(secretErrors.join("; "));
  }

  return {
    url: new URL(input.webhookUrl).toString(),
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

export function buildTelegramCommandsPayload(): {
  commands: Array<{ command: string; description: string }>;
} {
  return {
    commands: [
      { command: "status", description: "Show CI and control workflow status" },
      { command: "health", description: "Show control-plane configuration health" },
      { command: "plan", description: "Ask Codex for an implementation plan" },
      { command: "fix", description: "Create a branch-scoped fix PR" },
      { command: "review", description: "Run an evidence-backed review" },
      { command: "test", description: "Run repository verification gates" },
      { command: "security", description: "Run security-focused checks" },
      { command: "deploy", description: "Queue production deploy after approval" },
      { command: "rollback", description: "Create a rollback draft PR after approval" },
      { command: "jobs", description: "List recent control jobs" },
      { command: "approve", description: "Approve a job with id and nonce" },
      { command: "deny", description: "Deny a job with id and nonce" },
      { command: "cancel", description: "Cancel a control job" },
    ],
  };
}

export function buildTelegramProfilePhotoPayload(attachName = TELEGRAM_BOT_USERPIC_ATTACH_NAME): {
  attachName: string;
  photo: {
    type: "static";
    photo: string;
  };
} {
  if (!/^[A-Za-z0-9_]+$/.test(attachName)) {
    throw new Error("Telegram profile photo attach name may contain only letters, numbers, and underscores");
  }

  return {
    attachName,
    photo: {
      type: "static",
      photo: `attach://${attachName}`,
    },
  };
}

export function redactTelegramProfilePhotoPayload(
  payload: ReturnType<typeof buildTelegramProfilePhotoPayload>,
): Record<string, unknown> {
  return {
    photo: {
      type: payload.photo.type,
      attachNameConfigured: payload.photo.photo === `attach://${payload.attachName}`,
    },
  };
}

export function buildTelegramMenuButtonPayload(miniAppUrl: string): {
  menu_button: {
    type: "web_app";
    text: string;
    web_app: { url: string };
  };
} {
  const url = new URL(miniAppUrl);

  if (url.protocol !== "https:") {
    throw new Error("Telegram Mini App URL must use HTTPS");
  }

  return {
    menu_button: {
      type: "web_app",
      text: "ZenFlow Control",
      web_app: { url: url.toString() },
    },
  };
}

export function redactTelegramMenuButtonPayload(
  payload: ReturnType<typeof buildTelegramMenuButtonPayload>,
): Record<string, unknown> {
  return {
    menu_button: {
      type: payload.menu_button.type,
      text: payload.menu_button.text,
      webAppUrlConfigured: Boolean(payload.menu_button.web_app.url),
      webAppOrigin: new URL(payload.menu_button.web_app.url).origin,
    },
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
