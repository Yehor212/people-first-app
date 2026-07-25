# Reflow Final Evidence Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` for the CSS budget correction and `superpowers:verification-before-completion` for every PASS claim. The coordinator must execute each checkbox in order and independently verify subagent output.

**Goal:** Close the remaining ZenFlow text-reflow work without increasing the CSS budget, then bind fresh technical, Chrome, visual, localization, and exact-ten review evidence to one unchanged source snapshot.

**Architecture:** Keep the approved mood and Settings visuals intact and remove only redundant Tailwind rules introduced by the narrow-width repair. Reuse utilities already present in the generated bundle, rebuild once, verify the same user-visible geometry in Chrome, and regenerate the evidence packet before restarting role approvals. The journal E2E suite is an adjacent release proof, not a current three-bug implementation task: its latest serial run exited 0, but its source digest is older than the current reflow snapshot.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind, Vitest, size-limit, custom eight-locale i18n, Chrome browser evidence, canonical ten-role registry.

## Global Constraints

- Work in the existing `main` checkout and preserve unrelated user changes; do not reset, stage, commit, push, deploy, or delete evidence unless the user separately requests it.
- Do not raise the 105 kB CSS Brotli budget and do not reduce visual quality, copy meaning, 44 px targets, RTL safety, focus reachability, or reduced-motion behavior to make the metric pass.
- Do not introduce production mocks, placeholder data, fake screenshots, generic AI-template copy, new dependencies, new product settings, or an unrelated refactor.
- Use Chrome for runtime proof because that is the user's selected browser. Do not run standalone Playwright without explicit permission.
- Treat all subagent reports as review hypotheses until checked against current files, command output, screenshots, and hashes.
- A structural exact-ten PASS is not ten independent approvals. Role 10 remains `STOP` if its required isolation cannot be demonstrated.

## Current Evidence Baseline

- `ci:preflight` reached `check:size` after 634/634 test files and 7,292 passing tests; CSS measured 105.13 kB Brotli, 133 B above the 105 kB limit.
- Generated CSS inspection attributes approximately 503 B of marginal Brotli cost to five new one-off padding utilities while equivalent responsive utilities already exist in the bundle.
- The existing Chrome v3 matrix passed eight locales at 320 px and 200% text, including `ar`/`he`, but those artifacts predate the next production build and cannot be final-bound evidence.
- `output/review/e2e-journal-local-serial-canonical-ten-v16-20260716.log` records `COMMAND_EXIT=0` with no source drift for digest `0ef6c2…`; therefore the earlier favorite/locator/context-menu failures must not be reported as current open defects. Current-source journal E2E remains `UNVERIFIED` until rerun permission or equivalent current Chrome proof.

## Task 1: Remove Redundant CSS Without Changing Reflow Behavior

**Files:**

- Modify test: `src/pages/nav-v2/__tests__/OrbPage.test.tsx`
- Modify test: `src/components/state-of-mind/__tests__/EmotionTagGrid.test.tsx`
- Modify production: `src/pages/nav-v2/OrbPage.tsx`
- Modify production: `src/pages/nav-v2/OrbPageSteps.tsx`
- Modify production: `src/components/state-of-mind/EmotionTagGrid.tsx`
- Update ignored execution evidence: `.preflight-token`

**Interfaces:**

- Preserve `data-testid` values, component props, translation keys, DOM order, focus order, scroll ownership, CTA semantics, and breakpoint behavior.
- Replace only these generated-rule sources:

```text
px-[clamp(12px,4vw,24px)] -> px-3 md:px-6
px-[clamp(8px,2.5vw,16px)] -> px-2 md:px-4
px-[clamp(12px,4vw,20px)] -> px-3 sm:px-5
px-[clamp(2px,0.625vw,4px)] -> px-0
px-[clamp(10px,3vw,16px)] -> px-2.5 sm:px-4
```

- Keep the approved narrow heading size, adaptive CTA radius, `sm:flex-wrap`, `sm:flex-1`, natural word-boundary rules, hidden narrow arrow, and scrollable footer.

- [ ] **Step 1: Change only the two focused tests to require the replacement utility contract.**

  Expected assertions: runtime shell has `px-3 md:px-6`; refine scroller has `px-2 md:px-4`; both actions have `px-3 sm:px-5`; emotion group has `px-0`; chips have `px-2.5 sm:px-4`.

- [ ] **Step 2: Run the tests before production edits and record the expected RED.**

  Run:

  ```bash
  npx vitest run src/pages/nav-v2/__tests__/OrbPage.test.tsx src/components/state-of-mind/__tests__/EmotionTagGrid.test.tsx
  ```

  Expected: failures point only to the old clamp classes still present in production.

- [ ] **Step 3: Refresh `.preflight-token` with the CSS size baseline, focused RED output, selected skills, Chrome-only runtime plan, and `verdict: GO`.**

- [ ] **Step 4: Apply the five class substitutions and no other production behavior change.**

- [ ] **Step 5: Rerun the same focused suite GREEN.**

  Run:

  ```bash
  npx vitest run src/pages/nav-v2/__tests__/OrbPage.test.tsx src/components/state-of-mind/__tests__/EmotionTagGrid.test.tsx
  ```

  Acceptance: both files pass with no snapshot or console failure.

- [ ] **Step 6: Rebuild and rerun the exact failed performance gate.**

  Run:

  ```bash
  npm run build
  npm run check:size
  ```

  Acceptance: CSS Brotli is at or below 105 kB with at least 200 B practical headroom; if not, return to root-cause measurement instead of raising the limit.

## Task 2: Freeze Source and Complete the Full Technical Gate

**Files:**

- Write evidence log: `output/reflow-final-20260716/policy-gates/ci-preflight-final-bound-v4.log`
- Update later, only after success: `output/reflow-final-20260716/TASK_DIGESTS.json`

- [ ] **Step 1: Compute the working-tree digest and record tracked/untracked counts before the run.**
- [ ] **Step 2: Run `npm run ci:preflight` once from start to finish and capture its exit code.**
- [ ] **Step 3: Confirm the run reaches the suffix after `check:size`: canonical orbs, best-practices, no-AI-template, audio, RAG, task-completion, sync-contract, and ratchet checks.**
- [ ] **Step 4: Recompute the source digest and reject the run if source drift occurred.**

Acceptance: exit 0, unchanged digest, fresh build, fresh full-test counts, production-data source/bundle gates pass, and no skipped suffix check is mislabeled PASS.

## Task 3: Capture Final-Bound Chrome and Motion Evidence

**Surfaces:** Mood/Orb first-run and refine flow, Settings paper/day and ink/night themes, `en/uk/es/de/fr/ja/ar/he`, LTR and RTL.

- [ ] **Step 1: Serve the final `dist` without rebuilding it and bind Chrome to that preview.**
- [ ] **Step 2: Recheck first-run copy at 320×256 for all eight locales.**
- [ ] **Step 3: Recheck the save-and-start CTA at 320×568, 200% text, and W3C text spacing for all eight locales.**
- [ ] **Step 4: Capture normal and 150% craft screenshots for Ukrainian plus one Arabic and one Hebrew state in both approved theme families where applicable.**
- [ ] **Step 5: Verify document/scroller widths, reachable actions, 44 px targets, keyboard focus, accessible names, `lang`, `dir`, console output, and absence of mid-word splitting.**
- [ ] **Step 6: Verify ambient motion when enabled and static behavior under reduced motion; capture current video or frame evidence rather than inferring feel from unit tests.**
- [ ] **Step 7: From the browser, hash the fetched HTML and loaded JS/CSS bytes; compare those hashes with local `dist` and the frozen source digest.**

Acceptance: every claimed browser state is tied to the final source/build; old v1/v2/v3 artifacts are preserved under `browser/rejected/` or explicitly labeled historical, never mixed into the live manifest.

## Task 4: Rebuild the Evidence Packet Without Stale Claims

**Files:**

- Update: `output/reflow-final-20260716/EVIDENCE_PACKET.md`
- Update: `output/reflow-final-20260716/TASK_DIGESTS.json`
- Preserve historical logs and screenshots under their existing evidence directories.

- [ ] **Step 1: Record RED history, final CSS size, focused/full test counts, CI exit code, source digest, dist hashes, and browser asset comparison.**
- [ ] **Step 2: Replace stale journal language with the factual v16 serial result and mark current-source journal E2E `UNVERIFIED` unless freshly proved.**
- [ ] **Step 3: Add the platform matrix: Web/PWA bounded proof; Android, iOS, Desktop/Tauri, Store/Release, public deploy, native assistive technology, and representative-user preference remain `UNVERIFIED` unless freshly checked.**
- [ ] **Step 4: Run production-data, translation, no-AI-template, best-practices, and agent-orchestra guards relevant to the final packet if the full CI log does not already contain fresh successful results.**

## Task 5: Sequential Exact-Ten and Independent Visual Review

**Canonical order:** coordinator; psychology; logic; accessibility/localization; architecture/data; security/privacy; performance/operations; QA/release; product/visual craft; blind-spot sentinel.

- [ ] **Step 1: Give roles 1–3 the frozen packet and require hash-bound final reports.**
- [ ] **Step 2: Cycle roles 4–9 through available slots in read-only review waves. Each report must cite files/commands/artifacts, list platform impact and unresolved risk, and return `GO`, `STOP`, or `ASK`.**
- [ ] **Step 3: Run the independent visual-integrity critic against current screenshots/video and report Technical, Visual Runtime, Artistic/Craft, Motion, Model, and Plan separately.**
- [ ] **Step 4: Give Role 10 the final packet only after all fixes and record Pass B. Do not convert the existing Pass A isolation failure into PASS unless runtime/tool isolation is actually demonstrated.**
- [ ] **Step 5: Independently verify every agent citation and resolve any reproducible blocker with a new test-first cycle before requesting another review.**

Acceptance: all attainable roles return evidence-backed GO. If Role 10 isolation remains impossible, final status is an explicit exact-ten `STOP/UNVERIFIED`, not a fabricated 10/10 approval.

## Task 6: Completion Decision

- [ ] **Step 1: Re-read this plan and map every explicit and implied requirement to evidence.**
- [ ] **Step 2: Report fresh statuses for Technical, Visual Runtime, Artistic/Craft, Motion, Model, and Plan.**
- [ ] **Step 3: Mark the goal complete only if the objective is actually achieved; otherwise keep the exact blocker and next action visible.**

## Platform Matrix Before Final Claims

| Surface | Required status for this task | Proof boundary |
| --- | --- | --- |
| Web/PWA | PASS | Full CI plus final-bound Chrome matrix and asset hashes |
| Android | UNVERIFIED unless freshly run | Static shared contracts do not prove WebView/device rendering |
| iOS | UNVERIFIED unless freshly run | Static shared contracts do not prove WKWebView/device rendering |
| Desktop/Tauri | UNVERIFIED unless freshly run | Responsive source is not desktop runtime proof |
| Store/Public release | UNVERIFIED | No deploy or store action is authorized |
| Accessibility | PASS for bounded web matrix | DOM/a11y, focus, text-spacing, 200%, target-size and RTL evidence |
| Performance | PASS only after size and CI | CSS ≤105 kB plus no visual downgrade in Chrome |
| Security/Privacy | PARTIAL or PASS by scoped evidence | No new data/auth behavior; current scanner coverage must be stated |
| Operations | PASS for local handoff only | Hash packet, rollback, logs; deploy monitoring remains UNVERIFIED |

## Rollback and Kill Criteria

- Roll back only the five utility substitutions if any final Chrome state regresses compared with v3.
- Reject any approach that raises `.size-limit.json`, deletes copy, shrinks the approved heading, removes accessibility attributes, disables motion globally, or hides overflow.
- Stop after three failed CSS hypotheses and reassess the styling architecture instead of stacking patches.
- Preserve every rejected artifact with an explicit historical label; do not erase contradictory evidence.
