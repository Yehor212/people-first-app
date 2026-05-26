import { WorkflowEntrypoint } from "cloudflare:workers";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { APPROVAL_SIGNAL_TYPE, dispatchJobDirectly, updateJob } from "./control";
import { getJob, saveJob } from "./storage";
import type { ApprovalSignal, ControlJob, ControlWorkflowParams, Env } from "./types";

export class ControlWorkflow extends WorkflowEntrypoint<Env, ControlWorkflowParams> {
  async run(event: WorkflowEvent<ControlWorkflowParams>, step: WorkflowStep): Promise<unknown> {
    const job = await step.do("load control job", async () => getJob(this.env, event.payload.jobId));

    if (!job) {
      return {
        status: "unverified",
        evidence: ["UNVERIFIED: workflow started but job metadata was not found in KV"],
      };
    }

    const signaledJob = await this.waitForApprovalIfNeeded(step, job);
    if (signaledJob.status !== "queued") {
      return {
        status: signaledJob.status,
        evidence: signaledJob.evidence,
      };
    }

    const runningJob = await step.do("mark job running", async () => {
      const running = updateJob(signaledJob, "running", ["Cloudflare Workflow dispatch step started"]);
      await saveJob(this.env, running);
      return running;
    });

    return step.do(
      "dispatch GitHub workflow",
      { retries: { limit: 3, delay: "10 seconds", backoff: "exponential" } },
      async () => dispatchJobDirectly(this.env, runningJob),
    );
  }

  private async waitForApprovalIfNeeded(step: WorkflowStep, job: ControlJob): Promise<ControlJob> {
    if (job.status !== "awaiting_approval") {
      return job;
    }

    if (!step.waitForEvent) {
      const updated = updateJob(job, "awaiting_approval", [
        "Workflow is paused at Telegram approval gate; waitForEvent is unavailable in this runtime",
      ]);
      await saveJob(this.env, updated);
      return updated;
    }

    let signal: ApprovalSignal;
    try {
      const event = await step.waitForEvent<ApprovalSignal>("wait for Telegram approval signal", {
        type: APPROVAL_SIGNAL_TYPE,
        timeout: "7 days",
      });
      signal = event.payload;
    } catch (error) {
      const updated = updateJob(job, "unverified", [
        `UNVERIFIED: approval signal wait failed: ${error instanceof Error ? error.message : String(error)}`,
      ]);
      await saveJob(this.env, updated);
      return updated;
    }

    return step.do("load signaled control job", async () => {
      const latest = await getJob(this.env, signal.jobId);
      if (!latest) {
        const updated = updateJob(job, "unverified", [
          "UNVERIFIED: approval signal arrived but job metadata was not found in KV",
        ]);
        await saveJob(this.env, updated);
        return updated;
      }

      if (signal.action !== "approve") {
        const updated = updateJob(latest, latest.status, [`Cloudflare Workflow received ${signal.action} signal`]);
        await saveJob(this.env, updated);
        return updated;
      }

      if (latest.status !== "queued") {
        const updated = updateJob(latest, latest.status, [
          `UNVERIFIED: approval signal received but job status is ${latest.status}`,
        ]);
        await saveJob(this.env, updated);
        return updated;
      }

      const updated = updateJob(latest, "queued", ["Cloudflare Workflow received approve signal"]);
      await saveJob(this.env, updated);
      return updated;
    });
  }
}
