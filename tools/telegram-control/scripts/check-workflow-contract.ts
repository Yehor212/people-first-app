import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const workflowPath = resolve(root, ".github/workflows/telegram-control.yml");
const deployWorkflowPath = resolve(root, ".github/workflows/deploy.yml");
const workflow = readFileSync(workflowPath, "utf8");
const deployWorkflow = readFileSync(deployWorkflowPath, "utf8");

const telegramRequiredSubstrings = [
  "workflow_dispatch:",
  "status",
  "plan",
  "fix",
  "review",
  "test",
  "security",
  "deploy",
  "rollback",
  "contents: write",
  "pull-requests: write",
  "actions: write",
  "WORK_BRANCH: codex/telegram-${{ inputs.job_id }}",
  "^codex/telegram-[A-Za-z0-9_.-]+$",
  "Destructive mode requires Telegram approval.",
  "Dispatch production deploy workflow",
  "Production deploy requires base_ref=main",
  "gh workflow run deploy.yml",
  "telegram_approval=telegram-approved",
  "Create rollback proposal PR",
  "Rollback target missing or unsafe. Use /rollback target=<commit-or-ref>.",
  "first_token",
  "second_token",
  "git revert --no-edit \"$rollback_target\"",
  "This is a draft rollback PR. It does not deploy or write directly to main.",
  "OPENAI_API_KEY is missing; Codex action was not run.",
  "uses: openai/codex-action@v1",
  "openai-api-key: ${{ secrets.OPENAI_API_KEY }}",
  "sandbox: workspace-write",
  "safety-strategy: drop-sudo",
  "X-Zenflow-Control-Secret",
  "npm run check:task-completion",
  "npm run check:sync-contract",
];

const deployRequiredSubstrings = [
  "telegram_control_job_id",
  "telegram_approval",
  "manual-build-only",
  "telegram-approved",
  "Validate Telegram-approved deploy target",
  "Telegram-approved production deploys must run from main.",
  "github.event.inputs.telegram_approval == 'telegram-approved'",
  "uses: actions/upload-pages-artifact@v5",
  "uses: actions/deploy-pages@v5.0.0",
];

const missing = [
  ...telegramRequiredSubstrings
    .filter((value) => !workflow.includes(value))
    .map((value) => `.github/workflows/telegram-control.yml: ${value}`),
  ...deployRequiredSubstrings
    .filter((value) => !deployWorkflow.includes(value))
    .map((value) => `.github/workflows/deploy.yml: ${value}`),
];

if (missing.length > 0) {
  console.error("Telegram workflow contract FAIL");
  for (const value of missing) {
    console.error(`MISSING ${value}`);
  }
  process.exit(1);
}

console.log(
  `Telegram workflow contract PASS - ${
    telegramRequiredSubstrings.length + deployRequiredSubstrings.length
  } invariants verified.`,
);
