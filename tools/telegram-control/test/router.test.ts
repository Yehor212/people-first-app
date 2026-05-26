import assert from "node:assert/strict";
import test from "node:test";
import { routeRequest } from "../src/router";
import { listJobs } from "../src/storage";
import type { Env } from "../src/types";
import { FakeKvNamespace } from "./fake-kv";

void test("health reports missing GitHub configuration as not configured", async () => {
  const env: Env = { CONTROL_STATE: new FakeKvNamespace() };
  const response = await routeRequest(new Request("https://worker.test/health"), env);
  const payload = (await response.json()) as { github: { configured: boolean } };

  assert.equal(response.status, 200);
  assert.equal(payload.github.configured, false);
});

void test("unauthorized Telegram users are rejected before dispatch", async () => {
  const calls: Array<{ url: string; body: string }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString();
    const body = typeof init?.body === "string" ? init.body : "";
    calls.push({ url, body });
    return Response.json({ ok: true });
  });

  try {
    const env: Env = {
      TELEGRAM_BOT_TOKEN: "token",
      TELEGRAM_WEBHOOK_SECRET: "secret",
      TELEGRAM_ADMIN_IDS: "111",
      CONTROL_STATE: new FakeKvNamespace(),
    };
    const response = await routeRequest(
      new Request("https://worker.test/telegram/webhook", {
        method: "POST",
        headers: { "X-Telegram-Bot-Api-Secret-Token": "secret" },
        body: JSON.stringify({
          message: { text: "/fix bug", chat: { id: 1 }, from: { id: 999 } },
        }),
      }),
      env,
    );
    const payload = (await response.json()) as { rejected?: string };

    assert.equal(response.status, 200);
    assert.equal(payload.rejected, "unauthorized");
    assert.equal(calls.length, 1);
    assert.match(calls[0]?.body ?? "", /Unauthorized Telegram account/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test("missing Telegram webhook secret is rejected before message handling", async () => {
  const env: Env = {
    TELEGRAM_WEBHOOK_SECRET: "secret",
    TELEGRAM_ADMIN_IDS: "111",
    CONTROL_STATE: new FakeKvNamespace(),
  };
  const response = await routeRequest(
    new Request("https://worker.test/telegram/webhook", {
      method: "POST",
      body: JSON.stringify({
        message: { text: "/status", chat: { id: 1 }, from: { id: 111 } },
      }),
    }),
    env,
  );
  const payload = (await response.json()) as { error: string };

  assert.equal(response.status, 401);
  assert.equal(payload.error, "Invalid Telegram webhook secret");
});

void test("deploy command stops at approval gate before GitHub dispatch", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    calls.push(input instanceof Request ? input.url : input.toString());
    return Response.json({ ok: true });
  });

  try {
    const kv = new FakeKvNamespace();
    const env: Env = {
      TELEGRAM_BOT_TOKEN: "token",
      TELEGRAM_WEBHOOK_SECRET: "secret",
      TELEGRAM_ADMIN_IDS: "111",
      CONTROL_STATE: kv,
    };
    const response = await routeRequest(
      new Request("https://worker.test/telegram/webhook", {
        method: "POST",
        headers: { "X-Telegram-Bot-Api-Secret-Token": "secret" },
        body: JSON.stringify({
          message: { text: "/deploy production", chat: { id: 1 }, from: { id: 111 } },
        }),
      }),
      env,
    );
    const payload = (await response.json()) as { status: string };
    const [job] = await listJobs(env, 1);

    assert.equal(payload.status, "awaiting_approval");
    assert.equal(job?.status, "awaiting_approval");
    assert.equal(calls.every((url) => !url.includes("api.github.com")), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test("manual approve command validates nonce and starts approved job", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => Response.json({ ok: true }));

  try {
    const kv = new FakeKvNamespace();
    const env: Env = {
      TELEGRAM_BOT_TOKEN: "token",
      TELEGRAM_WEBHOOK_SECRET: "secret",
      TELEGRAM_ADMIN_IDS: "111",
      CONTROL_STATE: kv,
    };
    await routeRequest(
      new Request("https://worker.test/telegram/webhook", {
        method: "POST",
        headers: { "X-Telegram-Bot-Api-Secret-Token": "secret" },
        body: JSON.stringify({
          message: { text: "/deploy production", chat: { id: 1 }, from: { id: 111 } },
        }),
      }),
      env,
    );
    const [job] = await listJobs(env, 1);
    assert.equal(job?.status, "awaiting_approval");
    assert.equal(Boolean(job.approvalNonce), true);

    const response = await routeRequest(
      new Request("https://worker.test/telegram/webhook", {
        method: "POST",
        headers: { "X-Telegram-Bot-Api-Secret-Token": "secret" },
        body: JSON.stringify({
          message: {
            text: `/approve ${job.id} ${job.approvalNonce}`,
            chat: { id: 1 },
            from: { id: 111 },
          },
        }),
      }),
      env,
    );
    const payload = (await response.json()) as { status: string };

    assert.equal(payload.status, "unverified");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test("workflow callback updates matching job and keeps evidence", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => Response.json({ ok: true }));

  try {
    const kv = new FakeKvNamespace();
    const env: Env = {
      TELEGRAM_BOT_TOKEN: "token",
      TELEGRAM_WEBHOOK_SECRET: "secret",
      TELEGRAM_ADMIN_IDS: "111",
      TELEGRAM_CONTROL_CALLBACK_SECRET: "callback-secret",
      CONTROL_STATE: kv,
    };
    await routeRequest(
      new Request("https://worker.test/telegram/webhook", {
        method: "POST",
        headers: { "X-Telegram-Bot-Api-Secret-Token": "secret" },
        body: JSON.stringify({
          message: { text: "/fix failing test", chat: { id: 1 }, from: { id: 111 } },
        }),
      }),
      env,
    );
    const [job] = await listJobs(env, 1);
    assert.equal(job?.status, "unverified");

    const response = await routeRequest(
      new Request("https://worker.test/github/webhook", {
        method: "POST",
        headers: { "X-Zenflow-Control-Secret": "callback-secret" },
        body: JSON.stringify({
          job_id: job.id,
          status: "succeeded",
          pr_url: "https://github.com/Yehor212/people-first-app/pull/1",
          evidence: ["callback evidence"],
        }),
      }),
      env,
    );
    const payload = (await response.json()) as { status: string };
    const [updated] = await listJobs(env, 1);

    assert.equal(response.status, 200);
    assert.equal(payload.status, "succeeded");
    assert.equal(updated?.prUrl, "https://github.com/Yehor212/people-first-app/pull/1");
    assert.equal(updated?.evidence.includes("callback evidence"), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
