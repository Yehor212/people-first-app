import { expect, test } from "@playwright/test";

const LATE_SWAP_CUTOFF_MS = 1200;

async function primeOrbPage(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    localStorage.setItem("zenflow-has-onboarded", "true");
    localStorage.setItem("zenflow-language", "uk");
    localStorage.setItem("zenflow-language-selected", "true");
    localStorage.setItem("zenflow-tutorial-complete", "true");
    localStorage.setItem("zenflow-onboarding-complete", "true");
    localStorage.setItem("zenflow-orb-first-run-dismissed", "1");
    localStorage.setItem("zenflow-nav-v2-enabled", "true");
    localStorage.setItem(
      "zenflow-user",
      JSON.stringify({
        id: "orb-renderer-lifecycle",
        name: "Orb Probe",
        email: "orb-probe@example.com",
      }),
    );
    sessionStorage.removeItem("zenflow-orb-webgl-slow-ms");
    sessionStorage.removeItem("zenflow-mood-entry-draft");

    const win = window as typeof window & {
      __zenOrbCanvasEvents?: Array<{
        event: "appendCanvas" | "replaceCanvas";
        at: number;
        oldWidth?: number;
        newWidth?: number;
      }>;
    };
    win.__zenOrbCanvasEvents = [];

    const isCanvas = (node: Node): node is HTMLCanvasElement =>
      node.nodeName === "CANVAS" &&
      typeof (node as HTMLCanvasElement).width === "number" &&
      typeof (node as HTMLCanvasElement).height === "number";

    const originalAppendChild = Element.prototype.appendChild;
    Element.prototype.appendChild = function appendChildWithOrbProbe<T extends Node>(
      child: T,
    ): T {
      const result = originalAppendChild.call(this, child) as T;
      if (isCanvas(child)) {
        win.__zenOrbCanvasEvents?.push({
          event: "appendCanvas",
          at: Math.round(performance.now()),
          newWidth: child.width,
        });
      }
      return result;
    };

    const originalReplaceChild = Element.prototype.replaceChild;
    Element.prototype.replaceChild = function replaceChildWithOrbProbe<T extends Node>(
      newChild: Node,
      oldChild: T,
    ): T {
      const result = originalReplaceChild.call(this, newChild, oldChild) as T;
      if (isCanvas(newChild) || isCanvas(oldChild)) {
        win.__zenOrbCanvasEvents?.push({
          event: "replaceCanvas",
          at: Math.round(performance.now()),
          oldWidth: isCanvas(oldChild) ? oldChild.width : undefined,
          newWidth: isCanvas(newChild) ? newChild.width : undefined,
        });
      }
      return result;
    };
  });
}

test.describe("V2 orb renderer lifecycle", () => {
  test("does not create horizontally scrollable decorative orb layers", async ({
    page,
  }) => {
    await primeOrbPage(page);
    await page.addInitScript(() => {
      localStorage.setItem("zenflow-theme", "paper");
    });
    await page.setViewportSize({ width: 449, height: 698 });
    await page.goto("orb?nav=v2&navLayout=phone&dev=true", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByTestId("orb-page-next")).toBeVisible();

    const overflowAudit = await page.evaluate(() => {
      const orbPage = document.querySelector<HTMLElement>('[data-testid="orb-page"]');
      if (!orbPage) {
        throw new Error("Orb page root was not rendered");
      }

      const decorativeLayers = Array.from(
        orbPage.querySelectorAll<HTMLElement>(
          [
            '[data-testid="cosmic-orb-flourish-layer"]',
            '[data-testid="day-cosmic-background"]',
            '[data-testid^="day-cosmic-"]',
            '[data-testid="orb-day-flourish"]',
          ].join(", "),
        ),
      );

      const scrollableDecorativeLayers = decorativeLayers
        .map((element) => {
          const before = element.scrollLeft;
          element.scrollLeft = 1;
          const canScrollX = element.scrollLeft > 0;
          element.scrollLeft = before;
          return {
            testId: element.dataset.testid ?? "",
            className: element.className,
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            overflowX: getComputedStyle(element).overflowX,
            canScrollX,
          };
        })
        .filter((entry) => entry.canScrollX);

      return {
        bodyOverflowX: document.body.scrollWidth - document.body.clientWidth,
        documentOverflowX:
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
        scrollableDecorativeLayers,
      };
    });

    expect(overflowAudit.bodyOverflowX).toBeLessThanOrEqual(0);
    expect(overflowAudit.documentOverflowX).toBeLessThanOrEqual(0);
    expect(overflowAudit.scrollableDecorativeLayers).toEqual([]);
  });

  test("does not swap the visible hero orb canvas after the first stable frame", async ({
    page,
  }) => {
    test.setTimeout(70000);

    await primeOrbPage(page);
    await page.goto("orb?nav=v2&navLayout=phone&dev=true", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator('[data-orb-transition-profile="v1-soft"]').last()).toBeVisible();

    await page.waitForTimeout(5000);

    const lateVisibleSwaps = await page.evaluate((lateSwapCutoffMs) => {
      const win = window as typeof window & {
        __zenOrbCanvasEvents?: Array<{
          event: "appendCanvas" | "replaceCanvas";
          at: number;
          oldWidth?: number;
          newWidth?: number;
        }>;
      };
      const heroEvents = (win.__zenOrbCanvasEvents ?? []).filter(
        (event) => (event.oldWidth ?? 0) >= 200 || (event.newWidth ?? 0) >= 200,
      );
      const firstHeroCanvasAt = Math.min(
        ...heroEvents.map((event) => event.at),
      );
      return heroEvents.filter((event) => {
        const isVisibleHeroCanvas =
          (event.oldWidth ?? 0) >= 200 || (event.newWidth ?? 0) >= 200;
        return (
          event.event === "replaceCanvas" &&
          event.at - firstHeroCanvasAt > lateSwapCutoffMs &&
          isVisibleHeroCanvas
        );
      });
    }, LATE_SWAP_CUTOFF_MS);

    expect(lateVisibleSwaps).toEqual([]);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () =>
        Array.from(
          document.querySelectorAll<HTMLElement>(
            '[data-orb-renderer-policy="webgl"][data-orb-visual-ready="true"]',
          ),
        ).some((wrapper) =>
          Array.from(wrapper.querySelectorAll<HTMLCanvasElement>("canvas")).some(
            (canvas) =>
              canvas.width >= 200 &&
              canvas.height >= 200 &&
              canvas.offsetWidth > 0 &&
              canvas.offsetHeight > 0 &&
              (canvas.dataset.orbRendererTier === "canvas2d" ||
                canvas.dataset.orbRendererTier === "webgl-main" ||
                canvas.dataset.orbRendererTier === "webgl-worker"),
          ),
        ),
      { timeout: 30000 },
    );

    const afterReload = await page.evaluate(() => {
      const readyWrappers = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-orb-renderer-policy="webgl"][data-orb-visual-ready="true"]',
        ),
      );
      const canvases = readyWrappers.flatMap((wrapper) =>
        Array.from(wrapper.querySelectorAll<HTMLCanvasElement>("canvas")).filter(
          (canvas) => canvas.width >= 200 && canvas.height >= 200,
        ),
      );
      return {
        ready: readyWrappers.length > 0,
        visibleHeroCanvases: canvases.filter(
          (canvas) => canvas.offsetWidth > 0 && canvas.offsetHeight > 0,
        ).length,
        tiers: canvases.map((canvas) => canvas.dataset.orbRendererTier ?? ""),
      };
    });

    expect(afterReload).toMatchObject({
      ready: true,
      visibleHeroCanvases: 1,
    });
    expect(afterReload.tiers).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^(canvas2d|webgl-(main|worker))$/),
      ]),
    );
  });
});
