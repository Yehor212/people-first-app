# Implementation Plan: Installed PWA Modernization for macOS and Windows

**Branch**: `codex/pwa-desktop-modernization` | **Date**: 2026-08-04 | **Spec**: [spec.md](./spec.md)

## Summary

Modernize ZenFlow's browser-installed desktop PWA without replacing it with Tauri or altering product data architecture. The implementation will correct desktop manifest behavior, capture one-shot install capability before lazy UI mounts, provide Safari-aware data-boundary guidance, add an honest localized offline fallback, remove both dead and live origin-wide cache deletion, make automatic update recovery visible and Tauri-safe, namespace new runtime caches, add the canonical high-resolution macOS icon, prune desktop-only PWA assets from Capacitor output, and bind all claims to fresh tests/build/runtime evidence.

## Technical Context

**Language/Version**: TypeScript 5.8, React 18, Node.js scripts, static HTML, service worker TypeScript
**Primary Dependencies**: Vite 6, `vite-plugin-pwa`, Workbox 7, Zustand, Dexie, Capacitor 8, Tailwind, custom i18n
**Storage**: Existing IndexedDB local truth and web localStorage/sessionStorage; no schema or migration change
**Testing**: Vitest, Testing Library, Playwright, production Vite build, repository contract/scanner scripts
**Target Platform**: Web/Vite; installed Safari PWA on macOS; installed Chromium/Edge PWA on Windows; mobile browser-installed PWA, Android/Capacitor, iOS/WKWebView, and Tauri regression boundaries
**Project Type**: Cross-platform web/PWA application with native wrappers
**Performance Goals**: Preserve repository startup/bundle budgets; keep install precache bounded; avoid duplicate runtime-audio warm requests; no new startup network request
**Constraints**: GitHub Pages base `/people-first-app/`; no production data; no auth/storage migration; no deploy/push/Store action; all user-facing strings in eight locales; RTL/reduced-motion/44px/focus contracts
**Scale/Scope**: Manifest generator/config/public artifacts, one install hook and Settings surface, offline document/service-worker fallback, focused tests/evidence/docs

## Constitution Check

Fresh result:

```json
{"constitution_version":"1.0.1","status":"PROPOSED","activation":"PROPOSAL_CRITERIA_ONLY","binding":false,"blocking_authority":false}
```

The proposed constitution is advisory. Blocking gates come from active `AGENTS.md`, Spec Kit policy, test-first policy, production-data integrity, translation quality, logo integrity, cross-platform release, and PWA runtime contracts.

Pre-design gate:

- Isolated `codex/` worktree and edit doctor: `GO`.
- Free RAG preflight bound to task hash `5cf6f61007120530c792af5f8b127c727a589813725d7978111085e6db3f1a68`: complete.
- Protected-surface `AGENT_CHANGE_NOTICE`: chronological user-visible receipt/locator was not retained, so pre-edit emission is `UNVERIFIED`; this governance evidence gap is not rewritten as a retrospective pass.
- Production/public/Store writes: explicitly excluded.
- Real Windows and public installed runtime: `UNVERIFIED`, not a local blocker for source implementation.

Post-design re-check: no data schema, auth, sync semantics, route ownership, or native-shell redesign is introduced. Logo output remains generator-owned and shape-frozen. The plan is compatible with active gates.

## Project Structure

### Documentation and Evidence

```text
specs/002-pwa-desktop-modernization/
├── spec.md
├── research.md
├── data-model.md
├── plan.md
├── quickstart.md
├── analysis.md
├── convergence.md
├── contracts/
│   └── pwa-evidence.schema.json
└── checklists/
    └── requirements.md

output/pwa-desktop-modernization/     # ignored sanitized receipts
```

### Source and Tests

```text
vite.config.ts
scripts/generate-icons.cjs
scripts/check-brand-logo-assets.cjs
config/brand-logo-assets.json
public/manifest.webmanifest
docs/manifest.webmanifest
public/offline.html
docs/offline.html
src/sw.ts
src/main.tsx
src/hooks/usePwaInstall.ts
src/lib/pwaInstallPrompt.ts
src/lib/offlineQueue.ts
src/pages/nav-v2/settings/V2SettingsAboutPanel.tsx
src/i18n/languages/{en,uk,es,de,fr,ja,ar,he}.ts
src/hooks/__tests__/usePwaInstall.test.ts
scripts/__tests__/public-webmanifest-contract.test.ts
scripts/capacitor-prune-assets.cjs
e2e/pwa-desktop-lifecycle.spec.ts
```

**Structure Decision**: Extend the existing PWA config, canonical asset generator, service worker, Settings install surface, and test layers. Do not introduce a second PWA framework, new runtime provider, production store, or native desktop wrapper.

## Implementation Phases

### Phase 0 — Characterization and RED

1. Add manifest contract failures for orientation, adaptive shortcuts, and 1024px maskable icon.
2. Add hook failures for Safari standalone/manual capability and one-shot prompt dismissal/error.
3. Add production-equivalent offline document and service-worker fallback scenarios, including JSON locale storage and RTL.
4. Record exact failing assertions and confirm they fail for the intended current behavior, not environment setup.

### Phase 1 — Install and Manifest Contract

1. Start a memory-only, browser-only page-lifetime install-event capture before lazy Settings code and expose it through the existing hook; exclude both Capacitor and Tauri runtimes.
2. Consume deferred prompt events exactly once, validate event shape, and reserve installed-success state for `appinstalled` or standalone detection.
3. Render accessible macOS Safari safe-install guidance in Settings with eight-locale copy that covers File and Share Add-to-Dock paths, requires re-auth/data verification, and explains that manual import precedes account connection.
4. Remove manifest orientation and the stale development-only shortcut layout parameter from config and generator output; align shortcut icon MIME metadata.
5. Generate the canonical opaque 1024px maskable icon, update checks, and inspect the logo proof sheet.
6. Extend the existing Capacitor asset pruner so manifest, offline document, 1024px maskable, and desktop Windows PWA assets do not enter Android/iOS bundles.

Rollback: revert the phase batch, rerun canonical icon generation if generator output changed, and rerun the same manifest/hook tests. No user storage is mutated.

### Phase 2 — Offline and Service-Worker Recovery

1. Make offline locale parsing tolerate supported JSON-serialized and legacy plain strings, fail closed to English for invalid/non-string stored values, use browser locale only when storage is absent, constrain the locale set, localize document title, and reset direction deterministically.
2. Replace universal local/sync claims with capability-bounded degraded copy in all eight locales.
3. Use the precached offline document only if the app shell is unavailable.
4. Remove unused `CLEAR_CACHES`, `SKIP_WAITING`, and `REGISTER_SYNC` client-message contracts; retain trusted message validation for the used audio warm path.
5. Remove the live lazy-chunk origin purge and namespace every newly used literal runtime cache as `zenflow-*` without deleting ambiguous legacy origin-wide caches.
6. Correct Background Sync comments/contracts to the observed open-client wake behavior; preserve foreground lifecycle retries.
7. Deduplicate the shipped audio warm path list without changing cache contents or order of first occurrence.
8. Route automatic version-check reload failures and loop-guard blocks into the existing visible retry UI, keep startup rendered when navigation does not occur, and exclude Tauri from browser updater ownership.

Rollback: revert the phase batch. Existing app-shell fallback remains the safety net; do not delete caches or user data during rollback.

### Phase 3 — Desktop Runtime and Accessibility Proof

1. Build the production PWA and serve it with the repository HTTPS/preview helper.
2. Run manifest, shortcut, offline route, update, and install-capability E2E scenarios across all four configured desktop/mobile Chromium/WebKit projects.
3. Exercise narrow/medium/wide desktop windows plus mobile browser portrait/landscape, keyboard focus, reduced motion, light/dark, 200% reflow pressure, Arabic/Hebrew direction, and forced colors where supported.
4. Inspect console, failed requests, service-worker registration/control, cache names, manifest result, and horizontal overflow.
5. Repeat the same lifecycle suite against the exact staged Pages artifact and verify its single cache-busted manifest link. Attempt real macOS Safari/Add to Dock evidence only if the local environment permits safe automation; otherwise retain `UNVERIFIED`. Real Windows remains `UNVERIFIED` without a Windows runner/device.

### Phase 4 — Broad Verification and Convergence

Run focused tests first, then applicable type/i18n/visual/PWA/build/security/data/governance gates. Run artifact-sensitive build/bundle checks sequentially. Validate the evidence contract, final diff, status, generated assets, secrets/PII absence, and platform matrix. Converge only if every local P0/P1 requirement is green and every unavailable external row is explicitly `UNVERIFIED`.

## Platform Matrix

| Surface | Expected impact | Proof path | Release status rule |
|---|---|---|---|
| Web/Vite | Shared manifest/install/offline Settings behavior | Vitest, build, Chromium browser | `PASS` only with fresh local runtime |
| Installed PWA | Primary change | Production SW/manifest E2E; real macOS attempt | Windows real runtime stays `UNVERIFIED` here |
| Mobile browser PWA | Shared orientation/resize boundary | Chromium/WebKit portrait-landscape reflow | Real installed launch/safe-area stays `UNVERIFIED` |
| Android/Capacitor | PWA remains disabled; shared hook/copy must not leak | Capacitor manifest/registerSW contract + build | `PASS` source/build; device `UNVERIFIED` |
| iOS/WKWebView | Shared Safari standalone detection only | Unit and Capacitor pruning contract | Real device `UNVERIFIED` |
| Desktop/Tauri | No updater/shell ownership change | Desktop contract/build checks | `PASS` only for checked source/build scope |
| Store/Release | Manifest/icon changes affect future packages | Integrity/logo checks and runbook review | Store acceptance `UNVERIFIED`; no submission |
| Accessibility | Install/offline UI and desktop reflow | Testing Library, Playwright, manual artifact inspection | Human AT acceptance `UNVERIFIED` |
| Performance | Extra icon asset, offline fallback, audio warm dedup | Build sizes, precache inventory, performance smoke | Device fleet `UNVERIFIED` |
| Security/Privacy | Cache scope and Safari state disclosure | Diff scan, security suite, no secrets/PII | New changed-code HIGH => `STOP` |
| Testing | New RED/GREEN and negative controls | Exact commands/receipts | Failure => `STOP` |
| Operations | Worker/cache rollback and deploy provenance | Local rollback drill + release doc | Public rollout `UNVERIFIED` until authorized |

## Verification Commands

Exact script names are rechecked against `package.json` before execution. Applicable set:

```bash
npx vitest run scripts/__tests__/public-webmanifest-contract.test.ts
npx vitest run src/hooks/__tests__/usePwaInstall.test.ts
npx playwright test e2e/pwa-desktop-lifecycle.spec.ts \
  --config=e2e/helpers/pwa-offline/playwright.config.ts \
  --project=pwa-desktop-chromium \
  --project=pwa-desktop-webkit
npm run assets:logos:check
npm run assets:logos:proof
npm run i18n:check
npm run i18n:deep
npm run check:translation-quality
npm run check:production-data-integrity:diff
npm run check:canonical-orbs
npm run check:all
npm run build
npm run check:production-data-integrity:bundle
npm run smoke:chrome-performance
npm run check:no-ai-templates
npm run check:best-practices
npm run check:agent-context
npm run check:agent-orchestra
npm run ci:preflight
```

Changed first-party TypeScript/JavaScript also receives Snyk Code or the documented local CLI fallback and `/Users/yehor/.codex/bin/codex-security-suite.sh --profile auto`. Dependency files are not expected to change; the existing `npm ci` audit finding remains baseline evidence and is not fixed by unscoped upgrades.

## Rollout and Rollback

Local implementation is the only authorized stage. Future rollout order is `local → internal/canary → limited public → broad public`. Each stage requires an owner, deployment SHA, monitoring window, manifest/worker cache probe, install/update/offline smoke, exit threshold, and practiced rollback. A public rollback deploys the prior known-good artifact without clearing user storage; if manifest identity/icon cache changes are involved, it restores the prior revision coherently across source, generated manifest, and HTML links. Legacy generic runtime caches are monitored as a bounded quota residual and are not deleted until exact shared-origin ownership is proven.

## Complexity Tracking

| Complexity | Why it is necessary | Simpler alternative rejected because |
|---|---|---|
| Generator + config + public/docs manifests change together | They are currently three producers/representations of one OS-facing contract | Editing only one leaves deployment drift and stale future regeneration |
| Eight-locale install/offline copy | These strings are reachable user-facing UI and static fallback content | English fallback alone violates declared locale and RTL contracts |
| Unit + build + E2E evidence | Browser events, generated manifest, and worker runtime are different boundaries | One static/source test cannot prove all three |

## Plan Verdict

`GO` for characterization and local implementation. `STOP` for push/deploy/Store/signing/auth migration. Completion cannot claim real Windows or public release readiness without those fresh environments.
