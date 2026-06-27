import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { resolve } from "node:path";
import {
  buildPromptedAccountSecretEnv,
  summarizePromptedAccountSecretEnv,
  type PromptedAccountSecretEnv,
  type PromptedAccountSecretInput,
} from "../src/account-secret-prompt";
import { CLOUDFLARE_ACCOUNT_SECRET_NAMES, validateAccountSecret } from "../src/account-secrets";

const root = resolve(import.meta.dirname, "../../..");
const workerConfigPath = resolve(root, "tools/telegram-control/wrangler.jsonc");
const args = process.argv.slice(2);
const cloudflare = args.includes("--cloudflare");
const githubTelegram = args.includes("--github-telegram");
const dryRun = args.includes("--dry-run") || (!cloudflare && !githubTelegram);
const repo = argValue("--repo") ?? "Yehor212/people-first-app";

console.log("Telegram account-secret prompt: " + (dryRun ? "DRY_RUN" : "APPLY"));
console.log("This helper never prints secret values. Paste values only into the local terminal prompts.");

if (dryRun) {
  console.log("Prompts:");
  console.log("- TELEGRAM_BOT_TOKEN (hidden input from private report/control BotFather bot)");
  console.log("- TELEGRAM_ADMIN_IDS (visible numeric comma-separated allowlist)");
  console.log("- GITHUB_APP_ID (visible numeric id)");
  console.log("- GITHUB_INSTALLATION_ID (visible numeric id)");
  console.log("- GITHUB_APP_PRIVATE_KEY_FILE (visible local path to downloaded .pem file)");
  console.log("- TELEGRAM_AUTH_BOT_TOKEN (hidden input from public OAuth BotFather bot; only with --github-telegram)");
  console.log("Run with --cloudflare to store Worker account secrets.");
  console.log("Add --github-telegram to also store TELEGRAM_AUTH_BOT_TOKEN in GitHub Actions secrets.");
  process.exit(0);
}

const prompted = await promptForAccountSecrets();
const env = await buildPromptedAccountSecretEnv(prompted);
const telegramAuthBotToken = githubTelegram ? await promptForTelegramAuthBotToken() : "";
for (const line of summarizePromptedAccountSecretEnv(env)) {
  console.log(line);
}

if (cloudflare) {
  for (const name of CLOUDFLARE_ACCOUNT_SECRET_NAMES) {
    putCloudflareSecret(name, env[name]);
  }
}

if (githubTelegram) {
  putGitHubSecret("TELEGRAM_AUTH_BOT_TOKEN", telegramAuthBotToken);
}

console.log("No secret values were printed.");

async function promptForAccountSecrets(): Promise<PromptedAccountSecretInput> {
  return {
    TELEGRAM_BOT_TOKEN: await questionHidden("TELEGRAM_BOT_TOKEN from private report/control BotFather bot: "),
    TELEGRAM_ADMIN_IDS: await questionVisible("TELEGRAM_ADMIN_IDS numeric allowlist: "),
    GITHUB_APP_ID: await questionVisible("GITHUB_APP_ID: "),
    GITHUB_INSTALLATION_ID: await questionVisible("GITHUB_INSTALLATION_ID: "),
    GITHUB_APP_PRIVATE_KEY_FILE: await questionVisible("Path to downloaded GitHub App .pem private key: "),
  };
}

async function promptForTelegramAuthBotToken(): Promise<string> {
  const value = await questionHidden("TELEGRAM_AUTH_BOT_TOKEN from public OAuth BotFather bot: ");
  const errors = validateAccountSecret("TELEGRAM_AUTH_BOT_TOKEN", value);
  if (errors.length > 0) {
    for (const error of errors) {
      console.error("FAIL " + error);
    }
    process.exit(1);
  }
  return value.trim();
}

async function questionVisible(prompt: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return await rl.question(prompt);
  } finally {
    rl.close();
  }
}

async function questionHidden(prompt: string): Promise<string> {
  if (!stdin.isTTY || !stdout.isTTY) {
    return questionVisible(prompt);
  }

  return new Promise((resolve, reject) => {
    const input = stdin;
    const output = stdout;
    const wasRaw = input.isRaw;
    let value = "";

    const cleanup = () => {
      input.off("data", onData);
      input.setRawMode(wasRaw);
      input.pause();
    };

    const onData = (chunk: Buffer | string) => {
      const text = chunk.toString("utf8");
      for (const char of text) {
        if (char === "\u0003") {
          cleanup();
          output.write("\n");
          reject(new Error("Input cancelled"));
          return;
        }
        if (char === "\r" || char === "\n") {
          cleanup();
          output.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u007f") {
          value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
    };

    output.write(prompt);
    input.resume();
    input.setEncoding("utf8");
    input.setRawMode(true);
    input.on("data", onData);
  });
}

function putCloudflareSecret(name: keyof PromptedAccountSecretEnv, value: string): void {
  const invocation = commandInvocation("npx", [
    "wrangler",
    "secret",
    "put",
    name,
    "--config",
    workerConfigPath,
  ]);
  const result = spawnSync(invocation.command, invocation.args, {
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
  console.log("PASS Cloudflare Worker secret " + name + " stored");
}

function putGitHubSecret(name: "TELEGRAM_AUTH_BOT_TOKEN", value: string): void {
  const result = spawnSync("gh", ["secret", "set", name, "--repo", repo], {
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
  console.log("PASS GitHub Actions secret " + name + " stored for " + repo);
}

function commandInvocation(
  command: string,
  commandArgs: string[],
): { command: string; args: string[] } {
  if (process.platform === "win32" && (command === "npx" || command === "npm")) {
    return { command: "cmd.exe", args: ["/d", "/s", "/c", command, ...commandArgs] };
  }
  return { command, args: commandArgs };
}

function argValue(name: string): string | null {
  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }
  return args[index + 1] ?? null;
}
