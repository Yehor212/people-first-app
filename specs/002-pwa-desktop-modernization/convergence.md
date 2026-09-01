# Convergence: Installed PWA Modernization for macOS and Windows

**Date**: 2026-08-04
**Branch**: `codex/pwa-desktop-modernization`
**Base commit**: `13ca51a80d23220574deba762851fe5a32372e46`
**Authority used**: local reversible source/test/docs/artifact changes only
**Authority not used**: commit, push, deploy, signing, Store submission, production/private-data access or migration

## Decision

- **Authorized local implementation**: `PASS`.
- **Candidate-caused P0/P1 findings**: none in the executed scope.
- **Merge/release**: `STOP`.
- **Why release is stopped**: inherited ratchet and dependency findings remain open; Snyk is partial; real installed Windows/macOS/mobile, public deployment, native release roots, human accessibility/native-speaker acceptance and independent Role 10 isolation are not verified.

This is not a public-runtime or release-complete claim. It is a source/build/runtime convergence result for the isolated candidate.

## Implemented Product Decisions

1. Capture Chromium's one-shot `beforeinstallprompt` at page startup, before lazy Settings mounts; keep it memory-only and clear it after acceptance, dismissal or error.
2. Recognize standards display mode and Safari standalone mode before offering installation. Safari on macOS receives a manual Add to Dock path only when applicable.
3. Warn Safari users that the installed app has separate saved information, can require sign-in again, and must be verified before Safari data is removed. Do not promise automatic transfer or a complete backup.
4. Remove manifest `orientation` and shortcut `navLayout=phone`; retain `nav=v2`, scope and route ownership so layout follows the actual window.
5. Add a generator-owned opaque 1024px maskable leaf icon and align shortcut MIME metadata across generator, Vite, public, docs and build output.
6. Fail post-build validation when public/docs/dist manifest semantics diverge.
7. Localize the offline document for all eight locales, including title and `ar`/`he` direction, safely handle malformed storage and use bounded degraded copy.
8. Resolve navigation offline in order: network, precached app shell, precached offline document, explicit error.
9. Remove unused origin-wide cache/lifecycle message capabilities, namespace active literal runtime caches with `zenflow-`, and describe Background Sync as an open-client wake hint only.
10. Prune desktop/browser PWA metadata and icons from Android/iOS production web output while retaining the native-required 192px icon.

## Evidence Ledger

Receipts are ignored, sanitized local artifacts under `output/pwa-desktop-modernization/`; none contains production user records.

| Evidence | Fresh result | SHA-256 |
|---|---|---|
| Clean-base characterization | 4 intended failures, 0 passes | `b3c01bed4485419013a29e91b7d04353bd62c3e8c0f6f0d14ba24a2053bfe24a` |
| Focused Vitest | 14 files, 384/384 tests passed | `8023427a1a7f390b6f0b5c58c359e2d96ea1f59a0507053b4437982e933ff276` |
| Desktop PWA Playwright | 12 passed, 2 documented skips, 0 unexpected/flaky | `764942bd6a0d38d11512cca63e633c7bb5774bfb853bbc837a51b5e93220a5e2` |
| Chrome performance | 14 routes ready; 0 console/network failures, warnings or measured long tasks | `15661581fe3566b0a3157606dc981a450d487baa51953db489745233bd0350c7` |
| Rollback drill | 4 batches applied, narrowly verified, reversed to clean worktree | `bf9d91c63bf30a481bb2fbd1653fa943fc49f00836aeda3f9d46b88e4e80b976` |
| Built manifest | 17 icons; semantic parity with public/docs | `f19ab7b29dca890c04d9b00ddc632e97a4c782493ffab4eca360c3b0e2e8d926` |
| Built service worker | 56-entry, 2771.58 KiB precache build | `60abe7be1b0c433e5606c1f3b86e0ad8a7d1f5a80f43148392463a07443aec58` |
| Canonical 1024 maskable icon | public/docs bytes identical | `bf2359d4db9c44bed48067569312f84e286de9fe0197fdb41436de7393903f05` |

The JSON reporter receipts above are canonical redacted copies with mode `0600`;
absolute local account/worktree paths were replaced before hashing. The final
ignored JSONL ledger binds them to the complete candidate state hash after
tracked convergence files are finalized. A partial raw Snyk receipt was excluded
from the canonical packet after Gitleaks detected two secret-like source
snippets; only the bounded scanner status below is retained.

## Verification Results

| Check | Result | Evidence or limitation |
|---|---|---|
| RED on clean base | `PASS` | Portrait lock, stale shortcut layout, missing early prompt capture and generic caches all failed as intended. |
| TypeScript | `PASS` | App and Node projects both completed with exit 0. |
| Focused tests | `PASS` | 384/384. |
| Full test/coverage stage | `PASS` | 717 files; 9094 passed and 7 existing todo; 61.77% statements / 63.77% lines. |
| `check:all` | `PASS` | Type, ESLint, 8-locale checks, colors and visual guards. |
| i18n | `PASS` | 8 × 3580 keys; deep and translation-quality checks clean. Native-speaker acceptance is `UNVERIFIED`. |
| Browser PWA runtime | `PASS` | Chromium and WebKit selected projects: 12 passed, 2 explicit engine-path skips. |
| Production build/parity | `PASS` | Vite 3220 modules; post-build manifest parity validator and duplicate check passed. |
| PDI diff/bundle | `PASS` | 0 errors, 0 warnings, 2335 scanned, 784 reachable. |
| Performance | `PASS` | 14 local production routes; every ready signal true; no console/network errors or budget warnings. Device fleet is `UNVERIFIED`. |
| Canonical orb/logo/visual guards | `PASS` technical | Canonical orb, 120-image logo inventory and proof generation passed. Real OS rendering and artistic acceptance are `UNVERIFIED`. |
| Desktop/Tauri contract | `PASS` source | 115 checks. Built/signed executable is `UNVERIFIED`. |
| Sync contract | `PASS` | 409 invariants. No sync/data-model behavior changed. |
| Android/iOS build boundary | `PASS` build | Both production targets pruned PWA-only assets and retained `pwa-192.png`. Synced native release roots/devices are `UNVERIFIED`. |
| Security suite | `UNVERIFIED` partial | Gitleaks, TruffleHog, Trivy, Checkov and KICS exit 0; Snyk Code has inherited findings/403; Terrascan input errors. |
| `npm audit` | `FAIL` inherited | Full graph: 2 HIGH + 1 MODERATE; production graph: 1 HIGH. Dependency manifests unchanged. |
| Constitution freshness | `FAIL` inherited | Clean base 941/935 sources and 601/592 tests; candidate 942/935 and 601/592. |
| `ci:preflight` | `FAIL` inherited final ratchet | All preceding stages passed; final `inlineStyles=358` exceeds max 323. Clean base independently reports the same 358 count. |
| No-AI-template/best-practices/agent context | `PASS` structural | Runtime/human agent semantics remain `UNVERIFIED` as the tools themselves state. |

## Platform and Domain Matrix

| Platform/domain scenario | Status | Bound |
|---|---|---|
| Web/Vite source, build, install/offline Settings and responsive runtime | `PASS` | Local production build and browsers only. |
| macOS WebKit engine behavior and Safari-specific guidance | `PASS` | Playwright WebKit, not a real Add to Dock installation. |
| Real macOS Safari Add to Dock, separate-container verification and OS icon | `UNVERIFIED` | No safe real-install automation/human session was available. |
| Windows Chromium engine routes, shortcuts and desktop resize | `PASS` | Local Chromium engine, not Windows shell integration. |
| Real Windows Edge install, Start/taskbar, update/offline and enterprise policy | `UNVERIFIED` | No Windows runner/device. |
| Mobile browser portrait/landscape responsive boundary | `PASS` | Production-equivalent Chromium/WebKit viewport changes. |
| Real installed mobile browser safe-area/orientation launch | `UNVERIFIED` | No installed mobile browser run. |
| Android/Capacitor PWA-pruning and edge contract | `PASS` | Source/test/build boundary. |
| Android synchronized release assets and device behavior | `UNVERIFIED` | `android/app/src/main/assets/public` was absent. |
| iOS/WKWebView PWA-pruning and shared Safari classification | `PASS` | Source/test/build boundary. |
| iOS synchronized release assets and device behavior | `UNVERIFIED` | `ios/App/App/public` was absent. |
| Desktop/Tauri source/updater/executable contract | `PASS` | 115 static/tooling checks. |
| Built, signed and installed Tauri packages | `UNVERIFIED` | No packaging/signing authorization. |
| Store/release/public deployment | `UNVERIFIED` | No deployment, signing, submission or public cache-busted verification authorized. |
| Automated accessibility: focus, 44px, reflow, RTL, reduced motion, forced colors | `PASS` | Available automated engines only. |
| Assistive-technology user and native-speaker acceptance | `UNVERIFIED` | Requires recruited human evidence. |
| Performance | `PASS` | Local headless Chrome, 14 routes. |
| Security/privacy-wide release claim | `UNVERIFIED` | Partial scanner availability and inherited dependencies block a broad pass. |
| Operations rollback | `PASS` local | Four source batches; no cache/user-data deletion. Public rollback drill remains `UNVERIFIED`. |

## Ten-Role Routing Ledger

| Role | Disposition | Evidence/result |
|---|---|---|
| 1 Coordinator | `SELECTED` | Root integration, authority, conflict, evidence and release ledger. |
| 2 Human factors | `EXCLUDED` | No new pressure, shame, clinical, crisis or motivation mechanic; Safari risk copy is factual data-boundary guidance. Human comprehension remains `UNVERIFIED`. |
| 3 Logic/state | `EXCLUDED` | Bounded one-shot state has direct unit/runtime characterization; no formal product-state or causal claim required a separate role. |
| 4 Accessibility/i18n | `SELECTED` | Specialist invocation failed; inline automated checks completed. Independent and human AT/native-speaker acceptance remain `UNVERIFIED`. |
| 5 Architecture/data | `EXCLUDED` | No store, schema, migration, auth or sync semantic change; native/build boundaries are directly characterized and sync contract is green. |
| 6 Security/privacy | `SELECTED` | Specialist invocation produced no retained closure before runtime usage ended; local scanners and source review are recorded as partial. |
| 7 Reliability/operations | `SELECTED` | Review findings on closed-browser sync overclaim, cache ownership, update generations and rollback were incorporated or retained as `UNVERIFIED`. |
| 8 QA/evidence | `SELECTED` | Review found stale receipt and manifest MIME parity risks; both were corrected with persistent validators and fresh receipts. Final independent re-review is pending availability. |
| 9 Product/craft | `EXCLUDED` | No navigation, brand, visual-system or product-capability redesign; generated icon preserves the frozen canonical source. Artistic acceptance remains separate. |
| 10 Sentinel | `SELECTED` | Review exposed mobile manifest coupling, Safari transfer overclaim, legacy-cache ownership and worker-generation gaps. Pass A isolation was unavailable; hash-bound independent closure remains `UNVERIFIED`. |

Unavailable specialist output is not treated as proof. Every incorporated finding has direct source/test/runtime evidence owned by the coordinator.

## Rollback Drill

The drill used a detached temporary worktree at the exact base commit and the exact candidate patches. Each batch was applied, narrowly tested, reversed with the same binary patch, and left a clean worktree:

| Batch | Narrow proof | Reverse result |
|---|---:|---|
| Install, manifest, icon and copy | 189/189 | `PASS`, clean |
| Offline document and service worker | 46/46 | `PASS`, clean |
| Capacitor PWA pruning | 2/2 | `PASS`, clean |
| Built-manifest parity validator | 36/36 | `PASS`, clean |

Rollback never clears caches, IndexedDB, local storage or user records. It reverts the relevant source/generator batch, regenerates owned artifacts when required and reruns its narrow proof.

## Release Gates and Kill Criteria

A future rollout remains `local → internal/canary → limited public → broad public`. Before any next stage, a human owner must supply the deployed commit/artifact identity, Windows and macOS installed-app smoke, monitoring window, exit/kill thresholds and a deployment rollback command. Kill or roll back on any new data-loss/auth path, origin-wide cache deletion, update loop, broken offline core route, manifest identity change, P0/P1 accessibility regression, changed-code HIGH finding, or route ownership regression.

## Final Convergence Verdict

The requested PWA modernization is implemented and verified for the authorized local scope without mock production data. No remaining locally buildable PWA defect with direct evidence is being hidden. Release remains `STOP` because unavailable real environments and inherited repository/security gates cannot honestly be converted into `PASS` by local source automation.
