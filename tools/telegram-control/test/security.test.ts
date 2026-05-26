import assert from "node:assert/strict";
import test from "node:test";
import {
  hmacSha256,
  isAuthorizedTelegramUser,
  safeEqual,
  verifyGitHubWebhookSignature,
  verifyTelegramWebhook,
} from "../src/security";
import type { Env } from "../src/types";

void test("safeEqual compares without length shortcut behavior", () => {
  assert.equal(safeEqual("abc", "abc"), true);
  assert.equal(safeEqual("abc", "abcd"), false);
  assert.equal(safeEqual("abc", "abx"), false);
});

void test("Telegram webhook secret and admin allowlist are enforced", () => {
  const env: Env = {
    TELEGRAM_WEBHOOK_SECRET: "secret",
    TELEGRAM_ADMIN_IDS: "100, 200",
  };
  const request = new Request("https://worker.test/telegram/webhook", {
    headers: { "X-Telegram-Bot-Api-Secret-Token": "secret" },
  });

  assert.equal(verifyTelegramWebhook(request, env), true);
  assert.equal(isAuthorizedTelegramUser(env, 100), true);
  assert.equal(isAuthorizedTelegramUser(env, 300), false);
});

void test("GitHub HMAC verification rejects modified bodies", async () => {
  const env: Env = { GITHUB_WEBHOOK_SECRET: "webhook-secret" };
  const body = JSON.stringify({ action: "completed" });
  const signature = await hmacSha256("webhook-secret", body);
  const request = new Request("https://worker.test/github/webhook", {
    method: "POST",
    headers: { "X-Hub-Signature-256": signature },
    body,
  });

  assert.equal(await verifyGitHubWebhookSignature(request, env, body), true);
  assert.equal(await verifyGitHubWebhookSignature(request, env, `${body}x`), false);
});
