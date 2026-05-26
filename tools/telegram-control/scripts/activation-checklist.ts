import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const root = resolve(import.meta.dirname, "../../..");
const workerConfigPath = resolve(root, "tools/telegram-control/wrangler.jsonc");
const workflowPath = resolve(root, ".github/workflows/telegram-control.yml");
const generatedSecretsPath = resolve(root, ".env.telegram-control.local");
const workerConfig = existsSync(workerConfigPath) ? readFileSync(workerConfigPath, "utf8") : "";
const checkGitHub = process.argv.includes("--github");
const checkCloudflare = process.argv.includes("--cloudflare");
const githubSecrets = checkGitHub ? listGitHubSecrets() : new Set<string>();

const checks = [
  {
    name: "Cloudflare Worker config",
    status: existsSync(workerConfigPath) ? "PASS" : "FAIL",
    next: "Keep tools/telegram-control/wrangler.jsonc in git.",
  },
  {
    name: "Cloudflare KV namespace id",
    status:
      workerConfig && !workerConfig.includes("REPLACE_WITH_CLOUDFLARE_KV_NAMESPACE_ID")
        ? "PASS"
        : "UNVERIFIED",
    next: "Create a free-tier KV namespace and replace REPLACE_WITH_CLOUDFLARE_KV_NAMESPACE_ID.",
  },
  {
    name: "GitHub control workflow",
    status: existsSync(workflowPath) ? "PASS" : "FAIL",
    next: "Keep .github/workflows/telegram-control.yml in git.",
  },
  {
    name: "Cloudflare secrets",
    status: hasAll([
      "TELEGRAM_BOT_TOKEN",
      "TELEGRAM_WEBHOOK_SECRET",
      "TELEGRAM_ADMIN_IDS",
      "GITHUB_APP_ID",
      "GITHUB_INSTALLATION_ID",
      "GITHUB_APP_PRIVATE_KEY",
      "GITHUB_WEBHOOK_SECRET",
      "TELEGRAM_CONTROL_CALLBACK_SECRET",
    ])
      ? "PASS"
      : "UNVERIFIED",
    next: "Set required Cloudflare secrets with wrangler secret put; do not commit values.",
  },
  {
    name: "Generated project-owned shared secrets",
    status: existsSync(generatedSecretsPath) ? "PASS" : "UNVERIFIED",
    next: "Run npm --prefix tools/telegram-control run secrets:bootstrap -- --write-local to generate local TELEGRAM_WEBHOOK_SECRET, GITHUB_WEBHOOK_SECRET, and TELEGRAM_CONTROL_CALLBACK_SECRET.",
  },
  {
    name: "GitHub callback secret",
    status: process.env.TELEGRAM_CONTROL_CALLBACK_SECRET || githubSecrets.has("TELEGRAM_CONTROL_CALLBACK_SECRET")
      ? "PASS"
      : "UNVERIFIED",
    next: "Set TELEGRAM_CONTROL_CALLBACK_SECRET in GitHub Actions secrets.",
  },
  {
    name: "GitHub callback URL",
    status: process.env.TELEGRAM_CONTROL_CALLBACK_URL || githubSecrets.has("TELEGRAM_CONTROL_CALLBACK_URL")
      ? "PASS"
      : "UNVERIFIED",
    next: "Set TELEGRAM_CONTROL_CALLBACK_URL in GitHub Actions secrets after the Worker URL exists.",
  },
  {
    name: "OpenAI Codex secret",
    status: process.env.OPENAI_API_KEY || githubSecrets.has("OPENAI_API_KEY") ? "PASS" : "UNVERIFIED",
    next: "Set GitHub OPENAI_API_KEY for Codex-backed plan/fix/review/security modes. Without it, AI modes correctly report UNVERIFIED.",
  },
  {
    name: "GitHub Snyk secret",
    status: process.env.SNYK_TOKEN || githubSecrets.has("SNYK_TOKEN") ? "PASS" : "UNVERIFIED",
    next: "Optional: set GitHub SNYK_TOKEN. Without it, security mode skips Snyk but still reports that evidence gap.",
  },
  {
    name: "Telegram webhook local env",
    status: hasAll(["TELEGRAM_WEBHOOK_URL", "TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET"])
      ? "PASS"
      : "UNVERIFIED",
    next: "Set local TELEGRAM_WEBHOOK_URL, TELEGRAM_BOT_TOKEN, and TELEGRAM_WEBHOOK_SECRET before running set-webhook.",
  },
];

if (checkCloudflare) {
  checks.splice(1, 0, {
    name: "Cloudflare wrangler auth",
    status: isWranglerAuthenticated() ? "PASS" : "UNVERIFIED",
    next: "Run npx wrangler login before installing Worker secrets or deploying.",
  });
}

console.log("Telegram control activation checklist");
for (const check of checks) {
  console.log(`${check.status} ${check.name} - ${check.next}`);
}

const overall = checks.some((check) => check.status === "FAIL")
  ? "FAIL"
  : checks.some((check) => check.status === "UNVERIFIED")
    ? "UNVERIFIED"
    : "PASS";

console.log(`Overall: ${overall}`);

function hasAll(names: string[]): boolean {
  return names.every((name) => Boolean(process.env[name]));
}

function listGitHubSecrets(): Set<string> {
  try {
    const output = execFileSync("gh", ["secret", "list", "--repo", "Yehor212/people-first-app"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return new Set(
      output
        .split(/\r?\n/)
        .map((line) => line.split(/\s+/)[0] ?? "")
        .filter(Boolean),
    );
  } catch {
    return new Set();
  }
}

function isWranglerAuthenticated(): boolean {
  try {
    execFileSync(npxCommand(), ["wrangler", "whoami", "--config", workerConfigPath], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function npxCommand(): string {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}
