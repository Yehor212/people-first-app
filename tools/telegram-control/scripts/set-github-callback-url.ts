import { execFileSync, spawnSync } from "node:child_process";
import { callbackUrlFromBase, validateCallbackUrl } from "../src/callback-url";

const args = process.argv.slice(2);
const github = args.includes("--github");
const dryRun = args.includes("--dry-run") || !github;
const repo = argValue("--repo") ?? "Yehor212/people-first-app";
const explicitCallbackUrl = argValue("--callback-url") ?? process.env.TELEGRAM_CONTROL_CALLBACK_URL;
const baseUrl = argValue("--base-url") ?? process.env.TELEGRAM_CONTROL_BASE_URL;

let callbackUrl: string;
try {
  callbackUrl = explicitCallbackUrl ?? callbackUrlFromBase(baseUrl ?? "");
} catch (error) {
  printUnverified(error instanceof Error ? error.message : String(error));
  process.exit(dryRun ? 0 : 1);
}

const validationErrors = validateCallbackUrl(callbackUrl);
if (validationErrors.length > 0) {
  for (const error of validationErrors) {
    printUnverified(error);
  }
  process.exit(dryRun ? 0 : 1);
}

console.log(`Telegram GitHub callback URL installer: ${dryRun ? "DRY_RUN" : "APPLY"}`);
console.log(`PASS TELEGRAM_CONTROL_CALLBACK_URL=${redactUrl(callbackUrl)}`);

if (dryRun) {
  console.log("Dry run only. Re-run with --github after the deployed Worker URL is known.");
  process.exit(0);
}

assertGitHubCli();

const result = spawnSync("gh", ["secret", "set", "TELEGRAM_CONTROL_CALLBACK_URL", "--repo", repo], {
  input: callbackUrl,
  encoding: "utf8",
  stdio: ["pipe", "pipe", "pipe"],
});

if (result.status !== 0) {
  if (result.stderr) {
    console.error(result.stderr.trim());
  }
  process.exit(result.status ?? 1);
}

console.log(`PASS GitHub Actions secret TELEGRAM_CONTROL_CALLBACK_URL stored for ${repo}`);

function assertGitHubCli(): void {
  execFileSync("gh", ["auth", "status"], { stdio: "ignore" });
}

function argValue(name: string): string | null {
  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }
  return args[index + 1] ?? null;
}

function redactUrl(value: string): string {
  const parsed = new URL(value);
  return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
}

function printUnverified(message: string): void {
  const line = `UNVERIFIED ${message}`;
  if (dryRun) {
    console.log(line);
    return;
  }
  console.error(line);
}
