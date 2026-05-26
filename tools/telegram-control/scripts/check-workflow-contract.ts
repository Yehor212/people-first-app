import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const workflowPath = resolve(root, ".github/workflows/telegram-control.yml");
const workflow = readFileSync(workflowPath, "utf8");

const requiredSubstrings = [
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
  "actions: read",
  "WORK_BRANCH: codex/telegram-${{ inputs.job_id }}",
  "^codex/telegram-[A-Za-z0-9_.-]+$",
  "Destructive mode requires Telegram approval.",
  "OPENAI_API_KEY is missing; Codex action was not run.",
  "uses: openai/codex-action@v1",
  "openai-api-key: ${{ secrets.OPENAI_API_KEY }}",
  "sandbox: workspace-write",
  "safety-strategy: drop-sudo",
  "X-Zenflow-Control-Secret",
  "npm run check:task-completion",
  "npm run check:sync-contract",
];

const missing = requiredSubstrings.filter((value) => !workflow.includes(value));

if (missing.length > 0) {
  console.error("Telegram workflow contract FAIL");
  for (const value of missing) {
    console.error(`MISSING ${value}`);
  }
  process.exit(1);
}

console.log(`Telegram workflow contract PASS - ${requiredSubstrings.length} invariants verified.`);
