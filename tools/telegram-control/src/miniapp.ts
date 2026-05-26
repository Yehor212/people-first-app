import { isDispatchableKind, parseCommand } from "./commands";
import { createControlJob, startJob } from "./control";
import { githubConfigStatus, isGitHubConfigured } from "./github";
import { isAuthorizedTelegramUser, safeEqual } from "./security";
import { getLatestJob, listJobs, saveJob } from "./storage";
import { approvalKeyboard, sendTelegramMessage } from "./telegram";
import type { Env } from "./types";

const encoder = new TextEncoder();
const MAX_INIT_DATA_AGE_SECONDS = 60 * 60;
// Public Telegram Mini App validation label from the Web Apps spec; not a secret.
const TELEGRAM_WEBAPP_DATA_LABEL_BYTES = new Uint8Array([
  87, 101, 98, 65, 112, 112, 68, 97, 116, 97,
]);

export interface MiniAppSession {
  telegramUserId: number;
  authDate: number;
}

export async function handleMiniApp(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/miniapp") {
    return html(renderMiniAppHtml());
  }

  if (request.method === "POST" && url.pathname === "/miniapp/state") {
    const session = await authorizeMiniAppRequest(request, env);
    if (session instanceof Response) {
      return session;
    }

    return json(await miniAppState(env, session));
  }

  if (request.method === "POST" && url.pathname === "/miniapp/command") {
    const session = await authorizeMiniAppRequest(request, env);
    if (session instanceof Response) {
      return session;
    }

    let body: { command?: string };
    try {
      body = (await request.json()) as { command?: string };
    } catch {
      return json({ ok: false, error: "Invalid JSON body" }, 400);
    }
    return handleMiniAppCommand(env, session, body.command ?? "");
  }

  return json({ ok: false, error: "Not found" }, 404);
}

export async function authorizeMiniAppRequest(request: Request, env: Env): Promise<MiniAppSession | Response> {
  const rawAuth = request.headers.get("Authorization") ?? "";
  const match = /^tma\s+(.+)$/i.exec(rawAuth);

  if (!match) {
    return json({ ok: false, error: "Missing Telegram Mini App init data" }, 401);
  }

  const validation = await validateTelegramInitData(match[1] ?? "", env);
  if (!validation.ok) {
    return json({ ok: false, error: validation.error }, 401);
  }

  if (!isAuthorizedTelegramUser(env, validation.telegramUserId)) {
    return json({ ok: false, error: "Unauthorized Telegram account" }, 403);
  }

  return {
    telegramUserId: validation.telegramUserId,
    authDate: validation.authDate,
  };
}

export async function validateTelegramInitData(
  initData: string,
  env: Pick<Env, "TELEGRAM_BOT_TOKEN">,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<{ ok: true; telegramUserId: number; authDate: number } | { ok: false; error: string }> {
  if (!env.TELEGRAM_BOT_TOKEN) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN is not configured" };
  }

  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash") ?? "";
  const authDate = Number(params.get("auth_date") ?? "0");
  const userRaw = params.get("user");

  if (!receivedHash || !authDate || !userRaw) {
    return { ok: false, error: "Mini App init data is incomplete" };
  }

  if (nowSeconds - authDate > MAX_INIT_DATA_AGE_SECONDS) {
    return { ok: false, error: "Mini App init data is expired" };
  }

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const computedHash = await computeTelegramMiniAppHash(env.TELEGRAM_BOT_TOKEN, dataCheckString);

  if (!safeEqual(receivedHash, computedHash)) {
    return { ok: false, error: "Mini App init data signature mismatch" };
  }

  let user: { id?: unknown };
  try {
    user = JSON.parse(userRaw) as { id?: unknown };
  } catch {
    return { ok: false, error: "Mini App init data user is invalid JSON" };
  }
  if (typeof user.id !== "number" || !Number.isSafeInteger(user.id)) {
    return { ok: false, error: "Mini App init data user id is invalid" };
  }

  return { ok: true, telegramUserId: user.id, authDate };
}

async function miniAppState(env: Env, session: MiniAppSession): Promise<Record<string, unknown>> {
  const jobs = await listJobs(env, 8);
  const latestJob = await getLatestJob(env);

  return {
    ok: true,
    user: { id: session.telegramUserId },
    health: {
      telegramBot: Boolean(env.TELEGRAM_BOT_TOKEN),
      admins: Boolean(env.TELEGRAM_ADMIN_IDS),
      githubConfigured: isGitHubConfigured(env),
      githubSecrets: githubConfigStatus(env),
      kv: Boolean(env.CONTROL_STATE),
      workflow: Boolean(env.CONTROL_WORKFLOW),
      latestJob: latestJob
        ? {
            id: latestJob.id,
            status: latestJob.status,
            updatedAt: latestJob.updatedAt,
          }
        : null,
    },
    jobs: jobs.map((job) => ({
      id: job.id,
      status: job.status,
      kind: job.intent.kind,
      branch: job.branch,
      prUrl: job.prUrl,
      updatedAt: job.updatedAt,
    })),
  };
}

async function handleMiniAppCommand(env: Env, session: MiniAppSession, rawCommand: string): Promise<Response> {
  const intent = parseCommand(rawCommand, env.GITHUB_BASE_REF ?? "main");

  if (intent.kind === "ask") {
    return json({ ok: true, status: "ASK", message: "Command needs clarification" });
  }

  if (intent.kind === "health") {
    return json(await miniAppState(env, session));
  }

  if (intent.kind === "status" || intent.kind === "jobs") {
    return json({
      ok: true,
      status: "succeeded",
      ...(await miniAppState(env, session)),
    });
  }

  if (!isDispatchableKind(intent.kind)) {
    return json({ ok: true, status: "ASK", message: "Command is not dispatchable from Mini App" });
  }

  if (!env.CONTROL_STATE) {
    return json({
      ok: true,
      status: "unverified",
      message: "UNVERIFIED: CONTROL_STATE KV binding is not configured; no Telegram control job was started.",
    });
  }

  const job = createControlJob(intent, session.telegramUserId, session.telegramUserId);
  await saveJob(env, job);

  if (job.status === "awaiting_approval") {
    await sendTelegramMessage(
      env,
      session.telegramUserId,
      [
        `Confirmation required for ${intent.kind}.`,
        `Job: ${job.id}`,
        intent.prompt ? `Prompt: ${intent.prompt.slice(0, 500)}` : "Prompt: none",
      ].join("\n"),
      approvalKeyboard(job),
    );
    return json({ ok: true, job_id: job.id, status: job.status });
  }

  const started = await startJob(env, job);
  return json({ ok: true, job_id: started.id, status: started.status, evidence: started.evidence });
}

function renderMiniAppHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ZenFlow Control</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <style>
    :root {
      color-scheme: light dark;
      font-family: system-ui, sans-serif;
      background: var(--tg-theme-bg-color, Canvas);
      color: var(--tg-theme-text-color, CanvasText);
    }
    body { margin: 0; padding: 16px; background: var(--tg-theme-bg-color, Canvas); color: var(--tg-theme-text-color, CanvasText); }
    main { display: grid; gap: 12px; max-width: 720px; margin: 0 auto; }
    section { border: 1px solid var(--tg-theme-section-separator-color, ButtonBorder); border-radius: 8px; padding: 12px; background: var(--tg-theme-secondary-bg-color, Canvas); }
    h1, h2 { margin: 0 0 8px; font-size: 18px; }
    h2 { font-size: 15px; }
    textarea { box-sizing: border-box; min-height: 84px; resize: vertical; width: 100%; border-radius: 8px; border: 1px solid var(--tg-theme-section-separator-color, ButtonBorder); padding: 10px; background: var(--tg-theme-bg-color, Field); color: var(--tg-theme-text-color, FieldText); }
    button { min-height: 44px; border: 0; border-radius: 8px; padding: 0 12px; background: var(--tg-theme-button-color, ButtonFace); color: var(--tg-theme-button-text-color, ButtonText); font-weight: 600; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0; font-size: 12px; }
    .muted { color: var(--tg-theme-hint-color, GrayText); }
  </style>
</head>
<body>
  <main>
    <section>
      <h1>ZenFlow Control</h1>
      <p class="muted">Telegram verified operations only.</p>
    </section>
    <section>
      <h2>Command</h2>
      <textarea id="command" placeholder="/status"></textarea>
      <div class="grid">
        <button data-command="/status">Status</button>
        <button data-command="/jobs">Jobs</button>
        <button data-command="/test">Test</button>
        <button data-command="/security">Security</button>
      </div>
      <button id="run">Run</button>
    </section>
    <section>
      <h2>Output</h2>
      <pre id="output">Loading...</pre>
    </section>
  </main>
  <script>
    const app = window.Telegram && window.Telegram.WebApp;
    const output = document.getElementById('output');
    const command = document.getElementById('command');
    const auth = () => ({ Authorization: 'tma ' + (app ? app.initData : '') });
    const show = (value) => { output.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2); };
    if (app) { app.ready(); app.expand(); }
    async function post(path, body) {
      const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() }, body: JSON.stringify(body || {}) });
      show(await response.json());
    }
    document.querySelectorAll('[data-command]').forEach((button) => button.addEventListener('click', () => { command.value = button.dataset.command; }));
    document.getElementById('run').addEventListener('click', () => post('/miniapp/command', { command: command.value || '/status' }));
    post('/miniapp/state');
  </script>
</body>
</html>`;
}

export async function computeTelegramMiniAppHash(botToken: string, dataCheckString: string): Promise<string> {
  const secretKey = await deriveTelegramMiniAppSecret(botToken);
  return hmacHex(secretKey, dataCheckString);
}

async function hmacBytes(key: Uint8Array, message: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    copyBytes(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  return new Uint8Array(signature);
}

function copyBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes);
}

async function hmacHex(key: Uint8Array, message: string): Promise<string> {
  const bytes = await hmacBytes(key, message);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function deriveTelegramMiniAppSecret(botToken: string): Promise<Uint8Array> {
  return hmacBytes(TELEGRAM_WEBAPP_DATA_LABEL_BYTES, botToken);
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

function html(value: string): Response {
  return new Response(value, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
      "X-Frame-Options": "DENY",
    },
  });
}
