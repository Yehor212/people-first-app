import { expect, test, type Page } from "@playwright/test";

import {
  CONNECTIVITY_PROBE_QUERY_PARAM,
  CONNECTIVITY_PROBE_QUERY_VALUE,
} from "../src/lib/connectivityProbe";
import { primeZenflowV2, v2RoutePath } from "./helpers/zenflowV2State";

async function expectDiaryOrbBackground(page: Page) {
  const background = page.getByTestId("diary-orb-background");
  await expect(background).toHaveCount(1);
  await expect(background).toBeVisible();
  await expect(background).toHaveAttribute("aria-hidden", "true");
  await expect(background).toHaveCSS("pointer-events", "none");
  await expect(background).toHaveClass(/orb-day-scope/);
  const dayScene = background.getByTestId("day-cosmic-background");
  await expect(dayScene).toBeVisible();
  await expect(dayScene).toHaveAttribute("data-daymode", /dawn|morning|afternoon|golden|dusk/);
  return dayScene;
}

async function openPrimedDiary(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, "standalone", {
      configurable: true,
      value: true,
    });
  });
  await primeZenflowV2(page, {
    clearStorage: true,
    language: "en",
    privacyNoTracking: true,
    theme: "paper",
    user: {
      id: "pwa-offline-diary-auditor",
      name: "PWA Offline Diary Auditor",
    },
  });

  await page.goto(v2RoutePath("diary", { dev: false, layout: "phone" }), {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId("journal-page-shell")).toBeVisible({ timeout: 30_000 });
  await expectDiaryOrbBackground(page);
}

async function expectDiaryTabActions(page: Page) {
  await expect(page.getByTestId("journal-mobile-entry")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("journal-mobile-stats")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("journal-mobile-favorites")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("journal-mobile-settings")).toBeVisible({ timeout: 30_000 });

  await page.getByTestId("journal-mobile-favorites").click();
  await expect(page.getByTestId("journal-favorites-panel")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("journal-mobile-entry").click();
  await expect(page.getByTestId("journal-favorites-panel")).toHaveCount(0);
}

async function openNewJournalEntry(page: Page) {
  const launcher = page.getByTestId("journal-entry-main-fab");
  if (!(await launcher.isVisible())) {
    await page.getByRole("button", { name: /^New entry$/i }).click();
    return;
  }

  await launcher.click();
  const newEntryAction = page.getByTestId("journal-fab-action-new-entry");
  if (await newEntryAction.count()) {
    await newEntryAction.click();
    return;
  }
  await page.getByTestId("journal-fab-action-primary").click();
}

async function waitForServiceWorkerControl(page: Page) {
  const ready = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return { ready: false, controlled: false };
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 20_000)),
    ]);
    if (!registration) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      return {
        activeScript: registrations[0]?.active?.scriptURL ?? null,
        controlled: Boolean(navigator.serviceWorker.controller),
        ready: false,
      };
    }
    return {
      activeScript: registration.active?.scriptURL ?? null,
      controlled: Boolean(navigator.serviceWorker.controller),
      ready: Boolean(registration.active),
    };
  });

  expect(ready.ready, "service worker reaches active state").toBe(true);
  if (ready.controlled) return ready;

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("journal-page-shell")).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, {
    timeout: 30_000,
  });

  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return {
      activeScript: registration.active?.scriptURL ?? null,
      controlled: Boolean(navigator.serviceWorker.controller),
      ready: Boolean(registration.active),
    };
  });
}

async function installOfflineConnectivityProbeFailure(page: Page) {
  await page.addInitScript(
    ({ queryParam, queryValue }) => {
      const nativeFetch = window.fetch.bind(window);
      window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        const rawUrl =
          typeof input === "string" || input instanceof URL ? input.toString() : input.url;
        const requestUrl = new URL(rawUrl, window.location.href);
        if (requestUrl.searchParams.get(queryParam) === queryValue) {
          return Promise.reject(new TypeError("Simulated offline connectivity probe failure"));
        }
        return nativeFetch(input, init);
      };
    },
    {
      queryParam: CONNECTIVITY_PROBE_QUERY_PARAM,
      queryValue: CONNECTIVITY_PROBE_QUERY_VALUE,
    },
  );
}

test.describe("PWA offline V2 Diary", () => {
  test("boots the visited diary route offline from the production service worker", async ({
    browserName,
    context,
    page,
  }) => {
    test.skip(
      browserName === "webkit",
      "Playwright WebKit throws an internal error on offline navigation; WebKit PWA readiness is covered separately.",
    );

    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await openPrimedDiary(page);
    const serviceWorker = await waitForServiceWorkerControl(page);
    expect(serviceWorker.controlled, "page is controlled before offline reload").toBe(true);
    expect(serviceWorker.activeScript, "active service worker script").toContain("/sw.js");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("journal-page-shell")).toBeVisible({ timeout: 30_000 });
    await expectDiaryOrbBackground(page);
    await expectDiaryTabActions(page);

    const onlineFacts = await page.evaluate(async () => {
      const cacheNames = "caches" in window ? await caches.keys() : [];
      return {
        cacheNames,
        controlled: Boolean(navigator.serviceWorker?.controller),
        diaryRoute: window.location.pathname.endsWith("/diary"),
        online: navigator.onLine,
      };
    });
    expect(onlineFacts.controlled).toBe(true);
    expect(onlineFacts.diaryRoute).toBe(true);
    expect(onlineFacts.cacheNames.some((name) => name.includes("precache"))).toBe(true);
    expect(onlineFacts.cacheNames.some((name) => name.includes("runtime-assets"))).toBe(true);

    let offlineFacts: {
      controlled: boolean;
      diaryRoute: boolean;
      offlineEntryVisible: boolean;
      online: boolean;
      shellVisible: boolean;
      backgroundMode: string | null;
    };
    await installOfflineConnectivityProbeFailure(page);
    // Playwright 1.62.1 loses navigator.onLine on reload while requests remain
    // offline (microsoft/playwright#42174, also reproduced on a data URL).
    // Keep that browser signal consistent with the still-blocked network.
    const offlineSession = await context.newCDPSession(page);
    await offlineSession.send("Page.enable");
    const offlineStateScript = await offlineSession.send("Page.addScriptToEvaluateOnNewDocument", {
      source: 'Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });',
    });
    await context.setOffline(true);
    try {
      expect(await page.evaluate(() => navigator.onLine), "offline emulation reaches the current page").toBe(false);
      await page.reload({
        waitUntil: "domcontentloaded",
      });

      expect(await page.evaluate(() => navigator.onLine), "offline emulation survives navigation").toBe(false);
      await expect(page.getByTestId("journal-page-shell")).toBeVisible({ timeout: 30_000 });
      const offlineBackground = await expectDiaryOrbBackground(page);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(offlineBackground).toHaveAttribute("data-animated", "false");
      const offlineBanner = page.getByTestId("offline-banner");
      await expect(offlineBanner).toBeVisible();
      await offlineBanner.getByRole("button", { name: "Dismiss" }).click();
      await expect(offlineBanner).toHaveCount(0);
      await expectDiaryTabActions(page);

      const offlineEntryText = "A diary entry written while the PWA was offline.";
      await openNewJournalEntry(page);
      const editor = page.locator("[contenteditable='true']");
      await expect(editor).toBeVisible({ timeout: 20_000 });
      await editor.fill(offlineEntryText);
      await page.getByRole("button", { name: /^Save$/i }).click();
      // Saving switches contenteditable to false before the durable commit.
      // Wait for the whole editor to close, not the editable selector to vanish.
      await expect(page.getByTestId("journal-entry-editor")).toHaveCount(0, { timeout: 20_000 });
      await expect(page.getByText(offlineEntryText)).toBeVisible({ timeout: 20_000 });
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByText(offlineEntryText)).toBeVisible({ timeout: 30_000 });

      offlineFacts = await page.evaluate(() => {
        const shell = document.querySelector<HTMLElement>("[data-testid='journal-page-shell']");
        const background = document.querySelector<HTMLElement>(
          "[data-testid='diary-orb-background'] [data-testid='day-cosmic-background']",
        );
        return {
          controlled: Boolean(navigator.serviceWorker?.controller),
          diaryRoute: window.location.pathname.endsWith("/diary"),
          offlineEntryVisible: document.body.textContent?.includes(
            "A diary entry written while the PWA was offline.",
          ) ?? false,
          online: navigator.onLine,
          shellVisible: Boolean(shell && shell.getBoundingClientRect().height > 0),
          backgroundMode: background?.dataset.daymode ?? null,
        };
      });
    } finally {
      await offlineSession.send("Page.removeScriptToEvaluateOnNewDocument", {
        identifier: offlineStateScript.identifier,
      });
      await page.evaluate(() => Reflect.deleteProperty(navigator, "onLine"));
      await context.setOffline(false);
      await offlineSession.detach();
    }

    expect(offlineFacts).toMatchObject({
      controlled: true,
      diaryRoute: true,
      offlineEntryVisible: true,
      online: false,
      shellVisible: true,
    });
    expect(offlineFacts.backgroundMode).toMatch(/dawn|morning|afternoon|golden|dusk/);
    await page.reload({ waitUntil: "domcontentloaded" });
    expect(await page.evaluate(() => navigator.onLine), "real online signal is restored").toBe(true);
    await expect(page.getByText("A diary entry written while the PWA was offline.")).toBeVisible({
      timeout: 30_000,
    });
    expect(errors).toEqual([]);
  });

  test("renders the production iPhone WebKit diary route with install metadata", async ({
    browserName,
    page,
  }) => {
    test.skip(browserName !== "webkit", "WebKit-only iPhone PWA readiness coverage.");

    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await openPrimedDiary(page);
    await expect(page.getByTestId("journal-page-shell")).toBeVisible({ timeout: 30_000 });
    await expectDiaryOrbBackground(page);
    await expectDiaryTabActions(page);

    const readinessFacts = await page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>("[data-testid='journal-page-shell']");
      const background = document.querySelector<HTMLElement>("[data-testid='diary-orb-background']");
      return {
        diaryRoute: window.location.pathname.endsWith("/diary"),
        manifestHref: document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href ?? null,
        online: navigator.onLine,
        shellVisible: Boolean(shell && shell.getBoundingClientRect().height > 0),
        standalone: (navigator as Navigator & { standalone?: boolean }).standalone === true,
        backgroundVisible: Boolean(background && background.getBoundingClientRect().height > 0),
      };
    });

    expect(readinessFacts).toMatchObject({
      diaryRoute: true,
      online: true,
      shellVisible: true,
      standalone: true,
      backgroundVisible: true,
    });
    expect(readinessFacts.manifestHref).toContain("/people-first-app/manifest.webmanifest");
    expect(errors).toEqual([]);
  });
});
