import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPromptedAccountSecretEnv,
  summarizePromptedAccountSecretEnv,
} from "../src/account-secret-prompt";

const validPem = [
  "-----" + "BEGIN PRIVATE KEY" + "-----",
  "MIIEvQIBADANBgkqhkiG9w0BAQEFAASC",
  "-----" + "END PRIVATE KEY" + "-----",
].join("\n");

void test("prompted account secrets load PEM files without exposing values", async () => {
  const env = await buildPromptedAccountSecretEnv(
    {
      TELEGRAM_BOT_TOKEN: "1234567890:abcdefghijklmnopqrstuvwxyz",
      TELEGRAM_ADMIN_IDS: "1122334455",
      GITHUB_APP_ID: "12345",
      GITHUB_INSTALLATION_ID: "67890",
      GITHUB_APP_PRIVATE_KEY_FILE: "/tmp/github-app.pem",
    },
    async (filePath) => {
      assert.equal(filePath, "/tmp/github-app.pem");
      return validPem;
    },
  );

  assert.equal(env.GITHUB_APP_PRIVATE_KEY, validPem);
  const summary = summarizePromptedAccountSecretEnv(env).join("\n");
  assert.match(summary, /TELEGRAM_BOT_TOKEN present/);
  assert.match(summary, /GITHUB_APP_PRIVATE_KEY present/);
  assert.doesNotMatch(summary, /abcdefghijklmnopqrstuvwxyz/);
  assert.doesNotMatch(summary, /BEGIN PRIVATE KEY/);
});

void test("prompted account secrets reject malformed values before install", async () => {
  await assert.rejects(
    () =>
      buildPromptedAccountSecretEnv(
        {
          TELEGRAM_BOT_TOKEN: "not-a-bot-token",
          TELEGRAM_ADMIN_IDS: "me",
          GITHUB_APP_ID: "app",
          GITHUB_INSTALLATION_ID: "install",
          GITHUB_APP_PRIVATE_KEY_FILE: "/tmp/github-app.pem",
        },
        async () => "not pem",
      ),
    /TELEGRAM_BOT_TOKEN must look like a BotFather token/,
  );
});
