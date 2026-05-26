import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTelegramCommandsPayload,
  buildTelegramMenuButtonPayload,
  buildTelegramWebhookPayload,
  redactTelegramMenuButtonPayload,
  redactWebhookPayload,
  validateRuntimeConfig,
} from "../src/setup";

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

void test("buildTelegramWebhookPayload rejects wrong webhook path and unsafe secret tokens", () => {
  assert.throws(
    () =>
      buildTelegramWebhookPayload({
        webhookUrl: "https://example.com/not-webhook",
        webhookSecret: "secret-token",
      }),
    /\/telegram\/webhook/,
  );
  assert.throws(
    () =>
      buildTelegramWebhookPayload({
        webhookUrl: "https://example.com/telegram/webhook",
        webhookSecret: invalidTelegramHeaderValueForTest(),
      }),
    /may contain only/,
  );
});

function invalidTelegramHeaderValueForTest(): string {
  return ["bad", "value"].join(" ") + String.fromCharCode(33);
}

void test("redactWebhookPayload never returns the raw Telegram secret token", () => {
  const payload = buildTelegramWebhookPayload({
    webhookUrl: "https://example.com/telegram/webhook",
    webhookSecret: "secret-token",
  });

  assert.equal(redactWebhookPayload(payload).webhookHeaderConfigured, true);
});

void test("buildTelegramCommandsPayload exposes the full control command menu", () => {
  const payload = buildTelegramCommandsPayload();
  const commands = payload.commands.map((command) => command.command);

  assert.deepEqual(commands, [
    "status",
    "health",
    "plan",
    "fix",
    "review",
    "test",
    "security",
    "deploy",
    "rollback",
    "jobs",
    "approve",
    "deny",
    "cancel",
  ]);
});

void test("buildTelegramMenuButtonPayload requires HTTPS Mini App URL", () => {
  assert.throws(() => buildTelegramMenuButtonPayload("http://example.com/miniapp"), /HTTPS/);

  const payload = buildTelegramMenuButtonPayload("https://example.com/miniapp");
  assert.equal(payload.menu_button.type, "web_app");
  assert.equal(payload.menu_button.web_app.url, "https://example.com/miniapp");
  assert.deepEqual(redactTelegramMenuButtonPayload(payload), {
    menu_button: {
      type: "web_app",
      text: "ZenFlow Control",
      webAppUrlConfigured: true,
      webAppOrigin: "https://example.com",
    },
  });
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
