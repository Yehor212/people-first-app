import { expect, test } from "@playwright/test";

const LATE_SWAP_CUTOFF_MS = 1000;

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
  test("does not swap the visible hero orb canvas after the first stable frame", async ({
    page,
  }) => {
    test.setTimeout(70000);

    await primeOrbPage(page);
    await page.goto("orb?nav=v2&navLayout=phone&dev=true", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator('[data-orb-transition-profile="v1-soft"]').last()).toBeVisible();

    await page.waitForTimeout(22000);

    const lateVisibleSwaps = await page.evaluate((lateSwapCutoffMs) => {
      const win = window as typeof window & {
        __zenOrbCanvasEvents?: Array<{
          event: "appendCanvas" | "replaceCanvas";
          at: number;
          oldWidth?: number;
          newWidth?: number;
        }>;
      };
      return (win.__zenOrbCanvasEvents ?? []).filter((event) => {
        const isVisibleHeroCanvas =
          (event.oldWidth ?? 0) >= 200 || (event.newWidth ?? 0) >= 200;
        return (
          event.event === "replaceCanvas" &&
          event.at > lateSwapCutoffMs &&
          isVisibleHeroCanvas
        );
      });
    }, LATE_SWAP_CUTOFF_MS);

    expect(lateVisibleSwaps).toEqual([]);

    await page.reload({ waitUntil: "domcontentloaded" });
    const heroOrb = page.locator(
      '[data-testid="orb-page-hero"] [data-orb-renderer-policy]',
    );
    await expect(heroOrb).toBeVisible();
    await expect(heroOrb).toHaveAttribute("data-orb-visual-ready", "true", {
      timeout: 20000,
    });

    const afterReload = await page.evaluate(() => {
      const hero = document.querySelector('[data-testid="orb-page-hero"]');
      const canvases = Array.from(hero?.querySelectorAll("canvas") ?? []).filter(
        (canvas) => canvas.width >= 200 && canvas.height >= 200,
      );
      const readyWrapper = hero?.querySelector(
        '[data-orb-renderer-policy][data-orb-visual-ready="true"]',
      );
      return {
        ready: Boolean(readyWrapper),
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
    expect(afterReload.tiers).toContain("canvas2d");
  });
});
