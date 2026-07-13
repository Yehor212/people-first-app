# V2 Edge-To-Edge Fullscreen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make the V2 app shell, login gate, and every V2 route feel genuinely fullscreen by drawing backgrounds edge-to-edge while keeping interactive content inside safe areas.

**Architecture:** Add one V2-owned document-level fullscreen mode that neutralizes global body safe-area padding only while V2 is mounted. Keep existing route visuals intact, but route top/bottom chrome through shared viewport and safe-area variables that support both browser `env()` and Capacitor 8 SystemBars CSS fallbacks.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind, CSS custom properties, Vitest static contract tests, Playwright visual checks, Capacitor 8 SystemBars.

---

### Task 1: Regression Contract

**Files:**
- Create: `src/pages/nav-v2/__tests__/v2FullscreenSurfaceContract.test.ts`

- [x] **Step 1: Write the failing test**

Add a static contract test that requires `useV2FullscreenSurface`, `.zenflow-v2-edge-to-edge`, shared `--app-viewport-height`, browser + Capacitor safe-area fallbacks, `v2-edge-to-edge-surface`, and `v2-fullscreen-page` on every V2 route shell.

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run --configLoader runner src/pages/nav-v2/__tests__/v2FullscreenSurfaceContract.test.ts`

Expected: FAIL because V2 does not yet have the new fullscreen surface contract.

### Task 2: V2 Fullscreen Mode

**Files:**
- Create: `src/hooks/useV2FullscreenSurface.ts`
- Modify: `src/pages/Index.tsx`
- Modify: `src/index.css`

- [x] **Step 1: Implement the hook**

Add a small effect hook that adds `zenflow-v2-edge-to-edge` to `html` and `body` while V2 is mounted, and removes it on unmount.

- [x] **Step 2: Mount it from `IndexV2Impl`**

Call `useV2FullscreenSurface()` near other V2 boot hooks so login/auth gates and V2 routes inherit the same document mode.

- [x] **Step 3: Add CSS contract**

Define `--app-viewport-height` with `100vh` fallback and `100dvh` enhancement. Update `--safe-*` variables to use `max(env(...), var(--safe-area-inset-..., 0px))`. Add `.zenflow-v2-edge-to-edge` and `.v2-edge-to-edge-surface` rules that draw edge-to-edge and remove body safe-area gutters only inside V2.

### Task 3: Route Surface Alignment

**Files:**
- Modify: `src/components/navigation-v2/NavV2Orchestrator.tsx`
- Modify: `src/pages/nav-v2/OrbPage.tsx`
- Modify: `src/pages/nav-v2/habits/HabitsPage.tsx`
- Modify: `src/pages/nav-v2/DiaryPage.tsx`
- Modify: `src/pages/nav-v2/settings/components/SettingsPageComponents.tsx`
- Modify: `src/features/journal/JournalModule.tsx`
- Modify: `src/index.css`

- [x] **Step 1: Add shell/page classes**

Apply `v2-edge-to-edge-surface` to the V2 orchestrator and `v2-fullscreen-page` to each route-level main/page shell.

- [x] **Step 2: Replace direct top-level viewport islands**

Replace top-level `h-[100svh]` and `min-h-[100svh]` with `var(--app-viewport-height)`. Keep internal scroll and route layout behavior unchanged.

- [x] **Step 3: Route chrome through shared safe variables**

Use `var(--safe-top)` and `var(--safe-bottom)` for menu buttons, ambient controls, route padding, and V2 background CSS where SystemBars fallback matters.

### Task 4: Verification

- [x] **Step 1: Focused green test**

Run: `npx vitest run --configLoader runner src/pages/nav-v2/__tests__/v2FullscreenSurfaceContract.test.ts`

Expected: PASS.

- [x] **Step 2: Related tests**

Run: `npx vitest run --configLoader runner src/pages/nav-v2/__tests__/v2ReadabilityContract.test.ts src/components/__tests__/EntryGate.safeArea.test.ts src/components/navigation-v2/__tests__/NavV2Orchestrator.test.tsx src/pages/nav-v2/__tests__/OrbPage.test.tsx src/pages/nav-v2/habits/__tests__/HabitsPage.test.tsx src/pages/nav-v2/__tests__/DiaryPage.audio.test.tsx src/pages/nav-v2/__tests__/SettingsPage.test.tsx`

Expected: PASS or report exact failures.

- [x] **Step 3: Build/static checks**

Run `npm run typecheck` and `npm run build` if feasible; report exact blockers as `UNVERIFIED`.

- [x] **Step 4: Visual runtime proof**

Use Playwright against a local production-equivalent V2 route. Capture phone and desktop screenshots/facts for `/orb/?nav=v2&navLayout=phone&dev=true`, plus adjacent V2 routes when feasible. Confirm root/page backgrounds cover the viewport, no safe-area color band is visible, and no V2 page content is clipped under system areas.
