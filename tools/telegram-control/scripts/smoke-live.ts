import { computeTelegramMiniAppHash } from "../src/miniapp";

const strict = process.argv.includes("--strict");
const baseUrl = process.env.TELEGRAM_CONTROL_BASE_URL ?? process.env.TELEGRAM_WEBHOOK_URL?.replace(/\/telegram\/webhook\/?$/, "");
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const adminId = firstAdminId(process.env.TELEGRAM_ADMIN_ID ?? process.env.TELEGRAM_ADMIN_IDS);

const results: Array<{ status: "PASS" | "UNVERIFIED" | "FAIL"; name: string; evidence: string }> = [];

if (!baseUrl) {
  results.push({
    status: "UNVERIFIED",
    name: "base-url",
    evidence: "Set TELEGRAM_CONTROL_BASE_URL to the deployed Worker origin.",
  });
  finish();
}

let origin: string;
try {
  origin = normalizeOrigin(baseUrl);
} catch (error) {
  results.push({
    status: "FAIL",
    name: "base-url",
    evidence: `Invalid TELEGRAM_CONTROL_BASE_URL "${baseUrl}": ${errorText(error)}`,
  });
  finish();
}

await checkHealth(origin);
await checkMiniAppHtml(origin);
await checkMiniAppState(origin);
finish();

async function checkHealth(originUrl: string): Promise<void> {
  try {
    const response = await fetch(`${originUrl}/health`, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      results.push({ status: "FAIL", name: "health", evidence: `GET /health returned ${response.status}` });
      return;
    }

    const payload = (await response.json()) as { ok?: boolean; worker?: string };
    const expected = payload.ok && payload.worker === "zenflow-telegram-control";
    results.push({
      status: expected ? "PASS" : "FAIL",
      name: "health",
      evidence: expected
        ? "deployed Worker returned expected health payload"
        : payload.ok
          ? `worker name mismatch: got "${payload.worker ?? "missing"}"`
          : "health payload was not ok",
    });
  } catch (error) {
    results.push({ status: "FAIL", name: "health", evidence: errorText(error) });
  }
}

async function checkMiniAppHtml(originUrl: string): Promise<void> {
  try {
    const response = await fetch(`${originUrl}/miniapp`, { headers: { Accept: "text/html" } });
    const html = await response.text();
    const hasShell = response.ok && html.includes("ZenFlow Control") && html.includes("telegram-web-app.js");
    const leaksTokenName = html.includes("TELEGRAM_BOT_TOKEN");
    results.push({
      status: hasShell && !leaksTokenName ? "PASS" : "FAIL",
      name: "miniapp-html",
      evidence: hasShell && !leaksTokenName
        ? "Mini App shell loaded without secret names"
        : hasShell && leaksTokenName
          ? "Mini App shell loaded but TELEGRAM_BOT_TOKEN name was found in HTML"
          : `GET /miniapp returned ${response.status}`,
    });
  } catch (error) {
    results.push({ status: "FAIL", name: "miniapp-html", evidence: errorText(error) });
  }
}

async function checkMiniAppState(originUrl: string): Promise<void> {
  if (!botToken || !adminId) {
    results.push({
      status: "UNVERIFIED",
      name: "miniapp-state",
      evidence: "Set TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_ID or TELEGRAM_ADMIN_IDS to sign local initData.",
    });
    return;
  }

  try {
    const initData = await signInitData(botToken, adminId);
    const response = await fetch(`${originUrl}/miniapp/state`, {
      method: "POST",
      headers: { Authorization: `tma ${initData}` },
    });
    if (!response.ok) {
      results.push({ status: "FAIL", name: "miniapp-state", evidence: `POST /miniapp/state returned ${response.status}` });
      return;
    }

    const payload = (await response.json()) as { ok?: boolean; user?: { id?: number } };
    results.push({
      status: payload.ok && payload.user?.id === adminId ? "PASS" : "FAIL",
      name: "miniapp-state",
      evidence: payload.ok ? "signed Mini App state returned expected admin id" : "Mini App state payload was not ok",
    });
  } catch (error) {
    results.push({ status: "FAIL", name: "miniapp-state", evidence: errorText(error) });
  }
}

async function signInitData(botTokenValue: string, userId: number): Promise<string> {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: "live-smoke",
    user: JSON.stringify({ id: userId, first_name: "Admin" }),
  });
  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const hash = await computeTelegramMiniAppHash(botTokenValue, dataCheckString);
  params.set("hash", hash);
  return params.toString();
}

function normalizeOrigin(value: string): string {
  const url = new URL(value);
  return url.origin;
}

function firstAdminId(value: string | undefined): number | null {
  for (const part of (value ?? "").split(/[,\s]+/)) {
    const parsed = Number(part.trim());
    if (Number.isSafeInteger(parsed)) {
      return parsed;
    }
  }
  return null;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function finish(): never {
  console.log("Telegram control live smoke");
  for (const result of results) {
    console.log(`${result.status} ${result.name} - ${result.evidence}`);
  }
  const overall = results.some((result) => result.status === "FAIL")
    ? "FAIL"
    : results.some((result) => result.status === "UNVERIFIED")
      ? "UNVERIFIED"
      : "PASS";
  console.log(`Overall: ${overall}`);

  if (strict && overall !== "PASS") {
    process.exit(1);
  }
  process.exit(overall === "FAIL" ? 1 : 0);
}
