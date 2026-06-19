import { expect, test, type Page } from "@playwright/test";

import { primeZenflowV2, v2RoutePath } from "./helpers/zenflowV2State";

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
  await expect(page.getByTestId("journal-wallpaper")).toBeVisible();
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

    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByTestId("journal-page-shell")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("journal-wallpaper")).toHaveAttribute(
      "data-wallpaper-platform",
      "universal",
    );

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

    await context.setOffline(true);
    await page.reload({
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByTestId("journal-page-shell")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("journal-wallpaper")).toHaveAttribute(
      "data-wallpaper-motion",
      "static",
    );

    const offlineFacts = await page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>("[data-testid='journal-page-shell']");
      const wallpaper = document.querySelector<HTMLElement>("[data-testid='journal-wallpaper']");
      return {
        controlled: Boolean(navigator.serviceWorker?.controller),
        diaryRoute: window.location.pathname.endsWith("/diary"),
        online: navigator.onLine,
        shellVisible: Boolean(shell && shell.getBoundingClientRect().height > 0),
        wallpaperTone: wallpaper?.dataset.wallpaperTone ?? null,
      };
    });

    expect(offlineFacts).toMatchObject({
      controlled: true,
      diaryRoute: true,
      online: false,
      shellVisible: true,
    });
    expect(offlineFacts.wallpaperTone).toMatch(/day|night/);
    expect(errors).toEqual([]);
  });

  test("prepares the iPhone WebKit diary route for PWA offline use", async ({
    browserName,
    context,
    page,
  }) => {
    test.skip(browserName !== "webkit", "WebKit-only iPhone PWA readiness coverage.");

    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await openPrimedDiary(page);
    const serviceWorker = await waitForServiceWorkerControl(page);
    expect(serviceWorker.controlled, "page is controlled before offline state").toBe(true);
    expect(serviceWorker.activeScript, "active service worker script").toContain("/sw.js");

    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByTestId("journal-page-shell")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("journal-wallpaper")).toBeVisible();

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

    await context.setOffline(true);
    const offlineFacts = await page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>("[data-testid='journal-page-shell']");
      const wallpaper = document.querySelector<HTMLElement>("[data-testid='journal-wallpaper']");
      return {
        controlled: Boolean(navigator.serviceWorker?.controller),
        online: navigator.onLine,
        shellVisible: Boolean(shell && shell.getBoundingClientRect().height > 0),
        wallpaperVisible: Boolean(wallpaper && wallpaper.getBoundingClientRect().height > 0),
      };
    });

    expect(offlineFacts).toMatchObject({
      controlled: true,
      online: false,
      shellVisible: true,
      wallpaperVisible: true,
    });
    expect(errors).toEqual([]);
  });
});
