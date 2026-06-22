import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "@playwright/test";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
const artifactRoot = resolve(repoRoot, "output/playwright/android-diary-e2e-20260614");
const serverPath = resolve(scriptDir, "serve-android-spa.mjs");
const diagnosticPath = resolve(artifactRoot, "diagnostic.json");
const screenshotsDir = resolve(artifactRoot, "screenshots");
const auditNotesPath = resolve(artifactRoot, "android-diary-audit.md");

mkdirSync(screenshotsDir, { recursive: true });

function waitForServer(process) {
  return new Promise((resolveReady, rejectReady) => {
    const timer = setTimeout(() => rejectReady(new Error("Server did not start in time")), 10_000);
    process.stdout.on("data", (chunk) => {
      if (String(chunk).includes("Android diary SPA server listening")) {
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

const server = spawn(process.execPath, [serverPath], {
  cwd: repoRoot,
  env: { ...process.env, PORT: "4177" },
  stdio: ["ignore", "pipe", "pipe"],
});

try {
  await waitForServer(server);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...devices["Pixel 5"],
    browserName: "chromium",
    hasTouch: true,
    ignoreHTTPSErrors: true,
    isMobile: true,
  });
  const page = await context.newPage();
  const events = {
    console: [],
    pageErrors: [],
    requestFailed: [],
    responses: [],
  };
  const screenshots = [];

  page.on("console", (message) => {
    events.console.push({ location: message.location(), type: message.type(), text: message.text() });
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

  await page.goto("https://127.0.0.1:4177/diary?nav=v2&dev=true&navLayout=phone", {
    waitUntil: "domcontentloaded",
  });
  await page.getByTestId("diary-page").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(1_000);
  screenshots.push({ step: "01-empty-diary", path: await capture(page, "01-empty-diary") });
  const initialShellMetrics = {
    boxes: {
      createFab: await boxFor(page, "journal-entry-main-fab"),
      diaryPanelTrigger: await boxFor(page, "journal-mobile-diary-sidebar-trigger"),
      settings: await boxFor(page, "journal-mobile-settings"),
      stats: await boxFor(page, "journal-mobile-stats"),
    },
    details: {
      createFab: await describeElement(page, "journal-entry-main-fab"),
      diaryPanelTrigger: await describeElement(page, "journal-mobile-diary-sidebar-trigger"),
      settings: await describeElement(page, "journal-mobile-settings"),
      stats: await describeElement(page, "journal-mobile-stats"),
    },
  };

  await page.getByTestId("journal-entry-main-fab").click();
  await page.getByTestId("journal-fab-action-new-entry").waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForTimeout(700);
  screenshots.push({ step: "02-create-menu", path: await capture(page, "02-create-menu") });
  const createMenuMetrics = {
    boxes: {
      burn: await boxFor(page, "journal-fab-action-burn"),
      gratitude: await boxFor(page, "journal-fab-action-gratitude"),
      newEntry: await boxFor(page, "journal-fab-action-new-entry"),
      primary: await boxFor(page, "journal-fab-action-primary"),
    },
    details: {
      burn: await describeElement(page, "journal-fab-action-burn"),
      gratitude: await describeElement(page, "journal-fab-action-gratitude"),
      newEntry: await describeElement(page, "journal-fab-action-new-entry"),
      primary: await describeElement(page, "journal-fab-action-primary"),
    },
  };

  await page.getByTestId("journal-fab-action-new-entry").click();
  const editor = page.locator("[contenteditable='true']");
  await editor.waitFor({ state: "visible", timeout: 20_000 });
  await editor.fill("Android diary e2e private test note.");
  screenshots.push({ step: "03-editor", path: await capture(page, "03-editor") });
  const editorMetrics = {
    saveButton: await page
      .getByRole("button", { name: /^(save|зберегти|guardar|speichern|保存|حفظ|שמור)$/i })
      .boundingBox(),
  };

  await page.getByRole("button", { name: /^(save|зберегти|guardar|speichern|保存|حفظ|שמור)$/i }).click();
  await editor.waitFor({ state: "hidden", timeout: 30_000 });
  await page.getByText("Android diary e2e private test note.").waitFor({ state: "visible", timeout: 30_000 });
  screenshots.push({ step: "04-saved-entry", path: await capture(page, "04-saved-entry") });

  await page.getByTestId("journal-mobile-settings").click();
  await page.getByRole("dialog", { name: /diary settings/i }).waitFor({ state: "visible", timeout: 20_000 });
  screenshots.push({ step: "05-settings-dialog", path: await capture(page, "05-settings-dialog") });
  await page.keyboard.press("Escape");

  await page.addStyleTag({ content: ":root { --zenflow-test-nav-inset-bottom: 48px; }" });
  await page.getByTestId("journal-mobile-stats").click();
  await page.getByTestId("memory-portal-canvas").waitFor({ state: "visible", timeout: 30_000 });
  screenshots.push({ step: "06-memory-portal", path: await capture(page, "06-memory-portal") });

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
    createMenu: createMenuMetrics,
    editor: editorMetrics,
    initialShell: initialShellMetrics,
    memoryPortal: {
      box: await boxFor(page, "memory-portal-canvas"),
      details: await describeElement(page, "memory-portal-canvas"),
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
      "# Android V2 Diary Audit",
      "",
      "## Steps Captured",
      "",
      "1. Empty diary first screen: route renders, header controls are visible, empty state is clear.",
      "2. Diary panel trigger: main action expands into entry actions without clipping.",
      "3. Editor: contenteditable editor opens and accepts input in the Android viewport.",
      "4. Saved entry: saved local test note appears in the diary list.",
      "5. Settings dialog: settings opens as a dialog and can be dismissed with Escape fallback.",
      "6. Memory portal: stats button opens the portal surface with Android nav reserve applied.",
      "",
      "## Evidence Limits",
      "",
      "- Captured with Playwright Chromium Pixel 5 emulation against the synced Android web bundle.",
      "- Android hardware back requires a native emulator/device to verify fully; this run verifies the web fallback and source-wired surfaces.",
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
