import { expect, test } from "@playwright/test";

import { primeZenflowV2, v2RoutePath } from "./helpers/zenflowV2State";

test("precache keeps the four approved Atelier assets available after an offline restart", async ({
  context,
  page,
}) => {
  test.setTimeout(120_000);
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
  });
  await page.goto(v2RoutePath("diary", { dev: false, layout: "phone" }), {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId("journal-page-shell")).toBeVisible({
    timeout: 30_000,
  });
  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service Worker API unavailable.");
    }
    await navigator.serviceWorker.ready;
  });
  if (
    !(await page.evaluate(
      () => "serviceWorker" in navigator && Boolean(navigator.serviceWorker.controller),
    ))
  ) {
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("journal-page-shell")).toBeVisible({
      timeout: 30_000,
    });
    await page.waitForFunction(
      () => Boolean(navigator.serviceWorker?.controller),
      null,
      { timeout: 30_000 },
    );
  }
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("journal-page-shell")).toBeVisible({
    timeout: 30_000,
  });

  const atelierUrls = await page.evaluate(async () => {
    const names = await caches.keys();
    const requests = (
      await Promise.all(
        names.map(async (name) => {
          const cache = await caches.open(name);
          return cache.keys();
        }),
      )
    ).flat();
    return Array.from(
      new Set(
        requests
          .map((request) => request.url)
          .filter(
            (url) =>
              url.includes("/assets/atelier-v12-3-") &&
              !url.endsWith(".br") &&
              !url.endsWith(".gz"),
          ),
      ),
    ).sort();
  });
  expect(atelierUrls).toHaveLength(4);
  expect(atelierUrls.filter((url) => url.endsWith(".tgs"))).toHaveLength(2);
  expect(atelierUrls.filter((url) => url.endsWith(".svg"))).toHaveLength(2);

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("journal-page-shell")).toBeVisible({
    timeout: 30_000,
  });
  const offlineResponses = await page.evaluate(async (urls) => {
    return Promise.all(
      urls.map(async (url) => {
        const response = await fetch(url);
        return {
          bytes: (await response.arrayBuffer()).byteLength,
          ok: response.ok,
          url,
        };
      }),
    );
  }, atelierUrls);
  for (const response of offlineResponses) {
    expect(response.ok, response.url).toBe(true);
    expect(response.bytes, response.url).toBeGreaterThan(30_000);
  }
});
