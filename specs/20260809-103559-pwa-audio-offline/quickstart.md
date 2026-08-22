# Pre-implementation verification quickstart

This is a verification runbook for the planned change. It must be run only after the corresponding test-first task has created focused evidence; commands below do not constitute implementation proof today.

## Baseline before production edits

```sh
npm run test -- --maxWorkers=1 src/lib/__tests__/pwaAudioOffline.test.ts src/hooks/__tests__/useUserStartedAmbienceAudio.test.tsx src/lib/__tests__/audioLifecycle.test.ts scripts/__tests__/audio-blind-spots-contract.test.ts
npm run check:app-audio
npm run check:production-data-integrity:diff
```

Expected baseline: the new selected-cache contract tests are RED for missing behavior; existing tests may be green only as characterization of current semantics. Record exact output and target commit in `evidence/preimplementation-analysis.md` before production edits.

## Focused implementation proof

```sh
npm run test -- --maxWorkers=1 src/lib/__tests__/pwaAudioOffline.test.ts src/sw.pwaAudioOffline.test.ts src/hooks/__tests__/useUserStartedAmbienceAudio.test.tsx src/lib/__tests__/audioLifecycle.test.ts src/lib/__tests__/audioMediaSession.test.ts src/lib/__tests__/durableAudioCues.test.ts
npm run check:app-audio
npm run i18n:check
npm run i18n:deep
npm run check:translation-quality
npm run check:production-data-integrity:diff
```

Required assertions: zero cold-launch long-audio requests; exactly selected manifest item; integrity/quota/cancel/delete negative controls; no autoplay after all interruption paths; explicit Resume and localized metadata; cue absence for every rejected write path.

## Browser/PWA proof

Use a production-equivalent local build in an installed Chrome/Edge PWA. DevTools application storage/network must show: no request for long audio during cold launch; one selected same-origin request; expected revisioned cache entry after digest success; failed digest and quota show unavailable; cached full body handles an offline Range request or the UI reports unavailable. Test one narrow and one desktop viewport plus keyboard and RTL (`ar`, `he`) labels. Safari/iOS Home Screen, Android, Tauri, public deployment, and real listening review require their exact target receipts and remain UNVERIFIED without them.

## Blast radius and rollback

```sh
npm run check:all
npm run check:canonical-orbs
npm run check:production-data-integrity
npm run ci:preflight
git diff --check
git diff -- specs/20260809-103559-pwa-audio-offline src/sw.ts src/main.tsx src/lib src/hooks src/i18n
git status --short
```

If the selected-cache route regresses, revert its client/worker/translation/tests together and delete only the feature’s exact revisioned audio cache keys. Do not revive `WARM_RUNTIME_AUDIO_CACHE` or delete unrelated caches.
