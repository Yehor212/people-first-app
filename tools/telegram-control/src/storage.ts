import type { ControlJob, Env } from "./types";

const JOB_PREFIX = "control-job:";
const LATEST_JOB_KEY = "control-latest-job";

export async function saveJob(env: Env, job: ControlJob): Promise<void> {
  if (!env.CONTROL_STATE) {
    return;
  }

  const value = JSON.stringify(job);
  await env.CONTROL_STATE.put(`${JOB_PREFIX}${job.id}`, value);
  await env.CONTROL_STATE.put(LATEST_JOB_KEY, job.id);
}

export async function getJob(env: Env, jobId: string): Promise<ControlJob | null> {
  if (!env.CONTROL_STATE) {
    return null;
  }

  const value = await env.CONTROL_STATE.get(`${JOB_PREFIX}${jobId}`);
  return value ? (JSON.parse(value) as ControlJob) : null;
}

export async function listJobs(env: Env, limit = 10): Promise<ControlJob[]> {
  if (!env.CONTROL_STATE) {
    return [];
  }

  const listed = await env.CONTROL_STATE.list({ prefix: JOB_PREFIX, limit: Math.max(limit, 1) });
  const jobs = await Promise.all(
    listed.keys.map(async (key) => {
      const value = await env.CONTROL_STATE?.get(key.name);
      return value ? (JSON.parse(value) as ControlJob) : null;
    }),
  );

  return jobs
    .filter((job): job is ControlJob => Boolean(job))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, limit);
}

export async function getLatestJob(env: Env): Promise<ControlJob | null> {
  if (!env.CONTROL_STATE) {
    return null;
  }

  const jobId = await env.CONTROL_STATE.get(LATEST_JOB_KEY);
  return jobId ? getJob(env, jobId) : null;
}
