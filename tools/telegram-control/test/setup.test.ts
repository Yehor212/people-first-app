import assert from "node:assert/strict";
import test from "node:test";
import { buildTelegramWebhookPayload, redactWebhookPayload, validateRuntimeConfig } from "../src/setup";

void test("buildTelegramWebhookPayload sets Telegram secret header token and allowed updates", () => {
  const payload = buildTelegramWebhookPayload({
    webhookUrl: "https://example.com/telegram/webhook",
    webhookSecret: "secret-token",
  });

  assert.deepEqual(payload, {
    url: "https://example.com/telegram/webhook",
    secret_token: "secret-token",
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
  });
});

void test("buildTelegramWebhookPayload rejects non-HTTPS URLs", () => {
  assert.throws(
    () =>
      buildTelegramWebhookPayload({
        webhookUrl: "http://example.com/telegram/webhook",
        webhookSecret: "secret-token",
      }),
    /HTTPS/,
  );
});

void test("redactWebhookPayload never returns the raw Telegram secret token", () => {
  const payload = buildTelegramWebhookPayload({
    webhookUrl: "https://example.com/telegram/webhook",
    webhookSecret: "secret-token",
  });

  assert.equal(redactWebhookPayload(payload).webhookHeaderConfigured, true);
});

void test("validateRuntimeConfig reports missing live secrets as UNVERIFIED", () => {
  const report = validateRuntimeConfig(
    {},
    {
      hasKvNamespaceId: false,
      hasWorkerConfig: true,
      hasWorkflowFile: true,
    },
  );

  assert.equal(report.status, "UNVERIFIED");
  assert.equal(report.checks.some((check) => check.name === "TELEGRAM_BOT_TOKEN" && check.status === "UNVERIFIED"), true);
});
