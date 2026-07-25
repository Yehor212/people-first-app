/**
 * Animation drift contract — guards the unified easing vocabulary and the
 * repo's "no ad-hoc spring configs / no JS-driven infinite animations" rules.
 *
 * See ANIMATION_SOFT_MOTION_PLAN.md (P2/P3) and ARCHITECTURE.md
 * "Motion Budget (zenMotion tokens)".
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = "src";

/** Files allowed to define raw easing tuples (the token source of truth). */
const TOKEN_MODULES = new Set([join("src", "lib", "motion", "easings.ts")]);

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      collectSourceFiles(full, acc);
    } else if (
      /\.(ts|tsx|css)$/.test(entry) &&
      !entry.includes(".test.") &&
      !full.includes("__tests__")
    ) {
      acc.push(full);
    }
  }
  return acc;
}

const files = collectSourceFiles(SRC_ROOT);

function findOffenders(needle: string): string[] {
  return files.filter((file) => {
    if (TOKEN_MODULES.has(file)) return false;
    return readFileSync(file, "utf8").includes(needle);
  });
}

describe("unified easing vocabulary", () => {
  it("has no hardcoded legacy emphasized curve [0.32, 0.72, 0, 1] — use easings.emphasizedDecelerate", () => {
    expect(findOffenders("0.32, 0.72, 0, 1")).toEqual([]);
  });
});

/**
 * 60fps rule (ARCHITECTURE.md "Performance & Motion"): ambient infinite
 * loops belong to CSS @keyframes, not JS-driven framer-motion `repeat`.
 * These surfaces were migrated in P3 (ANIMATION_SOFT_MOTION_PLAN.md);
 * the guard keeps them from regressing.
 */
const CSS_LOOP_MIGRATED_FILES = [
  join("src", "components", "stats", "SelectedDayPanel.tsx"),
  join("src", "components", "stats", "CalendarGrid.tsx"),
  join("src", "components", "stats", "CrystalCalendar.tsx"),
  join("src", "components", "stats", "TrophyHall.tsx"),
  join("src", "components", "stats", "WeekCrystal.tsx"),
  join("src", "components", "stats", "emotion-galaxy", "EmotionGalaxy.tsx"),
  join("src", "components", "stats", "emotion-galaxy", "Star.tsx"),
  join("src", "components", "stats", "emotion-galaxy", "OrbitingEmotion.tsx"),
  join("src", "components", "stats", "weekly-review", "WeeklyReview.tsx"),
  join("src", "components", "stats", "weekly-review", "WeeklyReviewParts.tsx"),
  join("src", "components", "AICoachChat.tsx"),
  join("src", "features", "journal", "JournalOnboardingHints.tsx"),
  join("src", "components", "stats", "DataMountains.tsx"),
  join("src", "components", "stats", "ring-detail-sheet", "RingDetailSheet.tsx"),
  join("src", "components", "stats", "ring-detail-sheet", "SparkleParticles.tsx"),
  join("src", "features", "journal", "StreakFreeze.tsx"),
  join("src", "pages", "nav-v2", "CosmicBgAdapter.tsx"),
];

describe("CSS-owned ambient loops", () => {
  it.each(CSS_LOOP_MIGRATED_FILES)(
    "%s has no JS-driven infinite loops (repeat: Infinity)",
    (file) => {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("repeat: Infinity");
    },
  );
});

/**
 * Entrance-duration budget (P4, ANIMATION_SOFT_MOTION_PLAN.md):
 * UI transitions live in the 120–400ms band (Material 3 medium, Apple HIG
 * "brief and precise"); hero draw-on moments may use up to 600ms (M3 long4).
 * Guarded files were trimmed to the budget; the contract blocks regressions.
 */
const ENTRANCE_BUDGET_FILES = [
  join("src", "components", "stats", "ZenScoreHub.tsx"),
  join("src", "components", "stats", "ring-detail-sheet", "PremiumChart.tsx"),
  join("src", "components", "stats", "weekly-review", "WeeklyReviewParts.tsx"),
  join("src", "components", "stats", "WeekCrystal.tsx"),
];

const ENTRANCE_MAX_SECONDS = 0.6;

describe("entrance-duration budget", () => {
  it.each(ENTRANCE_BUDGET_FILES)(
    "%s keeps every transition duration at or below 0.6s",
    (file) => {
      const source = readFileSync(file, "utf8");
      const durations = [...source.matchAll(/duration:\s*([\d.]+)/g)].map((m) =>
        Number.parseFloat(m[1]),
      );
      const overBudget = durations.filter((d) => d > ENTRANCE_MAX_SECONDS);
      expect(overBudget).toEqual([]);
    },
  );
});

/**
 * CSS Values 3 compatibility (10-agent review, Roles 5+10): calc()
 * multiplication/division is CSS Values 4 (Safari 16.4+, Chrome 111+) and
 * silently drops on the declared iOS 15.0 floor — the affected loops would
 * freeze. The zen-loop library must stay Level 3 (subtraction only).
 */
describe("zen-loop CSS engine floor", () => {
  it("uses no calc() multiplication/division in the zen-ambient library", () => {
    const source = readFileSync(join("src", "index.css"), "utf8");
    const libraryStart = source.indexOf("Zen ambient loops");
    const libraryEnd = source.indexOf(".animate-bounce-gentle {", libraryStart);
    const library = source.slice(libraryStart, libraryEnd);
    const offenders = library.match(/calc\([\s\S]*?\s[*/]\s[\s\S]*?\)/g) ?? [];
    expect(offenders).toEqual([]);
  });
});

/**
 * Emotional-safety contract (10-agent review, Role 2): on terrible-mood
 * days the product calms the whole UI — the zen ambient loop family must
 * be inside the mood-terrible kill-list, not only the legacy classes.
 */
describe("mood-terrible calm contract", () => {
  it("kills the zen ambient loop family on terrible-mood days", () => {
    const source = readFileSync(join("src", "index.css"), "utf8");
    expect(source).toContain('body.mood-terrible [class*="animate-zen-loop"]');
  });
});
