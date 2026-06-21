import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseWranglerWhoamiAuthentication } from "../src/activation-doctor";
import { parseGeneratedSecretsEnv, requireGeneratedSecret } from "../src/generated-secret-store";

const root = resolve(import.meta.dirname, "../../..");
const generatedSecretsPath = resolve(root, ".env.telegram-control.local");
const workerConfigPath = resolve(root, "tools/telegram-control/wrangler.jsonc");
const args = process.argv.slice(2);
const github = args.includes("--github");
const cloudflare = args.includes("--cloudflare");
const dryRun = args.includes("--dry-run") || (!github && !cloudflare);
const repo = argValue("--repo") ?? "Yehor212/people-first-app";

if (!existsSync(generatedSecretsPath)) {
  const message =
    "Generated secrets file is missing. Run npm --prefix tools/telegram-control run secrets:bootstrap -- --write-local first.";
  if (dryRun) {
    console.log(`UNVERIFIED ${message}`);
    console.log(
      "Dry run did not store TELEGRAM_CONTROL_CALLBACK_SECRET because the ignored local file is absent."
    );
    process.exit(0);
  }
  console.error(message);
  process.exit(1);
}

const generatedSecrets = parseGeneratedSecretsEnv(readFileSync(generatedSecretsPath, "utf8"));
const callbackSecret = requireGeneratedSecret(generatedSecrets, "TELEGRAM_CONTROL_CALLBACK_SECRET");
const cloudflareSecrets = {
  TELEGRAM_WEBHOOK_SECRET: requireGeneratedSecret(generatedSecrets, "TELEGRAM_WEBHOOK_SECRET"),
  GITHUB_WEBHOOK_SECRET: requireGeneratedSecret(generatedSecrets, "GITHUB_WEBHOOK_SECRET"),
  TELEGRAM_CONTROL_CALLBACK_SECRET: callbackSecret,
};

console.log(`Telegram generated-secret installer: ${dryRun ? "DRY_RUN" : "APPLY"}`);
console.log(
  `PASS TELEGRAM_CONTROL_CALLBACK_SECRET loaded from local ignored file (${callbackSecret.length} chars)`
);
if (cloudflare || dryRun) {
  console.log("PASS Cloudflare generated secrets loaded from local ignored file");
}

if (dryRun) {
  console.log(
    "Dry run only. Re-run with --github for GitHub Actions or --cloudflare after wrangler login for Cloudflare Worker secrets."
  );
  process.exit(0);
}

if (github) {
  assertGitHubCli();

  const result = spawnSync(
    "gh",
    ["secret", "set", "TELEGRAM_CONTROL_CALLBACK_SECRET", "--repo", repo],
    {
      input: callbackSecret,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }
  );

  if (result.status !== 0) {
    if (result.stderr) {
      console.error(result.stderr.trim());
    }
    process.exit(result.status ?? 1);
  }

  console.log(`PASS GitHub Actions secret TELEGRAM_CONTROL_CALLBACK_SECRET stored for ${repo}`);
}

if (cloudflare) {
  const auth = spawnSync(npxCommand(), ["wrangler", "whoami", "--config", workerConfigPath], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (auth.status !== 0 || !parseWranglerWhoamiAuthentication(`${auth.stdout}\n${auth.stderr}`)) {
    console.error(
      "UNVERIFIED Cloudflare secrets were not stored because wrangler is not authenticated."
    );
    console.error("Run npx wrangler login, then retry with --cloudflare.");
    process.exit(auth.status === 0 ? 1 : (auth.status ?? 1));
  }

  for (const [name, value] of Object.entries(cloudflareSecrets)) {
    const result = spawnSync(
      npxCommand(),
      ["wrangler", "secret", "put", name, "--config", workerConfigPath],
      {
        input: value,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    if (result.status !== 0) {
      if (result.stderr) {
        console.error(result.stderr.trim());
      }
      process.exit(result.status ?? 1);
    }
    console.log(`PASS Cloudflare Worker secret ${name} stored`);
  }
}

console.log("No secret values were printed.");

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

function npxCommand(): string {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}
