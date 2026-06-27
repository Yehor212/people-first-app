import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const workflowPath = resolve(root, ".github/workflows/telegram-control.yml");
const deployWorkflowPath = resolve(root, ".github/workflows/deploy.yml");
const controlPath = resolve(root, "tools/telegram-control/src/control.ts");
const workflowSourcePath = resolve(root, "tools/telegram-control/src/workflow.ts");
const routerTestPath = resolve(root, "tools/telegram-control/test/router.test.ts");
const wranglerConfigPath = resolve(root, "tools/telegram-control/wrangler.jsonc");
const workflow = readFileSync(workflowPath, "utf8");
const deployWorkflow = readFileSync(deployWorkflowPath, "utf8");
const controlSource = readFileSync(controlPath, "utf8");
const workflowSource = readFileSync(workflowSourcePath, "utf8");
const routerTest = readFileSync(routerTestPath, "utf8");
const wranglerConfig = readFileSync(wranglerConfigPath, "utf8");

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
  'git revert --no-edit "$rollback_target"',
  "This is a draft rollback PR. It does not deploy or write directly to main.",
  "OPENAI_API_KEY is missing; Codex action was not run.",
  "Create no-paid AI fallback report",
  "node --import tsx tools/telegram-control/scripts/no-paid-ai-fallback.ts",
  "No-paid RAG context report created; OPENAI_API_KEY is missing; Codex action was not run.",
  "uses: openai/codex-action@v1",
  "openai-api-key: ${{ secrets.OPENAI_API_KEY }}",
  "env.HAS_OPENAI_API_KEY == 'true'",
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
  "TELEGRAM_AUTH_BOT_TOKEN",
  "uses: actions/upload-pages-artifact@v5",
  "uses: actions/deploy-pages@v5.0.0",
];

const wranglerRequiredSubstrings = [
  '"secrets"',
  '"required"',
  '"TELEGRAM_BOT_TOKEN"',
  '"TELEGRAM_WEBHOOK_SECRET"',
  '"TELEGRAM_ADMIN_IDS"',
  '"GITHUB_APP_ID"',
  '"GITHUB_INSTALLATION_ID"',
  '"GITHUB_APP_PRIVATE_KEY"',
  '"GITHUB_WEBHOOK_SECRET"',
  '"TELEGRAM_CONTROL_CALLBACK_SECRET"',
];

const sourceRequiredSubstrings = [
  [controlPath, controlSource, "APPROVAL_SIGNAL_TYPE"],
  [controlPath, controlSource, "Cloudflare Workflow is waiting for Telegram approval signal"],
  [controlPath, controlSource, "instance.sendEvent"],
  [workflowSourcePath, workflowSource, "waitForEvent<ApprovalSignal>"],
  [workflowSourcePath, workflowSource, "Cloudflare Workflow received approve signal"],
  [
    routerTestPath,
    routerTest,
    "approval-gated command starts a durable Workflow before waiting for Telegram approval",
  ],
  [
    routerTestPath,
    routerTest,
    "manual approve sends a Workflow approval signal instead of dispatching directly",
  ],
  [
    routerTestPath,
    routerTest,
    "manual cancel sends a Workflow cancel signal while job is awaiting approval",
  ],
] as const;

const missing = [
  ...telegramRequiredSubstrings
    .filter((value) => !workflow.includes(value))
    .map((value) => `.github/workflows/telegram-control.yml: ${value}`),
  ...deployRequiredSubstrings
    .filter((value) => !deployWorkflow.includes(value))
    .map((value) => `.github/workflows/deploy.yml: ${value}`),
  ...wranglerRequiredSubstrings
    .filter((value) => !wranglerConfig.includes(value))
    .map((value) => `tools/telegram-control/wrangler.jsonc: ${value}`),
  ...sourceRequiredSubstrings
    .filter(([, source, value]) => !source.includes(value))
    .map(([path, , value]) => `${path.replace(`${root}\\`, "")}: ${value}`),
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
    telegramRequiredSubstrings.length +
    deployRequiredSubstrings.length +
    wranglerRequiredSubstrings.length +
    sourceRequiredSubstrings.length
  } invariants verified.`
);
