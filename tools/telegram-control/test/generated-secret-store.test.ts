import assert from "node:assert/strict";
import test from "node:test";
import { parseGeneratedSecretsEnv, requireGeneratedSecret } from "../src/generated-secret-store";

void test("parseGeneratedSecretsEnv only returns known generated secrets", () => {
  const parsed = parseGeneratedSecretsEnv(
    [
      "# comment",
      "TELEGRAM_WEBHOOK_SECRET=telegram-secret-value-abcdefghijklmnopqrstuvwxyz",
      "GITHUB_WEBHOOK_SECRET=github-secret-value-abcdefghijklmnopqrstuvwxyz",
      "TELEGRAM_CONTROL_CALLBACK_SECRET=callback-secret-value-abcdefghijklmnopqrstuvwxyz",
      "OPENAI_API_KEY=must-not-parse",
      "TELEGRAM_BOT_TOKEN=must-not-parse",
    ].join("\n")
  );

  assert.equal(parsed.TELEGRAM_WEBHOOK_SECRET, "telegram-secret-value-abcdefghijklmnopqrstuvwxyz");
  assert.equal(parsed.GITHUB_WEBHOOK_SECRET, "github-secret-value-abcdefghijklmnopqrstuvwxyz");
  assert.equal(
    parsed.TELEGRAM_CONTROL_CALLBACK_SECRET,
    "callback-secret-value-abcdefghijklmnopqrstuvwxyz"
  );
  assert.equal("OPENAI_API_KEY" in parsed, false);
  assert.equal("TELEGRAM_BOT_TOKEN" in parsed, false);
});

void test("requireGeneratedSecret rejects missing or short values", () => {
  assert.throws(() => requireGeneratedSecret({}, "TELEGRAM_CONTROL_CALLBACK_SECRET"), /missing/);
  assert.throws(
    () =>
      requireGeneratedSecret(
        { TELEGRAM_CONTROL_CALLBACK_SECRET: "short" },
        "TELEGRAM_CONTROL_CALLBACK_SECRET"
      ),
    /shorter/
  );
});
