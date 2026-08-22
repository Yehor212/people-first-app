import { expect, test, type Page } from "@playwright/test";

const baseURL = "http://127.0.0.1:8080/people-first-app/";
const labels = ["Light", "Dark", "System", "English", "Українська", "Español", "Deutsch", "Français", "日本語", "العربية", "עברית"];

type ReflowFacts = {
  fragmentedLabels: string[];
  headingReachable: boolean;
  horizontalOverflow: boolean;
  continueReachable: boolean;
  touchTargets: number[];
};

async function prepareEmptyEntryGate(page: Page) {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("language-selector-screen")).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => {
    document.documentElement.style.setProperty("--font-scale", "2", "important");
  });
  await page.waitForTimeout(400);
}

async function measureReflow(page: Page): Promise<ReflowFacts> {
  return page.evaluate((expectedLabels) => {
    const screen = document.querySelector<HTMLElement>("[data-testid='language-selector-screen']");
    const title = document.querySelector<HTMLElement>("#language-selector-title");
    const continueButton = document.querySelector<HTMLElement>("[data-testid='language-continue']");
    const textLineCount = (element: HTMLElement) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return range.getClientRects().length;
    };
    const fragmentedLabels = expectedLabels.filter((label) => {
      const element = Array.from(document.querySelectorAll<HTMLElement>("button span"))
        .find((candidate) => candidate.textContent?.trim() === label);
      return !element || textLineCount(element) > 2;
    });
    const screenRect = screen?.getBoundingClientRect();
    const titleRect = title?.getBoundingClientRect();
    const continueRect = continueButton?.getBoundingClientRect();
    const touchTargets = Array.from(document.querySelectorAll<HTMLElement>("[role='radio'], [data-testid='language-continue']"))
      .map((element) => element.getBoundingClientRect().height);

    return {
      fragmentedLabels,
      headingReachable: Boolean(titleRect && titleRect.left >= 0 && titleRect.right <= window.innerWidth && titleRect.bottom > 0),
      horizontalOverflow: Boolean(screen && screen.scrollWidth > screen.clientWidth + 2),
      continueReachable: Boolean(continueRect && screenRect && continueRect.bottom <= screenRect.bottom && continueRect.bottom > 0),
      touchTargets,
    };
  }, labels);
}

function expectReflow(facts: ReflowFacts) {
  expect(facts.horizontalOverflow, "entry gate horizontal overflow").toBe(false);
  expect(facts.headingReachable, "welcome heading reachable").toBe(true);
  expect(facts.fragmentedLabels, "labels with more than two rendered lines").toEqual([]);
  expect(facts.continueReachable, "Continue reachable within the scrollable entry gate").toBe(true);
  expect(facts.touchTargets.every((height) => height >= 44), "entry controls meet 44px target").toBe(true);
}

test.use({ browserName: "chromium" });

test("keeps the empty entry gate usable at narrow 200% text and detects removed responsive reflow", async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 320, height: 720 },
  });
  const page = await context.newPage();
  await prepareEmptyEntryGate(page);
  expectReflow(await measureReflow(page));

  const negativeControl = await page.evaluate(() => {
    document.querySelector<HTMLElement>("#language-selector-title")?.style.setProperty("overflow-wrap", "normal", "important");
    document.querySelector<HTMLElement>("#language-selector-title")?.style.setProperty("white-space", "nowrap", "important");
    document.querySelector<HTMLElement>("[data-testid='entry-theme-switcher']")?.style.setProperty("grid-template-columns", "repeat(3, minmax(0, 1fr))", "important");
    document.querySelector<HTMLElement>("[role='radiogroup'][aria-label='Select language']")?.style.setProperty("grid-template-columns", "repeat(2, minmax(0, 1fr))", "important");
    return {
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      titleRight: document.querySelector<HTMLElement>("#language-selector-title")?.getBoundingClientRect().right ?? 0,
      fragmentedLabel: Array.from(document.querySelectorAll<HTMLElement>(".entry-language-option-label")).some((label) => {
        const range = document.createRange();
        range.selectNodeContents(label);
        return range.getClientRects().length > 2;
      }),
    };
  });
  expect(negativeControl.horizontalOverflow || negativeControl.titleRight > 320 || negativeControl.fragmentedLabel, "removing responsive reflow must reintroduce the entry defect").toBe(true);
  await context.close();
});
