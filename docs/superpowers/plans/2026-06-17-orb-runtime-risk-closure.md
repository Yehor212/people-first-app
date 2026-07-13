# Orb Runtime Risk Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the V2 orb/runtime risks without global test stubs, starting from e2e-before-code evidence and ending with local frontend, backend/sync, security, and build verification.

**Architecture:** Keep the canonical orb family unchanged: `ValenceOrb` for full mood surfaces and `MiniValenceOrb` for compact surfaces. Fix only confirmed root causes: global media API stubbing, non-semantic ambience cleanup, Vite build warning for the runtime bootstrap script, and sync/backend guard gaps. Do not replace orb visuals or hide warnings by weakening tests.

**Tech Stack:** React 18, TypeScript, Vite 8, Vitest, Testing Library, Playwright, Capacitor, Supabase sync guards, local security scanner suite.

---

## File Map

- Modify: `test/setup.ts` - remove global `HTMLMediaElement.play/pause` replacements.
- Modify: `src/pages/nav-v2/OrbPage.tsx` - pause ambience only when playback was actually attempted.
- Modify: `src/pages/nav-v2/__tests__/OrbPage.test.tsx` - keep explicit local media behavior tests for the audio control.
- Modify: `src/pages/nav-v2/__tests__/OrbPage.sensitiveLink.test.tsx` - prove non-audio render/unmount paths do not need a global media patch.
- Modify: `index.html` - add `type="module"` to `runtime-perf-bootstrap.js` only after confirming the build warning source.
- Modify: `public/runtime-perf-bootstrap.js` - make bootstrap module-safe while preserving behavior.
- Evidence only: `scripts/check-sync-contract.cjs`, `scripts/smoke-telegram-sync-drill.cjs`, `supabase/migrations/**`, `src/storage/**` - no backend writes unless a guard identifies a repo-local root cause.

## Task 1: Pre-Code E2E Baseline

**Files:** no production edits.

- [ ] **Step 1: Run V2 route/orb e2e before code**

```bash
ZENFLOW_PLAYWRIGHT_USE_LOCAL_SERVER=true npx playwright test e2e/orb-renderer-lifecycle.spec.ts e2e/nav-v2-mobile-transition.spec.ts --project=chromium --reporter=line
```

Expected baseline: tests either pass or fail with concrete route/runtime evidence. Record console warnings exactly; do not fix before reading them.

- [ ] **Step 2: Run current OrbPage characterization**

```bash
npx vitest run src/pages/nav-v2/__tests__/OrbPage.test.tsx src/pages/nav-v2/__tests__/OrbPage.sensitiveLink.test.tsx src/pages/nav-v2/__tests__/integration.orbToDiaryHandoff.test.tsx
```

Expected baseline before removing the global stub: pass, but not sufficient because `test/setup.ts` currently masks media APIs globally.

## Task 2: Remove Global Media Stubs With TDD

**Files:** `test/setup.ts`, `src/pages/nav-v2/OrbPage.tsx`, `src/pages/nav-v2/__tests__/OrbPage.sensitiveLink.test.tsx`, `src/pages/nav-v2/__tests__/OrbPage.test.tsx`.

- [ ] **Step 1: Remove the global media replacements**

Delete exactly this block from `test/setup.ts`:

```ts
Object.defineProperty(window.HTMLMediaElement.prototype, "play", {
  configurable: true,
  value: () => Promise.resolve(),
});

Object.defineProperty(window.HTMLMediaElement.prototype, "pause", {
  configurable: true,
  value: () => undefined,
});
```

- [ ] **Step 2: Verify RED**

```bash
npx vitest run src/pages/nav-v2/__tests__/OrbPage.sensitiveLink.test.tsx src/pages/nav-v2/__tests__/integration.orbToDiaryHandoff.test.tsx
```

Expected RED: jsdom reports `HTMLMediaElement.prototype.pause` from `OrbPage` cleanup when no user-started audio occurred.

- [ ] **Step 3: Implement semantic cleanup in `OrbPage.tsx`**

Add near ambience state:

```ts
const ambiencePlaybackAttemptedRef = useRef(false);
```

On user pause or muted pause, set the ref back to false after `audio.pause()`. Before `audio.play()`, set it true. On play rejection, set it false. In unmount cleanup, call `audio.pause()` only when `ambiencePlaybackAttemptedRef.current` is true, then reset it and remove `src`.

- [ ] **Step 4: Verify GREEN**

```bash
npx vitest run src/pages/nav-v2/__tests__/OrbPage.test.tsx src/pages/nav-v2/__tests__/OrbPage.sensitiveLink.test.tsx src/pages/nav-v2/__tests__/integration.orbToDiaryHandoff.test.tsx
```

Expected GREEN: all tests pass and output has no global jsdom media API errors.

## Task 3: Fix Confirmed Vite Bootstrap Warning

**Files:** `index.html`, `public/runtime-perf-bootstrap.js`.

- [ ] **Step 1: Confirm warning source**

```bash
npm run build
```

Expected warning before fix: `<script src="/people-first-app/runtime-perf-bootstrap.js"> in "/index.html" can't be bundled without type="module" attribute`.

- [ ] **Step 2: Convert bootstrap script to module-safe form**

In `index.html`, change:

```html
<script src="%BASE_URL%runtime-perf-bootstrap.js"></script>
```

to:

```html
<script type="module" src="%BASE_URL%runtime-perf-bootstrap.js"></script>
```

In `public/runtime-perf-bootstrap.js`, remove the IIFE wrapper and keep the same guarded behavior: read the localStorage guard, honor `runtimePerfGuard/perfGuard` off query values, and set `document.documentElement.dataset.runtimePerf = "startup"` only when the guard is valid.

- [ ] **Step 3: Verify build warning removal**

```bash
npm run build
```

Expected GREEN: build exits 0 and the `runtime-perf-bootstrap.js` bundling warning is absent.

## Task 4: Backend/Sync Guard Verification

**Files:** no backend write unless a check fails with a repo-local root cause.

- [ ] **Step 1: Run sync/backend static contract**

```bash
npm run check:sync-contract
```

Expected: PASS or actionable failure tied to sync/backend contract files.

- [ ] **Step 2: Run migration prefix guard**

```bash
npm run check:supabase-migration-prefixes
```

Expected: PASS.

- [ ] **Step 3: Run sync drill**

```bash
npm run smoke:telegram-sync-drill
```

Expected: PASS or PARTIAL. If PARTIAL is caused only by missing live Supabase account credentials, report that exact proof gap as `UNVERIFIED`, not PASS.

## Task 5: Orb Runtime And Visual Guard Verification

**Files:** no production edits unless a check identifies a root cause.

- [ ] **Step 1: Run canonical orb guard**

```bash
npm run check:canonical-orbs
```

Expected: PASS.

- [ ] **Step 2: Run focused orb/unit suite**

```bash
npx vitest run src/components/state-of-mind/__tests__/ValenceOrb.motion.test.ts src/components/state-of-mind/__tests__/MiniValenceOrb.test.tsx src/components/state-of-mind/__tests__/CompactValenceOrb.test.tsx src/components/state-of-mind/__tests__/ValenceSlider.test.tsx src/components/state-of-mind/__tests__/orbRenderer.test.ts src/components/state-of-mind/__tests__/particleSystem.test.ts src/components/state-of-mind/__tests__/canonicalOrbInvariant.test.ts src/pages/nav-v2/__tests__/OrbPage.test.tsx src/pages/nav-v2/__tests__/integration.orbToDiaryHandoff.test.tsx src/pages/nav-v2/__tests__/OrbPage.sensitiveLink.test.tsx
```

Expected: all selected tests pass with no jsdom media API noise.

- [ ] **Step 3: Run post-code e2e**

```bash
ZENFLOW_PLAYWRIGHT_USE_LOCAL_SERVER=true npx playwright test e2e/orb-renderer-lifecycle.spec.ts e2e/nav-v2-mobile-transition.spec.ts --project=chromium --reporter=line
```

Expected: all selected e2e tests pass.

## Task 6: Build, Security, And Final Gates

**Files:** no new production edits unless a check fails with a concrete root cause.

- [ ] **Step 1: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 2: Production build**

```bash
npm run build
```

Expected: exit 0, no fixed-warning regression.

- [ ] **Step 3: Dependency audit**

```bash
npm run audit:check
```

Expected: no high-or-critical dependency findings introduced by this work.

- [ ] **Step 4: Scoped local security suite**

```bash
bash /Users/yehor/.codex/bin/codex-security-suite.sh --profile auto --path .
```

Expected: no new high-risk findings in touched code. If a scanner is unavailable, report it as `UNVERIFIED`.

- [ ] **Step 5: Diff hygiene**

```bash
git diff --check -- test/setup.ts src/pages/nav-v2/OrbPage.tsx src/pages/nav-v2/__tests__/OrbPage.test.tsx src/pages/nav-v2/__tests__/OrbPage.sensitiveLink.test.tsx index.html public/runtime-perf-bootstrap.js
```

Expected: no whitespace errors.

## Self-Review

1. **Spec coverage:** Covers e2e-before-code, no global stubs, confirmed warning fixes, backend/sync checks, orb guards, security checks, and explicit `UNVERIFIED` handling.
2. **Placeholder scan:** No `TBD`, `TODO`, or generic “fix later” tasks are present. Every step has files, commands, and expected evidence.
3. **Type consistency:** The planned ref name `ambiencePlaybackAttemptedRef` is used consistently. Verification commands match existing scripts and paths.

Execution mode: inline execution in this session, because the user explicitly asked to proceed to completion rather than wait for a subagent/inline choice.
