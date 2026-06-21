#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const strict = process.argv.includes("--strict");

const envFileNames = [".env.example", ".env", ".env.production", ".env.local"];
const publicKeys = [
  "VITE_ENABLE_FACEBOOK_AUTH",
  "VITE_FACEBOOK_PUBLIC_ACCESS_READY",
  "VITE_ENABLE_TELEGRAM_AUTH",
  "VITE_ENABLE_APPLE_AUTH",
  "VITE_APPLE_PUBLIC_ACCESS_READY",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_ANON_KEY",
];
const providerSecretKeys = [
  "FACEBOOK_APP_SECRET",
  "TELEGRAM_CLIENT_SECRET",
  "APPLE_CLIENT_SECRET",
  "APPLE_PRIVATE_KEY",
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

function getTomlSection(content, sectionName) {
  const header = `[${sectionName}]`;
  const start = content.indexOf(header);
  if (start === -1) return "";

  const rest = content.slice(start + header.length);
  const nextSection = rest.search(/^\[[^\]]+\]/m);
  return nextSection === -1 ? rest : rest.slice(0, nextSection);
}

function checkSectionLine(section, regex, passMessage, failMessage, evidencePath) {
  if (regex.test(section)) {
    add("PASS", passMessage, `${evidencePath} matches ${regex.source}`);
  } else {
    add("FAIL", failMessage, `${evidencePath} does not match ${regex.source}`);
  }
}

function checkConfigContains(content, needle, passMessage, failMessage, evidencePath) {
  if (content.includes(needle)) {
    add("PASS", passMessage, `${evidencePath} contains ${needle}`);
  } else {
    add("FAIL", failMessage, `${evidencePath} is missing ${needle}`);
  }
}

function parseEnvFile(relativePath, options = {}) {
  const includeExample = options.includeExample === true;
  const absolutePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) return new Map();
  if (relativePath === ".env.example" && !includeExample) return new Map();

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
    if (!includeExample && isExamplePlaceholder(key, value)) continue;
    result.set(key, { value, source: relativePath });
  }

  return result;
}

function isExamplePlaceholder(key, value) {
  if (!value) return true;
  if (value === "your_supabase_anon_key") return true;
  if (value === "sb_publishable_your_public_key") return true;
  if (value.includes("your-project-ref.supabase.co")) return true;
  if (key.startsWith("VITE_") && /^your_[a-z0-9_]+$/i.test(value)) return true;
  return false;
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

function getPublicFlagState(env, key, defaultEnabled = true) {
  const entry = env.get(key);
  if (!entry?.value) {
    return {
      enabled: defaultEnabled,
      evidence: `${key} is not set; app default is ${defaultEnabled ? "enabled unless the value is false" : "disabled unless the value is true"}`,
    };
  }

  return {
    enabled: defaultEnabled ? entry.value !== "false" : entry.value === "true",
    evidence: `${key} set in ${entry.source}`,
  };
}

function hasEnabledFlag(env, key) {
  return getPublicFlagState(env, key).enabled;
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
const supabaseConfig = readText("supabase/config.toml");
const authSection = getTomlSection(supabaseConfig, "auth");
const facebookAuthSection = getTomlSection(supabaseConfig, "auth.external.facebook");
const appleAuthSection = getTomlSection(supabaseConfig, "auth.external.apple");
const telegramOidcFunctionSection = getTomlSection(supabaseConfig, "functions.telegram-oidc");

checkSourceContains(
  "src/lib/authProviders.ts",
  "custom:telegram",
  "Telegram maps to Supabase custom OIDC"
);
checkSourceContains(
  "src/lib/authProviders.ts",
  "facebook",
  "Facebook provider is present in provider config"
);

const authProvidersSource = readText("src/lib/authProviders.ts");
const facebookScopesMatch = authProvidersSource.match(
  /id:\s*"facebook"[\s\S]*?scopes:\s*"([^"]+)"/
);
const facebookScopes = new Set((facebookScopesMatch?.[1] || "").split(/\s+/).filter(Boolean));
if (facebookScopes.has("email") && facebookScopes.has("public_profile")) {
  add(
    "PASS",
    "Facebook OAuth requests Supabase-required email and public_profile scopes",
    `src/lib/authProviders.ts facebook scopes are configured as "${facebookScopesMatch?.[1]}"`
  );
} else {
  add(
    "FAIL",
    "Facebook OAuth must request email and public_profile for hosted Supabase Auth",
    `src/lib/authProviders.ts facebook scopes are "${facebookScopesMatch?.[1] || "missing"}"`
  );
}
checkSourceContains(
  "src/lib/authProviders.ts",
  'supabaseProvider: "apple"',
  "Apple provider is present in provider config"
);
checkSourceContains(
  "src/lib/authProviders.ts",
  '"apple",\n];',
  "Apple provider is available for account sign-in and linking"
);
checkSourceContains(
  "supabase/functions/telegram-oidc/telegram_oidc.ts",
  "secp256k1",
  "Telegram OIDC JWKS compatibility filter is implemented"
);
checkSourceContains(
  "docs/auth-facebook-telegram-setup.md",
  "discovery_url: https://api.zenflowapp.online/functions/v1/telegram-oidc/.well-known/openid-configuration",
  "Telegram Supabase discovery override is documented"
);
checkSourceContains(
  "docs/auth-facebook-telegram-setup.md",
  "docs/release/telegram/assets/zenflow-auth-bot-userpic.jpg",
  "Telegram bot profile photo uses the approved ZenFlow logo"
);
checkSourceContains(
  "docs/auth-facebook-telegram-setup.md",
  "`/setuserpic`",
  "Telegram BotFather userpic update flow is documented"
);
checkSourceContains(
  "tools/telegram-control/scripts/set-bot-ui.ts",
  "setMyProfilePhoto",
  "Telegram bot UI setup uploads the approved profile photo through Bot API"
);
checkSourceContains(
  "tools/telegram-control/package.json",
  "check:bot-profile-photo",
  "Telegram bot profile photo live verifier is registered"
);
checkSourceContains(
  "tools/telegram-control/src/telegram-readiness.ts",
  "getUserProfilePhotos",
  "Telegram bot profile photo live verifier checks the live Bot API avatar"
);
checkSourceContains(
  "src/components/settings/account-section/useAccountAuth.ts",
  "linkIdentity",
  "Settings supports provider account linking"
);
checkSourceContains(
  "src/lib/nativeOAuthBrowser.ts",
  "@capacitor/browser",
  "Native OAuth uses Capacitor Browser"
);
checkSourceContains(
  "ios/App/App/Info.plist",
  "com.zenflow.app",
  "iOS custom callback scheme is registered"
);
checkSourceContains(
  ".env.example",
  "VITE_ENABLE_FACEBOOK_AUTH=true",
  "Facebook public feature flag is documented"
);
checkSourceContains(
  ".env.example",
  "VITE_FACEBOOK_PUBLIC_ACCESS_READY=false",
  "Facebook Meta public access readiness gate is documented"
);
checkSourceContains(
  ".env.example",
  "VITE_ENABLE_TELEGRAM_AUTH=true",
  "Telegram public feature flag is documented"
);
checkSourceContains(
  ".env.example",
  "VITE_ENABLE_APPLE_AUTH=true",
  "Apple public feature flag is documented"
);
checkSourceContains(
  ".env.example",
  "VITE_APPLE_PUBLIC_ACCESS_READY=false",
  "Apple hosted public access readiness gate is documented"
);
checkSourceContains(
  ".github/workflows/deploy.yml",
  "VITE_FACEBOOK_PUBLIC_ACCESS_READY",
  "GitHub Pages deploy passes Facebook Meta readiness flag"
);
checkSourceContains(
  ".github/workflows/deploy.yml",
  "VITE_APPLE_PUBLIC_ACCESS_READY",
  "GitHub Pages deploy passes Apple hosted readiness flag"
);
checkSourceContains(
  ".github/workflows/deploy-v2-preview.yml",
  "VITE_FACEBOOK_PUBLIC_ACCESS_READY",
  "V2 preview deploy passes Facebook Meta readiness flag"
);
checkSourceContains(
  ".github/workflows/deploy-v2-preview.yml",
  "VITE_APPLE_PUBLIC_ACCESS_READY",
  "V2 preview deploy passes Apple hosted readiness flag"
);
checkSourceContains(
  ".github/workflows/visual-regression.yml",
  "VITE_FACEBOOK_PUBLIC_ACCESS_READY",
  "Visual regression build passes Facebook Meta readiness flag"
);
checkSourceContains(
  ".github/workflows/visual-regression.yml",
  "VITE_APPLE_PUBLIC_ACCESS_READY",
  "Visual regression build passes Apple hosted readiness flag"
);
checkSourceContains(
  ".github/workflows/deploy.yml",
  "VITE_ENABLE_TELEGRAM_AUTH: ${{ vars.VITE_ENABLE_TELEGRAM_AUTH || 'true' }}",
  "GitHub Pages deploy defaults Telegram public auth on"
);
checkSourceContains(
  ".github/workflows/deploy-v2-preview.yml",
  "VITE_ENABLE_TELEGRAM_AUTH: ${{ vars.VITE_ENABLE_TELEGRAM_AUTH || 'true' }}",
  "V2 preview deploy defaults Telegram public auth on"
);
checkSourceContains(
  ".github/workflows/visual-regression.yml",
  "VITE_ENABLE_TELEGRAM_AUTH: ${{ vars.VITE_ENABLE_TELEGRAM_AUTH || 'true' }}",
  "Visual regression build defaults Telegram public auth on"
);
checkSourceContains(
  ".github/workflows/deploy.yml",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "GitHub Pages deploy passes the modern Supabase publishable key"
);
checkSourceContains(
  "package.json",
  '"check:facebook-auth-live"',
  "Facebook live OAuth readiness npm script is registered"
);
checkSourceContains(
  "scripts/check-facebook-auth-live.cjs",
  "facebook_invalid_scope_email",
  "Facebook live OAuth readiness detects Meta invalid-scope email errors"
);
checkSourceContains(
  ".github/workflows/deploy.yml",
  "npm run check:facebook-auth-live",
  "GitHub Pages deploy runs Facebook live OAuth readiness check"
);
checkSourceContains(
  ".github/workflows/deploy.yml",
  "ZENFLOW_FACEBOOK_AUTH_LIVE_REQUIRED",
  "GitHub Pages deploy gates Facebook live OAuth readiness before public exposure"
);
checkSourceContains(
  ".github/workflows/deploy.yml",
  "npm run check:apple-auth-public",
  "GitHub Pages deploy runs Apple public Auth readiness check"
);
checkSourceContains(
  ".github/workflows/deploy.yml",
  "npm run check:apple-auth-live",
  "GitHub Pages deploy runs Apple hosted Auth readiness check"
);
checkSourceContains(
  ".github/workflows/deploy.yml",
  "ZENFLOW_APPLE_AUTH_PUBLIC_REQUIRED",
  "GitHub Pages deploy gates Apple public Auth readiness before public exposure"
);
checkSourceContains(
  ".github/workflows/deploy.yml",
  "ZENFLOW_APPLE_AUTH_LIVE_REQUIRED",
  "GitHub Pages deploy gates Apple hosted Auth readiness before public exposure"
);
checkSourceContains(
  ".github/workflows/deploy-v2-preview.yml",
  "npm run check:facebook-auth-public",
  "V2 preview deploy runs Facebook public Auth readiness check"
);
checkSourceContains(
  ".github/workflows/deploy-v2-preview.yml",
  "npm run check:facebook-auth-live",
  "V2 preview deploy runs Facebook live OAuth readiness check"
);
checkSourceContains(
  ".github/workflows/deploy-v2-preview.yml",
  "ZENFLOW_FACEBOOK_AUTH_LIVE_REQUIRED",
  "V2 preview deploy gates Facebook live OAuth readiness before public exposure"
);
checkSourceContains(
  ".github/workflows/deploy-v2-preview.yml",
  "npm run check:apple-auth-public",
  "V2 preview deploy runs Apple public Auth readiness check"
);
checkSourceContains(
  ".github/workflows/deploy-v2-preview.yml",
  "npm run check:apple-auth-live",
  "V2 preview deploy runs Apple hosted Auth readiness check"
);
checkSourceContains(
  ".github/workflows/deploy-v2-preview.yml",
  "ZENFLOW_APPLE_AUTH_PUBLIC_REQUIRED",
  "V2 preview deploy gates Apple public Auth readiness before public exposure"
);
checkSourceContains(
  ".github/workflows/deploy-v2-preview.yml",
  "ZENFLOW_APPLE_AUTH_LIVE_REQUIRED",
  "V2 preview deploy gates Apple hosted Auth readiness before public exposure"
);
checkSourceContains(
  ".github/workflows/deploy-v2-preview.yml",
  "npm run check:telegram-oidc-live",
  "V2 preview deploy runs Telegram OIDC live readiness check"
);
checkSourceContains(
  ".github/workflows/deploy-v2-preview.yml",
  "ZENFLOW_TELEGRAM_OIDC_LIVE_REQUIRED: true",
  "V2 preview deploy gates Telegram OIDC readiness before public exposure"
);
checkSourceContains(
  ".github/workflows/deploy-v2-preview.yml",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "V2 preview deploy passes the modern Supabase publishable key"
);
checkSourceContains(
  ".github/workflows/deploy.yml",
  "FACEBOOK_READY",
  "GitHub Pages public auth smoke reads Facebook readiness"
);
checkSourceContains(
  ".github/workflows/deploy.yml",
  "APPLE_READY",
  "GitHub Pages public auth smoke reads Apple readiness"
);
checkSourceContains(
  ".github/workflows/deploy.yml",
  'expected_providers="${expected_providers},apple"',
  "GitHub Pages public auth smoke exercises Apple when hosted readiness is enabled"
);
checkSourceContains(
  ".github/workflows/deploy.yml",
  'click_providers="${click_providers},apple"',
  "GitHub Pages public auth smoke clicks Apple when hosted readiness is enabled"
);
checkSourceContains(
  ".github/workflows/deploy.yml",
  'forbidden_providers="${forbidden_providers:+${forbidden_providers},}apple"',
  "GitHub Pages public auth smoke forbids Apple until hosted readiness is enabled"
);
checkSourceContains(
  ".github/workflows/deploy.yml",
  "ZENFLOW_PUBLIC_AUTH_ADDITIONAL_PATHS: orb/?nav=v2&navLayout=phone,habits/?nav=v2&navLayout=phone,diary/?nav=v2&navLayout=phone,settings/?nav=v2&navLayout=phone",
  "GitHub Pages public auth smoke covers canonical V2 phone entrypoints"
);

if (!authSection) {
  add("FAIL", "Supabase auth section is missing", "supabase/config.toml lacks [auth]");
} else {
  checkSectionLine(
    authSection,
    /^enable_manual_linking\s*=\s*true\s*$/m,
    "Local Supabase manual identity linking is enabled",
    "Local Supabase manual identity linking must be enabled for provider linking",
    "supabase/config.toml [auth]"
  );
}

if (!facebookAuthSection) {
  add(
    "FAIL",
    "Supabase Facebook provider section is missing",
    "supabase/config.toml lacks [auth.external.facebook]"
  );
} else {
  checkSectionLine(
    facebookAuthSection,
    /^enabled\s*=\s*true\s*$/m,
    "Local Supabase Facebook provider is enabled",
    "Local Supabase Facebook provider is disabled",
    "supabase/config.toml [auth.external.facebook]"
  );
  checkSectionLine(
    facebookAuthSection,
    /^client_id\s*=\s*"env\(SUPABASE_AUTH_EXTERNAL_FACEBOOK_CLIENT_ID\)"\s*$/m,
    "Facebook App ID is configured through server-side env substitution",
    "Facebook App ID must use SUPABASE_AUTH_EXTERNAL_FACEBOOK_CLIENT_ID env substitution",
    "supabase/config.toml [auth.external.facebook]"
  );
  checkSectionLine(
    facebookAuthSection,
    /^secret\s*=\s*"env\(SUPABASE_AUTH_EXTERNAL_FACEBOOK_SECRET\)"\s*$/m,
    "Facebook app secret is configured through server-side env substitution",
    "Facebook app secret must use SUPABASE_AUTH_EXTERNAL_FACEBOOK_SECRET env substitution",
    "supabase/config.toml [auth.external.facebook]"
  );
  checkSectionLine(
    facebookAuthSection,
    /^email_optional\s*=\s*true\s*$/m,
    "Local Supabase Facebook provider allows users without email",
    "Local Supabase Facebook provider must set email_optional=true",
    "supabase/config.toml [auth.external.facebook]"
  );
}

if (!appleAuthSection) {
  add(
    "FAIL",
    "Supabase Apple provider section is missing",
    "supabase/config.toml lacks [auth.external.apple]"
  );
} else {
  checkSectionLine(
    appleAuthSection,
    /^enabled\s*=\s*true\s*$/m,
    "Local Supabase Apple provider is enabled",
    "Local Supabase Apple provider is disabled",
    "supabase/config.toml [auth.external.apple]"
  );
  checkSectionLine(
    appleAuthSection,
    /^client_id\s*=\s*"env\(SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID\)"\s*$/m,
    "Apple Services ID is configured through server-side env substitution",
    "Apple Services ID must use SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID env substitution",
    "supabase/config.toml [auth.external.apple]"
  );
  checkSectionLine(
    appleAuthSection,
    /^secret\s*=\s*"env\(SUPABASE_AUTH_EXTERNAL_APPLE_SECRET\)"\s*$/m,
    "Apple client secret is configured through server-side env substitution",
    "Apple client secret must use SUPABASE_AUTH_EXTERNAL_APPLE_SECRET env substitution",
    "supabase/config.toml [auth.external.apple]"
  );
}

if (!telegramOidcFunctionSection) {
  add(
    "FAIL",
    "Telegram OIDC compatibility function config is missing",
    "supabase/config.toml lacks [functions.telegram-oidc]"
  );
} else {
  checkSectionLine(
    telegramOidcFunctionSection,
    /^verify_jwt\s*=\s*false\s*$/m,
    "Telegram OIDC compatibility function is public for Supabase Auth discovery",
    "Telegram OIDC compatibility function must disable JWT verification for Supabase Auth discovery",
    "supabase/config.toml [functions.telegram-oidc]"
  );
}

for (const [url, label] of [
  ["https://yehor212.github.io/people-first-app/", "canonical GitHub Pages auth redirect"],
  [
    "https://yehor212.github.io/people-first-app/orb?nav=v2&navLayout=phone",
    "canonical V2 phone auth redirect",
  ],
  ["com.zenflow.app://login-callback", "native OAuth callback redirect"],
  ["http://localhost:5173/**", "local Vite OAuth wildcard redirect"],
]) {
  checkConfigContains(
    supabaseConfig,
    `"${url}"`,
    `Supabase allow-list includes ${label}`,
    `Supabase allow-list is missing ${label}`,
    "supabase/config.toml auth.additional_redirect_urls"
  );
}

for (const provider of [
  ["Facebook", "VITE_ENABLE_FACEBOOK_AUTH"],
  ["Telegram", "VITE_ENABLE_TELEGRAM_AUTH"],
  ["Apple", "VITE_ENABLE_APPLE_AUTH"],
]) {
  const [label, key] = provider;
  const flag = getPublicFlagState(env, key);
  if (flag.enabled) {
    add("PASS", `${label} public auth flag is enabled`, flag.evidence);
  } else if (strict) {
    add("FAIL", `${label} public auth flag is disabled`, `${key} is explicitly false`);
  } else {
    add("INFO", `${label} public auth flag is disabled`, `${key} is explicitly false`);
  }
}

const applePublicAccess = getPublicFlagState(env, "VITE_APPLE_PUBLIC_ACCESS_READY", false);
if (applePublicAccess.enabled) {
  add("PASS", "Apple hosted public access readiness flag is enabled", applePublicAccess.evidence);
} else {
  add(
    "INFO",
    "Apple hosted public access readiness flag is not enabled",
    `${applePublicAccess.evidence}; Apple stays hidden until hosted Supabase Apple Auth reports external.apple=true`
  );
}

const facebookPublicAccess = getPublicFlagState(env, "VITE_FACEBOOK_PUBLIC_ACCESS_READY", false);
if (facebookPublicAccess.enabled) {
  add(
    "PASS",
    "Facebook Meta public access readiness flag is enabled",
    facebookPublicAccess.evidence
  );
} else {
  add(
    "INFO",
    "Facebook Meta public access readiness flag is not enabled",
    `${facebookPublicAccess.evidence}; Facebook stays hidden until Meta business verification and App Review are approved`
  );
}

const supabaseUrl = env.get("VITE_SUPABASE_URL");
if (!supabaseUrl?.value) {
  const status =
    strict ||
    hasEnabledFlag(env, "VITE_ENABLE_FACEBOOK_AUTH") ||
    hasEnabledFlag(env, "VITE_ENABLE_TELEGRAM_AUTH") ||
    hasEnabledFlag(env, "VITE_ENABLE_APPLE_AUTH")
      ? "FAIL"
      : "INFO";
  add(
    status,
    "Supabase public URL is not configured",
    "VITE_SUPABASE_URL not found in loaded env files/process.env"
  );
} else {
  try {
    const parsed = new URL(supabaseUrl.value);
    if (parsed.hostname === `${expectedProjectRef}.supabase.co`) {
      add(
        "PASS",
        "Supabase public URL targets the ZenFlow project",
        `VITE_SUPABASE_URL host is ${parsed.hostname} from ${supabaseUrl.source}`
      );
    } else {
      add(
        "WARN",
        "Supabase public URL does not match the documented project ref",
        `VITE_SUPABASE_URL host is ${parsed.hostname} from ${supabaseUrl.source}`
      );
    }
  } catch {
    add(
      "FAIL",
      "Supabase public URL is invalid",
      `VITE_SUPABASE_URL could not be parsed from ${supabaseUrl.source}`
    );
  }
}

const publishableKey = env.get("VITE_SUPABASE_PUBLISHABLE_KEY");
const anonKey = env.get("VITE_SUPABASE_ANON_KEY");
if (publishableKey?.value) {
  add(
    "PASS",
    "Supabase publishable key is configured without printing it",
    `VITE_SUPABASE_PUBLISHABLE_KEY set in ${publishableKey.source}`
  );
} else if (anonKey?.value) {
  if (strict) {
    add(
      "FAIL",
      "Strict Supabase readiness requires VITE_SUPABASE_PUBLISHABLE_KEY",
      `Only legacy VITE_SUPABASE_ANON_KEY is set in ${anonKey.source}; publishable keys are the production target`
    );
  } else {
    add(
      "PASS",
      "Supabase anon key is configured without printing it",
      `VITE_SUPABASE_ANON_KEY set in ${anonKey.source}`
    );
  }
} else {
  const status =
    strict ||
    hasEnabledFlag(env, "VITE_ENABLE_FACEBOOK_AUTH") ||
    hasEnabledFlag(env, "VITE_ENABLE_TELEGRAM_AUTH") ||
    hasEnabledFlag(env, "VITE_ENABLE_APPLE_AUTH")
      ? "FAIL"
      : "INFO";
  add(
    status,
    "Supabase public client key is not configured",
    "VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY not found in loaded env files/process.env"
  );
}

for (const fileName of envFileNames) {
  const entries = parseEnvFile(fileName, { includeExample: true });
  for (const [key] of entries) {
    if (
      key.startsWith("VITE_") &&
      /(SECRET|SERVICE_ROLE|ACCESS_TOKEN|CLIENT_SECRET|APP_SECRET|PRIVATE|PAT|TOKEN)$/i.test(key)
    ) {
      add(
        "FAIL",
        "Secret-looking key is exposed to the client bundle",
        `${key} appears in ${fileName}`
      );
    }
  }
}

for (const key of providerSecretKeys) {
  const entry = env.get(key);
  if (entry?.value) {
    add(
      strict ? "FAIL" : "WARN",
      `${key} is present outside the app dashboards`,
      `${key} is set in ${entry.source}; keep provider secrets in Apple/Facebook/Telegram/Supabase dashboards or secret storage, never in VITE_* client env`
    );
  }
}

add(
  "INFO",
  "Dashboard provider secrets are intentionally not readable from this repo",
  "Apple, Facebook, and Telegram provider secrets must be configured by the project owner in official dashboards"
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
  `Auth provider readiness: ${failures} failure(s), ${warnings} warning(s), strict=${strict ? "true" : "false"}`
);

if (failures > 0) {
  process.exitCode = 1;
}
