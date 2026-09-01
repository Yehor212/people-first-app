# PWA audio: selected offline availability and explicit resume

**Feature ID**: `20260809-103559-pwa-audio-offline`  
**Created**: 2026-08-09  
**Status**: Ready for scoped local implementation under the user's 2026-08-09 authorization; runtime/human/release proof remains gated.  
**Normalized request SHA-256**: `087a9ee980c3ac465d0d7800a8495fe6d6e0160f95224784ecab7024f611b828`

## Grounded problem

An installed ZenFlow PWA can request a broad audio library after startup: `src/sw.ts` holds `APP_AUDIO_SW_CACHE_PATHS` for feedback, three non-Hyperfocus ambience files, and every Hyperfocus variant, and responds to `WARM_RUNTIME_AUDIO_CACHE`. This makes an opt-in offline choice indistinguishable from background warming and consumes quota before a person selects a track. The service worker does have full-response cacheability, Range handling, expiry, and quota purging, but it does not bind cached bytes to an asset manifest hash, byte size, or revision.

The existing ambience controls are already user-started (`preload="none"`) and stop on `visibilitychange`/`pagehide` in `src/hooks/useUserStartedAmbienceAudio.ts`; `src/lib/audioLifecycle.ts` re-arms audio after resume rather than autoplaying. This feature preserves that agency boundary and makes offline selection/recovery explicit.

## Scope and non-goals

**Explicit requirements**: demand-load only an explicitly selected PWA audio track; verify same-origin hash/size/revision before admitting cache bytes; show quota/progress/cancel/delete states; stop on hidden, pagehide, lock, and pause; expose a visible Resume action after return; localize Media Session metadata; play durable success cues only after local persistence succeeds; add no dependency or audio asset.

**Evidence-backed implied requirements**: retain `RangeRequestsPlugin` only over a verified complete `200` response; never let a query flag override Save-Data or slow-network protection; preserve visible/haptic feedback when sound is unavailable; keep Web/PWA behavior behind a capability boundary so Android/Capacitor, iOS/WKWebView, and Tauri do not acquire a PWA cache workflow.

**Non-goals**: background caching of the complete library; autoplay on launch, wake, visibility restoration, or media-session action; cloud audio, telemetry containing track IDs/URLs, notification-channel changes, new audio files, audio recommendation, V2 XP cues, native wrapper changes, a public deployment, or a legal conclusion about `lamejs`.

## Clarified decisions (integrated)

The supplied decisions are final for this packet: selected-track download is opt-in; long audio makes zero cold-launch requests; a failed/cancelled/invalid download remains unavailable rather than presenting an optimistic offline state; resume is a visible control activated after the document becomes visible and never an arbitrary next gesture; Media Session strings come from the current locale at playback start; and a completion cue follows only the resolved local write that owns the saved state. No product question remains open.

## User scenarios and acceptance

### US1 — Select one track for offline use (P1)

As a person who deliberately uses a ZenFlow ambience surface offline, I can choose one listed local track to keep available, see progress, cancel it, or remove it, without other long tracks downloading.

**Independent test**: with an installed-PWA-capable fake service-worker channel and controlled Cache API, select one manifest item; assert exactly that URL is requested, hash/size/revision validate before cache admission, and cancel/delete leaves no matching entry.

1. **Given** no selected offline item, **when** I press the localized offline control for one eligible track, **then** the app first checks storage estimate and network policy, displays progress, and requests only that same-origin manifest URL.
2. **Given** a full response whose bytes match the selected manifest entry, **when** the download completes, **then** the cache contains its complete `200` response and the UI names it available offline.
3. **Given** the response hash, byte length, status, origin, or revision is wrong, **when** validation runs, **then** the bytes are deleted/rejected and the UI reports unavailable without a false offline claim.
4. **Given** download is running or completed, **when** I press Cancel or Remove, **then** the current request is aborted or the selected cache entry is deleted and no other audio cache entry is evicted.

### US2 — Keep listening under interruption without surprise audio (P1)

As a person interrupted by a lock screen, tab switch, or app backgrounding event, I regain control rather than hearing ZenFlow resume by itself.

**Independent test**: start an explicit ambience play, dispatch hidden/pagehide/native pause, then dispatch visible/resume; assert the element is paused, Media Session is cleared, no `.play()` occurs, and the localized Resume button is the only route that asks playback to continue.

1. **Given** selected audio is playing, **when** the document becomes hidden, pagehide fires, the native app pauses, or the screen locks, **then** playback pauses and Media Session exposes no playing state.
2. **Given** playback was interrupted, **when** the app becomes visible again, **then** the control says Resume in the current locale and no audio starts until that control receives a user activation.
3. **Given** playback starts after a user action, **when** Media Session is supported, **then** title/artist/action handlers use the current locale and pause/stop retain explicit-resume semantics.

### US3 — Confirm only durable success (P2)

As a person saving a mood, habit, journal entry, focus session, gratitude entry, or breathing result, I receive the existing quiet cue only after the local source of truth has committed, and still receive visible/haptic confirmation if sound is disabled.

**Independent test**: make each mapped persistence promise reject and assert neither its success cue nor Media Session playback starts; resolve it and assert its established `nonAudioFeedback` plus exactly one eligible cue follows the durable state transition.

1. **Given** a save rejects or conflicts, **when** its UI enters an error state, **then** it emits no success cue.
2. **Given** the owning local persistence transaction resolves, **when** the save state becomes durable success, **then** the mapped allowed completion/milestone cue may run after current mute, volume, and comfort checks.

## Edge cases

- `navigator.storage.estimate()` is absent, rejects, or reports insufficient headroom: do not start a long download; show a local unavailable/quota state and preserve existing selected bytes.
- Save-Data is enabled, connection reports `slow-2g`/`2g`, or connection information is absent: no query parameter bypasses the first two; absent information is not itself a block, but download remains explicit.
- Offline playback asks for `Range`: serve it only from a verified full cached `200` body; otherwise report offline unavailability, never a truncated success.
- Two tabs select the same item: one download owns its abort/progress controller; the second observes pending/available state and does not duplicate bytes.
- A service-worker update changes an item revision during download: reject old bytes, clear selected availability, and require an explicit new selection.
- Locale changes while audio is playing: update Media Session on the next explicit playback action; do not restart audio merely to change metadata.
- Quota purge/delete races with play: pause/clear state and show unavailable; do not claim the cache survived.
- Browser lacks Service Worker, Cache API, Media Session, Storage Estimate, or persistent storage: Web/Vite stays playable online from its existing control; offline download UI is unavailable with an honest explanation.

## Functional requirements

- **FR-001**: The PWA MUST make zero cold-launch requests for long ambience audio and remove whole-library warming from `src/main.tsx` and `src/sw.ts`.
- **FR-002**: The PWA MUST start a download only after an explicit activation of one manifest-listed, same-origin audio item and MUST fetch/cache no unselected long audio item.
- **FR-003**: Before cache admission, the PWA MUST validate the exact contract `PwaAudioCacheEntry { path, sha256, bytes, revision, group }` and verify a complete same-origin `200` audio response against its immutable path, revision, declared bytes, content type, and SHA-256 digest. Any mismatch deletes only that exact attempted entry.
- **FR-004**: The PWA MUST expose the exact state contract `PwaAudioOfflineState = "uncached" | "downloading" | "cached" | "paused" | "quota_blocked" | "invalid" | "unavailable"` with localized size, progress, Cancel, Delete, and honest offline-unavailable presentation, without exposing raw URLs or hashes to user-facing copy or diagnostics.
- **FR-005**: The PWA MUST call `StorageManager.estimate()` and may call `StorageManager.persist()` only inside the explicit offline-download action for a selected track, reserve documented headroom, handle unsupported/quota failure without evicting unselected audio or any user data, and use targeted deletion only for the selected track.
- **FR-006**: Save-Data and `slow-2g`/`2g` network classifications MUST prevent download start; URL parameters, persisted preferences, and retry UI MUST NOT override that guard.
- **FR-007**: The service worker MUST admit only verified full `200` responses and serve a Range request from that full verified body; any missing, stale, corrupt, partial, or unverified entry MUST result in honest offline unavailability.
- **FR-008**: Audio MUST pause on document hidden, `pagehide`, lock-equivalent platform lifecycle pause, and media-session pause/stop; it MUST NOT autoplay on visible/resume.
- **FR-009**: After interruption, the originating control MUST offer an accessible, localized Resume action; only activation of that action may request playback again.
- **FR-010**: Media Session title, artist, playback state, and play/pause/stop handlers MUST use current locale strings and preserve explicit-resume behavior; unsupported Media Session is a no-op without a failure claim.
- **FR-010A Unlock proof**: `audioUnlocked=true` MUST be assigned only after an awaited `HTMLMediaElement.play()` resolves or an `AudioContext` is observed in `running` state. A rejected play, suspended/closed context, best-effort silent cue, or generic gesture MUST leave it false.
- **FR-011**: Allowed success/completion/milestone cues MUST occur only after the owning local persistence transaction has resolved and the UI has durable success state; rejected, conflicted, aborted, or pending writes MUST emit no success cue.
- **FR-012**: Every audio outcome MUST retain existing visible state and applicable haptic/non-audio fallback; routine interactions listed in `APP_AUDIO_FORBIDDEN_ACTIONS` remain silent.
- **FR-013**: The implementation MUST add no dependency, audio asset, native wrapper behavior, production data, external request destination, or analytics content; local audio metadata must not include private journal, mood, habit, focus, or account content.
- **FR-014**: Shared code MUST use an explicit Web/PWA capability boundary; Android/Capacitor, iOS/WKWebView, and Desktop/Tauri retain their present audio behavior until owner-specific compatibility evidence exists.
- **FR-015 Technical audio quality**: Existing retained assets MUST pass deterministic decode, duration, channel/sample-rate, clipping/true-peak, loop-seam, start/stop-ramp, and duplicate-content checks appropriate to their cue/ambience group. A technical check cannot approve artistic suitability.
- **FR-016 Human audio fit**: Release evidence MUST keep `AUDIO_FIT` `UNVERIFIED` until the user/product owner reviews headphones, phone speaker, and desktop speaker for startle, fatigue, masking, loop seam, speech-like/alarm-like associations, and cultural neutrality. No agent or automated score may self-approve this gate.

## Key entities

- **PwaAudioCacheEntry**: exact compile-time integrity record `{ path, sha256, bytes, revision, group }`; never user-generated content. Product label keys and asset IDs are separate catalog metadata and cannot weaken this integrity contract.
- **PwaAudioOfflineState**: exact UI/runtime union `uncached | downloading | cached | paused | quota_blocked | invalid | unavailable`.
- **SelectedAudioDownload**: in-memory/UI state for one explicit PWA request: asset ID, revision, byte progress, phase, abort owner, and error class. It is not a source of truth for user data.
- **VerifiedAudioCacheRecord**: cache metadata bound to a manifest entry after complete-response verification; it contains no journal/mood/habit/account content.
- **InterruptedPlayback**: transient owner/control state that permits the originating surface to render Resume after a lifecycle pause. It is cleared on stop, error, removal, or successful explicit resume.
- **DurableCueBoundary**: the resolved local persistence result and its allowed `APP_AUDIO_ACTION_EVENTS` mapping; failed/pending writes do not cross this boundary.

## Measurable success criteria

- **SC-001**: focused tests prove no long-audio request occurs during cold launch and one explicit selected item produces no request for any other long item.
- **SC-002**: focused tests prove all rejection cases in FR-003/FR-007 leave zero usable cache entry and Range offline playback reports unavailable rather than returning partial/unverified bytes.
- **SC-003**: focused tests prove quota, cancellation, and deletion touch only the selected entry; a quota failure does not report availability.
- **SC-004**: focused component/lifecycle tests prove hidden/pagehide/pause stop audio and visible/resume causes zero playback calls until the Resume control is activated.
- **SC-005**: focused locale tests prove all eight supported locale keys are present for offline/Resume/Media Session labels and `ar`/`he` controls remain semantically labelled; human language approval remains UNVERIFIED.
- **SC-006**: focused save-path tests prove every mapped failed/conflicted write produces zero success cue and a resolved local write is the earliest cue point.
- **SC-007**: static/diff checks prove no package dependency, `public/sounds` asset, `android`, `ios`, `src-tauri`, production data source, or external streaming endpoint was added.
- **SC-008**: focused unlock tests prove rejected `play()` and non-running `AudioContext` keep `audioUnlocked=false`, while only resolved playback or a running context permits true.
- **SC-009**: technical audio analysis reports decode/duration/channels/sample rate/clipping/true peak/loop seams/ramps/duplicates separately; `AUDIO_FIT` remains `UNVERIFIED` until the named human review is recorded.

## Platform and proof ledger

| Surface | Planned behavior | Current proof status |
|---|---|---|
| Web/Vite | Existing online playback remains; offline selector is unavailable without PWA cache capability. | UNVERIFIED runtime |
| Installed PWA | Selected verified cache, explicit resume, localized Media Session, quota/error states. | UNVERIFIED until focused/browser tests |
| Android/Capacitor | No wrapper or notification-channel change; shared audio must not start PWA download logic. | UNVERIFIED owner compatibility receipt |
| iOS/WKWebView | No wrapper change; re-arm only after resume and wait for explicit control. | UNVERIFIED device receipt |
| Desktop/Tauri | No PWA cache workflow; existing `dist` assets only. | UNVERIFIED package receipt |
| Accessibility/i18n | Visible non-audio feedback, 44px existing controls, eight locales, RTL semantic labels. | UNVERIFIED rendered/audit proof |
| Security/privacy | Same-origin manifest-only assets; no content/IDs/raw URLs in diagnostics. | UNVERIFIED focused scan/review |
| Release | Local-only planning; no deployment, publication, native artifact, or human listening sign-off. | UNVERIFIED |

## Assumptions and explicit unknowns

- SHA-256 and byte-size values will be generated from existing tracked files by a deterministic build-time checker; their current values are not invented in this plan.
- The product owner’s selected cache headroom policy is proposed in `plan.md` as the larger of 10 MiB or 15% of quota; implementation must not label it approved without the focused review/task evidence.
- Browser quota accounting, Media Session behavior, lock events, and offline Range behavior differ by engine; tests prove the code contract, not real-device behavior.
- Formal legal review of dev-time `lamejs@1.2.1` remains UNVERIFIED under `docs/audio/non-hyperfocus-sound-effects-policy.md` and is outside this feature.

## Rollback

Revert the bounded PWA audio modules, related translations/tests, and service-worker route together. Remove only cache entries written by the feature’s revisioned selected-audio namespace; do not clear unrelated ZenFlow, browser, or user caches. A rollback returns to existing online user-started playback; it must not restore whole-library warming.
