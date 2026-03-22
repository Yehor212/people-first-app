#!/usr/bin/env node
/**
 * Evidence Veracity Module — shared by reflection-validate.cjs.
 *
 * 6 checks that verify SUBSTANCE of evidence, not just FORM:
 *   V1: File Existence  — every path in changes[] exists on disk
 *   V2: Git Hash Reality — every 7+ hex in what_I_verified exists in git
 *   V3: Changes Match    — changes[] ↔ git diff bidirectional comparison
 *   V4: CI Recency       — ci_passed:true cross-referenced with .ci-evidence
 *   V5: Preflight Evidence — evidence.read[] from .preflight-token files exist
 *   V6: Commit Hash Capture — record current HEAD at validation time (audit)
 *
 * Exports: verify(parsed, options) → { findings[] }
 * Each finding: { type, detail, severity: 'ERROR'|'WARNING'|'INFO' }
 *
 * Fabrication = ERROR (blocking). Omission = WARNING (advisory). Audit = INFO.
 * Security: git hashes validated as /^[a-f0-9]{7,40}$/ before execSync.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Strip :lineNumber suffix from a path, handling Windows drive letters (c:/...).
 * "src/App.tsx:42" → "src/App.tsx"
 * "c:/project/file.ts:42" → "c:/project/file.ts"
 * "docs/laws1-7.md:1-50" → "docs/laws1-7.md"
 */
function stripLineNumber(entry) {
  // Match trailing :digits or :digits-digits (line ranges)
  return entry.replace(/:\d+(-\d+)?$/, '');
}

function verify(parsed, options = {}) {
  const root = options.root || process.cwd();
  const preflightPath = options.preflightPath || path.join(root, '.preflight-token');
  const ciEvidencePath = options.ciEvidencePath || path.join(root, '.ci-evidence');
  const findings = [];

  // V1: File Existence — every path in changes[] exists on disk
  if (Array.isArray(parsed.changes)) {
    // Get deleted/renamed files from git to suppress false positives
    let deletedFiles = new Set();
    try {
      const nameStatus = execSync('git diff --cached --name-status', {
        cwd: root, timeout: 2000, stdio: 'pipe', encoding: 'utf8',
      }).trim();
      for (const line of nameStatus.split('\n')) {
        // D\tpath — deleted file
        const delMatch = line.match(/^D\d*\t(.+)/);
        if (delMatch) { deletedFiles.add(delMatch[1].trim()); continue; }
        // R100\told\tnew — renamed file (old path is effectively deleted)
        const renMatch = line.match(/^R\d*\t([^\t]+)\t/);
        if (renMatch) deletedFiles.add(renMatch[1].trim());
      }
    } catch { /* no git — skip deletion check */ }

    for (const change of parsed.changes) {
      const filePath = stripLineNumber(change);
      const resolved = path.isAbsolute(filePath)
        ? filePath
        : path.join(root, filePath);
      const relPath = path.relative(root, resolved).replace(/\\/g, '/');

      if (deletedFiles.has(relPath)) continue; // legitimately deleted/renamed
      if (!fs.existsSync(resolved)) {
        findings.push({
          type: 'PHANTOM_FILE',
          detail: `changes[] references nonexistent file: ${change}`,
          severity: 'ERROR',
        });
      }
    }
  }

  // V2: Git Hash Reality — every 7+ hex sequence in what_I_verified
  const sr = parsed.self_reflection;
  if (sr && typeof sr.what_I_verified === 'string') {
    const hashPattern = /\b([a-f0-9]{7,40})\b/g;
    let match;
    while ((match = hashPattern.exec(sr.what_I_verified)) !== null) {
      const hash = match[1];
      // Validate format strictly before execSync (shell injection prevention)
      if (!/^[a-f0-9]{7,40}$/.test(hash)) continue;
      try {
        execSync(`git cat-file -t ${hash}`, {
          cwd: root, timeout: 2000, stdio: 'pipe', encoding: 'utf8',
        });
        // Hash exists — valid
      } catch {
        findings.push({
          type: 'PHANTOM_HASH',
          detail: `what_I_verified references nonexistent git hash: ${hash}`,
          severity: 'ERROR',
        });
      }
    }
  }

  // V3: Changes Match Git — bidirectional comparison
  if (Array.isArray(parsed.changes) && parsed.changes.length > 0) {
    try {
      const gitDiff = execSync('git diff --cached --name-only', {
        cwd: root, timeout: 2000, stdio: 'pipe', encoding: 'utf8',
      }).trim();
      const gitFiles = gitDiff ? gitDiff.split('\n').map(f => f.trim()).filter(Boolean) : [];
      const tsGitFiles = gitFiles.filter(f => /\.tsx?$/.test(f));

      // Check: TS files in git diff but NOT in changes[]
      const changeSet = new Set(parsed.changes.map(c =>
        path.relative(root, path.isAbsolute(c) ? c : path.join(root, c)).replace(/\\/g, '/')
      ));
      const omitted = tsGitFiles.filter(f => !changeSet.has(f));
      if (omitted.length > 2) {
        findings.push({
          type: 'OMITTED_CHANGES',
          detail: `${omitted.length} staged .ts/.tsx files not in changes[]: ${omitted.slice(0, 3).join(', ')}${omitted.length > 3 ? '...' : ''}`,
          severity: 'WARNING',
        });
      }
    } catch { /* no git — skip */ }
  }

  // V4: CI Execution Recency — ci_passed:true vs .ci-evidence
  if (parsed.ci_passed === true) {
    try {
      if (fs.existsSync(ciEvidencePath)) {
        const content = fs.readFileSync(ciEvidencePath, 'utf8').replace(/^\uFEFF/, '').trim();
        const lines = content.split('\n').filter(Boolean);
        const lastLine = lines[lines.length - 1];
        const lastCI = JSON.parse(lastLine);
        const ageMs = Date.now() - (lastCI.ts || 0);
        if (ageMs > 30 * 60 * 1000) { // >30 min
          findings.push({
            type: 'STALE_CI',
            detail: `ci_passed=true but last CI evidence is ${Math.round(ageMs / 60000)}min old (>30min)`,
            severity: 'WARNING',
          });
        }
      } else {
        findings.push({
          type: 'NO_CI_EVIDENCE',
          detail: 'ci_passed=true but no .ci-evidence file found — CI may not have run via Claude',
          severity: 'WARNING',
        });
      }
    } catch { /* parse error — skip */ }
  }

  // V5: Preflight Evidence — evidence.read[] from .preflight-token files exist
  try {
    if (fs.existsSync(preflightPath)) {
      const pfContent = fs.readFileSync(preflightPath, 'utf8').replace(/^\uFEFF/, '').trim();
      if (pfContent.startsWith('{')) {
        const preflight = JSON.parse(pfContent);
        const ev = preflight.evidence;
        if (ev && Array.isArray(ev.read)) {
          for (const entry of ev.read) {
            const filePath = stripLineNumber(entry);
            const resolved = path.isAbsolute(filePath)
              ? filePath
              : path.join(root, filePath);
            if (!fs.existsSync(resolved)) {
              findings.push({
                type: 'PHANTOM_PREFLIGHT_FILE',
                detail: `preflight evidence.read[] references nonexistent: ${entry}`,
                severity: 'ERROR',
              });
            }
          }
        }
      }
    }
  } catch { /* no preflight or parse error — skip cross-gate */ }

  // V6: Commit Hash Capture — record current HEAD at validation time
  try {
    const headHash = execSync('git rev-parse --short HEAD', {
      cwd: root, timeout: 2000, stdio: 'pipe', encoding: 'utf8',
    }).trim();
    findings.push({
      type: 'COMMIT_HASH',
      detail: `Validated at commit ${headHash}`,
      severity: 'INFO',
    });
  } catch { /* no git — skip */ }

  return { findings };
}

module.exports = { verify, stripLineNumber };
