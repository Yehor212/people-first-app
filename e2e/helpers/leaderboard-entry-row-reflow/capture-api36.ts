import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const serial = process.env.ANDROID_SERIAL || "emulator-5554";
const outputDir = path.resolve(
  "output/android21/t153-leaderboard-entry-row-reflow/native-api36",
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
        candidate.url().includes("leaderboard-entry-row-reflow") &&
        candidate.url().includes("lang=he") &&
        candidate.url().includes("theme=dark") &&
        candidate.url().includes("scale=200"),
    )
    .at(-1);
  if (!page) throw new Error("API 36 LeaderboardEntryRow fixture page not found");

  const fixture = page.getByTestId("leaderboard-entry-row-reflow-fixture");
  const card = page.getByTestId("leaderboard-entry-row-card");
  await fixture.waitFor({ state: "visible" });
  await page.waitForFunction(() =>
    Array.from(
      document.querySelector('[data-testid="leaderboard-entry-row-card"]')?.children ?? [],
    ).every((row) => {
      const transform = getComputedStyle(row).transform;
      if (transform === "none") return true;
      const matrix = new DOMMatrixReadOnly(transform);
      return Math.abs(matrix.m41) < 0.1 && Math.abs(matrix.m42) < 0.1;
    }),
  );

  const facts = await card.evaluate((cardElement) => {
    const rows = Array.from(cardElement.children) as HTMLElement[];
    const cardRect = cardElement.getBoundingClientRect();
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
      crownCount: cardElement.querySelectorAll("svg.lucide-crown").length,
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

  await page.screenshot({
    path: path.join(outputDir, "he-api36-component.png"),
    fullPage: true,
    animations: "disabled",
  });
  writeFileSync(
    path.join(outputDir, "he-api36-device-chrome.png"),
    execFileSync("adb", ["-s", serial, "exec-out", "screencap", "-p"]),
  );
  writeFileSync(
    path.join(outputDir, "he-api36-facts.json"),
    `${JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        serial,
        androidApi: adbShell("getprop", "ro.build.version.sdk"),
        model: adbShell("getprop", "ro.product.model"),
        wmSize: adbShell("wm", "size"),
        wmDensity: adbShell("wm", "density"),
        ...facts,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await browser.close();
}
