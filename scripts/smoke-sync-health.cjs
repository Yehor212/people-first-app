#!/usr/bin/env node
"use strict";

const { chromium } = require("@playwright/test");
const {
  evidenceFailureCode,
  sanitizeEvidenceRoute,
  sanitizeEvidenceUrl,
  sanitizeSyncHealthEvidenceSnapshot,
} = require("./lib/diagnostic-evidence-privacy.cjs");

const DEFAULT_URL = "https://yehor212.github.io/people-first-app/?navLayout=phone&syncHealth=1";
const TARGET_URL = withSyncHealthFlag(process.env.ZENFLOW_SYNC_HEALTH_URL || DEFAULT_URL);
const OUTPUT_PATH = process.env.ZENFLOW_SYNC_HEALTH_OUTPUT || "";
const REQUIRED = process.env.ZENFLOW_SYNC_HEALTH_REQUIRED === "true";

const FORBIDDEN_STRINGS = [
  "payload",
  "entityId",
  "journal text",
  "habit name",
  "private-journal-content",
  "private-habit-name",
  "sync-health-secret",
];

function withSyncHealthFlag(rawUrl) {
  const url = new URL(rawUrl);
  if (!url.searchParams.has("syncHealth") && !url.searchParams.has("syncDebug")) {
    url.searchParams.set("syncHealth", "1");
  }
  return url.toString();
}

function stopUnverified(_reason) {
  console.log("[sync-health] UNVERIFIED - ZF_BROWSER_UNAVAILABLE");
  process.exit(REQUIRED ? 2 : 0);
}

function fail(code) {
  const safeCode = /^ZF_[A-Z0-9_]{3,64}$/.test(code) ? code : evidenceFailureCode(code);
  console.error(`[sync-health] FAIL - ${safeCode}`);
  process.exit(1);
}

function assertNoForbiddenContent(snapshot) {
  const serialized = JSON.stringify(snapshot);
  const leaked = FORBIDDEN_STRINGS.filter((token) => serialized.includes(token));
  if (leaked.length > 0) {
    fail("ZF_SYNC_HEALTH_PRIVATE_DATA");
  }
}

async function main() {
  let browser;
  const consoleErrors = [];
  const failedRequests = [];

  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    stopUnverified(evidenceFailureCode(error));
  }

  try {
    const page = await browser.newPage({ viewport: { width: 449, height: 698 } });

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push("ZF_BROWSER_CONSOLE_ERROR");
      }
    });
    page.on("requestfailed", (request) => {
      failedRequests.push({ code: "ZF_REQUEST_FAILED", url: sanitizeEvidenceUrl(request.url()) });
    });

    await page.addInitScript(() => {
      localStorage.setItem("zenflow-language-selected", JSON.stringify(true));
      localStorage.setItem("zenflow-google-auth-checked", JSON.stringify(true));
      localStorage.setItem("zenflow-onboarding-complete", JSON.stringify(true));
      localStorage.setItem("zenflow-notification-permission-checked", JSON.stringify(true));
      localStorage.setItem("zenflow-privacy-acknowledged", JSON.stringify(true));
      localStorage.setItem("zenflow-theme", "dark");
      localStorage.setItem("zenflow-sync-health-recorder", "1");
      localStorage.setItem("sync-health-secret", "private-journal-content private-habit-name");
    });

    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForFunction(() => Boolean(window.__zenflowSyncHealth?.snapshot), {
      timeout: 12_000,
    });
    await page.waitForTimeout(500);

    const initial = await page.evaluate(() => window.__zenflowSyncHealth.snapshot());
    if (initial.version !== 1 || initial.enabled !== true) {
      fail("ZF_SYNC_HEALTH_SHAPE_INVALID");
    }
    const target = new URL(TARGET_URL);
    if (!target.searchParams.has("syncHealth") && !target.searchParams.has("syncDebug")) {
      fail("ZF_SYNC_HEALTH_OPT_IN_MISSING");
    }
    if (initial.route !== sanitizeEvidenceRoute(TARGET_URL) || /[?#]/.test(initial.route)) {
      fail("ZF_SYNC_HEALTH_ROUTE_UNSAFE");
    }
    if (typeof initial.lastSeq !== "number" || typeof initial.queue?.pending !== "number") {
      fail("ZF_SYNC_HEALTH_NUMERIC_EVIDENCE_MISSING");
    }
    assertNoForbiddenContent(initial);

    const routeAfterPush = await page.evaluate(() => {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("syncHealthDrill", "route");
      window.history.pushState({}, "", nextUrl.toString());
      return new Promise((resolve) => {
        queueMicrotask(() => resolve(window.__zenflowSyncHealth.snapshot().route));
      });
    });
    if (routeAfterPush !== initial.route || /[?#]/.test(String(routeAfterPush))) {
      fail("ZF_SYNC_HEALTH_ROUTE_UPDATE_UNSAFE");
    }

    const receiptSnapshot = await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("zenflow:sync-health-receipt", {
          detail: {
            kind: "delta-empty",
            source: "delta",
            seq: 7,
            fetched: 0,
            applied: 0,
          },
        }),
      );
      window.__zenflowSyncHealth.record({
        kind: "delta-empty",
        source: "delta",
        seq: 7,
        fetched: 0,
        applied: 0,
      });
      return window.__zenflowSyncHealth.snapshot();
    });
    if (receiptSnapshot.lastReceipt?.kind !== "delta-empty") {
      fail("ZF_SYNC_HEALTH_RECEIPT_MISSING");
    }
    assertNoForbiddenContent(receiptSnapshot);

    const safeSnapshot = sanitizeSyncHealthEvidenceSnapshot(receiptSnapshot);
    const result = {
      generatedAt: new Date().toISOString(),
      url: sanitizeEvidenceUrl(TARGET_URL),
      route: safeSnapshot.route,
      auth: safeSnapshot.auth,
      online: safeSnapshot.online,
      lastSeq: safeSnapshot.lastSeq,
      queue: safeSnapshot.queue,
      receiptCount: safeSnapshot.receipts.length,
      lastReceipt: safeSnapshot.lastReceipt,
      consoleErrorCount: consoleErrors.length,
      requestFailedCount: failedRequests.length,
      privateCanaryCountChecked: FORBIDDEN_STRINGS.length,
    };

    if (OUTPUT_PATH) {
      require("node:fs").writeFileSync(OUTPUT_PATH, `${JSON.stringify(result, null, 2)}\n`);
    }

    if (consoleErrors.length > 0) {
      fail("ZF_SYNC_HEALTH_CONSOLE_ERROR");
    }
    if (failedRequests.length > 0) {
      fail("ZF_SYNC_HEALTH_NETWORK_FAILURE");
    }

    console.log(
      `[sync-health] PASS - route=${result.route}, lastSeq=${result.lastSeq}, queuePending=${result.queue.pending}, receipts=${result.receiptCount}`,
    );
  } finally {
    await browser?.close();
  }
}

main().catch((error) => fail(evidenceFailureCode(error)));
