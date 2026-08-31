# PR 73 Semantic Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate every still-relevant behavior from conflicting PR #73 into current `main`, prove already-present behavior instead of duplicating it, and leave a commit-by-commit adjudication record.

**Architecture:** Replay ten clean, independently applicable commits in original order, preserve their authorship and patch identity, then re-evaluate the large-text language commit after its accessibility prerequisite is present. Do not replay four commits whose behavior is already implemented in current `main`; bind each skip to current source/test evidence.

**Tech Stack:** React 18, TypeScript, Vitest, Dexie/storage, Git cherry-pick, Playwright/CI release gates.

**Spec:** `docs/superpowers/specs/2026-08-31-global-convergence-release-parity-design.md`

## Global Constraints

- Base is exact `c8bbc3c70e8cb9cb4671c4a8c527a7bade86c54a` in locked branch `codex/pr73-semantic-integration-20260831`.
- Source PR is #73, exact tip `f86328cde7ae85a7582c252af813eca7ad092ef0`; never merge the conflicting branch wholesale.
- Preserve current no-mock-runtime-data, privacy, auth, sync, visual, motion, and platform invariants.
- `ValenceOrb` and `MiniValenceOrb` remain frozen; this PR does not touch them.
- Keep the original PR branch and worktrees until replacement release and final recovery cleanup.
- A commit is `IN_MAIN` only with current source plus focused test evidence; conflict alone is not proof.
- Close PR #73 only after the replacement PR is merged, released, and every source commit has a final disposition.

---

### Task 1: Record the exact source map and baseline

**Files:**
- Create: `docs/convergence/2026-08-31-pr73-adjudication.md`

**Interfaces:**
- Consumes: PR #73 tip and its 15 commits.
- Produces: one row per source commit with exact SHA, intent, changed paths, applicability result, current disposition, and verification evidence.

- [x] **Step 1: Record the source sequence**

Use this exact order:

```text
86c73690c4348b3d5c1b5f9328da0ffa23d03759
aa46a44b1af51a2fab18e6f9b2e8ae91736606f7
6ae8a4f75021d10c3fac51b828b5632244893639
b30b1aa2e65941f0c826fc3a51c3981f6aefd7a6
698d0aaac14a97a9d8e3896589a6ebdfaac0bd23
c24590ec69dd95620d9a2b59d5fd66ab65e4c522
73e58418630f2744c9f119164388a6fc0ea2c9ef
206313199db7223cd02bee5e781191a80fb5afe0
498c70973a5d9395a6a680db736cccbc75cb7893
18eb5d101d6e0f0ffa72dcaac1cbca84348530d1
df0350054756c57e40c0414604775bc977e8392e
c44d5d9194f50cba40ab1401139ae134970c522d
143d04c279b8bbefad41c2d9ac2e8f35db662277
dc1653e8ce25662f4bc56563e9c34afa732c8445
f86328cde7ae85a7582c252af813eca7ad092ef0
```

- [x] **Step 2: Record the clean-apply baseline**

The exact patches for `aa46a44` through `df035005` were checked independently against released main with `git apply --check` and all ten returned `APPLIES`. The first, PKCE/test, language, and final lint commits returned `CONFLICTS` before prerequisites/adjudication.

- [x] **Step 3: Verify the current lane baseline**

Run the focused tests named in Tasks 2-4 before any cherry-pick. Record any baseline failure as `FAIL`; do not attribute it to PR #73.

---

### Task 2: Replay the ten clean product fixes

**Files:**
- Modify only the paths carried by the ten source commits.

**Interfaces:**
- Consumes: exact source commits from PR #73.
- Produces: ten cherry-picked commits on the new Codex lane with their original authors and messages.

- [x] **Step 1: Cherry-pick the accessibility group in order**

```sh
git cherry-pick \
  aa46a44b1af51a2fab18e6f9b2e8ae91736606f7 \
  6ae8a4f75021d10c3fac51b828b5632244893639 \
  b30b1aa2e65941f0c826fc3a51c3981f6aefd7a6 \
  698d0aaac14a97a9d8e3896589a6ebdfaac0bd23 \
  c24590ec69dd95620d9a2b59d5fd66ab65e4c522
```

Expected: clean application. Stop on any conflict and inspect current source; never use ours/theirs wholesale.

- [x] **Step 2: Verify the accessibility group**

Run:

```sh
npx vitest run --configLoader runner \
  src/components/__tests__/EntryThemeSwitcher.test.tsx \
  src/components/__tests__/FeedbackButton.test.tsx \
  src/components/habit-creation-form/__tests__/HabitDurationSection.a11y.test.tsx \
  src/components/habit-creation-form/__tests__/IdentityMappingSection.test.tsx \
  src/components/habit-creation-form/__tests__/NumericalTargetSection.a11y.test.tsx
```

- [x] **Step 3: Cherry-pick the state-integrity group in order**

```sh
git cherry-pick \
  73e58418630f2744c9f119164388a6fc0ea2c9ef \
  206313199db7223cd02bee5e781191a80fb5afe0 \
  498c70973a5d9395a6a680db736cccbc75cb7893 \
  18eb5d101d6e0f0ffa72dcaac1cbca84348530d1 \
  df0350054756c57e40c0414604775bc977e8392e
```

- [x] **Step 4: Verify the state-integrity group**

Run:

```sh
npx vitest run --configLoader runner \
  src/lib/__tests__/exportService.test.ts \
  src/storage/__tests__/cloudSync.test.ts \
  src/storage/__tests__/db.test.ts \
  src/hooks/__tests__/useFocusHandlers.test.ts \
  src/lib/__tests__/habitScheduleSync.test.ts
```

---

### Task 3: Prove four source commits already exist in main

**Files:**
- Modify: `docs/convergence/2026-08-31-pr73-adjudication.md`
- Test only: current relevant source/tests.

**Interfaces:**
- Consumes: source commits `86c73690`, `c44d5d91`, `143d04c2`, and `f86328cd`.
- Produces: `IN_MAIN` evidence without duplicate code changes.

- [x] **Step 1: Prove privacy/ad-copy state**

Current main already asserts `adAgeEligibility: "unknown"` after account-boundary cleanup in `src/storage/__tests__/db.test.ts` and prohibits scarcity/guilt copy in `docs/AD_SYSTEM_JOURNEY.md`. Run the focused DB test and record commit `86c73690` as `IN_MAIN` only if it passes.

- [x] **Step 2: Prove PKCE trailing-slash canonicalization**

Current main contains `canonicalAuthPathname()` in `src/lib/pkceAttemptStorage.ts`, the GitHub Pages trailing-slash acceptance test, and exact wrong-path rejection tests that preserve pending-attempt state. Run:

```sh
npx vitest run --configLoader runner src/lib/__tests__/pkceAttemptIsolation.test.ts
```

If green, record `c44d5d91`, `143d04c2`, and `f86328cd` as `IN_MAIN` with current source/test lines. Do not copy obsolete test typing or formatting changes.

---

### Task 4: Integrate the large-text language layout

**Files:**
- Modify: `src/components/LanguageSelector.tsx`
- Modify: `src/components/__tests__/LanguageSelector.test.tsx`

**Interfaces:**
- Consumes: source commit `dc1653e8ce25662f4bc56563e9c34afa732c8445` after `aa46a44` is present.
- Produces: large rendered language labels switch the grid to one column while radio keyboard behavior remains intact.

- [x] **Step 1: Re-check patch applicability after prerequisites**

Run the exact `dc1653e8` patch through `git apply --check` against the updated lane. If it applies, cherry-pick the commit. If it conflicts, preserve current keyboard/RTL/wrapping behavior and implement only the measured-font single-column behavior plus its original test.

- [x] **Step 2: Verify focused LanguageSelector behavior**

Run:

```sh
npx vitest run --configLoader runner src/components/__tests__/LanguageSelector.test.tsx
```

Confirm the test covers 28px rendered labels, single-column state, eight radio options, RTL/LTR attributes, and keyboard selection.

- [x] **Step 3: Record the final disposition**

Mark `dc1653e8` `TAKE` with the new commit SHA and exact verification. Never mark the entire source PR merged merely because this final patch applies.

---

### Task 5: Full verification and protected replacement delivery

**Files:**
- Modify only for in-scope failures caused by Tasks 2-4.

**Interfaces:**
- Produces: exact handoff, replacement PR, released main evidence, and an old-PR closure receipt.

- [x] **Step 1: Run full relevant checks**

Run lint, typecheck, focused tests, full Vitest, production build, bundle PDI, best-practices, no-template, task-completion, agent-context, and the narrow secrets security profile.

- [x] **Step 2: Review diff and source coverage**

Confirm every changed source path belongs to one of the 11 `TAKE` commits or the adjudication/plan. Confirm all 15 source commits have one terminal disposition and no runtime sample/mock data, secret, generated artifact, or retired orchestration file entered the patch.

- [ ] **Step 3: Commit, push, and open a replacement PR**

Use exact same-name push and handoff. The replacement PR body must list the original PR #73, all source commit dispositions, focused/full verification, and the fact that the old conflicting branch is retained until cleanup proof.

- [ ] **Step 4: Merge and release before closing PR #73**

Merge only after required CI passes. Verify the replacement tip is an ancestor of new `origin/main`, main Pages deploy and public smokes pass, then leave a concise supersession comment on PR #73 and close it without deleting its branch. Branch deletion remains part of the final global cleanup gate.
