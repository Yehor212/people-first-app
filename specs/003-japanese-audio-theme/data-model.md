# Data Model

## MusicMaster

Represents one immutable, locally packaged long-form music asset.

| Field | Type | Rules |
| --- | --- | --- |
| `id` | stable string | Unique within the collection; not localized |
| `fileName` | string | Relative MP3 filename under the music directory |
| `title` | string | Private/runtime media-session title; never rendered by the icon control |
| `sequence` | integer | Unique value 0-9 |
| `durationSeconds` | number | Original R7 duration, 164–170 seconds |
| `sampleRate` | integer | 48,000 Hz |
| `channels` | integer | Exactly 2 |
| `encoderKbps` | integer | Original 320 kbps MP3, no re-encoding |
| `runtimeGain` | number | Bounded collection gain matching the existing app master volume |
| `byteLength` | integer | Exact generated MP3 size |
| `sha256` | lowercase hex | Exact 64-character digest |
| `sourceCandidateId` | string | Exact retained R7 source candidate |
| `sourceReceipt` | object | Original MP3/WAV/FLAC hashes and local generation provenance |
| `provenance` | object | Generator, exclusions, rights boundary, and review status |

Validation rejects duplicate IDs, filenames, sequence values or hashes, source-receipt mismatches, unsupported encoding, non-finite values, paths outside the music directory, and unverified substitutes or reference-derived inputs.

## MusicCollection

| Field | Type | Rules |
| --- | --- | --- |
| `id` | literal | `zenflow-r7-soft-japanese-10` |
| `schemaVersion` | integer | Starts at 1 |
| `masters` | `MusicMaster[10]` | Exactly ten unique ordered entries |
| `firstRunEnabled` | boolean | Always false |
| `advanceMode` | literal | Stable sequential order |
| `trackBoundary` | object | Single-player fade-out/switch/fade-in settings |
| `humanReview` | object | One decision per exact master hash; remains pending until owner input |

## PlaybackPreference

| Field | Type | Rules |
| --- | --- | --- |
| `enabled` | boolean | Device-local, default false |
| `cursorId` | MusicMaster id | Device-local resume position; normalized to the first master if invalid |

The preference contains no user identifier, account data, journal content, listening history, or remote sync field.

## PlaybackSession

The approved transport amendment adds ephemeral selection revision, cancellable fade state and explicit-pause intent, not persisted history. The existing device-local cursor is unchanged. Manual selection preserves off/paused/playing intent; a source change must not restart an explicitly paused player. Planning hides rendering without changing any stored entity.

State machine:

```text
off -> loading -> playing -> fading -> loading(next) -> playing
             \-> blocked -> loading(explicit gesture)
             \-> paused -> loading(owner/foreground available)
             \-> recovering -> error
playing/fading/loading/blocked/paused/error -> off
```

Only one active request identifier and one long-audio ownership release function may exist. A stale async completion cannot change current state.

## ThemeTransitionSession

| Field | Type | Rules |
| --- | --- | --- |
| `requestId` | increasing integer | Latest request wins |
| `fromTheme` | applied theme | Actual pre-commit theme |
| `toTheme` | applied theme | Persisted target |
| `overlayColor` | validated CSS colour | Derived from computed pre-change theme token |
| `animated` | boolean | False for reduced motion or unavailable DOM |
| `startedAt` | monotonic timestamp | Diagnostic only; no user data |
| `cleanup` | handles | At most one frame/timer/listener set |

State transitions are `idle -> prepared -> committed -> releasing -> idle`; any new request cancels the previous session before preparation.

## AndroidReleaseArtifact

| Field | Type | Rules |
| --- | --- | --- |
| `sourceCommit` | Git SHA | Exact merged `main` commit |
| `versionCode` | integer | Greater than every Play-uploaded compatible build |
| `versionName` | string | Release cycle version |
| `packageName` | literal | `com.zenflow.app` |
| `aabSha256` | hex string | Exact uploaded bytes |
| `signerSha256` | hex string | Existing authorized upload certificate |
| `track` | literal | Internal testing |
| `consoleState` | enum | draft, processing, available, rejected |

No credential value is stored in the model or evidence packet.
