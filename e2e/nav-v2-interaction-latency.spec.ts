import { expect, test, type Page } from "@playwright/test";
import { primeZenflowV2, v2RoutePath, type ZenflowV2Route, type ZenflowV2Language } from "./helpers/zenflowV2State";

const destinations: ZenflowV2Route[] = ["orb", "habits", "diary", "planning", "settings"];
const budgetMs = 103;

async function openPhone(page: Page, reducedMotion: "reduce" | "no-preference", language: ZenflowV2Language = "en") {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion, colorScheme: "light" });
  await primeZenflowV2(page, { clearStorage: true, privacyNoTracking: true, language });
  await page.goto(v2RoutePath("settings", { dev: false, layout: "phone" }));
  await expect(page.getByTestId("settings-page")).toBeVisible();
  // Exercise the shipped CSS branch in Chromium. This does not emulate the
  // native bridge, Android compositor, hardware cadence, or APK installation.
  await page.evaluate(() => { document.documentElement.dataset.platform = "android"; });
}

async function openMenu(page: Page) {
  // Diary owns an embedded trigger; the floating shell trigger is hidden there.
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await expect(page.getByTestId("drawer-v2")).toBeVisible();
  await expect.poll(() => page.getByTestId("drawer-v2").evaluate(element =>
    element.getAnimations({ subtree: true }).filter(animation =>
      animation.playState === "running" &&
      animation.effect?.getComputedTiming().iterations !== Infinity
    ).length
  )).toBe(0);
}

async function observeDestination(page: Page, destination: ZenflowV2Route) {
  await page.getByTestId(`drawer-v2-destination-${destination}`).evaluate((button, route) => {
    button.addEventListener("click", () => {
      const observation = {
        route, activatedAt: performance.now(), drawerGoneMs: null as number | null,
        readyDomMs: null as number | null, paintOpportunityMs: null as number | null,
      };
      (window as typeof window & { interactionObservation: typeof observation }).interactionObservation = observation;
      const sample = () => {
        const elapsed = performance.now() - observation.activatedAt;
        const drawerGone = !document.querySelector('[data-testid="drawer-v2"]');
        if (drawerGone && observation.drawerGoneMs === null) observation.drawerGoneMs = elapsed;
        const target = document.querySelector(`[data-testid="${route}-page"]`);
        const loading = document.querySelector('[data-testid="orb-page-loading"], [data-testid="orb-page-render-error"], [data-testid="nav-v2-route-fallback"]');
        if (drawerGone && target?.getClientRects().length && !loading) {
          observation.readyDomMs = elapsed;
          requestAnimationFrame(() => {
            observation.paintOpportunityMs = performance.now() - observation.activatedAt;
          });
        } else if (elapsed < 5000) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }, { capture: true, once: true });
  }, destination);
  await page.getByTestId(`drawer-v2-destination-${destination}`).click();
  await expect(page.getByTestId("drawer-v2")).toHaveCount(0);
  await expect(page.getByTestId(`${destination}-page`)).toBeVisible();
  await page.waitForFunction(() =>
    (window as typeof window & { interactionObservation?: { paintOpportunityMs: number | null } })
      .interactionObservation?.paintOpportunityMs != null
  );
  return page.evaluate(() => (window as typeof window & {
    interactionObservation: { route: string; activatedAt: number; drawerGoneMs: number; readyDomMs: number; paintOpportunityMs: number };
  }).interactionObservation);
}

test.describe("Android navigation CSS and browser diagnostic", () => {
  test.setTimeout(90_000);

  test("ordinary drawer effects fit the 103 ms budget without entrance staggering", async ({ page }, testInfo) => {
    await openPhone(page, "no-preference");
    await openMenu(page);
    const durations = await page.evaluate(() => {
      const seconds = (value: string) => value.split(",").map(part => parseFloat(part) * 1000);
      return Array.from(document.querySelectorAll(
        '[data-testid="drawer-v2"], [data-testid="drawer-v2-backdrop"], [data-nav-button="drawer"], [data-nav-button="drawer"] > span'
      )).map(element => {
        const style = getComputedStyle(element);
        return {
          element: element.getAttribute("data-testid") ?? element.tagName,
          transitionMs: Math.max(...seconds(style.transitionDuration)) + Math.max(...seconds(style.transitionDelay)),
          animationMs: style.animationName === "none" ? 0 : Math.max(...seconds(style.animationDuration)) + Math.max(...seconds(style.animationDelay)),
        };
      });
    });
    await testInfo.attach("finite-css-durations.json", { body: JSON.stringify(durations, null, 2), contentType: "application/json" });
    await testInfo.attach("drawer.png", { body: await page.screenshot(), contentType: "image/png" });
    for (const item of durations) {
      expect.soft(item.transitionMs, `${item.element} transition`).toBeLessThanOrEqual(budgetMs);
      expect.soft(item.animationMs, `${item.element} entrance`).toBeLessThanOrEqual(budgetMs);
    }
  });

  test("the theme veil retains its opacity animation during an atomic palette switch", async ({ page }, testInfo) => {
    await openPhone(page, "no-preference");
    await openMenu(page);
    await page.getByTestId("drawer-v2-theme-toggle").evaluate(button => {
      button.addEventListener("click", () => {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const veil = document.querySelector("[data-theme-transition-veil]");
          const style = veil ? getComputedStyle(veil) : null;
          (window as typeof window & { themeVeilObservation?: unknown }).themeVeilObservation = {
            present: Boolean(veil),
            property: style?.transitionProperty ?? null,
            duration: style?.transitionDuration ?? null,
          };
        }));
      }, { capture: true, once: true });
    });
    await page.getByTestId("drawer-v2-theme-toggle").click();
    await page.waitForFunction(() => "themeVeilObservation" in window);
    const observation = await page.evaluate(() => (window as typeof window & {
      themeVeilObservation: { present: boolean; property: string | null; duration: string | null };
    }).themeVeilObservation);
    await testInfo.attach("theme-veil-css.json", { body: JSON.stringify(observation), contentType: "application/json" });
    expect(observation.present).toBe(true);
    expect(observation.property).toBe("opacity");
    expect(parseFloat(observation.duration ?? "0")).toBeGreaterThan(0);
    await expect(page.locator("[data-theme-transition-veil]")).toHaveCount(0);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "ink");
  });

  test("the Android theme fade reserves time within the finite interaction budget", async ({ page }, testInfo) => {
    await openPhone(page, "no-preference");
    await openMenu(page);
    await page.getByTestId("drawer-v2-theme-toggle").evaluate(button => {
      button.addEventListener("click", () => {
        const phases: Record<string, number> = {};
        const observation = { phases, complete: false };
        (window as typeof window & { themeFadeObservation?: typeof observation }).themeFadeObservation = observation;
        const observer = new MutationObserver(() => {
          const veil = document.querySelector("[data-theme-transition-veil]");
          for (const phase of ["enter", "release"]) {
            if (veil?.classList.contains(`theme-transition-veil--${phase}`)) {
              phases[phase] = Math.max(...getComputedStyle(veil).transitionDuration.split(",").map(value => parseFloat(value) * 1000));
            }
          }
          if (!veil && phases.enter !== undefined) {
            observation.complete = true;
            observer.disconnect();
          }
        });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
      }, { capture: true, once: true });
    });
    await page.getByTestId("drawer-v2-theme-toggle").click();
    await page.waitForFunction(() => (window as typeof window & {
      themeFadeObservation?: { complete: boolean };
    }).themeFadeObservation?.complete);
    const phases = await page.evaluate(() => (window as typeof window & {
      themeFadeObservation: { phases: Record<string, number> };
    }).themeFadeObservation.phases);
    await testInfo.attach("theme-finite-css-budget.json", { body: JSON.stringify(phases), contentType: "application/json" });
    expect(phases.enter).toBeGreaterThan(0);
    expect(phases.release).toBeGreaterThan(0);
    expect(phases.enter + phases.release).toBeLessThanOrEqual(budgetMs);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "ink");
  });

  for (const motion of ["no-preference", "reduce"] as const) {
    test(`${motion}: first and warm visits preserve five destinations and release menu ownership`, async ({ page }, testInfo) => {
      const pageErrors: string[] = [];
      page.on("pageerror", error => pageErrors.push(error.message));
      await openPhone(page, motion);
      const observations = [];
      for (const visit of ["first", "warm"]) {
        for (const destination of destinations) {
          await openMenu(page);
          observations.push({ visit, ...await observeDestination(page, destination) });
          await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
        }
      }
      await testInfo.attach("browser-dom-timings.json", {
        body: JSON.stringify({
          method: "Chromium CSS branch; click to DOM and next rAF opportunity, not native screen presentation",
          motion, observations,
        }, null, 2), contentType: "application/json",
      });
      expect(pageErrors).toEqual([]);
      await openMenu(page);
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("drawer-v2")).toHaveCount(0);
      await expect(page.getByTestId("nav-v2-open-drawer")).toBeFocused();
    });
  }

  for (const language of ["ar", "he"] as const) {
    test(`${language}: large text keeps drawer controls inside the safe viewport`, async ({ page }, testInfo) => {
      await openPhone(page, "no-preference", language);
      await page.getByTestId("settings-module-card-appearance").click();
      const textSize = page.getByTestId("settings-v2-text-size-field").getByRole("slider");
      await textSize.focus();
      await textSize.press("End");
      await expect(textSize).toHaveValue("6");
      await page.getByTestId("nav-v2-open-drawer").click();
      const drawer = page.getByTestId("drawer-v2");
      await expect(drawer).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      for (const destination of destinations) {
        const control = page.getByTestId(`drawer-v2-destination-${destination}`);
        await control.scrollIntoViewIfNeeded();
        const bounds = await control.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.width).toBeGreaterThanOrEqual(44);
        expect(bounds!.height).toBeGreaterThanOrEqual(44);
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
        expect(bounds!.y).toBeGreaterThanOrEqual(0);
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
      }
      await testInfo.attach(`drawer-${language}-large-text.png`, { body: await page.screenshot(), contentType: "image/png" });
      await page.keyboard.press("Escape");
      await expect(drawer).toHaveCount(0);
      await expect(page.getByTestId("nav-v2-open-drawer")).toBeFocused();
    });
  }
});
