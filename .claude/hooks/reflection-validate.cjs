#!/usr/bin/env node
/**
 * POST-FLIGHT validation module — structured JSON validator for .postflight-done.
 *
 * Exports: validate(content) → { valid, errors[], warnings[], parsed }
 *
 * 13 validation rules + full cycle enhancement (rule 14) + cross-gate intelligence (rules 15-17).
 * Based on: CoVe (ACL 2024), Nature 2025 (evidence gates), Reflexion (NeurIPS 2023).
 *
 * NOT a standalone hook — require()'d by commit-gate.cjs.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const PREFLIGHT_TOKEN = path.join(ROOT, '.preflight-token');
const FULLCYCLE_ACTIVE = path.join(ROOT, '.fullcycle-active');

// Dynamic law count from docs/ filenames (future-proof: adding law29.md auto-detected)
const EXPECTED_LAWS = (() => {
  try {
    const lawNums = new Set();
    for (const f of fs.readdirSync(path.join(ROOT, 'docs'))) {
      const m = f.match(/^laws?(\d+)(?:-(\d+))?.*\.md$/);
      if (m) {
        const start = parseInt(m[1]);
        const end = m[2] ? parseInt(m[2]) : start;
        for (let i = start; i <= end; i++) lawNums.add(i);
      }
    }
    return lawNums.size > 0 ? lawNums.size : 28;
  } catch { return 28; }
})();
const EXPECTED_MIRRORS = 5; // Mirrors are conceptual (not file-based) — manual update when adding Mirror 6+

const EVIDENCE_MARKER = /(?:file:|line\s*\d|grep|git\s+(?:log|diff|show)|READ:|SEARCH|\.\w+\.tsx?:\d)/i;

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

  const isFullCycle = fs.existsSync(FULLCYCLE_ACTIVE);

  // Rule 2: timestamp — ISO, within 4h
  if (!parsed.timestamp || !/^\d{4}-\d{2}-\d{2}T/.test(parsed.timestamp)) {
    errors.push('Stale/missing timestamp');
  } else {
    const age = Date.now() - new Date(parsed.timestamp).getTime();
    if (age > 4 * 3600000 || age < -60000) {
      errors.push('Stale timestamp (>4h old or in the future)');
    }
  }

  // Rule 3: goal — non-empty string
  if (typeof parsed.goal !== 'string' || parsed.goal.trim().length === 0) {
    errors.push('Missing goal');
  }

  // Rule 4: changes — non-empty string array
  if (!Array.isArray(parsed.changes) || parsed.changes.length === 0) {
    errors.push('No changes listed');
  } else if (!parsed.changes.every(c => typeof c === 'string' && c.length > 0)) {
    errors.push('changes[] must contain non-empty strings');
  }

  // Rule 5: laws_checked — must match expected count
  if (parsed.laws_checked !== EXPECTED_LAWS) {
    errors.push(`laws_checked must be ${EXPECTED_LAWS} (got ${parsed.laws_checked})`);
  }

  // Rule 5b: Full Cycle — law_compliance TABLE required (not just a number)
  // In full cycle mode, postflight must include law_compliance: [{law: 1, status: "pass", evidence: "..."}]
  // This prevents the agent from writing laws_checked:28 without actually checking each law
  const isFullCycleForLaws = fs.existsSync(FULLCYCLE_ACTIVE) ||
    (() => { try { const ur = JSON.parse(fs.readFileSync(path.join(ROOT, '.user-requirements'), 'utf8')); return ur.constraints && ur.constraints.includes('full_cycle'); } catch { return false; } })();

  if (isFullCycleForLaws) {
    if (!Array.isArray(parsed.law_compliance)) {
      errors.push('FULL CYCLE requires law_compliance[] array — not just laws_checked:28. Each law needs {law, status, evidence}.');
    } else if (parsed.law_compliance.length < EXPECTED_LAWS) {
      errors.push(`FULL CYCLE law_compliance has ${parsed.law_compliance.length} entries, need ${EXPECTED_LAWS}. Each law must be verified.`);
    } else {
      // Verify each entry has required fields
      const invalid = parsed.law_compliance.filter(lc =>
        typeof lc.law !== 'number' || !lc.status || typeof lc.evidence !== 'string' || lc.evidence.length < 5
      );
      if (invalid.length > 0) {
        errors.push(`FULL CYCLE law_compliance has ${invalid.length} invalid entries. Each needs: {law: N, status: "pass"/"na", evidence: "file:line or reason"}`);
      }
    }
  }

  // Rule 6: mirrors_checked — must match expected count
  if (parsed.mirrors_checked !== EXPECTED_MIRRORS) {
    errors.push(`mirrors_checked must be ${EXPECTED_MIRRORS} (got ${parsed.mirrors_checked})`);
  }

  // Rule 7: ci_passed — boolean true
  if (parsed.ci_passed !== true) {
    errors.push('CI not passed (ci_passed must be true)');
  }

  // Rule 8-13: self_reflection object
  const sr = parsed.self_reflection;
  if (!sr || typeof sr !== 'object') {
    errors.push('Missing self_reflection section');
  } else {
    // Rule 9: what_went_wrong — non-empty string
    if (typeof sr.what_went_wrong !== 'string' || sr.what_went_wrong.trim().length === 0) {
      errors.push('self_reflection.what_went_wrong is empty');
    }

    // Rule 10: what_I_assumed — non-empty string
    if (typeof sr.what_I_assumed !== 'string' || sr.what_I_assumed.trim().length === 0) {
      errors.push('self_reflection.what_I_assumed is empty');
    }

    // Rule 11: what_I_verified — 20+ chars + evidence marker
    const minVerifiedLen = isFullCycle ? 50 : 20;
    if (typeof sr.what_I_verified !== 'string' || sr.what_I_verified.trim().length < minVerifiedLen) {
      errors.push(`self_reflection.what_I_verified needs ${minVerifiedLen}+ chars (got ${(sr.what_I_verified || '').length})`);
    } else if (!EVIDENCE_MARKER.test(sr.what_I_verified)) {
      errors.push('self_reflection.what_I_verified has no evidence marker (need file:, line, grep, git log/diff/show, READ:, SEARCH, or .file.ts:N)');
    }

    // Rule 12: git_history_checked — if true, must contain git hash
    if (sr.git_history_checked === true) {
      if (typeof sr.what_I_verified === 'string' && !/[a-f0-9]{7,}/.test(sr.what_I_verified)) {
        errors.push('git_history_checked=true but what_I_verified has no git hash (need 7+ hex chars)');
      }
    } else if (typeof sr.git_history_checked !== 'boolean') {
      errors.push('git_history_checked must be boolean');
    }

    // Rule 13: confidence — HIGH/MEDIUM/LOW
    if (!['HIGH', 'MEDIUM', 'LOW'].includes(sr.confidence)) {
      errors.push(`Invalid confidence: ${sr.confidence} (must be HIGH, MEDIUM, or LOW)`);
    }

    // Rule 14: Full Cycle enhancement
    if (isFullCycle) {
      if (sr.confidence === 'LOW') {
        errors.push('Full Cycle mode: confidence LOW is not allowed (must be HIGH or MEDIUM)');
      }
    }
  }

  // --- Evidence Veracity (rules 15-17) ---
  try {
    const { verify } = require('./evidence-veracity.cjs');
    const veracity = verify(parsed, {
      root: ROOT,
      preflightPath: PREFLIGHT_TOKEN,
    });

    // Rule 15+16: phantom files/hashes = BLOCKING
    for (const f of veracity.findings.filter(f => f.severity === 'ERROR')) {
      errors.push(`EVIDENCE FABRICATION: ${f.type} — ${f.detail}`);
    }
    // Rule 17: omissions/gaps = ADVISORY
    for (const f of veracity.findings.filter(f => f.severity === 'WARNING')) {
      warnings.push(`EVIDENCE GAP: ${f.type} — ${f.detail}`);
    }
    // Audit: log commit hash (V6)
    for (const f of veracity.findings.filter(f => f.severity === 'INFO')) {
      process.stderr.write(`EVIDENCE CHAIN: ${f.detail}\n`);
    }
  } catch (requireErr) {
    errors.push('Cannot load evidence-veracity.cjs: ' + requireErr.message);
  }

  // Rule 18: Proactive compliance — what_went_wrong must be substantive
  if (sr && typeof sr.what_went_wrong === 'string' && sr.what_went_wrong.trim().length < 10) {
    warnings.push('what_went_wrong suspiciously short (<10 chars) — genuine reflection required');
  }

  // Rule 19: Self-reflection structure — all 5 fields with minimum length
  if (sr) {
    const requiredFields = ['what_went_wrong', 'what_I_assumed', 'what_I_verified'];
    for (const field of requiredFields) {
      if (typeof sr[field] !== 'string' || sr[field].trim().length < 10) {
        warnings.push(`self_reflection.${field} too short (<10 chars) — provide substantive content`);
      }
    }
  }

  // Rule 20: Root Cause Mandate — what_went_wrong must address root causes (Law 21)
  if (sr && typeof sr.what_went_wrong === 'string' && !isFullCycle) {
    // For non-full-cycle, advisory reminder
  }
  if (sr && typeof sr.what_went_wrong === 'string') {
    const wwwLower = sr.what_went_wrong.toLowerCase();
    const hasRootCauseLanguage = wwwLower.includes('root cause') || wwwLower.includes('5 why') ||
      wwwLower.includes('architectural limit') || wwwLower.includes('sdk') ||
      wwwLower.includes('because') || wwwLower.includes('потому что') ||
      wwwLower.includes('причин');
    if (!hasRootCauseLanguage && sr.what_went_wrong.length > 20) {
      warnings.push('what_went_wrong describes WHAT happened but not WHY (root cause). Apply 5 Whys. (Law 21)');
    }
  }

  // --- Cross-Gate Intelligence (advisory, not blocking) ---
  try {
    const preflightContent = fs.readFileSync(PREFLIGHT_TOKEN, 'utf8').replace(/^\uFEFF/, '').trim();
    if (preflightContent.startsWith('{')) {
      const preflight = JSON.parse(preflightContent);

      // Feature 1: Goal Continuity Check
      if (preflight.goal && parsed.goal && preflight.goal !== parsed.goal) {
        warnings.push(`GOAL DRIFT: PRE-FLIGHT goal="${preflight.goal}" ≠ POST-FLIGHT goal="${parsed.goal}". Explain scope change.`);
      }

      // Feature 2: Scope Drift Detection
      if (Array.isArray(parsed.changes) && preflight.evidence && Array.isArray(preflight.evidence.read)) {
        const readFiles = preflight.evidence.read.map(r => r.split(':')[0].split('/').pop());
        for (const change of parsed.changes) {
          const changeFile = change.split('/').pop();
          if (!readFiles.some(rf => changeFile.includes(rf) || rf.includes(changeFile))) {
            warnings.push(`SCOPE DRIFT: Edited "${change}" but not in PRE-FLIGHT evidence.read[]. Was this planned?`);
          }
        }
      }

      // Feature 3: Assumption Accountability
      if (preflight.evidence && Array.isArray(preflight.evidence.assumed) && preflight.evidence.assumed.length > 0) {
        const verified = (sr && sr.what_I_verified) || '';
        const unverified = preflight.evidence.assumed.filter(a => !verified.toLowerCase().includes(a.toLowerCase().split(' ')[0]));
        if (unverified.length > 0) {
          warnings.push(`ASSUMPTION CHECK: PRE-FLIGHT assumed [${unverified.join(', ')}]. Did you verify these?`);
        }
      }
    }
  } catch { /* No preflight token or not JSON — skip cross-gate */ }

  // Rule 21: Requirement coverage check — cross-reference user requirements with postflight
  // Reads .user-requirements (created by preflight-inject.cjs from user's message)
  const USER_REQ_FILE = path.join(ROOT, '.user-requirements');
  try {
    if (fs.existsSync(USER_REQ_FILE)) {
      const reqs = JSON.parse(fs.readFileSync(USER_REQ_FILE, 'utf8'));
      const postflightText = JSON.stringify(parsed).toLowerCase();

      // Determine enforcement level: user demands "no simplification" → ERRORS, otherwise → warnings
      // Law of Irrationality: when user explicitly demands depth, system BLOCKS shortcuts
      const push = reqs.has_no_simplification ? errors : warnings;
      const modeLabel = reqs.has_no_simplification ? 'BLOCKED' : 'WARNING';

      // Check action coverage: each extracted action should appear in postflight evidence
      const allActions = [...(reqs.actions_ru || []), ...(reqs.actions_en || [])];
      if (allActions.length > 0) {
        const uncovered = allActions.filter(a => !postflightText.includes(a.toLowerCase()));
        if (uncovered.length > allActions.length * 0.5) {
          push.push(modeLabel + ' REQUIREMENT COVERAGE: ' + uncovered.length + '/' + allActions.length +
            ' user actions not addressed in postflight: [' + uncovered.join(', ') + ']. Scope reduction detected.');
        }
      }

      // If user demanded "no simplification" — enforce stricter standards (ERRORS)
      if (reqs.has_no_simplification) {
        // self_reflection fields must be extra substantive (≥100 chars each)
        if (sr) {
          const SHORT_FIELDS = ['what_went_wrong', 'what_I_assumed', 'what_I_verified'];
          for (const field of SHORT_FIELDS) {
            if (typeof sr[field] === 'string' && sr[field].length < 100) {
              errors.push('NO-SIMPLIFICATION BLOCKED: self_reflection.' + field + ' is ' +
                sr[field].length + ' chars (need ≥100 when user demands no simplification)');
            }
          }
        }
        // changes[] must have multiple entries (not just one file)
        if (Array.isArray(parsed.changes) && parsed.changes.length < 2 && reqs.total_actions > 2) {
          errors.push('NO-SIMPLIFICATION BLOCKED: only ' + parsed.changes.length +
            ' file(s) changed but user requested ' + reqs.total_actions + ' actions. Scope reduction.');
        }
      }

      // If user demanded "deep reflection" — confidence must not be LOW
      // Note: confidence must be exactly HIGH/MEDIUM/LOW (base rule). Deep reflection ensures it's HIGH.
      if (reqs.has_deep_reflection && sr) {
        if (typeof sr.confidence === 'string' && sr.confidence !== 'HIGH') {
          push.push(modeLabel + ' DEEP REFLECTION: confidence must be HIGH when deep reflection demanded (got "' + sr.confidence + '")');
        }
      }

      // If user demanded "best practices" — verify REAL web research was conducted
      // Minimum: 3 substantive search entries, ≥30 chars each, ≥2 referencing web sources
      // This ensures actual WebSearch/internet research, not just filling a field
      if (reqs.has_best_practices) {
        try {
          const preflightContent = fs.readFileSync(PREFLIGHT_TOKEN, 'utf8');
          const preflight = JSON.parse(preflightContent);
          const searchEntries = (preflight.evidence && Array.isArray(preflight.evidence.search)) ? preflight.evidence.search : [];
          const MIN_SEARCHES = 3;
          const MIN_CHARS = 30;

          if (searchEntries.length < MIN_SEARCHES) {
            push.push(modeLabel + ' BEST PRACTICES: only ' + searchEntries.length + ' search entries. Need ≥' + MIN_SEARCHES + ' for substantive research. Use WebSearch tool for each topic.');
          } else {
            // Each entry must be substantive (≥30 chars — real description of what was found)
            const shallow = searchEntries.filter(s => typeof s === 'string' && s.length < MIN_CHARS);
            if (shallow.length > 0) {
              push.push(modeLabel + ' BEST PRACTICES: ' + shallow.length + '/' + searchEntries.length + ' search entries too short (<' + MIN_CHARS + ' chars). Describe findings, not just keywords.');
            }
            // At least 2 entries must reference web/internet sources
            const WEB_EVIDENCE = /internet|web|search|http|url|arxiv|github|stackoverflow|blog|article|docs\.|documentation|codacy|sonar|research|source|paper|guide/i;
            const webCount = searchEntries.filter(s => typeof s === 'string' && WEB_EVIDENCE.test(s)).length;
            if (webCount < 2) {
              push.push(modeLabel + ' BEST PRACTICES: only ' + webCount + ' search entries reference web sources. Need ≥2 with internet evidence (URLs, article names, documentation references).');
            }
          }
        } catch { /* skip if no preflight */ }
      }
    }
  } catch { /* non-critical — don't block on requirement check failure */ }

  return { valid: errors.length === 0, errors, warnings, parsed };
}

module.exports = { validate };
