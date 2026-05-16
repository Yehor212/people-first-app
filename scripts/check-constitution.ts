/**
 * Constitution Freshness Check
 *
 * Compares ARCHITECTURE.md documented metrics against actual codebase state.
 * Detects drift: new god components, changed file counts, silent catch reappearance, etc.
 *
 * Usage: npx tsx scripts/check-constitution.ts
 * Exit: 0 = clean, 1 = drift detected (constitution update needed)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  metrics: {
    sourceFiles: number;
    testFiles: number;
    silentCatches: number;
    reactMemo: number;
    indexCssLines: number;
    inlineStyles: number;
    exhaustiveDeps: number;
    hookTests: number;
    hooks: number;
  };
}

// --- Helpers ---

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const CSS_EXTENSIONS = new Set(['.css']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage']);

function toPosix(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function isTestLikeFile(filePath: string): boolean {
  const normalized = toPosix(filePath);
  return (
    normalized.includes('/__tests__/') ||
    /\.(test|spec)\.[jt]sx?$/.test(normalized)
  );
}

function walkFiles(
  relativeDir: string,
  extensions: Set<string>,
  options: { excludeTests?: boolean } = {},
): string[] {
  const absDir = path.join(ROOT, relativeDir);
  if (!fs.existsSync(absDir)) return [];

  const out: string[] = [];
  const walk = (dirPath: string) => {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        if (options.excludeTests && entry.name === '__tests__') continue;
        walk(fullPath);
        continue;
      }

      if (!extensions.has(path.extname(entry.name))) continue;
      if (options.excludeTests && isTestLikeFile(fullPath)) continue;
      out.push(fullPath);
    }
  };

  walk(absDir);
  return out;
}

function listDirectFiles(
  relativeDir: string,
  extensions: Set<string>,
  options: { excludeTests?: boolean } = {},
): string[] {
  const absDir = path.join(ROOT, relativeDir);
  if (!fs.existsSync(absDir)) return [];

  return fs
    .readdirSync(absDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && extensions.has(path.extname(entry.name)))
    .map((entry) => path.join(absDir, entry.name))
    .filter((filePath) => !options.excludeTests || !isTestLikeFile(filePath));
}

function lineCount(filePath: string): number {
  return fs.readFileSync(filePath, 'utf8').split('\n').length;
}

function countRegexMatches(
  files: string[],
  regex: RegExp,
): number {
  let total = 0;
  for (const filePath of files) {
    const matches = fs.readFileSync(filePath, 'utf8').match(regex);
    if (matches) total += matches.length;
  }
  return total;
}

function countFilesContaining(
  files: string[],
  regex: RegExp,
): number {
  let total = 0;
  for (const filePath of files) {
    if (regex.test(fs.readFileSync(filePath, 'utf8'))) total += 1;
  }
  return total;
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
  return walkFiles('src', SOURCE_EXTENSIONS, { excludeTests: true }).length;
}

function getActualTestFiles(): number {
  return [...walkFiles('src', SOURCE_EXTENSIONS), ...walkFiles('test', SOURCE_EXTENSIONS)].filter(
    (filePath) => isTestLikeFile(filePath),
  ).length;
}

function getActualSilentCatches(): number {
  return countRegexMatches(
    walkFiles('src', SOURCE_EXTENSIONS, { excludeTests: true }),
    /\.catch.*=> \{\}/g,
  );
}

function getActualReactMemo(): number {
  return countFilesContaining(
    walkFiles('src', new Set(['.tsx']), { excludeTests: true }),
    /\bmemo\s*\(/,
  );
}

function getActualCssLines(): number {
  const cssPath = path.join(ROOT, 'src/index.css');
  return fs.existsSync(cssPath) ? lineCount(cssPath) : 0;
}

function getActualInlineStyles(): number {
  return countRegexMatches(
    walkFiles('src', new Set(['.tsx']), { excludeTests: true }),
    /style=\{\{/g,
  );
}

function getActualExhaustiveDeps(): number {
  return countRegexMatches(
    walkFiles('src', SOURCE_EXTENSIONS, { excludeTests: true }),
    /eslint-disable.*exhaustive-deps/g,
  );
}

function getActualHookTests(): number {
  return walkFiles('src/hooks/__tests__', SOURCE_EXTENSIONS).filter((filePath) =>
    isTestLikeFile(filePath),
  ).length;
}

function getActualHooks(): number {
  return listDirectFiles('src/hooks', new Set(['.ts']), { excludeTests: true }).length;
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
  return walkFiles('src', new Set(['.tsx']), { excludeTests: true })
    .map((filePath) => ({
      file: toPosix(path.relative(path.join(ROOT, 'src'), filePath)),
      lines: lineCount(filePath),
    }))
    .filter(({ file, lines }) => {
      if (lines <= threshold) return false;
      const isExempt = GOD_COMPONENT_EXEMPT.some((entry) => file.includes(entry));
      const isOutOfScope = GOD_COMPONENT_OUT_OF_SCOPE.some((entry) => file.includes(entry));
      return !isExempt && !isOutOfScope;
    })
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 40);
}

function findGodCssFiles(threshold: number): GodComponent[] {
  return walkFiles('src', CSS_EXTENSIONS)
    .map((filePath) => ({
      file: toPosix(path.relative(path.join(ROOT, 'src'), filePath)),
      lines: lineCount(filePath),
    }))
    .filter(({ lines }) => lines > threshold)
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 10);
}

// --- Main ---

export function checkConstitution(options: { quiet?: boolean } = {}): CheckResult {
  const archPath = path.join(ROOT, 'ARCHITECTURE.md');
  if (!fs.existsSync(archPath)) {
    console.error('ARCHITECTURE.md not found!');
    process.exit(2);
  }

  const content = fs.readFileSync(archPath, 'utf-8');
  const result: CheckResult = {
    fails: [],
    warnings: [],
    passes: [],
    godComponentsNew: [],
    metrics: {
      sourceFiles: 0,
      testFiles: 0,
      silentCatches: 0,
      reactMemo: 0,
      indexCssLines: 0,
      inlineStyles: 0,
      exhaustiveDeps: 0,
      hookTests: 0,
      hooks: 0,
    },
  };
  const log = options.quiet ? () => undefined : console.log;

  log('\n' + '='.repeat(55));
  log('  CONSTITUTION FRESHNESS CHECK');
  log('='.repeat(55) + '\n');

  const sourceFiles = getActualSourceFiles();
  const testFiles = getActualTestFiles();
  const silentCatches = getActualSilentCatches();
  const reactMemo = getActualReactMemo();
  const indexCssLines = getActualCssLines();
  const inlineStyles = getActualInlineStyles();
  const exhaustiveDeps = getActualExhaustiveDeps();
  const hookTests = getActualHookTests();
  const hooks = getActualHooks();

  result.metrics = {
    sourceFiles,
    testFiles,
    silentCatches,
    reactMemo,
    indexCssLines,
    inlineStyles,
    exhaustiveDeps,
    hookTests,
    hooks,
  };

  // --- Metric checks ---
  const checks: MetricCheck[] = [
    {
      name: 'Source files',
      documented: parseDocumentedMetric(content, 'Source files') ?? -1,
      actual: sourceFiles,
      tolerance: 5,
      direction: 'exact',
    },
    {
      name: 'Test files',
      documented: parseDocumentedMetric(content, 'Test files') ?? -1,
      actual: testFiles,
      tolerance: 3,
      direction: 'exact',
    },
    {
      name: 'Silent .catch',
      documented: parseDocumentedMetric(content, 'Silent') ?? -1,
      actual: silentCatches,
      tolerance: 0,
      direction: 'down-is-good',
    },
    {
      name: 'React.memo',
      documented: parseDocumentedMetric(content, 'React.memo') ?? -1,
      actual: reactMemo,
      tolerance: 3,
      direction: 'up-is-good',
    },
    {
      name: 'index.css LOC',
      documented: parseDocumentedMetric(content, 'index.css') ?? -1,
      actual: indexCssLines,
      tolerance: 50,
      direction: 'exact',
    },
    {
      name: 'Inline style={{}}',
      documented: parseDocumentedMetric(content, 'Inline style') ?? -1,
      actual: inlineStyles,
      tolerance: 10,
      direction: 'down-is-good',
    },
    {
      name: 'exhaustive-deps suppressions',
      documented: parseDocumentedMetric(content, 'exhaustive-deps') ?? -1,
      actual: exhaustiveDeps,
      tolerance: 2,
      direction: 'down-is-good',
    },
  ];

  for (const check of checks) {
    if (check.documented === -1) {
      result.warnings.push(`${check.name}: not found in ARCHITECTURE.md`);
      log(`  ?  ${check.name}: not documented`);
      continue;
    }

    const diff = check.actual - check.documented;
    const absDiff = Math.abs(diff);

    if (absDiff <= check.tolerance) {
      result.passes.push(`${check.name}: ${check.actual} (documented: ${check.documented})`);
      log(`  \u2713  ${check.name}: ${check.actual} (documented: ${check.documented})`);
    } else if (
      (check.direction === 'up-is-good' && diff > 0) ||
      (check.direction === 'down-is-good' && diff < 0)
    ) {
      result.warnings.push(`${check.name}: ${check.actual} (documented: ${check.documented}) \u2014 improved, update docs`);
      log(`  ~  ${check.name}: ${check.actual} (documented: ${check.documented}) \u2014 improved (+${diff}), update docs`);
    } else {
      result.fails.push(`${check.name}: ${check.actual} (documented: ${check.documented}) \u2014 drift of ${diff > 0 ? '+' : ''}${diff}`);
      log(`  X  ${check.name}: ${check.actual} (documented: ${check.documented}) \u2014 DRIFT ${diff > 0 ? '+' : ''}${diff}`);
    }
  }

  // --- Hook coverage ---
  const hookTotal = hooks;
  const hookPct = hookTotal > 0 ? Math.round((hookTests / hookTotal) * 100) : 0;
  const docHookPct = parseDocumentedMetric(content, 'Hook coverage') ?? 67;
  if (Math.abs(hookPct - docHookPct) > 5) {
    result.warnings.push(`Hook coverage: ${hookPct}% (documented: ${docHookPct}%)`);
    log(`  ~  Hook coverage: ${hookTests}/${hookTotal} (${hookPct}%) \u2014 documented: ${docHookPct}%`);
  } else {
    result.passes.push(`Hook coverage: ${hookPct}% (documented: ${docHookPct}%)`);
    log(`  \u2713  Hook coverage: ${hookTests}/${hookTotal} (${hookPct}%)`);
  }

  // --- God components ---
  log('\n  --- God Components (>400 LOC .tsx) ---\n');

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
    log(`     ${gc.lines}L  ${gc.file}`);
  }
  result.godComponentsNew = godComponents;

  // --- God CSS files (>500 LOC) ---
  const godCss = findGodCssFiles(500);
  if (godCss.length > 0) {
    log('\n  --- God CSS Files (>500 LOC) ---\n');
    for (const gc of godCss) {
      log(`     ${gc.lines}L  ${gc.file}`);
    }
  }

  // --- Summary ---
  log('\n' + '='.repeat(55));
  log('  RESULT');
  log('='.repeat(55));

  if (result.fails.length === 0 && result.warnings.length === 0) {
    log('\n  \u2713  Constitution is fresh. No updates needed.\n');
  } else {
    if (result.fails.length > 0) {
      log(`\n  X  ${result.fails.length} FAIL(s) \u2014 constitution update NEEDED:\n`);
      result.fails.forEach(f => log(`     - ${f}`));
    }
    if (result.warnings.length > 0) {
      log(`\n  ~  ${result.warnings.length} WARNING(s) \u2014 consider updating:\n`);
      result.warnings.forEach(w => log(`     - ${w}`));
    }
    log('');
  }

  return result;
}

// --- Run ---
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) {
  const result = checkConstitution();
  if (result.fails.length > 0) {
    process.exit(1);
  }
}
