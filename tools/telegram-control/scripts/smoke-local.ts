import { routeRequest } from "../src/router";
import { listJobs } from "../src/storage";
import type { Env, KvNamespace } from "../src/types";

class SmokeKvNamespace implements KvNamespace {
  private readonly values = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }

  async list(options: { prefix?: string; limit?: number } = {}): Promise<{ keys: Array<{ name: string }> }> {
    const keys = [...this.values.keys()]
      .filter((key) => (options.prefix ? key.startsWith(options.prefix) : true))
      .slice(0, options.limit ?? 1000)
      .map((name) => ({ name }));
    return { keys };
  }
}

const sentTelegramMessages: string[] = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = input instanceof Request ? input.url : input.toString();
  if (url.includes("api.github.com")) {
    throw new Error("Smoke should not call GitHub without configured GitHub App credentials");
  }
  if (url.includes("api.telegram.org")) {
    sentTelegramMessages.push(typeof init?.body === "string" ? init.body : "");
  }
  return Response.json({ ok: true });
});

try {
  const env: Env = {
    TELEGRAM_BOT_TOKEN: "local-smoke-token",
    TELEGRAM_WEBHOOK_SECRET: "local-smoke-webhook-secret",
    TELEGRAM_ADMIN_IDS: "111",
    TELEGRAM_CONTROL_CALLBACK_SECRET: "local-smoke-callback-secret",
    CONTROL_STATE: new SmokeKvNamespace(),
  };

  await expectStatus("health", routeRequest(new Request("https://worker.test/health"), env), 200);

  const unauthorized = await telegram(env, "/status", 999);
  assertEqual("unauthorized rejected", unauthorized.rejected, "unauthorized");

  const status = await telegram(env, "/status", 111);
  assertEqual("status command handled", status.ok, true);
  assertIncludes("status reports unverified GitHub config", sentTelegramMessages.join("\n"), "UNVERIFIED");

  const deploy = await telegram(env, "/deploy production", 111);
  assertEqual("deploy awaits approval", deploy.status, "awaiting_approval");

  const [job] = await listJobs(env, 1);
  if (!job?.approvalNonce) {
    throw new Error("Expected deploy job with approval nonce");
  }

  const approved = await telegram(env, `/approve ${job.id} ${job.approvalNonce}`, 111);
  assertEqual("approved job reports unverified GitHub config", approved.status, "unverified");

  const callback = await routeRequest(
    new Request("https://worker.test/github/webhook", {
      method: "POST",
      headers: { "X-Zenflow-Control-Secret": "local-smoke-callback-secret" },
      body: JSON.stringify({
        job_id: job.id,
        status: "succeeded",
        pr_url: "https://github.com/Yehor212/people-first-app/pull/123",
        evidence: ["local smoke callback"],
      }),
    }),
    env,
  );
  const callbackPayload = (await callback.json()) as { status?: string };
  assertEqual("workflow callback succeeds", callbackPayload.status, "succeeded");

  console.log("Telegram control local smoke PASS - health, auth rejection, status, approval, and callback verified.");
} finally {
  globalThis.fetch = originalFetch;
}

async function telegram(env: Env, text: string, userId: number): Promise<Record<string, unknown>> {
  const response = await routeRequest(
    new Request("https://worker.test/telegram/webhook", {
      method: "POST",
      headers: { "X-Telegram-Bot-Api-Secret-Token": "local-smoke-webhook-secret" },
      body: JSON.stringify({
        message: { text, chat: { id: 1 }, from: { id: userId } },
      }),
    }),
    env,
  );
  return response.json() as Promise<Record<string, unknown>>;
}

async function expectStatus(name: string, responsePromise: Promise<Response>, expected: number): Promise<void> {
  const response = await responsePromise;
  assertEqual(`${name} status`, response.status, expected);
}

function assertEqual(name: string, actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`${name} failed: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertIncludes(name: string, actual: string, expected: string): void {
  if (!actual.includes(expected)) {
    throw new Error(`${name} failed: missing ${expected}`);
  }
}
