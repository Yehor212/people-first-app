import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const serial = process.env.ANDROID_SERIAL || "emulator-5554";
const outputDir = path.resolve("output/android21/t153-global-schedule-bar-reflow/native-api36");

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
        candidate.url().includes("global-schedule-bar-reflow") &&
        candidate.url().includes("theme=dark") &&
        candidate.url().includes("scale=200"),
    )
    .at(-1);
  if (!page) throw new Error("API 36 GlobalScheduleBar fixture page not found");

  await page.getByTestId("global-schedule-bar-reflow-fixture").waitFor({ state: "visible" });
  const facts = await page.getByRole("button").evaluate((element) => {
    const fixture = document.querySelector<HTMLElement>(
      '[data-testid="global-schedule-bar-reflow-fixture"]',
    );
    const eventTitle = fixture?.dataset.eventTitle ?? "";
    const titleElement = Array.from(element.querySelectorAll<HTMLElement>("span")).find(
      (candidate) => candidate.textContent === eventTitle,
    );
    if (!titleElement) throw new Error("API 36 schedule event title element not found");

    const buttonRect = element.getBoundingClientRect();
    const titleRect = titleElement.getBoundingClientRect();
    const titleStyle = getComputedStyle(titleElement);
    const arrow = element.querySelector<SVGElement>("svg.lucide-chevron-right");

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
      button: {
        width: buttonRect.width,
        height: buttonRect.height,
        minimumTarget: Math.min(buttonRect.width, buttonRect.height),
      },
      title: {
        text: titleElement.textContent,
        width: titleRect.width,
        height: titleRect.height,
        horizontalOverflow: Math.max(0, titleElement.scrollWidth - titleElement.clientWidth),
        whiteSpace: titleStyle.whiteSpace,
        textOverflow: titleStyle.textOverflow,
        overflowX: titleStyle.overflowX,
        insideButton:
          titleRect.left >= buttonRect.left - 0.5 &&
          titleRect.right <= buttonRect.right + 0.5 &&
          titleRect.top >= buttonRect.top - 0.5 &&
          titleRect.bottom <= buttonRect.bottom + 0.5,
      },
      arrowTransform: arrow ? getComputedStyle(arrow).transform : null,
      userAgent: navigator.userAgent,
    };
  });

  await page.screenshot({
    path: path.join(outputDir, "he-api36-component.png"),
    fullPage: true,
    animations: "disabled",
  });

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
