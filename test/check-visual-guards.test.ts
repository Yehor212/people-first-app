// @vitest-environment node

import { describe, expect, it } from "vitest";

import { checkMotionSafe, checkThemeBlind } from "../scripts/check-visual-guards";

describe("visual guard heuristics", () => {
  it("treats useShouldAnimate as a valid motion guard", () => {
    const lines = [
      "import { motion } from 'framer-motion';",
      "import { useShouldAnimate } from '@/hooks/useShouldAnimate';",
      "const animate = useShouldAnimate();",
      "<motion.div animate={animate ? { opacity: 1 } : undefined} />",
    ];

    expect(checkMotionSafe("src/components/ui/DialogMotion.tsx", lines)).toEqual([]);
  });

  it("accepts framer-motion components when the app has a global MotionConfig gate", () => {
    const lines = [
      "import { motion } from 'framer-motion';",
      "export function Example() {",
      "  return <motion.div animate={{ opacity: 1 }} whileTap={{ scale: 0.95 }} />;",
      "}",
    ];

    expect(
      checkMotionSafe("src/components/ui/DialogMotion.tsx", lines, { hasGlobalMotionGate: true }),
    ).toEqual([]);
  });

  it("ignores motion findings in test files", () => {
    const lines = [
      "import { motion } from 'framer-motion';",
      "export function Example() {",
      "  return <motion.div animate={{ opacity: 1 }} />;",
      "}",
    ];

    expect(checkMotionSafe("src/components/ui/__tests__/DialogMotion.test.tsx", lines)).toEqual(
      [],
    );
  });

  it("does not flag backdrop scrims as theme-blind surfaces", () => {
    const lines = [
      "{/* Desktop backdrop */}",
      '<div className="fixed inset-0 z-[79] bg-black/40 backdrop-blur-sm" aria-hidden="true" />',
    ];

    expect(checkThemeBlind("src/components/ChangelogPanel.tsx", lines)).toEqual([]);
  });

  it("accepts hover-only dark variants for interactive controls", () => {
    const lines = [
      '<button className="rounded-lg hover:bg-white/10 dark:hover:bg-white/10 text-white/70" />',
    ];

    expect(checkThemeBlind("src/components/canvas/EmotionPanel.tsx", lines)).toEqual([]);
  });

  it("accepts arbitrary selector dark variants", () => {
    const lines = [
      '<div className="[&_code]:bg-black/5 dark:[&_code]:bg-black/5 [&_code]:rounded" />',
    ];

    expect(checkThemeBlind("src/features/journal/JournalEntryEditor.tsx", lines)).toEqual([]);
  });

  it("still flags hardcoded surfaces that are not scrims", () => {
    const lines = ['<div className="rounded-xl bg-white/20 border border-white/20" />'];

    const violations = checkThemeBlind("src/components/SurfaceCard.tsx", lines);

    expect(violations).toHaveLength(2);
    expect(violations.map((violation) => violation.rule)).toEqual([
      "theme-blind",
      "theme-blind",
    ]);
  });
});
