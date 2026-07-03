import { expect, test, type Page } from "@playwright/test";

import { primeZenflowV2, v2RoutePath } from "./helpers/zenflowV2State";

const AUDIO_RANGE_TARGETS = [
  "sounds/soft-air-veil.mp3",
  "sounds/gentle-water-bed.mp3",
  "sounds/soft-rain-veil.mp3",
  "sounds/hyperfocus/hyperfocus-forest-soft.mp3",
] as const;

async function waitForCachedAudioTargets(page: Page, urls: string[]) {
  await expect
    .poll(
      () =>
        page.evaluate(async (urls) => {
          const cacheName = (await caches.keys()).find((name) => name.includes("runtime-audio"));
          if (!cacheName) return false;
          const cache = await caches.open(cacheName);
          const matches = await Promise.all(urls.map((url) => cache.match(url, { ignoreVary: true })));
          return matches.every(Boolean);
        }, urls),
      {
        message: "all PWA audio targets are cached before offline Range fetches",
        timeout: 30_000,
      }
    )
    .toBe(true);
}

async function waitForServiceWorkerControl(page: Page) {
  const ready = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return { ready: false, controlled: false, activeScript: null };
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 20_000)),
    ]);

    return {
      activeScript: registration?.active?.scriptURL ?? null,
      controlled: Boolean(navigator.serviceWorker.controller),
      ready: Boolean(registration?.active),
    };
  });

  expect(ready.ready, "service worker reaches active state").toBe(true);
  if (ready.controlled) return ready;

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("orb-page")).toBeVisible({ timeout: 30_000 });
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

test.describe("PWA offline app audio range cache", () => {
  test("serves cached shipped MP3 byte ranges while offline", async ({ browserName, context, page }) => {
    test.skip(browserName !== "chromium", "Chromium covers service-worker Range behavior for this smoke.");

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
        id: "pwa-audio-range-auditor",
        name: "PWA Audio Range Auditor",
      },
    });

    await page.goto(v2RoutePath("orb", { dev: false, layout: "phone" }), {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByTestId("orb-page")).toBeVisible({ timeout: 30_000 });

    const serviceWorker = await waitForServiceWorkerControl(page);
    expect(serviceWorker.controlled, "page is controlled before offline range fetch").toBe(true);
    expect(serviceWorker.activeScript, "active service worker script").toContain("/sw.js");

    const audioRangeUrls = await page.evaluate(async (targets) => {
      const registration = await navigator.serviceWorker.ready;
      return targets.map((target) => new URL(target, registration.scope).toString());
    }, AUDIO_RANGE_TARGETS);

    await waitForCachedAudioTargets(page, audioRangeUrls);

    let facts: Array<{ path: string; status: number; contentRange: string | null; bytes: number }> = [];
    await context.setOffline(true);
    try {
      facts = await page.evaluate(async (urls) =>
        Promise.all(
          urls.map(async (url) => {
            const response = await fetch(url, {
              headers: { Range: "bytes=0-1023" },
            });
            const body = await response.arrayBuffer();
            return {
              path: new URL(url).pathname,
              status: response.status,
              contentRange: response.headers.get("Content-Range"),
              bytes: body.byteLength,
            };
          })
        ),
        audioRangeUrls
      );
    } finally {
      await context.setOffline(false);
    }

    for (const fact of facts) {
      expect(fact.status, fact.path).toBe(206);
      expect(fact.contentRange, fact.path).toMatch(/^bytes 0-1023\/\d+$/);
      expect(fact.bytes, fact.path).toBe(1024);
    }
  });
});
