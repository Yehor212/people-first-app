#!/usr/bin/env node
/**
 * PreToolUse hook for Edit/Write — Law 21 Bandaid Detection Gate.
 *
 * BLOCKS edits that contain bandaid patterns (treating symptoms, not root causes).
 * Based on Law 21 Rule 2 — Bandaid Detection Checklist (6 indicators).
 *
 * Patterns detected:
 *   B1: Platform check as fix (isSafari, isAndroid, navigator.userAgent)
 *   B2: Silent error swallowing (.catch(() => {}))
 *   B3: Timing hack (setTimeout in non-animation context)
 *
 * Exception: `// ROOT-CAUSE: [≥20 chars]` comment in the new code exempts the pattern.
 * This forces the agent to EXPLAIN why the pattern is not a bandaid.
 *
 * Fail-closed (exit 2). Skips: non-TS files, hooks, docs, tests, scripts.
 *
 * Research basis: Codacy Guardrails, SonarQube, ArXiv AI Agent Code of Conduct.
 */
const path = require('path');

const ROOT = process.cwd();

// Files/dirs where bandaid patterns are legitimate
const SKIP_PATTERNS = [
  '.claude/hooks/',
  '.claude/rules/',
  'docs/',
  '__tests__',
  '.test.',
  '.spec.',
  'scripts/',
  'node_modules/',
];

// Filenames where setTimeout/requestAnimationFrame are legitimate
const TIMER_EXEMPT_FILES = [
  'debounce', 'throttle', 'animation', 'timer', 'delay',
  'retry', 'polling', 'interval', 'transition', 'gesture',
  'ValenceOrb', 'useDebounce', 'useDebouncedValue',
];

const BANDAID_PATTERNS = [
  // Law 21 Bandaid Detection (B1-B4)
  {
    regex: /if\s*\(.*(?:isSafari|isAndroid|isIOS|navigator\.userAgent|getPlatform)/i,
    label: 'PLATFORM CHECK as fix (Law 21 Bandaid #1) — platform is not the cause, it merely exposes it',
  },
  {
    regex: /\.catch\s*\(\s*(?:\(\)\s*=>)?\s*\{\s*\}\)/,
    label: 'SILENT ERROR SWALLOWING (Law 21 Bandaid #3) — catching and hiding is not fixing',
  },
  {
    regex: /catch\s*\([^)]*\)\s*\{\s*\}/,
    label: 'EMPTY CATCH BLOCK (Law 21 Bandaid #3) — error silenced without handling',
  },
  {
    regex: /setTimeout\s*\(/,
    label: 'setTimeout HACK (Law 21 Bandaid #2) — timing hacks mask race conditions or missing state sync',
    fileExempt: TIMER_EXEMPT_FILES,
  },
  // Corner-cutting detection (C1-C3) — Research Finding #6
  {
    regex: /\/\/\s*(TODO|FIXME|HACK|XXX|TEMP)\b/,
    label: 'CORNER-CUTTING: TODO/FIXME left in code — complete the implementation before committing',
    exemptMarker: '// INTENTIONAL:',
  },
  {
    regex: /(?:=>|function\s*\([^)]*\))\s*\{\s*\}|(?:=>|function\s*\([^)]*\))\s*\{\s*return;\s*\}/,
    label: 'CORNER-CUTTING: Empty function/arrow body — implement the logic or remove the stub',
    exemptMarker: '// INTENTIONAL:',
  },
];

const ROOT_CAUSE_MARKER = '// ROOT-CAUSE:';
const INTENTIONAL_MARKER = '// INTENTIONAL:';
const MIN_EXPLANATION_LENGTH = 20;

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const filePath = (data.tool_input?.file_path || '').replace(/\\/g, '/');
    const newString = data.tool_input?.new_string || data.tool_input?.content || '';

    // Skip non-TypeScript files
    if (!filePath.match(/\.(ts|tsx)$/)) {
      process.exit(0);
    }

    // Skip exempt paths
    const relPath = filePath.replace(ROOT.replace(/\\/g, '/'), '').replace(/^\//, '');
    if (SKIP_PATTERNS.some(p => relPath.includes(p))) {
      process.exit(0);
    }

    // Check each bandaid pattern against NEW code only
    // Each pattern needs its OWN ROOT-CAUSE exemption — one comment doesn't exempt all
    const lines = newString.split('\n');

    for (const bp of BANDAID_PATTERNS) {
      if (!bp.regex.test(newString)) continue;

      // Check file-level OR context-level exemption (e.g., setTimeout in animation files or retry contexts)
      if (bp.fileExempt) {
        const fileName = path.basename(filePath).toLowerCase();
        // File name contains exempt keyword (e.g., useDebounce.ts, animationUtils.ts)
        if (bp.fileExempt.some(exempt => fileName.includes(exempt.toLowerCase()))) {
          continue;
        }
        // Context check: if surrounding code (within 5 lines) mentions exempt keywords
        const lowerNewString = newString.toLowerCase();
        const contextExemptKeywords = ['debounce', 'throttle', 'retry', 'polling', 'interval', 'animation', 'transition', 'delay', 'backoff'];
        if (contextExemptKeywords.some(kw => lowerNewString.includes(kw))) {
          continue; // Legitimate use based on code context
        }
      }

      // Check for exemption comment — ROOT-CAUSE: or INTENTIONAL: (per pattern config)
      // Must be DIRECTLY above the pattern line (within 3 lines)
      // Each pattern needs its OWN exemption comment.
      const markers = [ROOT_CAUSE_MARKER];
      if (bp.exemptMarker) markers.push(bp.exemptMarker);

      let exempted = false;
      for (let i = 0; i < lines.length; i++) {
        if (!bp.regex.test(lines[i])) continue;
        let foundRC = false;
        // Walk backwards from pattern line
        for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
          const lineHasBandaid = BANDAID_PATTERNS.some(other => other.regex.test(lines[j]) && !markers.some(m => lines[j].includes(m)));
          if (lineHasBandaid) break;
          for (const marker of markers) {
            if (lines[j].includes(marker)) {
              const explanation = lines[j].slice(lines[j].indexOf(marker) + marker.length).trim();
              if (explanation.length >= MIN_EXPLANATION_LENGTH) {
                foundRC = true;
              }
              break;
            }
          }
          if (foundRC) break;
        }
        // Also check same line (inline comment)
        if (!foundRC) {
          for (const marker of markers) {
            if (lines[i].includes(marker)) {
              const explanation = lines[i].slice(lines[i].indexOf(marker) + marker.length).trim();
              if (explanation.length >= MIN_EXPLANATION_LENGTH) {
                foundRC = true;
              }
              break;
            }
          }
        }
        if (foundRC) {
          exempted = true;
          break;
        }
      }

      if (exempted) continue;

      // Check if there's an exemption marker anywhere but too short
      for (const marker of markers) {
        if (newString.includes(marker)) {
          const markerLines = lines.filter(l => l.includes(marker));
          const tooShort = markerLines.some(l => {
            const expl = l.slice(l.indexOf(marker) + marker.length).trim();
            return expl.length > 0 && expl.length < MIN_EXPLANATION_LENGTH;
          });
          if (tooShort) {
            process.stderr.write(
              'BANDAID GATE: Exemption explanation too short (need ≥' + MIN_EXPLANATION_LENGTH + ' chars).\n' +
              'Pattern: ' + bp.label + '\n' +
              'Provide a substantive explanation: ' + marker + ' [why this is intentional]\n'
            );
            process.exit(2);
          }
        }
      }

      // BLOCK — pattern detected without per-pattern exemption
      const exemptHint = bp.exemptMarker
        ? '     ' + bp.exemptMarker + ' [explain why — ≥20 chars]\n'
        : '     // ROOT-CAUSE: [explain why this is not a bandaid — ≥20 chars]\n';
      process.stderr.write(
        'BANDAID GATE BLOCKED!\n\n' +
        'Pattern: ' + bp.label + '\n\n' +
        'Law 21 (Surgeon\'s Law) requires root cause fixes, not shortcuts.\n' +
        'Options:\n' +
        '  1. Fix the ROOT CAUSE instead of using this pattern\n' +
        '  2. If this pattern IS the correct approach, add a comment NEAR the pattern:\n' +
        exemptHint +
        '     (Must be within 3 lines above the pattern. Each pattern needs its own exemption.)\n'
      );
      process.exit(2);
    }

    // All checks passed — allow edit
    process.exit(0);
  } catch (e) {
    // Fail-closed: block on parse error (security hook pattern)
    process.stderr.write('HOOK ERROR [bandaid-gate]: ' + (e.message || e) + '\n');
    process.exit(2);
  }
});
