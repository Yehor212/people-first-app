import type { Env } from "./types";

const encoder = new TextEncoder();

export function safeEqual(left: string | undefined, right: string | undefined): boolean {
  const leftBytes = encoder.encode(left ?? "");
  const rightBytes = encoder.encode(right ?? "");
  const length = Math.max(leftBytes.length, rightBytes.length);
  let diff = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    diff |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return diff === 0;
}

export function parseAdminIds(value: string | undefined): Set<number> {
  const ids = new Set<number>();

  for (const part of (value ?? "").split(/[,\s]+/)) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }

    const id = Number(trimmed);
    if (Number.isSafeInteger(id)) {
      ids.add(id);
    }
  }

  return ids;
}

export function isAuthorizedTelegramUser(env: Env, telegramUserId: number): boolean {
  return parseAdminIds(env.TELEGRAM_ADMIN_IDS).has(telegramUserId);
}

export function verifyTelegramWebhook(request: Request, env: Env): boolean {
  const expected = env.TELEGRAM_WEBHOOK_SECRET;
  const actual = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? undefined;
  return Boolean(expected) && safeEqual(actual, expected);
}

export async function hmacSha256(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return `sha256=${toHex(new Uint8Array(signature))}`;
}

export async function verifyGitHubWebhookSignature(
  request: Request,
  env: Env,
  rawBody: string,
): Promise<boolean> {
  const expectedSecret = env.GITHUB_WEBHOOK_SECRET;
  const actual = request.headers.get("X-Hub-Signature-256") ?? undefined;

  if (!expectedSecret || !actual?.startsWith("sha256=")) {
    return false;
  }

  const expected = await hmacSha256(expectedSecret, rawBody);
  return safeEqual(actual, expected);
}

export function verifyWorkflowCallbackSecret(request: Request, env: Env): boolean {
  const expected = env.TELEGRAM_CONTROL_CALLBACK_SECRET ?? env.GITHUB_WEBHOOK_SECRET;
  const actual = request.headers.get("X-Zenflow-Control-Secret") ?? undefined;
  return Boolean(expected) && safeEqual(actual, expected);
}

export function createApprovalNonce(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
