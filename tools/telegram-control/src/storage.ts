import type { ControlJob, Env } from "./types";

const JOB_PREFIX = "control-job:";
const LATEST_JOB_KEY = "control-latest-job";
const TELEGRAM_UPDATE_PREFIX = "telegram-update:";
const TELEGRAM_UPDATE_TTL_SECONDS = 7 * 24 * 60 * 60;

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

export async function findJobByGitHubRunOrBranch(
  env: Env,
  githubRunId?: number,
  branch?: string,
): Promise<ControlJob | null> {
  const jobs = await listJobs(env, 50);
  return (
    jobs.find((job) => {
      if (githubRunId && job.githubRunId === githubRunId) {
        return true;
      }
      return Boolean(branch && job.branch === branch);
    }) ?? null
  );
}

export async function getLatestJob(env: Env): Promise<ControlJob | null> {
  if (!env.CONTROL_STATE) {
    return null;
  }

  const jobId = await env.CONTROL_STATE.get(LATEST_JOB_KEY);
  return jobId ? getJob(env, jobId) : null;
}

export async function hasProcessedTelegramUpdate(env: Env, updateId: number | undefined): Promise<boolean> {
  if (!env.CONTROL_STATE || updateId === undefined) {
    return false;
  }

  return Boolean(await env.CONTROL_STATE.get(`${TELEGRAM_UPDATE_PREFIX}${updateId}`));
}

export async function markTelegramUpdateProcessed(env: Env, updateId: number | undefined): Promise<void> {
  if (!env.CONTROL_STATE || updateId === undefined) {
    return;
  }

  await env.CONTROL_STATE.put(`${TELEGRAM_UPDATE_PREFIX}${updateId}`, new Date().toISOString(), {
    expirationTtl: TELEGRAM_UPDATE_TTL_SECONDS,
  });
}
