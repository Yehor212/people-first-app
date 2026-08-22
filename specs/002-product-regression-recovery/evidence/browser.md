# Browser Evidence: Wave 1 Candidate

**Captured**: 2026-08-04T07:25:17.485Z
**Runtime**: local production build served at `http://127.0.0.1:4173/people-first-app/`
**Authentication**: none; no credential, production journal, ciphertext, or synthetic business history was introduced
**Retained report**: ignored local artifact `output/epic002-wave1-chrome-performance.json`
**Report SHA-256**: `f5284feddfd01c8c01c74124872748e9b76eccff90eb6e6b02202d0ab52ef893`

## Strict local production smoke

The smoke used the production-equivalent Wave 1 build and both strict failure
switches:

```text
ZENFLOW_PERF_URL=http://127.0.0.1:4173/people-first-app/
ZENFLOW_PERF_FAIL_ON_CONSOLE_ERROR=true
ZENFLOW_PERF_FAIL_ON_REQUEST_FAILURE=true
ZENFLOW_PERF_OUTPUT=output/epic002-wave1-chrome-performance.json
npm run smoke:chrome-performance
```

Result:

- exit `0`;
- 14 isolated phone/desktop route-profile rows for home, orb, habits, diary,
  planning, settings, and desktop shell;
- route readiness `14/14` and app readiness `14/14`;
- console errors `0`, request failures `0`, failed responses `0`,
  warnings `0`, diagnostics `0`;
- largest raw boot long task `61 ms` on desktop Diary; filtered boot long
  task `0 ms`;
- largest boot long animation frame `158.5 ms` on phone Home; configured boot
  long-task ceiling `500 ms`;
- the preview server was stopped after the run.

The smoke initializes only its isolated local app metadata, onboarding, and
theme state. Those are validator controls, not journal, habit, account, or
production records. An earlier run against deployed `main` is excluded from
candidate proof because it did not load this branch.

## PWA/offline

`ZENFLOW_PWA_OFFLINE_SKIP_BUILD=true npm run test:e2e:v2:diary-pwa-offline`
ran against the same current `dist`:

- Chromium phone offline service-worker boot: `PASS`;
- WebKit iPhone route/install metadata: `PASS`;
- inverse cross-project rows: `2 SKIP`, not PASS.

## Authenticated changed surfaces

Password-removal blockers, partial cleanup, and degraded-entry counts require a
genuine authenticated protection state. This run neither requested credentials
nor manufactured production-reachable entries. Therefore these rendered
behaviors remain `UNVERIFIED`:

- blocker-specific recovery after a real decrypt/revision/storage failure;
- biometric/cloud partial success after a real local commit;
- unavailable count for a real incompatible encrypted row;
- all-locale zoom/font-scale reflow and native screen-reader output;
- physical Android Back and native lifecycle behavior.

Local DOM tests cover focus trap/restore, topmost Escape/Back ownership, one
status owner, 48 px targets, and RTL-safe copy. That is technical source/test
evidence, not browser/device or qualified-human acceptance.

## Visual and motion status

Wave 1 does not enable or modify Journal Save Ceremony presentation. The
disabled animation remains outside this PR's release decision. Enabled motion,
veil composition, saved-card placement, Artistic/Craft, and user approval
remain `UNVERIFIED`; no technical build or smoke is treated as artistic proof.
