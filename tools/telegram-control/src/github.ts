import type { ControlJob, Env } from "./types";

const encoder = new TextEncoder();

export interface GitHubDispatchResult {
  githubRunId?: number;
  githubRunUrl?: string;
}

export function githubConfigStatus(env: Env): Record<string, boolean> {
  return {
    GITHUB_APP_ID: Boolean(env.GITHUB_APP_ID),
    GITHUB_INSTALLATION_ID: Boolean(env.GITHUB_INSTALLATION_ID),
    GITHUB_APP_PRIVATE_KEY: Boolean(env.GITHUB_APP_PRIVATE_KEY),
    GITHUB_WEBHOOK_SECRET: Boolean(env.GITHUB_WEBHOOK_SECRET),
  };
}

export function isGitHubConfigured(env: Env): boolean {
  return Object.values(githubConfigStatus(env)).every(Boolean);
}

export async function dispatchGitHubWorkflow(env: Env, job: ControlJob): Promise<GitHubDispatchResult> {
  const token = await getInstallationToken(env);
  const owner = env.GITHUB_OWNER ?? "Yehor212";
  const repo = env.GITHUB_REPO ?? "people-first-app";
  const workflowFile = env.GITHUB_WORKFLOW_FILE ?? "telegram-control.yml";
  const baseRef = job.intent.targetRef || env.GITHUB_BASE_REF || "main";
  const approvalPolicy = job.intent.requiresConfirmation ? "telegram-approved" : "auto";

  const response = await githubFetch(
    env,
    token,
    `/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`,
    {
      method: "POST",
      body: JSON.stringify({
        ref: baseRef,
        inputs: {
          job_id: job.id,
          mode: job.intent.kind,
          prompt: job.intent.prompt || job.intent.rawText,
          base_ref: baseRef,
          approval_policy: approvalPolicy,
        },
      }),
    },
  );

  if (!response.ok) {
    const body = await boundedText(response);
    throw new Error(`GitHub workflow dispatch failed: ${response.status} ${body}`);
  }

  if (response.status === 204) {
    return {};
  }

  const payload = (await response.json()) as {
    workflow_run_id?: number;
    html_url?: string;
    run_url?: string;
  };

  return {
    githubRunId: payload.workflow_run_id,
    githubRunUrl: payload.html_url ?? payload.run_url,
  };
}

export async function getLatestWorkflowRuns(env: Env, limit = 5): Promise<unknown> {
  const token = await getInstallationToken(env);
  const owner = env.GITHUB_OWNER ?? "Yehor212";
  const repo = env.GITHUB_REPO ?? "people-first-app";
  const workflowFile = env.GITHUB_WORKFLOW_FILE ?? "telegram-control.yml";
  const response = await githubFetch(
    env,
    token,
    `/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/runs?per_page=${limit}`,
  );

  if (!response.ok) {
    const body = await boundedText(response);
    throw new Error(`GitHub workflow status failed: ${response.status} ${body}`);
  }

  return response.json();
}

export async function cancelGitHubWorkflowRun(env: Env, githubRunId: number): Promise<void> {
  const token = await getInstallationToken(env);
  const owner = env.GITHUB_OWNER ?? "Yehor212";
  const repo = env.GITHUB_REPO ?? "people-first-app";
  const response = await githubFetch(
    env,
    token,
    `/repos/${owner}/${repo}/actions/runs/${githubRunId}/cancel`,
    { method: "POST" },
  );

  if (!response.ok) {
    const body = await boundedText(response);
    throw new Error(`GitHub workflow run cancel failed: ${response.status} ${body}`);
  }
}

async function getInstallationToken(env: Env): Promise<string> {
  if (!env.GITHUB_APP_ID || !env.GITHUB_INSTALLATION_ID || !env.GITHUB_APP_PRIVATE_KEY) {
    throw new Error("GitHub App credentials are not fully configured");
  }

  const jwt = await buildGitHubAppJwt(env.GITHUB_APP_ID, env.GITHUB_APP_PRIVATE_KEY);
  const response = await githubFetch(
    env,
    jwt,
    `/app/installations/${env.GITHUB_INSTALLATION_ID}/access_tokens`,
    { method: "POST" },
  );

  if (!response.ok) {
    const body = await boundedText(response);
    throw new Error(`GitHub installation token failed: ${response.status} ${body}`);
  }

  const payload = (await response.json()) as { token?: string };
  if (!payload.token) {
    throw new Error("GitHub installation token response did not include a token");
  }

  return payload.token;
}

async function buildGitHubAppJwt(appId: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({ alg: "RS256", typ: "JWT" });
  const payload = base64UrlJson({
    iat: now - 60,
    exp: now + 9 * 60,
    iss: appId,
  });
  const unsigned = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(unsigned));
  return `${unsigned}.${base64UrlBytes(new Uint8Array(signature))}`;
}

async function githubFetch(env: Env, token: string, path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "zenflow-telegram-control",
      "X-GitHub-Api-Version": "2022-11-28",
      ...init.headers,
    },
  });

  return response;
}

function base64UrlJson(value: unknown): string {
  return base64UrlBytes(encoder.encode(JSON.stringify(value)));
}

function base64UrlBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalized = pem.replace(/\\n/g, "\n");
  const base64 = normalized
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

async function boundedText(response: Response): Promise<string> {
  const text = await response.text();
  return text.slice(0, 500);
}
