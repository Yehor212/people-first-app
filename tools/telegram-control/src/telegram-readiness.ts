import { validateTelegramAdminIds } from "./activation-doctor";

export type TelegramReadinessStatus = "PASS" | "UNVERIFIED" | "FAIL";

export interface TelegramReadinessCheck {
  name: string;
  status: TelegramReadinessStatus;
  evidence: string;
}

export interface TelegramReadinessOptions {
  live: boolean;
  fetcher?: typeof fetch;
}

interface TelegramApiResponse<T> {
  ok?: boolean;
  description?: string;
  result?: T;
}

interface TelegramBotInfo {
  is_bot?: boolean;
  username?: string;
}

interface TelegramWebhookInfo {
  url?: string;
  pending_update_count?: number;
  last_error_message?: string;
  allowed_updates?: string[];
}

export async function buildTelegramReadinessChecks(
  env: Readonly<Record<string, string | undefined>>,
  options: TelegramReadinessOptions,
): Promise<TelegramReadinessCheck[]> {
  const checks = buildLocalTelegramReadinessChecks(env);

  if (!options.live) {
    return checks;
  }

  const botToken = trimmed(env.TELEGRAM_BOT_TOKEN);
  if (!botToken || validateTelegramBotToken(botToken).length > 0) {
    checks.push({
      name: "Telegram getMe",
      status: "UNVERIFIED",
      evidence: "TELEGRAM_BOT_TOKEN is missing or malformed; live token check not run",
    });
    checks.push({
      name: "Telegram getWebhookInfo",
      status: "UNVERIFIED",
      evidence: "TELEGRAM_BOT_TOKEN is missing or malformed; live webhook check not run",
    });
    return checks;
  }

  const fetcher = options.fetcher ?? fetch;
  checks.push(await checkTelegramGetMe(botToken, fetcher));
  checks.push(await checkTelegramWebhookInfo(botToken, env, fetcher));
  return checks;
}

export function buildLocalTelegramReadinessChecks(
  env: Readonly<Record<string, string | undefined>>,
): TelegramReadinessCheck[] {
  const botToken = trimmed(env.TELEGRAM_BOT_TOKEN);
  const webhookSecret = trimmed(env.TELEGRAM_WEBHOOK_SECRET);
  const adminIds = trimmed(env.TELEGRAM_ADMIN_IDS);
  const webhookUrl = trimmed(env.TELEGRAM_WEBHOOK_URL);
  const miniAppUrl = trimmed(env.TELEGRAM_MINI_APP_URL) ?? miniAppUrlFromControlBase(env.TELEGRAM_CONTROL_BASE_URL);
  const tokenErrors = botToken ? validateTelegramBotToken(botToken) : ["missing from environment"];
  const webhookSecretErrors = webhookSecret ? validateTelegramWebhookSecret(webhookSecret) : ["missing from environment"];
  const adminIdErrors = validateTelegramAdminIds(adminIds);
  const webhookUrlErrors = webhookUrl ? validateTelegramWebhookUrl(webhookUrl) : ["missing from environment"];
  const miniAppUrlErrors = miniAppUrl ? validateTelegramMiniAppUrl(miniAppUrl) : ["set TELEGRAM_MINI_APP_URL or TELEGRAM_CONTROL_BASE_URL"];

  return [
    {
      name: "TELEGRAM_BOT_TOKEN",
      status: statusFromErrors(Boolean(botToken), tokenErrors),
      evidence: tokenErrors.length === 0 ? "present and shape-valid; value not printed" : tokenErrors.join("; "),
    },
    {
      name: "TELEGRAM_WEBHOOK_SECRET",
      status: statusFromErrors(Boolean(webhookSecret), webhookSecretErrors),
      evidence:
        webhookSecretErrors.length === 0
          ? "present and compatible with Telegram secret_token rules; value not printed"
          : webhookSecretErrors.join("; "),
    },
    {
      name: "TELEGRAM_ADMIN_IDS",
      status: statusFromErrors(Boolean(adminIds), adminIdErrors),
      evidence: adminIdErrors.length === 0 ? "numeric Telegram admin allowlist present" : adminIdErrors.join("; "),
    },
    {
      name: "TELEGRAM_WEBHOOK_URL",
      status: statusFromErrors(Boolean(webhookUrl), webhookUrlErrors),
      evidence: webhookUrlErrors.length === 0 ? "HTTPS /telegram/webhook URL validated" : webhookUrlErrors.join("; "),
    },
    {
      name: "TELEGRAM_MINI_APP_URL",
      status: statusFromErrors(Boolean(miniAppUrl), miniAppUrlErrors),
      evidence: miniAppUrlErrors.length === 0 ? "HTTPS Mini App URL validated" : miniAppUrlErrors.join("; "),
    },
  ];
}

export function overallTelegramReadinessStatus(
  checks: readonly TelegramReadinessCheck[],
): TelegramReadinessStatus {
  if (checks.some((check) => check.status === "FAIL")) {
    return "FAIL";
  }
  if (checks.some((check) => check.status === "UNVERIFIED")) {
    return "UNVERIFIED";
  }
  return "PASS";
}

export function validateTelegramBotToken(value: string): string[] {
  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(value)) {
    return ["TELEGRAM_BOT_TOKEN must look like a BotFather token"];
  }
  return [];
}

export function validateTelegramWebhookSecret(value: string): string[] {
  const errors: string[] = [];
  if (value.length < 1 || value.length > 256) {
    errors.push("TELEGRAM_WEBHOOK_SECRET must be 1-256 characters");
  }
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    errors.push("TELEGRAM_WEBHOOK_SECRET may contain only A-Z, a-z, 0-9, underscore, or hyphen");
  }
  return errors;
}

export function validateTelegramWebhookUrl(value: string): string[] {
  return validateHttpsUrl(value, "TELEGRAM_WEBHOOK_URL", "/telegram/webhook");
}

export function validateTelegramMiniAppUrl(value: string): string[] {
  const errors = validateHttpsUrl(value, "TELEGRAM_MINI_APP_URL");
  return errors;
}

async function checkTelegramGetMe(botToken: string, fetcher: typeof fetch): Promise<TelegramReadinessCheck> {
  const response = await callTelegram<TelegramBotInfo>(botToken, "getMe", fetcher);
  if (!response.ok || !response.result?.is_bot) {
    return {
      name: "Telegram getMe",
      status: "FAIL",
      evidence: `Telegram getMe did not confirm a bot: ${response.description ?? "unknown error"}`,
    };
  }
  const username = response.result.username ? `@${response.result.username}` : "bot username unavailable";
  return {
    name: "Telegram getMe",
    status: "PASS",
    evidence: `Bot API authenticated ${username}; token value not printed`,
  };
}

async function checkTelegramWebhookInfo(
  botToken: string,
  env: Readonly<Record<string, string | undefined>>,
  fetcher: typeof fetch,
): Promise<TelegramReadinessCheck> {
  const response = await callTelegram<TelegramWebhookInfo>(botToken, "getWebhookInfo", fetcher);
  if (!response.ok || !response.result) {
    return {
      name: "Telegram getWebhookInfo",
      status: "FAIL",
      evidence: `Telegram getWebhookInfo failed: ${response.description ?? "unknown error"}`,
    };
  }

  const webhookUrl = response.result.url?.trim();
  if (!webhookUrl) {
    return {
      name: "Telegram getWebhookInfo",
      status: "UNVERIFIED",
      evidence: "Telegram reports no webhook URL; run set-webhook after Worker deploy",
    };
  }

  const expectedUrl = trimmed(env.TELEGRAM_WEBHOOK_URL);
  if (expectedUrl && normalizeUrl(expectedUrl) !== normalizeUrl(webhookUrl)) {
    return {
      name: "Telegram getWebhookInfo",
      status: "FAIL",
      evidence: `Telegram webhook target differs from TELEGRAM_WEBHOOK_URL: ${redactUrl(webhookUrl)}`,
    };
  }

  if (response.result.last_error_message) {
    return {
      name: "Telegram getWebhookInfo",
      status: "UNVERIFIED",
      evidence: `Telegram reports a recent webhook delivery error at ${redactUrl(webhookUrl)}`,
    };
  }

  return {
    name: "Telegram getWebhookInfo",
    status: "PASS",
    evidence: `Telegram webhook is configured at ${redactUrl(webhookUrl)}; pending updates ${
      response.result.pending_update_count ?? 0
    }`,
  };
}

async function callTelegram<T>(botToken: string, method: string, fetcher: typeof fetch): Promise<TelegramApiResponse<T>> {
  try {
    const response = await fetcher(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: "POST",
    });
    return (await response.json()) as TelegramApiResponse<T>;
  } catch (error) {
    return {
      ok: false,
      description: error instanceof Error ? error.message : String(error),
    };
  }
}

function statusFromErrors(hasValue: boolean, errors: readonly string[]): TelegramReadinessStatus {
  if (errors.length === 0) {
    return "PASS";
  }
  return hasValue ? "FAIL" : "UNVERIFIED";
}

function validateHttpsUrl(value: string, label: string, requiredPath?: string): string[] {
  const errors: string[] = [];
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return [`${label} must be a valid URL`];
  }

  if (parsed.protocol !== "https:") {
    errors.push(`${label} must use HTTPS`);
  }
  if (parsed.username || parsed.password) {
    errors.push(`${label} must not include credentials`);
  }
  if (parsed.search || parsed.hash) {
    errors.push(`${label} must not include query strings or fragments`);
  }
  if (requiredPath && parsed.pathname !== requiredPath) {
    errors.push(`${label} must end with ${requiredPath}`);
  }
  return errors;
}

function miniAppUrlFromControlBase(value: string | undefined): string | undefined {
  const base = trimmed(value);
  if (!base) {
    return undefined;
  }
  try {
    const parsed = new URL(base);
    parsed.pathname = "/miniapp";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return base;
  }
}

function normalizeUrl(value: string): string {
  return new URL(value).toString();
}

function redactUrl(value: string): string {
  const parsed = new URL(value);
  return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
}

function trimmed(value: string | undefined): string | undefined {
  const next = value?.trim();
  return next ? next : undefined;
}
