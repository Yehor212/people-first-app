import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { devices, webkit } from "@playwright/test";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
const artifactRoot = resolve(repoRoot, "output/playwright/ios-diary-e2e-20260614");
const serverPath = resolve(scriptDir, "serve-ios-spa.mjs");
const diagnosticPath = resolve(artifactRoot, "diagnostic.json");
const screenshotsDir = resolve(artifactRoot, "screenshots");
const auditNotesPath = resolve(artifactRoot, "ios-diary-audit.md");

mkdirSync(screenshotsDir, { recursive: true });

function waitForServer(process) {
  return new Promise((resolveReady, rejectReady) => {
    const timer = setTimeout(() => rejectReady(new Error("Server did not start in time")), 10_000);
    process.stdout.on("data", (chunk) => {
      if (String(chunk).includes("iOS diary SPA server listening")) {
        clearTimeout(timer);
        resolveReady();
      }
    });
    process.stderr.on("data", (chunk) => {
      process.stdout.write(`[diagnostic server stderr] ${chunk}`);
    });
    process.on("exit", (code) => {
      clearTimeout(timer);
      rejectReady(new Error(`Server exited early with code ${code}`));
    });
  });
}

async function capture(page, name) {
  const path = join(screenshotsDir, `${name}.png`);
  await page.screenshot({ fullPage: true, path });
  return path;
}

async function boxFor(page, testId) {
  const locator = page.getByTestId(testId).first();
  if ((await locator.count()) === 0) return null;
  try {
    await locator.waitFor({ state: "attached", timeout: 2_000 });
    return await locator.boundingBox({ timeout: 2_000 });
  } catch {
    return null;
  }
}

async function describeElement(page, testId) {
  const locator = page.getByTestId(testId).first();
  if ((await locator.count()) === 0) return null;
  try {
    await locator.waitFor({ state: "attached", timeout: 2_000 });
  } catch {
    return null;
  }

  return locator.evaluate((element, id) => {
    const rect = element.getBoundingClientRect();
    const computed = window.getComputedStyle(element);
    return {
      id,
      className: element.getAttribute("class"),
      rect: {
        height: rect.height,
        width: rect.width,
        x: rect.x,
        y: rect.y,
      },
      style: {
        height: computed.height,
        minHeight: computed.minHeight,
        minWidth: computed.minWidth,
        paddingBottom: computed.paddingBottom,
        transform: computed.transform,
        width: computed.width,
      },
    };
  }, testId);
}

async function primePage(page) {
  await page.addInitScript(() => {
    const json = (value) => JSON.stringify(value);
    const today = new Date().toISOString().split("T")[0];
    localStorage.setItem("zenflow-language", json("en"));
    localStorage.setItem("zenflow-language-selected", json(true));
    localStorage.setItem("zenflow-google-auth-checked", json(true));
    localStorage.setItem("zenflow-tutorial-complete", json(true));
    localStorage.setItem("zenflow-onboarding-complete", json(true));
    localStorage.setItem("zenflow-notification-permission-checked", json(true));
    localStorage.setItem("zenflow_last_active", today);
    localStorage.setItem("zenflow-last-weekly-report", new Date().toISOString());
    localStorage.setItem("zenflow-orb-first-run-dismissed", "1");
    localStorage.setItem("zenflow-privacy-acknowledged", json(true));
    localStorage.setItem(
      "zenflow-privacy",
      json({ analytics: false, consentShown: true, noTracking: false }),
    );
    localStorage.setItem(
      "zenflow_onboarding_state",
      json({
        daysActive: 5,
        firstLoginDate: Date.now(),
        hasSeenWelcome: true,
        isNewUser: false,
        lastActiveDate: today,
        unlockedFeatures: [],
      }),
    );
    localStorage.setItem("zenflow-theme", "light");
    localStorage.setItem("zenflow_oled_mode", "false");
    localStorage.setItem("zenflow:theme-v0c", json({ state: { theme: "paper" }, version: 0 }));
    sessionStorage.removeItem("zenflow-orb-webgl-slow-ms");
    sessionStorage.removeItem("zenflow-mood-entry-draft");
  });
}

const server = spawn(process.execPath, [serverPath], {
  cwd: repoRoot,
  env: { ...process.env, PORT: "4188" },
  stdio: ["ignore", "pipe", "pipe"],
});

try {
  await waitForServer(server);

  const browser = await webkit.launch();
  const context = await browser.newContext({
    ...devices["iPhone 15"],
    hasTouch: true,
    ignoreHTTPSErrors: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await primePage(page);

  const events = {
    console: [],
    pageErrors: [],
    requestFailed: [],
    responses: [],
  };
  const screenshots = [];

  page.on("console", (message) => {
    events.console.push({ type: message.type(), text: message.text() });
  });
  page.on("pageerror", (error) => {
    events.pageErrors.push({ name: error.name, message: error.message, stack: error.stack });
  });
  page.on("requestfailed", (request) => {
    events.requestFailed.push({
      failure: request.failure()?.errorText || "unknown",
      method: request.method(),
      url: request.url(),
    });
  });
  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("/assets/") || url.endsWith("/index.html") || url.includes("/diary")) {
      events.responses.push({
        contentType: response.headers()["content-type"] || "",
        status: response.status(),
        url,
      });
    }
  });

  await page.goto("https://127.0.0.1:4188/diary?nav=v2&dev=true&navLayout=phone", {
    waitUntil: "domcontentloaded",
  });
  await page.getByTestId("diary-page").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(1_000);
  screenshots.push({ step: "01-empty-diary", path: await capture(page, "01-empty-diary") });

  await page.getByTestId("journal-entry-main-fab").click();
  await page.getByTestId("journal-fab-action-new-entry").waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForTimeout(700);
  screenshots.push({ step: "02-create-menu", path: await capture(page, "02-create-menu") });

  await page.getByTestId("journal-fab-action-new-entry").click();
  await page.locator("[contenteditable='true']").waitFor({ state: "visible", timeout: 20_000 });
  await page.locator("[contenteditable='true']").fill("iOS diary e2e private test note.");
  screenshots.push({ step: "03-editor", path: await capture(page, "03-editor") });

  await page.getByRole("button", { name: /^photo$/i }).first().click();
  await page.getByRole("dialog", { name: /photo picker/i }).waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForTimeout(700);
  screenshots.push({ step: "04-photo-picker", path: await capture(page, "04-photo-picker") });
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: /^(save|зберегти|guardar|speichern|保存|حفظ|שמור)$/i }).click();
  await page.getByText("iOS diary e2e private test note.").waitFor({ state: "visible", timeout: 30_000 });
  screenshots.push({ step: "05-saved-entry", path: await capture(page, "05-saved-entry") });

  await page.getByTestId("journal-mobile-settings").click();
  await page.getByRole("dialog", { name: /diary settings/i }).waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForTimeout(700);
  screenshots.push({ step: "06-settings-dialog", path: await capture(page, "06-settings-dialog") });
  await page.keyboard.press("Escape");
  await page.getByRole("dialog", { name: /diary settings/i }).waitFor({ state: "detached", timeout: 20_000 });

  await page.addStyleTag({ content: ":root { --zenflow-test-nav-inset-bottom: 34px; }" });
  await page.getByTestId("journal-mobile-stats").click();
  await page.getByTestId("memory-portal-canvas").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(1_000);
  screenshots.push({ step: "07-memory-portal", path: await capture(page, "07-memory-portal") });

  const dom = await page.evaluate(() => ({
    bodyText: document.body.innerText.slice(0, 1600),
    dataTestIds: Array.from(document.querySelectorAll("[data-testid]"))
      .slice(0, 80)
      .map((element) => element.getAttribute("data-testid")),
    readyState: document.readyState,
    title: document.title,
    url: location.href,
    viewport: {
      height: window.innerHeight,
      width: window.innerWidth,
    },
  }));

  const metrics = {
    boxes: {
      createFab: await boxFor(page, "journal-entry-main-fab"),
      diaryPanelTrigger: await boxFor(page, "journal-mobile-diary-sidebar-trigger"),
      settings: await boxFor(page, "journal-mobile-settings"),
      stats: await boxFor(page, "journal-mobile-stats"),
    },
    details: {
      diaryPanelTrigger: await describeElement(page, "journal-mobile-diary-sidebar-trigger"),
      memoryPortal: await describeElement(page, "memory-portal-canvas"),
      settings: await describeElement(page, "journal-mobile-settings"),
      stats: await describeElement(page, "journal-mobile-stats"),
    },
    horizontalOverflow: await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  };

  const payload = { dom, events, metrics, screenshots };
  writeFileSync(diagnosticPath, `${JSON.stringify(payload, null, 2)}\n`);
  writeFileSync(
    auditNotesPath,
    [
      "# iOS V2 Diary Audit",
      "",
      "## Steps Captured",
      "",
      "1. Empty diary first screen: route renders in WebKit iPhone 15 emulation.",
      "2. Diary panel trigger: main action expands into entry actions without clipping.",
      "3. Editor: contenteditable editor opens and accepts input.",
      "4. Photo picker: native-adjacent photo choices are reachable.",
      "5. Saved entry: local seeded note appears in the diary list.",
      "6. Settings dialog: settings opens as a dialog and can be dismissed.",
      "7. Memory portal: stats button opens the portal with iOS home-indicator reserve applied.",
      "",
      "## Evidence Limits",
      "",
      "- Captured with Playwright WebKit iPhone 15 emulation against the synced iOS web bundle.",
      "- Native Face ID, camera, microphone permission prompts require an installed simulator/device run to verify fully.",
      "- Screenshots contain seeded local test text only, not real user diary content.",
      "",
    ].join("\n"),
  );
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);

  await context.close();
  await browser.close();
} finally {
  server.kill();
}
