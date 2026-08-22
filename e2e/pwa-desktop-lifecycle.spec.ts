import { expect, test, type Page } from "@playwright/test";

import { primeZenflowV2 } from "./helpers/zenflowV2State";

type ManifestShortcut = {
  name?: string;
  url?: string;
};

type PwaManifest = {
  icons?: Array<{ purpose?: string; sizes?: string; src?: string }>;
  orientation?: string;
  shortcuts?: ManifestShortcut[];
};

const offlineLocaleCases = [
  { dir: "ltr", locale: "en", pageTitle: "Offline - ZenFlow" },
  { dir: "ltr", locale: "uk", pageTitle: "Немає з’єднання — ZenFlow" },
  { dir: "ltr", locale: "es", pageTitle: "Sin conexión - ZenFlow" },
  { dir: "ltr", locale: "de", pageTitle: "Offline – ZenFlow" },
  { dir: "ltr", locale: "fr", pageTitle: "Hors ligne – ZenFlow" },
  { dir: "ltr", locale: "ja", pageTitle: "オフライン - ZenFlow" },
  { dir: "rtl", locale: "ar", pageTitle: "غير متصل - ZenFlow" },
  { dir: "rtl", locale: "he", pageTitle: "אין חיבור – ZenFlow" },
] as const;

const runtimeProblemsByPage = new WeakMap<Page, string[]>();
const deliberateOfflinePages = new WeakSet<Page>();
const expectedDeliberateOfflineConsoleError =
  "Failed to load resource: net::ERR_INTERNET_DISCONNECTED";
const expectedDeliberateOfflineRequestError = "net::ERR_INTERNET_DISCONNECTED";

test.beforeEach(async ({ page }) => {
  const runtimeProblems: string[] = [];
  runtimeProblemsByPage.set(page, runtimeProblems);

  page.on("pageerror", (error) => runtimeProblems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (
      deliberateOfflinePages.has(page) &&
      message.text() === expectedDeliberateOfflineConsoleError
    ) {
      return;
    }
    runtimeProblems.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText ?? "unknown";
    if (
      deliberateOfflinePages.has(page) &&
      errorText === expectedDeliberateOfflineRequestError
    ) {
      return;
    }
    runtimeProblems.push(
      `requestfailed: ${request.method()} ${new URL(request.url()).pathname} ${errorText}`,
    );
  });
});

test.afterEach(async ({ page }) => {
  expect(runtimeProblemsByPage.get(page) ?? []).toEqual([]);
  runtimeProblemsByPage.delete(page);
  deliberateOfflinePages.delete(page);
});

async function readManifest(page: Page): Promise<PwaManifest> {
  const response = await page.request.get("manifest.webmanifest");
  expect(response.ok()).toBe(true);
  return response.json() as Promise<PwaManifest>;
}

async function waitForWorkerControl(page: Page) {
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(async () => {
    if (!("serviceWorker" in navigator)) return false;
    await navigator.serviceWorker.ready;
    return Boolean(navigator.serviceWorker.controller);
  }, null, { timeout: 30_000 });
}

test.describe("installed desktop PWA lifecycle", () => {
  test("publishes adaptive desktop shortcuts and the high-resolution macOS icon", async ({ page }) => {
    const manifest = await readManifest(page);

    expect(manifest.orientation).toBeUndefined();
    expect(manifest.shortcuts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Log Mood", url: "/people-first-app/orb/?nav=v2" }),
        expect.objectContaining({ name: "Track Habit", url: "/people-first-app/habits/?nav=v2" }),
      ]),
    );
    expect(JSON.stringify(manifest.shortcuts)).not.toContain("navLayout");
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          purpose: "maskable",
          sizes: "1024x1024",
        }),
      ]),
    );
  });

  test("uses a stored JSON locale and honest RTL copy in the offline document", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("zenflow-language", JSON.stringify("ar"));
    });

    await page.goto("offline.html", { waitUntil: "domcontentloaded" });

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page).toHaveTitle("غير متصل - ZenFlow");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("أنت غير متصل");
    await expect(page.locator("#offline-desc")).toHaveText(
      "تعذّر على ZenFlow فتح هذه الصفحة دون اتصال. أعد الاتصال ثم حاول مرة أخرى.",
    );
    await expect(page.locator("#offline-desc")).not.toContainText("كل بياناتك");
    await expect(page.getByRole("button")).toHaveAttribute("aria-label", "إعادة المحاولة");
  });

  test("keeps every offline locale, malformed-storage fallback, and desktop accessibility state bounded", async ({
    browserName,
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "language", { configurable: true, value: "ar-EG" });
      Object.defineProperty(navigator, "languages", { configurable: true, value: ["ar-EG"] });
    });
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("offline.html", { waitUntil: "domcontentloaded" });

    for (const localeCase of offlineLocaleCases) {
      await page.evaluate((locale) => {
        localStorage.setItem("zenflow-language", JSON.stringify(locale));
      }, localeCase.locale);
      await page.reload({ waitUntil: "domcontentloaded" });

      await expect(page.locator("html")).toHaveAttribute("lang", localeCase.locale);
      await expect(page.locator("html")).toHaveAttribute("dir", localeCase.dir);
      await expect(page).toHaveTitle(localeCase.pageTitle);
      await expect(page.locator("#offline-desc")).not.toContainText(/All your data|كل بياناتك/);
      const reflow = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(reflow.scrollWidth).toBeLessThanOrEqual(reflow.clientWidth + 1);
    }

    for (const malformedValue of ["{malformed-json", "42", "null", "{}", "[]", "true"]) {
      await page.evaluate((value) => {
        localStorage.setItem("zenflow-language", value);
      }, malformedValue);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    }

    await page.evaluate(() => localStorage.removeItem("zenflow-language"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    await page.evaluate(() => localStorage.setItem("zenflow-language", JSON.stringify("en")));
    await page.reload({ waitUntil: "domcontentloaded" });

    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator(".brand-logo")).toHaveCSS("animation-name", "none");
    const retryButton = page.getByRole("button", { name: "Try again" });
    if (browserName === "chromium") {
      await page.keyboard.press("Tab");
      await expect(retryButton).toBeFocused();
    } else {
      // Playwright WebKit inherits the macOS full-keyboard-access preference,
      // which is disabled in this runner. Verify native-button focusability;
      // real Safari Tab order remains an explicit human/device evidence gap.
      await retryButton.focus();
      await expect(retryButton).toBeFocused();
    }

    if (browserName === "chromium") {
      await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
      expect(await page.evaluate(() => matchMedia("(forced-colors: active)").matches)).toBe(true);
      await expect(retryButton).toBeVisible();
    }
  });

  test("keeps a manifest-declared shortcut URL responsive to the browser window", async ({
    page,
  }) => {
    await primeZenflowV2(page, {
      clearStorage: true,
      language: "en",
      privacyNoTracking: true,
      theme: "paper",
      user: {
        id: "pwa-desktop-layout-test",
        name: "PWA Desktop Layout Test",
      },
    });

    const manifest = await readManifest(page);
    const moodShortcut = manifest.shortcuts?.find((shortcut) => shortcut.name === "Log Mood");
    expect(moodShortcut?.url).toBe("/people-first-app/orb/?nav=v2");

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(moodShortcut?.url ?? "./", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("nav-v2-orchestrator")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("sidebar-v2")).toBeVisible();

    await page.setViewportSize({ width: 700, height: 800 });
    await expect(page.getByTestId("sidebar-v2")).toBeHidden();
    await expect(page.getByTestId("nav-v2-open-drawer")).toBeVisible();

    const reflow = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(reflow.scrollWidth).toBeLessThanOrEqual(reflow.clientWidth + 1);
  });

  test("keeps the shared PWA shell bounded across mobile browser orientation changes", async ({
    page,
  }) => {
    await primeZenflowV2(page, {
      clearStorage: true,
      language: "en",
      privacyNoTracking: true,
      theme: "paper",
      user: {
        id: "pwa-mobile-orientation-test",
        name: "PWA Mobile Orientation Test",
      },
    });

    const assertBoundedAt = async (viewport: { width: number; height: number }) => {
      await page.setViewportSize(viewport);
      await page.waitForFunction((width) => window.innerWidth === width, viewport.width);
      const reflow = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(reflow.scrollWidth).toBeLessThanOrEqual(reflow.clientWidth + 1);
    };

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("orb/?nav=v2", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("nav-v2-orchestrator")).toBeVisible({ timeout: 30_000 });
    await assertBoundedAt({ width: 390, height: 844 });
    await assertBoundedAt({ width: 844, height: 390 });
  });

  test("keeps macOS Safari install guidance bounded in a narrow RTL window", async (
    { page },
    testInfo,
  ) => {
    test.skip(
      testInfo.project.name !== "pwa-desktop-webkit",
      "The manual Add to Dock path is specific to desktop macOS Safari, not mobile WebKit.",
    );

    await primeZenflowV2(page, {
      clearStorage: true,
      language: "ar",
      privacyNoTracking: true,
      theme: "paper",
      user: {
        id: "pwa-safari-guidance-test",
        name: "PWA Safari Guidance Test",
      },
    });

    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("settings?nav=v2", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("nav-v2-orchestrator")).toBeVisible({ timeout: 30_000 });

    const guidance = page.getByTestId("settings-v2-macos-pwa-install-guidance");
    await expect(guidance).toBeVisible();
    await guidance.locator("summary").click();
    await expect(guidance).toContainText("macOS Sonoma 14");
    await expect(guidance).toContainText("Safari");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const reflow = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(reflow.scrollWidth).toBeLessThanOrEqual(reflow.clientWidth + 1);
  });

  test("falls back to the bounded offline document when the precached app shell is missing", async ({
    browserName,
    context,
    page,
  }) => {
    test.skip(
      browserName === "webkit",
      "Playwright WebKit throws an internal error on offline navigation; Chromium runtime and WebKit readiness are verified separately.",
    );

    await waitForWorkerControl(page);

    const removedShellEntries = await page.evaluate(async () => {
      let removed = 0;
      for (const cacheName of await caches.keys()) {
        const cache = await caches.open(cacheName);
        for (const request of await cache.keys()) {
          if (new URL(request.url).pathname.endsWith("/index.html")) {
            if (await cache.delete(request)) removed += 1;
          }
        }
      }
      return removed;
    });
    expect(removedShellEntries).toBeGreaterThan(0);

    deliberateOfflinePages.add(page);
    await context.setOffline(true);
    try {
      await page.goto("missing-offline-route", { waitUntil: "domcontentloaded" });
      await expect(page.locator("#offline-title")).toBeVisible({ timeout: 20_000 });
      await expect(page.locator("#offline-desc")).not.toContainText("All your data");
    } finally {
      await context.setOffline(false);
      deliberateOfflinePages.delete(page);
    }
  });
});
