#!/usr/bin/env node
"use strict";

/**
 * Static guard for the ZenFlow best-practices implied requirements gate.
 *
 * This does not decide whether a task is complete. It verifies that the repo
 * keeps the upstream gate documented, wired into agent instructions, and wired
 * into CI/drift checks so hidden platform requirements cannot silently vanish.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const DOC = "docs/ai/BEST_PRACTICES_IMPLIED_REQUIREMENTS_GATE.md";
const failures = [];
let passCount = 0;

const REQUIRED_STANDARD_REFERENCES = [
  "https://developer.android.com/docs/quality-guidelines/core-app-quality",
  "https://developer.android.com/develop/ui/compose/system/icon_design_adaptive",
  "https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Define_app_icons",
  "https://web.dev/learn/pwa/web-app-manifest",
  "https://developer.apple.com/design/human-interface-guidelines/app-icons",
  "https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/best-practices",
  "https://www.w3.org/TR/WCAG22/",
  "https://web.dev/articles/vitals",
  "https://owasp.org/www-project-application-security-verification-standard/",
  "https://mas.owasp.org/MASVS/",
  "https://playwright.dev/docs/best-practices",
  "https://testing-library.com/docs/guiding-principles/",
];

function abs(file) {
  return path.join(ROOT, file);
}

function read(file) {
  const target = abs(file);
  if (!fs.existsSync(target)) {
    failures.push(`${file} is missing`);
    return "";
  }
  return fs.readFileSync(target, "utf8").replace(/\r\n/g, "\n");
}

function requireIncludes(file, snippets) {
  const source = read(file);
  if (!source) return;

  for (const snippet of snippets) {
    if (!source.includes(snippet)) {
      failures.push(`${file} is missing required best-practices token: ${snippet}`);
    } else {
      passCount += 1;
    }
  }
}

function requireRegex(file, regex, label) {
  const source = read(file);
  if (!source) return;

  if (!regex.test(source)) {
    failures.push(`${file} is missing required best-practices pattern: ${label}`);
  } else {
    passCount += 1;
  }
}

function main() {
  requireIncludes(DOC, [
    "Best Practices Implied Requirements Gate",
    "Activation Rule",
    "Explicit Requirements",
    "Implied Requirements",
    "Platform Matrix",
    "Standards Map",
    "Acceptance Evidence",
    "Popup Question Rule",
    "Implied Work Ledger",
    "UNVERIFIED Ledger",
    "Best Practices Packet",
    "Дополнительно по подразумеваемому:",
    "Logo And Visual Asset Addendum",
    "Completion Integration",
    "Web/PWA",
    "Android",
    "iOS",
    "Desktop",
    "Accessibility",
    "Performance",
    "Security And Privacy",
    "Release And Operations",
    ...REQUIRED_STANDARD_REFERENCES,
  ]);

  requireRegex(
    DOC,
    /Platform Matrix:\n\| Surface \| Status \| Reason \| Evidence \|[\s\S]*UNVERIFIED Ledger:/,
    "Best Practices Packet keeps platform matrix before UNVERIFIED ledger",
  );

  requireIncludes("AGENTS.md", [
    "Best Practices Implied Requirements Gate",
    DOC,
    "npm run check:best-practices",
    "Explicit Requirements",
    "Implied Requirements",
    "Platform Matrix",
    "Дополнительно по подразумеваемому:",
    "popup",
    "UNVERIFIED",
  ]);

  requireIncludes("docs/ai/TASK_COMPLETION_PROTOCOL.md", [
    DOC,
    "Best Practices Packet",
    "implied requirements",
  ]);

  requireIncludes("docs/DEFINITION_OF_DONE.md", [
    DOC,
    "npm run check:best-practices",
  ]);

  requireIncludes("docs/RELEASE_CHECKLIST.md", [
    DOC,
    "npm run check:best-practices",
    "Best Practices Packet",
  ]);

  requireIncludes("package.json", [
    '"check:best-practices": "node scripts/check-best-practices-gate.cjs"',
    "npm run check:best-practices",
  ]);

  requireIncludes(".github/workflows/deploy.yml", [
    "Check best-practices implied requirements gate",
    "npm run check:best-practices",
  ]);

  requireIncludes(".github/workflows/drift-checks.yml", [
    "best-practices-gate",
    "npm run check:best-practices",
  ]);

  requireIncludes("scripts/__tests__/best-practices-gate-contract.test.ts", [
    DOC,
    "REQUIRED_STANDARD_REFERENCES",
    "best-practices-gate",
  ]);

  requireIncludes("scripts/check-agent-context.mjs", [
    "assertBestPracticesGateContract",
    DOC,
    "check:best-practices",
  ]);

  requireIncludes("scripts/check-task-completion-protocol.cjs", [
    DOC,
    "Best Practices Packet",
  ]);

  if (failures.length > 0) {
    console.error("[best-practices-gate] FAIL");
    console.error("");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    console.error("");
    console.error("Fix: restore the implied-requirements gate document, package script, and CI/drift/doc wiring.");
    process.exit(1);
  }

  console.log(`[best-practices-gate] PASS - ${passCount} invariants verified.`);
}

main();
