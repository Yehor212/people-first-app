import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  buildLocalTelegramReadinessChecks,
  buildTelegramReadinessChecks,
  checkTelegramBotProfilePhoto,
  checkTelegramPublicBotProfilePhoto,
  compareTelegramProfilePhotoToApproved,
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
  const report = checks
    .map((check) => `${check.status} ${check.name} ${check.evidence}`)
    .join("\n");

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

  const checks = await buildTelegramReadinessChecks(validEnv, {
    live: true,
    fetcher: fetcher as typeof fetch,
  });
  const report = checks
    .map((check) => `${check.status} ${check.name} ${check.evidence}`)
    .join("\n");

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

  const checks = await buildTelegramReadinessChecks(validEnv, {
    live: true,
    fetcher: fetcher as typeof fetch,
  });

  assert.equal(checks.find((check) => check.name === "Telegram getWebhookInfo")?.status, "FAIL");
});

void test("Telegram bot profile photo live check verifies approved userpic without exposing token", async () => {
  const requestedUrls: string[] = [];
  const fetcher = async (url: string | URL) => {
    const nextUrl = String(url);
    requestedUrls.push(nextUrl);
    if (nextUrl.endsWith("/getMe")) {
      return jsonResponse({
        ok: true,
        result: { id: 123456789, is_bot: true, username: "ZenFlowAuthBot" },
      });
    }
    if (nextUrl.endsWith("/getUserProfilePhotos")) {
      return jsonResponse({
        ok: true,
        result: { total_count: 1, photos: [[{ file_id: "small" }, { file_id: "approved-file" }]] },
      });
    }
    if (nextUrl.endsWith("/getFile")) {
      return jsonResponse({ ok: true, result: { file_path: "photos/approved.jpg" } });
    }
    return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
  };

  const check = await checkTelegramBotProfilePhoto({
    botToken: validEnv.TELEGRAM_BOT_TOKEN,
    approvedPhotoPath: "docs/release/telegram/assets/zenflow-auth-bot-userpic.jpg",
    fetcher: fetcher as typeof fetch,
    comparePhoto: async (actualBytes, approvedPath) =>
      actualBytes.length === 3 && approvedPath.endsWith("zenflow-auth-bot-userpic.jpg"),
  });

  assert.equal(check.status, "PASS");
  assert.equal(requestedUrls.length, 4);
  assert.match(check.evidence, /@ZenFlowAuthBot/);
  assert.doesNotMatch(check.evidence, /abcdefghijklmnopqrstuvwxyz/);
  assert.equal(
    requestedUrls.some((url) => url.includes("/getUserProfilePhotos")),
    true
  );
  assert.equal(
    requestedUrls.some((url) => url.includes("/getFile")),
    true
  );
});

void test("Telegram bot profile photo live check fails when the avatar differs", async () => {
  const fetcher = async (url: string | URL) => {
    const nextUrl = String(url);
    if (nextUrl.endsWith("/getMe")) {
      return jsonResponse({
        ok: true,
        result: { id: 123456789, is_bot: true, username: "ZenFlowAuthBot" },
      });
    }
    if (nextUrl.endsWith("/getUserProfilePhotos")) {
      return jsonResponse({
        ok: true,
        result: { total_count: 1, photos: [[{ file_id: "current-file" }]] },
      });
    }
    if (nextUrl.endsWith("/getFile")) {
      return jsonResponse({ ok: true, result: { file_path: "photos/current.jpg" } });
    }
    return new Response(new Uint8Array([9, 9, 9]), { status: 200 });
  };

  const check = await checkTelegramBotProfilePhoto({
    botToken: validEnv.TELEGRAM_BOT_TOKEN,
    approvedPhotoPath: "docs/release/telegram/assets/zenflow-auth-bot-userpic.jpg",
    fetcher: fetcher as typeof fetch,
    comparePhoto: async () => false,
  });

  assert.equal(check.status, "FAIL");
  assert.match(check.evidence, /does not match/);
});

void test("Telegram public bot profile photo check verifies t.me og:image without a bot token", async () => {
  const requestedUrls: string[] = [];
  const fetcher = async (url: string | URL) => {
    const nextUrl = String(url);
    requestedUrls.push(nextUrl);
    if (nextUrl === "https://t.me/ZenFlowAuthBot") {
      return new Response(
        '<html><head><meta property="og:title" content="ZenFlow"><meta property="og:image" content="https://cdn4.telesco.pe/file/approved.jpg"></head></html>',
        { status: 200, headers: { "Content-Type": "text/html" } }
      );
    }
    return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
  };

  const check = await checkTelegramPublicBotProfilePhoto({
    botUsername: "ZenFlowAuthBot",
    approvedPhotoPath: "docs/release/telegram/assets/zenflow-auth-bot-userpic.jpg",
    fetcher: fetcher as typeof fetch,
    comparePhoto: async (actualBytes, approvedPath) =>
      actualBytes.length === 3 && approvedPath.endsWith("zenflow-auth-bot-userpic.jpg"),
  });

  assert.equal(check.status, "PASS");
  assert.deepEqual(requestedUrls, [
    "https://t.me/ZenFlowAuthBot",
    "https://cdn4.telesco.pe/file/approved.jpg",
  ]);
  assert.match(check.evidence, /@ZenFlowAuthBot/);
});

void test("Telegram bot profile photo comparison accepts a Telegram-cropped approved userpic", async () => {
  const { default: sharp } = await import("sharp");
  const approvedPhotoPath = fileURLToPath(
    new URL("../../../docs/release/telegram/assets/zenflow-auth-bot-userpic.jpg", import.meta.url)
  );
  const telegramCroppedBytes = new Uint8Array(
    await sharp(approvedPhotoPath)
      .extract({ left: 132, top: 132, width: 760, height: 760 })
      .resize(320, 320)
      .jpeg({ quality: 86 })
      .toBuffer()
  );

  assert.equal(
    await compareTelegramProfilePhotoToApproved(telegramCroppedBytes, approvedPhotoPath),
    true
  );
});

void test("Telegram bot profile photo comparison rejects unrelated userpics", async () => {
  const { default: sharp } = await import("sharp");
  const approvedPhotoPath = fileURLToPath(
    new URL("../../../docs/release/telegram/assets/zenflow-auth-bot-userpic.jpg", import.meta.url)
  );
  const unrelatedBytes = new Uint8Array(
    await sharp({
      create: {
        width: 320,
        height: 320,
        channels: 3,
        background: { r: 230, g: 60, b: 60 },
      },
    })
      .jpeg({ quality: 86 })
      .toBuffer()
  );

  assert.equal(
    await compareTelegramProfilePhotoToApproved(unrelatedBytes, approvedPhotoPath),
    false
  );
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
