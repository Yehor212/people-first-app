# Validation Quickstart: PWA Shell Lifecycle

## Preconditions

1. Use the locked `codex/` worktree and confirm only the intended PWA-shell paths changed.
2. Create the fresh test-first evidence token before production edits; capture the RED test output rather than copying expected output into this file.
3. Do not use a personal account, private journal, habit, mood, or production backend data. Tests must use isolated browser/storage state only.

## Focused RED then GREEN path

```bash
npm test -- --maxWorkers=1 src/hooks/__tests__/usePwaInstall.test.ts
npm test -- --maxWorkers=1 src/lib/__tests__/pwaShellRuntime.test.ts src/lib/__tests__/pwaInstallOwner.test.ts src/lib/__tests__/pwaUpdateLifecycle.test.ts src/lib/__tests__/serviceWorkerMessages.test.ts
npm test -- --maxWorkers=1 scripts/__tests__/public-webmanifest-contract.test.ts scripts/__tests__/offline-page-i18n.test.ts
```

Before implementation, new assertions must fail for the named contract reason: late event retained by the app owner, no automatic worker activation, barrier blocks reload, owned-cache predicate preserves unrelated cache, two orientations/metadata present, and diagnostic route has no query/hash. After implementation, run exactly these commands again and retain the actual results/counts in `evidence/preimplementation-analysis.md` or the implementation receipt.

## Browser/runtime path after implementation

1. Build the PWA and serve its production-equivalent preview using the repository PWA offline helper.
2. In a clean Chrome or Edge profile, open the app, dispatch/observe install eligibility before Settings, then open Settings and complete each accepted/dismissed/error/unavailable state using browser-provided behavior or an isolated test harness.
3. With a waiting worker, verify the visible update state, a resolving writer, rejecting writer, timed-out writer, duplicate click, and stale-chunk path. Confirm controller change and at most one reload only for the resolving case.
4. Create a non-ZenFlow same-origin cache in the isolated test profile; invoke recovery and prove it survives. Do not inspect or clear unrelated real-browser caches.
5. Disconnect network after a cached shell is present; inspect offline page language, `dir` for Arabic/Hebrew, keyboard focus, retry control, console errors, and failed requests. Do not claim sync completed while closed/offline.
6. Run Safari macOS/iOS Home Screen manual-install and lifecycle checks separately. No Chromium result substitutes for Safari.

## Required gates after implementation

```bash
npm run typecheck
npm run lint
npm run i18n:check
npm run i18n:deep
npm run check:translation-quality
npm run check:production-data-integrity:diff
npm run check:production-data-integrity
npm run build
npm run check:production-data-integrity:bundle
npm run check:all
npm run smoke:chrome-performance
```

Run `npm run check:no-ai-templates` because user-visible copy/docs are modified, `npm run assets:logos:check` and `npm run assets:logos:proof` if icon assets/manifest generator behavior changes, and the narrowest available `codex-security-suite.sh` profile plus Snyk scan for modified first-party TypeScript. A build/test cannot establish native, public deploy, artistic/craft, user acceptance, or store proof.

## Handoff receipt minimum

Record exact commands, exit status, test count, normalized request hash, artifact hash manifest, source baseline hashes, route/viewport/browser version, controller/update state, console/network results, cache negative control result, platform results, rollback rehearsal, and all missing proof as `UNVERIFIED`.
