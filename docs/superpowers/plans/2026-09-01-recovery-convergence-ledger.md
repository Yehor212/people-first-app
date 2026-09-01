# Recovery Convergence Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce an evidence-complete, deterministic disposition ledger for every recovered ZenFlow source and use it to drive reviewable semantic merge batches into `main`.

**Architecture:** Extend the existing convergence inventory with a tracked-file-only ledger generator. The generator consumes the hash-verified recovery manifest and Git inventory through explicit CLI arguments, strips local absolute paths, groups records by commit/domain/logical path, and fails unless every source has a valid disposition. Human semantic decisions remain explicit JSON records backed by current tests; the tool never chooses product behavior from timestamps.

**Tech Stack:** Node.js, Git plumbing through argument arrays, JSON Schema-style validation, Vitest, existing ZenFlow workspace and completion gates.

**Spec:** `docs/superpowers/specs/2026-09-01-global-recovery-convergence-v12-design.md`

## Global Constraints

- Source universe is 56 unique heads, 73 packets, 149 commits outside the base `main`, and all special recovery manifests.
- No recovery folder, `.env`, credential, private log, user data, dependency tree, build output, or machine-local absolute path enters Git.
- Every source and deletion intent has exactly one allowed disposition.
- `APPLY_EXACT` and `REIMPLEMENT_ON_MAIN` require focused current evidence.
- No batch exceeds 500 changed paths or mixes independent rollback domains.
- One writable batch and one locked worktree exist at a time.
- Protected merge uses true merge commits; no squash replacement, `ours` strategy, force-push, or history rewrite.

---

### Task 1: Define and test the ledger schema

**Files:**
- Create: `scripts/__tests__/recovery-convergence-ledger.test.ts`
- Create: `scripts/recovery-convergence-ledger.mjs`
- Create: `docs/ai/convergence/recovery-convergence-20260901.decisions.json`

**Interfaces:**
- Consumes: `--inventory`, `--recovery-manifest`, `--repo`, and `--decisions`.
- Produces: `--output` JSON with stable sorted sources, commits, logical paths, domains, dispositions, evidence, and summary counts.

- [ ] **Step 1: Add RED schema tests**

Test a minimal fixture containing one Git head, one dirty packet, one deletion
intent, one generated path, one secret-like path, and two conflicting source
variants. Require deterministic ordering and reject missing dispositions,
unknown enum values, duplicate source IDs, absolute paths, raw file contents,
secret paths, and `APPLY_EXACT` without evidence.

- [ ] **Step 2: Run RED**

Run: `npx vitest run scripts/__tests__/recovery-convergence-ledger.test.ts --maxWorkers=1`

Expected: FAIL because the generator does not exist.

- [ ] **Step 3: Implement the bounded CLI**

```js
const DISPOSITIONS = new Set([
  "ALREADY_IN_MAIN",
  "SUPERSEDED_BY_MAIN",
  "APPLY_EXACT",
  "REIMPLEMENT_ON_MAIN",
  "NON_PRODUCT_ARTIFACT",
  "REJECTED_WITH_EVIDENCE",
  "UNVERIFIED",
]);

export function buildLedger({ inventory, recoveryManifest, decisions, repo }) {
  const sources = collectStableSources(inventory, recoveryManifest);
  const classified = sources.map((source) => applyReviewedDecision(source, decisions));
  validateEvidence(classified);
  return stableLedger(classified, repo);
}
```

All Git subprocesses use `execFile`/`spawn` argument arrays. The output records
hashes and repository-relative paths only.

- [ ] **Step 4: Run GREEN and negative tests**

Run the focused test until every deterministic, privacy, and fail-closed case
passes.

- [ ] **Step 5: Commit the ledger foundation**

```bash
git add scripts/recovery-convergence-ledger.mjs scripts/__tests__/recovery-convergence-ledger.test.ts docs/ai/convergence/recovery-convergence-20260901.decisions.json
git commit -m 'feat: add recovery convergence ledger foundation batch'
```

### Task 2: Generate the real source universe without product decisions

**Files:**
- Create: `docs/ai/convergence/recovery-convergence-20260901.inventory.json`
- Modify: `docs/ai/convergence/recovery-convergence-20260901.decisions.json`

**Interfaces:**
- Consumes: the verified recovery and Git inventory files.
- Produces: stable source IDs and initial mechanical `NON_PRODUCT_ARTIFACT` or `UNVERIFIED` records.

- [ ] **Step 1: Generate the inventory**

Run the CLI with:

```bash
node scripts/recovery-convergence-ledger.mjs \
  --inventory /Users/yehor/Projects/ZenFlow/quarantine/final-convergence-recovery-20260831/post-pr91-inventory/inventory.json \
  --recovery-manifest /Users/yehor/Projects/ZenFlow/recovered-unmerged-files-20260831/manifest.json \
  --repo . \
  --decisions docs/ai/convergence/recovery-convergence-20260901.decisions.json \
  --output docs/ai/convergence/recovery-convergence-20260901.inventory.json
```

- [ ] **Step 2: Verify privacy and completeness**

Require 56 unique heads, 73 packet records, 149 unique outside-main commits,
all special sources, all deletion intents, and zero embedded absolute paths or
file contents. Confirm generated/cache/local records are mechanically separated
but not deleted from external recovery.

- [ ] **Step 3: Commit the deterministic inventory**

```bash
git add docs/ai/convergence/recovery-convergence-20260901.inventory.json docs/ai/convergence/recovery-convergence-20260901.decisions.json
git commit -m 'docs: record recovery convergence inventory batch'
```

### Task 3: Adjudicate and deliver each semantic domain

**Files:**
- Modify: `docs/ai/convergence/recovery-convergence-20260901.decisions.json`
- Modify: only the current domain's existing owner/test paths listed by the generated inventory.

**Interfaces:**
- Consumes: one domain group from the inventory.
- Produces: zero `UNVERIFIED` records for that domain, focused RED/GREEN evidence, and one independently revertible merge batch.

- [ ] **Step 1: Process domains in fixed order**

Use this order: UI/accessibility/i18n; motion/visual; journal/privacy; storage/sync;
native/platform; PWA/runtime; governance/CI; audio/provenance. Do not open a
later write set while the current domain has failing or unexplained evidence.

- [ ] **Step 2: Resolve each requirement against current owners**

For each source record, inspect the original commit diff and current owner. Use
`ALREADY_IN_MAIN` only with a current test or exact stronger implementation;
use `SUPERSEDED_BY_MAIN` only with the replacement path and invariant; use
`APPLY_EXACT` only when the old patch remains current; use
`REIMPLEMENT_ON_MAIN` with a named RED/GREEN test; and use
`REJECTED_WITH_EVIDENCE` only with a concrete violated contract.

- [ ] **Step 3: Run domain gates**

UI runs i18n/RTL/a11y/browser checks; journal and storage run privacy/PDI/sync
contracts; native runs Capacitor/Gradle/platform tests; governance runs agent
context, enforcement, best-practices, and no-template checks; audio requires
rights/provenance plus exact runtime reachability.

- [ ] **Step 4: Commit and merge one domain batch**

Each commit with more than seven files includes `batch` in the message. Push the
same-named `codex/` branch, require a green handoff, open a PR, and use a true
merge commit. Start the next domain from the new exact `origin/main` tip.

### Task 4: Close the global ledger and release evidence

**Files:**
- Modify: `docs/ai/convergence/recovery-convergence-20260901.decisions.json`
- Create: `docs/ai/convergence/recovery-convergence-20260901.done.json`
- Modify: `.verification-done` only as ignored local evidence.

**Interfaces:**
- Consumes: all merged domain receipts.
- Produces: zero unclassified sources and an exact final main/release status.

- [ ] **Step 1: Regenerate the ledger against final main**

Require unclassified source count zero, `APPLY_EXACT`/`REIMPLEMENT_ON_MAIN`
records reachable from final `main`, and every `ALREADY_IN_MAIN` or
`SUPERSEDED_BY_MAIN` record still backed by current evidence.

- [ ] **Step 2: Run full repository and platform verification**

Run typecheck, lint, bounded-worker Vitest, build, PDI source/bundle, i18n/RTL,
visual, sync, schema, security, Android build/emulator, and available PWA/iOS/
Desktop checks. Missing public/store/device proof remains `UNVERIFIED`.

- [ ] **Step 3: Verify Git and recovery topology**

Confirm final `main == origin/main`, every delivery PR has a two-parent merge
commit, no unmerged delivery branch contains required work, the external
recovery folder remains hash-valid, and only the original main worktree remains
after separately verified cleanup.

- [ ] **Step 4: Record the done packet**

Write exact source counts, disposition counts, test counts, artifact hashes,
platform statuses, remaining `UNVERIFIED` items, rollback commits, and final
Android package/signature facts. Never promote local evidence to public/store
release status.

