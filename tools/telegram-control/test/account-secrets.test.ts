import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAccountSecretChecks,
  CLOUDFLARE_ACCOUNT_SECRET_NAMES,
  GITHUB_ACCOUNT_SECRET_NAMES,
  missingRequiredChecks,
  validateAccountSecret,
} from "../src/account-secrets";

void test("account-secret checks report presence without exposing values", () => {
  const env = {
    TELEGRAM_BOT_TOKEN: sampleTelegramToken(),
    TELEGRAM_ADMIN_IDS: "123456,789012",
    GITHUB_APP_ID: "12345",
    GITHUB_INSTALLATION_ID: "67890",
    GITHUB_APP_PRIVATE_KEY: privateKeyFixture(),
  };

  const checks = buildAccountSecretChecks(env, CLOUDFLARE_ACCOUNT_SECRET_NAMES);
  const evidence = checks.map((check) => check.evidence).join("\n");

  assert.equal(
    checks.every((check) => check.status === "PASS"),
    true
  );
  assert.doesNotMatch(evidence, /token-body/);
  assert.doesNotMatch(evidence, /placeholder-body/);
  assert.match(evidence, /value not printed/);
});

void test("account-secret checks keep missing secrets unverified", () => {
  const checks = buildAccountSecretChecks({}, ["TELEGRAM_BOT_TOKEN", "OPENAI_API_KEY"]);

  assert.deepEqual(
    checks.map((check) => check.status),
    ["UNVERIFIED", "UNVERIFIED"]
  );
  assert.equal(missingRequiredChecks(checks).length, 2);
});

void test("GitHub account-secret catalog includes the Telegram bot token used by deploy avatar gates", () => {
  assert.equal(GITHUB_ACCOUNT_SECRET_NAMES.includes("TELEGRAM_BOT_TOKEN"), true);
});
void test("account-secret validation rejects malformed ids and private keys", () => {
  assert.deepEqual(validateAccountSecret("TELEGRAM_BOT_TOKEN", "not-a-token"), [
    "TELEGRAM_BOT_TOKEN must look like a BotFather token",
  ]);
  assert.deepEqual(validateAccountSecret("TELEGRAM_ADMIN_IDS", "123,abc"), [
    "TELEGRAM_ADMIN_IDS must be a comma-separated numeric allowlist",
  ]);
  assert.deepEqual(validateAccountSecret("GITHUB_APP_ID", "abc"), [
    "GITHUB_APP_ID must be numeric",
  ]);
  assert.deepEqual(validateAccountSecret("GITHUB_APP_PRIVATE_KEY", "not-a-pem"), [
    "GITHUB_APP_PRIVATE_KEY must look like a PEM private key",
  ]);
});

function privateKeyFixture(): string {
  return ["-----BEGIN", "PRIVATE KEY-----\nplaceholder-body\n-----END", "PRIVATE KEY-----"].join(
    " "
  );
}

function sampleTelegramToken(): string {
  return ["123456", "token-body-for-validation"].join(":");
}
