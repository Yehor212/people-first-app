import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const serial = process.env.ANDROID_SERIAL || "emulator-5554";
const outputDir = path.resolve(
  "output/android21/t153-habit-streak-timeline-reflow/native-api36",
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
        candidate.url().includes("habit-streak-timeline-reflow") &&
        candidate.url().includes("lang=he") &&
        candidate.url().includes("theme=dark") &&
        candidate.url().includes("scale=200"),
    )
    .at(-1);
  if (!page) throw new Error("API 36 HabitStreakTimeline fixture page not found");

  const fixture = page.getByTestId("habit-streak-timeline-reflow-fixture");
  await fixture.waitFor({ state: "visible" });
  const facts = await fixture.evaluate((fixtureElement) => {
    const card = fixtureElement.querySelector<HTMLElement>(":scope > section");
    const timeline = card?.firstElementChild as HTMLElement | null;
    const summary = timeline?.children.item(1) as HTMLElement | null;
    const history = timeline?.children.item(2) as HTMLElement | null;
    if (!card || !timeline || !summary || !history) {
      throw new Error("API 36 habit streak timeline structure not found");
    }

    const cardRect = card.getBoundingClientRect();
    const tolerance = 0.75;
    const textOutsideCard: string[] = [];
    const walker = document.createTreeWalker(timeline, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();
    while (current) {
      const text = current.textContent?.trim() ?? "";
      if (text) {
        const range = document.createRange();
        range.selectNodeContents(current);
        const rect = range.getBoundingClientRect();
        if (
          rect.width > 0 &&
          (rect.left < cardRect.left - tolerance || rect.right > cardRect.right + tolerance)
        ) {
          textOutsideCard.push(text);
        }
      }
      current = walker.nextNode();
    }

    const dateEndpoints = Array.from(timeline.querySelectorAll<HTMLTimeElement>("time[datetime]"));
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
      componentOverflow: Math.max(0, timeline.scrollWidth - timeline.clientWidth),
      textOutsideCard,
      summaryItemCount: summary.children.length,
      historyRowCount: history.children.length,
      dateEndpointCount: dateEndpoints.length,
      dateEndpoints: dateEndpoints.map((element) => ({
        dateTime: element.dateTime,
        text: element.textContent,
        direction: element.dir,
        unicodeBidi: getComputedStyle(element).unicodeBidi,
        whiteSpace: getComputedStyle(element).whiteSpace,
      })),
      card: {
        width: cardRect.width,
        height: cardRect.height,
      },
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
