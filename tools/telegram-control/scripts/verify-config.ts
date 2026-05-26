import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateRuntimeConfig } from "../src/setup";

const root = resolve(import.meta.dirname, "../../..");
const workerConfigPath = resolve(root, "tools/telegram-control/wrangler.jsonc");
const workflowPath = resolve(root, ".github/workflows/telegram-control.yml");
const workerConfig = existsSync(workerConfigPath) ? readFileSync(workerConfigPath, "utf8") : "";
const report = validateRuntimeConfig(process.env, {
  hasKvNamespaceId:
    Boolean(workerConfig) && !workerConfig.includes("REPLACE_WITH_CLOUDFLARE_KV_NAMESPACE_ID"),
  hasWorkflowFile: existsSync(workflowPath),
  hasWorkerConfig: existsSync(workerConfigPath),
});

console.log(`Telegram control setup: ${report.status}`);
for (const check of report.checks) {
  console.log(`${check.status} ${check.name} - ${check.evidence}`);
}

if (process.argv.includes("--strict") && report.status !== "PASS") {
  process.exitCode = 1;
}
