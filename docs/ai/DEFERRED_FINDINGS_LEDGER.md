# Deferred Findings Ledger

Purpose: preserve additional ZenFlow findings that are outside the active task without expanding that task, losing evidence between agents, or turning an observation into unauthorized work.

This is the single canonical repository path for deferred-finding intake. An isolated worktree contains its branch version of this file; the handoff or convergence owner must merge and deduplicate entries before claiming that the canonical branch is current.

## Admission Rules

Add an entry only when all of these are true:

1. The observation is outside the current task's scope and is not required to make that task safe or correct.
2. It has an exact evidence locator, or it is explicitly marked `UNVERIFIED` with a reproducible verification path.
3. It describes a concrete ZenFlow failure mode, risk, or maintenance cost rather than a generic improvement idea.
4. It is not already represented by an open entry, canonical task, ADR, issue, or release blocker; otherwise link the existing record and use `DUPLICATE`.
5. The entry contains no secrets, credentials, raw private content, or user data, including journal, habit, account, or production-derived records.

Do not defer an in-scope defect merely to obtain a task-level `GO`. A critical active security, privacy, data-loss, cross-account, or destructive-migration risk is a hard stop or escalation even when it is also recorded here.

## Entry Contract

Each entry must include:

- `Finding ID`: `DF-YYYYMMDD-<source-task>-<short-slug>`; never reuse an ID.
- `First seen UTC`: ISO-8601 timestamp.
- `Source task/lane`: task ID plus exact worktree or branch.
- `Status`: `NEW`, `TRIAGED`, `PLANNED`, `BLOCKED`, `RESOLVED`, `REJECTED`, or `DUPLICATE`.
- `Severity`: `P0`, `P1`, `P2`, or `P3`, with the reason stated in the impact field.
- `Evidence locator`: current file/line, command and receipt, screenshot, runtime trace, or authoritative source. A summary from another agent is not proof.
- `Failure mode / impact`: who or what can fail and under which condition.
- `Platforms / domains`: Web, installed PWA, Android, iOS, Desktop, Store/Release, Accessibility, Performance, Security/Privacy, Testing, Operations, or Agent Governance as applicable.
- `Verification path`: the smallest fresh check that can confirm or reject the finding, including negative controls where material.
- `Suggested owner / next task`: a bounded follow-up, not an instruction to start automatically.
- `Related / duplicate`: canonical task, ADR, issue, finding ID, or `None found` after the stated search.

Logging an entry does not authorize implementation, issue creation, production or private-data access, dependency installation, Git publication, deployment, release, or any other external write. GitHub Issues may replace a ledger entry only after an authorized owner approves the external write and the target repository is verified.

No secrets, credentials, raw private content, or user data may be stored in this ledger.

## Intake Queue

### DF-20260814-AGENT-GOV-PDI-STOP-TIMEOUT

- `First seen UTC`: `2026-08-14T04:54:00Z`
- `Source task/lane`: agent-governance solo-default change; `codex/agent-findings-solo-default`
- `Status`: `TRIAGED`
- `Severity`: `P2` — supported post-write operations report an internal error even when the same checker succeeds directly, so completion evidence becomes noisy and unreliable.
- `Evidence locator`: multiple guarded `apply_patch` operations returned `spawnSync ... node ETIMEDOUT`; immediately afterward `npm run check:production-data-integrity:diff` completed in about 2.1 seconds with `errors=0`, `warnings=0`, `scanned=1865`, `reachable=783`.
- `Failure mode / impact`: the hook wrapper or lifecycle timing can report an internal PDI failure after a valid change; this does not prove production-data corruption, but it prevents a clean hook verdict.
- `Platforms / domains`: Agent Governance, Testing, Operations; product runtime platforms not affected by the observed failure.
- `Verification path`: in the dedicated PDI-timeout lane, reproduce with timestamped hook stdin, separate root-resolution/checker/wrapper timings, add a RED timeout contract, patch the narrow cause, and rerun hook plus direct diff/full PDI negative controls.
- `Suggested owner / next task`: finish the existing isolated `codex-pdi-stop-timeout-fix-20260813` lane; do not duplicate the fix here.
- `Related / duplicate`: `/Users/yehor/Projects/ZenFlow/worktrees/codex-pdi-stop-timeout-fix-20260813`; exact current completion status remains `UNVERIFIED` in this task.

### DF-20260814-AGENT-GOV-INHERITED-NPM-AUDIT

- `First seen UTC`: `2026-08-14T05:05:00Z`
- `Source task/lane`: agent-governance solo-default change; `codex/agent-findings-solo-default`
- `Status`: `NEW`
- `Severity`: `P1` — production dependency audit includes two high-severity advisories; no critical advisory was reported.
- `Evidence locator`: fresh `npm audit --audit-level=high --json` returned `4 high`, `2 moderate`, `0 critical`; fresh `npm audit --omit=dev --audit-level=high --json` returned `2 high`, `1 moderate`, `0 critical`. `package.json` and `package-lock.json` are not in this task's diff.
- `Failure mode / impact`: inherited vulnerable dependency paths may remain in development and production graphs; exploitability and reachable ZenFlow surfaces are not established by the count alone.
- `Platforms / domains`: Web, installed PWA, Android, iOS, Desktop, Store/Release, Security/Privacy, Operations.
- `Verification path`: capture exact advisory IDs and dependency paths without exposing tokens, classify runtime reachability and fix availability, apply upgrades in a separate test-first dependency task, then rerun full and production-only audits, builds, native sync, and focused regressions.
- `Suggested owner / next task`: bounded dependency-remediation task owned by release/security; no automatic start.
- `Related / duplicate`: no canonical entry found in this base checkout; deduplicate against the Android release task ledger before scheduling.

### DF-20260814-AGENT-GOV-TERRASCAN-SCOPE-NOISE

- `First seen UTC`: `2026-08-14T05:08:00Z`
- `Source task/lane`: agent-governance solo-default change; `codex/agent-findings-solo-default`
- `Status`: `NEW`
- `Severity`: `P2` — broad scanner input produces a nonzero tool status and extensive irrelevant parse errors, which can obscure whether deployable IaC was actually checked.
- `Evidence locator`: security suite report `/Users/yehor/.codex/security/reports/20260814T050552Z-76771/summary.tsv` records `terrascan=4`; its report attempts to parse ignored `.playwright-cli/*.yml` snapshots and `node_modules/.bin/yaml`, then reports no Dockerfile or Terraform configs. Checkov and KICS returned `0` in the same run.
- `Failure mode / impact`: repository-wide Terrascan discovery treats non-IaC YAML and dependency files as candidate IaC, creating false-noise and an incomplete IaC verdict.
- `Platforms / domains`: Agent Governance, Security/Privacy, CI/Operations; affected deployable IaC remains `UNVERIFIED` rather than `PASS`.
- `Verification path`: in a separate scanner-governance task, build a tracked-file-only IaC candidate manifest, exclude ignored dependencies/runtime captures by construction, add positive and negative fixtures, and require the scanner wrapper to distinguish `N/A_NO_IAC`, `PASS`, `FINDINGS`, and `SCAN_ERROR`.
- `Suggested owner / next task`: security-tooling maintenance; no automatic start.
- `Related / duplicate`: `specs/001-pending-batch-delivery/evidence/verification.json` records the same class of historical broad-scan misclassification; current remediation status is `UNVERIFIED`.

### DF-20260814-AGENT-GOV-INHERITED-SNYK-CODE

- `First seen UTC`: `2026-08-14T06:35:46Z`
- `Source task/lane`: agent-governance solo-default change; `codex/agent-findings-solo-default`
- `Status`: `NEW`
- `Severity`: `P2` — the fresh scan reports one medium and twenty-two low findings, with no finding path in this task's changed or untracked set.
- `Evidence locator`: fresh `snyk code test --json-file-output=/tmp/solo-governance-snyk-final.json .` reported `23` findings across `10` paths; an exact Git path intersection returned `[]`. The same finding set is retained in `/Users/yehor/.codex/security/reports/20260814T061915Z-16847/snyk-code.json`. The CLI also returned `403 Forbidden` after emitting results, so the scan is evidence of findings, not a clean Snyk service verdict.
- `Failure mode / impact`: inherited test/runtime/tooling paths may contain hardcoded non-cryptographic test secrets, path traversal, missing `postMessage` origin validation, or test-server cleartext transport. Static findings alone do not establish exploitability, but they require separate validation before a security or release `GO`.
- `Platforms / domains`: Web, installed PWA, Android, iOS, Desktop, Security/Privacy, Testing, Operations; exact reachability remains `UNVERIFIED`.
- `Verification path`: triage each Snyk result against exact data/control flow and production reachability, reproduce valid findings with a negative control, reject false positives with source evidence, fix valid items test-first in bounded tasks, and rerun Snyk plus platform-specific regression checks.
- `Suggested owner / next task`: bounded security-finding triage; no automatic start.
- `Related / duplicate`: distinct from `DF-20260814-AGENT-GOV-INHERITED-NPM-AUDIT`, which covers dependency advisories rather than first-party static-code findings.

## Triage And Closure

- Review `NEW` entries before planning a release wave, then set an owner and disposition without rewriting the original evidence.
- Prefer one small, self-contained follow-up task per independently verifiable change. Keep tests with the behavior they prove; split unrelated refactors or cleanup.
- Mark `RESOLVED` only with a change locator and fresh verification evidence. Mark `REJECTED` with the rejection criterion that was met. Mark `DUPLICATE` with the canonical record.
- Preserve closed entries for provenance. If the document becomes unwieldy, archive closed rows by date in a separately authorized maintenance change while keeping this file as the only active intake queue.
- A clean task result may coexist with deferred findings; task `GO` and release `GO` remain separate decisions.
