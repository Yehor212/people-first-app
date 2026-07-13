# Test-First Agent Policy

Date: 2026-06-15
Owner: ZenFlow agents

## Rule

For first-party behavior changes, bug fixes, refactors, and user-visible features, agents must choose the smallest useful test or proof before production code, watch it fail for the right reason or capture a characterization baseline, then implement the minimal change and rerun the same evidence green.

Think first. Before choosing a test, identify the target behavior, affected platform or domain, user risk, and smallest evidence that would have caught the issue.

## Pre-Code Gate

Before editing first-party production code:

1. Name the expected behavior, affected platform/domain, and failure risk.
2. Choose the smallest useful evidence source that fails closest to the risk.
3. Add or select the test, smoke, trace, screenshot, or characterization check before changing production code.
4. Run it before code and record the result:
   - New regression tests must fail for the expected reason, not because of typos, setup errors, or missing fixtures.
   - Existing behavior, legacy refactors, and hard-to-test paths need characterization evidence before edits.
   - Visual or performance work needs before evidence such as a screenshot, DOM/a11y assertion, timing sample, long-task trace, or route-visible reproduction.
5. Implement only the scoped change needed to satisfy that evidence.
6. Rerun the same evidence and confirm it passes.
7. Run broader checks that match the blast radius, then mark any missing browser, native, platform, or deploy proof as `UNVERIFIED`.

## Hook Enforcement

The repository checks this policy for guarded Codex edits with `.codex/hooks/change-governance-gate.cjs`, registered in `.codex/hooks.json` for `PreToolUse`. The hook is a local guardrail and CI/review backstop, not tamper-proof proof that every client or shell mutation passed through it.

The hook allows focused tests, plan files, discovery artifacts, and token files before implementation. For guarded production, enforcement, config, platform, or agent files, add a `test_first` object inside a fresh structured `.preflight-token`. Legacy standalone token names remain ignored local artifacts but are not sufficient for the Codex change gate.

Required evidence fields:

- `timestamp`: ISO timestamp no older than four hours.
- `behavior`: expected behavior or contract being protected.
- `risk`: what bug, regression, or workflow failure the test would catch.
- `evidence_type`: for example `red-test`, `characterization`, `visual-baseline`, `performance-repro`, or `static-contract`.
- `command`: the exact test, smoke, trace, screenshot, or proof command/source used before code.
- `expected_red` or `baseline`: what failed or what characterization proof was captured before implementation.
- `verification_plan`: the same evidence to rerun green plus broader checks.
- `verdict`: `GO` when present.

Do this for:

- Business logic, dates, sync, persistence, auth, security, and migrations: unit or integration test first.
- UI state, overlays, accessibility, storage gates, and component contracts: Testing Library or static contract test first.
- Navigation, runtime hangs, route transitions, mobile WebView behavior, and critical journeys: Playwright or browser smoke test first.
- Performance or "feels frozen" bugs: reproduce with browser timing, long-task, trace, or route-visible evidence, then add the closest regression test that would have caught it. For route or tab changes, the first failing check should cover immediate user-visible feedback, not only eventual destination visibility.
- Visual-only redesigns: capture a before screenshot or existing visual baseline first, then update visual/a11y evidence after the change.

## E2E Productivity Rules

- Do not default every change to E2E. Start with the smallest test that would have caught the failure, then add E2E only when the user journey, route, browser behavior, mobile WebView behavior, deployment, storage boundary, or cross-component integration is the real risk.
- When E2E is the right level, keep it user-visible and resilient: prefer roles, labels, visible text, stable test contracts, isolated storage/session setup, and explicit route state over CSS selectors or implementation details.
- Pair expensive E2E coverage with faster unit, integration, or component regression tests when the root cause can be isolated. E2E should prove the journey; lower-level tests should make future diagnosis fast.
- For V2 navigation, orb, sync, mobile, overlay, and runtime-freeze claims, use Playwright or Browser evidence against the canonical route or a production-equivalent local build, then run the repo checks named in `AGENTS.md`.

## Exceptions

- Documentation-only changes can use review/proofreading, source-link checks, instruction-reference checks, and agent-context checks instead of code tests.
- Pure copy changes can use i18n/type checks and screenshot proof.
- Generated code or config-only changes need the closest schema, generation, lint, or contract check before claiming `PASS`.
- Emergency fixes may proceed without a red test only when the blocker is documented, but final status must mark the missing red test as `UNVERIFIED` or add it before completion.
- Exploratory prototypes must not be called PASS until they have the right regression evidence.

## Test Selection

Use the test level that fails closest to the user-visible risk:

| Risk | Preferred first test |
| --- | --- |
| Pure function or formatter | Vitest unit test |
| Zustand hook/store interaction | Vitest integration/hook test |
| Component state, ARIA, modal behavior | Testing Library component test |
| Route transition, overlay blocking, mobile tap issue | Playwright E2E or Browser proof |
| Layout, overlap, responsive behavior | Playwright screenshot plus DOM/a11y assertions |
| Runtime responsiveness | Browser timing, long-task or trace evidence plus regression smoke |

## Evidence Sources

- OpenAI Codex guidance: durable repository instructions belong in `AGENTS.md`, which Codex reads before work. Source: https://developers.openai.com/codex/guides/agents-md
- Testing Library guiding principle: tests should resemble how users use the software. Source: https://testing-library.com/docs/guiding-principles/
- Playwright best practices: test user-visible behavior, isolate tests, and use resilient locators and web-first assertions. Source: https://playwright.dev/docs/best-practices
- Web responsiveness bugs should be investigated through interaction delay, slow-interaction, and long-task evidence. Source: https://web.dev/articles/optimize-inp
- React route or tab changes that may suspend or render heavy content should keep urgent feedback visible while non-urgent UI work runs. Source: https://react.dev/reference/react/useTransition
- Test size should match risk: small tests for pure logic, medium integration tests for services, large tests for full user journeys. Source: https://testing.googleblog.com/2010/12/test-sizes.html

## Completion Checklist

- Red test or characterization evidence exists before production change.
- Production change is scoped to the failing behavior.
- Same test passes after the fix.
- Broader checks match the blast radius.
- Any missing platform, browser, or native verification is marked `UNVERIFIED`.
