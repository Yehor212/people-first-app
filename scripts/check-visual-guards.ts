#!/usr/bin/env npx tsx
/**
 * Visual Regression Guard - CI lint gate
 *
 * Blocks commits that introduce visual regressions:
 *   1. backdrop-filter without -webkit-backdrop-filter (Safari/iOS)
 *   2. Animations missing prefers-reduced-motion / motion-safe guards
 *   3. Theme-blind patterns (light-only colors without dark: variant)
 *
 * Usage: npx tsx scripts/check-visual-guards.ts
 * Exit: 0 = pass, 1 = violations found
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.join(__dirname, "../src");

export interface Violation {
  file: string;
  line: number;
  rule: string;
  detail: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
}

export interface MotionGuardOptions {
  hasGlobalMotionGate?: boolean;
}

const TEST_FILE_PATTERNS = [
  /[/\\]__tests__[/\\]/,
  /\.test\.[cm]?[jt]sx?$/,
  /\.spec\.[cm]?[jt]sx?$/,
];

export function isTestLikeFile(file: string): boolean {
  return TEST_FILE_PATTERNS.some((pattern) => pattern.test(file));
}

function walk(dir: string, exts: string[]): string[] {
  const result: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", "dist", ".git", "coverage"].includes(entry.name)) continue;
      result.push(...walk(full, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      result.push(full);
    }
  }
  return result;
}

// Rule 1: Backdrop-filter without -webkit

function checkBackdropFilter(file: string, lines: string[]): Violation[] {
  const violations: Violation[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes("backdropFilter") && !line.includes("WebkitBackdropFilter")) {
      const ctx = lines.slice(Math.max(0, i - 3), i + 4).join("\n");
      if (!ctx.includes("WebkitBackdropFilter")) {
        violations.push({
          file,
          line: i + 1,
          rule: "backdrop-webkit",
          detail: "backdropFilter without WebkitBackdropFilter",
          severity: "HIGH",
        });
      }
    }

    if (file.endsWith(".css") && /\bbackdrop-filter\s*:/.test(line) && !/-webkit-backdrop-filter/.test(line)) {
      const ctx = lines.slice(Math.max(0, i - 2), i + 3).join("\n");
      if (!ctx.includes("-webkit-backdrop-filter")) {
        violations.push({
          file,
          line: i + 1,
          rule: "backdrop-webkit",
          detail: "backdrop-filter without -webkit-backdrop-filter",
          severity: "HIGH",
        });
      }
    }

    if (/\[-?backdrop-filter:/.test(line) && !/\[-webkit-backdrop-filter:/.test(line)) {
      const ctx = lines.slice(Math.max(0, i - 1), i + 2).join("\n");
      if (!ctx.includes("-webkit-backdrop-filter")) {
        violations.push({
          file,
          line: i + 1,
          rule: "backdrop-webkit",
          detail: "Tailwind [backdrop-filter:] without [-webkit-backdrop-filter:]",
          severity: "HIGH",
        });
      }
    }
  }
  return violations;
}

// Rule 2: Animations without motion-safe guards

const MOTION_EXEMPT = ["index.css", "tailwind.config", "state-of-mind/", "canvas/ValenceOrb"];

export function hasGlobalMotionGate(lines: string[]): boolean {
  const content = lines.join("\n");
  return (
    content.includes("<MotionConfig") &&
    content.includes("reducedMotion=") &&
    (content.includes('"always"') || content.includes("'always'"))
  );
}

export function checkMotionSafe(
  file: string,
  lines: string[],
  options: MotionGuardOptions = {},
): Violation[] {
  if (isTestLikeFile(file)) return [];
  if (MOTION_EXEMPT.some((entry) => file.includes(entry))) return [];

  const violations: Violation[] = [];
  const content = lines.join("\n");

  if (file.endsWith(".css")) {
    for (let i = 0; i < lines.length; i++) {
      if (/@keyframes\s+/.test(lines[i]) && !content.includes("prefers-reduced-motion")) {
        const name = lines[i].match(/@keyframes\s+(\S+)/)?.[1] || "unknown";
        violations.push({
          file,
          line: i + 1,
          rule: "motion-safe",
          detail: `@keyframes "${name}" without prefers-reduced-motion`,
          severity: "CRITICAL",
        });
        break;
      }
    }
  }

  if (file.endsWith(".tsx")) {
    const usesMotion =
      content.includes("motion.") ||
      content.includes("AnimatePresence") ||
      content.includes("animate={") ||
      content.includes("whileHover") ||
      content.includes("whileTap");

    if (usesMotion) {
      const hasGuard =
        content.includes("useReducedMotion") ||
        content.includes("reducedMotion") ||
        content.includes("prefers-reduced-motion") ||
        content.includes("prefersReducedMotion") ||
        content.includes("motionSafe") ||
        content.includes("dopamineEnabled") ||
        content.includes("useShouldAnimate") ||
        content.includes("shouldAnimate()") ||
        options.hasGlobalMotionGate === true;

      if (!hasGuard) {
        for (let i = 0; i < lines.length; i++) {
          if (/motion\.|AnimatePresence|animate=\{|whileHover|whileTap/.test(lines[i])) {
            violations.push({
              file,
              line: i + 1,
              rule: "motion-safe",
              detail: "Framer Motion without useReducedMotion or dopamineEnabled",
              severity: "MEDIUM",
            });
            break;
          }
        }
      }
    }
  }

  return violations;
}

// Rule 3: Theme-blind patterns

const THEME_PATTERNS = [
  { regex: /\bbg-white\b/, utility: "bg-", name: "bg-white" },
  { regex: /\bbg-black\b/, utility: "bg-", name: "bg-black" },
  { regex: /\bborder-white\b/, utility: "border-", name: "border-white" },
  { regex: /\bborder-black\b/, utility: "border-", name: "border-black" },
  // text-white/text-black excluded - almost always intentional on colored/gradient backgrounds
];

const THEME_EXEMPT = [
  "stories/",
  "ShareModal",
  "ShareProgress",
  "shareCards",
  "coolEmojis",
  "AuthScreen",
];

function hasDarkVariant(context: string, utility: string): boolean {
  const escapedUtility = utility.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\bdark:(?:(?:\\[[^\\]]+\\]|[\\w-]+):)*${escapedUtility}`).test(context);
}

export function isBackdropScrimContext(line: string, context: string): boolean {
  const usesTintedHardcodedColor = /\b(?:bg|border)-(?:white|black)\/\d+\b/.test(line);
  if (!usesTintedHardcodedColor) return false;

  const combined = `${line} ${context}`;
  const looksFullscreenLayer = /\b(fixed|absolute)\b/.test(combined) && /\binset-0\b/.test(combined);
  const hasBackdropSignal =
    /\b(backdrop|overlay|scrim)\b/i.test(combined) ||
    combined.includes("backdrop-blur") ||
    combined.includes("aria-hidden") ||
    combined.includes('role="presentation"') ||
    combined.includes("pointer-events-none");

  return looksFullscreenLayer && hasBackdropSignal;
}

export function checkThemeBlind(file: string, lines: string[]): Violation[] {
  if (!file.endsWith(".tsx") || isTestLikeFile(file) || THEME_EXEMPT.some((entry) => file.includes(entry))) {
    return [];
  }

  const violations: Violation[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("//") || line.trim().startsWith("*")) continue;
    if (!line.includes("className") && !line.includes("class=")) continue;

    for (const { regex, utility, name } of THEME_PATTERNS) {
      if (regex.test(line) && !hasDarkVariant(line, utility)) {
        const ctx = lines.slice(Math.max(0, i - 2), i + 3).join(" ");
        if (isBackdropScrimContext(line, ctx)) continue;
        if (!hasDarkVariant(ctx, utility)) {
          violations.push({
            file,
            line: i + 1,
            rule: "theme-blind",
            detail: `"${name}" without dark: variant`,
            severity: "MEDIUM",
          });
        }
      }
    }
  }

  return violations;
}

// Main

function main() {
  console.log("\n  VISUAL REGRESSION GUARD\n");

  const allFiles = [...walk(SRC_DIR, [".tsx", ".ts"]), ...walk(SRC_DIR, [".css"])];
  const allViolations: Violation[] = [];
  const appFile = path.join(SRC_DIR, "App.tsx");
  const globalMotionGateEnabled =
    fs.existsSync(appFile) && hasGlobalMotionGate(fs.readFileSync(appFile, "utf-8").split("\n"));

  for (const file of allFiles) {
    const lines = fs.readFileSync(file, "utf-8").split("\n");
    const rel = path.relative(path.join(__dirname, ".."), file);
    allViolations.push(
      ...checkBackdropFilter(rel, lines),
      ...checkMotionSafe(rel, lines, { hasGlobalMotionGate: globalMotionGateEnabled }),
      ...checkThemeBlind(rel, lines),
    );
  }

  const byRule = new Map<string, Violation[]>();
  for (const violation of allViolations) {
    const list = byRule.get(violation.rule) || [];
    list.push(violation);
    byRule.set(violation.rule, list);
  }

  const ruleNames: Record<string, string> = {
    "backdrop-webkit": "Backdrop-filter without -webkit (Safari/iOS)",
    "motion-safe": "Animation without prefers-reduced-motion guard",
    "theme-blind": "Theme-blind color (missing dark: variant)",
  };

  let totalCritical = 0;
  let totalHigh = 0;
  let totalMedium = 0;

  for (const [rule, violations] of byRule) {
    console.log(`  ${ruleNames[rule] || rule} (${violations.length}):`);
    for (const violation of violations.slice(0, 15)) {
      const icon =
        violation.severity === "CRITICAL" ? "X" : violation.severity === "HIGH" ? "!" : "~";
      console.log(`    ${icon}  ${violation.file}:${violation.line} — ${violation.detail}`);
    }
    if (violations.length > 15) console.log(`    ... and ${violations.length - 15} more`);

    for (const violation of violations) {
      if (violation.severity === "CRITICAL") totalCritical++;
      else if (violation.severity === "HIGH") totalHigh++;
      else totalMedium++;
    }

    console.log("");
  }

  console.log(`  ${"─".repeat(50)}`);
  console.log(
    `  Total: ${allViolations.length} (${totalCritical} critical, ${totalHigh} high, ${totalMedium} medium)`,
  );

  const blocking = allViolations.filter(
    (violation) => violation.severity === "CRITICAL" || violation.severity === "HIGH",
  );

  if (blocking.length > 0) {
    console.log(`\n  BLOCKED: ${blocking.length} critical/high violation(s) must be fixed\n`);
    process.exit(1);
  }

  if (allViolations.length > 0) {
    console.log(`\n  WARNING: ${allViolations.length} medium violation(s) (non-blocking)\n`);
  } else {
    console.log("\n  PASS: No visual regression risks detected\n");
  }

  process.exit(0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
