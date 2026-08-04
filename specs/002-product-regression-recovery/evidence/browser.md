# Browser Evidence: Epic 002 Candidate

**Captured**: 2026-08-04T04:26:03Z
**Runtime**: local production build served at `http://127.0.0.1:4173/people-first-app/`
**Authentication**: none; no credential, production journal, ciphertext, or synthetic business history was introduced

## Strict local production smoke

The smoke used the local candidate URL with both strict failure switches:

```text
ZENFLOW_PERF_URL=http://127.0.0.1:4173/people-first-app/
ZENFLOW_PERF_FAIL_ON_CONSOLE_ERROR=true
ZENFLOW_PERF_FAIL_ON_REQUEST_FAILURE=true
npm run smoke:chrome-performance
```

Result:

- exit `0`;
- 14 isolated phone/desktop route-profile rows for home, orb, habits, diary, planning, settings, and desktop shell;
- every route reached its readiness condition;
- console errors `0`, request failures `0`, failed responses `0`, warnings `0`, diagnostics `0`;
- the largest observed boot long task was `76 ms` on desktop Diary, below the configured `500 ms` boot ceiling;
- the preview server was stopped after the run.

An earlier default run against the currently deployed GitHub Pages `main` also succeeded, but it is excluded from candidate proof because it did not load this branch.

## PWA/offline

`ZENFLOW_PWA_OFFLINE_SKIP_BUILD=true npm run test:e2e:v2:diary-pwa-offline` ran against the current `dist`:

- Chromium phone offline service-worker boot: `PASS`;
- WebKit iPhone route/install metadata: `PASS`;
- inverse cross-project rows: `2 SKIP`, not PASS.

## Authenticated changed surfaces

Password-removal blockers, partial cleanup, and degraded-entry counts require a genuine authenticated protection state. This run neither requested credentials nor manufactured production-reachable entries. Therefore these rendered behaviors remain `UNVERIFIED`:

- blocker-specific recovery after a real decrypt/revision/storage failure;
- biometric/cloud partial success after a real local commit;
- unavailable count for a real incompatible encrypted row;
- all-locale zoom/font-scale reflow and native screen-reader output;
- physical Android Back and native lifecycle behavior.

Local DOM tests cover focus trap/restore, topmost Escape/Back ownership, one status owner, 48px targets, and RTL-safe copy. That is technical source/test evidence, not browser/device or qualified-human acceptance.

## Visual and motion status

The Epic changes availability/recovery UI logic but does not enable or modify Journal Save Ceremony presentation. The disabled animation is absent from the local production bundle. Consequently enabled motion, veil composition, saved-card placement, Artistic/Craft, and user approval remain `UNVERIFIED`, not implicit PASS.
