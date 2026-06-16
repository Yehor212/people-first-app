# V2 E2E Runbook

## Default Rule

Use the smallest proof that matches the risk. Public route claims need public route
proof. Local UI changes need local production-equivalent proof. Visual, canvas,
and orb changes need screenshot or lifecycle proof. Sync and account claims need
sync drill proof.

## Fast Commands

| Risk | Command |
| --- | --- |
| V2 public route smoke | `npm run test:e2e:v2:smoke -- --reporter=line` |
| V2 critical route/runtime smoke | `npm run test:e2e:v2:critical -- --reporter=line` |
| V2 visual/orb shell | `npm run check:canonical-orbs && npm run test:e2e:v2:visual -- --reporter=line` |
| V2 mobile route transition | `ZENFLOW_PLAYWRIGHT_USE_LOCAL_SERVER=true npx playwright test e2e/nav-v2-mobile-transition.spec.ts --project="Mobile Chrome" --reporter=line` |
| V2 journal | `npm run test:e2e:v2:journal -- --reporter=line` |
| V2 habits | `npm run test:e2e:v2:habits -- --reporter=line` |
| Performance | `npm run smoke:chrome-performance` |
| Sync/account | `npm run check:sync-contract && npm run smoke:telegram-sync-drill` |

## Browser Surface Choice

- Headless Playwright: repeatable E2E and CI.
- In-app Browser: quick rendered sanity and screenshots for unauthenticated local
  or public routes.
- Chrome: signed-in, profile, extension, or browser-profile behavior with
  dedicated test accounts.
- Computer Use: native simulator, desktop executable, OS permission prompts, or
  app GUI behavior that cannot be reached through Playwright or Browser.

## Public Proof

Use a cache-busted public route before claiming deployed behavior, for example:

```text
https://yehor212.github.io/people-first-app/orb/?nav=v2&navLayout=phone&cacheBust=<timestamp>
```

Local preview is useful evidence, but it does not prove GitHub Pages behavior.

For phone route-freeze reports, prove both sides:

- Local production-equivalent preview must show `data-nav-layout="phone"`,
  `data-active-page="habits"`, a user-visible `main` named `Habits`,
  `document.startViewTransition` calls equal `0`, no horizontal overflow, and
  bounded transition work during Mood/Orb -> Habits. Record `longTaskCount`,
  `maxLongTaskMs`, `longAnimationFrameCount`, and `maxLoafBlockingMs`; do not
  claim "no long tasks" unless the recorded count is exactly `0`.
- Cache-busted public GitHub Pages must be checked separately. If public still
  calls View Transitions while local does not, report deploy/cache status as the
  remaining blocker instead of adding a loading mask over the delay.
- Keep screenshot and JSON facts under `output/v2-mobile-transition-YYYYMMDD/`.

## Auth And Sync Boundary

Do not use a personal Chrome profile as proof for sync or auth. Use one of these
evidence paths:

1. Privacy-safe sync health without credentials:
   `npm run smoke:sync-health`
2. Release-grade sync closure:
   `npm run check:sync-contract && npm run smoke:telegram-sync-drill`
3. Dedicated same-account proof only when `ZENFLOW_SYNC_TEST_EMAIL` and
   `ZENFLOW_SYNC_TEST_PASSWORD` are configured for a smoke account.

If credentials are missing, report the same-account row as `UNVERIFIED`; do not
replace it with a personal browser session.

## Shared V2 Fixture

Use `primeZenflowV2()` from `e2e/helpers/zenflowV2State.ts` for new V2 specs.
Duplicating localStorage gate setup in each spec is fragile and can accidentally
route tests to the sign-in or onboarding screens instead of V2.

Use `v2RoutePath()` from the same helper for relative V2 route navigation:

```ts
await primeZenflowV2(page, { language: "en", theme: "paper" });
await page.goto(v2RoutePath("orb", { layout: "phone" }));
```
