import { isDispatchableKind, parseCommand } from "./commands";
import { approveJob, createControlJob, denyOrCancelJob, startJob, updateJob } from "./control";
import { getLatestWorkflowRuns, githubConfigStatus, isGitHubConfigured } from "./github";
import {
  isAuthorizedTelegramUser,
  safeEqual,
  verifyGitHubWebhookSignature,
  verifyTelegramWebhook,
  verifyWorkflowCallbackSecret,
} from "./security";
import { getJob, getLatestJob, listJobs, saveJob } from "./storage";
import {
  answerCallbackQuery,
  approvalKeyboard,
  getTelegramChatId,
  getTelegramText,
  getTelegramUser,
  parseCallbackData,
  sendTelegramMessage,
  type TelegramUpdate,
} from "./telegram";
import type { Env, WorkflowCallbackPayload } from "./types";

export async function routeRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/health") {
    return json(await health(env));
  }

  if (request.method === "POST" && url.pathname === "/telegram/webhook") {
    return handleTelegramWebhook(request, env);
  }

  if (request.method === "POST" && url.pathname === "/github/webhook") {
    return handleGitHubWebhook(request, env);
  }

  return json({ ok: false, error: "Not found" }, 404);
}

export async function handleTelegramWebhook(request: Request, env: Env): Promise<Response> {
  if (!verifyTelegramWebhook(request, env)) {
    return json({ ok: false, error: "Invalid Telegram webhook secret" }, 401);
  }

  const update = (await request.json()) as TelegramUpdate;
  const user = getTelegramUser(update);
  const chatId = getTelegramChatId(update);

  if (!user || chatId === null) {
    return json({ ok: true, ignored: "missing user or chat" });
  }

  if (!isAuthorizedTelegramUser(env, user.id)) {
    await sendTelegramMessage(env, chatId, "Unauthorized Telegram account. This control plane is admin-only.");
    return json({ ok: true, rejected: "unauthorized" });
  }

  if (update.callback_query) {
    return handleTelegramCallback(env, update.callback_query.id, update.callback_query.data, user.id, chatId);
  }

  const text = getTelegramText(update);
  const intent = parseCommand(text, env.GITHUB_BASE_REF ?? "main");

  if (intent.kind === "ask") {
    await sendTelegramMessage(
      env,
      chatId,
      "ASK: I could not map that to a safe command. Use /plan, /fix, /review, /test, /security, /status, /deploy, or /rollback.",
    );
    return json({ ok: true, status: "ASK" });
  }

  if (intent.kind === "health") {
    await sendTelegramMessage(env, chatId, formatHealth(await health(env)));
    return json({ ok: true });
  }

  if (intent.kind === "status") {
    await sendTelegramMessage(env, chatId, await formatStatus(env));
    return json({ ok: true });
  }

  if (intent.kind === "jobs") {
    await sendTelegramMessage(env, chatId, await formatJobs(env));
    return json({ ok: true });
  }

  if (intent.kind === "cancel" || intent.kind === "approve" || intent.kind === "deny") {
    return handleManualSignal(env, intent.kind, intent.prompt, user.id, chatId);
  }

  if (!isDispatchableKind(intent.kind)) {
    await sendTelegramMessage(env, chatId, "ASK: This command is recognized but not dispatchable.");
    return json({ ok: true, status: "ASK" });
  }

  const job = createControlJob(intent, user.id, chatId);
  await saveJob(env, job);

  if (job.status === "awaiting_approval") {
    await sendTelegramMessage(
      env,
      chatId,
      formatApprovalRequest(job.id, intent.kind, intent.prompt),
      approvalKeyboard(job),
    );
    return json({ ok: true, job_id: job.id, status: job.status });
  }

  const started = await startJob(env, job);
  await sendTelegramMessage(env, chatId, formatJobStarted(started));
  return json({ ok: true, job_id: started.id, status: started.status });
}

async function handleTelegramCallback(
  env: Env,
  callbackQueryId: string,
  data: string,
  telegramUserId: number,
  chatId: number | string,
): Promise<Response> {
  const signal = parseCallbackData(data);
  if (!signal) {
    await answerCallbackQuery(env, callbackQueryId, "Invalid control action.");
    return json({ ok: true, ignored: "invalid callback" });
  }

  const job = await getJob(env, signal.jobId);
  if (!job) {
    await answerCallbackQuery(env, callbackQueryId, "Job not found.");
    return json({ ok: true, ignored: "missing job" });
  }

  if (!safeEqual(job.approvalNonce, signal.nonce)) {
    await answerCallbackQuery(env, callbackQueryId, "Approval nonce mismatch.");
    return json({ ok: true, rejected: "nonce mismatch" });
  }

  if (signal.action === "approve") {
    const approved = approveJob(job, telegramUserId, signal.nonce);
    await saveJob(env, approved);
    const started = await startJob(env, approved);
    await answerCallbackQuery(env, callbackQueryId, "Approved.");
    await sendTelegramMessage(env, chatId, formatJobStarted(started));
    return json({ ok: true, job_id: started.id, status: started.status });
  }

  const updated = denyOrCancelJob(job, signal.action, telegramUserId, signal.nonce);
  await saveJob(env, updated);
  await answerCallbackQuery(env, callbackQueryId, signal.action === "deny" ? "Denied." : "Cancelled.");
  await sendTelegramMessage(env, chatId, `Job ${updated.id} is ${updated.status}.`);
  return json({ ok: true, job_id: updated.id, status: updated.status });
}

export async function handleGitHubWebhook(request: Request, env: Env): Promise<Response> {
  const rawBody = await request.text();

  if (verifyWorkflowCallbackSecret(request, env)) {
    const payload = JSON.parse(rawBody) as WorkflowCallbackPayload;
    return handleWorkflowCallback(env, payload);
  }

  if (!(await verifyGitHubWebhookSignature(request, env, rawBody))) {
    return json({ ok: false, error: "Invalid GitHub webhook signature" }, 401);
  }

  const event = request.headers.get("X-GitHub-Event") ?? "unknown";
  const payload = JSON.parse(rawBody) as {
    workflow_run?: {
      id?: number;
      html_url?: string;
      head_branch?: string;
      status?: string;
      conclusion?: string;
    };
  };
  const latest = await getLatestJob(env);

  if (
    latest &&
    payload.workflow_run?.id &&
    (latest.githubRunId === payload.workflow_run.id || latest.branch === payload.workflow_run.head_branch)
  ) {
    const updated = updateJob(latest, mapGitHubStatus(payload.workflow_run.status, payload.workflow_run.conclusion), [
      `GitHub ${event}: ${payload.workflow_run.status ?? "unknown"} / ${payload.workflow_run.conclusion ?? "none"}`,
    ]);
    updated.githubRunId = payload.workflow_run.id;
    updated.githubRunUrl = payload.workflow_run.html_url;
    await saveJob(env, updated);
    await sendTelegramMessage(env, updated.chatId, formatJobUpdate(updated.id, updated.status, updated.githubRunUrl));
  }

  return json({ ok: true, event });
}

async function handleManualSignal(
  env: Env,
  action: "approve" | "deny" | "cancel",
  prompt: string,
  telegramUserId: number,
  chatId: number | string,
): Promise<Response> {
  const [jobId, nonce] = prompt.trim().split(/\s+/);
  if (!jobId || !nonce) {
    await sendTelegramMessage(env, chatId, `ASK: use /${action} <job_id> <nonce>, or press the inline approval button.`);
    return json({ ok: true, status: "ASK" });
  }

  const job = await getJob(env, jobId);
  if (!job) {
    await sendTelegramMessage(env, chatId, `Job ${jobId} was not found.`);
    return json({ ok: true, ignored: "missing job" });
  }

  if (!safeEqual(job.approvalNonce, nonce)) {
    await sendTelegramMessage(env, chatId, "Approval nonce mismatch.");
    return json({ ok: true, rejected: "nonce mismatch" });
  }

  if (action === "approve") {
    const approved = approveJob(job, telegramUserId, nonce);
    await saveJob(env, approved);
    const started = await startJob(env, approved);
    await sendTelegramMessage(env, chatId, formatJobStarted(started));
    return json({ ok: true, job_id: started.id, status: started.status });
  }

  const updated = denyOrCancelJob(job, action, telegramUserId, nonce);
  await saveJob(env, updated);
  await sendTelegramMessage(env, chatId, `Job ${updated.id} is ${updated.status}.`);
  return json({ ok: true, job_id: updated.id, status: updated.status });
}

async function handleWorkflowCallback(env: Env, payload: WorkflowCallbackPayload): Promise<Response> {
  const job = await getJob(env, payload.job_id);
  if (!job) {
    return json({ ok: false, error: "Job not found" }, 404);
  }

  const status = payload.status === "UNVERIFIED" ? "unverified" : payload.status;
  const updated = updateJob(job, status, payload.evidence ?? [`Workflow callback: ${status}`]);
  updated.githubRunId = payload.github_run_id ?? updated.githubRunId;
  updated.githubRunUrl = payload.github_run_url ?? updated.githubRunUrl;
  updated.branch = payload.branch ?? updated.branch;
  updated.prUrl = payload.pr_url ?? updated.prUrl;
  await saveJob(env, updated);
  await sendTelegramMessage(env, updated.chatId, formatJobUpdate(updated.id, updated.status, updated.prUrl ?? updated.githubRunUrl));
  return json({ ok: true, job_id: updated.id, status: updated.status });
}

async function health(env: Env): Promise<Record<string, unknown>> {
  const latestJob = await getLatestJob(env);
  return {
    ok: true,
    worker: "zenflow-telegram-control",
    telegram: {
      botToken: Boolean(env.TELEGRAM_BOT_TOKEN),
      webhookSecret: Boolean(env.TELEGRAM_WEBHOOK_SECRET),
      adminIds: Boolean(env.TELEGRAM_ADMIN_IDS),
    },
    github: {
      configured: isGitHubConfigured(env),
      secrets: githubConfigStatus(env),
      owner: env.GITHUB_OWNER ?? "Yehor212",
      repo: env.GITHUB_REPO ?? "people-first-app",
      workflow: env.GITHUB_WORKFLOW_FILE ?? "telegram-control.yml",
    },
    storage: {
      kv: Boolean(env.CONTROL_STATE),
      workflow: Boolean(env.CONTROL_WORKFLOW),
    },
    latestJob: latestJob
      ? {
          id: latestJob.id,
          status: latestJob.status,
          updatedAt: latestJob.updatedAt,
        }
      : null,
  };
}

async function formatStatus(env: Env): Promise<string> {
  if (!isGitHubConfigured(env)) {
    return "UNVERIFIED: GitHub App credentials are not configured, so live workflow status cannot be fetched.";
  }

  try {
    const runs = await getLatestWorkflowRuns(env, 3);
    return `GitHub workflow status:\n${JSON.stringify(runs, null, 2).slice(0, 2500)}`;
  } catch (error) {
    return `UNVERIFIED: Failed to fetch GitHub workflow status: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function formatJobs(env: Env): Promise<string> {
  const jobs = await listJobs(env, 8);
  if (jobs.length === 0) {
    return "No control jobs are stored yet.";
  }

  return jobs.map((job) => `${job.id}: ${job.status} ${job.intent.kind} updated ${job.updatedAt}`).join("\n");
}

function formatHealth(value: Record<string, unknown>): string {
  return `Health:\n${JSON.stringify(value, null, 2).slice(0, 2500)}`;
}

function formatApprovalRequest(jobId: string, kind: string, prompt: string): string {
  return [
    `Confirmation required for ${kind}.`,
    `Job: ${jobId}`,
    prompt ? `Prompt: ${prompt.slice(0, 500)}` : "Prompt: none",
    "This command can affect production, protected code, secrets, or repository governance.",
  ].join("\n");
}

function formatJobStarted(job: { id: string; status: string; githubRunUrl?: string; evidence: string[] }): string {
  const lines = [`Job ${job.id}: ${job.status}`];
  if (job.githubRunUrl) {
    lines.push(job.githubRunUrl);
  }
  if (job.evidence.length > 0) {
    lines.push(`Evidence: ${job.evidence.slice(-2).join("; ")}`);
  }
  return lines.join("\n");
}

function formatJobUpdate(jobId: string, status: string, url?: string): string {
  return [`Job ${jobId}: ${status}`, url].filter(Boolean).join("\n");
}

function mapGitHubStatus(status?: string, conclusion?: string): "queued" | "running" | "succeeded" | "failed" {
  if (status === "completed" && conclusion === "success") {
    return "succeeded";
  }
  if (status === "completed") {
    return "failed";
  }
  if (status === "in_progress") {
    return "running";
  }
  return "queued";
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
