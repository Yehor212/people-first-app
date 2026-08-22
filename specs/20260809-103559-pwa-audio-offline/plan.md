# Implementation plan — PWA audio offline

## Technical context

ZenFlow is React 18/TypeScript/Vite with Workbox in `src/sw.ts`, native wrappers via Capacitor 8/Tauri, and local user truth in Dexie/IndexedDB. Audio asset inventory is `src/lib/appAudioAssets.ts`; user-started ambience state is `src/hooks/useUserStartedAmbienceAudio.ts`; lifecycle coordination is `src/lib/audioLifecycle.ts`; Media Session is `src/lib/audioMediaSession.ts`. This plan changes no user-data schema and adds no dependency, asset, native folder, production write, public deploy, commit, push, PR, or merge.

## Architecture

1. Add a pure `src/lib/pwaAudioOffline.ts` coordinator that exposes the exact `PwaAudioOfflineState`, validates PWA capability, network policy, explicit-action-only `StorageManager.estimate()/persist()`, exact manifest selection, download state, and targeted removal. It has no URL input and no personal data access.
2. Add `src/lib/pwaAudioOfflineManifest.ts`, generated/checked from existing tracked audio inventory, to export exact `PwaAudioCacheEntry { path, sha256, bytes, revision, group }` values plus separate trusted label/ID metadata. The generation/check script must fail if an entry is missing, stale, duplicated, or untracked.
3. Replace worker warming with typed selected-download messages. The service worker performs same-origin full-body integrity verification, exact revisioned cache writes, progress/cancel notifications, and Range use only after verified admission.
4. Extend the shared ambience hook with an `interrupted` state and explicit `resume()` handler. It pauses on all existing lifecycle events; visible/native-resume only makes the Resume control available.
5. Pass current i18n labels to Media Session and map Media Session play to that same explicit resume handler.
6. Audit every allowed action cue call site. Each call remains with its persistence owner and gets a focused negative test for rejected/conflicted save.
7. Correct unlock bookkeeping so only successful media playback or an actually running audio context may set `audioUnlocked=true`.
8. Run deterministic audio technical analysis and retain the separate human-owned `AUDIO_FIT` ledger without promoting it from automated results.

## Planned write set

| Path | Change |
|---|---|
| `src/lib/pwaAudioOffline.ts` | New pure PWA coordinator and policy/integrity types. |
| `src/lib/pwaAudioOfflineManifest.ts` | New generated-from-tracked-inventory manifest surface. |
| `scripts/generate-pwa-audio-manifest.cjs` | Deterministic digest/size/revision generator/checker for existing files only. |
| `src/sw.ts` | Remove warming and add selected-cache worker contract/verified Range route. |
| `src/main.tsx` | Remove startup audio warming sender; retain no-autoplay lifecycle. |
| `src/hooks/useUserStartedAmbienceAudio.ts` | Explicit interrupted/Resume state, localized Media Session callback path. |
| `src/lib/audioLifecycle.ts` | Prevent generic gesture restoration for element ambience; re-arm only. |
| `src/lib/audioMediaSession.ts` | Localized media-session configuration and explicit resume action binding. |
| `src/lib/ambientSounds.ts` | Evidence-based `audioUnlocked` transition; rejected playback/context remains locked. |
| Existing ambience surfaces and locale files | Render accessible localized offline/progress/error/remove/Resume state through existing controls. |
| Existing persistence owners/tests | Prove durable cue order without new business data. |

## Test-first order

1. Add RED pure coordinator/service-worker tests for zero warming, selection, manifest mismatch, quota, cancellation, delete, and Range miss.
2. Add RED hook/lifecycle/Media Session/unlock tests for interruption, explicit Resume, rejected `play()`, and non-running `AudioContext`.
3. Add RED persistence-owner cue tests for all allowed completion/milestone call sites.
4. Capture generated-manifest baseline/checker failure for altered bytes or stale revision, then capture decode/duration/channels/sample-rate/clipping/true-peak/loop-seam/ramp/duplicate analysis without treating it as human approval.
5. Implement smallest layers in the same order; rerun the exact tests GREEN before broad checks.

## Platform/domain matrix

| Domain | Plan and acceptance | Proof required |
|---|---|---|
| Web/Vite | Online audio continues; no PWA selected-cache UI where capability absent. | Unit/component/browser fallback check |
| Installed PWA | Explicit selected cache, integrity/quota status, resume, Range fallback. | Worker/unit + installed browser evidence |
| Android/Capacitor | Capability boundary prevents PWA route; no channel or native asset change. | Owner compatibility receipt |
| iOS/WKWebView | Resume stays explicit, no user-gesture bypass. | Device/WebView receipt |
| Desktop/Tauri | No PWA cache route; `dist` asset behavior unchanged. | Package receipt |
| Accessibility | Semantically labelled state, visible fallback, existing 44px controls, keyboard resume. | Testing Library + browser audit |
| i18n/RTL | Eight-locale key parity; ar/he labels not fragment-concatenated. | i18n/deep/translation checks + rendered audit |
| Performance | No cold long-audio requests; no startup warm task; bounded one-item download. | Network/test assertion and performance trace |
| Security/privacy | Manifest-only same-origin static bytes; no private metadata/logs. | Negative tests, PDI/security review |
| Operations/release | Local rollout only; exact cache-key rollback and no publication. | Diff/status/handoff review |

## Failure/recovery behavior

- Unsupported browser, offline cache miss, bad manifest, integrity mismatch, quota, cancellation, and worker loss each resolve to an explicit unavailable/retry/remove state.
- A failed selected download leaves verified prior selected bytes untouched unless its exact revision is stale; stale bytes are deleted and shown unavailable.
- No retry runs automatically after Save-Data, slow network, quota, error, or resume. Retry requires explicit user activation.
- No lifecycle event is allowed to resume a media element. Resume is reset by stop/error/delete/unmount.

## Rollout and rollback

Feature flagging is not introduced. Rollout is a normal reviewable release after all local/browser/native-owner gates. Kill criterion: any cache integrity bypass, unselected download, automatic audible resume, false durable success cue, or cross-platform regression stops release. Roll back in dependency order: UI/coordinator and translations, Media Session/lifecycle binding, worker selected-cache route/manifest, then delete only its exact revisioned cache namespace. Do not restore warming as rollback.

## Constitution and governance

`.specify/scripts/bash/check-zenflow-constitution-status.sh --json` returned `PROPOSAL_CRITERIA_ONLY` on 2026-08-09. Its guidance informed review but created no blocking criterion. Binding requirements come from `AGENTS.md`, the PWA-quality plan, audio policy, test-first policy, and production-data policy.
