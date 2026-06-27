import { readFile } from "node:fs/promises";
import {
  buildAccountSecretChecks,
  CLOUDFLARE_ACCOUNT_SECRET_NAMES,
  type CloudflareAccountSecretName,
  validateAccountSecret,
} from "./account-secrets";

export interface PromptedAccountSecretInput {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_ADMIN_IDS: string;
  GITHUB_APP_ID: string;
  GITHUB_INSTALLATION_ID: string;
  GITHUB_APP_PRIVATE_KEY_FILE: string;
}

export type PromptedAccountSecretEnv = Record<CloudflareAccountSecretName, string>;
export type PrivateKeyFileReader = (filePath: string) => Promise<string>;

export async function buildPromptedAccountSecretEnv(
  input: PromptedAccountSecretInput,
  readPrivateKeyFile: PrivateKeyFileReader = defaultPrivateKeyFileReader,
): Promise<PromptedAccountSecretEnv> {
  const privateKeyFile = input.GITHUB_APP_PRIVATE_KEY_FILE.trim();
  const privateKey = privateKeyFile ? await readPrivateKeyFile(privateKeyFile) : "";
  const env: PromptedAccountSecretEnv = {
    TELEGRAM_BOT_TOKEN: input.TELEGRAM_BOT_TOKEN.trim(),
    TELEGRAM_ADMIN_IDS: input.TELEGRAM_ADMIN_IDS.trim(),
    GITHUB_APP_ID: input.GITHUB_APP_ID.trim(),
    GITHUB_INSTALLATION_ID: input.GITHUB_INSTALLATION_ID.trim(),
    GITHUB_APP_PRIVATE_KEY: privateKey.trim(),
  };

  const errors = CLOUDFLARE_ACCOUNT_SECRET_NAMES.flatMap((name) =>
    validateAccountSecret(name, env[name]).map((error) => `${name}: ${error}`),
  );

  if (!privateKeyFile) {
    errors.push("GITHUB_APP_PRIVATE_KEY_FILE: path to the downloaded GitHub App .pem file is required");
  }

  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }

  return env;
}

export function summarizePromptedAccountSecretEnv(env: PromptedAccountSecretEnv): string[] {
  return buildAccountSecretChecks(env, CLOUDFLARE_ACCOUNT_SECRET_NAMES).map(
    (check) => `${check.status} ${check.name} - ${check.evidence}`,
  );
}

async function defaultPrivateKeyFileReader(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}
