import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

import { primeZenflowV2, v2RoutePath } from "./helpers/zenflowV2State";

const OUTPUT_DIR = path.resolve(process.cwd(), "output/playwright/orb-reduced-motion-static");
const LOCAL_PRODUCTION_PREVIEW =
  process.env.CI === "true" && process.env.ZENFLOW_PLAYWRIGHT_USE_LOCAL_SERVER === "true";
const ORB_SOURCES = [
  "src/components/state-of-mind/ValenceOrb.tsx",
  "src/components/state-of-mind/orbShader.frag",
  "src/components/state-of-mind/orbShader.ts",
  "src/components/state-of-mind/orbWebGpu.ts",
  "src/components/state-of-mind/orbWorker.ts",
  "src/lib/motion/components/Bloom.tsx",
] as const;

type StaticProbeSample = {
  source: string;
  size: number;
  renderedValence: number;
  time: number;
  motionPhase: number;
  noisePhase: number;
  pulsePhase: number;
  breathPhase: number;
};

type StaticProbeWindow = Window & {
  __zenOrbClockProbeSink?: (sample: StaticProbeSample) => void;
  __zenOrbStaticProof?: StaticProbeSample[];
  __zenOrbContinuityProof?: {
    gapsMs: number[];
    initialCanvas: HTMLCanvasElement;
    intervalId: number;
    lastCanvas: HTMLCanvasElement | null;
    missingSince: number | null;
    observer: MutationObserver;
    removals: number;
    replacements: number;
  };
};

async function decode(buffer: Buffer) {
  return sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

function currentSourceSha256() {
  return createHash("sha256")
    .update(ORB_SOURCES.map((source) => readFileSync(source)).join("\n"))
    .digest("hex");
}

function currentBuildIdentity() {
  const indexPath = path.resolve(process.cwd(), "dist/index.html");
  const index = readFileSync(indexPath);
  const mainHref = index.toString("utf8").match(/<script[^>]+src="([^"]+\.js)"/)?.[1];
  if (!mainHref) throw new Error("Current production main bundle is missing");
  const mainPath = path.resolve(
    process.cwd(),
    "dist",
    new URL(mainHref, "https://zenflow.test/").pathname
      .replace(/^\/people-first-app\//, "")
      .replace(/^\//, ""),
  );
  return {
    indexSha256: createHash("sha256").update(index).digest("hex"),
    mainHref,
    mainSha256: createHash("sha256").update(readFileSync(mainPath)).digest("hex"),
  };
}

async function readHeroSamples(page: Page) {
  return page.evaluate(() =>
    ((window as StaticProbeWindow).__zenOrbStaticProof ?? []).filter(
      (sample) => sample.size >= 200,
    ),
  );
}

function expectFrozenPhases(
  frozen: StaticProbeSample,
  resumed: StaticProbeSample,
) {
  expect(resumed.time).toBeCloseTo(frozen.time, 8);
  expect(resumed.motionPhase).toBeCloseTo(frozen.motionPhase, 8);
  expect(resumed.noisePhase).toBeCloseTo(frozen.noisePhase, 8);
  expect(resumed.pulsePhase).toBeCloseTo(frozen.pulsePhase, 8);
  expect(resumed.breathPhase).toBeCloseTo(frozen.breathPhase, 8);
  expect(resumed.renderedValence).toBeCloseTo(frozen.renderedValence, 8);
}

test("reduced-motion worker healthcheck preserves the selected orb pixel-for-pixel", async ({
  page,
}, testInfo) => {
  test.skip(
    !LOCAL_PRODUCTION_PREVIEW,
    "Reduced-motion pixel proof requires a local production preview of the current worktree",
  );
  const distIndex = path.resolve(process.cwd(), "dist/index.html");
  expect(existsSync(distIndex)).toBe(true);
  expect(statSync(distIndex).mtimeMs).toBeGreaterThanOrEqual(
    Math.max(...ORB_SOURCES.map((source) => statSync(source).mtimeMs)),
  );

  await page.setViewportSize({ width: 449, height: 698 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const win = window as StaticProbeWindow;
    win.__zenOrbStaticProof = [];
    win.__zenOrbClockProbeSink = (sample) => {
      win.__zenOrbStaticProof?.push(sample);
    };
  });
  await primeZenflowV2(page, {
    language: "en",
    theme: "paper",
    user: { id: "orb-reduced-motion-static", name: "Orb Static Proof" },
  });

  const route = new URL(v2RoutePath("orb", { layout: "phone" }), "https://zenflow.test/");
  route.searchParams.set("orbClockProbe", "true");
  await page.goto(`${route.pathname.slice(1)}${route.search}`, {
    waitUntil: "domcontentloaded",
  });

  const hero = page.getByTestId("orb-page-hero");
  await expect(hero).toBeVisible({ timeout: 30_000 });
  const canvas = hero.locator("canvas[data-orb-renderer-tier='webgl-worker']").first();
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await expect(canvas).toHaveAttribute("data-orb-visual-ready", "true", { timeout: 30_000 });

  const slider = page.getByRole("slider").first();
  await slider.focus();
  await page.keyboard.press("End");
  await expect(slider).toHaveAttribute("aria-valuenow", "6");
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const samples = (window as StaticProbeWindow).__zenOrbStaticProof ?? [];
          return [...samples]
            .reverse()
            .find((sample) => sample.source === "webgl-worker")?.renderedValence ?? null;
        }),
      { timeout: 12_000 },
    )
    .toBe(1);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const beforeBuffer = await canvas.screenshot({
    animations: "allow",
    path: path.join(OUTPUT_DIR, "before-healthcheck.png"),
  });
  const samplesAtBefore = (await readHeroSamples(page)).slice(-6);
  const sampleCountBefore = await page.evaluate(
    () => (window as StaticProbeWindow).__zenOrbStaticProof?.length ?? 0,
  );

  await page.waitForTimeout(5_500);
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as StaticProbeWindow).__zenOrbStaticProof?.length ?? 0,
        ),
      { timeout: 3_000 },
    )
    .toBeGreaterThan(sampleCountBefore);
  const afterBuffer = await canvas.screenshot({
    animations: "allow",
    path: path.join(OUTPUT_DIR, "after-healthcheck.png"),
  });
  const samplesAtAfter = (await readHeroSamples(page)).slice(-6);

  const before = await decode(beforeBuffer);
  const after = await decode(afterBuffer);
  expect(after.info.width).toBe(before.info.width);
  expect(after.info.height).toBe(before.info.height);
  expect(after.info.channels).toBe(before.info.channels);

  let changedChannels = 0;
  let maximumDifference = 0;
  let differenceSum = 0;
  for (let index = 0; index < before.data.length; index += 1) {
    const difference = Math.abs(before.data[index] - after.data[index]);
    if (difference !== 0) changedChannels += 1;
    maximumDifference = Math.max(maximumDifference, difference);
    differenceSum += difference;
  }

  const report = {
    afterSha256: createHash("sha256").update(after.data).digest("hex"),
    beforeSha256: createHash("sha256").update(before.data).digest("hex"),
    changedChannelFraction: changedChannels / before.data.length,
    changedChannels,
    height: before.info.height,
    maxChannelDifference: maximumDifference,
    meanChannelDifference: differenceSum / before.data.length,
    sampleCountAfter: await page.evaluate(
      () => (window as StaticProbeWindow).__zenOrbStaticProof?.length ?? 0,
    ),
    sampleCountBefore,
    samplesAtAfter,
    samplesAtBefore,
    sourceSha256: currentSourceSha256(),
    width: before.info.width,
  };
  writeFileSync(path.join(OUTPUT_DIR, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(
    path.join(OUTPUT_DIR, `report-repeat-${testInfo.repeatEachIndex}.json`),
    `${JSON.stringify(report, null, 2)}\n`,
  );

  expect(report.changedChannels).toBe(0);
  expect(report.maxChannelDifference).toBe(0);
  expect(report.beforeSha256).toBe(report.afterSha256);
});

test("animation preference changes preserve one continuously painted canonical canvas", async ({
  page,
}) => {
  test.skip(
    !LOCAL_PRODUCTION_PREVIEW,
    "Preference continuity proof requires a local production preview of the current worktree",
  );
  test.setTimeout(60_000);
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`);
  });

  await page.setViewportSize({ width: 449, height: 698 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    const win = window as StaticProbeWindow;
    win.__zenOrbStaticProof = [];
    win.__zenOrbClockProbeSink = (sample) => {
      win.__zenOrbStaticProof?.push(sample);
    };
  });
  await primeZenflowV2(page, {
    language: "en",
    theme: "paper",
    user: { id: "orb-motion-preference", name: "Orb Preference Proof" },
  });

  const route = new URL(v2RoutePath("orb", { layout: "phone" }), "https://zenflow.test/");
  route.searchParams.set("orbClockProbe", "true");
  await page.goto(`${route.pathname.slice(1)}${route.search}`, {
    waitUntil: "domcontentloaded",
  });

  const hero = page.getByTestId("orb-page-hero");
  await expect(hero).toBeVisible({ timeout: 30_000 });
  const canvas = hero.locator("canvas[data-orb-renderer-tier]").first();
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await expect(canvas).toHaveAttribute("data-orb-visual-ready", "true", { timeout: 30_000 });
  const stableTier = await canvas.getAttribute("data-orb-renderer-tier");
  expect(stableTier).toMatch(/^(webgpu-main|webgl-main|webgl-worker)$/);

  const slider = page.getByRole("slider").first();
  await slider.focus();
  await page.keyboard.press("End");
  await expect(slider).toHaveAttribute("aria-valuenow", "6");
  await expect
    .poll(async () => {
      const sample = (await readHeroSamples(page)).at(-1);
      return sample ? Math.abs(sample.renderedValence - 1) : 99;
    }, { timeout: 12_000 })
    .toBeLessThanOrEqual(0.04);

  await page.evaluate(() => {
    const heroNode = document.querySelector<HTMLElement>("[data-testid='orb-page-hero']");
    const initialCanvas = heroNode?.querySelector<HTMLCanvasElement>(
      "canvas[data-orb-renderer-tier]",
    );
    if (!heroNode || !initialCanvas) throw new Error("Canonical hero canvas is missing");
    const state: NonNullable<StaticProbeWindow["__zenOrbContinuityProof"]> = {
      gapsMs: [],
      initialCanvas,
      intervalId: 0,
      lastCanvas: initialCanvas,
      missingSince: null,
      observer: null as unknown as MutationObserver,
      removals: 0,
      replacements: 0,
    };
    const check = () => {
      const current = heroNode.querySelector<HTMLCanvasElement>("canvas[data-orb-renderer-tier]");
      const now = performance.now();
      if (!current) {
        state.missingSince ??= now;
        return;
      }
      if (state.missingSince !== null) {
        state.gapsMs.push(now - state.missingSince);
        state.missingSince = null;
      }
      if (state.lastCanvas && state.lastCanvas !== current) state.replacements += 1;
      state.lastCanvas = current;
    };
    state.observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const removed of record.removedNodes) {
          if (removed === initialCanvas || (removed instanceof Element && removed.contains(initialCanvas))) {
            state.removals += 1;
          }
        }
      }
      check();
    });
    state.observer.observe(heroNode, { childList: true, subtree: true });
    state.intervalId = window.setInterval(check, 4);
    (window as StaticProbeWindow).__zenOrbContinuityProof = state;
  });

  const setInAppAnimations = async (enabled: boolean) => {
    await page.evaluate((animations) => {
      const preference = { reduceMotion: !animations };
      localStorage.setItem("zenflow_reduce_motion", JSON.stringify(preference));
      window.dispatchEvent(
        new CustomEvent("zenflow-motion-preference-change", { detail: preference }),
      );
    }, enabled);
  };

  const freezeAndResume = async (
    disable: () => Promise<void>,
    enable: () => Promise<void>,
  ) => {
    const countBeforeDisable = (await readHeroSamples(page)).length;
    await disable();
    await expect.poll(async () => (await readHeroSamples(page)).length, { timeout: 5_000 })
      .toBeGreaterThan(countBeforeDisable);
    await page.waitForTimeout(200);
    const frozenSamples = await readHeroSamples(page);
    const frozen = frozenSamples.at(-1);
    if (!frozen) throw new Error("Reduced-motion frame was not rendered");
    let frozenCount = frozenSamples.length;
    await page.waitForTimeout(180);
    const stableFrozenSamples = await readHeroSamples(page);
    expect(stableFrozenSamples.length).toBeLessThanOrEqual(frozenCount + 1);
    frozenCount = stableFrozenSamples.length;
    const stableFrozen = stableFrozenSamples.at(-1);
    if (!stableFrozen) throw new Error("Reduced-motion stable frame was not captured");

    await enable();
    await expect.poll(async () => (await readHeroSamples(page)).length, { timeout: 5_000 })
      .toBeGreaterThan(frozenCount);
    const resumedSamples = await readHeroSamples(page);
    const firstResumed = resumedSamples[frozenCount];
    if (!firstResumed) throw new Error("First resumed frame was not captured");
    expectFrozenPhases(stableFrozen, firstResumed);

    await page.waitForTimeout(300);
    const laterSamples = (await readHeroSamples(page)).slice(frozenCount);
    const maxClockStep = laterSamples.slice(1).reduce(
      (maximum, sample, index) => Math.max(maximum, sample.time - laterSamples[index].time),
      0,
    );
    expect(maxClockStep).toBeLessThanOrEqual(0.050_001);
    return { firstResumed, frozen: stableFrozen, maxClockStep };
  };

  const inApp = await freezeAndResume(
    () => setInAppAnimations(false),
    () => setInAppAnimations(true),
  );
  const operatingSystem = await freezeAndResume(
    () => page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" }),
    () => page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" }),
  );

  const continuity = await page.evaluate(() => {
    const state = (window as StaticProbeWindow).__zenOrbContinuityProof;
    if (!state) throw new Error("Continuity monitor is missing");
    window.clearInterval(state.intervalId);
    state.observer.disconnect();
    const current = document.querySelector<HTMLCanvasElement>(
      "[data-testid='orb-page-hero'] canvas[data-orb-renderer-tier]",
    );
    return {
      connected: state.initialCanvas.isConnected,
      gapsMs: state.gapsMs,
      removals: state.removals,
      replacements: state.replacements,
      sameCanvas: current === state.initialCanvas,
      tier: current?.dataset.orbRendererTier ?? null,
    };
  });
  expect(continuity).toMatchObject({
    connected: true,
    gapsMs: [],
    removals: 0,
    replacements: 0,
    sameCanvas: true,
    tier: stableTier,
  });
  await expect(hero.locator("canvas[data-orb-renderer-tier='canvas2d']")).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(failedRequests).toEqual([]);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(
    path.join(OUTPUT_DIR, "preference-continuity.json"),
    `${JSON.stringify({
      build: currentBuildIdentity(),
      continuity,
      generatedAt: new Date().toISOString(),
      inApp,
      operatingSystem,
      sourceSha256: currentSourceSha256(),
    }, null, 2)}\n`,
  );
});
