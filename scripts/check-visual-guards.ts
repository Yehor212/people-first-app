#!/usr/bin/env npx tsx
/**
 * Visual Regression Guard — CI Lint Gate
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

interface Violation {
  file: string;
  line: number;
  rule: string;
  detail: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
}

function walk(dir: string, exts: string[]): string[] {
  const result: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", "dist", ".git", "coverage"].includes(entry.name)) continue;
      result.push(...walk(full, exts));
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      result.push(full);
    }
  }
  return result;
}

// ── Rule 1: Backdrop-filter without -webkit ──

function checkBackdropFilter(file: string, lines: string[]): Violation[] {
  const violations: Violation[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("backdropFilter") && !line.includes("WebkitBackdropFilter")) {
      const ctx = lines.slice(Math.max(0, i - 3), i + 4).join("\n");
      if (!ctx.includes("WebkitBackdropFilter")) {
        violations.push({ file, line: i + 1, rule: "backdrop-webkit", detail: "backdropFilter without WebkitBackdropFilter", severity: "HIGH" });
      }
    }
    if (file.endsWith(".css") && /\bbackdrop-filter\s*:/.test(line) && !/-webkit-backdrop-filter/.test(line)) {
      const ctx = lines.slice(Math.max(0, i - 2), i + 3).join("\n");
      if (!ctx.includes("-webkit-backdrop-filter")) {
        violations.push({ file, line: i + 1, rule: "backdrop-webkit", detail: "backdrop-filter without -webkit-backdrop-filter", severity: "HIGH" });
      }
    }
    if (/\[-?backdrop-filter:/.test(line) && !/\[-webkit-backdrop-filter:/.test(line)) {
      const ctx = lines.slice(Math.max(0, i - 1), i + 2).join("\n");
      if (!ctx.includes("-webkit-backdrop-filter")) {
        violations.push({ file, line: i + 1, rule: "backdrop-webkit", detail: "Tailwind [backdrop-filter:] without [-webkit-backdrop-filter:]", severity: "HIGH" });
      }
    }
  }
  return violations;
}

// ── Rule 2: Animations without motion-safe guards ──

const MOTION_EXEMPT = ["index.css", "tailwind.config", "state-of-mind/", "canvas/ValenceOrb"];

function checkMotionSafe(file: string, lines: string[]): Violation[] {
  if (MOTION_EXEMPT.some((e) => file.includes(e))) return [];
  const violations: Violation[] = [];
  const content = lines.join("\n");

  if (file.endsWith(".css")) {
    for (let i = 0; i < lines.length; i++) {
      if (/@keyframes\s+/.test(lines[i]) && !content.includes("prefers-reduced-motion")) {
        const name = lines[i].match(/@keyframes\s+(\S+)/)?.[1] || "unknown";
        violations.push({ file, line: i + 1, rule: "motion-safe", detail: `@keyframes "${name}" without prefers-reduced-motion`, severity: "CRITICAL" });
        break;
      }
    }
  }

  if (file.endsWith(".tsx")) {
    const usesMotion = content.includes("motion.") || content.includes("AnimatePresence") || content.includes("animate={") || content.includes("whileHover") || content.includes("whileTap");
    if (usesMotion) {
      const hasGuard = content.includes("useReducedMotion") || content.includes("reducedMotion") || content.includes("prefers-reduced-motion") || content.includes("prefersReducedMotion") || content.includes("motionSafe") || content.includes("dopamineEnabled");
      if (!hasGuard) {
        for (let i = 0; i < lines.length; i++) {
          if (/motion\.|AnimatePresence|animate=\{|whileHover|whileTap/.test(lines[i])) {
            violations.push({ file, line: i + 1, rule: "motion-safe", detail: "Framer Motion without useReducedMotion or dopamineEnabled", severity: "MEDIUM" });
            break;
          }
        }
      }
    }
  }
  return violations;
}

// ── Rule 3: Theme-blind patterns ──

const THEME_PATTERNS = [
  { regex: /\bbg-white\b/, needs: "dark:bg-", name: "bg-white" },
  { regex: /\bbg-black\b/, needs: "dark:bg-", name: "bg-black" },
  { regex: /\bborder-white\b/, needs: "dark:border-", name: "border-white" },
  { regex: /\bborder-black\b/, needs: "dark:border-", name: "border-black" },
  // text-white/text-black excluded — almost always intentional on colored/gradient backgrounds
];
const THEME_EXEMPT = ["stories/", "ShareModal", "ShareProgress", "shareCards", "coolEmojis", "AuthScreen"];

function checkThemeBlind(file: string, lines: string[]): Violation[] {
  if (!file.endsWith(".tsx") || THEME_EXEMPT.some((e) => file.includes(e))) return [];
  const violations: Violation[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("//") || line.trim().startsWith("*")) continue;
    if (!line.includes("className") && !line.includes("class=")) continue;
    for (const { regex, needs, name } of THEME_PATTERNS) {
      if (regex.test(line) && !line.includes(needs)) {
        const ctx = lines.slice(Math.max(0, i - 2), i + 3).join(" ");
        if (!ctx.includes(needs)) {
          violations.push({ file, line: i + 1, rule: "theme-blind", detail: `"${name}" without dark: variant`, severity: "MEDIUM" });
        }
      }
    }
  }
  return violations;
}

// ── Main ──

function main() {
  console.log("\n  VISUAL REGRESSION GUARD\n");

  const allFiles = [...walk(SRC_DIR, [".tsx", ".ts"]), ...walk(SRC_DIR, [".css"])];
  const allViolations: Violation[] = [];

  for (const file of allFiles) {
    const lines = fs.readFileSync(file, "utf-8").split("\n");
    const rel = path.relative(path.join(__dirname, ".."), file);
    allViolations.push(...checkBackdropFilter(rel, lines), ...checkMotionSafe(rel, lines), ...checkThemeBlind(rel, lines));
  }

  const byRule = new Map<string, Violation[]>();
  for (const v of allViolations) {
    const list = byRule.get(v.rule) || [];
    list.push(v);
    byRule.set(v.rule, list);
  }

  const ruleNames: Record<string, string> = {
    "backdrop-webkit": "Backdrop-filter without -webkit (Safari/iOS)",
    "motion-safe": "Animation without prefers-reduced-motion guard",
    "theme-blind": "Theme-blind color (missing dark: variant)",
  };

  let totalCritical = 0, totalHigh = 0, totalMedium = 0;

  for (const [rule, violations] of byRule) {
    console.log(`  ${ruleNames[rule] || rule} (${violations.length}):`);
    for (const v of violations.slice(0, 15)) {
      const icon = v.severity === "CRITICAL" ? "X" : v.severity === "HIGH" ? "!" : "~";
      console.log(`    ${icon}  ${v.file}:${v.line} \u2014 ${v.detail}`);
    }
    if (violations.length > 15) console.log(`    ... and ${violations.length - 15} more`);
    for (const v of violations) {
      if (v.severity === "CRITICAL") totalCritical++;
      else if (v.severity === "HIGH") totalHigh++;
      else totalMedium++;
    }
    console.log("");
  }

  console.log("  " + "\u2500".repeat(50));
  console.log(`  Total: ${allViolations.length} (${totalCritical} critical, ${totalHigh} high, ${totalMedium} medium)`);

  const blocking = allViolations.filter((v) => v.severity === "CRITICAL" || v.severity === "HIGH");
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

main();
