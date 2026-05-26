import { callbackUrlFromBase, validateCallbackUrl } from "./callback-url";
import { parseGeneratedSecretsEnv } from "./generated-secret-store";
import {
  GENERATED_SECRET_NAMES,
  type GeneratedSecretName,
  type GeneratedSecrets,
  validateGeneratedSecrets,
} from "./secret-bootstrap";

export type ActivationStatus = "PASS" | "UNVERIFIED" | "FAIL";

export interface ActivationCheck {
  name: string;
  status: ActivationStatus;
  evidence: string;
}

export interface GeneratedSecretFileSummary {
  exists: boolean;
  presentNames: GeneratedSecretName[];
  errors: string[];
}

export interface ActivationDoctorInput {
  workerConfigPath: string;
  workerConfigExists: boolean;
  workerConfigText: string;
  workflowPath: string;
  workflowExists: boolean;
  generatedSecretsPath: string;
  generatedSecrets: GeneratedSecretFileSummary;
  env: Readonly<Record<string, string | undefined>>;
  githubChecked: boolean;
  githubSecretsAvailable: boolean;
  githubSecrets: ReadonlySet<string>;
  cloudflareChecked: boolean;
  wranglerAuthenticated?: boolean;
}

const CLOUDFLARE_ACCOUNT_SECRET_NAMES = [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_ADMIN_IDS",
  "GITHUB_APP_ID",
  "GITHUB_INSTALLATION_ID",
  "GITHUB_APP_PRIVATE_KEY",
  "GITHUB_WEBHOOK_SECRET",
  "TELEGRAM_CONTROL_CALLBACK_SECRET",
] as const;

export function buildActivationDoctorChecks(input: ActivationDoctorInput): ActivationCheck[] {
  const telegramAdminIdErrors = validateTelegramAdminIds(input.env.TELEGRAM_ADMIN_IDS);

  return [
    {
      name: "Cloudflare Worker config",
      status: input.workerConfigExists ? "PASS" : "FAIL",
      evidence: input.workerConfigPath,
    },
    {
      name: "Cloudflare KV namespace id",
      status: kvNamespaceStatus(input),
      evidence: kvNamespaceEvidence(input),
    },
    {
      name: "Cloudflare wrangler auth",
      status: input.cloudflareChecked
        ? input.wranglerAuthenticated
          ? "PASS"
          : "UNVERIFIED"
        : "UNVERIFIED",
      evidence: input.cloudflareChecked
        ? input.wranglerAuthenticated
          ? "wrangler whoami succeeded"
          : "wrangler whoami did not confirm authentication"
        : "run with --cloudflare to check wrangler auth",
    },
    {
      name: "GitHub control workflow",
      status: input.workflowExists ? "PASS" : "FAIL",
      evidence: input.workflowPath,
    },
    generatedSecretFileCheck(input),
    {
      name: "Cloudflare account-owned secret source",
      status: hasAllEnv(input.env, CLOUDFLARE_ACCOUNT_SECRET_NAMES) ? "PASS" : "UNVERIFIED",
      evidence: "requires Telegram token/admin ids plus GitHub App credentials outside git",
    },
    {
      name: "GitHub callback secret",
      status: envOrGitHubSecret(input, "TELEGRAM_CONTROL_CALLBACK_SECRET") ? "PASS" : "UNVERIFIED",
      evidence: githubEvidence(input, "TELEGRAM_CONTROL_CALLBACK_SECRET"),
    },
    {
      name: "GitHub callback URL",
      status: envOrGitHubSecret(input, "TELEGRAM_CONTROL_CALLBACK_URL") ? "PASS" : "UNVERIFIED",
      evidence: githubEvidence(input, "TELEGRAM_CONTROL_CALLBACK_URL"),
    },
    resolveCallbackUrlCheck(input.env),
    {
      name: "OpenAI Codex secret",
      status: envOrGitHubSecret(input, "OPENAI_API_KEY") ? "PASS" : "UNVERIFIED",
      evidence: githubEvidence(input, "OPENAI_API_KEY"),
    },
    {
      name: "GitHub Snyk secret",
      status: envOrGitHubSecret(input, "SNYK_TOKEN") ? "PASS" : "UNVERIFIED",
      evidence: input.githubChecked
        ? githubEvidence(input, "SNYK_TOKEN")
        : "optional; security mode reports an evidence gap when absent",
    },
    {
      name: "Telegram bot token",
      status: hasEnv(input.env, "TELEGRAM_BOT_TOKEN") ? "PASS" : "UNVERIFIED",
      evidence: "requires BotFather token as a Cloudflare secret or local env for setup commands",
    },
    {
      name: "Telegram admin ids",
      status: telegramAdminIdErrors.length === 0 ? "PASS" : hasEnv(input.env, "TELEGRAM_ADMIN_IDS") ? "FAIL" : "UNVERIFIED",
      evidence:
        telegramAdminIdErrors.length === 0
          ? "numeric Telegram admin allowlist is present"
          : telegramAdminIdErrors.join("; "),
    },
    {
      name: "Telegram webhook env",
      status: hasAllEnv(input.env, ["TELEGRAM_WEBHOOK_URL", "TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET"])
        ? "PASS"
        : "UNVERIFIED",
      evidence: "required before set-webhook can install a live Telegram webhook",
    },
  ];
}

export function overallActivationStatus(checks: readonly ActivationCheck[]): ActivationStatus {
  if (checks.some((check) => check.status === "FAIL")) {
    return "FAIL";
  }
  if (checks.some((check) => check.status === "UNVERIFIED")) {
    return "UNVERIFIED";
  }
  return "PASS";
}

export function summarizeGeneratedSecretFile(exists: boolean, content: string): GeneratedSecretFileSummary {
  if (!exists) {
    return { exists: false, presentNames: [], errors: [] };
  }

  const parsed = parseGeneratedSecretsEnv(content);
  const presentNames = GENERATED_SECRET_NAMES.filter((name) => Boolean(parsed[name]));
  const missing = GENERATED_SECRET_NAMES.filter((name) => !parsed[name]);
  const errors = missing.map((name) => `${name} is missing from generated secrets file`);

  if (missing.length === 0) {
    const secrets = {} as GeneratedSecrets;
    for (const name of GENERATED_SECRET_NAMES) {
      secrets[name] = parsed[name] ?? "";
    }
    errors.push(...validateGeneratedSecrets(secrets));
  }

  return { exists: true, presentNames, errors };
}

export function resolveCallbackUrlCheck(env: Readonly<Record<string, string | undefined>>): ActivationCheck {
  const explicit = trimmed(env.TELEGRAM_CONTROL_CALLBACK_URL);
  const base = trimmed(env.TELEGRAM_CONTROL_BASE_URL);

  if (!explicit && !base) {
    return {
      name: "Callback URL shape",
      status: "UNVERIFIED",
      evidence: "set TELEGRAM_CONTROL_BASE_URL or TELEGRAM_CONTROL_CALLBACK_URL after Worker deploy",
    };
  }

  try {
    const callbackUrl = explicit ?? callbackUrlFromBase(base ?? "");
    const errors = validateCallbackUrl(callbackUrl);
    if (errors.length > 0) {
      return { name: "Callback URL shape", status: "FAIL", evidence: errors.join("; ") };
    }
    return {
      name: "Callback URL shape",
      status: "PASS",
      evidence: "HTTPS /github/webhook callback URL validated",
    };
  } catch (error) {
    return {
      name: "Callback URL shape",
      status: "FAIL",
      evidence: error instanceof Error ? error.message : String(error),
    };
  }
}

export function validateTelegramAdminIds(value: string | undefined): string[] {
  const rawValue = trimmed(value);
  if (!rawValue) {
    return ["requires numeric Telegram admin id allowlist"];
  }

  const ids = rawValue
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return ["requires at least one numeric Telegram admin id"];
  }

  const invalidCount = ids.filter((id) => !/^\d+$/.test(id)).length;
  if (invalidCount > 0) {
    return [`TELEGRAM_ADMIN_IDS contains ${invalidCount} non-numeric id(s)`];
  }

  return [];
}

function generatedSecretFileCheck(input: ActivationDoctorInput): ActivationCheck {
  if (!input.generatedSecrets.exists) {
    return {
      name: "Generated shared secrets file",
      status: "UNVERIFIED",
      evidence: `${input.generatedSecretsPath} is absent; run secrets:bootstrap -- --write-local`,
    };
  }

  if (input.generatedSecrets.errors.length > 0) {
    return {
      name: "Generated shared secrets file",
      status: "FAIL",
      evidence: input.generatedSecrets.errors.join("; "),
    };
  }

  return {
    name: "Generated shared secrets file",
    status: "PASS",
    evidence: `contains ${input.generatedSecrets.presentNames.length} required generated secret names; values not printed`,
  };
}

function kvNamespaceStatus(input: ActivationDoctorInput): ActivationStatus {
  if (!input.workerConfigExists) {
    return "FAIL";
  }
  return input.workerConfigText.includes("REPLACE_WITH_CLOUDFLARE_KV_NAMESPACE_ID") ? "UNVERIFIED" : "PASS";
}

function kvNamespaceEvidence(input: ActivationDoctorInput): string {
  if (!input.workerConfigExists) {
    return "wrangler config is missing";
  }
  return input.workerConfigText.includes("REPLACE_WITH_CLOUDFLARE_KV_NAMESPACE_ID")
    ? "wrangler.jsonc still contains REPLACE_WITH_CLOUDFLARE_KV_NAMESPACE_ID"
    : "wrangler.jsonc has a non-placeholder KV namespace id";
}

function envOrGitHubSecret(input: ActivationDoctorInput, name: string): boolean {
  return hasEnv(input.env, name) || input.githubSecrets.has(name);
}

function githubEvidence(input: ActivationDoctorInput, name: string): string {
  if (hasEnv(input.env, name)) {
    return `${name} is present in the current process environment; value not printed`;
  }
  if (!input.githubChecked) {
    return "run with --github to check GitHub Actions secret names";
  }
  if (!input.githubSecretsAvailable) {
    return "GitHub secret names unavailable; check gh authentication";
  }
  return input.githubSecrets.has(name)
    ? "checked GitHub Actions secret names; value not readable"
    : "GitHub Actions secret name not found";
}

function hasAllEnv(
  env: Readonly<Record<string, string | undefined>>,
  names: readonly string[],
): boolean {
  return names.every((name) => hasEnv(env, name));
}

function hasEnv(env: Readonly<Record<string, string | undefined>>, name: string): boolean {
  return Boolean(trimmed(env[name]));
}

function trimmed(value: string | undefined): string | undefined {
  const next = value?.trim();
  return next ? next : undefined;
}
