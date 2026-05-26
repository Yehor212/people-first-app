import { isDispatchableKind } from "./commands";
import {
  cancelGitHubWorkflowRun,
  dispatchGitHubWorkflow,
  findCancelableWorkflowRunForBranch,
  isGitHubConfigured,
} from "./github";
import { createApprovalNonce } from "./security";
import { saveJob } from "./storage";
import type { ApprovalSignal, CommandIntent, ControlJob, Env } from "./types";

export const APPROVAL_SIGNAL_TYPE = "telegram-approval-signal";

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

  if (job.intent.requiresConfirmation && job.status === "awaiting_approval") {
    if (env.CONTROL_WORKFLOW && !job.workflowInstanceId) {
      const instance = await env.CONTROL_WORKFLOW.create({ id: job.id, params: { jobId: job.id } });
      const updated = {
        ...updateJob(job, "awaiting_approval", [
          `Cloudflare Workflow started: ${instance.id}`,
          "Cloudflare Workflow is waiting for Telegram approval signal",
        ]),
        workflowInstanceId: instance.id,
      };
      await saveJob(env, updated);
      return updated;
    }

    await saveJob(env, job);
    return job;
  }

  if (!isGitHubConfigured(env)) {
    const updated = updateJob(job, "unverified", [
      "UNVERIFIED: GitHub App credentials are not configured",
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

export async function signalWorkflow(
  env: Env,
  job: ControlJob,
  signal: ApprovalSignal,
): Promise<ControlJob> {
  if (!job.workflowInstanceId) {
    return job;
  }

  if (!env.CONTROL_WORKFLOW) {
    const updated = updateJob(job, "unverified", [
      "UNVERIFIED: Cloudflare Workflow binding is not available for approval signal",
    ]);
    await saveJob(env, updated);
    return updated;
  }

  try {
    const instance = await env.CONTROL_WORKFLOW.get(job.workflowInstanceId);
    if (!instance.sendEvent) {
      const updated = updateJob(job, "unverified", [
        "UNVERIFIED: Cloudflare Workflow instance does not support approval signals",
      ]);
      await saveJob(env, updated);
      return updated;
    }

    await instance.sendEvent({ type: APPROVAL_SIGNAL_TYPE, payload: signal });
    const updated = updateJob(job, job.status, [`Cloudflare Workflow signal sent: ${signal.action}`]);
    await saveJob(env, updated);
    return updated;
  } catch (error) {
    const updated = updateJob(job, "unverified", [
      `UNVERIFIED: Cloudflare Workflow signal failed: ${errorText(error)}`,
    ]);
    await saveJob(env, updated);
    return updated;
  }
}

export async function dispatchJobDirectly(env: Env, job: ControlJob): Promise<ControlJob> {
  if (!isGitHubConfigured(env)) {
    const updated = updateJob(job, "unverified", [
      "UNVERIFIED: GitHub App credentials are not configured",
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

  if (job.workflowInstanceId && job.status === "awaiting_approval") {
    const updated = {
      ...updateJob(job, status, evidence),
      approvals: [
        ...job.approvals,
        { action: "cancel" as const, telegramUserId, nonce, at: new Date().toISOString() },
      ],
    };
    return signalWorkflow(env, updated, { jobId: job.id, action: "cancel", nonce, telegramUserId });
  }

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

  let githubRunId = job.githubRunId;
  if (!githubRunId && job.branch && isGitHubConfigured(env)) {
    try {
      const branchRun = await findCancelableWorkflowRunForBranch(env, job.branch);
      if (branchRun) {
        githubRunId = branchRun.id;
        evidence.push(`GitHub workflow run found by branch ${job.branch}: ${branchRun.id}`);
      } else {
        evidence.push(`No active GitHub workflow run found for branch ${job.branch}`);
      }
    } catch (error) {
      status = "unverified";
      evidence.push(`UNVERIFIED: GitHub workflow run lookup by branch failed: ${errorText(error)}`);
    }
  }

  if (githubRunId) {
    if (isGitHubConfigured(env)) {
      try {
        await cancelGitHubWorkflowRun(env, githubRunId);
        evidence.push(`GitHub workflow run cancellation requested: ${githubRunId}`);
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
    githubRunId,
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
