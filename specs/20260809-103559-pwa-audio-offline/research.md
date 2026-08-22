# Research and decisions

## R1 — Replace warming, not on-demand playback

**Decision**: remove `WARM_RUNTIME_AUDIO_CACHE`, `APP_AUDIO_SW_CACHE_PATHS`, and post-startup warming. Add a manifest-mediated request that names one selected item, and do not alter existing `<audio preload="none">` user-started playback.

**Evidence**: `src/sw.ts` currently contains the warming message/type, explicit library path list, batching, and cache put flow; `src/main.tsx` initializes audio but states ambience loads on demand; current controls in `AuthScreen.tsx`, `OrbAmbienceControl.tsx`, and `JournalAmbienceSetting.tsx` use `preload="none"`.

**Why it fits**: it solves the actual cold-launch/quota failure without adding autoplay, a background task, or an asset. It implements Feature 2 of `docs/superpowers/plans/2026-08-09-pwa-quality.md`.

**Rejected**: retain warming only on Wi-Fi; it still downloads unselected personal choices and lacks explicit quota/integrity ownership. Precache all sounds; it increases install cost and violates the feature plan.

**Verification**: a static request-spy test plus service-worker contract test must demonstrate zero cold-launch long requests and one selected URL only.

## R2 — Hash verification belongs before cache admission

**Decision**: create a compile-time manifest from the existing `APP_AUDIO_ASSETS` and feedback inventory containing public path, revision, expected bytes, SHA-256, and locale label key. Download reads a streamed/full response, confirms same origin/status/bytes/digest/revision, then sends a verified complete response to the worker cache namespace.

**Evidence**: `src/sw.ts` accepts `200` responses and `RangeRequestsPlugin`, but no source currently checks a digest/length/revision. `src/lib/appAudioAssets.ts` is the central public-path inventory and has no user data.

**Why it fits**: a full verified object lets Workbox produce a Range response without treating `206` bytes as a complete asset. It limits the trust boundary to tracked local files.

**Rejected**: trust HTTP cache headers alone; they cannot prove the selected bytes match the app’s manifest. Cache `206` responses; existing test already rejects `statuses: [200, 206]`.

**Verification**: tests inject wrong origin/status/size/hash/revision and assert cache miss/unavailable; known good tracked bytes pass.

## R3 — Quota policy must be reversible and targeted

**Decision**: before an explicit long-track download, query `navigator.storage.estimate()`. Define `required = selectedByteSize + max(10 MiB, 15% of quota)` only as a plan-level conservative guard. On unknown estimate, let the explicit request proceed only if the browser permits it; report `QuotaExceededError` honestly. Deletion may remove the selected track’s revisioned cache key only.

**Evidence**: `src/storage/persistentStorage.ts` already handles unsupported/rejected persistence APIs as best-effort; `src/sw.ts` has broad `purgeOnQuotaError: true`, unsuitable as UI-facing targeted eviction.

**Trade-off**: the headroom guard can reject a technically possible download, but avoids filling constrained installed PWAs. It is not a claim that browser quota is deterministic.

**Verification**: controlled estimates and quota errors prove start-block, no false availability, and selected-key-only deletion.

## R4 — Explicit Resume means a named control, not any gesture

**Decision**: preserve pause on hidden/pagehide/pause and change deferred post-resume recovery from “next gesture may resume” to “the originating control renders Resume; its activation may play.” Media Session play must invoke the same explicit resume callback, not invoke generic automatic restoration.

**Evidence**: `src/hooks/useUserStartedAmbienceAudio.ts` calls `stop()` on visibility/pagehide/native pause. `src/lib/audioLifecycle.ts` currently registers pointer/touch/key events and can call `resumeDirect()` after a generic gesture. The project PWA plan explicitly requires an explicit visible Resume control.

**Trade-off**: this adds one deliberate action after interruption, but avoids surprise sound and makes screen-reader/keyboard intent unambiguous.

**Verification**: lifecycle tests assert zero `play()` on visible/resume or unrelated gesture, and one `play()` only from labelled Resume activation.

## R5 — Localized Media Session uses existing translations

**Decision**: supply current `LanguageContext` text/label keys to `setAppAudioMediaSession`; remove English fallback only where a required key is available, retain a safe current string where existing catalogue lacks a key, and add eight-locale parity tests before claiming translation quality.

**Evidence**: `audioMediaSession.ts` currently defaults artist to `ZenFlow`; ambience callers already pass translated-or-fallback titles. `AGENTS.md` requires en/uk/es/de/fr/ja/ar/he and treats ar/he as RTL risk.

**Trade-off**: Media Session does not prove OS rendering or locale refresh behavior. It prevents stale English from being treated as a localized result.

**Verification**: translation parity/static tests and supported-browser Media Session mock tests; OS/device rendering remains UNVERIFIED.

## R6 — Durable cue boundary stays at persistence owners

**Decision**: audit each `APP_AUDIO_ACTION_EVENTS` call site and move/retain it after the owning local transaction resolves and its UI commits durable success. Do not centralize save details in audio code.

**Evidence**: `src/features/journal/useJournalEditorState.ts` calls `saveEntry`, then sets `saveCommittedRef`, `setSaveState("saved")`, and only afterward invokes `playSuccess()`. `APP_AUDIO_ACTION_EVENTS` documents allowed completion/milestone triggers and non-audio feedback.

**Trade-off**: multiple owners require focused tests; a generic “save succeeded” event risks cues after partial/failed writes.

**Verification**: reject/resolve tests for each mapped owner, plus a source inventory test that fails if a new allowed cue is placed before its persistence boundary.

## External applicability sources

- [WCAG 2.2 Audio Control](https://www.w3.org/WAI/WCAG22/Understanding/audio-control.html): sustained audio must be controllable; applies to ambience, not a success cue alone.
- [MDN autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay): audible media depends on activation; supports explicit start/resume.
- [MDN StorageManager estimate](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate): estimates are approximate; supports honest quota states rather than an assured capacity claim.
- [MDN Media Session API](https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API): metadata/actions are optional browser capabilities; supports guarded integration, not cross-device proof.
