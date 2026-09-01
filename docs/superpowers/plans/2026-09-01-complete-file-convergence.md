# Complete Recovery File Convergence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge every useful non-Kimi recovery file and behavior into the canonical `main` tree while excluding secrets, credentials, private data, generated output, caches, and obsolete conflicting snapshots.

**Architecture:** Build a deterministic, sanitized convergence ledger over both committed recovery history and the hash-bound dirty-file packets. Mechanical policy classifies exact-current, Kimi, generated, duplicate-copy, and secret-risk records; every remaining record receives an evidence-backed semantic disposition before a domain batch can merge. Current owners remain authoritative when they implement a stronger compatible invariant.

**Tech Stack:** Node.js, Git plumbing, SHA-256, Vitest, TypeScript, Vite, Capacitor, Gradle, GitHub CLI, local security suite.

**Spec:** `docs/superpowers/specs/2026-09-01-global-recovery-convergence-v12-design.md`

## Global Constraints

- Source universe includes the 149 outside-base commits, 900 exported dirty-file variants, 11 deletion intents, 73 packet reports, and special recovery archives recorded on 2026-08-31.
- Exclude every packet, commit, path, or archive identified as Kimi work, including `people-first-app-codex-kimi-*`, `cc0-kimi-*`, Kimi workspace tooling, and the special Kimi archive.
- Never commit `.env` files, `key.properties`, keystores, passwords, tokens, credentials, customer data, private receipts, absolute machine paths, `node_modules`, build output, caches, or recovery containers.
- Multiple variants of one logical path cannot be copied blindly. Select or compose one current implementation and preserve the disposition evidence in the ledger.
- Existing `main` behavior may be retained only when a current owner and passing invariant prove it supersedes the recovered variant.
- Product runtime must not gain mock, demo, placeholder, synthetic, or fallback business records.
- Use one locked `codex/` worktree. Deliver through a true GitHub merge commit, then remove the temporary branch and worktree.

---

### Task 1: Build the deterministic file ledger

**Files:**
- Create: `scripts/recovery-file-convergence-core.cjs`
- Create: `scripts/recovery-file-convergence.mjs`
- Create: `scripts/__tests__/recovery-file-convergence.test.ts`
- Create: `docs/ai/convergence/recovery-file-convergence-20260901.json`

**Interfaces:**
- Consumes: recovery `manifest.json`, Git inventory, repository root, base SHA, current `main` SHA, and reviewed decision records.
- Produces: stable JSON records keyed by source, logical path, content hash, change kind, domain, mechanical policy, semantic disposition, and evidence.

- [x] **Step 1: Add RED policy tests**

Cover exact-current files, Kimi packet/path exclusion, secret-like paths and content, generated/cache paths, duplicate-copy names, conflicting variants, deletion intents, missing files, absolute-path stripping, and deterministic ordering.

- [x] **Step 2: Run the focused test and confirm RED**

Run: `npx vitest run scripts/__tests__/recovery-file-convergence.test.ts --maxWorkers=1`

Expected: FAIL because the new core module does not exist.

- [x] **Step 3: Implement the pure classifier and bounded CLI**

The classifier exposes `classifyMechanicalPolicy(record)`, `buildVariantGroups(records)`, `validateDecision(record)`, and `summarizeLedger(records)`. The CLI reads explicit files, invokes Git with argument arrays, hashes regular files, strips absolute locators, and refuses incomplete or secret-bearing output.

- [x] **Step 4: Run GREEN and generate the initial ledger**

Run the focused test, then generate the real ledger from the verified external recovery manifest and post-PR91 Git inventory supplied through local CLI arguments. The durable output stores source IDs and hashes, never local locators.

- [x] **Step 5: Verify source counts and commit the ledger foundation**

Require 900 dirty variants, 11 deletion intents, 149 historical commits, zero raw absolute paths, zero embedded file content, and zero unclassified mechanical exclusions.

### Task 2: Converge audio, TGS stickers, and pictograms

**Files:**
- Modify: `docs/ai/convergence/recovery-file-convergence-20260901.json`
- Modify/Create: only current audio, `src/assets/habit-icons`, `src/assets/journal/save-ceremony`, `src/components/habit-pictogram`, journal sticker, audio manifest, and focused test paths selected by the ledger.

**Interfaces:**
- Consumes: non-Kimi audio/sticker variants and current runtime reachability.
- Produces: one rights-gated runtime catalog, reachable audio files, reachable TGS files, first-frame fallbacks, and validated bundle inventory.

- [ ] **Step 1: Enumerate all non-Kimi audio and sticker sources**

Record runtime, review-only, rights-blocked, duplicate, and unfinished artistic sources separately. Do not promote review output without source/license evidence.

- [ ] **Step 2: Add focused failing reachability tests for missing approved assets**

Require every approved TGS/audio asset to be imported by production code and present in Android packaging; require excluded Kimi and rights-blocked assets to remain unreachable.

- [ ] **Step 3: Merge or compose current audio/sticker owners**

Preserve current stronger manifests and add only approved missing assets, pictogram owners, accessibility behavior, and fallbacks.

- [ ] **Step 4: Validate artifacts and bundle reachability**

Run audio asset checks, TGS validators, visual gates, focused unit tests, Android web build, APK package inspection, and secret scan over changed paths.

- [ ] **Step 5: Commit the audio/sticker batch**

Commit only the reviewed runtime/source/test files and the corresponding ledger decisions.

### Task 3: Converge UI, buttons, accessibility, motion, and responsive behavior

**Files:**
- Modify: current owners under `src/components`, `src/pages/nav-v2`, `src/hooks`, `src/styles`, `src/index.css`, focused tests, and the ledger.
- Create: recovered focused tests only when they remain valid against current owners.

**Interfaces:**
- Consumes: all non-Kimi UI/motion variants grouped by logical path and requirement.
- Produces: current compatible implementations for button behavior, keyboard/touch targets, labels, large text, RTL, reduced motion, animation lifecycle, and responsive layouts.

- [ ] **Step 1: Resolve the 79 multi-variant paths first**

For each path, compare recovered requirements with the current owner; choose the strongest compatible invariant and record why discarded variants are superseded or unsafe.

- [ ] **Step 2: Recover missing focused tests before implementation**

Run each recovered test against current `main`; retain it only when it expresses a current product contract and observe RED before changing runtime code.

- [ ] **Step 3: Merge missing current behavior in rollback-sized batches**

Process accessibility/buttons, pictograms, navigation/challenge, focus/planning, motion, settings, schedule, and UI-system tooling separately.

- [ ] **Step 4: Run domain verification after every batch**

Run focused Vitest, typecheck, lint, i18n/RTL, visual checks, and relevant Playwright/emulator flows.

- [ ] **Step 5: Commit each independently revertible domain batch**

Every commit includes only one coherent owner/test set plus updated ledger decisions.

### Task 4: Converge journal, storage, sync, native, release, and governance files

**Files:**
- Modify/Create: only ledger-selected owners under `src/features/journal`, `src/storage`, `src/lib`, `android`, `ios`, `supabase`, `.github`, `scripts`, `config`, and documentation.

**Interfaces:**
- Consumes: remaining non-Kimi variants and historical commit requirements.
- Produces: current privacy-safe, forward-only, platform-compatible implementations and tooling.

- [ ] **Step 1: Process journal/privacy and storage/sync records**

Require account boundaries, encryption/privacy invariants, forward-only migrations, retry/idempotency, and no fabricated runtime data.

- [ ] **Step 2: Process Android/iOS/PWA/release records**

Exclude generated native builds and keystores. Retain API 36, signing indirection, package integrity, offline, and platform behavior fixes backed by current tests.

- [ ] **Step 3: Process non-Kimi governance/audit/tooling records**

Retain deterministic repository guards and sanitized audit tooling; exclude private receipts, absolute paths, duplicate-copy files, local previews, and stale snapshots.

- [ ] **Step 4: Close every ledger record**

Require every source variant and deletion intent to have one of `MERGED`, `ALREADY_CURRENT`, `SUPERSEDED_WITH_EVIDENCE`, `EXCLUDED_KIMI`, `EXCLUDED_SECRET_PRIVATE`, `EXCLUDED_GENERATED_CACHE`, `EXCLUDED_RIGHTS`, or `EXCLUDED_OBSOLETE_CONFLICT`.

- [ ] **Step 5: Commit the remaining domain batches and closed ledger**

No commit may contain an unclassified record, secret-like path, generated tree, or unrelated change.

### Task 5: Verify, publish, merge, and clean up

**Files:**
- Modify: `.verification-done` as ignored local evidence only.

**Interfaces:**
- Consumes: closed ledger and all domain commits.
- Produces: green PR, true merge commit in `main`, clean original checkout, and removed temporary lane.

- [ ] **Step 1: Run complete repository verification**

Run full Vitest, `check:all`, production build, production-data-integrity source/bundle, sync/schema/task gates, `npm audit`, Android release configuration/debug APK tests, iOS gate, and available browser/emulator checks.

- [ ] **Step 2: Run secret and security verification**

Run Gitleaks/TruffleHog and the installed local Codex security suite with the narrowest full repository profile warranted by the final diff. Fail if any changed-path secret or validated vulnerability remains.

- [ ] **Step 3: Review final Git and ledger evidence**

Require clean tracked state, no Kimi paths newly added, zero secret/private/generated records merged, all intended assets reachable, and every ledger record closed.

- [ ] **Step 4: Push, open PR, wait for all required checks, and merge**

Use a true merge commit into `main`; do not bypass required checks or force-push.

- [ ] **Step 5: Synchronize original `main` and remove temporary state**

Verify `main == origin/main`, then remove the temporary worktree and local/remote branch after ancestry and recovery proofs succeed.

## Done Criteria

- [ ] Every recovered commit/file/deletion source has an explicit closed disposition.
- [ ] All approved non-Kimi behavior and assets are in `main` and production-reachable.
- [ ] No Kimi work, key, password, token, credential, private data, generated output, cache, or recovery container is committed.
- [ ] Full repository, Android/iOS, visual/audio, security, and CI evidence is green or explicitly non-blocking and outside changed paths.
- [ ] The original checkout is the only remaining worktree and equals `origin/main`.

## UNVERIFIED Until Execution Completes

- Artistic approval of unfinished external bear/nightcap work remains outside this convergence.
- Store publication and update-key compatibility remain separate from source convergence.
