import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const serial = process.env.ANDROID_SERIAL || "emulator-5554";
const locale = process.env.REFLOW_LOCALE || "he";
const supportedLocales = new Set(["en", "uk", "es", "de", "fr", "ja", "ar", "he"]);
if (!supportedLocales.has(locale)) {
  throw new Error(`Unsupported REFLOW_LOCALE: ${locale}`);
}
const direction = locale === "ar" || locale === "he" ? "rtl" : "ltr";
const theme = direction === "rtl" ? "dark" : "light";
const baseUrl = process.env.REFLOW_BASE_URL || "http://127.0.0.1:8114";
const outputDir = path.resolve(
  "output/android21/t153-participants-leaderboard-reflow/native-api36",
);

function adbShell(...args: string[]) {
  return execFileSync("adb", ["-s", serial, "shell", ...args], { encoding: "utf8" }).trim();
}

mkdirSync(outputDir, { recursive: true });

const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
try {
  const page = browser
    .contexts()
    .flatMap((context) => context.pages())
    .filter(
      (candidate) =>
        candidate.url().includes("participants-leaderboard-reflow"),
    )
    .at(-1);
  if (!page) throw new Error("API 36 ParticipantsLeaderboard fixture page not found");

  await page.bringToFront();
  await page.goto(
    `${baseUrl}/e2e/helpers/participants-leaderboard-reflow/index.html?lang=${locale}&theme=${theme}&scale=200`,
    { waitUntil: "domcontentloaded" },
  );

  const fixture = page.getByTestId("participants-leaderboard-reflow-fixture");
  const cardOwner = page.getByTestId("participants-leaderboard-card");
  await fixture.waitFor({ state: "visible" });
  const card = cardOwner.locator(":scope > div");
  const rows = card.locator(":scope > div:nth-child(2) > div > div");
  await rows.first().waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const cardElement = document.querySelector('[data-testid="participants-leaderboard-card"] > div');
    const scrollContainer = cardElement?.children.item(1);
    const rowsContainer = scrollContainer?.children.item(0);
    return Array.from(rowsContainer?.children ?? []).every((row) => {
      const transform = getComputedStyle(row).transform;
      if (transform === "none") return true;
      const matrix = new DOMMatrixReadOnly(transform);
      return Math.abs(matrix.m41) < 0.1 && Math.abs(matrix.m42) < 0.1;
    });
  });
  await page.waitForTimeout(1_600);

  const frameIntervals: number[] = await page.evaluate(`
    new Promise((resolve) => {
      const samples = [];
      const scroller = document.querySelector('[data-testid="participants-leaderboard-card"] > div > div:nth-child(2)');
      if (!scroller) {
        resolve(samples);
        return;
      }
      let first = null;
      let previous = null;
      let completed = false;
      const finish = () => {
        if (completed) return;
        completed = true;
        scroller.scrollTop = 0;
        resolve(samples);
      };
      const sample = (timestamp) => {
        if (first === null) {
          first = timestamp;
          scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
        }
        if (previous !== null) samples.push(timestamp - previous);
        previous = timestamp;
        if (timestamp - first < 1500) requestAnimationFrame(sample);
        else finish();
      };
      requestAnimationFrame(sample);
      setTimeout(finish, 2500);
    })
  `);

  const facts = await card.evaluate((cardElement) => {
    const scrollContainer = cardElement.children[1] as HTMLElement;
    const rowsContainer = scrollContainer.children[0] as HTMLElement;
    const rows = Array.from(rowsContainer.children) as HTMLElement[];
    const cardRect = cardElement.getBoundingClientRect();
    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    const firstRowRect = rows[0].getBoundingClientRect();
    const tolerance = 0.75;
    const textOutsideCard: string[] = [];
    const walker = document.createTreeWalker(cardElement, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();
    while (current) {
      const text = current.textContent?.trim() ?? "";
      if (text) {
        const range = document.createRange();
        range.selectNodeContents(current);
        const rects = Array.from(range.getClientRects()).filter(
          (rect) => rect.width > 0 && rect.height > 0,
        );
        if (
          rects.some(
            (rect) => rect.left < cardRect.left - tolerance || rect.right > cardRect.right + tolerance,
          )
        ) {
          textOutsideCard.push(text);
        }
      }
      current = walker.nextNode();
    }

    return {
      language: document.documentElement.lang,
      direction: document.documentElement.dir,
      rootFontSize: getComputedStyle(document.documentElement).fontSize,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        visualWidth: window.visualViewport?.width ?? null,
        visualHeight: window.visualViewport?.height ?? null,
      },
      documentOverflow: Math.max(
        0,
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
        document.body.scrollWidth - document.documentElement.clientWidth,
      ),
      cardOverflow: Math.max(0, cardElement.scrollWidth - cardElement.clientWidth),
      rowOverflow: rows.map((row) => Math.max(0, row.scrollWidth - row.clientWidth)),
      textOutsideCard,
      rowCount: rows.length,
      currentUserMarkerCount: cardElement.querySelectorAll(".bg-violet-500\\/20").length,
      completedStatusCount: rowsContainer.querySelectorAll('svg.text-emerald-500[aria-label]').length,
      scrollRegionRole: scrollContainer.getAttribute("role"),
      listRole: rowsContainer.getAttribute("role"),
      listItemCount: rows.filter((row) => row.getAttribute("role") === "listitem").length,
      scrollContainerTabIndex: scrollContainer.tabIndex,
      firstRowFullyVisibleAtTop:
        firstRowRect.top >= scrollContainerRect.top - tolerance &&
        firstRowRect.bottom <= scrollContainerRect.bottom + tolerance,
      firstRowHeight: firstRowRect.height,
      scrollViewportHeight: scrollContainerRect.height,
      logicalOrder: rows.map((row) => {
        const rankRect = row.children.item(0)?.getBoundingClientRect();
        const nameRect = row.children.item(1)?.getBoundingClientRect();
        return {
          rankCenter: rankRect ? (rankRect.left + rankRect.right) / 2 : null,
          nameCenter: nameRect ? (nameRect.left + nameRect.right) / 2 : null,
        };
      }),
      card: { width: cardRect.width, height: cardRect.height },
      userAgent: navigator.userAgent,
    };
  });

  const sortedFrameIntervals = [...frameIntervals].sort((left, right) => left - right);
  const p50Index = Math.min(
    Math.max(0, sortedFrameIntervals.length - 1),
    Math.floor(sortedFrameIntervals.length * 0.5),
  );
  const p95Index = Math.min(
    Math.max(0, sortedFrameIntervals.length - 1),
    Math.floor(sortedFrameIntervals.length * 0.95),
  );
  const frameSample = {
    scenario: "component-internal-smooth-scroll-after-entrance-settle",
    count: frameIntervals.length,
    p50Ms: sortedFrameIntervals.length === 0 ? null : sortedFrameIntervals[p50Index],
    p95Ms: sortedFrameIntervals.length === 0 ? null : sortedFrameIntervals[p95Index],
    maxMs: sortedFrameIntervals.at(-1) ?? null,
    over33Ms: frameIntervals.filter((duration) => duration > 33.34).length,
    over50Ms: frameIntervals.filter((duration) => duration > 50).length,
  };

  if (
    facts.language !== locale ||
    facts.direction !== direction ||
    facts.rootFontSize !== "32px"
  ) {
    throw new Error(`Unexpected API 36 locale/scale facts: ${JSON.stringify(facts)}`);
  }
  if (
    facts.documentOverflow !== 0 ||
    facts.cardOverflow !== 0 ||
    facts.rowOverflow.some((value) => value !== 0) ||
    facts.textOutsideCard.length !== 0 ||
    facts.rowCount !== 5 ||
    facts.currentUserMarkerCount !== 1 ||
    facts.completedStatusCount !== 2 ||
    facts.scrollRegionRole !== "region" ||
    facts.listRole !== "list" ||
    facts.listItemCount !== 5 ||
    facts.scrollContainerTabIndex < 0 ||
    !facts.firstRowFullyVisibleAtTop ||
    facts.logicalOrder.some((row) => {
      if (row.rankCenter === null || row.nameCenter === null) return true;
      return direction === "rtl"
        ? row.rankCenter <= row.nameCenter
        : row.rankCenter >= row.nameCenter;
    }) ||
    frameSample.count === 0
  ) {
    throw new Error(
      `API 36 reflow invariant failed: ${JSON.stringify({ ...facts, frameSample })}`,
    );
  }

  await page.screenshot({
    path: path.join(outputDir, `${locale}-api36-component.png`),
    fullPage: true,
    animations: "disabled",
  });
  await rows.nth(3).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(outputDir, `${locale}-api36-current-user.png`),
    fullPage: true,
    animations: "disabled",
  });
  writeFileSync(
    path.join(outputDir, `${locale}-api36-device-chrome.png`),
    execFileSync("adb", ["-s", serial, "exec-out", "screencap", "-p"], {
      maxBuffer: 8 * 1024 * 1024,
    }),
  );
  writeFileSync(
    path.join(outputDir, `${locale}-api36-facts.json`),
    `${JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        serial,
        androidApi: adbShell("getprop", "ro.build.version.sdk"),
        model: adbShell("getprop", "ro.product.model"),
        wmSize: adbShell("wm", "size"),
        wmDensity: adbShell("wm", "density"),
        ...facts,
        frameSample,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await browser.close();
}
