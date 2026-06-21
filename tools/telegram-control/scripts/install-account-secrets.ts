import { execFileSync, spawnSync as spawnSyncBase } from "node:child_process";
import { resolve } from "node:path";
import {
  buildAccountSecretChecks,
  CLOUDFLARE_ACCOUNT_SECRET_NAMES,
  GITHUB_ACCOUNT_SECRET_NAMES,
  missingRequiredChecks,
  type AccountSecretCheck,
  type AccountSecretName,
} from "../src/account-secrets";

const root = resolve(import.meta.dirname, "../../..");
const workerConfigPath = resolve(root, "tools/telegram-control/wrangler.jsonc");
const args = process.argv.slice(2);
const cloudflare = args.includes("--cloudflare");
const github = args.includes("--github");
const dryRun = args.includes("--dry-run") || (!cloudflare && !github);
const githubOpenAI = args.includes("--github-openai");
const githubTelegram = args.includes("--github-telegram");
const githubSnyk = args.includes("--github-snyk");
const repo = argValue("--repo") ?? "Yehor212/people-first-app";
const githubNames = selectedGitHubSecretNames();
const cloudflareChecks = buildAccountSecretChecks(process.env, CLOUDFLARE_ACCOUNT_SECRET_NAMES);
const githubChecks = buildAccountSecretChecks(process.env, githubNames);
const showCloudflare = cloudflare || (dryRun && !github);
const showGitHub = github || (dryRun && !cloudflare);

console.log(`Telegram account-secret installer: ${dryRun ? "DRY_RUN" : "APPLY"}`);

if (showCloudflare) {
  console.log("Cloudflare account-owned secrets:");
  printChecks(cloudflareChecks);
}

if (showGitHub) {
  console.log("GitHub account-owned secrets:");
  printChecks(githubChecks);
}

if (dryRun) {
  console.log(
    "Dry run only. Re-run with --cloudflare for Worker account secrets, or --github plus --github-telegram/--github-openai/--github-snyk for GitHub Actions secrets."
  );
  process.exit(0);
}

if (github && githubNames.length === 0) {
  console.error(
    "UNVERIFIED No GitHub account-owned secrets selected. Use --github-telegram, --github-openai, or --github-snyk."
  );
  process.exit(1);
}

if (cloudflare) {
  assertNoMissing("Cloudflare account-owned secrets", cloudflareChecks);
  assertWranglerAuthenticated();
  for (const name of CLOUDFLARE_ACCOUNT_SECRET_NAMES) {
    putCloudflareSecret(name, requireEnv(name));
  }
}

if (github) {
  assertNoMissing("GitHub account-owned secrets", githubChecks);
  assertGitHubCli();
  for (const name of githubNames) {
    putGitHubSecret(name, requireEnv(name));
  }
}

console.log("No secret values were printed.");

function selectedGitHubSecretNames(): AccountSecretName[] {
  if (dryRun && !githubOpenAI && !githubSnyk) {
    return [...GITHUB_ACCOUNT_SECRET_NAMES];
  }
  const names: AccountSecretName[] = [];
  if (githubTelegram) {
    names.push("TELEGRAM_BOT_TOKEN");
  }
  if (githubOpenAI) {
    names.push("OPENAI_API_KEY");
  }
  if (githubSnyk) {
    names.push("SNYK_TOKEN");
  }
  return names;
}

function printChecks(checks: readonly AccountSecretCheck[]): void {
  if (checks.length === 0) {
    console.log("UNVERIFIED no GitHub account-owned secrets selected");
    return;
  }
  for (const check of checks) {
    console.log(`${check.status} ${check.name} - ${check.evidence}`);
  }
}

function assertNoMissing(label: string, checks: readonly AccountSecretCheck[]): void {
  const missing = missingRequiredChecks(checks);
  if (missing.length === 0) {
    return;
  }
  for (const check of missing) {
    console.error(`${check.status} ${check.name} - ${check.evidence}`);
  }
  console.error(`FAIL ${label} are incomplete`);
  process.exit(1);
}

function putCloudflareSecret(name: string, value: string): void {
  const invocation = commandInvocation("npx", [
    "wrangler",
    "secret",
    "put",
    name,
    "--config",
    workerConfigPath,
  ]);
  const result = spawnSyncBase(invocation.command, invocation.args, {
    input: value,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    if (result.stderr) {
      console.error(result.stderr.trim());
    }
    process.exit(result.status ?? 1);
  }
  console.log(`PASS Cloudflare Worker secret ${name} stored`);
}

function putGitHubSecret(name: string, value: string): void {
  const result = spawnSyncBase("gh", ["secret", "set", name, "--repo", repo], {
    input: value,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    if (result.stderr) {
      console.error(result.stderr.trim());
    }
    process.exit(result.status ?? 1);
  }
  console.log(`PASS GitHub Actions secret ${name} stored for ${repo}`);
}

function assertWranglerAuthenticated(): void {
  const invocation = commandInvocation("npx", ["wrangler", "whoami", "--config", workerConfigPath]);
  const result = spawnSyncBase(invocation.command, invocation.args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    console.error(
      "UNVERIFIED Cloudflare account-owned secrets were not stored because wrangler is not authenticated."
    );
    process.exit(result.status ?? 1);
  }
}

function assertGitHubCli(): void {
  execFileSync("gh", ["auth", "status"], { stdio: "ignore" });
}

function commandInvocation(
  command: string,
  commandArgs: string[]
): { command: string; args: string[] } {
  if (process.platform === "win32" && (command === "npx" || command === "npm")) {
    return { command: "cmd.exe", args: ["/d", "/s", "/c", command, ...commandArgs] };
  }
  return { command, args: commandArgs };
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} missing from environment`);
  }
  return value;
}

function argValue(name: string): string | null {
  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }
  return args[index + 1] ?? null;
}
