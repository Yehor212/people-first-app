import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseWranglerWhoamiAuthentication } from "../src/activation-doctor";
import {
  CONTROL_STATE_BINDING,
  extractKvNamespaceIdFromWranglerOutput,
  redactedKvNamespaceId,
  replaceControlStateKvNamespaceId,
  summarizeControlStateKvConfig,
  validateKvNamespaceId,
} from "../src/kv-setup";

const root = resolve(import.meta.dirname, "../../..");
const workerConfigPath = resolve(root, "tools/telegram-control/wrangler.jsonc");
const relativeWorkerConfigPath = "tools/telegram-control/wrangler.jsonc";
const args = process.argv.slice(2);
const create = args.includes("--create");
const write = args.includes("--write");
const dryRun = args.includes("--dry-run") || (!create && !write);
const explicitNamespaceId = argValue("--namespace-id") ?? process.env.CONTROL_STATE_KV_ID;

if (!existsSync(workerConfigPath)) {
  console.error(`FAIL ${relativeWorkerConfigPath} is missing`);
  process.exit(1);
}

const workerConfigText = readFileSync(workerConfigPath, "utf8");
const currentSummary = summarizeControlStateKvConfig(workerConfigText);

console.log(`Telegram Cloudflare KV setup: ${dryRun ? "DRY_RUN" : "APPLY"}`);
console.log(`PASS Binding target: ${CONTROL_STATE_BINDING}`);
console.log(
  `PASS Create command: npx wrangler kv namespace create ${CONTROL_STATE_BINDING} --config ${relativeWorkerConfigPath} --binding ${CONTROL_STATE_BINDING}`
);
for (const evidence of currentSummary.evidence) {
  console.log(`${currentSummary.status} CONTROL_STATE_KV_ID - ${evidence}`);
}

if (dryRun) {
  console.log(
    "Dry run only. Re-run with --namespace-id <cloudflare-kv-id> --write, or --create --write after wrangler login."
  );
  process.exit(0);
}

let namespaceId = explicitNamespaceId?.trim() ?? "";
if (namespaceId) {
  const validationErrors = validateKvNamespaceId(namespaceId);
  if (validationErrors.length > 0) {
    for (const error of validationErrors) {
      console.error(`FAIL ${error}`);
    }
    process.exit(1);
  }
  console.log(`PASS CONTROL_STATE_KV_ID provided (${redactedKvNamespaceId(namespaceId)})`);
}

if (create) {
  assertWranglerAuthenticated();
  namespaceId = createKvNamespace();
  console.log(`PASS Cloudflare KV namespace created (${redactedKvNamespaceId(namespaceId)})`);
}

if (!namespaceId) {
  console.error("FAIL Missing KV namespace id. Use --namespace-id <id> or --create.");
  process.exit(1);
}

if (!write) {
  console.log("UNVERIFIED Config not updated because --write was not provided.");
  process.exit(0);
}

const updatedConfig = replaceControlStateKvNamespaceId(workerConfigText, namespaceId);
writeFileSync(workerConfigPath, updatedConfig, "utf8");
console.log(`PASS ${relativeWorkerConfigPath} updated with CONTROL_STATE KV namespace id`);
console.log(
  "No secret values were printed. KV namespace ids are Cloudflare account-bound identifiers, not secret keys."
);

function createKvNamespace(): string {
  const result = spawnSync(
    npxCommand(),
    [
      "wrangler",
      "kv",
      "namespace",
      "create",
      CONTROL_STATE_BINDING,
      "--config",
      workerConfigPath,
      "--binding",
      CONTROL_STATE_BINDING,
    ],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  if (result.status !== 0) {
    if (result.stderr) {
      console.error(result.stderr.trim());
    }
    process.exit(result.status ?? 1);
  }

  const namespaceId = extractKvNamespaceIdFromWranglerOutput(`${result.stdout}\n${result.stderr}`);
  if (!namespaceId) {
    console.error("FAIL Wrangler did not return a parseable 32-character KV namespace id.");
    process.exit(1);
  }
  return namespaceId;
}

function assertWranglerAuthenticated(): void {
  const auth = spawnSync(npxCommand(), ["wrangler", "whoami", "--config", workerConfigPath], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (auth.status !== 0 || !parseWranglerWhoamiAuthentication(`${auth.stdout}\n${auth.stderr}`)) {
    console.error(
      "UNVERIFIED Cloudflare KV namespace was not created because wrangler is not authenticated."
    );
    console.error("Run npx wrangler login, then retry with --create --write.");
    process.exit(auth.status === 0 ? 1 : (auth.status ?? 1));
  }
}

function argValue(name: string): string | null {
  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }
  return args[index + 1] ?? null;
}

function npxCommand(): string {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}
