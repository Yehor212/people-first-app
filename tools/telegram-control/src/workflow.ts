import { WorkflowEntrypoint } from "cloudflare:workers";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { dispatchJobDirectly, updateJob } from "./control";
import { getJob, saveJob } from "./storage";
import type { ControlWorkflowParams, Env } from "./types";

export class ControlWorkflow extends WorkflowEntrypoint<Env, ControlWorkflowParams> {
  async run(event: WorkflowEvent<ControlWorkflowParams>, step: WorkflowStep): Promise<unknown> {
    const job = await step.do("load control job", async () => getJob(this.env, event.payload.jobId));

    if (!job) {
      return {
        status: "unverified",
        evidence: ["UNVERIFIED: workflow started but job metadata was not found in KV"],
      };
    }

    if (job.status === "awaiting_approval") {
      return {
        status: job.status,
        evidence: ["Workflow is paused at Telegram approval gate"],
      };
    }

    await step.do("mark job running", async () => {
      const running = updateJob(job, "running", ["Cloudflare Workflow dispatch step started"]);
      await saveJob(this.env, running);
      return running.status;
    });

    return step.do(
      "dispatch GitHub workflow",
      { retries: { limit: 3, delay: "10 seconds", backoff: "exponential" } },
      async () => dispatchJobDirectly(this.env, job),
    );
  }
}
