export const GENERATED_SECRET_NAMES = [
  "TELEGRAM_WEBHOOK_SECRET",
  "GITHUB_WEBHOOK_SECRET",
  "TELEGRAM_CONTROL_CALLBACK_SECRET",
] as const;

export const ACCOUNT_OWNED_SECRET_NAMES = [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_ADMIN_IDS",
  "GITHUB_APP_ID",
  "GITHUB_INSTALLATION_ID",
  "GITHUB_APP_PRIVATE_KEY",
  "OPENAI_API_KEY",
] as const;

export type GeneratedSecretName = (typeof GENERATED_SECRET_NAMES)[number];
export type GeneratedSecrets = Record<GeneratedSecretName, string>;

export function generateProjectSecrets(): GeneratedSecrets {
  return {
    TELEGRAM_WEBHOOK_SECRET: randomBase64Url(32),
    GITHUB_WEBHOOK_SECRET: randomBase64Url(32),
    TELEGRAM_CONTROL_CALLBACK_SECRET: randomBase64Url(32),
  };
}

export function validateGeneratedSecrets(secrets: GeneratedSecrets): string[] {
  const errors: string[] = [];

  for (const name of GENERATED_SECRET_NAMES) {
    const value = secrets[name];
    if (value.length < 32) {
      errors.push(`${name} is shorter than 32 characters`);
    }
    if (!/^[A-Za-z0-9_-]+$/.test(value)) {
      errors.push(`${name} contains characters outside Telegram/CLI-safe base64url`);
    }
  }

  if (secrets.TELEGRAM_WEBHOOK_SECRET.length > 256) {
    errors.push("TELEGRAM_WEBHOOK_SECRET exceeds Telegram secret_token limit");
  }

  return errors;
}

export function formatGeneratedSecretsEnv(secrets: GeneratedSecrets): string {
  return [
    "# Generated ZenFlow Telegram control-plane secrets.",
    "# This file is local-only and must stay out of git.",
    "# Account-owned secrets such as TELEGRAM_BOT_TOKEN and OPENAI_API_KEY are not generated here.",
    ...GENERATED_SECRET_NAMES.map((name) => `${name}=${secrets[name]}`),
    "",
  ].join("\n");
}

export function formatRedactedGeneratedSecrets(secrets: GeneratedSecrets): string[] {
  return GENERATED_SECRET_NAMES.map((name) => `${name}=generated(${secrets[name].length} chars)`);
}

function randomBase64Url(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
