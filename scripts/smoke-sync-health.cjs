#!/usr/bin/env node
"use strict";

const { chromium } = require("@playwright/test");

const DEFAULT_URL = "http://localhost:8080/people-first-app/?navLayout=phone&syncHealth=1";
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

function stopUnverified(reason) {
  console.log(`[sync-health] UNVERIFIED - ${reason}`);
  process.exit(REQUIRED ? 2 : 0);
}

function fail(message, detail) {
  console.error(`[sync-health] FAIL - ${message}`);
  if (detail) console.error(detail);
  process.exit(1);
}

function assertNoForbiddenContent(snapshot) {
  const serialized = JSON.stringify(snapshot);
  const leaked = FORBIDDEN_STRINGS.filter((token) => serialized.includes(token));
  if (leaked.length > 0) {
    fail(`snapshot leaked forbidden token(s): ${leaked.join(", ")}`);
  }
}

async function main() {
  let browser;
  const consoleErrors = [];
  const failedRequests = [];

  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    stopUnverified(`Chromium could not start: ${error.message || String(error)}`);
  }

  try {
    const page = await browser.newPage({ viewport: { width: 449, height: 698 } });

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });
    page.on("requestfailed", (request) => {
      failedRequests.push(`${request.failure()?.errorText || "unknown"} ${request.url()}`);
    });

    await page.addInitScript(() => {
      localStorage.setItem("zenflow-language-selected", JSON.stringify(true));
      localStorage.setItem("zenflow-google-auth-checked", JSON.stringify(true));
      localStorage.setItem("zenflow-tutorial-complete", JSON.stringify(true));
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
      fail("snapshot is not the expected v1 enabled sync-health shape");
    }
    if (!initial.route.includes("syncHealth=1") && !initial.route.includes("syncDebug=true")) {
      fail(`snapshot route does not prove explicit debug opt-in: ${initial.route}`);
    }
    if (typeof initial.lastSeq !== "number" || typeof initial.queue?.pending !== "number") {
      fail("snapshot is missing numeric cursor or queue evidence");
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
    if (!String(routeAfterPush).includes("syncHealthDrill=route")) {
      fail(`snapshot route did not update after history.pushState: ${routeAfterPush}`);
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
      fail("snapshot did not capture a coarse sync receipt");
    }
    assertNoForbiddenContent(receiptSnapshot);

    const result = {
      generatedAt: new Date().toISOString(),
      url: TARGET_URL,
      route: receiptSnapshot.route,
      auth: receiptSnapshot.auth,
      online: receiptSnapshot.online,
      lastSeq: receiptSnapshot.lastSeq,
      queue: receiptSnapshot.queue,
      receiptCount: receiptSnapshot.receipts.length,
      lastReceipt: receiptSnapshot.lastReceipt,
      consoleErrorCount: consoleErrors.length,
      requestFailedCount: failedRequests.length,
      forbiddenTokensChecked: FORBIDDEN_STRINGS,
    };

    if (OUTPUT_PATH) {
      require("node:fs").writeFileSync(OUTPUT_PATH, `${JSON.stringify(result, null, 2)}\n`);
    }

    if (consoleErrors.length > 0) {
      fail("console errors were emitted", consoleErrors.slice(0, 5).join("\n"));
    }
    if (failedRequests.length > 0) {
      fail("network requests failed", failedRequests.slice(0, 5).join("\n"));
    }

    console.log(
      `[sync-health] PASS - route=${result.route}, lastSeq=${result.lastSeq}, queuePending=${result.queue.pending}, receipts=${result.receiptCount}`,
    );
  } finally {
    await browser?.close();
  }
}

main().catch((error) => fail("unexpected smoke error", error.stack || error.message || String(error)));
