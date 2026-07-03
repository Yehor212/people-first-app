import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("canonical orb invariant", () => {
  it("keeps every state-of-mind entry surface on ValenceOrb or MiniValenceOrb", () => {
    const canonicalSurfaces = [
      {
        file: "src/pages/nav-v2/OrbPageSteps.tsx",
        required: ["ValenceOrb", "MiniValenceOrb", 'transitionProfile="input-soft"'],
      },
      {
        file: "src/components/state-of-mind/StateOfMindModal.tsx",
        required: ["ValenceOrb"],
      },
      {
        file: "src/features/journal/DiaryMiniOrb.tsx",
        required: ["MiniValenceOrb"],
      },
      {
        file: "src/features/journal/DiaryEmptyCanvas.tsx",
        required: ["MiniValenceOrb"],
      },
      {
        file: "src/components/diary/TypingDynamicsMirror.tsx",
        required: ["MiniValenceOrb"],
      },
      {
        file: "src/features/journal/MemoryPortalCanvas.tsx",
        required: ["MiniValenceOrb"],
      },
      {
        file: "src/components/navigation-v2/SidebarV2.tsx",
        required: ["MiniValenceOrb"],
      },
      {
        file: "src/components/navigation-v2/DrawerV2.tsx",
        required: ["MiniValenceOrb"],
      },
      {
        file: "src/pages/DesktopDownloadPage.tsx",
        required: ["MiniValenceOrb", "getDesktopReleaseState", 'data-testid="desktop-download-page"'],
      },
      {
        file: "src/lib/desktopRelease.ts",
        required: [
          "VITE_DESKTOP_SIGNED_RELEASE_URL",
          "VITE_DESKTOP_SIGNED_RELEASE_SHA256",
          "VITE_DESKTOP_SIGNED_RELEASE_AUTHENTICODE",
          "isTrustedDesktopReleaseUrl",
        ],
      },
      {
        file: "src/components/state-of-mind/CompactValenceOrb.tsx",
        required: ["MiniValenceOrb", "@deprecated"],
      },
    ];

    for (const surface of canonicalSurfaces) {
      const source = readSource(surface.file);
      for (const required of surface.required) {
        expect(source, `${surface.file} must keep ${required}`).toContain(required);
      }
    }
  });

  it("blocks non-canonical CSS mini-orbs in the valence label chip", () => {
    const sliderSource = readSource("src/components/state-of-mind/ValenceSlider.tsx");
    const sliderCss = readSource("src/components/state-of-mind/ValenceSlider.css");

    expect(sliderSource).not.toContain("som-valence-chip__orb");
    expect(sliderCss).not.toContain("som-valence-chip__orb");
    expect(sliderCss).not.toContain("som-valence-chip-orb-drift");
  });

  it("keeps MiniValenceOrb as a stable canonical wrapper over ValenceOrb", () => {
    const source = readSource("src/components/state-of-mind/MiniValenceOrb.tsx");

    expect(source).toContain("<ValenceOrb");
    expect(source).toContain('renderer = "webgpu"');
    expect(source).toContain('renderer !== "webgl" && renderer !== "webgpu"');
    expect(source).toContain("MINI_VALENCE_IDLE_CANONICAL_VALENCE");
    expect(source).toContain("const displayValence = hasEntry ? valence : MINI_VALENCE_IDLE_CANONICAL_VALENCE");
    expect(source).not.toContain("setInterval");
    expect(source).not.toContain("setAmbientValence");
    expect(source).not.toContain("<svg");
  });

  it("keeps explicit orb surfaces on the canonical WebGPU-first upgrade path", () => {
    const source = readSource("src/components/state-of-mind/ValenceOrb.tsx");
    const miniSource = readSource("src/components/state-of-mind/MiniValenceOrb.tsx");
    const orbStepsSource = readSource("src/pages/nav-v2/OrbPageSteps.tsx");
    const stateOfMindModalSource = readSource("src/components/state-of-mind/StateOfMindModal.tsx");
    const webgpuSource = readSource("src/components/state-of-mind/orbWebGpu.ts");

    expect(miniSource).toContain('renderer = "webgpu"');
    expect(orbStepsSource).toContain('renderer="webgpu"');
    expect(stateOfMindModalSource).toContain('renderer="webgpu"');
    expect(source).toContain("forceCanonicalWebGL");
    expect(source).toContain("isDebugCanvasFallbackAllowed");
    expect(source).toContain("renderer === 'webgpu'");
    expect(source).toContain("rendererOverride === 'webgpu'");
    expect(source).toContain("createOrbWebGPUAsync");
    expect(source).toContain("createOrbGL2");
    expect(source).toContain("createOrbGL");
    expect(source).toContain("if (mode === 'webgpu') return true");
    expect(source).toContain("if (mode === 'webgl') return true");
    expect(source).toContain("if (!glRenderer) {");
    expect(source).toContain("data-orb-webgl-upgrade");
    expect(webgpuSource).toContain("navigator");
    expect(webgpuSource).toContain("requestAdapter");
    expect(webgpuSource).toContain("createRenderPipelineAsync");
    expect(webgpuSource).toContain("tier: 'webgpu'");
  });

  it("does not report expected WebGPU device disposal as a crash", () => {
    const webgpuSource = readSource("src/components/state-of-mind/orbWebGpu.ts");
    const lostHandlerStart = webgpuSource.indexOf("device.lost?.then");
    const lostRecordErrorStart = webgpuSource.indexOf("recordError(", lostHandlerStart);

    expect(webgpuSource).toContain("info?.reason === 'destroyed'");
    expect(lostHandlerStart).toBeGreaterThan(-1);
    expect(lostRecordErrorStart).toBeGreaterThan(-1);
    expect(webgpuSource.indexOf("info?.reason === 'destroyed'")).toBeLessThan(
      lostRecordErrorStart,
    );
  });

  it("blocks non-canonical CSS fallback visuals on every orb surface", () => {
    const source = readSource("src/components/state-of-mind/ValenceOrb.tsx");

    expect(source).toContain("allowsFirstPaintFallback");
    expect(source).toContain("return false");
    expect(source).not.toContain("valence-orb-first-paint-fallback");
    expect(source).not.toContain("createFirstPaintFallbackStyle");
    expect(source).not.toContain("motion-safe:animate-pulse");
    expect(source).toContain("visualReadyRef");
    expect(source).toContain("markVisualReadyRef");
    expect(source).toContain("onVisualReady");
    expect(source).toContain("revealCanonicalCanvas");
    expect(source).toContain("setProperty('opacity', '1', 'important')");
    expect(source).toContain("worker.onerror");
    expect(source).toContain("recoverFromWebGLStartupFailure");
    expect(source).toContain("upgradeToMainThreadWebGL");
    expect(source).toContain("const recoveredWithWebGL = await upgradeToMainThreadWebGL()");
  });

  it("keeps forced WebGL recovery WebGL-only while forbidding ad-hoc first-paint substitutes", () => {
    const source = readSource("src/components/state-of-mind/ValenceOrb.tsx");

    expect(source).toContain("createOrbWebGPUAsync(webgpuCanvas");
    expect(source).toContain("createOrbGL2Async(gl2Canvas");
    expect(source).toContain("markRendererTier(upgradeCanvas, result.tier === 'webgpu' ? 'webgpu-main' : 'webgl-main')");
    expect(source).toContain("canUseCanonicalCanvasRecovery");
    expect(source).toContain("const canUseCanonicalCanvasRecovery = !forceCanonicalWebGL || debugCanvasFallbackAllowed");
    expect(source).toContain("markRendererTier(activeCanvas, 'canvas2d')");
    expect(source).not.toContain("forced-canvas2d-prepaint");
    expect(source).not.toContain("forceCanonicalWebGL && ctx2d");
    expect(source).not.toContain("fallbackCanvas = forceCanonicalWebGL");
    expect(source).not.toContain("renderInitialWebGLFrame");
    expect(source).not.toContain("createOrbGL2(activeCanvas)");
    expect(source).not.toContain("createOrbGL(gl1Canvas)");
    expect(source).not.toContain("renderForcedWebGLFirstPaint");
    expect(source).not.toContain("markFirstPaintCanvas");
    expect(source).not.toContain("orbFirstPaintCanvas");
    expect(source).not.toContain("held-on-canvas");
    expect(source).toContain("markFirstPaintReadyRef");
    expect(source).toContain("onFirstPaintReady");
    expect(source).not.toContain("valence-orb-static");
    expect(source).not.toContain("lottie");
  });

  it("keeps forced WebGL tests explicit about forbidding product Canvas2D recovery", () => {
    const source = readSource("src/components/state-of-mind/__tests__/ValenceOrb.motion.test.ts");

    expect(source).toContain("renders forced WebGL surfaces from a WebGL canvas without Canvas2D prepaint");
    expect(source).toContain("does not recover forced WebGL startup failure to a non-canonical Canvas2D renderer");
    expect(source).toContain("keeps forced WebGL product surfaces WebGL-only after first-frame timeout");
    expect(source).toContain("allows Canvas2D fallback only through the explicit debug override");
    expect(source).not.toContain("recovers forced WebGL startup failure to a stable Canvas2D frame");
    expect(source).not.toContain("recovers forced WebGL first-frame timeout to Canvas2D");
    expect(source).toContain("[data-orb-renderer-tier='canvas2d']");
  });

  it("keeps canonical orb canvases paint-contained to avoid route-level render stalls", () => {
    const source = readSource("src/components/state-of-mind/ValenceOrb.tsx");

    expect(source).toContain("c.style.contain = 'strict'");
    expect(source).toContain("c.style.transform = 'translateZ(0)'");
    expect(source).toContain("contain: 'layout paint style'");
    expect(source).toContain("isolation: 'isolate'");
    expect(source).toContain("willChange: 'transform'");
  });

  it("defers canonical WebGL upgrades through IntersectionObserver without synchronous layout reads", () => {
    const source = readSource("src/components/state-of-mind/ValenceOrb.tsx");

    expect(source).not.toContain("function hasViewportIntersection");
    expect(source).not.toContain("rect.bottom > 0");
    expect(source).not.toContain("rect.top < viewportHeight");
    expect(source).toContain("isVisibleRef.current = true");
    expect(source).toContain("webglUpgradePendingUntilVisible");
    expect(source).toContain("startWebGLUpgradeWhenVisible");
    expect(source).toContain("if (!isVisibleRef.current)");
    expect(source).toContain("resolveCanonicalWebGLUpgradeScheduling");
    expect(source).toContain("MINI_WEBGL_UPGRADE_DELAY_MS");
    expect(source).toContain("MINI_WEBGL_UPGRADE_QUEUE_GAP_MS");
    expect(source).toContain("preferIdle: true");
  });

  it("keeps canonical renderer phase clocks required instead of falling back to wall-clock speed", () => {
    const rendererSource = readSource("src/components/state-of-mind/orbRenderer.ts");
    const shaderSource = readSource("src/components/state-of-mind/orbShader.ts");
    const webGpuSource = readSource("src/components/state-of-mind/orbWebGpu.ts");

    for (const source of [rendererSource, shaderSource, webGpuSource]) {
      expect(source).not.toContain("motionPhase?:");
      expect(source).not.toContain("noisePhase?:");
      expect(source).not.toContain("params.motionPhase ??");
      expect(source).not.toContain("params.noisePhase ??");
    }

    expect(rendererSource).not.toContain("const rotationPhase = params.motionPhase ??");
    expect(rendererSource).not.toContain("const noisePhase = params.noisePhase ??");
    expect(rendererSource).not.toContain("time * rotSpeed");
    expect(shaderSource).not.toContain("params.time * (0.055");
    expect(shaderSource).not.toContain("params.time * (0.85");
    expect(webGpuSource).not.toContain("params.time * (0.055");
    expect(webGpuSource).not.toContain("params.time * (0.85");
  });

  it("keeps worker WebGL shader readiness asynchronous before status checks", () => {
    const source = readSource("src/components/state-of-mind/orbWorker.ts");

    expect(source).toContain("KHR_parallel_shader_compile");
    expect(source).toContain("COMPLETION_STATUS_KHR");
    expect(source).toContain("waitForParallelCompile");
    expect(source).toContain("requestId?: string");
    expect(source).toContain("type: 'rendered'");
    const asyncStart = source.indexOf("async function buildRendererAsync");
    expect(source.indexOf("waitForParallelCompile", asyncStart)).toBeLessThan(
      source.indexOf("gl.getProgramParameter(program, gl.LINK_STATUS)", asyncStart),
    );
  });

  it("prewarms only the canonical WebGL worker pipeline after startup", () => {
    const prewarmSource = readSource("src/components/state-of-mind/canonicalOrbPrewarm.ts");
    const mainSource = readSource("src/main.tsx");

    expect(prewarmSource).toContain("new Worker(new URL(\"./orbWorker.ts\"");
    expect(prewarmSource).toContain("new OffscreenCanvas");
    expect(prewarmSource).toContain("getShapeParams");
    expect(prewarmSource).toContain("valenceToHSL");
    expect(prewarmSource).not.toContain("document.createElement(\"canvas\")");
    expect(mainSource).toContain("scheduleCanonicalOrbPrewarmAfterStartup");
    expect(mainSource).toContain("prewarmCanonicalOrbWebGL");
    expect(mainSource).toContain("orbPrewarm");
  });

  it("keeps canonical WebGL contexts desynchronized to reduce Chrome compositor stalls", () => {
    const workerSource = readSource("src/components/state-of-mind/orbWorker.ts");
    const mainSource = readSource("src/components/state-of-mind/orbShader.ts");

    expect(workerSource).toContain("desynchronized: true");
    expect(mainSource).toContain("desynchronized: true");
    expect(workerSource).toContain("antialias: false");
    expect(mainSource).toContain("antialias: false");
    expect(workerSource).toContain("powerPreference: 'default'");
    expect(mainSource).toContain("powerPreference: 'default'");
  });

  it("keeps worker WebGL rendering backpressured instead of queuing unlimited frames", () => {
    const source = readSource("src/components/state-of-mind/ValenceOrb.tsx");
    const workerSource = readSource("src/components/state-of-mind/orbWorker.ts");

    expect(source).toContain("workerRenderInFlight");
    expect(source).toContain("latestWorkerPayload");
    expect(source).toContain("flushWorkerRender");
    expect(source).toContain("requestId: ++nextWorkerRenderId");
    expect(workerSource).toContain("type: 'rendered'");
    expect(workerSource).toContain("requestId: message.requestId");
  });

  it("prevents runtime performance mode from changing canonical orb cadence or visuals", () => {
    const source = readSource("src/components/state-of-mind/ValenceOrb.tsx");

    expect(source).not.toContain("isRuntimePerformanceLimited");
    expect(source).not.toContain("WEBGL_PERFORMANCE_LIMITED_FRAME_INTERVAL");
    expect(source).toContain("return WEBGL_FRAME_INTERVAL");
  });

  it("keeps the canonical orb guard wired into local and CI checks", () => {
    expect(existsSync(resolve(process.cwd(), "scripts/check-canonical-orbs.mjs"))).toBe(true);

    const packageJson = readSource("package.json");
    const preCommit = readSource(".husky/pre-commit");
    const deployWorkflow = readSource(".github/workflows/deploy.yml");
    const v2DeployWorkflow = readSource(".github/workflows/deploy-v2-preview.yml");

    expect(packageJson).toContain('"check:canonical-orbs": "node scripts/check-canonical-orbs.mjs"');
    expect(packageJson).toContain(
      "npm run check:canonical-orbs && npm run assets:logos:check && npx tsx scripts/check-visual-guards.ts",
    );
    expect(preCommit).toContain("node scripts/check-canonical-orbs.mjs");
    expect(deployWorkflow).toContain("npm run check:canonical-orbs");
    expect(v2DeployWorkflow).toContain("npm run check:canonical-orbs");
  });
});
