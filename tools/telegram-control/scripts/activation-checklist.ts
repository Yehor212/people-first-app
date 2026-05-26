import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const workerConfigPath = resolve(root, "tools/telegram-control/wrangler.jsonc");
const workflowPath = resolve(root, ".github/workflows/telegram-control.yml");
const workerConfig = existsSync(workerConfigPath) ? readFileSync(workerConfigPath, "utf8") : "";

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
    name: "GitHub callback secrets",
    status: hasAll(["TELEGRAM_CONTROL_CALLBACK_URL", "TELEGRAM_CONTROL_CALLBACK_SECRET"])
      ? "PASS"
      : "UNVERIFIED",
    next: "Set TELEGRAM_CONTROL_CALLBACK_URL and TELEGRAM_CONTROL_CALLBACK_SECRET in GitHub Actions secrets.",
  },
  {
    name: "OpenAI Codex secret",
    status: process.env.OPENAI_API_KEY ? "PASS" : "UNVERIFIED",
    next: "Optional: set GitHub OPENAI_API_KEY. Without it, AI modes correctly report UNVERIFIED.",
  },
  {
    name: "Telegram webhook local env",
    status: hasAll(["TELEGRAM_WEBHOOK_URL", "TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET"])
      ? "PASS"
      : "UNVERIFIED",
    next: "Set local TELEGRAM_WEBHOOK_URL, TELEGRAM_BOT_TOKEN, and TELEGRAM_WEBHOOK_SECRET before running set-webhook.",
  },
];

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
