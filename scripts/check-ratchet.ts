/**
 * Ratchet Check — Law 27 Enforcement
 *
 * Machine-enforced quality floors that only move in one direction.
 * Based on the Quality Ratchet pattern (LeadDev), Clean as You Code (SonarQube),
 * jest-ratchet (npm), and immutable audit trails.
 *
 * 7 Pillars: Quality Lock, Quality Score, Completeness Proof,
 * Evidence Chain, Staleness Detection, Graduation Pipeline, Canary Metrics.
 *
 * Usage:
 *   npx tsx scripts/check-ratchet.ts            # Check only (exit 1 on violation)
 *   npx tsx scripts/check-ratchet.ts --update    # Check + auto-tighten improved floors
 *   npx tsx scripts/check-ratchet.ts --override metric=value --reason "justification"
 *
 * Exit: 0 = pass, 1 = violation/regression/staleness failure
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

// --- Types ---

interface FloorEntry {
  value: number;
  direction: 'up' | 'down';
  recorded: string;
  description: string;
}

interface QualityLedger {
  version: string;
  lastUpdated: string;
  floors: Record<string, FloorEntry>;
  qualityScore: {
    current: number | null;
    floor: number | null;
    weights: Record<string, number>;
  };
  staleness: {
    lastFullAudit: string;
    maxLedgerAgeDays: number;
    maxAuditAgeDays: number;
  };
  graduation: {
    eslint: Record<string, { current: string; target: string; evaluateAfter: string }>;
    typescript: Record<string, { current: boolean; target: boolean; evaluateAfter: string }>;
  };
  overrides: Array<{ metric: string; oldValue: number; newValue: number; reason: string; date: string }>;
}

interface CheckResult {
  violations: string[];
  improvements: string[];
  warnings: string[];
  passes: string[];
  metricsChecked: number;
  metricsTotal: number;
}

// --- Helpers (reused pattern from check-constitution.ts) ---

function run(cmd: string): string {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

function runCount(cmd: string): number {
  const out = run(cmd);
  return parseInt(out, 10) || 0;
}

function daysSince(dateStr: string): number {
  const then = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

// --- God Component Detection (reused from check-constitution.ts) ---

const GOD_COMPONENT_EXEMPT = [
  'ui/sidebar.tsx',
  'canvas/MindMapCanvas.tsx',
  'state-of-mind/ValenceOrb.tsx',
  'pages/Index.tsx',
  'contexts/',
];

const GOD_COMPONENT_OUT_OF_SCOPE = [
  'features/journal/',
];

function findGodComponents(threshold: number): number {
  const output = run(`bash -c "find src -name '*.tsx' -exec wc -l {} + | sort -rn | head -40"`);
  let count = 0;

  for (const line of output.split('\n')) {
    const match = line.trim().match(/^(\d+)\s+(.+)$/);
    if (!match) continue;

    const lines = parseInt(match[1], 10);
    const filePath = match[2].trim();

    if (filePath === 'total' || lines <= threshold) continue;

    const relPath = filePath.replace(/^src\//, '');
    const isExempt = GOD_COMPONENT_EXEMPT.some(e => relPath.includes(e));
    const isOutOfScope = GOD_COMPONENT_OUT_OF_SCOPE.some(e => relPath.includes(e));

    if (!isExempt && !isOutOfScope) {
      count++;
    }
  }

  return count;
}

// --- Metric Measurement ---

function measureMetrics(): Record<string, number> {
  return {
    'tests.total': getTestTotal(),
    'tests.files': runCount(`bash -c "find src test -name '*.test.*' -o -name '*.spec.*' 2>/dev/null | wc -l"`),
    'eslint.maxWarnings': 0, // enforced by eslint --max-warnings=0 before this script runs
    'tsc.errors': 0, // enforced by tsc --noEmit before this script runs
    'i18n.languages': 8, // enforced by i18n:check before this script runs
    'silentCatches': runCount(`bash -c "grep -rn '.catch.*=> {}' src/ --include='*.ts' --include='*.tsx' | wc -l"`),
    'godComponents': findGodComponents(400),
    'exhaustiveDeps': runCount(`bash -c "grep -rn 'eslint-disable.*exhaustive-deps' src/ | wc -l"`),
    'inlineStyles': runCount(`bash -c "grep -rn 'style={{' src/ --include='*.tsx' | wc -l"`),
  };
}

function getTestTotal(): number {
  // Parse from the last vitest run output (test count is in the summary line)
  // Since vitest runs before us in ci:preflight, we can count test files * avg tests
  // But more reliable: count test('...') and it('...') calls
  const testCalls = runCount(`bash -c "grep -rn '\\(test\\|it\\)(' src/ test/ --include='*.test.*' --include='*.spec.*' | grep -v 'import\\|require\\|describe\\|//' | wc -l"`);
  // If grep-based count fails or is wildly off, fall back to known floor
  return testCalls > 0 ? testCalls : 0;
}

// --- Quality Score Computation (Pillar 2) ---

interface ScoreDimension {
  name: string;
  weight: number;
  score: number;
  detail: string;
}

interface ScoreResult {
  total: number;
  dimensions: ScoreDimension[];
}

function computeQualityScore(
  actual: Record<string, number>,
  sourceFiles: number,
  ledgerAgeDays: number,
  auditAgeDays: number
): ScoreResult {
  const dimensions: ScoreDimension[] = [];

  // Type Safety: 15% — tsc errors (0 = 10, >100 = 0)
  const typeSafety = Math.max(0, 10 - (actual['tsc.errors'] / 10));
  dimensions.push({ name: 'Type Safety', weight: 0.15, score: typeSafety, detail: `${actual['tsc.errors']} errors` });

  // Lint Cleanliness: 10% — eslint warnings (0 = 10, >50 = 0)
  const lintCleanliness = Math.max(0, 10 - (actual['eslint.maxWarnings'] / 5));
  dimensions.push({ name: 'Lint Clean', weight: 0.10, score: lintCleanliness, detail: `${actual['eslint.maxWarnings']} warnings` });

  // Test Coverage: 20% — test count + ratio
  const testRatio = sourceFiles > 0 ? actual['tests.files'] / sourceFiles : 0;
  const testCountScore = Math.min(10, (actual['tests.total'] / 2664) * 10);
  const testRatioScore = Math.min(10, (testRatio / 0.20) * 10);
  const testCoverage = (testCountScore + testRatioScore) / 2;
  dimensions.push({ name: 'Test Coverage', weight: 0.20, score: testCoverage, detail: `${actual['tests.total']} tests, ${(testRatio * 100).toFixed(1)}% ratio` });

  // Code Health: 15% — god components + silent catches
  // Exponential decay: 0 issues = 10.0, gradual decline, never truly 0
  // Matches SonarQube rating curves (diminishing-returns penalty)
  const healthIssues = actual['godComponents'] + actual['silentCatches'];
  const codeHealth = 10 * Math.exp(-healthIssues / 5);
  dimensions.push({ name: 'Code Health', weight: 0.15, score: codeHealth, detail: `${actual['godComponents']} god + ${actual['silentCatches']} catches` });

  // i18n Completeness: 10% — languages (8 = 10, <4 = 0)
  const i18n = Math.min(10, (actual['i18n.languages'] / 8) * 10);
  dimensions.push({ name: 'i18n', weight: 0.10, score: i18n, detail: `${actual['i18n.languages']} languages` });

  // Build Integrity: 10% — assumed pass (runs before ratchet in pipeline)
  const buildIntegrity = 10;
  dimensions.push({ name: 'Build', weight: 0.10, score: buildIntegrity, detail: 'clean' });

  // Staleness: 10% — ledger + audit age (<7 days = 10, >30 = 0)
  const avgAge = (ledgerAgeDays + auditAgeDays) / 2;
  const staleness = Math.max(0, Math.min(10, 10 - ((avgAge - 7) / 2.3)));
  dimensions.push({ name: 'Staleness', weight: 0.10, score: staleness, detail: `${Math.round(avgAge)}d avg age` });

  // Debt Trend: 10% — inline styles + exhaustive-deps (fewer = better)
  // Natural floors: dynamic inline styles (~160) and justified deps (~8) are EXPECTED
  // in any React app with runtime-computed visuals and mount-only subscriptions.
  // Only penalize counts ABOVE these floors.
  const DYNAMIC_STYLE_FLOOR = 160;   // runtime-computed styles (React norm)
  const JUSTIFIED_DEPS_FLOOR = 20;   // mount-only + subscription patterns (audit: 22/22 justified)
  const stylesOver = Math.max(0, actual['inlineStyles'] - DYNAMIC_STYLE_FLOOR);
  const depsOver = Math.max(0, actual['exhaustiveDeps'] - JUSTIFIED_DEPS_FLOOR);
  const styleScore = 10 * Math.max(0, 1 - stylesOver / 800);
  const depsScore = 10 * Math.max(0, 1 - depsOver / 40);
  const debtScore = styleScore * 0.6 + depsScore * 0.4;
  dimensions.push({ name: 'Debt Trend', weight: 0.10, score: debtScore, detail: `${actual['inlineStyles']} styles, ${actual['exhaustiveDeps']} deps` });

  const total = dimensions.reduce((sum, d) => sum + d.score * d.weight, 0);

  return {
    total: Math.round(total * 10) / 10,
    dimensions,
  };
}

// --- Canary Metrics (Pillar 7) ---

function checkCanaries(actual: Record<string, number>, sourceFiles: number, result: CheckResult): void {
  const testRatio = sourceFiles > 0 ? actual['tests.files'] / sourceFiles : 0;

  if (testRatio < 0.15) {
    result.violations.push(`CANARY CRITICAL: test-to-source ratio ${testRatio.toFixed(3)} < 0.15`);
  } else if (testRatio < 0.17) {
    result.warnings.push(`CANARY: test-to-source ratio declining ${testRatio.toFixed(3)} < 0.17`);
  }
}

// --- Main ---

function checkRatchet(): void {
  const ledgerPath = path.join(ROOT, 'quality-ledger.json');
  if (!fs.existsSync(ledgerPath)) {
    console.error('quality-ledger.json not found! Run initial setup first.');
    process.exit(2);
  }

  const ledger: QualityLedger = JSON.parse(fs.readFileSync(ledgerPath, 'utf-8'));
  const args = process.argv.slice(2);
  const doUpdate = args.includes('--update');

  // Parse --override metric=value --reason "..."
  const overrideIdx = args.indexOf('--override');
  const reasonIdx = args.indexOf('--reason');
  let overrideMetric: string | null = null;
  let overrideValue: number | null = null;
  let overrideReason: string | null = null;

  if (overrideIdx !== -1 && reasonIdx !== -1) {
    const overrideArg = args[overrideIdx + 1];
    if (overrideArg) {
      const [metric, val] = overrideArg.split('=');
      overrideMetric = metric;
      overrideValue = parseInt(val, 10);
    }
    overrideReason = args[reasonIdx + 1];
  }

  const result: CheckResult = {
    violations: [],
    improvements: [],
    warnings: [],
    passes: [],
    metricsChecked: 0,
    metricsTotal: Object.keys(ledger.floors).length,
  };

  // ═══════════════════════════════════════════
  // PHASE A: MEASURE
  // ═══════════════════════════════════════════

  console.log('\n' + '='.repeat(50));
  console.log('  RATCHET CHECK \u2014 Law 27 Enforcement');
  console.log('='.repeat(50));

  const actual = measureMetrics();
  const sourceFiles = runCount(`bash -c "find src -name '*.ts' -o -name '*.tsx' | grep -v test | grep -v __tests__ | grep -v '.spec.' | wc -l"`);

  // ═══════════════════════════════════════════
  // PHASE B: COMPARE against floors
  // ═══════════════════════════════════════════

  console.log('\n  QUALITY FLOORS (' + result.metricsTotal + ' metrics)\n');

  for (const [metric, floor] of Object.entries(ledger.floors)) {
    const value = actual[metric];
    result.metricsChecked++;

    if (value === undefined) {
      result.warnings.push(`${metric}: no measurement available`);
      console.log(`  ?  ${metric}: no measurement`);
      continue;
    }

    const isPass =
      (floor.direction === 'up' && value >= floor.value) ||
      (floor.direction === 'down' && value <= floor.value);

    const isBetter =
      (floor.direction === 'up' && value > floor.value) ||
      (floor.direction === 'down' && value < floor.value);

    const diff = value - floor.value;
    const arrow = floor.direction === 'up'
      ? (diff > 0 ? `\u2191 improved (+${diff})` : '')
      : (diff < 0 ? `\u2191 improved (${diff})` : '');

    const comparison = floor.direction === 'up' ? '\u2265' : '\u2264';

    if (isPass) {
      const suffix = isBetter ? `  ${arrow}` : '';
      console.log(`  \u2713  ${metric.padEnd(22)} ${String(value).padStart(5)} ${comparison} ${String(floor.value).padStart(5)}${suffix}`);
      result.passes.push(`${metric}: ${value} ${comparison} ${floor.value}`);
      if (isBetter) {
        result.improvements.push(`${metric}: ${floor.value} \u2192 ${value}`);
      }
    } else {
      console.log(`  X  ${metric.padEnd(22)} ${String(value).padStart(5)} VIOLATED floor ${floor.value} (${floor.direction === 'up' ? 'must increase' : 'must decrease'})`);
      result.violations.push(`RATCHET VIOLATION: ${metric} regressed from ${floor.value} to ${value}`);
    }
  }

  console.log(`\n  SCOPE: ${result.metricsChecked}/${result.metricsTotal} metrics checked (${Math.round(result.metricsChecked / result.metricsTotal * 100)}%)`);

  // ═══════════════════════════════════════════
  // PHASE C: STALENESS
  // ═══════════════════════════════════════════

  console.log('\n  STALENESS\n');

  const ledgerAge = daysSince(ledger.lastUpdated);
  const auditAge = daysSince(ledger.staleness.lastFullAudit);

  if (ledgerAge > ledger.staleness.maxLedgerAgeDays) {
    console.log(`  X  Ledger age: ${ledgerAge} days (max: ${ledger.staleness.maxLedgerAgeDays}) \u2014 STALE`);
    result.violations.push(`STALE LEDGER: not updated in ${ledgerAge} days (max: ${ledger.staleness.maxLedgerAgeDays})`);
  } else if (ledgerAge > 14) {
    console.log(`  ~  Ledger age: ${ledgerAge} days \u2014 getting stale`);
    result.warnings.push(`Ledger getting stale: ${ledgerAge} days`);
  } else {
    console.log(`  \u2713  Ledger age: ${ledgerAge} days`);
  }

  if (auditAge > ledger.staleness.maxAuditAgeDays) {
    console.log(`  X  Audit age: ${auditAge} days (max: ${ledger.staleness.maxAuditAgeDays}) \u2014 STALE`);
    result.violations.push(`STALE AUDIT: last full audit was ${auditAge} days ago (max: ${ledger.staleness.maxAuditAgeDays})`);
  } else if (auditAge > 30) {
    console.log(`  ~  Audit age: ${auditAge} days \u2014 getting stale`);
    result.warnings.push(`Audit getting stale: ${auditAge} days`);
  } else {
    console.log(`  \u2713  Audit age: ${auditAge} days`);
  }

  // Source file drift
  const docSourceFiles = 702; // from ARCHITECTURE.md
  const drift = Math.abs(sourceFiles - docSourceFiles);
  if (drift > 20) {
    console.log(`  X  Source file drift: ${drift} files (${sourceFiles} actual, ${docSourceFiles} documented)`);
    result.violations.push(`SOURCE DRIFT: ${drift} files differ from documented count`);
  } else if (drift > 10) {
    console.log(`  ~  Source file drift: ${drift} files \u2014 consider constitution:check`);
    result.warnings.push(`Source file drift: ${drift} files`);
  } else {
    console.log(`  \u2713  Source file drift: ${drift} files`);
  }

  // ═══════════════════════════════════════════
  // QUALITY SCORE (Pillar 2)
  // ═══════════════════════════════════════════

  const scoreResult = computeQualityScore(actual, sourceFiles, ledgerAge, auditAge);
  const score = scoreResult.total;

  console.log(`\n  QUALITY SCORE: ${score.toFixed(1)} / 10.0` +
    (ledger.qualityScore.floor !== null ? ` (floor: ${ledger.qualityScore.floor.toFixed(1)})` : ' (floor: \u2014)'));

  // Dimension breakdown — shows which areas drag the score down
  console.log('');
  for (const d of scoreResult.dimensions) {
    const pct = Math.round(d.weight * 100);
    const bar = d.score >= 9 ? '\u2713' : d.score >= 5 ? '~' : 'X';
    console.log(`  ${bar}  ${d.name.padEnd(14)} ${d.score.toFixed(1).padStart(5)}/10  (${pct}%)  ${d.detail}`);
  }

  if (ledger.qualityScore.floor !== null && score < ledger.qualityScore.floor) {
    result.violations.push(`SCORE REGRESSION: ${score.toFixed(1)} < floor ${ledger.qualityScore.floor.toFixed(1)}`);
  }

  // ═══════════════════════════════════════════
  // GRADUATION READINESS (Pillar 6)
  // ═══════════════════════════════════════════

  const nowDate = new Date();
  let hasGraduation = false;

  for (const [rule, config] of Object.entries(ledger.graduation.eslint)) {
    if (new Date(config.evaluateAfter) <= nowDate) {
      if (!hasGraduation) {
        console.log('\n  GRADUATION READINESS\n');
        hasGraduation = true;
      }
      console.log(`  ~  ${rule}: evaluate now (target: ${config.current} \u2192 ${config.target})`);
    }
  }

  for (const [flag, config] of Object.entries(ledger.graduation.typescript)) {
    if (new Date(config.evaluateAfter) <= nowDate) {
      if (!hasGraduation) {
        console.log('\n  GRADUATION READINESS\n');
        hasGraduation = true;
      }
      console.log(`  ~  TypeScript ${flag}: evaluate now (${config.current} \u2192 ${config.target})`);
    }
  }

  if (!hasGraduation) {
    const nextEslint = Object.entries(ledger.graduation.eslint)
      .map(([rule, c]) => ({ rule, date: c.evaluateAfter }))
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    const nextTs = Object.entries(ledger.graduation.typescript)
      .map(([flag, c]) => ({ rule: `TypeScript ${flag}`, date: c.evaluateAfter }))
      .sort((a, b) => a.date.localeCompare(b.date))[0];

    const next = [nextEslint, nextTs].filter(Boolean).sort((a, b) => a!.date.localeCompare(b!.date))[0];
    if (next) {
      console.log(`\n  GRADUATION READINESS\n`);
      console.log(`  ~  Next: ${next.rule} (evaluate after ${next.date})`);
    }
  }

  // ═══════════════════════════════════════════
  // CANARY METRICS (Pillar 7)
  // ═══════════════════════════════════════════

  checkCanaries(actual, sourceFiles, result);

  // ═══════════════════════════════════════════
  // PHASE D: AUTO-TIGHTEN (--update only)
  // ═══════════════════════════════════════════

  if (doUpdate && result.violations.length === 0) {
    let tightened = false;
    for (const [metric, floor] of Object.entries(ledger.floors)) {
      const value = actual[metric];
      if (value === undefined) continue;

      const isBetter =
        (floor.direction === 'up' && value > floor.value) ||
        (floor.direction === 'down' && value < floor.value);

      if (isBetter) {
        const old = floor.value;
        floor.value = value;
        floor.recorded = today();
        if (!tightened) {
          console.log('\n  AUTO-TIGHTEN\n');
          tightened = true;
        }
        console.log(`  \u2191  ${metric}: ${old} \u2192 ${value} (floor tightened)`);
      }
    }

    // Update score
    ledger.qualityScore.current = score;
    if (ledger.qualityScore.floor === null || score > ledger.qualityScore.floor) {
      const oldFloor = ledger.qualityScore.floor;
      ledger.qualityScore.floor = score;
      if (oldFloor !== null) {
        console.log(`  \u2191  qualityScore.floor: ${oldFloor.toFixed(1)} \u2192 ${score.toFixed(1)}`);
      } else {
        console.log(`  \u2191  qualityScore.floor: \u2014 \u2192 ${score.toFixed(1)} (initial)`);
      }
    }

    ledger.lastUpdated = today();
    fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');

    if (!tightened) {
      console.log('\n  AUTO-TIGHTEN: no improvements to lock in');
    }
  }

  // ═══════════════════════════════════════════
  // OVERRIDE (escape hatch)
  // ═══════════════════════════════════════════

  if (overrideMetric && overrideValue !== null && overrideReason) {
    const floor = ledger.floors[overrideMetric];
    if (floor) {
      const oldValue = floor.value;
      ledger.overrides.push({
        metric: overrideMetric,
        oldValue,
        newValue: overrideValue,
        reason: overrideReason,
        date: today(),
      });
      floor.value = overrideValue;
      floor.recorded = today();
      ledger.lastUpdated = today();
      fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');
      console.log(`\n  OVERRIDE: ${overrideMetric} ${oldValue} \u2192 ${overrideValue} (reason: ${overrideReason})`);
      // Re-check after override
      const overriddenViolation = result.violations.findIndex(v => v.includes(overrideMetric!));
      if (overriddenViolation !== -1) {
        result.violations.splice(overriddenViolation, 1);
      }
    } else {
      console.error(`  Unknown metric: ${overrideMetric}`);
    }
  }

  // ═══════════════════════════════════════════
  // EVIDENCE CHAIN (Pillar 4)
  // ═══════════════════════════════════════════

  const gitHash = run('git rev-parse --short HEAD');
  console.log(`\n  EVIDENCE: commit ${gitHash}, ${today()}`);

  // ═══════════════════════════════════════════
  // RESULT
  // ═══════════════════════════════════════════

  console.log('\n' + '='.repeat(50));

  if (result.violations.length === 0) {
    const improvStr = result.improvements.length > 0 ? `, ${result.improvements.length} improvement(s)` : '';
    const warnStr = result.warnings.length > 0 ? `, ${result.warnings.length} warning(s)` : '';
    console.log(`  RESULT: PASS (0 violations${improvStr}${warnStr})`);
    if (result.warnings.length > 0) {
      console.log('');
      result.warnings.forEach(w => console.log(`  ~  ${w}`));
    }
  } else {
    console.log(`  RESULT: FAIL (${result.violations.length} violation(s))`);
    console.log('');
    result.violations.forEach(v => console.log(`  X  ${v}`));
  }

  console.log('\n' + '='.repeat(50) + '\n');

  if (result.violations.length > 0) {
    process.exit(1);
  }
}

// --- Run ---
checkRatchet();
