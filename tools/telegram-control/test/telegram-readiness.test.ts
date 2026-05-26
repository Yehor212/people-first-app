import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLocalTelegramReadinessChecks,
  buildTelegramReadinessChecks,
  overallTelegramReadinessStatus,
  validateTelegramBotToken,
  validateTelegramWebhookSecret,
} from "../src/telegram-readiness";

const validEnv = {
  TELEGRAM_BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyz",
  TELEGRAM_WEBHOOK_SECRET: "safe_secret-token",
  TELEGRAM_ADMIN_IDS: "123456789,987654321",
  TELEGRAM_WEBHOOK_URL: "https://worker.example/telegram/webhook",
  TELEGRAM_CONTROL_BASE_URL: "https://worker.example",
};

void test("Telegram readiness local checks validate setup without exposing secrets", () => {
  const checks = buildLocalTelegramReadinessChecks(validEnv);
  const report = checks.map((check) => `${check.status} ${check.name} ${check.evidence}`).join("\n");

  assert.equal(overallTelegramReadinessStatus(checks), "PASS");
  assert.doesNotMatch(report, /abcdefghijklmnopqrstuvwxyz/);
  assert.doesNotMatch(report, /safe_secret-token/);
});

void test("Telegram readiness separates missing values from malformed values", () => {
  const missing = buildLocalTelegramReadinessChecks({});
  const malformed = buildLocalTelegramReadinessChecks({
    TELEGRAM_BOT_TOKEN: "not-a-token",
    TELEGRAM_WEBHOOK_SECRET: invalidTelegramHeaderValueForTest(),
    TELEGRAM_ADMIN_IDS: "abc",
    TELEGRAM_WEBHOOK_URL: "http://worker.example/not-webhook",
    TELEGRAM_MINI_APP_URL: "http://worker.example/miniapp",
  });

  assert.equal(missing.find((check) => check.name === "TELEGRAM_BOT_TOKEN")?.status, "UNVERIFIED");
  assert.equal(malformed.find((check) => check.name === "TELEGRAM_BOT_TOKEN")?.status, "FAIL");
  assert.equal(malformed.find((check) => check.name === "TELEGRAM_WEBHOOK_SECRET")?.status, "FAIL");
});

void test("Telegram token and webhook secret validators enforce safe shapes", () => {
  assert.deepEqual(validateTelegramBotToken(validEnv.TELEGRAM_BOT_TOKEN), []);
  assert.deepEqual(validateTelegramWebhookSecret("abc_DEF-123"), []);
  assert.match(validateTelegramWebhookSecret("abc def").join("\n"), /may contain only/);
});

void test("Telegram readiness live checks use getMe and getWebhookInfo without printing token", async () => {
  const requestedUrls: string[] = [];
  const fetcher = async (url: string | URL) => {
    const nextUrl = String(url);
    requestedUrls.push(nextUrl);
    if (nextUrl.endsWith("/getMe")) {
      return jsonResponse({ ok: true, result: { is_bot: true, username: "zenflow_control_bot" } });
    }
    return jsonResponse({
      ok: true,
      result: {
        url: "https://worker.example/telegram/webhook",
        pending_update_count: 0,
      },
    });
  };

  const checks = await buildTelegramReadinessChecks(validEnv, { live: true, fetcher: fetcher as typeof fetch });
  const report = checks.map((check) => `${check.status} ${check.name} ${check.evidence}`).join("\n");

  assert.equal(overallTelegramReadinessStatus(checks), "PASS");
  assert.equal(requestedUrls.length, 2);
  assert.doesNotMatch(report, /abcdefghijklmnopqrstuvwxyz/);
  assert.match(report, /Telegram getMe/);
  assert.match(report, /Telegram getWebhookInfo/);
});

void test("Telegram readiness live webhook mismatch fails closed", async () => {
  const fetcher = async (url: string | URL) => {
    if (String(url).endsWith("/getMe")) {
      return jsonResponse({ ok: true, result: { is_bot: true, username: "zenflow_control_bot" } });
    }
    return jsonResponse({
      ok: true,
      result: { url: "https://other.example/telegram/webhook" },
    });
  };

  const checks = await buildTelegramReadinessChecks(validEnv, { live: true, fetcher: fetcher as typeof fetch });

  assert.equal(checks.find((check) => check.name === "Telegram getWebhookInfo")?.status, "FAIL");
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function invalidTelegramHeaderValueForTest(): string {
  return ["bad", "value"].join(" ") + String.fromCharCode(33);
}
