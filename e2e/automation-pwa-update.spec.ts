import { expect, test, chromium, type BrowserContext, type CDPSession, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import {
  cleanupAutomationLifecycleFixture,
  readAutomationLifecycleSnapshot,
  seedAutomationLifecycleFixture,
  T146_AUTOMATION_LIFECYCLE_FIXTURE,
  T146_EXPECTED_AUTOMATION_LIFECYCLE_SNAPSHOT,
} from "./helpers/automation-lifecycle/indexedDbFixture";

const ENABLED = process.env.ZENFLOW_RUN_INSTALLED_PWA_UPDATE === "true";
const BASE_URL = "http://127.0.0.1:4183/people-first-app/";
const BUILD_A = 1_460_000_001_001;
const BUILD_B = 1_460_000_001_002;
const DEFAULT_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const RECEIPT_PATH = resolve("output/playwright/pwa-update/installed-pwa-update-current.json");

type ServerState = {
  schemaVersion: 1;
  activeVersion: "a" | "b";
  artifact: {
    buildTime: number;
    indexSha256: string;
    serviceWorkerSha256: string;
    versionSha256: string;
  };
};

function resolveChromeExecutable(): string {
  const candidate = process.env.ZENFLOW_PWA_CHROME_PATH || DEFAULT_CHROME;
  if (!existsSync(candidate)) {
    throw new Error(
      "T146 installed-PWA verification requires desktop Google Chrome with the CDP PWA domain; set ZENFLOW_PWA_CHROME_PATH explicitly",
    );
  }
  return candidate;
}

async function ensureServiceWorkerControl(page: Page): Promise<void> {
  await page.evaluate(async () => Boolean((await navigator.serviceWorker.ready).active));
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload({ waitUntil: "domcontentloaded" });
  }
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
}

async function getServerState(page: Page): Promise<ServerState> {
  return page.evaluate(async () => {
    const response = await fetch("/__t146/state", { cache: "no-store" });
    if (!response.ok) throw new Error(`T146 state endpoint returned ${response.status}`);
    return response.json();
  });
}

async function getScriptSources(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLScriptElement>("script[src]"))
      .map((script) => new URL(script.src, window.location.href).pathname)
      .sort(),
  );
}

async function launchInstalledPwa(
  context: BrowserContext,
  cdp: CDPSession,
  manifestId: string,
): Promise<Page> {
  const nextPage = context.waitForEvent("page", { timeout: 30_000 });
  await cdp.send("PWA.launch", { manifestId });
  const page = await nextPage;
  await page.waitForURL((url) => url.href.startsWith(BASE_URL), { timeout: 30_000 });
  await page.waitForLoadState("domcontentloaded");
  await expect
    .poll(() => page.evaluate(() => window.matchMedia("(display-mode: standalone)").matches))
    .toBe(true);
  await expect.poll(() => page.evaluate(() => window.isSecureContext)).toBe(true);
  await ensureServiceWorkerControl(page);
  return page;
}

test.skip(!ENABLED, "Set ZENFLOW_RUN_INSTALLED_PWA_UPDATE=true for the explicit installed-PWA release smoke.");

test("an installed production PWA preserves connected-record boundaries across an A-to-B update", async () => {
  const profileDir = await mkdtemp(join(tmpdir(), "zenflow-t146-installed-pwa-"));
  const chromeExecutable = resolveChromeExecutable();
  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: chromeExecutable,
    headless: false,
    serviceWorkers: "allow",
    viewport: { width: 390, height: 844 },
  });
  let cdp: CDPSession | null = null;
  let manifestId: string | null = null;
  let installed = false;
  let seeded = false;
  let lifecyclePage: Page | null = null;
  try {
    const installPage = context.pages()[0] ?? (await context.newPage());
    await installPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await ensureServiceWorkerControl(installPage);
    const manifest = await installPage.evaluate(async () => {
      const response = await fetch("manifest.webmanifest", { cache: "no-store" });
      return response.json() as Promise<{ id: string; display: string }>;
    });
    expect(manifest.display).toBe("standalone");
    manifestId = new URL(manifest.id, BASE_URL).href;
    expect(manifestId).toBe(BASE_URL);

    cdp = await context.newCDPSession(installPage);
    const browserVersion = await cdp.send("Browser.getVersion");
    await cdp.send("PWA.install", { manifestId });
    installed = true;
    await cdp.send("PWA.changeAppUserSettings", { manifestId, displayMode: "standalone" });
    lifecyclePage = await launchInstalledPwa(context, cdp, manifestId);

    const stateA = await getServerState(lifecyclePage);
    expect(stateA.activeVersion).toBe("a");
    expect(stateA.artifact.buildTime).toBe(BUILD_A);
    const scriptsA = await getScriptSources(lifecyclePage);
    expect(scriptsA.length).toBeGreaterThan(0);

    const cleanBefore = await lifecyclePage.evaluate(
      cleanupAutomationLifecycleFixture,
      T146_AUTOMATION_LIFECYCLE_FIXTURE,
    );
    expect(cleanBefore.remaining).toBe(0);
    const seededResult = await lifecyclePage.evaluate(
      seedAutomationLifecycleFixture,
      T146_AUTOMATION_LIFECYCLE_FIXTURE,
    );
    expect(seededResult.databaseVersion).toBe(
      T146_AUTOMATION_LIFECYCLE_FIXTURE.expectedDatabaseVersion,
    );
    seeded = true;
    const before = await lifecyclePage.evaluate(
      readAutomationLifecycleSnapshot,
      T146_AUTOMATION_LIFECYCLE_FIXTURE,
    );
    expect(before).toEqual(T146_EXPECTED_AUTOMATION_LIFECYCLE_SNAPSHOT);

    const stateB = await lifecyclePage.evaluate(async () => {
      const response = await fetch("/__t146/activate-b", {
        method: "POST",
        headers: { "x-zenflow-t146-control": "activate-version-b" },
      });
      if (!response.ok) throw new Error(`T146 update endpoint returned ${response.status}`);
      return response.json() as Promise<ServerState>;
    });
    expect(stateB.activeVersion).toBe("b");
    expect(stateB.artifact.buildTime).toBe(BUILD_B);
    expect(stateB.artifact.serviceWorkerSha256).not.toBe(stateA.artifact.serviceWorkerSha256);
    expect(stateB.artifact.indexSha256).not.toBe(stateA.artifact.indexSha256);

    await lifecyclePage
      .evaluate(async () => {
        const registration = await navigator.serviceWorker.ready;
        await registration.update();
      })
      .catch((error: unknown) => {
        if (!(error instanceof Error) || !error.message.includes("Execution context was destroyed")) {
          throw error;
        }
      });
    await expect
      .poll(
        async () => {
          try {
            const [server, scripts, standalone, controlled] = await Promise.all([
              getServerState(lifecyclePage!),
              getScriptSources(lifecyclePage!),
              lifecyclePage!.evaluate(() => window.matchMedia("(display-mode: standalone)").matches),
              lifecyclePage!.evaluate(() => Boolean(navigator.serviceWorker.controller)),
            ]);
            return {
              buildTime: server.artifact.buildTime,
              controlled,
              scriptsChanged: JSON.stringify(scripts) !== JSON.stringify(scriptsA),
              standalone,
            };
          } catch {
            return null;
          }
        },
        { timeout: 90_000 },
      )
      .toEqual({ buildTime: BUILD_B, controlled: true, scriptsChanged: true, standalone: true });

    const afterUpdate = await lifecyclePage.evaluate(
      readAutomationLifecycleSnapshot,
      T146_AUTOMATION_LIFECYCLE_FIXTURE,
    );
    expect(afterUpdate).toEqual(T146_EXPECTED_AUTOMATION_LIFECYCLE_SNAPSHOT);
    expect(afterUpdate).toEqual(before);

    await lifecyclePage.close();
    lifecyclePage = await launchInstalledPwa(context, cdp, manifestId);
    const afterRelaunch = await lifecyclePage.evaluate(
      readAutomationLifecycleSnapshot,
      T146_AUTOMATION_LIFECYCLE_FIXTURE,
    );
    expect(afterRelaunch).toEqual(T146_EXPECTED_AUTOMATION_LIFECYCLE_SNAPSHOT);
    expect(afterRelaunch).toEqual(before);
    const scriptsB = await getScriptSources(lifecyclePage);
    expect(scriptsB).not.toEqual(scriptsA);

    const cleanup = await lifecyclePage.evaluate(
      cleanupAutomationLifecycleFixture,
      T146_AUTOMATION_LIFECYCLE_FIXTURE,
    );
    expect(cleanup.remaining).toBe(0);
    seeded = false;

    const receipt = {
      schemaVersion: 1,
      task: "T146",
      status: "PASS",
      capturedAt: new Date().toISOString(),
      platform: "Installed PWA / desktop Chrome",
      browser: browserVersion.product,
      manifestId,
      update: {
        fromBuildTime: BUILD_A,
        toBuildTime: BUILD_B,
        fromServiceWorkerSha256: stateA.artifact.serviceWorkerSha256,
        toServiceWorkerSha256: stateB.artifact.serviceWorkerSha256,
        applicationShellChanged: true,
        browserSecureContext: true,
        standaloneDisplayMode: true,
        installedRelaunchVerified: true,
      },
      assertions: {
        primaryAndIntentRetainedExactlyOnce: true,
        derivedProjectionAndStableOutboxRetainedExactlyOnce: true,
        remoteAcknowledgedProjectionRetainedWithoutOutbox: true,
        staleOwnerProjectionAbsent: true,
        exactFixtureCleanup: true,
      },
      evidenceBoundary:
        "Real Chrome PWA install/standalone launch and production service-worker A-to-B update with isolated IndexedDB fixtures; no iOS PWA, production-user, authenticated cloud or public-deploy claim.",
    };
    await mkdir(dirname(RECEIPT_PATH), { recursive: true });
    await writeFile(RECEIPT_PATH, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  } finally {
    if (seeded) {
      const cleanupPage = [lifecyclePage, ...context.pages()].find(
        (page): page is Page => Boolean(page && !page.isClosed() && page.url().startsWith(BASE_URL)),
      );
      if (cleanupPage) {
        await cleanupPage
          .evaluate(cleanupAutomationLifecycleFixture, T146_AUTOMATION_LIFECYCLE_FIXTURE)
          .catch(() => undefined);
      }
    }
    if (installed && cdp && manifestId) {
      await cdp.send("PWA.uninstall", { manifestId }).catch(() => undefined);
    }
    await context.close();
    await rm(profileDir, { recursive: true, force: true });
  }
});
