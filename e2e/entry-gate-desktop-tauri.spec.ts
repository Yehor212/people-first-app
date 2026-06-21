import { expect, test, type Browser, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

type EntryThemePreference = "paper" | "ink" | "auto";
type EntryScreen = "language" | "auth";
type EntryLanguage = "en" | "uk" | "es" | "de" | "fr" | "ja" | "ar" | "he";

interface DesktopEntryScenario {
  colorScheme: "light" | "dark";
  fileName: string;
  language: EntryLanguage;
  name: string;
  screen: EntryScreen;
  theme: EntryThemePreference;
  viewport: { width: number; height: number };
}

interface TauriConfig {
  productName?: string;
  version?: string;
  identifier?: string;
  build?: {
    beforeBuildCommand?: string;
    devUrl?: string;
    frontendDist?: string;
  };
  app?: {
    security?: {
      csp?: string;
    };
    windows?: Array<{
      center?: boolean;
      fullscreen?: boolean;
      height?: number;
      minHeight?: number;
      minWidth?: number;
      resizable?: boolean;
      title?: string;
      width?: number;
    }>;
  };
}

interface TauriCapability {
  permissions?: string[];
  windows?: string[];
}

const OUTPUT_DIR = path.resolve(process.cwd(), "output/playwright/desktop-tauri-entry-20260615");
const SUPPORTED_LANGUAGES: readonly EntryLanguage[] = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"];
const RTL_LANGUAGES = new Set<EntryLanguage>(["ar", "he"]);

const scenarios: DesktopEntryScenario[] = [
  {
    name: "desktop-default-language-light",
    fileName: "desktop-default-language-light.png",
    screen: "language",
    theme: "paper",
    language: "en",
    colorScheme: "light",
    viewport: { width: 1200, height: 820 },
  },
  {
    name: "desktop-default-auth-light",
    fileName: "desktop-default-auth-light.png",
    screen: "auth",
    theme: "paper",
    language: "en",
    colorScheme: "light",
    viewport: { width: 1200, height: 820 },
  },
  {
    name: "desktop-default-language-dark",
    fileName: "desktop-default-language-dark.png",
    screen: "language",
    theme: "ink",
    language: "en",
    colorScheme: "dark",
    viewport: { width: 1200, height: 820 },
  },
  {
    name: "desktop-default-auth-dark",
    fileName: "desktop-default-auth-dark.png",
    screen: "auth",
    theme: "ink",
    language: "en",
    colorScheme: "dark",
    viewport: { width: 1200, height: 820 },
  },
  {
    name: "desktop-min-language-dark",
    fileName: "desktop-min-language-dark.png",
    screen: "language",
    theme: "ink",
    language: "en",
    colorScheme: "dark",
    viewport: { width: 390, height: 640 },
  },
  {
    name: "desktop-min-auth-dark",
    fileName: "desktop-min-auth-dark.png",
    screen: "auth",
    theme: "ink",
    language: "en",
    colorScheme: "dark",
    viewport: { width: 390, height: 640 },
  },
  {
    name: "desktop-wide-language-system",
    fileName: "desktop-wide-language-system.png",
    screen: "language",
    theme: "auto",
    language: "en",
    colorScheme: "light",
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "desktop-default-language-ar-rtl",
    fileName: "desktop-default-language-ar-rtl.png",
    screen: "language",
    theme: "paper",
    language: "ar",
    colorScheme: "light",
    viewport: { width: 1200, height: 820 },
  },
  {
    name: "desktop-default-language-he-rtl",
    fileName: "desktop-default-language-he-rtl.png",
    screen: "language",
    theme: "paper",
    language: "he",
    colorScheme: "light",
    viewport: { width: 1200, height: 820 },
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

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function collectTauriBoundaryFacts() {
  const config = readJsonFile<TauriConfig>("src-tauri/tauri.conf.json");
  const capability = readJsonFile<TauriCapability>("src-tauri/capabilities/default.json");
  const envSource = readFileSync("src/lib/env.ts", "utf8");
  const authGateSource = readFileSync("src/components/AuthGate.tsx", "utf8");
  const mainSource = readFileSync("src-tauri/src/main.rs", "utf8");
  const cargoSource = readFileSync("src-tauri/Cargo.toml", "utf8");
  const beforeBuildCommand = config.build?.beforeBuildCommand ?? "";
  const windowConfig = config.app?.windows?.[0] ?? {};
  const csp = config.app?.security?.csp ?? "";

  return {
    authGate: {
      importsDesktopRuntime: authGateSource.includes("IS_DESKTOP_RUNTIME"),
      usesExplicitBypassFunction: authGateSource.includes("shouldBypassDesktopInteractiveGates"),
      bypassesWithRuntimeFlag: authGateSource.includes(
        "shouldBypassDesktopInteractiveGates(IS_DESKTOP_RUNTIME)",
      ),
    },
    build: {
      beforeBuildCommand,
      devUrl: config.build?.devUrl ?? "",
      disablesPwa: beforeBuildCommand.includes("VITE_DISABLE_PWA=true"),
      frontendDist: config.build?.frontendDist ?? "",
      relativeBase: beforeBuildCommand.includes("VITE_APP_BASE=./"),
      usesDesktopRuntimeFlag: beforeBuildCommand.includes("VITE_DESKTOP_RUNTIME=true"),
    },
    capability: {
      permissions: capability.permissions ?? [],
      windows: capability.windows ?? [],
    },
    cargo: {
      tauriBuildVersionPinned: cargoSource.includes("tauri-build = { version = \"2.6.2\""),
      tauriVersionPinned: cargoSource.includes("tauri = { version = \"2.11.2\""),
    },
    env: {
      exposesDesktopRuntime: envSource.includes("IS_DESKTOP_RUNTIME"),
      readsViteDesktopRuntime: envSource.includes("VITE_DESKTOP_RUNTIME"),
    },
    main: {
      runsTauriBuilder: mainSource.includes("tauri::Builder::default()"),
      usesGeneratedContext: mainSource.includes("tauri::generate_context!()"),
    },
    metadata: {
      identifier: config.identifier ?? "",
      productName: config.productName ?? "",
      version: config.version ?? "",
    },
    security: {
      connectSrcAllowsSupabase: csp.includes("https://*.supabase.co") && csp.includes("wss://*.supabase.co"),
      objectSrcNone: csp.includes("object-src 'none'"),
      scriptSrcSelf: csp.includes("script-src 'self'"),
    },
    window: windowConfig,
  };
}

async function newDesktopContext(browser: Browser, scenario: DesktopEntryScenario) {
  return browser.newContext({
    colorScheme: scenario.colorScheme,
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
    viewport: scenario.viewport,
  });
}

async function primeEntryState(page: Page, scenario: DesktopEntryScenario) {
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
    const horizontallyOutOfBounds = auditedElements
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          testId: element.dataset.testid ?? element.tagName.toLowerCase(),
          left: Math.round(rect.left * 100) / 100,
          right: Math.round(rect.right * 100) / 100,
        };
      })
      .filter((rect) => rect.left < -1 || rect.right > window.innerWidth + 1);
    const arrow = document.querySelector<SVGElement>("[data-testid='language-continue'] svg");
    const continueButton = document.querySelector<HTMLElement>("[data-testid='language-continue']");
    const continueRect = continueButton?.getBoundingClientRect();

    return {
      htmlDir: document.documentElement.dir,
      htmlLang: document.documentElement.lang,
      horizontallyOutOfBounds,
      overflowX: {
        document: document.documentElement.scrollWidth > window.innerWidth + 1,
        screen: screen ? screen.scrollWidth > screen.clientWidth + 1 : true,
      },
      rtlArrowTransform: arrow ? window.getComputedStyle(arrow).transform : null,
      themeSwitcher: Boolean(document.querySelector("[data-testid='entry-theme-switcher']")),
      languageOptions: document.querySelectorAll("[data-testid^='language-option-']").length,
      continueHeight: continueRect ? Math.round(continueRect.height * 100) / 100 : 0,
    };
  });
}

test.use({ browserName: "chromium" });
test.describe.configure({ mode: "serial" });

test.describe("Desktop/Tauri entry gate evidence", () => {
  test("keeps the Tauri native boundary explicit and least-privilege", () => {
    const facts = collectTauriBoundaryFacts();

    expect(facts.metadata.productName).toBe("ZenFlow");
    expect(facts.metadata.identifier).toBe("app.zenflow.desktop");
    expect(facts.metadata.version).toBe("2.0.0");
    expect(facts.build.devUrl).toBe("http://localhost:8080/people-first-app/");
    expect(facts.build.frontendDist).toBe("../dist");
    expect(facts.build.usesDesktopRuntimeFlag).toBe(true);
    expect(facts.build.disablesPwa).toBe(true);
    expect(facts.build.relativeBase).toBe(true);
    expect(facts.window.title).toBe("ZenFlow");
    expect(facts.window.width).toBe(1200);
    expect(facts.window.height).toBe(820);
    expect(facts.window.minWidth).toBe(390);
    expect(facts.window.minHeight).toBe(640);
    expect(facts.window.resizable).toBe(true);
    expect(facts.window.fullscreen).toBe(false);
    expect(facts.window.center).toBe(true);
    expect(facts.security.scriptSrcSelf).toBe(true);
    expect(facts.security.objectSrcNone).toBe(true);
    expect(facts.security.connectSrcAllowsSupabase).toBe(true);
    expect(facts.capability.windows).toEqual(["main"]);
    expect(facts.capability.permissions).toEqual(["core:default"]);
    expect(facts.env.exposesDesktopRuntime).toBe(true);
    expect(facts.env.readsViteDesktopRuntime).toBe(true);
    expect(facts.authGate.importsDesktopRuntime).toBe(true);
    expect(facts.authGate.usesExplicitBypassFunction).toBe(true);
    expect(facts.authGate.bypassesWithRuntimeFlag).toBe(true);
    expect(facts.main.runsTauriBuilder).toBe(true);
    expect(facts.main.usesGeneratedContext).toBe(true);
    expect(facts.cargo.tauriBuildVersionPinned).toBe(true);
    expect(facts.cargo.tauriVersionPinned).toBe(true);
  });

  test("captures the current desktop web entry matrix for the Tauri window sizes", async ({
    browser,
    browserName,
  }, testInfo) => {
    test.setTimeout(180_000);
    expect(browserName).toBe("chromium");
    prepareOutputDir();

    const tauriFacts = collectTauriBoundaryFacts();
    const facts = [];
    const verificationLines = [
      `Generated: ${new Date().toISOString()}`,
      `Base URL: ${String(testInfo.project.use.baseURL ?? "")}`,
      `Browser: ${browserName} desktop production preview`,
      `Tauri: product=${tauriFacts.metadata.productName} version=${tauriFacts.metadata.version} ` +
        `window=${tauriFacts.window.width}x${tauriFacts.window.height} ` +
        `min=${tauriFacts.window.minWidth}x${tauriFacts.window.minHeight} ` +
        `desktopRuntime=${tauriFacts.build.usesDesktopRuntimeFlag} ` +
        `disablePwa=${tauriFacts.build.disablesPwa} baseRelative=${tauriFacts.build.relativeBase}`,
    ];
    const baseURL = String(
      testInfo.project.use.baseURL ?? process.env.ZENFLOW_PLAYWRIGHT_BASE_URL ?? "",
    );
    expect(baseURL, "Desktop/Tauri entry evidence baseURL").toContain("/people-first-app/");

    for (const scenario of scenarios) {
      const context = await newDesktopContext(browser, scenario);
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
        let logoSvg: { height: string | null; viewBox: string | null; width: string | null } = {
          height: null,
          viewBox: null,
          width: null,
        };
        if (logo?.currentSrc || logo?.src) {
          try {
            const svgText = await fetch(logo.currentSrc || logo.src).then((response) =>
              response.text(),
            );
            const svg = new DOMParser().parseFromString(svgText, "image/svg+xml")
              .documentElement;
            logoSvg = {
              height: svg.getAttribute("height"),
              viewBox: svg.getAttribute("viewBox"),
              width: svg.getAttribute("width"),
            };
          } catch {
            logoSvg = { height: null, viewBox: null, width: null };
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
        const horizontallyOutOfBounds = auditedElements
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              testId: element.dataset.testid ?? element.tagName.toLowerCase(),
              left: Math.round(rect.left * 100) / 100,
              right: Math.round(rect.right * 100) / 100,
            };
          })
          .filter((rect) => rect.left < -1 || rect.right > window.innerWidth + 1);
        const providerContent = Array.from(
          document.querySelectorAll<HTMLElement>("[data-testid^='auth-provider-content-']"),
        );
        const iconCenters = providerContent
          .map((content) => {
            const icon = content.querySelector<HTMLElement>("[data-testid^='auth-provider-icon-']");
            const rect = icon?.getBoundingClientRect();
            return rect ? Math.round((rect.left + rect.width / 2) * 100) / 100 : null;
          })
          .filter((value): value is number => typeof value === "number");
        const providerIcons = Array.from(
          document.querySelectorAll<SVGElement>("svg[data-testid^='auth-provider-icon-']"),
        ).map((icon) => ({
          className: icon.getAttribute("class") ?? "",
          id: icon.dataset.testid ?? "",
          viewBox: icon.getAttribute("viewBox"),
        }));
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
        const legalCopy = byTestId("auth-legal-copy");
        const legalCopyRect = legalCopy?.getBoundingClientRect();
        const privacyCopy = byTestId("auth-privacy-copy");
        const privacyCopyRect = privacyCopy?.getBoundingClientRect();
        const selectedThemeButton = document.querySelector<HTMLElement>(
          "[data-testid='entry-theme-switcher'] [aria-checked='true']",
        );

        return {
          name: scenario.name,
          screen: screenTestId,
          colorScheme: scenario.colorScheme,
          dataEntryTheme: main?.dataset.entryTheme ?? "",
          htmlDir: document.documentElement.dir,
          htmlLang: document.documentElement.lang,
          horizontallyOutOfBounds,
          iconCenters,
          iconCenterSpread:
            iconCenters.length > 0 ? Math.max(...iconCenters) - Math.min(...iconCenters) : 0,
          languageOptions: document.querySelectorAll("[data-testid^='language-option-']").length,
          logo: {
            naturalHeight: logo?.naturalHeight ?? 0,
            naturalWidth: logo?.naturalWidth ?? 0,
            renderedHeight: logoRect ? Math.round(logoRect.height * 100) / 100 : 0,
            renderedWidth: logoRect ? Math.round(logoRect.width * 100) / 100 : 0,
            src: logo?.currentSrc || logo?.src || "",
            svg: logoSvg,
          },
          overflowX: {
            document: document.documentElement.scrollWidth > window.innerWidth + 1,
            documentScrollWidth: document.documentElement.scrollWidth,
            screen: main ? main.scrollWidth > main.clientWidth + 1 : true,
            screenScrollWidth: main?.scrollWidth ?? null,
          },
          backdrop: {
            caustics: document.querySelectorAll("[data-testid='entry-gate-backdrop-caustic']").length,
            currents: document.querySelectorAll("[data-testid='entry-gate-backdrop-current']").length,
            forbiddenMarks: document.querySelectorAll(
              "[data-testid*='star'], [data-testid*='sparkle'], .entry-gate-backdrop-star, .entry-gate-sparkle, [data-testid='entry-gate-flow-mark']",
            ).length,
            horizons: document.querySelectorAll("[data-testid='entry-gate-backdrop-horizon']").length,
            orbs: document.querySelectorAll("[data-testid='entry-gate-backdrop-orb']").length,
            ribbons: document.querySelectorAll("[data-testid='entry-gate-backdrop-ribbon']").length,
            ripples: document.querySelectorAll("[data-testid='entry-gate-backdrop-ripple']").length,
          },
          authProviders: providerContent.map((element) =>
            element.dataset.testid?.replace("auth-provider-content-", ""),
          ),
          providerIcons,
          providerIconMetrics,
          privacyCopyVisibleInViewport: privacyCopyRect
            ? privacyCopyRect.top >= 0 && privacyCopyRect.bottom <= window.innerHeight
            : null,
          rtlArrowTransform: arrow ? window.getComputedStyle(arrow).transform : null,
          selectedTheme: selectedThemeButton?.textContent?.trim() ?? "",
          telegram: {
            exists: Boolean(telegramIcon),
            gradientStops: telegramGradientStops,
            viewBox: telegramIcon?.getAttribute("viewBox") ?? null,
          },
          themeSwitcher: Boolean(byTestId("entry-theme-switcher")),
          legalCopyVisibleInViewport: legalCopyRect
            ? legalCopyRect.top >= 0 && legalCopyRect.bottom <= window.innerHeight
            : null,
          viewport: {
            devicePixelRatio: window.devicePixelRatio,
            height: window.innerHeight,
            width: window.innerWidth,
          },
        };
      }, { scenario, screenTestId });

      const screenshotSha = sha256File(screenshotPath);
      facts.push({
        ...fact,
        consoleMessages,
        failedRequests,
        screenshot: screenshotPath,
        screenshotSha256: screenshotSha,
      });
      verificationLines.push(
        `${scenario.name}: screen=${fact.screen} selectedTheme=${fact.selectedTheme} ` +
          `dataEntryTheme=${fact.dataEntryTheme} overflowDocument=${fact.overflowX.document} ` +
          `overflowScreen=${fact.overflowX.screen} horizontalOob=${fact.horizontallyOutOfBounds.length} ` +
          `logo=${fact.logo.naturalWidth}x${fact.logo.naturalHeight} ` +
          `rendered=${fact.logo.renderedWidth}x${fact.logo.renderedHeight} ` +
          `backdrop=${fact.backdrop.orbs}/${fact.backdrop.ripples}/${fact.backdrop.ribbons}/` +
          `${fact.backdrop.caustics}/${fact.backdrop.currents}/${fact.backdrop.horizons} ` +
          `forbiddenMarks=${fact.backdrop.forbiddenMarks} providers=${fact.authProviders.join(",")} ` +
          `iconCenterSpread=${fact.iconCenterSpread} ` +
          `iconMetrics=${fact.providerIconMetrics
            .map((icon) => `${icon.id}:${icon.renderedWidth}x${icon.renderedHeight}`)
            .join(",")} console=${consoleMessages.length} failedRequests=${failedRequests.length} ` +
          `screenshotSha=${screenshotSha}`,
      );

      page.removeAllListeners("console");
      page.removeAllListeners("requestfailed");
      await context.close();
    }

    const factsPath = path.join(OUTPUT_DIR, "facts.json");
    writeFileSync(
      factsPath,
      `${JSON.stringify({ scenarios: facts, tauri: tauriFacts }, null, 2)}\n`,
    );
    const factsSha = sha256File(factsPath);
    verificationLines.push(`factsSha256=${factsSha}`);
    writeFileSync(
      path.join(OUTPUT_DIR, "verification-log-20260615.txt"),
      `${verificationLines.join("\n")}\n`,
    );

    for (const fact of facts) {
      expect(fact.overflowX.document, `${fact.name} document overflow`).toBe(false);
      expect(fact.overflowX.screen, `${fact.name} screen overflow`).toBe(false);
      expect(fact.horizontallyOutOfBounds, `${fact.name} horizontal out-of-bounds`).toHaveLength(0);
      expect(fact.logo.src, `${fact.name} logo source`).toContain("icon-source.svg");
      expect(fact.logo.naturalWidth, `${fact.name} logo natural width`).toBeGreaterThanOrEqual(512);
      expect(fact.logo.naturalHeight, `${fact.name} logo natural height`).toBeGreaterThanOrEqual(512);
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
      expect(fact.backdrop.forbiddenMarks, `${fact.name} forbidden AI/star marks`).toBe(0);
      expect(fact.themeSwitcher, `${fact.name} theme switcher`).toBe(true);
      expect(fact.consoleMessages, `${fact.name} console messages`).toHaveLength(0);
      expect(fact.failedRequests, `${fact.name} failed requests`).toHaveLength(0);

      if (fact.screen === "language-selector-screen") {
        expect(fact.languageOptions, `${fact.name} language options`).toBe(8);
      }

      if (fact.name === "desktop-default-language-ar-rtl") {
        expect(fact.htmlLang, "Arabic root language").toBe("ar");
        expect(fact.htmlDir, "Arabic root direction").toBe("rtl");
        expect(fact.rtlArrowTransform, "Arabic continue arrow mirror").toContain("-1");
      }

      if (fact.name === "desktop-default-language-he-rtl") {
        expect(fact.htmlLang, "Hebrew root language").toBe("he");
        expect(fact.htmlDir, "Hebrew root direction").toBe("rtl");
        expect(fact.rtlArrowTransform, "Hebrew continue arrow mirror").toContain("-1");
      }

      if (fact.screen === "auth-screen") {
        expect(fact.authProviders, `${fact.name} auth provider ids`).toEqual([
          "google",
          "telegram",
          "apple",
        ]);
        expect(fact.iconCenterSpread, `${fact.name} provider icon rail spread`).toBe(0);
        expect(fact.providerIcons.every((icon) => icon.className.includes("h-6 w-6"))).toBe(true);
        expect(fact.providerIconMetrics, `${fact.name} provider icon metrics`).toEqual([
          { id: "auth-provider-icon-google", renderedHeight: 24, renderedWidth: 24 },
          { id: "auth-provider-icon-telegram", renderedHeight: 24, renderedWidth: 24 },
          { id: "auth-provider-icon-apple", renderedHeight: 24, renderedWidth: 24 },
        ]);
        expect(fact.telegram.exists, `${fact.name} Telegram icon`).toBe(true);
        expect(fact.telegram.viewBox, `${fact.name} Telegram viewBox`).toBe("0 0 128 128");
        expect(fact.telegram.gradientStops, `${fact.name} Telegram gradient`).toEqual([
          "#2AABEE",
          "#229ED9",
        ]);
        expect(
          fact.privacyCopyVisibleInViewport,
          `${fact.name} privacy copy visible in first viewport`,
        ).toBe(true);
        expect(
          fact.legalCopyVisibleInViewport,
          `${fact.name} legal copy visible in first viewport`,
        ).toBe(true);
      }
    }
  });

  test("keeps every supported language usable in the minimum Tauri window width", async ({
    browser,
    browserName,
  }, testInfo) => {
    test.setTimeout(180_000);
    expect(browserName).toBe("chromium");
    const baseURL = String(
      testInfo.project.use.baseURL ?? process.env.ZENFLOW_PLAYWRIGHT_BASE_URL ?? "",
    );
    expect(baseURL, "Desktop/Tauri all-language smoke baseURL").toContain("/people-first-app/");

    for (const language of SUPPORTED_LANGUAGES) {
      const scenario: DesktopEntryScenario = {
        colorScheme: "light",
        fileName: `desktop-min-language-${language}-smoke.png`,
        language,
        name: `desktop-min-language-${language}-smoke`,
        screen: "language",
        theme: "paper",
        viewport: { width: 390, height: 640 },
      };
      const context = await newDesktopContext(browser, scenario);
      const page = await context.newPage();
      await primeEntryState(page, scenario);
      await page.goto(baseURL, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("language-selector-screen")).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(150);

      const fact = await collectLanguageFact(page);
      expect(fact.overflowX.document, `${language} document overflow`).toBe(false);
      expect(fact.overflowX.screen, `${language} screen overflow`).toBe(false);
      expect(fact.horizontallyOutOfBounds, `${language} horizontal out-of-bounds`).toHaveLength(0);
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
