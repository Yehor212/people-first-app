#!/usr/bin/env node
/**
 * Canonical orb invariant guard.
 *
 * The state-of-mind orb family is visually frozen:
 * - full-size surfaces render through ValenceOrb;
 * - compact/sidebar/portal/diary surfaces render through MiniValenceOrb;
 * - no SVG/icon/CSS/manual mini-orb may replace those canonical renderers.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".css"]);
const TEST_FILE_PATTERNS = [
  `${path.sep}__tests__${path.sep}`,
  ".test.",
  ".spec.",
];

const REQUIRED_SURFACES = [
  {
    file: "src/components/state-of-mind/ValenceOrb.tsx",
    required: [
      "forceCanonicalWebGL",
      "isDebugCanvasFallbackAllowed",
      "renderer === 'webgpu'",
      "rendererOverride === 'webgpu'",
      "createOrbWebGPUAsync",
      "createOrbGL2Async",
      "createOrbGLAsync",
      "if (mode === 'webgpu') return true",
      "if (mode === 'webgl') return true",
      "canUseCanonicalCanvasRecovery",
      "const canUseCanonicalCanvasRecovery = !forceCanonicalWebGL || debugCanvasFallbackAllowed",
      "data-orb-renderer-policy={renderer}",
    ],
    forbidden: [
      "held-on-canvas",
      "renderInitialWebGLFrame",
      "renderForcedWebGLFirstPaint",
      "markFirstPaintCanvas",
      "orbFirstPaintCanvas",
      "data-orb-first-paint-canvas",
      "forced-canvas2d-prepaint",
      "forceCanonicalWebGL && ctx2d",
      "fallbackCanvas = forceCanonicalWebGL",
      "valence-orb-first-paint-fallback",
      "createFirstPaintFallbackStyle",
      "createOrbGL2(activeCanvas)",
      "createOrbGL(gl1Canvas)",
      "PHONE_FORCED_WEBGL_CANVAS",
    ],
  },
  {
    file: "src/components/state-of-mind/MiniValenceOrb.tsx",
    required: [
      "import { ValenceOrb",
      "<ValenceOrb",
      'transitionProfile = "v1-soft"',
      'renderer = "webgpu"',
      "MINI_VALENCE_IDLE_CANONICAL_VALENCE",
      "const displayValence = hasEntry ? valence : MINI_VALENCE_IDLE_CANONICAL_VALENCE",
    ],
    forbidden: ["<svg", "Sparkles", "OrbLottie", "setInterval", "setAmbientValence"],
  },
  {
    file: "src/components/state-of-mind/CompactValenceOrb.tsx",
    required: ["MiniValenceOrb", "@deprecated"],
    forbidden: ["<svg", "Sparkles", "OrbLottie"],
  },
  {
    file: "src/pages/nav-v2/OrbPageSteps.tsx",
    required: ["ValenceOrb", "MiniValenceOrb", 'renderer="webgpu"'],
    requiredAny: [
      ['transitionProfile="v1-soft"', 'transitionProfile="input-soft"'],
    ],
  },
  {
    file: "src/components/state-of-mind/StateOfMindModal.tsx",
    required: ["ValenceOrb", 'renderer="webgpu"'],
  },
  {
    file: "src/components/tabs/HomeTab.tsx",
    required: ["MiniValenceOrb"],
  },
  {
    file: "src/components/tabs/PreviewPortal.tsx",
    required: ["MiniValenceOrb", 'data-testid="v1-v2-portal-orb-core"'],
  },
  {
    file: "src/components/navigation-v2/ClassicPortalLink.tsx",
    required: ["MiniValenceOrb", "classic-portal"],
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
    file: "src/features/journal/DiaryMiniOrb.tsx",
    required: ["MiniValenceOrb"],
    forbidden: ["<svg", "Sparkles", "OrbLottie"],
  },
  {
    file: "src/features/journal/DiaryEmptyCanvas.tsx",
    required: ["MiniValenceOrb"],
  },
  {
    file: "src/features/journal/MemoryPortalCanvas.tsx",
    required: ["MiniValenceOrb"],
  },
  {
    file: "src/components/diary/TypingDynamicsMirror.tsx",
    required: ["MiniValenceOrb"],
    forbidden: ["<svg", "Sparkles", "OrbLottie"],
  },
];

const ORB_SLOT_RULES = [
  {
    file: "src/components/tabs/PreviewPortal.tsx",
    anchor: 'data-testid="v1-v2-portal-orb-core"',
    end: "</motion.span>",
    required: ["<MiniValenceOrb"],
    forbidden: ["<Sparkles", "<svg", "OrbLottie", "HeartPulse"],
  },
  {
    file: "src/components/navigation-v2/ClassicPortalLink.tsx",
    anchor: 'data-testid={`${testId}-orb`}',
    end: "</span>",
    required: ["<MiniValenceOrb"],
    forbidden: ["<Sparkles", "<svg", "OrbLottie"],
  },
];

const BANNED_NON_TEST_SNIPPETS = [
  {
    snippet: "som-valence-chip__orb",
    reason: "the valence label chip must not reintroduce a CSS mini-orb",
  },
  {
    snippet: "som-valence-chip-orb-drift",
    reason: "the valence label chip must not reintroduce CSS orb drift",
  },
  {
    snippet: "MoodOrbPicker",
    reason: "discrete mood-orb pickers are retired in favor of the canonical ValenceOrb slider",
  },
];

function relative(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, "/");
}

function readRelative(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", "dist", "coverage", ".git"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
      continue;
    }
    if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function isTestLike(file) {
  return TEST_FILE_PATTERNS.some((pattern) => file.includes(pattern));
}

function findLine(source, snippet) {
  const index = source.indexOf(snippet);
  if (index < 0) return 1;
  return source.slice(0, index).split("\n").length;
}

function pushViolation(violations, file, detail, snippet) {
  violations.push({
    file,
    detail,
    line: snippet ? findLine(readRelative(file), snippet) : 1,
  });
}

function checkRequiredSurfaces(violations) {
  for (const surface of REQUIRED_SURFACES) {
    const source = readRelative(surface.file);
    for (const required of surface.required) {
      if (!source.includes(required)) {
        pushViolation(
          violations,
          surface.file,
          `missing canonical token: ${required}`,
          required,
        );
      }
    }
    for (const forbidden of surface.forbidden ?? []) {
      if (source.includes(forbidden)) {
        pushViolation(
          violations,
          surface.file,
          `forbidden alternate orb primitive: ${forbidden}`,
          forbidden,
        );
      }
    }
    for (const options of surface.requiredAny ?? []) {
      if (!options.some((option) => source.includes(option))) {
        pushViolation(
          violations,
          surface.file,
          `missing one canonical token from: ${options.join(" | ")}`,
          options[0],
        );
      }
    }
  }
}

function extractSlot(source, rule) {
  const start = source.indexOf(rule.anchor);
  if (start < 0) return "";
  const end = source.indexOf(rule.end, start);
  if (end < 0) return source.slice(start);
  return source.slice(start, end + rule.end.length);
}

function checkOrbSlots(violations) {
  for (const rule of ORB_SLOT_RULES) {
    const source = readRelative(rule.file);
    const slot = extractSlot(source, rule);
    if (!slot) {
      pushViolation(violations, rule.file, `missing protected orb slot: ${rule.anchor}`, rule.anchor);
      continue;
    }

    for (const required of rule.required) {
      if (!slot.includes(required)) {
        pushViolation(
          violations,
          rule.file,
          `protected orb slot must contain ${required}`,
          rule.anchor,
        );
      }
    }
    for (const forbidden of rule.forbidden) {
      if (slot.includes(forbidden)) {
        pushViolation(
          violations,
          rule.file,
          `protected orb slot contains forbidden alternate primitive: ${forbidden}`,
          forbidden,
        );
      }
    }
  }
}

function checkBannedSnippets(violations) {
  for (const file of walk(SRC)) {
    if (isTestLike(file)) continue;
    const source = fs.readFileSync(file, "utf8");
    const rel = relative(file);
    for (const banned of BANNED_NON_TEST_SNIPPETS) {
      if (source.includes(banned.snippet)) {
        violations.push({
          file: rel,
          line: findLine(source, banned.snippet),
          detail: `${banned.reason}: ${banned.snippet}`,
        });
      }
    }
  }
}

function main() {
  const violations = [];
  checkRequiredSurfaces(violations);
  checkOrbSlots(violations);
  checkBannedSnippets(violations);

  if (violations.length > 0) {
    console.error("\nCANONICAL ORB GUARD FAILED\n");
    for (const violation of violations) {
      console.error(`- ${violation.file}:${violation.line} ${violation.detail}`);
    }
    console.error("\nOnly ValenceOrb and MiniValenceOrb may render state-of-mind orb visuals.\n");
    process.exit(1);
  }

  console.log("PASS canonical orb guard: ValenceOrb/MiniValenceOrb remain the only state-of-mind orb renderers.");
}

main();
