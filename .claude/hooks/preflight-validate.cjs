#!/usr/bin/env node
/**
 * PRE-FLIGHT validation module — structured JSON validator for .preflight-token.
 *
 * Exports: validate(content) → { valid, errors[], warnings[], parsed }
 *
 * 22 validation rules + full cycle (rule 18) + evidence veracity (rules 19-22) + self-awareness (rules 23-25).
 * Based on: CoVe (ACL 2024), SteerConf (ArXiv 2503.02863), Pre-mortem (Klein 2007),
 *           Metacognitive monitoring (PNAS Nexus 2025), Decomposed confidence (ICLR 2025).
 *
 * NOT a standalone hook — require()'d by preflight-gate.cjs.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const FULLCYCLE_ACTIVE = path.join(ROOT, '.fullcycle-active');

const CONFIDENCE_KEYS = [
  'codebase_familiarity',
  'change_scope',
  'regression_risk',
  'platform_coverage',
  'state_integrity',
];

function validate(content) {
  const errors = [];
  const warnings = [];
  let parsed = null;

  // BOM strip (Windows) + trim
  const cleaned = (content || '').replace(/^\uFEFF/, '').trim();

  // Rule 1: Valid JSON
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { valid: false, errors: ['Not valid JSON'], warnings: [], parsed: null };
  }

  const isL1 = parsed.depth === 'L1';
  const isFullCycle = fs.existsSync(FULLCYCLE_ACTIVE);

  // Rule 2: timestamp — ISO format, within 4h
  if (!parsed.timestamp || !/^\d{4}-\d{2}-\d{2}T/.test(parsed.timestamp)) {
    errors.push('Stale/missing timestamp');
  } else {
    const age = Date.now() - new Date(parsed.timestamp).getTime();
    if (age > 4 * 3600000 || age < -60000) {
      errors.push('Stale timestamp (>4h old or in the future)');
    }
  }

  // Rule 3: goal — non-empty string, 5+ chars
  if (typeof parsed.goal !== 'string' || parsed.goal.trim().length < 5) {
    errors.push('Missing/too-short goal (need 5+ chars)');
  }

  // Rule 4: depth — L1, L2, or L3
  if (!['L1', 'L2', 'L3'].includes(parsed.depth)) {
    errors.push('Invalid depth level (must be L1, L2, or L3)');
  }

  // Rule 5: transmutation — non-empty string, 10+ chars (skip for L1)
  if (!isL1) {
    if (typeof parsed.transmutation !== 'string' || parsed.transmutation.trim().length < 10) {
      errors.push('Missing transmutation (Law 28) — need 10+ chars');
    }
  }

  // Rule 6: checks_completed — >= 4 (L1) or >= 7 (L2/L3)
  const minChecks = isL1 ? 4 : 7;
  if (typeof parsed.checks_completed !== 'number' || parsed.checks_completed < minChecks) {
    errors.push(`Insufficient checks (need >=${minChecks}, got ${parsed.checks_completed || 0})`);
  }

  // Rule 7: evidence — object with read[], search[], assumed[]
  const ev = parsed.evidence;
  if (!ev || typeof ev !== 'object') {
    errors.push('Missing evidence section');
  } else {
    if (!Array.isArray(ev.read)) errors.push('evidence.read must be an array');
    if (!Array.isArray(ev.search)) errors.push('evidence.search must be an array');
    if (!Array.isArray(ev.assumed)) errors.push('evidence.assumed must be an array');

    if (Array.isArray(ev.read) && Array.isArray(ev.search) && Array.isArray(ev.assumed)) {
      const total = ev.read.length + ev.search.length + ev.assumed.length;

      // Rule 8: evidence ratio — >30% assumed = FAIL
      if (total > 0 && ev.assumed.length / total > 0.3) {
        errors.push(`Too many assumptions: ${ev.assumed.length}/${total} (${Math.round(100 * ev.assumed.length / total)}%). Max 30%`);
      }

      // Rule 9: evidence minimum — at least 1 verified source
      if (ev.read.length + ev.search.length < 1) {
        errors.push('No verified evidence (need at least 1 READ or SEARCH)');
      }
    }
  }

  // Rule 10: pre_mortem — non-empty string, 15+ chars (skip for L1)
  if (!isL1) {
    if (typeof parsed.pre_mortem !== 'string' || parsed.pre_mortem.trim().length < 15) {
      errors.push('Missing pre-mortem analysis (need 15+ chars)');
    }
  }

  // Rule 11: confidence — object with 5 sub-scores
  const conf = parsed.confidence;
  if (!conf || typeof conf !== 'object') {
    errors.push('Missing confidence scores');
  } else {
    // Rule 12: each sub-score 1-9 (10 forbidden — SteerConf)
    const scores = [];
    for (const key of CONFIDENCE_KEYS) {
      const val = conf[key];
      if (typeof val !== 'number' || !Number.isInteger(val) || val < 1 || val > 9) {
        errors.push(`confidence.${key}: must be integer 1-9 (10 forbidden). Got: ${val}`);
      } else {
        scores.push(val);
      }
    }

    if (scores.length === 5) {
      // Rule 13: critical threshold — any <= 3 with GO = FAIL
      const hasLow = scores.some(s => s <= 3);
      if (hasLow && parsed.verdict === 'GO') {
        errors.push('Low confidence (<=3) requires STOP, not GO');
      }

      // Rule 14: overall_score — floor(avg), must match ±1
      const avg = scores.reduce((a, b) => a + b, 0) / 5;
      const expected = Math.floor(avg);
      if (typeof parsed.overall_score === 'number') {
        if (Math.abs(parsed.overall_score - expected) > 1) {
          errors.push(`Overall score mismatch: declared ${parsed.overall_score}, calculated ${expected} (avg=${avg.toFixed(1)})`);
        }
      } else {
        errors.push('Missing overall_score');
      }
    }
  }

  // Rule 15: unknowns — non-empty string, 5+ chars (skip for L1)
  if (!isL1) {
    if (typeof parsed.unknowns !== 'string' || parsed.unknowns.trim().length < 5) {
      errors.push('Must articulate unknowns (5+ chars)');
    }
  }

  // Rule 16: verdict — GO, STOP, or ASK
  if (!['GO', 'STOP', 'ASK'].includes(parsed.verdict)) {
    errors.push('Invalid verdict (must be GO, STOP, or ASK)');
  }

  // Rule 17: L1 relaxation — already handled by skipping rules 5, 10, 15

  // Rule 18: Full Cycle enhancement
  if (isFullCycle && !isL1) {
    if (typeof parsed.checks_completed !== 'number' || parsed.checks_completed < 7) {
      errors.push('Full Cycle mode: checks_completed must be >= 7 (no shortcuts)');
    }
  }

  // Rule 19: evidence.read[] file paths must exist on disk
  if (ev && Array.isArray(ev.read)) {
    // Import stripLineNumber from evidence-veracity (handles Windows drive letters)
    let stripLineNumber;
    try {
      stripLineNumber = require('./evidence-veracity.cjs').stripLineNumber;
    } catch { stripLineNumber = (e) => e.replace(/:\d+(-\d+)?$/, ''); }

    for (const entry of ev.read) {
      const filePath = stripLineNumber(entry);
      const resolved = path.isAbsolute(filePath)
        ? filePath
        : path.join(ROOT, filePath);
      if (!fs.existsSync(resolved)) {
        errors.push(`evidence.read[] references nonexistent file: ${entry}`);
      }
    }
  }

  // Rule 20: Full Cycle — evidence.read[] MUST include ALL law spec files
  // Auto-discovered from docs/ directory (future-proof: adding law29.md auto-detected)
  if (isFullCycle) {
    let LAW_SPECS;
    try {
      const docsDir = path.join(ROOT, 'docs');
      LAW_SPECS = fs.readdirSync(docsDir)
        .filter(f => (f.startsWith('law') || f === 'visual-aesthetic.md') && f.endsWith('.md'))
        .map(f => f.replace('.md', '')); // strip extension for fuzzy matching
    } catch {
      LAW_SPECS = [
        'laws1-7', 'laws8-13', 'laws14-15', 'law16-mirror', 'laws17-20',
        'law21-surgeon', 'law22-artisan', 'law23-philosopher', 'law24-empathy',
        'law25-concurrency', 'law26-techdebt', 'law27-ratchet', 'law28-alchemist',
        'visual-aesthetic',
      ];
    }
    const readJoined = (ev && Array.isArray(ev.read) ? ev.read : []).join(' ');
    const missing = LAW_SPECS.filter(s => !readJoined.includes(s));
    if (missing.length > 0) {
      errors.push(`Full Cycle: evidence.read[] missing ${missing.length} law specs: ${missing.join(', ')}`);
    }
  }

  // Rule 21: High confidence (>=7) needs substantive evidence
  if (conf && ev && Array.isArray(ev.read)) {
    const highScores = CONFIDENCE_KEYS.filter(k => conf[k] >= 7);
    if (highScores.length >= 3 && ev.read.length < 3) {
      warnings.push(`${highScores.length} confidence scores >=7 but only ${ev.read.length} READ items — inflate risk`);
    }
  }

  // Rule 22: Depth scope check — L1 with large scope = likely Migration Confusion (#8)
  if (isL1 && ev && Array.isArray(ev.read) && ev.read.length > 3) {
    warnings.push('Depth L1 but evidence.read[] has >3 files — consider upgrading to L2');
  }

  // ═══════════════════════════════════════════════════════════════════
  // ANALYSIS DEPTH ENFORCEMENT (Rules 23-35)
  // Rules 23-26: Upgraded from WARNING → ERROR for L2+
  // Rules 27-35: New content quality checks (anti-simplification)
  // ═══════════════════════════════════════════════════════════════════

  // Rule 23: Scope boundaries — L2+ MUST declare scope (upgraded WARNING → ERROR)
  if (!isL1) {
    if (typeof parsed.scope_boundaries === 'string' && parsed.scope_boundaries.length >= 10) {
      // Good — has scope boundaries
    } else {
      errors.push('L2+ requires scope_boundaries (≥10 chars) — what will you do and NOT do? (Check 5)');
    }
  }

  // Rule 24: Post-verification plan — L2+ MUST declare how to prove success (upgraded WARNING → ERROR)
  if (!isL1) {
    if (typeof parsed.post_verification_plan === 'string' && parsed.post_verification_plan.length >= 10) {
      // Good — has verification plan
    } else {
      errors.push('L2+ requires post_verification_plan (≥10 chars) — how will you PROVE success? (Check 10)');
    }
  }

  // Rule 25: Anti-pattern scan — L2+ MUST list checked anti-patterns (upgraded WARNING → ERROR)
  if (!isL1) {
    if (Array.isArray(parsed.anti_patterns_checked) && parsed.anti_patterns_checked.length >= 1) {
      // Good — has anti-pattern awareness
    } else {
      errors.push('L2+ requires anti_patterns_checked (array with ≥1 entry) — which anti-patterns apply? (Check 7)');
    }
  }

  // Rule 26: Failure modes must reference specific files (L2+) (upgraded WARNING → ERROR)
  if (!isL1 && typeof parsed.pre_mortem === 'string') {
    if (!parsed.pre_mortem.includes('/') && !parsed.pre_mortem.includes('file:') && !parsed.pre_mortem.includes('.ts') && !parsed.pre_mortem.includes('.cjs')) {
      errors.push('L2+ pre_mortem must reference specific files (include / or .ts or .cjs) — no abstract failure modes (Check 3)');
    }
  }

  // Rule 27: pre_mortem content quality — must be substantive (L2+)
  if (!isL1 && typeof parsed.pre_mortem === 'string') {
    if (parsed.pre_mortem.length < 50) {
      errors.push('L2+ pre_mortem must be ≥50 chars (got ' + parsed.pre_mortem.length + ') — be specific about failure modes');
    }
  }

  // Rule 28: scope_boundaries content quality — must reference files (L2+)
  if (!isL1 && typeof parsed.scope_boundaries === 'string' && parsed.scope_boundaries.length >= 10) {
    if (parsed.scope_boundaries.length < 30) {
      errors.push('L2+ scope_boundaries must be ≥30 chars (got ' + parsed.scope_boundaries.length + ') — list specific files');
    }
    if (!parsed.scope_boundaries.includes('/') && !parsed.scope_boundaries.includes('src') && !parsed.scope_boundaries.includes('.ts') && !parsed.scope_boundaries.includes('.cjs')) {
      errors.push('L2+ scope_boundaries must reference files (include / or src or .ts or .cjs)');
    }
  }

  // Rule 29: post_verification_plan must contain concrete commands (L2+)
  if (!isL1 && typeof parsed.post_verification_plan === 'string' && parsed.post_verification_plan.length >= 10) {
    if (parsed.post_verification_plan.length < 30) {
      errors.push('L2+ post_verification_plan must be ≥30 chars (got ' + parsed.post_verification_plan.length + ') — list specific commands');
    }
    const CMD_PATTERN = /npm|node|git|vitest|eslint|tsc|grep|ci:|ratchet/i;
    if (!CMD_PATTERN.test(parsed.post_verification_plan)) {
      errors.push('L2+ post_verification_plan must reference concrete commands (npm, node, git, vitest, eslint, tsc, grep, ci:, ratchet)');
    }
  }

  // Rule 30: transmutation must distinguish ASK vs NEED (L2+)
  if (!isL1 && typeof parsed.transmutation === 'string') {
    if (parsed.transmutation.length < 30) {
      warnings.push('L2+ transmutation should be ≥30 chars — decompose user ASK vs actual NEED');
    }
  }

  // Rule 31: unknowns must be specific, not dismissive (L2+)
  if (!isL1 && typeof parsed.unknowns === 'string') {
    const DISMISSIVE = /^(none|no|nothing|n\/a|na|nil|-)$/i;
    if (DISMISSIVE.test(parsed.unknowns.trim())) {
      errors.push('L2+ unknowns cannot be dismissive ("none"/"n/a") — there are ALWAYS unknowns. List at least one.');
    }
    if (parsed.unknowns.length < 15) {
      warnings.push('L2+ unknowns is very short (' + parsed.unknowns.length + ' chars) — be specific about what you do NOT know');
    }
  }

  // Rule 32: overall_score must be consistent with sub-scores (±2 of average)
  if (conf && typeof parsed.overall_score === 'number') {
    const scores = CONFIDENCE_KEYS.map(k => conf[k]).filter(v => typeof v === 'number');
    if (scores.length >= 3) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (Math.abs(parsed.overall_score - avg) > 2) {
        warnings.push('overall_score (' + parsed.overall_score + ') diverges >2 from confidence average (' + avg.toFixed(1) + ') — calibrate');
      }
    }
  }

  // Rule 33: goal must contain success criterion (L2+)
  if (!isL1 && typeof parsed.goal === 'string') {
    const HAS_CRITERION = /success|done when|done\s*:|pass|verify|result/i;
    if (!HAS_CRITERION.test(parsed.goal) && parsed.goal.length < 50) {
      warnings.push('L2+ goal should include SUCCESS criterion or DONE WHEN clause (Law 28 transmutation)');
    }
  }

  // Rule 34: evidence.search[] items must have actual content (L2+)
  if (!isL1 && ev && Array.isArray(ev.search)) {
    const emptySearches = ev.search.filter(s => typeof s === 'string' && s.trim().length < 3);
    if (emptySearches.length > 0) {
      warnings.push('evidence.search[] has ' + emptySearches.length + ' empty/trivial item(s) — search terms must be substantive');
    }
  }

  // Rule 35: evidence balance — L2+ with 0 search items and high confidence is suspicious
  if (!isL1 && ev) {
    const readCount = Array.isArray(ev.read) ? ev.read.length : 0;
    const searchCount = Array.isArray(ev.search) ? ev.search.length : 0;
    if (searchCount === 0 && readCount > 0 && conf) {
      const highScores = CONFIDENCE_KEYS.filter(k => conf[k] >= 7);
      if (highScores.length >= 4) {
        warnings.push('No search evidence but ' + highScores.length + ' high confidence scores — did you verify assumptions with Grep?');
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings, parsed };
}

module.exports = { validate };
