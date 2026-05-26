import { isDispatchableKind } from "./commands";
import { cancelGitHubWorkflowRun, dispatchGitHubWorkflow, isGitHubConfigured } from "./github";
import { createApprovalNonce } from "./security";
import { saveJob } from "./storage";
import type { CommandIntent, ControlJob, Env } from "./types";

export function createControlJob(
  intent: CommandIntent,
  requesterTelegramId: number,
  chatId: number | string,
): ControlJob {
  const now = new Date().toISOString();
  const id = createJobId();
  const approvalNonce = intent.requiresConfirmation ? createApprovalNonce() : undefined;

  return {
    id,
    requesterTelegramId,
    chatId,
    status: intent.requiresConfirmation ? "awaiting_approval" : "queued",
    intent,
    branch: `codex/telegram-${id}`,
    approvals: [],
    approvalNonce,
    evidence: [],
    createdAt: now,
    updatedAt: now,
  };
}

export async function startJob(env: Env, job: ControlJob): Promise<ControlJob> {
  if (!isDispatchableKind(job.intent.kind)) {
    return updateJob(job, "ASK", ["Intent is not dispatchable"]);
  }

  if (!env.CONTROL_STATE) {
    return updateJob(job, "unverified", [
      "UNVERIFIED: CONTROL_STATE KV binding is not configured; job metadata cannot be stored",
    ]);
  }

  if (job.intent.requiresConfirmation && job.status !== "queued") {
    await saveJob(env, job);
    return job;
  }

  if (!isGitHubConfigured(env)) {
    const updated = updateJob(job, "unverified", [
      "UNVERIFIED: GitHub App credentials or webhook secret are not configured",
    ]);
    await saveJob(env, updated);
    return updated;
  }

  if (env.CONTROL_WORKFLOW) {
    const instance = await env.CONTROL_WORKFLOW.create({ id: job.id, params: { jobId: job.id } });
    const updated = {
      ...updateJob(job, "queued", [`Cloudflare Workflow started: ${instance.id}`]),
      workflowInstanceId: instance.id,
    };
    await saveJob(env, updated);
    return updated;
  }

  return dispatchJobDirectly(env, job);
}

export async function dispatchJobDirectly(env: Env, job: ControlJob): Promise<ControlJob> {
  if (!isGitHubConfigured(env)) {
    const updated = updateJob(job, "unverified", [
      "UNVERIFIED: GitHub App credentials or webhook secret are not configured",
    ]);
    await saveJob(env, updated);
    return updated;
  }

  try {
    const result = await dispatchGitHubWorkflow(env, job);
    const updated = {
      ...updateJob(job, "queued", ["GitHub workflow_dispatch accepted"]),
      githubRunId: result.githubRunId,
      githubRunUrl: result.githubRunUrl,
    };
    await saveJob(env, updated);
    return updated;
  } catch (error) {
    const updated = updateJob(job, "failed", [
      `GitHub dispatch failed: ${error instanceof Error ? error.message : String(error)}`,
    ]);
    await saveJob(env, updated);
    return updated;
  }
}

export function approveJob(job: ControlJob, telegramUserId: number, nonce: string): ControlJob {
  return {
    ...updateJob(job, "queued", [`Approved from Telegram user ${telegramUserId}`]),
    approvals: [
      ...job.approvals,
      { action: "approve", telegramUserId, nonce, at: new Date().toISOString() },
    ],
  };
}

export function denyOrCancelJob(
  job: ControlJob,
  action: "deny" | "cancel",
  telegramUserId: number,
  nonce: string,
): ControlJob {
  return {
    ...updateJob(job, action === "deny" ? "denied" : "cancelled", [
      `${action === "deny" ? "Denied" : "Cancelled"} from Telegram user ${telegramUserId}`,
    ]),
    approvals: [
      ...job.approvals,
      { action, telegramUserId, nonce, at: new Date().toISOString() },
    ],
  };
}

export async function cancelControlJob(
  env: Env,
  job: ControlJob,
  telegramUserId: number,
  nonce = "manual-cancel",
): Promise<ControlJob> {
  const evidence = [`Cancelled from Telegram user ${telegramUserId}`];
  let status: ControlJob["status"] = "cancelled";

  if (job.workflowInstanceId) {
    if (env.CONTROL_WORKFLOW) {
      try {
        const instance = await env.CONTROL_WORKFLOW.get(job.workflowInstanceId);
        await instance.terminate();
        evidence.push(`Cloudflare Workflow terminated: ${job.workflowInstanceId}`);
      } catch (error) {
        status = "unverified";
        evidence.push(`UNVERIFIED: Cloudflare Workflow termination failed: ${errorText(error)}`);
      }
    } else {
      status = "unverified";
      evidence.push("UNVERIFIED: Cloudflare Workflow binding is not available for termination");
    }
  }

  if (job.githubRunId) {
    if (isGitHubConfigured(env)) {
      try {
        await cancelGitHubWorkflowRun(env, job.githubRunId);
        evidence.push(`GitHub workflow run cancellation requested: ${job.githubRunId}`);
      } catch (error) {
        status = "unverified";
        evidence.push(`UNVERIFIED: GitHub workflow run cancellation failed: ${errorText(error)}`);
      }
    } else {
      status = "unverified";
      evidence.push("UNVERIFIED: GitHub App credentials are not configured for workflow run cancellation");
    }
  }

  const updated = {
    ...updateJob(job, status, evidence),
    approvals: [
      ...job.approvals,
      { action: "cancel" as const, telegramUserId, nonce, at: new Date().toISOString() },
    ],
  };
  await saveJob(env, updated);
  return updated;
}

export function updateJob(job: ControlJob, status: ControlJob["status"], evidence: string[]): ControlJob {
  return {
    ...job,
    status,
    evidence: [...job.evidence, ...evidence],
    updatedAt: new Date().toISOString(),
  };
}

function createJobId(): string {
  return `tg_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
