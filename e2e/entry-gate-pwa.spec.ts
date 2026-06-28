import { expect, test, type Browser, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

type EntryThemePreference = "paper" | "ink" | "auto";
type EntryScreen = "language" | "auth";
type EntryLanguage = "en" | "uk" | "es" | "de" | "fr" | "ja" | "ar" | "he";

interface PwaEntryScenario {
  colorScheme: "light" | "dark";
  fileName: string;
  language: EntryLanguage;
  name: string;
  platform: "pwa-phone" | "pwa-tablet" | "pwa-desktop";
  screen: EntryScreen;
  theme: EntryThemePreference;
  viewport: { width: number; height: number };
  deviceScaleFactor: number;
}

interface PwaManifestIcon {
  purpose?: string;
  sizes?: string;
  src?: string;
  type?: string;
}

interface PwaManifest {
  background_color?: string;
  display?: string;
  icons?: PwaManifestIcon[];
  name?: string;
  scope?: string;
  short_name?: string;
  start_url?: string;
  theme_color?: string;
}

const OUTPUT_DIR = path.resolve(process.cwd(), "output/playwright/pwa-entry-20260615");
const SUPPORTED_LANGUAGES: readonly EntryLanguage[] = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"];
const RTL_LANGUAGES = new Set<EntryLanguage>(["ar", "he"]);
const DIST_ASSETS = [
  "dist/index.html",
  "dist/manifest.webmanifest",
  "dist/sw.js",
  "dist/registerSW.js",
  "dist/offline.html",
  "dist/icon-source.svg",
  "dist/version.json",
  "dist/version-check.js",
] as const;

function isEnvEnabled(name: string) {
  return process.env[name] !== "false";
}

function isPublicAccessReady(name: string) {
  return process.env[name] === "true";
}

function expectedEntryAuthProviderIds() {
  const providerIds = ["google"];
  if (isEnvEnabled("VITE_ENABLE_FACEBOOK_AUTH") && isPublicAccessReady("VITE_FACEBOOK_PUBLIC_ACCESS_READY")) {
    providerIds.push("facebook");
  }
  if (isEnvEnabled("VITE_ENABLE_TELEGRAM_AUTH")) {
    providerIds.push("telegram");
  }
  if (isEnvEnabled("VITE_ENABLE_APPLE_AUTH") && isPublicAccessReady("VITE_APPLE_PUBLIC_ACCESS_READY")) {
    providerIds.push("apple");
  }
  return providerIds;
}

const scenarios: PwaEntryScenario[] = [
  {
    name: "pwa-phone-language-light",
    fileName: "pwa-phone-language-light.png",
    platform: "pwa-phone",
    screen: "language",
    theme: "paper",
    language: "en",
    colorScheme: "light",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  },
  {
    name: "pwa-phone-language-dark",
    fileName: "pwa-phone-language-dark.png",
    platform: "pwa-phone",
    screen: "language",
    theme: "ink",
    language: "en",
    colorScheme: "dark",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  },
  {
    name: "pwa-phone-language-ar-rtl",
    fileName: "pwa-phone-language-ar-rtl.png",
    platform: "pwa-phone",
    screen: "language",
    theme: "paper",
    language: "ar",
    colorScheme: "light",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  },
  {
    name: "pwa-phone-language-he-rtl",
    fileName: "pwa-phone-language-he-rtl.png",
    platform: "pwa-phone",
    screen: "language",
    theme: "paper",
    language: "he",
    colorScheme: "light",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  },
  {
    name: "pwa-phone-auth-light",
    fileName: "pwa-phone-auth-light.png",
    platform: "pwa-phone",
    screen: "auth",
    theme: "paper",
    language: "en",
    colorScheme: "light",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  },
  {
    name: "pwa-phone-auth-dark",
    fileName: "pwa-phone-auth-dark.png",
    platform: "pwa-phone",
    screen: "auth",
    theme: "ink",
    language: "en",
    colorScheme: "dark",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  },
  {
    name: "pwa-tablet-language-system",
    fileName: "pwa-tablet-language-system.png",
    platform: "pwa-tablet",
    screen: "language",
    theme: "auto",
    language: "en",
    colorScheme: "dark",
    viewport: { width: 768, height: 1024 },
    deviceScaleFactor: 2,
  },
  {
    name: "pwa-desktop-language-light",
    fileName: "pwa-desktop-language-light.png",
    platform: "pwa-desktop",
    screen: "language",
    theme: "paper",
    language: "en",
    colorScheme: "light",
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  },
  {
    name: "pwa-desktop-auth-dark",
    fileName: "pwa-desktop-auth-dark.png",
    platform: "pwa-desktop",
    screen: "auth",
    theme: "ink",
    language: "en",
    colorScheme: "dark",
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  },
];

function sha256File(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function prepareOutputDir() {
  if (existsSync(OUTPUT_DIR)) {
    rmSync(OUTPUT_DIR, { recursive: true, force: true });
  }
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

function collectAssetFacts() {
  return Object.fromEntries(
    DIST_ASSETS.map((assetPath) => {
      expect(existsSync(assetPath), `${assetPath} exists after production PWA build`).toBe(true);
      return [
        assetPath,
        {
          bytes: statSync(assetPath).size,
          sha256: sha256File(assetPath),
        },
      ];
    }),
  );
}

function readManifest() {
  return JSON.parse(readFileSync("dist/manifest.webmanifest", "utf8")) as PwaManifest;
}

async function newPwaContext(browser: Browser, scenario: PwaEntryScenario) {
  return browser.newContext({
    colorScheme: scenario.colorScheme,
    deviceScaleFactor: scenario.deviceScaleFactor,
    hasTouch: scenario.platform !== "pwa-desktop",
    isMobile: scenario.platform === "pwa-phone",
    viewport: scenario.viewport,
  });
}

async function primeEntryState(page: Page, scenario: PwaEntryScenario) {
  await page.addInitScript(({ scenario }) => {
    const json = (value: unknown) => JSON.stringify(value);
    const legacyTheme =
      scenario.theme === "paper" ? "light" : scenario.theme === "ink" ? "dark" : "system";
    const originalMatchMedia = window.matchMedia.bind(window);

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (query: string) => {
        if (query.trim() === "(display-mode: standalone)") {
          const listeners = new Set<EventListenerOrEventListenerObject>();
          return {
            matches: true,
            media: query,
            onchange: null,
            addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
              listeners.add(listener);
            },
            removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
              listeners.delete(listener);
            },
            addListener: (listener: EventListenerOrEventListenerObject) => {
              listeners.add(listener);
            },
            removeListener: (listener: EventListenerOrEventListenerObject) => {
              listeners.delete(listener);
            },
            dispatchEvent: () => true,
          } as MediaQueryList;
        }
        return originalMatchMedia(query);
      },
    });
    Object.defineProperty(window.navigator, "standalone", {
      configurable: true,
      get: () => true,
    });

    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("zenflow-language", json(scenario.language));
    localStorage.setItem("zenflow-language-selected", json(scenario.screen === "auth"));
    localStorage.setItem("zenflow-google-auth-checked", json(false));
    localStorage.setItem("zenflow-tutorial-complete", json(false));
    localStorage.setItem("zenflow-onboarding-complete", json(false));
    localStorage.setItem("zenflow-notification-permission-checked", json(false));
    localStorage.setItem("zenflow-theme", legacyTheme);
    localStorage.setItem("zenflow_oled_mode", json(false));
    localStorage.setItem(
      "zenflow:theme-v0c",
      json({ state: { theme: scenario.theme }, version: 0 }),
    );
  }, { scenario });
}

async function collectLanguageFact(page: Page) {
  return page.evaluate(() => {
    const screen = document.querySelector<HTMLElement>("[data-testid='language-selector-screen']");
    const auditedElements = Array.from(
      document.querySelectorAll<HTMLElement>(
        "main.entry-gate-screen, section, header, h1, button, img, a, [data-testid]",
      ),
    ).filter((element) => {
      if (element.closest("[data-testid='entry-gate-backdrop']")) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 1 && rect.height > 1 && style.visibility !== "hidden";
    });
    const outOfBounds = auditedElements
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          testId: element.dataset.testid ?? element.tagName.toLowerCase(),
          left: Math.round(rect.left * 100) / 100,
          right: Math.round(rect.right * 100) / 100,
          top: Math.round(rect.top * 100) / 100,
          bottom: Math.round(rect.bottom * 100) / 100,
        };
      })
      .filter(
        (rect) =>
          rect.left < -1 ||
          rect.right > window.innerWidth + 1 ||
          rect.top < -1 ||
          rect.bottom > window.innerHeight + Math.max(1, window.innerHeight * 0.75),
      );
    const arrow = document.querySelector<SVGElement>("[data-testid='language-continue'] svg");
    const continueButton = document.querySelector<HTMLElement>("[data-testid='language-continue']");
    const continueRect = continueButton?.getBoundingClientRect();

    return {
      htmlDir: document.documentElement.dir,
      htmlLang: document.documentElement.lang,
      overflowX: {
        document: document.documentElement.scrollWidth > window.innerWidth + 1,
        screen: screen ? screen.scrollWidth > screen.clientWidth + 1 : true,
      },
      outOfBounds,
      themeSwitcher: Boolean(document.querySelector("[data-testid='entry-theme-switcher']")),
      languageOptions: document.querySelectorAll("[data-testid^='language-option-']").length,
      continueHeight: continueRect ? Math.round(continueRect.height * 100) / 100 : 0,
      rtlArrowTransform: arrow ? window.getComputedStyle(arrow).transform : null,
      standalone: window.matchMedia("(display-mode: standalone)").matches,
    };
  });
}

test.use({ browserName: "chromium" });
test.describe.configure({ mode: "serial" });

test.describe("PWA entry gate evidence", () => {
  test("captures the current installable PWA entry matrix and generated assets", async ({
    browser,
    browserName,
  }, testInfo) => {
    test.setTimeout(180_000);
    expect(browserName).toBe("chromium");
    prepareOutputDir();

    const manifest = readManifest();
    const assetFacts = collectAssetFacts();
    const expectedAuthProviders = expectedEntryAuthProviderIds();
    const indexHtml = readFileSync("dist/index.html", "utf8");
    const serviceWorker = readFileSync("dist/sw.js", "utf8");
    const registration = readFileSync("dist/registerSW.js", "utf8");
    const entryCss = readFileSync("src/components/EntryGate.css", "utf8");
    const languageSelectorSource = readFileSync("src/components/LanguageSelector.tsx", "utf8");
    const authScreenSource = readFileSync("src/components/auth-screen/AuthScreen.tsx", "utf8");

    expect(manifest.name).toBe("ZenFlow - Daily Wellness");
    expect(manifest.short_name).toBe("ZenFlow");
    expect(manifest.start_url).toBe("/people-first-app/");
    expect(manifest.scope).toBe("/people-first-app/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBe("#4a9d7c");
    expect(manifest.background_color).toBe("#071513");
    expect(manifest.icons, "PWA icon inventory").toHaveLength(16);
    expect(manifest.icons?.some((icon) => icon.sizes === "192x192" && icon.purpose === "any")).toBe(true);
    expect(manifest.icons?.some((icon) => icon.sizes === "512x512" && icon.purpose === "maskable")).toBe(true);
    expect(indexHtml).toContain("manifest.webmanifest");
    expect(indexHtml).toContain("pwa-192.png");
    expect(serviceWorker.length).toBeGreaterThan(10_000);
    expect(serviceWorker).toContain("manifest.webmanifest");
    expect(serviceWorker).toContain("runtime-perf-bootstrap.js");
    expect(serviceWorker).not.toContain("version-check.js");
    expect(registration).toContain("serviceWorker");
    expect(entryCss).toContain(":root[data-runtime-perf] .entry-gate-aurora");
    expect(entryCss).toContain("body.reduce-motion .entry-gate-aurora");
    expect(entryCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(languageSelectorSource).toContain("const animated = !isAndroid && shouldAnimate();");
    expect(languageSelectorSource).toContain("<EntryGateBackdrop animated={animated} />");
    expect(authScreenSource).toContain("const animated = !isAndroid && shouldAnimate();");
    expect(authScreenSource).toContain("<EntryGateBackdrop animated={animated} />");

    const facts = [];
    const verificationLines = [
      `Generated: ${new Date().toISOString()}`,
      `Base URL: ${String(testInfo.project.use.baseURL ?? "")}`,
      `Browser: ${browserName} production preview`,
      `Expected auth providers: ${expectedAuthProviders.join(",")}`,
    ];
    const baseURL = String(
      testInfo.project.use.baseURL ?? process.env.ZENFLOW_PLAYWRIGHT_BASE_URL ?? "",
    );
    expect(baseURL, "PWA entry evidence baseURL").toContain("/people-first-app/");

    for (const [assetPath, fact] of Object.entries(assetFacts)) {
      verificationLines.push(`${assetPath}: ${fact.sha256} ${fact.bytes} bytes`);
    }

    for (const scenario of scenarios) {
      const context = await newPwaContext(browser, scenario);
      const page = await context.newPage();
      const consoleMessages: string[] = [];
      const failedRequests: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error" || message.type() === "warning") {
          consoleMessages.push(`${message.type()}: ${message.text()}`);
        }
      });
      page.on("requestfailed", (request) => {
        failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText}`);
      });

      await primeEntryState(page, scenario);
      await page.goto(baseURL, { waitUntil: "domcontentloaded" });

      const screenTestId =
        scenario.screen === "language" ? "language-selector-screen" : "auth-screen";
      await expect(page.getByTestId(screenTestId)).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(350);

      const screenshotPath = path.join(OUTPUT_DIR, scenario.fileName);
      await page.screenshot({ path: screenshotPath });

      const fact = await page.evaluate(async ({ scenario, screenTestId }) => {
        const byTestId = (testId: string) =>
          document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
        const main = byTestId(screenTestId);
        const logo = document.querySelector<HTMLImageElement>(
          "[data-testid='zenflow-language-logo'] img, [data-testid='zenflow-auth-logo'] img",
        );
        const logoRect = logo?.getBoundingClientRect();
        let logoSvg: { width: string | null; height: string | null; viewBox: string | null } = {
          width: null,
          height: null,
          viewBox: null,
        };
        if (logo?.currentSrc || logo?.src) {
          try {
            const svgText = await fetch(logo.currentSrc || logo.src).then((response) =>
              response.text(),
            );
            const svg = new DOMParser().parseFromString(svgText, "image/svg+xml")
              .documentElement;
            logoSvg = {
              width: svg.getAttribute("width"),
              height: svg.getAttribute("height"),
              viewBox: svg.getAttribute("viewBox"),
            };
          } catch {
            logoSvg = { width: null, height: null, viewBox: null };
          }
        }
        const auditedElements = Array.from(
          document.querySelectorAll<HTMLElement>(
            "main.entry-gate-screen, section, header, h1, button, img, a, [data-testid]",
          ),
        ).filter((element) => {
          if (element.closest("[data-testid='entry-gate-backdrop']")) return false;
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 1 && rect.height > 1 && style.visibility !== "hidden";
        });
        const outOfBounds = auditedElements
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              testId: element.dataset.testid ?? element.tagName.toLowerCase(),
              left: Math.round(rect.left * 100) / 100,
              right: Math.round(rect.right * 100) / 100,
              top: Math.round(rect.top * 100) / 100,
              bottom: Math.round(rect.bottom * 100) / 100,
            };
          })
          .filter(
            (rect) =>
              rect.left < -1 ||
              rect.right > window.innerWidth + 1 ||
              rect.top < -1 ||
              rect.bottom > window.innerHeight + Math.max(1, window.innerHeight * 0.75),
          );
        const providerContent = Array.from(
          document.querySelectorAll<HTMLElement>("[data-testid^='auth-provider-content-']"),
        );
        const iconCenters = providerContent.map((content) => {
          const icon = content.querySelector<HTMLElement>("[data-testid^='auth-provider-icon-']");
          const rect = icon?.getBoundingClientRect();
          return rect ? Math.round((rect.left + rect.width / 2) * 100) / 100 : null;
        }).filter((value): value is number => typeof value === "number");
        const providerIcons = Array.from(
          document.querySelectorAll<SVGElement>("svg[data-testid^='auth-provider-icon-']"),
        ).map((icon) => ({
          className: icon.getAttribute("class") ?? "",
          id: icon.dataset.testid ?? "",
          viewBox: icon.getAttribute("viewBox"),
        }));
        const telegramIcon = document.querySelector<SVGElement>(
          "[data-testid='auth-provider-icon-telegram']",
        );
        const telegramGradientStops = Array.from(
          telegramIcon?.querySelectorAll("stop") ?? [],
        ).map((stop) => stop.getAttribute("stop-color"));
        const arrow = document.querySelector<SVGElement>("[data-testid='language-continue'] svg");
        const selectedThemeButton = document.querySelector<HTMLElement>(
          "[data-testid='entry-theme-switcher'] [aria-checked='true']",
        );
        const entryScreen = document.querySelector<HTMLElement>("main.entry-gate-screen");
        const themeSwitcher = byTestId("entry-theme-switcher");
        const themeRadios = Array.from(
          themeSwitcher?.querySelectorAll<HTMLElement>("[role='radio']") ?? [],
        );
        const languageDirections = Object.fromEntries(
          Array.from(document.querySelectorAll<HTMLElement>("[data-testid^='language-option-']"))
            .map((option) => {
              const id = option.dataset.testid?.replace("language-option-", "") ?? "";
              const label = option.querySelector<HTMLElement>("span[dir]");
              return [
                id,
                {
                  labelDir: label?.getAttribute("dir") ?? "",
                  computedDir: label ? window.getComputedStyle(label).direction : "",
                },
              ];
            }),
        );
        const providerIconMetrics = Array.from(
          document.querySelectorAll<SVGElement>("svg[data-testid^='auth-provider-icon-']"),
        ).map((icon) => {
          const rect = icon.getBoundingClientRect();
          return {
            id: icon.dataset.testid ?? "",
            renderedWidth: Math.round(rect.width * 100) / 100,
            renderedHeight: Math.round(rect.height * 100) / 100,
          };
        });
        const providerRailClasses = Array.from(
          document.querySelectorAll<HTMLElement>("[data-testid^='auth-provider-content-']"),
        ).map((element) => element.getAttribute("class") ?? "");

        return {
          name: scenario.name,
          platform: scenario.platform,
          screen: screenTestId,
          colorScheme: scenario.colorScheme,
          themePreference: scenario.theme,
          selectedTheme: selectedThemeButton?.textContent?.trim() ?? "",
          dataEntryTheme: main?.dataset.entryTheme ?? "",
          displayModeStandalone: window.matchMedia("(display-mode: standalone)").matches,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio,
          },
          htmlDir: document.documentElement.dir,
          htmlLang: document.documentElement.lang,
          overflowX: {
            document: document.documentElement.scrollWidth > window.innerWidth + 1,
            screen: main ? main.scrollWidth > main.clientWidth + 1 : true,
            documentScrollWidth: document.documentElement.scrollWidth,
            screenScrollWidth: main?.scrollWidth ?? null,
          },
          rootEntryGateScreen: Boolean(entryScreen),
          outOfBounds,
          logo: {
            src: logo?.currentSrc || logo?.src || "",
            naturalWidth: logo?.naturalWidth ?? 0,
            naturalHeight: logo?.naturalHeight ?? 0,
            renderedWidth: logoRect ? Math.round(logoRect.width * 100) / 100 : 0,
            renderedHeight: logoRect ? Math.round(logoRect.height * 100) / 100 : 0,
            svg: logoSvg,
          },
          backdrop: {
            auroras: document.querySelectorAll("[data-testid='entry-gate-aurora']").length,
            caustics: document.querySelectorAll("[data-testid='entry-gate-backdrop-caustic']").length,
            currents: document.querySelectorAll("[data-testid='entry-gate-backdrop-current']").length,
            horizons: document.querySelectorAll("[data-testid='entry-gate-backdrop-horizon']").length,
            orbs: document.querySelectorAll("[data-testid='entry-gate-backdrop-orb']").length,
            ripples: document.querySelectorAll("[data-testid='entry-gate-backdrop-ripple']").length,
            ribbons: document.querySelectorAll("[data-testid='entry-gate-backdrop-ribbon']").length,
            forbiddenMarks: document.querySelectorAll(
              "[data-testid*='star'], [data-testid*='sparkle'], .entry-gate-backdrop-star, .entry-gate-sparkle, [data-testid='entry-gate-flow-mark']",
            ).length,
          },
          themeSwitcher: Boolean(byTestId("entry-theme-switcher")),
          themeSwitcherRole: themeSwitcher?.getAttribute("role") ?? null,
          themeSwitcherRadioCount: themeRadios.length,
          themeSwitcherCheckedCount: themeRadios.filter(
            (radio) => radio.getAttribute("aria-checked") === "true",
          ).length,
          languageOptions: document.querySelectorAll("[data-testid^='language-option-']").length,
          languageDirections,
          authProviders: providerContent.map((element) =>
            element.dataset.testid?.replace("auth-provider-content-", ""),
          ),
          iconCenters,
          iconCenterSpread:
            iconCenters.length > 0 ? Math.max(...iconCenters) - Math.min(...iconCenters) : 0,
          providerIcons,
          providerIconMetrics,
          providerRailClasses,
          telegram: {
            exists: Boolean(telegramIcon),
            viewBox: telegramIcon?.getAttribute("viewBox") ?? null,
            gradientStops: telegramGradientStops,
          },
          rtlArrowTransform: arrow ? window.getComputedStyle(arrow).transform : null,
        };
      }, { scenario, screenTestId });

      const screenshotSha = sha256File(screenshotPath);
      facts.push({
        ...fact,
        screenshot: screenshotPath,
        screenshotSha256: screenshotSha,
        consoleMessages,
        failedRequests,
      });
      verificationLines.push(
        `${scenario.name}: platform=${fact.platform} screen=${fact.screen} ` +
          `selectedTheme=${fact.selectedTheme} dataEntryTheme=${fact.dataEntryTheme} ` +
          `standalone=${fact.displayModeStandalone} overflowDocument=${fact.overflowX.document} ` +
          `overflowScreen=${fact.overflowX.screen} outOfBounds=${fact.outOfBounds.length} ` +
          `logo=${fact.logo.naturalWidth}x${fact.logo.naturalHeight} ` +
          `rendered=${fact.logo.renderedWidth}x${fact.logo.renderedHeight} ` +
          `backdrop=${fact.backdrop.orbs}/${fact.backdrop.ripples}/${fact.backdrop.ribbons}/` +
          `${fact.backdrop.caustics}/${fact.backdrop.currents}/${fact.backdrop.horizons} ` +
          `forbiddenMarks=${fact.backdrop.forbiddenMarks} providers=${fact.authProviders.join(",")} ` +
          `iconCenterSpread=${fact.iconCenterSpread} console=${consoleMessages.length} ` +
          `failedRequests=${failedRequests.length} screenshotSha=${screenshotSha}`,
      );

      page.removeAllListeners("console");
      page.removeAllListeners("requestfailed");
      await context.close();
    }

    const factsPath = path.join(OUTPUT_DIR, "facts.json");
    writeFileSync(
      factsPath,
      `${JSON.stringify({ assets: assetFacts, manifest, scenarios: facts }, null, 2)}\n`,
    );
    const factsSha = sha256File(factsPath);
    verificationLines.push(`factsSha256=${factsSha}`);
    writeFileSync(
      path.join(OUTPUT_DIR, "verification-log-20260615.txt"),
      `${verificationLines.join("\n")}\n`,
    );

    for (const fact of facts) {
      expect(fact.displayModeStandalone, `${fact.name} standalone display mode`).toBe(true);
      expect(fact.rootEntryGateScreen, `${fact.name} root entry-gate-screen`).toBe(true);
      expect(fact.overflowX.document, `${fact.name} document overflow`).toBe(false);
      expect(fact.overflowX.screen, `${fact.name} screen overflow`).toBe(false);
      expect(fact.outOfBounds, `${fact.name} out-of-bounds elements`).toHaveLength(0);
      expect(fact.logo.src, `${fact.name} logo source`).toContain("icon-source.svg");
      expect(fact.logo.naturalWidth, `${fact.name} logo natural width`).toBeGreaterThanOrEqual(512);
      expect(fact.logo.naturalHeight, `${fact.name} logo natural height`).toBeGreaterThanOrEqual(512);
      expect(fact.logo.svg.width, `${fact.name} logo SVG width`).toBe("512");
      expect(fact.logo.svg.height, `${fact.name} logo SVG height`).toBe("512");
      expect(fact.logo.svg.viewBox, `${fact.name} logo SVG viewBox`).toBe("0 0 512 512");
      expect(fact.logo.renderedWidth, `${fact.name} rendered logo width`).toBeGreaterThanOrEqual(64);
      expect(fact.logo.renderedHeight, `${fact.name} rendered logo height`).toBeGreaterThanOrEqual(64);
      expect(fact.backdrop.auroras, `${fact.name} aurora layer count`).toBe(1);
      expect(fact.backdrop.orbs, `${fact.name} orb count`).toBe(7);
      expect(fact.backdrop.ripples, `${fact.name} ripple count`).toBe(3);
      expect(fact.backdrop.ribbons, `${fact.name} ribbon count`).toBe(3);
      expect(fact.backdrop.caustics, `${fact.name} caustic count`).toBe(3);
      expect(fact.backdrop.currents, `${fact.name} current count`).toBe(4);
      expect(fact.backdrop.horizons, `${fact.name} horizon count`).toBe(1);
      expect(fact.backdrop.forbiddenMarks, `${fact.name} forbidden AI/star marks`).toBe(0);
      expect(fact.themeSwitcher, `${fact.name} theme switcher`).toBe(true);
      expect(fact.themeSwitcherRole, `${fact.name} theme switcher role`).toBe("radiogroup");
      expect(fact.themeSwitcherRadioCount, `${fact.name} theme switcher radio count`).toBe(3);
      expect(fact.themeSwitcherCheckedCount, `${fact.name} theme switcher checked count`).toBe(1);
      expect(fact.consoleMessages, `${fact.name} console messages`).toHaveLength(0);
      expect(fact.failedRequests, `${fact.name} failed requests`).toHaveLength(0);

      if (fact.screen === "language-selector-screen") {
        expect(fact.languageOptions, `${fact.name} language options`).toBe(8);
        expect(fact.languageDirections.ar.labelDir, `${fact.name} Arabic label dir`).toBe("rtl");
        expect(fact.languageDirections.ar.computedDir, `${fact.name} Arabic computed dir`).toBe("rtl");
        expect(fact.languageDirections.he.labelDir, `${fact.name} Hebrew label dir`).toBe("rtl");
        expect(fact.languageDirections.he.computedDir, `${fact.name} Hebrew computed dir`).toBe("rtl");
      }

      if (fact.name === "pwa-phone-language-ar-rtl") {
        expect(fact.htmlLang, "Arabic root language").toBe("ar");
        expect(fact.htmlDir, "Arabic root direction").toBe("rtl");
        expect(fact.rtlArrowTransform, "Arabic continue arrow mirror").toContain("-1");
      }

      if (fact.name === "pwa-phone-language-he-rtl") {
        expect(fact.htmlLang, "Hebrew root language").toBe("he");
        expect(fact.htmlDir, "Hebrew root direction").toBe("rtl");
        expect(fact.rtlArrowTransform, "Hebrew continue arrow mirror").toContain("-1");
      }

      if (fact.screen === "auth-screen") {
        expect(fact.authProviders, `${fact.name} auth provider ids`).toEqual(expectedAuthProviders);
        expect(fact.iconCenterSpread, `${fact.name} provider icon rail spread`).toBe(0);
        expect(fact.providerIcons.every((icon) => icon.className.includes("h-6 w-6"))).toBe(true);
        expect(
          fact.providerIconMetrics.every(
            (icon) => icon.renderedWidth === 24 && icon.renderedHeight === 24,
          ),
          `${fact.name} rendered provider icon dimensions`,
        ).toBe(true);
        expect(
          fact.providerRailClasses.every((className) =>
            className.includes("grid-cols-[2rem_minmax(0,1fr)_2rem]"),
          ),
          `${fact.name} provider rail grid contract`,
        ).toBe(true);
        expect(fact.telegram.exists, `${fact.name} Telegram icon`).toBe(true);
        expect(fact.telegram.viewBox, `${fact.name} Telegram viewBox`).toBe("0 0 128 128");
        expect(fact.telegram.gradientStops, `${fact.name} Telegram gradient`).toEqual([
          "#2AABEE",
          "#229ED9",
        ]);
      }
    }
  });

  test("keeps every supported language usable in standalone PWA phone mode", async ({
    browser,
    browserName,
  }, testInfo) => {
    test.setTimeout(180_000);
    expect(browserName).toBe("chromium");
    const baseURL = String(
      testInfo.project.use.baseURL ?? process.env.ZENFLOW_PLAYWRIGHT_BASE_URL ?? "",
    );
    expect(baseURL, "PWA all-language smoke baseURL").toContain("/people-first-app/");

    for (const language of SUPPORTED_LANGUAGES) {
      const scenario: PwaEntryScenario = {
        name: `pwa-phone-language-${language}-smoke`,
        fileName: `pwa-phone-language-${language}-smoke.png`,
        platform: "pwa-phone",
        screen: "language",
        theme: "paper",
        language,
        colorScheme: "light",
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
      };
      const context = await newPwaContext(browser, scenario);
      const page = await context.newPage();
      await primeEntryState(page, scenario);
      await page.goto(baseURL, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("language-selector-screen")).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(150);

      const fact = await collectLanguageFact(page);
      expect(fact.standalone, `${language} standalone display mode`).toBe(true);
      expect(fact.overflowX.document, `${language} document overflow`).toBe(false);
      expect(fact.overflowX.screen, `${language} screen overflow`).toBe(false);
      expect(fact.outOfBounds, `${language} out-of-bounds elements`).toHaveLength(0);
      expect(fact.themeSwitcher, `${language} theme switcher`).toBe(true);
      expect(fact.languageOptions, `${language} language options`).toBe(8);
      expect(fact.continueHeight, `${language} continue touch target`).toBeGreaterThanOrEqual(48);
      if (RTL_LANGUAGES.has(language)) {
        expect(fact.htmlLang, `${language} root language`).toBe(language);
        expect(fact.htmlDir, `${language} root direction`).toBe("rtl");
        expect(fact.rtlArrowTransform, `${language} continue arrow mirror`).toContain("-1");
      } else {
        expect(fact.htmlLang, `${language} root language`).toBe(language);
        expect(fact.htmlDir, `${language} root direction`).toBe("ltr");
      }
      await context.close();
    }
  });
});
