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

  // Rule 54: L1 Abuse Prevention — force upgrade to L2 if task is clearly not trivial
  if (isL1) {
    const goalLen = (parsed.goal || '').length;
    const readCount = (parsed.evidence && Array.isArray(parsed.evidence.read)) ? parsed.evidence.read.length : 0;
    if (goalLen > 100 || readCount > 3) {
      errors.push('L1 DEPTH ABUSE BLOCKED: depth=L1 but goal is ' + goalLen + ' chars and ' + readCount + ' files read. Tasks this complex require L2. Change depth to L2.');
    }
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
      errors.push('L2+ goal should include SUCCESS criterion or DONE WHEN clause (Law 28 transmutation)');
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

  // ═══════════════════════════════════════════════════════════════════
  // REASONING QUALITY ENFORCEMENT (Rules 36-38)
  // Based on: OpenAI CoT Monitorability, AWS Semi-Formal, Peirce Abduction
  // ═══════════════════════════════════════════════════════════════════

  // Rule 36: CoT Monitorability — flag SUSPICIOUS/OPAQUE preflight tokens (L2+)
  // OpenAI research: reasoning traces can be CLEAN, SUSPICIOUS, or OPAQUE
  // SUSPICIOUS = generic/template-like. OPAQUE = all fields present but no real evidence.
  if (!isL1 && typeof parsed.pre_mortem === 'string' && typeof parsed.transmutation === 'string') {
    const fields = [parsed.pre_mortem, parsed.transmutation, parsed.unknowns || ''];
    const allText = fields.join(' ').toLowerCase();
    // SUSPICIOUS: same word repeated >3 times = template fill
    const words = allText.split(/\s+/).filter(w => w.length >= 4);
    const wordCounts = {};
    for (const w of words) wordCounts[w] = (wordCounts[w] || 0) + 1;
    const repeated = Object.entries(wordCounts).filter(([, c]) => c > 3);
    if (repeated.length > 2) {
      warnings.push('COT SUSPICIOUS: ' + repeated.length + ' words repeated >3 times — possible template fill, not genuine reasoning');
    }
    // OPAQUE: fields present but no concrete file/line evidence
    const hasEvidence = /[a-z]+\.(ts|tsx|cjs|js|md)/.test(allText) || /:\d+/.test(allText);
    if (!hasEvidence && fields.every(f => f.length > 20)) {
      warnings.push('COT OPAQUE: all fields filled but no file:line evidence — reasoning may be disconnected from code');
    }
  }

  // Rule 37: Semi-Formal Reasoning — pre_mortem must have causal structure (L2+ full cycle)
  // AWS: "premise_A ∧ premise_B → conclusion" improves accuracy 78%→87%
  // Check: pre_mortem contains causal connectors (if/then, because, therefore, causes, leads to)
  if (!isL1 && isFullCycle && typeof parsed.pre_mortem === 'string') {
    const CAUSAL = /\b(if|when|because|therefore|causes|leads to|results in|implies|means that|due to|since|consequently)\b/i;
    if (!CAUSAL.test(parsed.pre_mortem)) {
      errors.push('FULL CYCLE pre_mortem must contain CAUSAL reasoning (if/because/therefore/causes). Semi-formal: premise → conclusion. (AWS research: +9% accuracy)');
    }
  }

  // Rule 38+45: Trimodal Reasoning Enforcement — deduction + induction + abduction (L2+)
  // Research: Apple ML — cognitive biases reduced by trimodal; Microsoft MAR — decomposition reveals root causes
  // Deduction (Socrates): from rules → specific. Induction: from observations → pattern. Abduction (Peirce): symptoms → best explanation.
  if (!isL1 && typeof parsed.pre_mortem === 'string') {
    const DEDUCTION = /\b(if\s+.{3,}\s+then|therefore|must\s+be|from\s+\w+\s+follows|by\s+definition|all\s+\w+\s+are|implies|consequently|because.*will)\b/i;
    const INDUCTION = /\b(pattern|observed|trend|evidence\s+indicates|repeated|in\s+most\s+cases|data\s+suggests|shows\s+that|consistently|across\s+\d+)\b/i;
    const ABDUCTION = /\b(root\s+cause|best\s+explanation|5\s+whys|hypothesis|most\s+likely|probable\s+cause|suggests\s+that|diagnos|symptom)\b/i;

    const present = [];
    if (DEDUCTION.test(parsed.pre_mortem)) present.push('deduction');
    if (INDUCTION.test(parsed.pre_mortem)) present.push('induction');
    if (ABDUCTION.test(parsed.pre_mortem)) present.push('abduction');

    if (present.length < 2) {
      errors.push('TRIMODAL REASONING BLOCKED: pre_mortem uses only ' + present.length +
        '/3 reasoning types: [' + (present.join(', ') || 'none') + ']. Need ≥2 of: ' +
        'deduction (if/then, therefore, must be), ' +
        'induction (pattern, observed, trend, evidence indicates), ' +
        'abduction (root cause, hypothesis, most likely, best explanation). ' +
        '(Research: Apple ML — trimodal prevents anchoring+hindsight+confirmation bias)');
    }
  }

  // Rule 39: Diagnostic Exhaustion — enumeration required for diagnostic/investigation claims (L2+)
  // Anti-satisficing: if pre_mortem mentions "checked" or "verified", must list ALL sources checked
  // UPGRADED: L2+ = ERROR (blocking), L1 = warning (advisory)
  if (!isL1 && typeof parsed.pre_mortem === 'string') {
    const DIAGNOSTIC_CLAIM = /\b(checked|verified|investigated|inspected|confirmed|examined|searched|looked at|reviewed)\b/i;
    if (DIAGNOSTIC_CLAIM.test(parsed.pre_mortem)) {
      // Must have enumeration pattern: [source] ✓ or [source] ✗ or "Sources:" list
      const ENUMERATION = /(\bsources?\s*:|[\w-]+\s*[✓✗✅❌]|checked.*:.*,)/i;
      if (!ENUMERATION.test(parsed.pre_mortem)) {
        errors.push('DIAGNOSTIC EXHAUSTION BLOCKED: pre_mortem claims "checked/verified" but has no enumeration of ALL sources checked. List: "Sources: [X] ✓, [Y] ✓, [Z] ✗ reason". Satisficing = finding first hit and stopping.');
      }
    }
  }

  // Rule 40: diagnostic_sources array validation (CLOSED LOOP part 1)
  // If diagnostic_sources present, must have ≥2 entries (non-empty strings)
  // This is the PLANNING side — postflight cross-reference is the EXECUTION side
  if (Array.isArray(parsed.diagnostic_sources)) {
    const validSources = parsed.diagnostic_sources.filter(s => typeof s === 'string' && s.trim().length > 0);
    if (validSources.length < 2) {
      errors.push('DIAGNOSTIC EXHAUSTION: diagnostic_sources has ' + validSources.length + ' valid entries (need ≥2). Enumerate ALL possible sources, not just the obvious one.');
    }
  }

  // Rule 40b: diagnostic_sources MANDATORY when pre_mortem contains investigation/audit/fix language (L2+)
  // ANTI-BYPASS: prevents agent from simply omitting diagnostic_sources to skip the closed loop
  if (!isL1 && !Array.isArray(parsed.diagnostic_sources) && typeof parsed.pre_mortem === 'string') {
    const INVESTIGATION_LANGUAGE = /\b(bug|fix|audit|investigat|diagnos|debug|error|issue|problem|failure|broken|vulnerabilit|401|500|crash)/i;
    if (INVESTIGATION_LANGUAGE.test(parsed.pre_mortem)) {
      errors.push('DIAGNOSTIC EXHAUSTION BLOCKED: pre_mortem describes investigation/fix but no diagnostic_sources[] provided. ' +
        'You MUST enumerate all sources to check. Omitting diagnostic_sources = bypassing the closed loop.');
    }
  }

  // Rule 41: MECE minimum categories — for L2+ bug/audit tasks, diagnostic_sources should cover multiple dimensions
  // Research: MECE (McKinsey) + Forced Categorical Decomposition (UBC FSE 2025, +43.67% F1)
  // Advisory: warns if diagnostic_sources looks like a narrow single-dimension list
  if (!isL1 && Array.isArray(parsed.diagnostic_sources) && parsed.diagnostic_sources.length >= 2) {
    // Check if categories span multiple dimensions (not all from same domain)
    const DIMENSION_MARKERS = {
      logic: /logic|code|function|implementation|algorithm/i,
      security: /secur|auth|rls|jwt|xss|inject|permiss/i,
      state: /state|store|zustand|indexeddb|dexie|sync|hydrat/i,
      i18n: /i18n|translat|rtl|babel|language/i,
      ui: /visual|theme|css|tailwind|\bui\b|layout|responsive|touch|motion/i,
      infra: /supabase|api|edge|postgres|cron|firebase|deploy/i,
      test: /test|vitest|coverage|regression/i,
      pattern: /pattern|other.file|same.pattern|grep|project.wide/i,
    };
    const coveredDimensions = Object.entries(DIMENSION_MARKERS)
      .filter(([, regex]) => parsed.diagnostic_sources.some(s => regex.test(s)))
      .map(([dim]) => dim);
    if (coveredDimensions.length < 2) {
      // UPGRADED: 1 dimension = ERROR (too narrow), 0 = ERROR
      // Research: forced categorical decomposition +43.67% F1 (UBC FSE 2025)
      // Anti-Pattern #14 Goodhart: agent picks narrow sources to satisfy Rule 40 minimum
      errors.push('MECE BLOCKED: diagnostic_sources covers only ' + coveredDimensions.length +
        ' dimension(s): [' + coveredDimensions.join(', ') + ']. Need ≥2 dimensions. ' +
        'Choose from: logic, security, state, i18n, ui, infra, test, pattern-search. ' +
        'Research: single-dimension analysis misses 43.67% of issues (UBC FSE 2025).');
    }
  }

  // Rule 42: Observable Confidence — cross-check self-reported confidence against observable evidence (L2+)
  // Research: Nuclear two-person rule, IMDA 2025 self-report unreliability, METR reward hacking
  // Instead of trusting self-reported scores, verify that evidence.read[] and evidence.search[] counts
  // correlate with claimed confidence. High confidence + zero searches = suspicious.
  if (!isL1 && parsed.confidence && parsed.evidence) {
    const readCount = Array.isArray(parsed.evidence.read) ? parsed.evidence.read.length : 0;
    const searchCount = Array.isArray(parsed.evidence.search) ? parsed.evidence.search.length : 0;
    const assumedCount = Array.isArray(parsed.evidence.assumed) ? parsed.evidence.assumed.length : 0;
    const totalEvidence = readCount + searchCount;
    const avgConfidence = typeof parsed.confidence === 'object'
      ? Math.round(Object.values(parsed.confidence).filter(v => typeof v === 'number').reduce((a, b) => a + b, 0) /
        Math.max(Object.values(parsed.confidence).filter(v => typeof v === 'number').length, 1))
      : 0;

    // High confidence (≥7) with very low evidence (≤1 read + 0 search) = Goodhart Gaming (#14)
    // UPGRADED: WARNING → ERROR. Advisory = ignored (proven 4x this session).
    if (avgConfidence >= 7 && totalEvidence <= 1) {
      errors.push('GOODHART BLOCKED (Anti-Pattern #14): avg confidence ' + avgConfidence +
        '/9 but only ' + totalEvidence + ' evidence items (read:' + readCount + ', search:' + searchCount +
        '). High confidence requires substantial evidence. Read more files or lower confidence.');
    }

    // More assumed than verified = low confidence, not high
    if (assumedCount > totalEvidence && avgConfidence >= 6) {
      errors.push('GOODHART BLOCKED (Anti-Pattern #14): ' + assumedCount + ' assumptions vs ' + totalEvidence +
        ' verified items, but confidence=' + avgConfidence + '. Assumed > Verified — lower confidence or verify assumptions.');
    }
  }

  // Rule 43: Convenience Bias Detection — full audit must check ALL stack layers (Anti-Pattern #16)
  // Incident: agent audited only local hooks, missed 401 errors in Supabase for 2 days
  // When goal mentions "all"/"audit"/"everything"/"полный анализ", diagnostic_sources must span multiple layers
  if (!isL1 && typeof parsed.goal === 'string' && Array.isArray(parsed.diagnostic_sources)) {
    const AUDIT_LANGUAGE = /\b(all|every|everything|full|audit|полн|все|всё|весь|анализ|complete|exhaustive|comprehensive)\b/i;
    if (AUDIT_LANGUAGE.test(parsed.goal)) {
      const srcJoined = parsed.diagnostic_sources.join(' ').toLowerCase();

      // Check each META-LAYER is represented
      const LAYER_CHECKS = [
        { name: 'backend', markers: /supabase|edge.func|postgres|api.log|auth.log|cron|database|backend|server|vault/, msg: 'Supabase (api, auth, edge-functions, postgres, cron)' },
        { name: 'mobile', markers: /capacitor|android|ios|platform|mobile|touch|safe.area|back.handler/, msg: 'Mobile (capacitor, android, ios, touch targets, safe areas)' },
        { name: 'local', markers: /src|hook|component|code|lint|tsc|test|local|type/, msg: 'Local code (src, types, lint, tests)' },
      ];
      const missing = LAYER_CHECKS.filter(lc => !lc.markers.test(srcJoined));

      if (missing.length > 0) {
        // BLOCKING (ERROR) when ≥2 layers missing — strong signal of convenience bias
        // WARNING when 1 layer missing — might be intentionally scoped
        const push = missing.length >= 2 ? errors : warnings;
        const label = missing.length >= 2 ? 'BLOCKED' : 'WARNING';
        push.push('CONVENIENCE BIAS ' + label + ' (Anti-Pattern #16): goal mentions full audit but diagnostic_sources missing ' +
          missing.length + ' layer(s): [' + missing.map(m => m.name + ': ' + m.msg).join('; ') + ']. ' +
          'Use META-LAYER template: local + backend + mobile + external + CI/CD. ' +
          'Incident: missed 401s in Supabase for 2 days because only local hooks were audited.');
      }
    }
  }

  // Rule 44: Preflight Reasoning Depth — pre_mortem must show multi-layered analysis (L2+)
  // Research: R2A2 Responsible Agentic Reasoning — 6 layers: decision, evidence, root cause, alternative, verification, audit
  // Anti-Pattern #14 Goodhart: agent fills pre_mortem with template text instead of genuine analysis
  if (!isL1 && typeof parsed.pre_mortem === 'string') {
    const REASONING_LAYERS = {
      evidence: /\[READ:|file:|\.tsx?:|\.cjs:|line \d|grep|SEARCH/i,
      rootCause: /root cause|5 whys|because|therefore|causes|reason/i,
      specifics: /\d+|:\d+|error|warning|count|status|bytes|ms|rows/i,
      alternative: /instead|vs|alternative|considered|option|could also/i,
    };
    const layersPresent = Object.entries(REASONING_LAYERS)
      .filter(([, regex]) => regex.test(parsed.pre_mortem))
      .map(([name]) => name);

    if (layersPresent.length < 2) {
      errors.push('REASONING DEPTH BLOCKED: pre_mortem has only ' + layersPresent.length +
        ' reasoning layer(s): [' + layersPresent.join(', ') + ']. ' +
        'Need ≥2 of: evidence (file refs), rootCause (because/therefore), specifics (numbers), alternative (considered/vs). ' +
        'Advisory = ignored. (R2A2 framework — multi-layered reasoning catches 43% more issues)');
    }
  }

  // Rule 46: Citing Without Reading — evidence.read[] must cover diagnostic_sources (Anti-Pattern #3)
  // If agent claims 5 diagnostic sources but only read 2 files → citing without reading
  if (!isL1 && Array.isArray(parsed.diagnostic_sources) && parsed.evidence && Array.isArray(parsed.evidence.read)) {
    const sourceCount = parsed.diagnostic_sources.filter(s => typeof s === 'string' && s.trim().length > 0).length;
    const readCount = parsed.evidence.read.length;
    // Allow 2x ratio (reading 3 files for 5 sources is reasonable — files can cover multiple sources)
    if (sourceCount > 0 && readCount < Math.ceil(sourceCount / 2)) {
      errors.push('CITING WITHOUT READING BLOCKED (Anti-Pattern #3): ' + readCount + ' files read but ' +
        sourceCount + ' diagnostic sources enumerated. Read at least ' + Math.ceil(sourceCount / 2) +
        ' files to cover your sources. Cannot claim analysis without reading.');
    }
  }

  // Rule 48: Law 2 (Tabula Rasa) — L2+ must read code before editing
  if (!isL1 && parsed.evidence && Array.isArray(parsed.evidence.read) && parsed.evidence.read.length === 0) {
    errors.push('LAW 2 TABULA RASA BLOCKED: L2+ task with 0 evidence.read[] entries. Read code before planning changes.');
  }

  // Rule 49: Law 4 (Surgical) — scope_boundaries must define what NOT to touch
  if (!isL1 && typeof parsed.scope_boundaries === 'string' && parsed.scope_boundaries.length > 0) {
    if (!/will\s*not|won't|не\s*буд|не\s*трогаю|exclude/i.test(parsed.scope_boundaries)) {
      errors.push('LAW 4 SURGICAL BLOCKED: scope_boundaries must say what you will NOT touch. One-sided scope = creep risk.');
    }
  }

  // Rule 50: Law 11 (Scope Holism) — multi-component goal needs ≥3 diagnostic sources
  if (!isL1 && typeof parsed.goal === 'string' && Array.isArray(parsed.diagnostic_sources)) {
    if (/и\s+так|plus|also|\ball\b|вс[еёіь]|полн|entire|whole|multiple|several/i.test(parsed.goal) && parsed.diagnostic_sources.length < 3) {
      errors.push('LAW 11 SCOPE HOLISM BLOCKED: Multi-scope goal but only ' + parsed.diagnostic_sources.length + ' diagnostic_sources. Need ≥3.');
    }
  }

  // Rule 51: Law 19 (Clock) — Date.now() in test context = time-drift
  if (parsed.evidence && Array.isArray(parsed.evidence.read)) {
    const hasTestFiles = parsed.evidence.read.some(function(f) { return /\.test\.(ts|tsx)/.test(f); });
    if (hasTestFiles && typeof parsed.pre_mortem === 'string' && /Date\.now|new\s+Date\(\)/.test(parsed.pre_mortem)) {
      errors.push('LAW 19 CLOCK BLOCKED: Date.now()/new Date() in test context. Use fixed dates. Incident: makeTestHabit drift.');
    }
  }

  // Rule 52: Law 22 (Artisan) — pre_mortem needs ≥2 file:line refs for L2+
  if (!isL1 && typeof parsed.pre_mortem === 'string') {
    var fileLineRefs = (parsed.pre_mortem.match(/[a-zA-Z0-9_/.-]+\.(ts|tsx|cjs|js|json):[0-9]+/g) || []);
    if (fileLineRefs.length < 2) {
      errors.push('LAW 22 ARTISAN BLOCKED: pre_mortem has ' + fileLineRefs.length + ' file:line refs (need ≥2 for L2+). Cite specific code.');
    }
  }

  // Rule 53: Law 24 (Empathy) — user-facing tasks must state user impact in transmutation
  if (typeof parsed.goal === 'string' && /UI|modal|button|dialog|toast|notification|error.message|пользовател/i.test(parsed.goal)) {
    if (typeof parsed.transmutation === 'string' && !/user|пользовател|UX|experience|impact|видит|заметит/i.test(parsed.transmutation)) {
      errors.push('LAW 24 EMPATHY BLOCKED: User-facing goal but transmutation has no user impact statement.');
    }
  }

  return { valid: errors.length === 0, errors, warnings, parsed };
}

module.exports = { validate };
