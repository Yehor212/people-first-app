import { expect, test, type Page } from "@playwright/test";

import {
  primeZenflowV2,
  type ZenflowV2Theme,
  v2RoutePath,
} from "./helpers/zenflowV2State";

test.describe.configure({ mode: "serial", timeout: 90_000 });

async function openJournalEditor(page: Page) {
  const launcher = page
    .getByTestId("journal-entry-main-fab")
    .or(page.getByRole("button", { name: /^New entry$/i }))
    .or(page.getByTestId("journal-capture-launcher"))
    .first();
  await expect(launcher).toBeVisible({ timeout: 30_000 });
  const testId = await launcher.getAttribute("data-testid");
  await launcher.click();
  if (testId === "journal-entry-main-fab") {
    await page.getByTestId("journal-fab-action-new-entry").click();
  }
  await expect(page.locator("[contenteditable='true']")).toBeVisible({
    timeout: 20_000,
  });
}

for (const scenario of [
  { theme: "paper", expectedVariant: "night" },
  { theme: "ink", expectedVariant: "day" },
  { theme: "oled", expectedVariant: "day" },
] as const satisfies ReadonlyArray<{
  theme: ZenflowV2Theme;
  expectedVariant: "night" | "day";
}>) {
  test(`plays the ${scenario.expectedVariant} Atelier after a committed ${scenario.theme} save`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "getBattery", {
        configurable: true,
        value: async () => ({
          addEventListener: () => undefined,
          charging: true,
          level: 1,
          removeEventListener: () => undefined,
        }),
      });
    });
    await primeZenflowV2(page, {
      clearStorage: true,
      language: "en",
      theme: scenario.theme,
    });
    await page.setViewportSize({ width: 399, height: 869 });
    await page.goto(
      `${v2RoutePath("diary", { layout: "phone" })}&perfGuard=off`,
      {
        waitUntil: "domcontentloaded",
      },
    );
    await expect(page.getByTestId("diary-page")).toBeVisible({
      timeout: 30_000,
    });
    await page.evaluate(() => {
      delete document.documentElement.dataset.runtimePerf;
      localStorage.setItem(
        "zenflow_reduce_motion",
        JSON.stringify({ reduceMotion: false }),
      );
      sessionStorage.removeItem("zenflow-runtime-perf-guard");
      localStorage.removeItem("zenflow-runtime-perf-device-guard");
      window.dispatchEvent(
        new CustomEvent("zenflow-motion-preference-change", {
          detail: { reduceMotion: false },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("zenflow:runtime-perf-mode", {
          detail: { mode: "normal" },
        }),
      );
    });
    await openJournalEditor(page);

    const editor = page.locator("[contenteditable='true']");
    const runtimePreload = page.waitForResponse(
      (response) =>
        response.ok() &&
        response.url().includes("/assets/lottie_light-") &&
        response.url().endsWith(".js"),
      { timeout: 10_000 },
    );
    await editor.fill(`Atelier integration proof for ${scenario.theme}.`);
    await runtimePreload;
    const tgsResponses: string[] = [];
    page.on("response", (response) => {
      if (
        response.ok() &&
        response.url().includes(`atelier-v12-3-${scenario.expectedVariant}`) &&
        response.url().endsWith(".tgs")
      ) {
        tgsResponses.push(response.url());
      }
    });
    const hostObservation = page.evaluate(
      () =>
        new Promise<{
          ariaHidden: string | null;
          hostBottom: number;
          hostLeft: number;
          hostRight: number;
          hostTop: number;
          playback: string | undefined;
          playerHeight: number;
          playerWidth: number;
          pointerEvents: string;
          sawStaticFallback: boolean;
          variant: string | undefined;
          viewportHeight: number;
          viewportWidth: number;
        }>((resolve, reject) => {
          let sawStaticFallback = false;
          const observeHost = () => {
            const host = document.querySelector<HTMLElement>(
              "[data-testid='journal-save-ceremony']",
            );
            if (
              host?.querySelector(
                "[data-testid='journal-save-ceremony-static']",
              )
            ) {
              sawStaticFallback = true;
            }
            const player = host?.lastElementChild;
            if (!host || !player || !host.querySelector("svg")) return false;
            const hostRect = host.getBoundingClientRect();
            const playerRect = player.getBoundingClientRect();
            window.clearTimeout(timeout);
            observer.disconnect();
            resolve({
              ariaHidden: host.getAttribute("aria-hidden"),
              hostBottom: hostRect.bottom,
              hostLeft: hostRect.left,
              hostRight: hostRect.right,
              hostTop: hostRect.top,
              playback: host.dataset.playback,
              playerHeight: playerRect.height,
              playerWidth: playerRect.width,
              pointerEvents: window.getComputedStyle(host).pointerEvents,
              sawStaticFallback,
              variant: host.dataset.variant,
              viewportHeight: window.innerHeight,
              viewportWidth: window.innerWidth,
            });
            return true;
          };
          const timeout = window.setTimeout(() => {
            observer.disconnect();
            reject(new Error("Animated ceremony host was not observed."));
          }, 10_000);
          const observer = new MutationObserver(observeHost);
          observer.observe(document.body, { childList: true, subtree: true });
          observeHost();
        }),
    );
    await page
      .getByRole("button", {
        name: /^(save|зберегти|guardar|speichern|保存|حفظ|שמור)$/i,
      })
      .click();

    const proof = await hostObservation;
    const host = page.getByTestId("journal-save-ceremony");
    await expect(editor).toBeHidden({ timeout: 3_000 });
    await expect(host).toBeVisible({ timeout: 3_000 });
    // Capture after the first rendered frames, not the transient empty SVG shell.
    await page.waitForTimeout(250);
    const veilProof = await page
      .getByTestId("journal-save-ceremony-veil")
      .evaluate((veil) => {
        const style = window.getComputedStyle(veil);
        return {
          backdropFilter: style.backdropFilter,
          backgroundImage: style.backgroundImage,
          motion: veil.dataset.motion,
          opacity: Number.parseFloat(style.opacity),
          pointerEvents: style.pointerEvents,
          tone: veil.dataset.tone,
          webkitBackdropFilter: style.getPropertyValue(
            "-webkit-backdrop-filter",
          ),
        };
      });
    expect(proof.ariaHidden).toBe("true");
    expect(proof.playback).toBe("lottie");
    expect(proof.pointerEvents).toBe("none");
    expect(proof.sawStaticFallback).toBe(false);
    expect(proof.variant).toBe(scenario.expectedVariant);
    expect(veilProof.tone).toBe(scenario.expectedVariant);
    expect(veilProof.motion).toBe("animated");
    expect(veilProof.pointerEvents).toBe("none");
    expect(veilProof.opacity).toBeGreaterThan(0.25);
    expect(veilProof.backgroundImage).toContain("radial-gradient");
    expect(veilProof.backdropFilter).toBe("none");
    expect(["", "none"]).toContain(veilProof.webkitBackdropFilter);
    expect(proof.playerWidth).toBeGreaterThanOrEqual(240);
    expect(proof.playerWidth).toBeLessThanOrEqual(320);
    expect(proof.playerHeight).toBe(proof.playerWidth);
    expect(proof.hostLeft).toBeGreaterThanOrEqual(0);
    expect(proof.hostTop).toBeGreaterThanOrEqual(0);
    expect(proof.hostRight).toBeLessThanOrEqual(proof.viewportWidth);
    expect(proof.hostBottom).toBeLessThanOrEqual(proof.viewportHeight);
    expect(tgsResponses).toHaveLength(1);

    await page.screenshot({
      path: testInfo.outputPath(
        `atelier-${scenario.theme}-${scenario.expectedVariant}.png`,
      ),
    });
    await expect(host).toBeHidden({ timeout: 5_000 });
  });
}

test("cancels a queued idle preload when Reduce Motion becomes active", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    type IdleHarness = {
      flush: () => void;
      pending: Map<number, () => void>;
    };
    const pending = new Map<number, () => void>();
    let nextId = 1;
    Object.defineProperty(window, "requestIdleCallback", {
      configurable: true,
      value: (callback: IdleRequestCallback) => {
        const id = nextId;
        nextId += 1;
        pending.set(id, () =>
          callback({
            didTimeout: false,
            timeRemaining: () => 50,
          }),
        );
        return id;
      },
    });
    Object.defineProperty(window, "cancelIdleCallback", {
      configurable: true,
      value: (id: number) => {
        pending.delete(id);
      },
    });
    const harness: IdleHarness = {
      flush: () => {
        const callbacks = Array.from(pending.values());
        pending.clear();
        callbacks.forEach((callback) => callback());
      },
      pending,
    };
    Object.defineProperty(window, "__journalSaveCeremonyIdleHarness", {
      configurable: true,
      value: harness,
    });
  });
  await primeZenflowV2(page, {
    clearStorage: true,
    language: "en",
    theme: "paper",
  });
  const animationRuntimeResponses: string[] = [];
  page.on("response", (response) => {
    if (
      response.url().endsWith(".tgs") ||
      /\/assets\/(?:lottie_light|fflate)-/i.test(response.url())
    ) {
      animationRuntimeResponses.push(response.url());
    }
  });
  await page.goto(v2RoutePath("diary", { layout: "phone" }), {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId("diary-page")).toBeVisible({
    timeout: 30_000,
  });
  await openJournalEditor(page);
  await page
    .locator("[contenteditable='true']")
    .fill("Atelier dynamic Reduce Motion proof.");
  await page.waitForFunction(() => {
    type IdleHarness = { pending: Map<number, () => void> };
    return (
      window as typeof window & {
        __journalSaveCeremonyIdleHarness: IdleHarness;
      }
    ).__journalSaveCeremonyIdleHarness.pending.size > 0;
  });
  await page.evaluate(() => {
    localStorage.setItem(
      "zenflow_reduce_motion",
      JSON.stringify({ reduceMotion: true }),
    );
    window.dispatchEvent(new Event("zenflow-motion-preference-change"));
  });
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    type IdleHarness = { flush: () => void };
    (
      window as typeof window & {
        __journalSaveCeremonyIdleHarness: IdleHarness;
      }
    ).__journalSaveCeremonyIdleHarness.flush();
  });
  await page.waitForTimeout(300);

  expect(animationRuntimeResponses).toEqual([]);
});

test("uses the static redock proof without loading TGS when reduced motion is active", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await primeZenflowV2(page, {
    clearStorage: true,
    language: "en",
    theme: "paper",
  });
  await page.setViewportSize({ width: 399, height: 869 });
  const animationRuntimeResponses: string[] = [];
  page.on("response", (response) => {
    if (
      response.url().endsWith(".tgs") ||
      /\/assets\/(?:lottie_light|fflate)-/i.test(response.url())
    ) {
      animationRuntimeResponses.push(response.url());
    }
  });
  await page.goto(v2RoutePath("diary", { layout: "phone" }), {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId("diary-page")).toBeVisible({
    timeout: 30_000,
  });
  await openJournalEditor(page);
  await page
    .locator("[contenteditable='true']")
    .fill("Atelier reduced motion integration proof.");
  const hostObservation = page.evaluate(
    () =>
      new Promise<{
        ariaHidden: string | null;
        hasStaticImage: boolean;
        playback: string | undefined;
        variant: string | undefined;
      }>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          observer.disconnect();
          reject(new Error("Static ceremony host was not observed."));
        }, 10_000);
        const observer = new MutationObserver(() => {
          const host = document.querySelector<HTMLElement>(
            "[data-testid='journal-save-ceremony']",
          );
          if (!host || host.dataset.playback !== "static") return;
          window.clearTimeout(timeout);
          observer.disconnect();
          resolve({
            ariaHidden: host.getAttribute("aria-hidden"),
            hasStaticImage: Boolean(
              host.querySelector(
                "[data-testid='journal-save-ceremony-static']",
              ),
            ),
            playback: host.dataset.playback,
            variant: host.dataset.variant,
          });
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }),
  );
  await page
    .getByRole("button", {
      name: /^(save|зберегти|guardar|speichern|保存|حفظ|שמור)$/i,
    })
    .click();

  const observed = await hostObservation;
  expect(observed).toEqual({
    ariaHidden: "true",
    hasStaticImage: true,
    playback: "static",
    variant: "night",
  });
  expect(animationRuntimeResponses).toEqual([]);
  const host = page.getByTestId("journal-save-ceremony");
  await expect(host).toBeHidden({ timeout: 3_000 });
});

test("uses the static redock proof without loading TGS on critically low battery", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "getBattery", {
      configurable: true,
      value: async () => ({
        addEventListener: () => undefined,
        charging: false,
        level: 0.1,
        removeEventListener: () => undefined,
      }),
    });
  });
  await primeZenflowV2(page, {
    clearStorage: true,
    language: "en",
    theme: "paper",
  });
  await page.setViewportSize({ width: 399, height: 869 });
  const animationRuntimeResponses: string[] = [];
  page.on("response", (response) => {
    if (
      response.url().endsWith(".tgs") ||
      /\/assets\/(?:lottie_light|fflate)-/i.test(response.url())
    ) {
      animationRuntimeResponses.push(response.url());
    }
  });
  await page.goto(v2RoutePath("diary", { layout: "phone" }), {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId("diary-page")).toBeVisible({
    timeout: 30_000,
  });
  await openJournalEditor(page);
  await page
    .locator("[contenteditable='true']")
    .fill("Atelier low-battery fallback proof.");
  const hostObservation = page.evaluate(
    () =>
      new Promise<{
        ariaHidden: string | null;
        hasStaticImage: boolean;
        playback: string | undefined;
        variant: string | undefined;
      }>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          observer.disconnect();
          reject(new Error("Low-battery static ceremony host was not observed."));
        }, 10_000);
        const observer = new MutationObserver(() => {
          const host = document.querySelector<HTMLElement>(
            "[data-testid='journal-save-ceremony']",
          );
          if (!host || host.dataset.playback !== "static") return;
          window.clearTimeout(timeout);
          observer.disconnect();
          resolve({
            ariaHidden: host.getAttribute("aria-hidden"),
            hasStaticImage: Boolean(
              host.querySelector(
                "[data-testid='journal-save-ceremony-static']",
              ),
            ),
            playback: host.dataset.playback,
            variant: host.dataset.variant,
          });
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }),
  );
  await page
    .getByRole("button", {
      name: /^(save|зберегти|guardar|speichern|保存|حفظ|שמור)$/i,
    })
    .click();

  const observed = await hostObservation;
  expect(observed).toEqual({
    ariaHidden: "true",
    hasStaticImage: true,
    playback: "static",
    variant: "night",
  });
  expect(animationRuntimeResponses).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("atelier-low-battery-static.png"),
  });
  const host = page.getByTestId("journal-save-ceremony");
  await expect(host).toBeHidden({ timeout: 3_000 });
});

test("uses the static redock proof without loading TGS while runtime performance is strained", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "getBattery", {
      configurable: true,
      value: async () => ({
        addEventListener: () => undefined,
        charging: true,
        level: 1,
        removeEventListener: () => undefined,
      }),
    });
  });
  await primeZenflowV2(page, {
    clearStorage: true,
    language: "en",
    theme: "ink",
  });
  await page.setViewportSize({ width: 399, height: 869 });
  const animationRuntimeResponses: string[] = [];
  page.on("response", (response) => {
    if (
      response.url().endsWith(".tgs") ||
      /\/assets\/(?:lottie_light|fflate)-/i.test(response.url())
    ) {
      animationRuntimeResponses.push(response.url());
    }
  });
  await page.goto(v2RoutePath("diary", { layout: "phone" }), {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId("diary-page")).toBeVisible({
    timeout: 30_000,
  });
  await page.evaluate(() => {
    const snapshot = {
      activatedAt: Date.now(),
      duration: 2_000,
      mode: "strained",
      reason: "save-ceremony-browser-proof",
      route: window.location.pathname,
      version: 1,
    };
    document.documentElement.dataset.runtimePerf = "strained";
    sessionStorage.setItem(
      "zenflow-runtime-perf-guard",
      JSON.stringify(snapshot),
    );
    window.dispatchEvent(
      new CustomEvent("zenflow:runtime-perf-mode", {
        detail: snapshot,
      }),
    );
  });
  await openJournalEditor(page);
  await page
    .locator("[contenteditable='true']")
    .fill("Atelier runtime-performance fallback proof.");
  const hostObservation = page.evaluate(
    () =>
      new Promise<{
        ariaHidden: string | null;
        hasStaticImage: boolean;
        playback: string | undefined;
        variant: string | undefined;
      }>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          observer.disconnect();
          reject(new Error("Runtime-performance static ceremony host was not observed."));
        }, 10_000);
        const observer = new MutationObserver(() => {
          const host = document.querySelector<HTMLElement>(
            "[data-testid='journal-save-ceremony']",
          );
          if (!host || host.dataset.playback !== "static") return;
          window.clearTimeout(timeout);
          observer.disconnect();
          resolve({
            ariaHidden: host.getAttribute("aria-hidden"),
            hasStaticImage: Boolean(
              host.querySelector(
                "[data-testid='journal-save-ceremony-static']",
              ),
            ),
            playback: host.dataset.playback,
            variant: host.dataset.variant,
          });
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }),
  );
  await page
    .getByRole("button", {
      name: /^(save|зберегти|guardar|speichern|保存|حفظ|שמור)$/i,
    })
    .click();

  const observed = await hostObservation;
  expect(observed).toEqual({
    ariaHidden: "true",
    hasStaticImage: true,
    playback: "static",
    variant: "day",
  });
  expect(animationRuntimeResponses).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("atelier-runtime-strained-static.png"),
  });
  const host = page.getByTestId("journal-save-ceremony");
  await expect(host).toBeHidden({ timeout: 3_000 });
});
