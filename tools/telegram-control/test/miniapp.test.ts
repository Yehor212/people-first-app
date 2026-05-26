import assert from "node:assert/strict";
import test from "node:test";
import { computeTelegramMiniAppHash } from "../src/miniapp";
import { routeRequest } from "../src/router";
import { listJobs } from "../src/storage";
import type { Env } from "../src/types";
import { FakeKvNamespace } from "./fake-kv";

void test("miniapp HTML is served without exposing secrets", async () => {
  const response = await routeRequest(new Request("https://worker.test/miniapp"), {});
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /telegram-web-app\.js/);
  assert.doesNotMatch(html, /--tg-theme-[a-z-]+_[a-z-]+/);
  assert.doesNotMatch(html, /TELEGRAM_BOT_TOKEN/);
});

void test("miniapp state requires Telegram init data", async () => {
  const response = await routeRequest(
    new Request("https://worker.test/miniapp/state", { method: "POST" }),
    {},
  );
  const payload = (await response.json()) as { error: string };

  assert.equal(response.status, 401);
  assert.equal(payload.error, "Missing Telegram Mini App init data");
});

void test("miniapp state accepts signed init data for allowlisted admin", async () => {
  const env: Env = {
    TELEGRAM_BOT_TOKEN: "bot-token",
    TELEGRAM_ADMIN_IDS: "111",
    CONTROL_STATE: new FakeKvNamespace(),
  };
  const initData = await signInitData("bot-token", 111);
  const response = await routeRequest(
    new Request("https://worker.test/miniapp/state", {
      method: "POST",
      headers: { Authorization: `tma ${initData}` },
    }),
    env,
  );
  const payload = (await response.json()) as { ok: boolean; user: { id: number } };

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.user.id, 111);
});

void test("miniapp state reports GitHub health fields consistently", async () => {
  const env: Env = {
    TELEGRAM_BOT_TOKEN: "bot-token",
    TELEGRAM_ADMIN_IDS: "111",
    CONTROL_STATE: new FakeKvNamespace(),
  };
  const initData = await signInitData("bot-token", 111);
  const response = await routeRequest(
    new Request("https://worker.test/miniapp/state", {
      method: "POST",
      headers: { Authorization: `tma ${initData}` },
    }),
    env,
  );
  const payload = (await response.json()) as {
    health: {
      githubConfigured: boolean;
      githubAppConfigured: boolean;
      githubWebhookConfigured: boolean;
      github: { configured: boolean; appConfigured: boolean; webhookConfigured: boolean };
    };
  };

  assert.equal(response.status, 200);
  assert.equal(payload.health.githubConfigured, false);
  assert.equal(payload.health.githubAppConfigured, false);
  assert.equal(payload.health.githubWebhookConfigured, false);
  assert.equal(payload.health.github.configured, false);
  assert.equal(payload.health.github.appConfigured, false);
  assert.equal(payload.health.github.webhookConfigured, false);
});

void test("miniapp command rejects non-admin signed user", async () => {
  const env: Env = {
    TELEGRAM_BOT_TOKEN: "bot-token",
    TELEGRAM_ADMIN_IDS: "111",
    CONTROL_STATE: new FakeKvNamespace(),
  };
  const initData = await signInitData("bot-token", 999);
  const response = await routeRequest(
    new Request("https://worker.test/miniapp/command", {
      method: "POST",
      headers: { Authorization: `tma ${initData}`, "Content-Type": "application/json" },
      body: JSON.stringify({ command: "/status" }),
    }),
    env,
  );
  const payload = (await response.json()) as { error: string };

  assert.equal(response.status, 403);
  assert.equal(payload.error, "Unauthorized Telegram account");
});

void test("miniapp state rejects expired signed init data", async () => {
  const env: Env = {
    TELEGRAM_BOT_TOKEN: "bot-token",
    TELEGRAM_ADMIN_IDS: "111",
    CONTROL_STATE: new FakeKvNamespace(),
  };
  const now = Math.floor(Date.now() / 1000);
  const initData = await signInitData("bot-token", 111, now - 3601);
  const response = await routeRequest(
    new Request("https://worker.test/miniapp/state", {
      method: "POST",
      headers: { Authorization: `tma ${initData}` },
    }),
    env,
  );
  const payload = (await response.json()) as { error: string };

  assert.equal(response.status, 401);
  assert.equal(payload.error, "Mini App init data is expired");
});

void test("miniapp state rejects malformed signed user JSON", async () => {
  const env: Env = {
    TELEGRAM_BOT_TOKEN: "bot-token",
    TELEGRAM_ADMIN_IDS: "111",
    CONTROL_STATE: new FakeKvNamespace(),
  };
  const initData = await signInitData("bot-token", 111, Math.floor(Date.now() / 1000), "{bad-json");
  const response = await routeRequest(
    new Request("https://worker.test/miniapp/state", {
      method: "POST",
      headers: { Authorization: `tma ${initData}` },
    }),
    env,
  );
  const payload = (await response.json()) as { error: string };

  assert.equal(response.status, 401);
  assert.equal(payload.error, "Mini App init data user is invalid JSON");
});

void test("miniapp command rejects invalid JSON body", async () => {
  const env: Env = {
    TELEGRAM_BOT_TOKEN: "bot-token",
    TELEGRAM_ADMIN_IDS: "111",
    CONTROL_STATE: new FakeKvNamespace(),
  };
  const initData = await signInitData("bot-token", 111);
  const response = await routeRequest(
    new Request("https://worker.test/miniapp/command", {
      method: "POST",
      headers: { Authorization: `tma ${initData}`, "Content-Type": "application/json" },
      body: "{bad-json",
    }),
    env,
  );
  const payload = (await response.json()) as { error: string };

  assert.equal(response.status, 400);
  assert.equal(payload.error, "Invalid JSON body");
});

void test("miniapp deploy command creates approval-gated job", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input: string | URL | Request, _init?: RequestInit) => Response.json({ ok: true });

  try {
    const env: Env = {
      TELEGRAM_BOT_TOKEN: "bot-token",
      TELEGRAM_ADMIN_IDS: "111",
      CONTROL_STATE: new FakeKvNamespace(),
    };
    const initData = await signInitData("bot-token", 111);
    const response = await routeRequest(
      new Request("https://worker.test/miniapp/command", {
        method: "POST",
        headers: { Authorization: `tma ${initData}`, "Content-Type": "application/json" },
        body: JSON.stringify({ command: "/deploy production" }),
      }),
      env,
    );
    const payload = (await response.json()) as { status: string };
    const [job] = await listJobs(env, 1);

    assert.equal(response.status, 200);
    assert.equal(payload.status, "awaiting_approval");
    assert.equal(job?.status, "awaiting_approval");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test("miniapp dispatchable command is UNVERIFIED without KV", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input: string | URL | Request, _init?: RequestInit) => {
    calls.push(input instanceof Request ? input.url : input.toString());
    return Response.json({ ok: true });
  };

  try {
    const env: Env = {
      TELEGRAM_BOT_TOKEN: "bot-token",
      TELEGRAM_ADMIN_IDS: "111",
      GITHUB_APP_ID: "1",
      GITHUB_INSTALLATION_ID: "2",
      GITHUB_APP_PRIVATE_KEY: crypto.randomUUID(),
      GITHUB_WEBHOOK_SECRET: crypto.randomUUID(),
    };
    const initData = await signInitData("bot-token", 111);
    const response = await routeRequest(
      new Request("https://worker.test/miniapp/command", {
        method: "POST",
        headers: { Authorization: `tma ${initData}`, "Content-Type": "application/json" },
        body: JSON.stringify({ command: "/fix typo" }),
      }),
      env,
    );
    const payload = (await response.json()) as { status: string; message: string };

    assert.equal(response.status, 200);
    assert.equal(payload.status, "unverified");
    assert.match(payload.message, /CONTROL_STATE KV binding is not configured/);
    assert.equal(calls.some((url) => url.includes("api.github.com")), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

async function signInitData(
  botToken: string,
  userId: number,
  authDate = Math.floor(Date.now() / 1000),
  userRaw = JSON.stringify({ id: userId, first_name: "Admin" }),
): Promise<string> {
  const params = new URLSearchParams({
    auth_date: String(authDate),
    query_id: "query",
    user: userRaw,
  });
  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const hash = await computeTelegramMiniAppHash(botToken, dataCheckString);
  params.set("hash", hash);
  return params.toString();
}
