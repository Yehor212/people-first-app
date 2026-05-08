/**
 * Constitution Freshness Check
 *
 * Compares ARCHITECTURE.md documented metrics against actual codebase state.
 * Detects drift: new god components, changed file counts, silent catch reappearance, etc.
 *
 * Usage: npx tsx scripts/check-constitution.ts
 * Exit: 0 = clean, 1 = drift detected (constitution update needed)
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

// --- Types ---

interface MetricCheck {
  name: string;
  documented: number;
  actual: number;
  tolerance: number; // allow this much drift before flagging
  direction: 'exact' | 'up-is-good' | 'down-is-good';
}

interface GodComponent {
  file: string;
  lines: number;
}

interface CheckResult {
  fails: string[];
  warnings: string[];
  passes: string[];
  godComponentsNew: GodComponent[];
}

// --- Helpers ---

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

function parseDocumentedMetric(content: string, metricLabel: string): number | null {
  // Match table rows: | Label... | Value... | Command... |
  // Uses partial match — label just needs to appear within the first column
  const escapedLabel = metricLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\|[^|]*${escapedLabel}[^|]*\\|\\s*([^|]+)\\|`, 'i');
  const match = content.match(regex);
  if (!match) return null;

  const valueCell = match[1].trim();
  // Extract first number (handles "702 (.ts/.tsx...)", "2664/2664", "44 / 80+", "4,327")
  const numMatch = valueCell.replace(/,/g, '').match(/(\d+)/);
  return numMatch ? parseInt(numMatch[1], 10) : null;
}

function parseDocumentedGodComponentCount(content: string): number | null {
  const match = content.match(/####\s+New Violations\s+\((\d+)\s+files\s+>400L/i);
  return match ? parseInt(match[1], 10) : null;
}

// --- Actual Metrics ---

function getActualSourceFiles(): number {
  return runCount(`bash -c "find src -name '*.ts' -o -name '*.tsx' | grep -v test | grep -v __tests__ | grep -v '.spec.' | wc -l"`);
}

function getActualTestFiles(): number {
  return runCount(`bash -c "find src test -name '*.test.*' -o -name '*.spec.*' 2>/dev/null | wc -l"`);
}

function getActualSilentCatches(): number {
  return runCount(`bash -c "grep -rn '.catch.*=> {}' src/ --include='*.ts' --include='*.tsx' | wc -l"`);
}

function getActualReactMemo(): number {
  return runCount(`bash -c "grep -rl 'memo(' src/ --include='*.tsx' | wc -l"`);
}

function getActualCssLines(): number {
  return runCount(`bash -c "wc -l < src/index.css"`);
}

function getActualInlineStyles(): number {
  return runCount(`bash -c "grep -rn 'style={{' src/ --include='*.tsx' | wc -l"`);
}

function getActualExhaustiveDeps(): number {
  return runCount(`bash -c "grep -rn 'eslint-disable.*exhaustive-deps' src/ | wc -l"`);
}

function getActualHookTests(): number {
  return runCount(`bash -c "ls src/hooks/__tests__/*.test.* 2>/dev/null | wc -l"`);
}

function getActualHooks(): number {
  return runCount(`bash -c "ls src/hooks/*.ts 2>/dev/null | wc -l"`);
}

// --- God Component Detection ---

const GOD_COMPONENT_EXEMPT = [
  'ui/sidebar.tsx',           // vendored shadcn
  'canvas/MindMapCanvas.tsx', // CANVAS_ENABLED=false
  'pages/Index.tsx',          // orchestrator (documented exempt in TD-01)
  'contexts/',                // contexts tracked separately in metrics table
];

const GOD_COMPONENT_OUT_OF_SCOPE = [
  'features/journal/',     // separate module
];

function findGodComponents(threshold: number): GodComponent[] {
  const output = run(`bash -c "find src -name '*.tsx' -exec wc -l {} + | sort -rn | head -40"`);
  const results: GodComponent[] = [];

  for (const line of output.split('\n')) {
    const match = line.trim().match(/^(\d+)\s+(.+)$/);
    if (!match) continue;

    const lines = parseInt(match[1], 10);
    const filePath = match[2].trim();

    if (filePath === 'total' || lines <= threshold) continue;

    // Check exemptions
    const relPath = filePath.replace(/^src\//, '');
    const isExempt = GOD_COMPONENT_EXEMPT.some(e => relPath.includes(e));
    const isOutOfScope = GOD_COMPONENT_OUT_OF_SCOPE.some(e => relPath.includes(e));

    if (!isExempt && !isOutOfScope) {
      results.push({ file: relPath, lines });
    }
  }

  return results;
}

function findGodCssFiles(threshold: number): GodComponent[] {
  const output = run(`bash -c "find src -name '*.css' -exec wc -l {} + | sort -rn | head -10"`);
  const results: GodComponent[] = [];

  for (const line of output.split('\n')) {
    const match = line.trim().match(/^(\d+)\s+(.+)$/);
    if (!match) continue;
    const lines = parseInt(match[1], 10);
    const filePath = match[2].trim();
    if (filePath === 'total' || lines <= threshold) continue;
    results.push({ file: filePath.replace(/^src\//, ''), lines });
  }

  return results;
}

// --- Main ---

function checkConstitution(): CheckResult {
  const archPath = path.join(ROOT, 'ARCHITECTURE.md');
  if (!fs.existsSync(archPath)) {
    console.error('ARCHITECTURE.md not found!');
    process.exit(2);
  }

  const content = fs.readFileSync(archPath, 'utf-8');
  const result: CheckResult = { fails: [], warnings: [], passes: [], godComponentsNew: [] };

  console.log('\n' + '='.repeat(55));
  console.log('  CONSTITUTION FRESHNESS CHECK');
  console.log('='.repeat(55) + '\n');

  // --- Metric checks ---
  const checks: MetricCheck[] = [
    {
      name: 'Source files',
      documented: parseDocumentedMetric(content, 'Source files') ?? -1,
      actual: getActualSourceFiles(),
      tolerance: 5,
      direction: 'exact',
    },
    {
      name: 'Test files',
      documented: parseDocumentedMetric(content, 'Test files') ?? -1,
      actual: getActualTestFiles(),
      tolerance: 3,
      direction: 'exact',
    },
    {
      name: 'Silent .catch',
      documented: parseDocumentedMetric(content, 'Silent') ?? -1,
      actual: getActualSilentCatches(),
      tolerance: 0,
      direction: 'down-is-good',
    },
    {
      name: 'React.memo',
      documented: parseDocumentedMetric(content, 'React.memo') ?? -1,
      actual: getActualReactMemo(),
      tolerance: 3,
      direction: 'up-is-good',
    },
    {
      name: 'index.css LOC',
      documented: parseDocumentedMetric(content, 'index.css') ?? -1,
      actual: getActualCssLines(),
      tolerance: 50,
      direction: 'exact',
    },
    {
      name: 'Inline style={{}}',
      documented: parseDocumentedMetric(content, 'Inline style') ?? -1,
      actual: getActualInlineStyles(),
      tolerance: 10,
      direction: 'down-is-good',
    },
    {
      name: 'exhaustive-deps suppressions',
      documented: parseDocumentedMetric(content, 'exhaustive-deps') ?? -1,
      actual: getActualExhaustiveDeps(),
      tolerance: 2,
      direction: 'down-is-good',
    },
  ];

  for (const check of checks) {
    if (check.documented === -1) {
      result.warnings.push(`${check.name}: not found in ARCHITECTURE.md`);
      console.log(`  ?  ${check.name}: not documented`);
      continue;
    }

    const diff = check.actual - check.documented;
    const absDiff = Math.abs(diff);

    if (absDiff <= check.tolerance) {
      result.passes.push(`${check.name}: ${check.actual} (documented: ${check.documented})`);
      console.log(`  \u2713  ${check.name}: ${check.actual} (documented: ${check.documented})`);
    } else if (
      (check.direction === 'up-is-good' && diff > 0) ||
      (check.direction === 'down-is-good' && diff < 0)
    ) {
      result.warnings.push(`${check.name}: ${check.actual} (documented: ${check.documented}) \u2014 improved, update docs`);
      console.log(`  ~  ${check.name}: ${check.actual} (documented: ${check.documented}) \u2014 improved (+${diff}), update docs`);
    } else {
      result.fails.push(`${check.name}: ${check.actual} (documented: ${check.documented}) \u2014 drift of ${diff > 0 ? '+' : ''}${diff}`);
      console.log(`  X  ${check.name}: ${check.actual} (documented: ${check.documented}) \u2014 DRIFT ${diff > 0 ? '+' : ''}${diff}`);
    }
  }

  // --- Hook coverage ---
  const hookTests = getActualHookTests();
  const hookTotal = getActualHooks();
  const hookPct = hookTotal > 0 ? Math.round((hookTests / hookTotal) * 100) : 0;
  const docHookPct = parseDocumentedMetric(content, 'Hook coverage') ?? 67;
  if (Math.abs(hookPct - docHookPct) > 5) {
    result.warnings.push(`Hook coverage: ${hookPct}% (documented: ${docHookPct}%)`);
    console.log(`  ~  Hook coverage: ${hookTests}/${hookTotal} (${hookPct}%) \u2014 documented: ${docHookPct}%`);
  } else {
    result.passes.push(`Hook coverage: ${hookPct}% (documented: ${docHookPct}%)`);
    console.log(`  \u2713  Hook coverage: ${hookTests}/${hookTotal} (${hookPct}%)`);
  }

  // --- God components ---
  console.log('\n  --- God Components (>400 LOC .tsx) ---\n');

  const godComponents = findGodComponents(400);
  const docGodCount = parseDocumentedGodComponentCount(content) ?? 7;

  if (godComponents.length !== docGodCount) {
    const diff = godComponents.length - docGodCount;
    if (diff > 0) {
      result.fails.push(`God components: ${godComponents.length} (documented: ${docGodCount}) \u2014 ${diff} new violation(s)`);
    } else {
      result.warnings.push(`God components: ${godComponents.length} (documented: ${docGodCount}) \u2014 ${-diff} resolved, update docs`);
    }
  } else {
    result.passes.push(`God components: ${godComponents.length} (documented: ${docGodCount})`);
  }

  for (const gc of godComponents) {
    console.log(`     ${gc.lines}L  ${gc.file}`);
  }
  result.godComponentsNew = godComponents;

  // --- God CSS files (>500 LOC) ---
  const godCss = findGodCssFiles(500);
  if (godCss.length > 0) {
    console.log('\n  --- God CSS Files (>500 LOC) ---\n');
    for (const gc of godCss) {
      console.log(`     ${gc.lines}L  ${gc.file}`);
    }
  }

  // --- Summary ---
  console.log('\n' + '='.repeat(55));
  console.log('  RESULT');
  console.log('='.repeat(55));

  if (result.fails.length === 0 && result.warnings.length === 0) {
    console.log('\n  \u2713  Constitution is fresh. No updates needed.\n');
  } else {
    if (result.fails.length > 0) {
      console.log(`\n  X  ${result.fails.length} FAIL(s) \u2014 constitution update NEEDED:\n`);
      result.fails.forEach(f => console.log(`     - ${f}`));
    }
    if (result.warnings.length > 0) {
      console.log(`\n  ~  ${result.warnings.length} WARNING(s) \u2014 consider updating:\n`);
      result.warnings.forEach(w => console.log(`     - ${w}`));
    }
    console.log('');
  }

  return result;
}

// --- Run ---
const result = checkConstitution();
if (result.fails.length > 0) {
  process.exit(1);
}
