# V2 E2E Testing Strategy Implementation Plan

> **Governance update (2026-08-14):** Execute only an explicitly authorized task and do so SOLO. Use `superpowers:executing-plans` only for an approved plan; do not invoke subagents or auto-start the next task. Existing checkboxes are tracking only.

**Goal:** Make ZenFlow V2 E2E testing faster, more reliable, and more useful by standardizing V2 test setup, splitting test gates by risk, and tying each release claim to the right browser/runtime proof.

**Architecture:** Keep Playwright as the repeatable E2E engine, use the Codex in-app Browser for quick rendered route sanity checks, reserve Chrome for signed-in/profile/extension scenarios, and reserve Computer Use for native/desktop/simulator GUI flows. Add a shared V2 Playwright fixture first, because duplicated localStorage priming is the current reliability bottleneck.

**Tech Stack:** Playwright 1.59.1, React 18, TypeScript, Vite, GitHub Pages, Capacitor 8, Codex Browser, Codex Chrome extension, Codex Computer Use, ZenFlow runtime/sync/orb contracts.

---

## Pre-Flight Artifact

DEPTH:
- Chosen depth: L3.
- Why not shallower: V2 E2E touches navigation, public GitHub Pages proof, phone/desktop parity, auth/onboarding gates, canonical orb runtime, sync smoke, CI, and browser-surface choice.
- Checks completed:
  - Read `ARCHITECTURE.md` Testing section.
  - Read `docs/ai/TELEGRAM_GRADE_RUNTIME_CONTRACT.md`.
  - Read `docs/ai/PREFLIGHT_OPERATOR_TEMPLATE.md`.
  - Read `docs/ai/TASK_COMPLETION_PROTOCOL.md`.
  - Listed current Playwright tests with `npx playwright test --list`.
  - Ran focused public smoke with `npx playwright test e2e/deploy-smoke.spec.ts --project=chromium --reporter=line`.
  - Ran focused orb lifecycle spec to expose the current fixture failure.
  - Verified the public V2 orb route once through Codex in-app Browser.

REQUEST TRANSMUTATION:
- Raw request: research deeply how to conduct V2 E2E testing more productively using Computer, Chrome, Browser, OpenAI Developers, and Superpowers.
- Interpreted outcome: produce a source-backed, repo-specific E2E operating plan that names which tests to run, when to use each browser surface, what current gaps block productivity, and how to fix them.
- Missing but necessary outcomes included: failure analysis for the current V2 lifecycle test, shared fixture plan, risk-based command matrix, CI/public proof strategy, and completion criteria.

GOAL:
- Atomic goal: convert current V2 E2E from duplicated ad hoc specs into a layered, reliable, evidence-backed testing workflow.
- Success criterion: a future worker can implement the tasks below and prove V2 route, visual, performance, sync, public deploy, and native-adjacent risks with the smallest sufficient command set.

EVIDENCE SNAPSHOT:
- [READ: `playwright.config.ts`] Default target is public GitHub Pages, local server is opt-in with `ZENFLOW_PLAYWRIGHT_USE_LOCAL_SERVER=true`, trace is `on-first-retry`, screenshots are `only-on-failure`, projects are `chromium` plus local-only `Mobile Chrome`.
- [READ: `ARCHITECTURE.md`] Local `ci:preflight` does not run Playwright; manual Playwright is required before pushing modal/overlay changes.
- [SEARCH: `e2e` priming] Multiple specs define their own `primeApp`, `primeReleasePreview`, `primeOnboarding`, or raw `addInitScript` setup.
- [CHECK: `npx playwright test --list`] Current inventory is 206 tests in 12 files across `chromium` and local `Mobile Chrome`.
- [CHECK: `npx playwright test e2e/deploy-smoke.spec.ts --project=chromium --reporter=line`] 4 passed in 3.9s.
- [CHECK: `npx playwright test e2e/orb-renderer-lifecycle.spec.ts --project=chromium --reporter=line`] 2 failed because the page rendered `Welcome to ZenFlow` / `Sign in to continue` instead of the V2 orb route; missing or inconsistent gate priming is the root cause.
- [BROWSER: public V2 orb route] In-app Browser saw `orb-page`, `orb-page-hero`, `orb-page-next`, canonical renderer ready, and zero console errors for the checked route.
- [WEB: Playwright best practices] User-visible behavior, isolated tests, user-facing locators, web-first assertions, trace viewer for CI debugging: https://playwright.dev/docs/best-practices.
- [WEB: Playwright fixtures] Use `test.extend()` and page-object-style fixtures to centralize setup: https://playwright.dev/docs/test-fixtures.
- [WEB: Playwright auth] Auth state belongs in ignored `playwright/.auth`, never committed: https://playwright.dev/docs/auth.
- [WEB: Playwright visual comparisons] Screenshot baselines are committed next to specs and reviewed on change: https://playwright.dev/docs/test-snapshots.
- [WEB: Playwright CI and sharding] Install only needed browsers, run on CI frequently, shard when suite time grows: https://playwright.dev/docs/ci and https://playwright.dev/docs/test-sharding.
- [WEB: Playwright service workers] Disable service workers for predictable tests except when testing PWA/cache behavior itself: https://playwright.dev/docs/service-workers.
- [WEB: Vite deploy] `vite preview` previews built output locally and is not a production server: https://vite.dev/guide/static-deploy.html.
- [WEB: Capacitor App API] Android back button and app lifecycle events need explicit runtime coverage when native behavior is claimed: https://capacitorjs.com/docs/apis/app.
- [CODEX: official manual] Use in-app Browser for local/public unauthenticated web checks, Chrome for signed-in/profile/extension state, and Computer Use for GUI/native/desktop app flows.

## Diagnosis

The main productivity issue is not lack of E2E coverage. The repo already has V2 route smoke, visual snapshots, settings hierarchy checks, journal/habits checks, orb renderer lifecycle checks, sync smoke scripts, and performance smoke scripts. The main productivity issue is routing and reliability:

- A fast public smoke gate exists and passes, but local preflight does not include it.
- Several V2 specs duplicate setup, which lets auth/onboarding/privacy gate drift break unrelated tests.
- Visual and runtime tests are mixed with route smoke in a way that encourages either over-running the suite or under-running the relevant gate.
- Browser surface choice is not explicit, so Chrome and Computer Use can be overused where headless Playwright or in-app Browser is more reproducible.
- Public deploy claims need cache-busted public proof, while local dev/preview remains necessary but insufficient.

Root-cause hypothesis for the current orb lifecycle failure:
- `e2e/orb-renderer-lifecycle.spec.ts` primes `zenflow-language-selected`, tutorial/onboarding keys, `zenflow-user`, and V2 flag keys.
- It does not set the same full gate-bypass set used by passing V2 specs, especially `zenflow-google-auth-checked`, `zenflow-notification-permission-checked`, privacy acknowledgement, last seen version, and onboarding state.
- The app therefore renders the sign-in gate before the V2 route assertions, causing false failures that do not measure orb lifecycle.

## Recommended Command Matrix

Use this matrix before expanding the suite:

| Situation | Command or surface | Evidence produced |
| --- | --- | --- |
| Fast V2 public route sanity | `npx playwright test e2e/deploy-smoke.spec.ts --project=chromium --reporter=line` | V1 portal and V2 `orb/habits/diary` route boot proof |
| Local production-equivalent V2 smoke | `ZENFLOW_PLAYWRIGHT_USE_LOCAL_SERVER=true npx playwright test e2e/deploy-smoke.spec.ts --project=chromium --reporter=line` after `npm run build` when production bundle matters | Vite local route proof without relying on public Pages |
| V2 shell / orb visual change | `npx playwright test e2e/nav-v2.spec.ts --project=chromium --reporter=line` | Desktop/phone V2 visual and interaction proof |
| V2 settings change | `npx playwright test e2e/nav-v2-settings.spec.ts --project=chromium --reporter=line` | Settings hierarchy, theme, RTL, privacy toggle proof |
| Canonical orb lifecycle change | `npm run check:canonical-orbs` then `npx playwright test e2e/orb-renderer-lifecycle.spec.ts --project=chromium --reporter=line` | Static invariant plus browser renderer lifecycle proof |
| V2 journal change | `npx playwright test e2e/journal-hub-v2.spec.ts e2e/journal-sidebar.spec.ts --project=chromium --reporter=line` | Phone portal and desktop recovery proof |
| V2 habits change | `npx playwright test e2e/habits-a11y-44px.spec.ts e2e/habits-metrics.spec.ts --project=chromium --reporter=line` | Touch target and analytics event proof |
| Visual-system change | `npx playwright test e2e/design-system.spec.ts --project=chromium --reporter=line` plus committed snapshots | Blocking visual baseline proof |
| Performance/startup/orb route concern | `npm run smoke:chrome-performance` | Cold boot and steady-state long task / LoAF evidence |
| Sync/account/release concern | `npm run check:sync-contract` then `npm run smoke:telegram-sync-drill` | Contract and privacy-safe browser sync evidence |
| Public GitHub Pages claim | Public URL with cache-buster through Playwright or in-app Browser, plus deploy workflow evidence | Public-user proof |
| Signed-in auth/profile scenario | Chrome extension with a dedicated test account only | Real profile/session proof; do not inspect personal cookies/history |
| Native Android/iOS back/lifecycle | Computer Use or simulator/device workflow plus `build:android` or `cap:sync:ios` as appropriate | GUI/native behavior proof |

## Browser Surface Policy

Use the smallest surface that proves the claim:

- Playwright headless: default for repeatable E2E, CI, visual snapshots, route smoke, fixtures, and artifacts.
- Codex in-app Browser: quick local/public rendered sanity, screenshots, DOM checks, and visual comments when login is not needed.
- Chrome extension: signed-in pages, user-profile behavior, extension behavior, or browser-specific profile state. Keep discovery read-only and do not inspect cookies, passwords, local storage, history, or personal sessions.
- Computer Use: macOS/Windows app GUI, native simulator, desktop executable, OS permission prompts, or workflows that cannot be reached through Playwright or Browser.

## Implementation Plan

### Task 1: Add Shared V2 E2E Priming Helper

**Files:**
- Create: `e2e/helpers/zenflowV2State.ts`
- Modify after helper lands: `e2e/orb-renderer-lifecycle.spec.ts`
- Test: `e2e/orb-renderer-lifecycle.spec.ts`

- [ ] **Step 1: Create the helper file**

Create `e2e/helpers/zenflowV2State.ts` with:

```ts
import type { Page } from "@playwright/test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const packageJson = require("../../package.json") as { version: string };

export type ZenflowV2Language = "en" | "uk" | "ar" | "he";
export type ZenflowV2Theme = "paper" | "ink" | "oled";
export type ZenflowV2Layout = "phone" | "desktop";
export type ZenflowV2Route = "orb" | "habits" | "diary" | "settings";

export interface PrimeZenflowV2Options {
  clearStorage?: boolean;
  language?: ZenflowV2Language;
  privacyNoTracking?: boolean;
  theme?: ZenflowV2Theme;
  user?: {
    email?: string;
    id: string;
    name: string;
  };
}

export async function primeZenflowV2(
  page: Page,
  options: PrimeZenflowV2Options = {},
) {
  await page.addInitScript(
    ({ appVersion, options }) => {
      const json = (value: unknown) => JSON.stringify(value);
      const today = new Date().toISOString().split("T")[0];
      const theme = options.theme ?? "paper";

      if (options.clearStorage) {
        localStorage.clear();
        sessionStorage.clear();
      }

      localStorage.setItem("zenflow-language", json(options.language ?? "en"));
      localStorage.setItem("zenflow-language-selected", json(true));
      localStorage.setItem("zenflow-google-auth-checked", json(true));
      localStorage.setItem("zenflow-onboarding-complete", json(true));
      localStorage.setItem("zenflow-notification-permission-checked", json(true));
      localStorage.setItem("zenflow_last_seen_version", appVersion);
      localStorage.setItem("zenflow_last_active", today);
      localStorage.setItem("zenflow-last-weekly-report", new Date().toISOString());
      localStorage.setItem("zenflow-orb-first-run-dismissed", "1");
      localStorage.setItem("zenflow-privacy-acknowledged", json(true));
      localStorage.setItem(
        "zenflow-privacy",
        json({
          analytics: false,
          consentShown: true,
          noTracking: Boolean(options.privacyNoTracking),
        }),
      );
      localStorage.setItem(
        "zenflow_onboarding_state",
        json({
          daysActive: 5,
          firstLoginDate: Date.now(),
          hasSeenWelcome: true,
          isNewUser: false,
          lastActiveDate: today,
          unlockedFeatures: [],
        }),
      );
      localStorage.setItem("zenflow-theme", theme === "paper" ? "light" : "dark");
      localStorage.setItem("zenflow_oled_mode", theme === "oled" ? "true" : "false");
      localStorage.setItem(
        "zenflow:theme-v0c",
        json({ state: { theme }, version: 0 }),
      );

      if (options.user) {
        localStorage.setItem(
          "zenflow-user",
          json({
            email: options.user.email ?? `${options.user.id}@example.invalid`,
            id: options.user.id,
            name: options.user.name,
          }),
        );
      }

      sessionStorage.removeItem("zenflow-orb-webgl-slow-ms");
      sessionStorage.removeItem("zenflow-mood-entry-draft");
    },
    { appVersion: packageJson.version, options },
  );
}

export function v2RoutePath(
  route: ZenflowV2Route,
  options: { dev?: boolean; layout?: ZenflowV2Layout } = {},
) {
  const params = new URLSearchParams({ nav: "v2" });
  if (options.layout) params.set("navLayout", options.layout);
  if (options.dev ?? true) params.set("dev", "true");
  return `${route}?${params.toString()}`;
}
```

- [ ] **Step 2: Update orb lifecycle spec to use the helper**

Replace the local gate setup in `e2e/orb-renderer-lifecycle.spec.ts` with:

```ts
import { expect, test } from "@playwright/test";
import { primeZenflowV2, v2RoutePath } from "./helpers/zenflowV2State";

const LATE_SWAP_CUTOFF_MS = 1200;

async function primeOrbPage(page: import("@playwright/test").Page) {
  await primeZenflowV2(page, {
    language: "uk",
    theme: "paper",
    user: {
      id: "orb-renderer-lifecycle",
      name: "Orb Probe",
    },
  });

  await page.addInitScript(() => {
    const win = window as typeof window & {
      __zenOrbCanvasEvents?: Array<{
        event: "appendCanvas" | "replaceCanvas";
        at: number;
        oldWidth?: number;
        newWidth?: number;
      }>;
    };
    win.__zenOrbCanvasEvents = [];

    const isCanvas = (node: Node): node is HTMLCanvasElement =>
      node.nodeName === "CANVAS" &&
      typeof (node as HTMLCanvasElement).width === "number" &&
      typeof (node as HTMLCanvasElement).height === "number";

    const originalAppendChild = Element.prototype.appendChild;
    Element.prototype.appendChild = function appendChildWithOrbProbe<T extends Node>(
      child: T,
    ): T {
      const result = originalAppendChild.call(this, child) as T;
      if (isCanvas(child)) {
        win.__zenOrbCanvasEvents?.push({
          event: "appendCanvas",
          at: Math.round(performance.now()),
          newWidth: child.width,
        });
      }
      return result;
    };

    const originalReplaceChild = Element.prototype.replaceChild;
    Element.prototype.replaceChild = function replaceChildWithOrbProbe<T extends Node>(
      newChild: Node,
      oldChild: T,
    ): T {
      const result = originalReplaceChild.call(this, newChild, oldChild) as T;
      if (isCanvas(newChild) || isCanvas(oldChild)) {
        win.__zenOrbCanvasEvents?.push({
          event: "replaceCanvas",
          at: Math.round(performance.now()),
          oldWidth: isCanvas(oldChild) ? oldChild.width : undefined,
          newWidth: isCanvas(newChild) ? newChild.width : undefined,
        });
      }
      return result;
    };
  });
}
```

Then replace each navigation in that file:

```ts
await page.goto(v2RoutePath("orb", { layout: "phone" }), {
  waitUntil: "domcontentloaded",
});
```

- [ ] **Step 3: Verify the failure is gone**

Run:

```bash
npx playwright test e2e/orb-renderer-lifecycle.spec.ts --project=chromium --reporter=line
```

Expected:

```text
Running 2 tests using 2 workers
2 passed
```

### Task 2: Migrate Other V2 Specs To The Shared Helper

**Files:**
- Modify: `e2e/deploy-smoke.spec.ts`
- Modify: `e2e/nav-v2-settings.spec.ts`
- Modify: `e2e/journal-hub-v2.spec.ts`
- Modify: `e2e/journal-sidebar.spec.ts`
- Modify: `e2e/habits-a11y-44px.spec.ts`
- Modify: `e2e/habits-metrics.spec.ts`
- Keep separate for now: `e2e/nav-v2.spec.ts`, because it contains time/theme/snapshot-specific setup and should be migrated after Task 1 proves stable.

- [ ] **Step 1: Replace duplicated gate keys with `primeZenflowV2`**

For each listed file, import:

```ts
import { primeZenflowV2, v2RoutePath } from "./helpers/zenflowV2State";
```

Use the helper in each `beforeEach` or local setup:

```ts
await primeZenflowV2(page, {
  language: "en",
  theme: "paper",
});
```

For Ukrainian deploy smoke:

```ts
await primeZenflowV2(page, {
  language: "uk",
  privacyNoTracking: true,
  theme: "paper",
});
```

For RTL settings:

```ts
await primeZenflowV2(page, {
  language: "he",
  theme: "paper",
});
```

- [ ] **Step 2: Use `v2RoutePath` for relative route consistency**

Replace route literals like:

```ts
await page.goto("diary?nav=v2&dev=true&navLayout=phone");
```

with:

```ts
await page.goto(v2RoutePath("diary", { layout: "phone" }));
```

Keep absolute `/people-first-app/...` route checks in deploy smoke when the assertion is specifically about public link targets.

- [ ] **Step 3: Verify migrated specs**

Run:

```bash
npx playwright test \
  e2e/deploy-smoke.spec.ts \
  e2e/nav-v2-settings.spec.ts \
  e2e/journal-hub-v2.spec.ts \
  e2e/journal-sidebar.spec.ts \
  e2e/habits-a11y-44px.spec.ts \
  e2e/habits-metrics.spec.ts \
  --project=chromium \
  --reporter=line
```

Expected:

```text
0 failed
```

### Task 3: Add Purpose-Built E2E Script Names

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add script names without changing existing scripts**

Add these entries under `scripts`:

```json
"test:e2e:v2:smoke": "playwright test e2e/deploy-smoke.spec.ts --project=chromium",
"test:e2e:v2:critical": "playwright test e2e/deploy-smoke.spec.ts e2e/orb-renderer-lifecycle.spec.ts e2e/nav-v2-settings.spec.ts --project=chromium",
"test:e2e:v2:visual": "playwright test e2e/nav-v2.spec.ts e2e/design-system.spec.ts --project=chromium",
"test:e2e:v2:journal": "playwright test e2e/journal-hub-v2.spec.ts e2e/journal-sidebar.spec.ts --project=chromium",
"test:e2e:v2:habits": "playwright test e2e/habits-a11y-44px.spec.ts e2e/habits-metrics.spec.ts --project=chromium"
```

- [ ] **Step 2: Verify script routing**

Run:

```bash
npm run test:e2e:v2:smoke -- --reporter=line
npm run test:e2e:v2:critical -- --reporter=line
```

Expected:

```text
0 failed
```

### Task 4: Add E2E Operating Notes To Architecture Or A Dedicated Guide

**Files:**
- Prefer create: `docs/testing/V2_E2E_RUNBOOK.md`
- Optionally modify: `ARCHITECTURE.md` Testing section with a short pointer only.

- [ ] **Step 1: Create the runbook**

Create `docs/testing/V2_E2E_RUNBOOK.md` with:

```markdown
# V2 E2E Runbook

## Default Rule

Use the smallest proof that matches the risk. Public route claims need public route proof. Local UI changes need local production-equivalent proof. Visual/canvas/orb changes need screenshot or lifecycle proof. Sync/account claims need sync drill proof.

## Fast Commands

| Risk | Command |
| --- | --- |
| V2 public route smoke | `npm run test:e2e:v2:smoke -- --reporter=line` |
| V2 critical route/runtime smoke | `npm run test:e2e:v2:critical -- --reporter=line` |
| V2 visual/orb shell | `npm run check:canonical-orbs && npm run test:e2e:v2:visual -- --reporter=line` |
| V2 journal | `npm run test:e2e:v2:journal -- --reporter=line` |
| V2 habits | `npm run test:e2e:v2:habits -- --reporter=line` |
| Performance | `npm run smoke:chrome-performance` |
| Sync/account | `npm run check:sync-contract && npm run smoke:telegram-sync-drill` |

## Browser Surface Choice

- Headless Playwright: repeatable E2E and CI.
- In-app Browser: quick rendered sanity and screenshots for unauthenticated local/public routes.
- Chrome: signed-in/profile/extension behavior with dedicated test accounts.
- Computer Use: native simulator, desktop executable, or OS GUI behavior.

## Public Proof

Use `https://yehor212.github.io/people-first-app/orb/?nav=v2&navLayout=phone&cacheBust=<timestamp>` or the matching route with a cache buster before claiming deployed behavior.
```

- [ ] **Step 2: Add a short Architecture pointer**

In `ARCHITECTURE.md` under "Playwright E2E", add:

```markdown
- **V2 runbook**: `docs/testing/V2_E2E_RUNBOOK.md` maps V2 smoke, visual, performance, sync, public, Chrome, Browser, and Computer Use proof.
```

- [ ] **Step 3: Verify docs are searchable**

Run:

```bash
rg -n "V2 E2E Runbook|test:e2e:v2|Browser Surface Choice" docs ARCHITECTURE.md package.json
```

Expected:

```text
docs/testing/V2_E2E_RUNBOOK.md
ARCHITECTURE.md
package.json
```

### Task 5: Stabilize Waiting And Failure Artifacts

**Files:**
- Modify gradually: `e2e/smoke.spec.ts`
- Modify gradually: `e2e/nav-v2.spec.ts`
- Modify gradually: `e2e/visual-regression.spec.ts`

- [ ] **Step 1: Replace fixed sleeps only where a stable app signal exists**

Prefer:

```ts
await expect(page.getByTestId("orb-page")).toBeVisible({ timeout: 20_000 });
await expect(page.getByTestId("orb-page-next")).toBeVisible({ timeout: 20_000 });
```

over:

```ts
await page.waitForTimeout(2000);
```

Do not remove a fixed wait that intentionally lets animation settle for a screenshot unless a deterministic state signal exists.

- [ ] **Step 2: Keep traces as retry-only by default**

Keep `trace: "on-first-retry"` in `playwright.config.ts`. Use local one-off trace only for debugging:

```bash
npx playwright test e2e/nav-v2-settings.spec.ts --project=chromium --trace on --reporter=line
```

- [ ] **Step 3: Verify no broad accidental sleep cleanup**

Run:

```bash
rg -n "waitForTimeout" e2e
```

Expected:

```text
Only intentional animation/screenshot waits remain, each near a comment or a following deterministic assertion.
```

### Task 6: Add Auth And Sync E2E Boundaries Without Personal Chrome State

**Files:**
- Keep primary sync proof in existing scripts: `npm run smoke:telegram-sync-drill`
- Modify: `docs/testing/V2_E2E_RUNBOOK.md`

- [ ] **Step 1: Add the auth boundary to the runbook**

Add this section to `docs/testing/V2_E2E_RUNBOOK.md`:

```markdown
## Auth And Sync Boundary

Do not use a personal Chrome profile as proof for sync or auth. Use one of these evidence paths:

1. Privacy-safe sync health without credentials:
   `npm run smoke:sync-health`
2. Release-grade sync closure:
   `npm run check:sync-contract && npm run smoke:telegram-sync-drill`
3. Dedicated same-account proof only when `ZENFLOW_SYNC_TEST_EMAIL` and `ZENFLOW_SYNC_TEST_PASSWORD` are configured for a smoke account.

If credentials are missing, report the same-account row as `UNVERIFIED`; do not replace it with a personal browser session.
```

- [ ] **Step 2: Protect future Playwright auth state**

Add this line to `.gitignore` only when a dedicated Playwright auth setup file is introduced:

```gitignore
playwright/.auth
```

- [ ] **Step 3: Keep sync release proof in the existing drill**

Run:

```bash
npm run check:sync-contract
npm run smoke:telegram-sync-drill
```

Expected:

```text
PASS for contract and either PASS or UNVERIFIED with explicit missing credential reason for live account proof.
```

## CI Recommendation

Do not put all 206 E2E tests into every local preflight. Use these gates:

1. PR / local fast gate:
   - `npm run test:e2e:v2:smoke -- --reporter=line`
2. V2 route/runtime PR gate when `src/pages/nav-v2/**`, canonical orb files, sync runtime, or V2 routing changes:
   - `npm run test:e2e:v2:critical -- --reporter=line`
3. Visual workflow:
   - keep `e2e/design-system.spec.ts` as the blocking visual workflow.
   - add `e2e/nav-v2.spec.ts` selectively if visual workflow time budget allows after fixture stabilization.
4. Deploy workflow:
   - keep `deploy-smoke`, `check:canonical-orbs`, `check:sync-contract`, and `smoke:telegram-sync-drill`.
   - public proof remains mandatory before public-user claims.
5. Full suite:
   - run manually or scheduled:
     ```bash
     npx playwright test --project=chromium --reporter=line
     ```
   - use sharding in CI if full suite becomes a required PR gate:
     ```bash
     npx playwright test --project=chromium --shard=1/4
     npx playwright test --project=chromium --shard=2/4
     npx playwright test --project=chromium --shard=3/4
     npx playwright test --project=chromium --shard=4/4
     ```

## Completion Proof For This Plan

This research/plan artifact is complete when:

- `npx playwright test --list` still reports the current suite inventory.
- `npx playwright test e2e/deploy-smoke.spec.ts --project=chromium --reporter=line` passes.
- `npx playwright test e2e/orb-renderer-lifecycle.spec.ts --project=chromium --reporter=line` failure is documented as a fixture/setup failure, not hidden.
- The plan file is present at `docs/superpowers/plans/2026-06-14-v2-e2e-testing-strategy.md`.
- A placeholder scan for unfinished markers returns no matches.

The V2 E2E system itself is not fully remediated until Tasks 1-6 are implemented and verified.
