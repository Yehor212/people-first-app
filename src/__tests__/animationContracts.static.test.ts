/**
 * Animation drift contract — guards the unified easing vocabulary, the
 * repo's "no ad-hoc spring configs / no JS-driven infinite animations"
 * rules, the entrance-duration budget, the CSS engine floor, the
 * compositor budget, the emotional-safety calm contract, and the
 * pre-React reduce-motion boot.
 *
 * See ANIMATION_SOFT_MOTION_PLAN.md (P2/P3/P4) and ARCHITECTURE.md
 * "Motion Budget (zenMotion tokens)". Hardened after the 10-agent review
 * (Roles 3+8): regex-tolerant matching, comment stripping, and a
 * scan-all waiver model so new JS loops cannot slip in unlisted files.
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

/** Strip line and block comments so doc text cannot trip the guards. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const JS_LOOP_PATTERN = /repeat\s*:\s*Infinity/;

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
  join("src", "components", "stories", "elements", "StarField.tsx"),
];

describe("CSS-owned ambient loops", () => {
  it.each(CSS_LOOP_MIGRATED_FILES)(
    "%s has no JS-driven infinite loops (repeat: Infinity)",
    (file) => {
      const source = stripComments(readFileSync(file, "utf8"));
      expect(source).not.toMatch(JS_LOOP_PATTERN);
    },
  );
});

/**
 * Tracked debt: files that still contain JS-driven infinite loops.
 * Functional (breath pacing, timers) and share-story surfaces pending
 * dedicated review — this list may only SHRINK. A new file with
 * `repeat: Infinity` fails the suite; removing a file from the list is
 * always welcome and also requires updating the test.
 */
const JS_LOOP_WAIVERS = [
  join("src", "components", "ChallengeModal.tsx"),
  join("src", "components", "EntryGateBackdrop.tsx"),
  join("src", "components", "StreakBanner.tsx"),
  join("src", "components", "breathing-exercise", "ActiveBreathingView.tsx"),
  join("src", "components", "breathing-exercise", "BreathingExercise.tsx"),
  join("src", "components", "breathing-exercise", "CompactCard.tsx"),
  join("src", "components", "breathing-exercise", "CompletionView.tsx"),
  join("src", "components", "breathing-exercise", "PatternSelector.tsx"),
  join("src", "components", "challenges", "CreateChallengeView.tsx"),
  join("src", "components", "focus-timer", "CosmicBackground.tsx"),
  join("src", "components", "focus-timer", "TimerControls.tsx"),
  join("src", "components", "focus-timer", "TimerRing.tsx"),
  join("src", "components", "habit-hub", "HabitDetailSheet.tsx"),
  join("src", "components", "hyperfocus", "HyperfocusBackground.tsx"),
  join("src", "components", "hyperfocus", "HyperfocusMode.tsx"),
  join("src", "components", "hyperfocus", "HyperfocusTimerDisplay.tsx"),
  join("src", "components", "schedule", "ScheduleTimeline.tsx"),
  join("src", "components", "schedule", "ScheduleVisuals.tsx"),
  join("src", "components", "stories", "slides", "AchievementSlide.tsx"),
  join("src", "components", "stories", "slides", "FocusSlide.tsx"),
  join("src", "components", "stories", "slides", "HabitsSlide.tsx"),
  join("src", "components", "stories", "slides", "IntroSlide.tsx"),
  join("src", "components", "stories", "slides", "MoodSlide.tsx"),
  join("src", "components", "stories", "slides", "OutroSlide.tsx"),
  join("src", "components", "stories", "slides", "StreakSlide.tsx"),
  join("src", "components", "stories", "slides", "SummarySlide.tsx"),
  join("src", "components", "weekly-insights-card", "WeeklyInsightsCard.tsx"),
  join("src", "features", "journal", "JournalEntryEditor.tsx"),
  join("src", "features", "journal", "JournalEntryList.tsx"),
  join("src", "features", "journal", "JournalHubShell.tsx"),
  join("src", "features", "journal", "JournalLockScreen.tsx"),
  join("src", "features", "journal", "MemoryPortalCanvas.tsx"),
  join("src", "features", "journal", "StreakCelebration.tsx"),
  join("src", "lib", "motion", "breathe.ts"),
];

describe("JS-loop waiver registry", () => {
  it("no file outside the waiver list gains a JS infinite loop", () => {
    const waivers = new Set([...JS_LOOP_WAIVERS, ...CSS_LOOP_MIGRATED_FILES]);
    const newOffenders = files.filter((file) => {
      if (waivers.has(file)) return false;
      return JS_LOOP_PATTERN.test(stripComments(readFileSync(file, "utf8")));
    });
    expect(newOffenders).toEqual([]);
  });

  it("the waiver list only shrinks (no new entries)", () => {
    const withLoops = files.filter((file) =>
      JS_LOOP_PATTERN.test(stripComments(readFileSync(file, "utf8"))),
    );
    const unexpected = withLoops.filter(
      (file) => !new Set(JS_LOOP_WAIVERS).has(file),
    );
    expect(unexpected).toEqual([]);
    expect(withLoops.length).toBeLessThanOrEqual(JS_LOOP_WAIVERS.length);
  });
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
      const source = stripComments(readFileSync(file, "utf8"));
      const durations = [...source.matchAll(/duration\s*:\s*([\d.]+)/g)].map((m) =>
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
 * Compositor budget (10-agent review, Role 7): infinite loops must only
 * animate compositor-safe properties (transform/opacity). box-shadow,
 * filter, and background loops repaint every frame on the main thread.
 */
describe("zen-loop compositor budget", () => {
  it("animates no box-shadow/filter/background inside zen-ambient @keyframes", () => {
    const source = readFileSync(join("src", "index.css"), "utf8");
    const libraryStart = source.indexOf("Zen ambient loops");
    const libraryEnd = source.indexOf(".animate-zen-loop-fade,", libraryStart);
    const keyframesSection = source.slice(libraryStart, libraryEnd);
    const offenders = keyframesSection.match(/box-shadow:|(?<![-\w])filter:|background:/g) ?? [];
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

/**
 * Boot-time reduced-motion contract (10-agent review, Role 10): the
 * in-app preference must be applied before React hydrates, otherwise
 * users see an animation flash on every cold boot.
 */
describe("pre-React reduce-motion bootstrap", () => {
  it("applies the in-app preference via runtime-perf-bootstrap.js", () => {
    const bootstrap = readFileSync(join("src", "runtime-perf-bootstrap.js"), "utf8");
    expect(bootstrap).toContain("zenflow_reduce_motion");
    expect(bootstrap).toContain("dataset.reduceMotion");
  });

  it("has a pre-React CSS kill-switch for data-reduce-motion", () => {
    const source = readFileSync(join("src", "index.css"), "utf8");
    expect(source).toContain('html[data-reduce-motion="true"] [class*="animate-"]');
  });
});
