export const CLOUDFLARE_ACCOUNT_SECRET_NAMES = [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_ADMIN_IDS",
  "GITHUB_APP_ID",
  "GITHUB_INSTALLATION_ID",
  "GITHUB_APP_PRIVATE_KEY",
] as const;

export const GITHUB_ACCOUNT_SECRET_NAMES = ["OPENAI_API_KEY", "SNYK_TOKEN"] as const;

export type CloudflareAccountSecretName = (typeof CLOUDFLARE_ACCOUNT_SECRET_NAMES)[number];
export type GitHubAccountSecretName = (typeof GITHUB_ACCOUNT_SECRET_NAMES)[number];
export type AccountSecretName = CloudflareAccountSecretName | GitHubAccountSecretName;
export type AccountSecretStatus = "PASS" | "UNVERIFIED" | "FAIL";

export interface AccountSecretCheck {
  name: AccountSecretName;
  status: AccountSecretStatus;
  evidence: string;
}

export function buildAccountSecretChecks(
  env: Readonly<Record<string, string | undefined>>,
  names: readonly AccountSecretName[],
): AccountSecretCheck[] {
  return names.map((name) => {
    const value = env[name]?.trim() ?? "";
    if (!value) {
      return {
        name,
        status: "UNVERIFIED",
        evidence: `${name} missing from environment`,
      };
    }

    const validationErrors = validateAccountSecret(name, value);
    if (validationErrors.length > 0) {
      return {
        name,
        status: "FAIL",
        evidence: validationErrors.join("; "),
      };
    }

    return {
      name,
      status: "PASS",
      evidence: `${name} present (${redactedLength(value)}); value not printed`,
    };
  });
}

export function validateAccountSecret(name: AccountSecretName, value: string): string[] {
  const errors: string[] = [];
  const trimmed = value.trim();

  if (!trimmed) {
    return [`${name} is empty`];
  }

  if (name === "TELEGRAM_ADMIN_IDS") {
    const ids = trimmed
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (ids.length === 0 || ids.some((id) => !/^\d+$/.test(id))) {
      errors.push("TELEGRAM_ADMIN_IDS must be a comma-separated numeric allowlist");
    }
  }

  if (name === "GITHUB_APP_PRIVATE_KEY") {
    if (!trimmed.includes("BEGIN") || !trimmed.includes("PRIVATE KEY") || !trimmed.includes("END")) {
      errors.push("GITHUB_APP_PRIVATE_KEY must look like a PEM private key");
    }
  }

  if ((name === "GITHUB_APP_ID" || name === "GITHUB_INSTALLATION_ID") && !/^\d+$/.test(trimmed)) {
    errors.push(`${name} must be numeric`);
  }

  return errors;
}

export function missingRequiredChecks(checks: readonly AccountSecretCheck[]): AccountSecretCheck[] {
  return checks.filter((check) => check.status !== "PASS");
}

function redactedLength(value: string): string {
  return `${value.length} chars`;
}
