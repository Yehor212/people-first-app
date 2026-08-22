# Visibility Evidence Contract

## Purpose

This is a human/operator-facing contract for an analysis report. It is not a runtime API or telemetry schema.

## Required Report Fields

| Claim | Required evidence | Forbidden shortcut |
|---|---|---|
| "The agent changed this file" | worktree root, branch, `git status`, file path | agent message or VS Code graph alone |
| "The file should be visible in this VS Code window" | exact opened root or generated one-root `.code-workspace` mapping | repository title alone |
| "The batch reached main" | ancestry/merge relation, PR state, `origin/main` SHA | remote branch existence alone |
| "The public Web/PWA is deployed" | current main SHA, successful deploy job, cache-busted public observation | local source/build alone |
| "The installed PWA is stale/current" | direct installed-profile version/update observation | a clean browser session |
| "A native/Tauri app is released" | platform-specific artifact/version/release receipt | GitHub Pages result |
| "The update path preserves caches" | identify whether the claim concerns `src/lib/versionCheck.ts` or generated `version-check.js` | treating the two layers as identical |

## Status Vocabulary

- `VERIFIED`: Fresh direct evidence satisfies the required report fields.
- `UNVERIFIED`: The claim is plausible but necessary direct evidence is unavailable or intentionally not inspected.
- `FAIL`: A direct check contradicts the claim.
- `N/A`: The surface does not apply, with a reason.
- `SKIP`: A check was deliberately not run, with a reason.

## Safety Constraints

- Do not expose passwords, tokens, PII, journal content, cached database records, or raw private configuration.
- Do not mutate Git remote state, installed browser/PWA storage, deployment state, native app state, or production data while gathering evidence.
- Do not conflate an operator's manual cache-clearing instruction with the generated bootstrap's pre-existing automatic mismatch recovery; record each separately.
- Preserve source and final-diff counts as separate fields when a recovery snapshot is involved.
- Do not use a `main` web deployment as evidence for Android, iOS, or Desktop/Tauri parity.

## Acceptance

An analysis is acceptable only when each user-facing conclusion can be read from one or more rows above, every missing evidence leg is labelled `UNVERIFIED`, and no destructive refresh action is recommended without a new scoped authorization.
