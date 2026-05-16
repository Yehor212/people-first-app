import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function extractPortalCore(source: string): string {
  const start = source.indexOf('data-testid="v1-v2-portal-orb-core"');
  const end = source.indexOf("</motion.span>", start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("canonical orb invariant", () => {
  it("keeps every state-of-mind entry surface on ValenceOrb or MiniValenceOrb", () => {
    const canonicalSurfaces = [
      {
        file: "src/pages/nav-v2/OrbPageSteps.tsx",
        required: ["ValenceOrb", "MiniValenceOrb", 'transitionProfile="v1-soft"'],
      },
      {
        file: "src/components/state-of-mind/StateOfMindModal.tsx",
        required: ["ValenceOrb"],
      },
      {
        file: "src/components/tabs/HomeTab.tsx",
        required: ["MiniValenceOrb"],
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
        file: "src/components/navigation-v2/ClassicPortalLink.tsx",
        required: ["MiniValenceOrb"],
      },
      {
        file: "src/components/tabs/PreviewPortal.tsx",
        required: ["MiniValenceOrb", 'data-testid="v1-v2-portal-orb-core"'],
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

  it("does not put a manual icon back inside the V1 to V2 portal orb core", () => {
    const source = readSource("src/components/tabs/PreviewPortal.tsx");
    const portalCore = extractPortalCore(source);

    expect(portalCore).toContain("<MiniValenceOrb");
    expect(portalCore).not.toContain("<Sparkles");
    expect(portalCore).not.toContain("<svg");
  });

  it("blocks non-canonical CSS mini-orbs in the valence label chip", () => {
    const sliderSource = readSource("src/components/state-of-mind/ValenceSlider.tsx");
    const sliderCss = readSource("src/components/state-of-mind/ValenceSlider.css");

    expect(sliderSource).not.toContain("som-valence-chip__orb");
    expect(sliderCss).not.toContain("som-valence-chip__orb");
    expect(sliderCss).not.toContain("som-valence-chip-orb-drift");
  });

  it("keeps MiniValenceOrb as the canonical ambient wrapper over ValenceOrb", () => {
    const source = readSource("src/components/state-of-mind/MiniValenceOrb.tsx");

    expect(source).toContain("<ValenceOrb");
    expect(source).toContain("ambientValence");
    expect(source).toContain("setInterval");
    expect(source).not.toContain("<svg");
  });

  it("forces explicit webgl orb surfaces through a real WebGL first canvas", () => {
    const source = readSource("src/components/state-of-mind/ValenceOrb.tsx");

    expect(source).toContain("forceCanonicalWebGL");
    expect(source).toContain("createOrbGL2");
    expect(source).toContain("createOrbGL");
    expect(source).toContain("if (mode === 'webgl') return true");
    expect(source).toContain("if (!glRenderer) {");
  });

  it("keeps canonical orb canvases paint-contained to avoid route-level render stalls", () => {
    const source = readSource("src/components/state-of-mind/ValenceOrb.tsx");

    expect(source).toContain("c.style.contain = 'strict'");
    expect(source).toContain("c.style.transform = 'translateZ(0)'");
    expect(source).toContain("contain: 'layout paint style'");
    expect(source).toContain("isolation: 'isolate'");
    expect(source).toContain("willChange: 'transform'");
  });

  it("defers canonical WebGL upgrades until mini-orbs are actually visible", () => {
    const source = readSource("src/components/state-of-mind/ValenceOrb.tsx");

    expect(source).toContain("function hasViewportIntersection");
    expect(source).toContain("rect.bottom > 0");
    expect(source).toContain("rect.top < viewportHeight");
    expect(source).toContain("webglUpgradePendingUntilVisible");
    expect(source).toContain("startWebGLUpgradeWhenVisible");
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

  it("keeps the canonical orb guard wired into local and CI checks", () => {
    expect(existsSync(resolve(process.cwd(), "scripts/check-canonical-orbs.mjs"))).toBe(true);

    const packageJson = readSource("package.json");
    const preCommit = readSource(".husky/pre-commit");
    const deployWorkflow = readSource(".github/workflows/deploy.yml");
    const v2DeployWorkflow = readSource(".github/workflows/deploy-v2-preview.yml");

    expect(packageJson).toContain('"check:canonical-orbs": "node scripts/check-canonical-orbs.mjs"');
    expect(packageJson).toContain("npm run check:canonical-orbs && npx tsx scripts/check-visual-guards.ts");
    expect(preCommit).toContain("node scripts/check-canonical-orbs.mjs");
    expect(deployWorkflow).toContain("npm run check:canonical-orbs");
    expect(v2DeployWorkflow).toContain("npm run check:canonical-orbs");
  });
});
