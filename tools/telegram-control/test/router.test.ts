import assert from "node:assert/strict";
import test from "node:test";
import { parseCommand } from "../src/commands";
import { createControlJob } from "../src/control";
import { routeRequest } from "../src/router";
import { getJob, listJobs, saveJob } from "../src/storage";
import type { Env } from "../src/types";
import { FakeKvNamespace } from "./fake-kv";

const encoder = new TextEncoder();

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

void test("duplicate Telegram update ids do not execute side effects twice", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; body: string }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: input instanceof Request ? input.url : input.toString(),
      body: typeof init?.body === "string" ? init.body : "",
    });
    return Response.json({ ok: true });
  });

  try {
    const env: Env = {
      TELEGRAM_BOT_TOKEN: "token",
      TELEGRAM_WEBHOOK_SECRET: "secret",
      TELEGRAM_ADMIN_IDS: "111",
      CONTROL_STATE: new FakeKvNamespace(),
    };
    const body = JSON.stringify({
      update_id: 9001,
      message: { text: "/status", chat: { id: 1 }, from: { id: 111 } },
    });

    const first = await routeRequest(
      new Request("https://worker.test/telegram/webhook", {
        method: "POST",
        headers: { "X-Telegram-Bot-Api-Secret-Token": "secret" },
        body,
      }),
      env,
    );
    const second = await routeRequest(
      new Request("https://worker.test/telegram/webhook", {
        method: "POST",
        headers: { "X-Telegram-Bot-Api-Secret-Token": "secret" },
        body,
      }),
      env,
    );
    const duplicate = (await second.json()) as { duplicate?: boolean };

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(duplicate.duplicate, true);
    assert.equal(calls.length, 1);
    assert.match(calls[0]?.body ?? "", /UNVERIFIED: GitHub App credentials are not configured/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test("dispatchable chat command is UNVERIFIED without KV and never reaches GitHub", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    calls.push(input instanceof Request ? input.url : input.toString());
    return Response.json({ ok: true });
  });

  try {
    const env: Env = {
      TELEGRAM_BOT_TOKEN: "token",
      TELEGRAM_WEBHOOK_SECRET: "secret",
      TELEGRAM_ADMIN_IDS: "111",
      GITHUB_APP_ID: "1",
      GITHUB_INSTALLATION_ID: "2",
      GITHUB_APP_PRIVATE_KEY: crypto.randomUUID(),
      GITHUB_WEBHOOK_SECRET: crypto.randomUUID(),
    };
    const response = await routeRequest(
      new Request("https://worker.test/telegram/webhook", {
        method: "POST",
        headers: { "X-Telegram-Bot-Api-Secret-Token": "secret" },
        body: JSON.stringify({
          update_id: 9002,
          message: { text: "/fix typo", chat: { id: 1 }, from: { id: 111 } },
        }),
      }),
      env,
    );
    const payload = (await response.json()) as { status: string };

    assert.equal(response.status, 200);
    assert.equal(payload.status, "unverified");
    assert.equal(calls.some((url) => url.includes("api.github.com")), false);
    assert.equal(calls.some((url) => url.includes("api.telegram.org")), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
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

void test("manual cancel can stop a non-destructive queued job without a nonce", async () => {
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
    const job = createControlJob(parseCommand("/fix typo"), 111, 1);
    await saveJob(env, job);

    const response = await routeRequest(
      new Request("https://worker.test/telegram/webhook", {
        method: "POST",
        headers: { "X-Telegram-Bot-Api-Secret-Token": "secret" },
        body: JSON.stringify({
          update_id: 9100,
          message: {
            text: `/cancel ${job.id}`,
            chat: { id: 1 },
            from: { id: 111 },
          },
        }),
      }),
      env,
    );
    const payload = (await response.json()) as { status: string };
    const updated = await getJob(env, job.id);

    assert.equal(response.status, 200);
    assert.equal(payload.status, "cancelled");
    assert.equal(updated?.status, "cancelled");
    assert.equal(updated?.approvals.at(-1)?.action, "cancel");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test("manual cancel reports UNVERIFIED when a known GitHub run cannot be cancelled", async () => {
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
    const job = { ...createControlJob(parseCommand("/fix typo"), 111, 1), githubRunId: 123 };
    await saveJob(env, job);

    const response = await routeRequest(
      new Request("https://worker.test/telegram/webhook", {
        method: "POST",
        headers: { "X-Telegram-Bot-Api-Secret-Token": "secret" },
        body: JSON.stringify({
          update_id: 9101,
          message: {
            text: `/cancel ${job.id}`,
            chat: { id: 1 },
            from: { id: 111 },
          },
        }),
      }),
      env,
    );
    const payload = (await response.json()) as { status: string };
    const updated = await getJob(env, job.id);

    assert.equal(response.status, 200);
    assert.equal(payload.status, "unverified");
    assert.equal(updated?.status, "unverified");
    assert.equal(
      updated?.evidence.some((entry) => entry.includes("UNVERIFIED: GitHub App credentials are not configured")),
      true,
    );
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

void test("GitHub workflow_run webhook updates the matching branch instead of the latest job", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => Response.json({ ok: true }));

  try {
    const kv = new FakeKvNamespace();
    const env: Env = {
      TELEGRAM_BOT_TOKEN: "token",
      GITHUB_WEBHOOK_SECRET: "github-secret",
      CONTROL_STATE: kv,
    };
    const first = createControlJob(parseCommand("/fix first bug"), 111, 1);
    const latest = createControlJob(parseCommand("/fix latest bug"), 111, 1);
    await saveJob(env, first);
    await saveJob(env, latest);

    const body = JSON.stringify({
      workflow_run: {
        id: 123,
        html_url: "https://github.com/Yehor212/people-first-app/actions/runs/123",
        head_branch: first.branch,
        status: "completed",
        conclusion: "success",
      },
    });
    const response = await routeRequest(
      new Request("https://worker.test/github/webhook", {
        method: "POST",
        headers: {
          "X-GitHub-Event": "workflow_run",
          "X-Hub-Signature-256": await githubSignature("github-secret", body),
        },
        body,
      }),
      env,
    );
    const updatedFirst = await getJob(env, first.id);
    const untouchedLatest = await getJob(env, latest.id);

    assert.equal(response.status, 200);
    assert.equal(updatedFirst?.status, "succeeded");
    assert.equal(updatedFirst?.githubRunId, 123);
    assert.equal(untouchedLatest?.status, "queued");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

async function githubSignature(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const hex = [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `sha256=${hex}`;
}
