import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

type EntryThemePreference = "paper" | "ink" | "auto";
type EntryScreen = "language" | "auth";
type EntryLanguage = "en" | "uk" | "es" | "de" | "fr" | "ja" | "ar" | "he";

interface IosEntryScenario {
  colorScheme: "light" | "dark";
  fileName: string;
  language: EntryLanguage;
  name: string;
  deviceScaleFactor: number;
  screen: EntryScreen;
  theme: EntryThemePreference;
  viewport: { width: number; height: number };
}

const OUTPUT_DIR = path.resolve(process.cwd(), "output/playwright/ios-entry-20260615");
const SUPPORTED_LANGUAGES: readonly EntryLanguage[] = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"];
const RTL_LANGUAGES = new Set<EntryLanguage>(["ar", "he"]);

const scenarios: IosEntryScenario[] = [
  {
    name: "iphone-language-light",
    fileName: "iphone-language-light.png",
    screen: "language",
    theme: "paper",
    language: "en",
    colorScheme: "light",
    deviceScaleFactor: 3,
    viewport: { width: 390, height: 844 },
  },
  {
    name: "iphone-language-ar-rtl",
    fileName: "iphone-language-ar-rtl.png",
    screen: "language",
    theme: "paper",
    language: "ar",
    colorScheme: "light",
    deviceScaleFactor: 3,
    viewport: { width: 390, height: 844 },
  },
  {
    name: "iphone-language-he-rtl",
    fileName: "iphone-language-he-rtl.png",
    screen: "language",
    theme: "paper",
    language: "he",
    colorScheme: "light",
    deviceScaleFactor: 3,
    viewport: { width: 390, height: 844 },
  },
  {
    name: "iphone-auth-light",
    fileName: "iphone-auth-light.png",
    screen: "auth",
    theme: "paper",
    language: "en",
    colorScheme: "light",
    deviceScaleFactor: 3,
    viewport: { width: 390, height: 844 },
  },
  {
    name: "iphone-auth-dark",
    fileName: "iphone-auth-dark.png",
    screen: "auth",
    theme: "ink",
    language: "en",
    colorScheme: "dark",
    deviceScaleFactor: 3,
    viewport: { width: 390, height: 844 },
  },
  {
    name: "ipad-language-system",
    fileName: "ipad-language-system.png",
    screen: "language",
    theme: "auto",
    language: "en",
    colorScheme: "dark",
    deviceScaleFactor: 2,
    viewport: { width: 768, height: 1024 },
  },
  {
    name: "ipad-language-dark",
    fileName: "ipad-language-dark.png",
    screen: "language",
    theme: "ink",
    language: "en",
    colorScheme: "dark",
    deviceScaleFactor: 2,
    viewport: { width: 768, height: 1024 },
  },
  {
    name: "ipad-auth-light",
    fileName: "ipad-auth-light.png",
    screen: "auth",
    theme: "paper",
    language: "en",
    colorScheme: "light",
    deviceScaleFactor: 2,
    viewport: { width: 768, height: 1024 },
  },
  {
    name: "ipad-auth-dark",
    fileName: "ipad-auth-dark.png",
    screen: "auth",
    theme: "ink",
    language: "en",
    colorScheme: "dark",
    deviceScaleFactor: 2,
    viewport: { width: 768, height: 1024 },
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

async function primeEntryState(page: Page, scenario: IosEntryScenario) {
  await page.addInitScript(({ scenario }) => {
    const json = (value: unknown) => JSON.stringify(value);
    const legacyTheme =
      scenario.theme === "paper" ? "light" : scenario.theme === "ink" ? "dark" : "system";

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

test.use({ browserName: "webkit" });

test.describe("iOS entry gate evidence", () => {
  test("captures the current iPhone and iPad entry matrix", async ({
    browser,
    browserName,
  }, testInfo) => {
    test.setTimeout(180_000);
    expect(browserName).toBe("webkit");
    prepareOutputDir();

    const facts = [];
    const verificationLines = [
      `Generated: ${new Date().toISOString()}`,
      `Base URL: ${String(testInfo.project.use.baseURL ?? "")}`,
      `Browser: ${browserName}`,
    ];
    const baseURL = String(
      testInfo.project.use.baseURL ?? process.env.ZENFLOW_PLAYWRIGHT_BASE_URL ?? "",
    );
    expect(baseURL, "iOS entry evidence baseURL").toContain("/people-first-app/");

    for (const scenario of scenarios) {
      const context = await browser.newContext({
        colorScheme: scenario.colorScheme,
        deviceScaleFactor: scenario.deviceScaleFactor,
        hasTouch: true,
        ignoreHTTPSErrors: true,
        isMobile: scenario.viewport.width < 600,
        viewport: scenario.viewport,
      });
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
        const providerIconMetrics = Array.from(
          document.querySelectorAll<SVGElement>("svg[data-testid^='auth-provider-icon-']"),
        ).map((icon) => {
          const rect = icon.getBoundingClientRect();
          return {
            id: icon.dataset.testid ?? "",
            renderedHeight: Math.round(rect.height * 100) / 100,
            renderedWidth: Math.round(rect.width * 100) / 100,
          };
        });
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

        return {
          name: scenario.name,
          screen: screenTestId,
          colorScheme: scenario.colorScheme,
          themePreference: scenario.theme,
          selectedTheme: selectedThemeButton?.textContent?.trim() ?? "",
          dataEntryTheme: main?.dataset.entryTheme ?? "",
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio,
          },
          htmlDir: document.documentElement.dir,
          overflowX: {
            document: document.documentElement.scrollWidth > window.innerWidth + 1,
            screen: main ? main.scrollWidth > main.clientWidth + 1 : true,
            documentScrollWidth: document.documentElement.scrollWidth,
            screenScrollWidth: main?.scrollWidth ?? null,
          },
          outOfBounds,
          logo: {
            src: logo?.currentSrc || logo?.src || "",
            widthAttribute: logo?.getAttribute("width") ?? null,
            heightAttribute: logo?.getAttribute("height") ?? null,
            naturalWidth: logo?.naturalWidth ?? 0,
            naturalHeight: logo?.naturalHeight ?? 0,
            renderedWidth: logoRect ? Math.round(logoRect.width * 100) / 100 : 0,
            renderedHeight: logoRect ? Math.round(logoRect.height * 100) / 100 : 0,
            svg: logoSvg,
          },
          backdrop: {
            caustics: document.querySelectorAll("[data-testid='entry-gate-backdrop-caustic']").length,
            currents: document.querySelectorAll("[data-testid='entry-gate-backdrop-current']").length,
            horizons: document.querySelectorAll("[data-testid='entry-gate-backdrop-horizon']").length,
            orbs: document.querySelectorAll("[data-testid='entry-gate-backdrop-orb']").length,
            ripples: document.querySelectorAll("[data-testid='entry-gate-backdrop-ripple']").length,
            ribbons: document.querySelectorAll("[data-testid='entry-gate-backdrop-ribbon']").length,
            stars: document.querySelectorAll(
              "[data-testid*='star'], [data-testid*='sparkle'], .entry-gate-backdrop-star, .entry-gate-sparkle",
            ).length,
            oldFlowMarks: document.querySelectorAll("[data-testid='entry-gate-flow-mark']").length,
          },
          themeSwitcher: Boolean(byTestId("entry-theme-switcher")),
          languageOptions: document.querySelectorAll("[data-testid^='language-option-']").length,
          authProviders: providerContent.map((element) =>
            element.dataset.testid?.replace("auth-provider-content-", ""),
          ),
          iconCenters,
          providerIconMetrics,
          iconCenterSpread:
            iconCenters.length > 0 ? Math.max(...iconCenters) - Math.min(...iconCenters) : null,
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
        `${scenario.name}: screen=${fact.screen} selectedTheme=${fact.selectedTheme} ` +
          `dataEntryTheme=${fact.dataEntryTheme} overflowDocument=${fact.overflowX.document} ` +
          `overflowScreen=${fact.overflowX.screen} outOfBounds=${fact.outOfBounds.length} ` +
          `logoRendered=${fact.logo.renderedWidth}x${fact.logo.renderedHeight} ` +
          `logoSvg=${fact.logo.svg.width}x${fact.logo.svg.height}/${fact.logo.svg.viewBox} ` +
          `backdrop=${fact.backdrop.orbs}/${fact.backdrop.ripples}/${fact.backdrop.ribbons}/` +
          `${fact.backdrop.caustics}/${fact.backdrop.currents}/${fact.backdrop.horizons} ` +
          `stars=${fact.backdrop.stars} oldFlowMarks=${fact.backdrop.oldFlowMarks} ` +
          `providers=${fact.authProviders.join(",")} iconCenterSpread=${fact.iconCenterSpread} ` +
          `iconMetrics=${fact.providerIconMetrics
            .map((icon) => `${icon.id}:${icon.renderedWidth}x${icon.renderedHeight}`)
            .join(",")} telegramViewBox=${fact.telegram.viewBox} ` +
          `console=${consoleMessages.length} failedRequests=${failedRequests.length} ` +
          `screenshotSha=${screenshotSha}`,
      );

      page.removeAllListeners("console");
      page.removeAllListeners("requestfailed");
      await context.close();
    }

    const factsPath = path.join(OUTPUT_DIR, "facts.json");
    writeFileSync(factsPath, `${JSON.stringify({ scenarios: facts }, null, 2)}\n`);
    const factsSha = sha256File(factsPath);
    verificationLines.push(`factsSha256=${factsSha}`);
    writeFileSync(
      path.join(OUTPUT_DIR, "verification-log-20260615.txt"),
      `${verificationLines.join("\n")}\n`,
    );

    for (const fact of facts) {
      expect(fact.overflowX.document, `${fact.name} document overflow`).toBe(false);
      expect(fact.overflowX.screen, `${fact.name} screen overflow`).toBe(false);
      expect(fact.outOfBounds, `${fact.name} out-of-bounds elements`).toHaveLength(0);
      expect(fact.logo.src, `${fact.name} logo source`).toContain("/people-first-app/icon-source.svg");
      expect(fact.logo.widthAttribute, `${fact.name} logo width attribute`).toBe("512");
      expect(fact.logo.heightAttribute, `${fact.name} logo height attribute`).toBe("512");
      expect(fact.logo.svg.width, `${fact.name} logo SVG width`).toBe("512");
      expect(fact.logo.svg.height, `${fact.name} logo SVG height`).toBe("512");
      expect(fact.logo.svg.viewBox, `${fact.name} logo SVG viewBox`).toBe("0 0 512 512");
      expect(fact.logo.renderedWidth, `${fact.name} rendered logo width`).toBeGreaterThanOrEqual(64);
      expect(fact.logo.renderedHeight, `${fact.name} rendered logo height`).toBeGreaterThanOrEqual(64);
      expect(fact.backdrop.orbs, `${fact.name} orb count`).toBe(7);
      expect(fact.backdrop.ripples, `${fact.name} ripple count`).toBe(3);
      expect(fact.backdrop.ribbons, `${fact.name} ribbon count`).toBe(3);
      expect(fact.backdrop.caustics, `${fact.name} caustic count`).toBe(3);
      expect(fact.backdrop.currents, `${fact.name} current count`).toBe(4);
      expect(fact.backdrop.horizons, `${fact.name} horizon count`).toBe(1);
      expect(fact.backdrop.stars, `${fact.name} AI/star count`).toBe(0);
      expect(fact.backdrop.oldFlowMarks, `${fact.name} old flow mark count`).toBe(0);
      expect(fact.themeSwitcher, `${fact.name} theme switcher`).toBe(true);

      if (fact.screen === "language-selector-screen") {
        expect(fact.languageOptions, `${fact.name} language options`).toBe(8);
      }

      if (fact.name === "iphone-language-ar-rtl") {
        expect(fact.htmlDir, "Arabic root direction").toBe("rtl");
        expect(fact.rtlArrowTransform, "Arabic continue arrow mirror").toContain("-1");
      }

      if (fact.name === "iphone-language-he-rtl") {
        expect(fact.htmlDir, "Hebrew root direction").toBe("rtl");
        expect(fact.rtlArrowTransform, "Hebrew continue arrow mirror").toContain("-1");
      }

      if (fact.screen === "auth-screen") {
        expect(fact.authProviders, `${fact.name} auth provider ids`).toEqual([
          "google",
          "facebook",
          "telegram",
        ]);
        expect(fact.iconCenterSpread, `${fact.name} provider icon rail spread`).toBe(0);
        expect(fact.providerIconMetrics, `${fact.name} provider icon metrics`).toEqual([
          { id: "auth-provider-icon-google", renderedHeight: 24, renderedWidth: 24 },
          { id: "auth-provider-icon-facebook", renderedHeight: 24, renderedWidth: 24 },
          { id: "auth-provider-icon-telegram", renderedHeight: 24, renderedWidth: 24 },
        ]);
        expect(fact.telegram.exists, `${fact.name} Telegram icon`).toBe(true);
        expect(fact.telegram.viewBox, `${fact.name} Telegram viewBox`).toBe("0 0 128 128");
        expect(fact.telegram.gradientStops, `${fact.name} Telegram gradient`).toEqual([
          "#2AABEE",
          "#229ED9",
        ]);
      }
    }
  });

  test("keeps every supported language usable on iPhone WebKit", async ({
    browser,
    browserName,
  }, testInfo) => {
    test.setTimeout(180_000);
    expect(browserName).toBe("webkit");
    const baseURL = String(
      testInfo.project.use.baseURL ?? process.env.ZENFLOW_PLAYWRIGHT_BASE_URL ?? "",
    );
    expect(baseURL, "iOS all-language smoke baseURL").toContain("/people-first-app/");

    for (const language of SUPPORTED_LANGUAGES) {
      const scenario: IosEntryScenario = {
        name: `iphone-language-${language}-smoke`,
        fileName: `iphone-language-${language}-smoke.png`,
        screen: "language",
        theme: "paper",
        language,
        colorScheme: "light",
        deviceScaleFactor: 3,
        viewport: { width: 390, height: 844 },
      };
      const context = await browser.newContext({
        colorScheme: scenario.colorScheme,
        deviceScaleFactor: scenario.deviceScaleFactor,
        hasTouch: true,
        ignoreHTTPSErrors: true,
        isMobile: true,
        viewport: scenario.viewport,
      });
      const page = await context.newPage();
      await primeEntryState(page, scenario);
      await page.goto(baseURL, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("language-selector-screen")).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(150);

      const fact = await page.evaluate(() => {
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
          overflowX: {
            document: document.documentElement.scrollWidth > window.innerWidth + 1,
            screen: screen ? screen.scrollWidth > screen.clientWidth + 1 : true,
          },
          outOfBounds,
          themeSwitcher: Boolean(document.querySelector("[data-testid='entry-theme-switcher']")),
          languageOptions: document.querySelectorAll("[data-testid^='language-option-']").length,
          continueHeight: continueRect ? Math.round(continueRect.height * 100) / 100 : 0,
          rtlArrowTransform: arrow ? window.getComputedStyle(arrow).transform : null,
        };
      });

      expect(fact.overflowX.document, `${language} document overflow`).toBe(false);
      expect(fact.overflowX.screen, `${language} screen overflow`).toBe(false);
      expect(fact.outOfBounds, `${language} out-of-bounds elements`).toHaveLength(0);
      expect(fact.themeSwitcher, `${language} theme switcher`).toBe(true);
      expect(fact.languageOptions, `${language} language options`).toBe(8);
      expect(fact.continueHeight, `${language} continue touch target`).toBeGreaterThanOrEqual(44);
      if (RTL_LANGUAGES.has(language)) {
        expect(fact.htmlDir, `${language} root direction`).toBe("rtl");
        expect(fact.rtlArrowTransform, `${language} continue arrow mirror`).toContain("-1");
      } else {
        expect(fact.htmlDir, `${language} root direction`).toBe("ltr");
      }
      await context.close();
    }
  });
});
