#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const strict = process.argv.includes("--strict");

const envFileNames = [".env.example", ".env", ".env.production", ".env.local"];
const publicKeys = [
  "VITE_ENABLE_FACEBOOK_AUTH",
  "VITE_ENABLE_TELEGRAM_AUTH",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
];
const providerSecretKeys = [
  "FACEBOOK_APP_SECRET",
  "TELEGRAM_CLIENT_SECRET",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_SERVICE_ROLE_KEY",
];
const expectedProjectRef = "bwgfslmxmueyglpumkbf";

const checks = [];

function add(status, message, evidence) {
  checks.push({ status, message, evidence });
}

function readText(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) return "";
  return fs.readFileSync(absolutePath, "utf8");
}

function parseEnvFile(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) return new Map();

  const result = new Map();
  const content = fs.readFileSync(absolutePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result.set(key, { value, source: relativePath });
  }

  return result;
}

function mergeEnv() {
  const merged = new Map();
  for (const fileName of envFileNames) {
    for (const [key, entry] of parseEnvFile(fileName)) {
      merged.set(key, entry);
    }
  }

  for (const key of [...publicKeys, ...providerSecretKeys]) {
    if (process.env[key] !== undefined) {
      merged.set(key, { value: process.env[key] ?? "", source: "process.env" });
    }
  }

  return merged;
}

function hasEnabledFlag(env, key) {
  return env.get(key)?.value === "true";
}

function sourceFor(env, key) {
  return env.get(key)?.source ?? "not found";
}

function checkSourceContains(relativePath, needle, label) {
  const content = readText(relativePath);
  if (content.includes(needle)) {
    add("PASS", label, `${relativePath} contains ${needle}`);
  } else {
    add("FAIL", label, `${relativePath} is missing ${needle}`);
  }
}

const env = mergeEnv();

checkSourceContains("src/lib/authProviders.ts", "custom:telegram", "Telegram maps to Supabase custom OIDC");
checkSourceContains("src/lib/authProviders.ts", "facebook", "Facebook provider is present in provider config");
checkSourceContains("src/components/settings/account-section/useAccountAuth.ts", "linkIdentity", "Settings supports provider account linking");
checkSourceContains("src/lib/nativeOAuthBrowser.ts", "@capacitor/browser", "Native OAuth uses Capacitor Browser");
checkSourceContains("ios/App/App/Info.plist", "com.zenflow.app", "iOS custom callback scheme is registered");
checkSourceContains(".env.example", "VITE_ENABLE_FACEBOOK_AUTH=true", "Facebook public feature flag is documented");
checkSourceContains(".env.example", "VITE_ENABLE_TELEGRAM_AUTH=true", "Telegram public feature flag is documented");

for (const provider of [
  ["Facebook", "VITE_ENABLE_FACEBOOK_AUTH"],
  ["Telegram", "VITE_ENABLE_TELEGRAM_AUTH"],
]) {
  const [label, key] = provider;
  if (hasEnabledFlag(env, key)) {
    add("PASS", `${label} public auth flag is enabled`, `${key} set in ${sourceFor(env, key)}`);
  } else if (strict) {
    add("FAIL", `${label} public auth flag is disabled`, `${key} must be true for live OAuth proof`);
  } else {
    add("INFO", `${label} public auth flag is disabled`, `${key} is ${env.get(key)?.value ?? "missing"} in ${sourceFor(env, key)}`);
  }
}

const supabaseUrl = env.get("VITE_SUPABASE_URL");
if (!supabaseUrl?.value) {
  const status = strict || hasEnabledFlag(env, "VITE_ENABLE_FACEBOOK_AUTH") || hasEnabledFlag(env, "VITE_ENABLE_TELEGRAM_AUTH")
    ? "FAIL"
    : "INFO";
  add(status, "Supabase public URL is not configured", "VITE_SUPABASE_URL not found in loaded env files/process.env");
} else {
  try {
    const parsed = new URL(supabaseUrl.value);
    if (parsed.hostname === `${expectedProjectRef}.supabase.co`) {
      add("PASS", "Supabase public URL targets the ZenFlow project", `VITE_SUPABASE_URL host is ${parsed.hostname} from ${supabaseUrl.source}`);
    } else {
      add("WARN", "Supabase public URL does not match the documented project ref", `VITE_SUPABASE_URL host is ${parsed.hostname} from ${supabaseUrl.source}`);
    }
  } catch {
    add("FAIL", "Supabase public URL is invalid", `VITE_SUPABASE_URL could not be parsed from ${supabaseUrl.source}`);
  }
}

const anonKey = env.get("VITE_SUPABASE_ANON_KEY");
if (anonKey?.value) {
  add("PASS", "Supabase anon key is configured without printing it", `VITE_SUPABASE_ANON_KEY set in ${anonKey.source}`);
} else {
  const status = strict || hasEnabledFlag(env, "VITE_ENABLE_FACEBOOK_AUTH") || hasEnabledFlag(env, "VITE_ENABLE_TELEGRAM_AUTH")
    ? "FAIL"
    : "INFO";
  add(status, "Supabase anon key is not configured", "VITE_SUPABASE_ANON_KEY not found in loaded env files/process.env");
}

for (const fileName of envFileNames) {
  const entries = parseEnvFile(fileName);
  for (const [key] of entries) {
    if (
      key.startsWith("VITE_") &&
      /(SECRET|SERVICE_ROLE|ACCESS_TOKEN|CLIENT_SECRET|APP_SECRET|PRIVATE|PAT|TOKEN)$/i.test(key)
    ) {
      add("FAIL", "Secret-looking key is exposed to the client bundle", `${key} appears in ${fileName}`);
    }
  }
}

for (const key of providerSecretKeys) {
  const entry = env.get(key);
  if (entry) {
    add(
      "WARN",
      `${key} is present outside the app dashboards`,
      `${key} is set in ${entry.source}; keep provider secrets in Facebook/Telegram/Supabase dashboards or secret storage, never in VITE_* client env`,
    );
  }
}

add(
  "INFO",
  "Dashboard provider secrets are intentionally not readable from this repo",
  "Facebook App Secret and Telegram OIDC secret must be configured by the project owner in official dashboards",
);

let failures = 0;
let warnings = 0;
for (const check of checks) {
  if (check.status === "FAIL") failures += 1;
  if (check.status === "WARN") warnings += 1;
  console.log(`[${check.status}] ${check.message}`);
  console.log(`       Evidence: ${check.evidence}`);
}

console.log("");
console.log(
  `Auth provider readiness: ${failures} failure(s), ${warnings} warning(s), strict=${strict ? "true" : "false"}`,
);

if (failures > 0) {
  process.exitCode = 1;
}
