# V2 Page Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cover every V2 page route with contract-level tests so future changes cannot test only entry/orb while forgetting habits, diary, or settings.

**Architecture:** Keep the coverage lightweight and close to existing patterns: source-contract tests verify the V2 route inventory, direct route smoke coverage, fullscreen/readability shell invariants, and performance route matrix. Runtime E2E stays in existing Playwright deploy smoke and receives the missing settings route. No production UI redesign is required.

**Tech Stack:** Vitest static contract tests, Playwright deploy smoke inventory, React/Vite V2 navigation files.

---

### Task 1: Add V2 Route Coverage Contract

**Files:**
- Create: `src/pages/nav-v2/__tests__/v2PageCoverageContract.test.ts`
- Read: `src/hooks/useNavigationV2.ts`, `src/components/navigation-v2/NavV2Orchestrator.tsx`, `e2e/deploy-smoke.spec.ts`, `e2e/helpers/zenflowV2State.ts`, `config/chrome-performance-budgets.json`

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const v2Pages = ["orb", "habits", "diary", "settings"] as const;

describe("V2 page coverage contract", () => {
  it("keeps the route inventory synchronized across navigation, loaders, helpers, smoke, and perf budgets", () => {
    const navHook = read("src/hooks/useNavigationV2.ts");
    const orchestrator = read("src/components/navigation-v2/NavV2Orchestrator.tsx");
    const deploySmoke = read("e2e/deploy-smoke.spec.ts");
    const helper = read("e2e/helpers/zenflowV2State.ts");
    const perfBudgets = read("config/chrome-performance-budgets.json");

    expect(navHook).toContain("export const NAV_V2_PAGES");
    for (const page of v2Pages) {
      expect(navHook).toContain(`"${page}"`);
      expect(orchestrator).toContain(`${page}: load${page[0].toUpperCase()}${page.slice(1)}Page`);
      expect(helper).toContain(`| "${page}"`);
      expect(deploySmoke).toContain(`${page}?nav=v2&navLayout=phone&dev=true`);
      expect(perfBudgets).toContain(`"${page}-v2-phone"`);
      expect(perfBudgets).toContain(`"${page}-v2-desktop"`);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/pages/nav-v2/__tests__/v2PageCoverageContract.test.ts`
Expected: FAIL because `e2e/deploy-smoke.spec.ts` does not contain `settings?nav=v2&navLayout=phone&dev=true`.

### Task 2: Add Missing Settings Direct Route Smoke

**Files:**
- Modify: `e2e/deploy-smoke.spec.ts`
- Test: `src/pages/nav-v2/__tests__/v2PageCoverageContract.test.ts`

- [ ] **Step 1: Implement minimal test target**

Add this entry to the direct V2 route loop:

```ts
{ path: "settings?nav=v2&navLayout=phone&dev=true", testId: "settings-page" },
```

- [ ] **Step 2: Run contract green**

Run: `npm test -- src/pages/nav-v2/__tests__/v2PageCoverageContract.test.ts`
Expected: PASS.

### Task 3: Broaden Fullscreen Contract To Explicit Inventory

**Files:**
- Modify: `src/pages/nav-v2/__tests__/v2FullscreenSurfaceContract.test.ts`

- [ ] **Step 1: Add inventory-backed assertions**

Assert all four V2 page sources contain `data-testid`, `data-v2-readable-page`, `v2-fullscreen-page`, and `var(--app-viewport-height)` for their specific page.

- [ ] **Step 2: Run fullscreen contract**

Run: `npm test -- src/pages/nav-v2/__tests__/v2FullscreenSurfaceContract.test.ts`
Expected: PASS after assertions match current page shells.

### Task 4: Verification

- [ ] Run targeted coverage/fullscreen tests.
- [ ] Run deploy-smoke spec if feasible locally, or mark runtime smoke as UNVERIFIED if browser/server setup blocks it.
- [ ] Run `npm run check:visual` and a focused build/test gate matching touched files.
- [ ] Run Snyk scoped scan if first-party TypeScript changed; for test-only/e2e changes, scan modified V2 test/e2e scope if Snyk CLI is available.
