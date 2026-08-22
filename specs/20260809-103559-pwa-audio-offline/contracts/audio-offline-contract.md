# Audio offline contract

## Contract version

`pwa-audio-offline/v1` is the approved internal target contract for scoped local source/test work. It does not authorize dependency/asset installation, production/private writes, native edits, publication, or other external side effects.

## Manifest

```ts
type PwaAudioCacheEntry = Readonly<{
  path: string;
  sha256: string;
  bytes: number;
  revision: string;
  group: "entry" | "orb" | "diary" | "focus" | "feedback";
}>;

type PwaAudioOfflineState =
  | "uncached"
  | "downloading"
  | "cached"
  | "paused"
  | "quota_blocked"
  | "invalid"
  | "unavailable";
```

Invariants: `path` is a tracked first-party `/sounds/` path resolved via the configured base URL; `revision` changes whenever its bytes change; `bytes > 0`; `sha256` is lowercase 64-hex; no field contains user content, account identifiers, raw journal text, or a remote URL. Asset ID and localized label are separate trusted catalog metadata.

## Client-to-worker messages

```ts
type PwaAudioMessage =
  | { type: "PWA_AUDIO_DOWNLOAD"; requestId: string; assetId: string; revision: string }
  | { type: "PWA_AUDIO_CANCEL"; requestId: string }
  | { type: "PWA_AUDIO_DELETE"; assetId: string; revision: string }
  | { type: "PWA_AUDIO_STATUS"; assetId: string; revision: string };

type PwaAudioResult =
  | { type: "PWA_AUDIO_PROGRESS"; requestId: string; receivedBytes: number; totalBytes: number | null }
  | { type: "PWA_AUDIO_AVAILABLE"; assetId: string; revision: string; byteSize: number }
  | { type: "PWA_AUDIO_UNAVAILABLE"; assetId: string; revision: string; reason: "policy" | "quota" | "offline" | "integrity" | "cancelled" | "unsupported" }
  | { type: "PWA_AUDIO_DELETED"; assetId: string; revision: string };
```

Messages require a same-origin controlled `WindowClient`; the worker ignores malformed fields, unknown IDs, stale revisions, untrusted origins, and unrecognized types. `requestId` is opaque per-client ephemeral state and must not be logged to remote telemetry.

## Download preconditions and results

1. Client verifies PWA/Service Worker/Cache API capability, explicit activation, current manifest item, and policy guard before sending `PWA_AUDIO_DOWNLOAD`. Only this explicit offline-download action may call `StorageManager.estimate()` or `StorageManager.persist()`.
2. Worker resolves the asset only from its manifest; it does not accept URL input.
3. Worker fetches `cache: "reload"`, same-origin, follows no unverified response into cache, accepts only `200`, and checks byte count and SHA-256 before `cache.put`.
4. A Range request may be handled only after a verified full body is present. The route never caches `206` as a full item.
5. A mismatched or stale response is deleted and yields `PWA_AUDIO_UNAVAILABLE { reason: "integrity" }`.
6. Cancellation aborts only the initiating `requestId`; deletion targets an exact `(assetId, revision)` verified key.
7. Cache quota failure yields reason `quota`; it neither evicts another selected item nor returns available.

## Unlock proof contract

`audioUnlocked` may transition to true only after an awaited `HTMLMediaElement.play()` resolves or after `AudioContext.state` is observed as `running`. Rejected play, suspended/closed contexts, best-effort silent cues, a generic gesture, lifecycle resume, or Media Session metadata setup cannot unlock audio.

## Playback/resume contract

`pauseForInterruption(surface, assetId)` clears Media Session playing state and produces `resumeEligible=true` only for the control that was playing. `resumeFromExplicitControl(surface, assetId)` rejects hidden documents, missing/invalid selected availability when offline, muted/comfort-disabled settings, stale control ownership, and unsupported audio. It may call media `.play()` only in its activation handler. Generic `visibilitychange`, native resume, timer, preload, service-worker message, query parameter, and unrelated pointer/key event are never playback triggers.

## Media Session contract

`setLocalizedAudioMediaSession({ title, artist, onResume, onPause, onStop })` receives already-localized strings from the current language context. `onResume` is the same explicit resume handler used by the visible control. If unsupported, the function changes neither app playback nor UI availability. Metadata excludes user-entered text and remote audio URLs.

## Durable cue contract

`playDurableActionCue(event, commit)` requires `commit.status === "resolved"` from the local persistence owner, an allowed `APP_AUDIO_ACTION_EVENTS` event, and current mute/volume/comfort recheck. A `rejected`, `conflict`, `cancelled`, `pending`, or remote-only confirmation returns without audio. Caller keeps its established visual/haptic feedback regardless of the return value.

## Technical and human quality gates

Automated evidence reports decode success, duration, channels, sample rate, clipping/true peak, loop seam, start/stop ramp, and duplicate-content results per asset/group. `AUDIO_FIT` is separately owned by the user/product owner and covers headphones, phone speaker, desktop speaker, startle, fatigue, masking, loop seam, speech-like/alarm-like associations, and cultural neutrality. Technical success never changes `AUDIO_FIT` from `UNVERIFIED`.
