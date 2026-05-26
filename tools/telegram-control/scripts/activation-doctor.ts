import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildActivationDoctorChecks,
  overallActivationStatus,
  summarizeGeneratedSecretFile,
} from "../src/activation-doctor";
import { fetchGitHubStatusChecks } from "../src/github-status";

const root = resolve(import.meta.dirname, "../../..");
const workerConfigPath = resolve(root, "tools/telegram-control/wrangler.jsonc");
const workflowPath = resolve(root, ".github/workflows/telegram-control.yml");
const generatedSecretsFileName = [".env", "telegram-control", "local"].join(".");
const generatedSecretsPath = resolve(root, generatedSecretsFileName);
const args = process.argv.slice(2);
const checkGitHub = args.includes("--github");
const checkCloudflare = args.includes("--cloudflare");
const checkExternal = args.includes("--external-checks");
const workerConfigExists = existsSync(workerConfigPath);
const workerConfigText = workerConfigExists ? readFileSync(workerConfigPath, "utf8") : "";
const generatedSecretsExists = existsSync(generatedSecretsPath);
const generatedSecretsContent = generatedSecretsExists ? readFileSync(generatedSecretsPath, "utf8") : "";
const githubSecretResult = checkGitHub ? listGitHubSecrets() : { available: false, names: new Set<string>() };

const checks = buildActivationDoctorChecks({
  workerConfigPath: "tools/telegram-control/wrangler.jsonc",
  workerConfigExists,
  workerConfigText,
  workflowPath: ".github/workflows/telegram-control.yml",
  workflowExists: existsSync(workflowPath),
  generatedSecretsPath: generatedSecretsFileName,
  generatedSecrets: summarizeGeneratedSecretFile(generatedSecretsExists, generatedSecretsContent),
  env: process.env,
  githubChecked: checkGitHub,
  githubSecretsAvailable: githubSecretResult.available,
  githubSecrets: githubSecretResult.names,
  cloudflareChecked: checkCloudflare,
  wranglerAuthenticated: checkCloudflare ? isWranglerAuthenticated() : undefined,
  externalChecks: checkExternal ? await fetchGitHubStatusChecks() : [],
});

console.log("Telegram control activation doctor (report-only)");
for (const check of checks) {
  console.log(`${check.status} ${check.name} - ${check.evidence}`);
}

const overall = overallActivationStatus(checks);
console.log(`Overall: ${overall}`);

if (overall === "FAIL") {
  process.exitCode = 1;
}

function listGitHubSecrets(): { available: boolean; names: Set<string> } {
  try {
    const output = execFileSync("gh", ["secret", "list", "--repo", "Yehor212/people-first-app"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return {
      available: true,
      names: new Set(
        output
          .split(/\r?\n/)
          .map((line) => line.split(/\s+/)[0] ?? "")
          .filter(Boolean),
      ),
    };
  } catch {
    return { available: false, names: new Set() };
  }
}

function isWranglerAuthenticated(): boolean {
  try {
    execFileSync(npxCommand(), ["wrangler", "whoami", "--config", workerConfigPath], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function npxCommand(): string {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}
