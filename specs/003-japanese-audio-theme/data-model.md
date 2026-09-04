# Data Model

## MusicMaster

Represents one immutable, locally packaged long-form music asset.

| Field | Type | Rules |
| --- | --- | --- |
| `id` | stable string | Unique within the collection; not localized |
| `fileName` | string | Relative MP3 filename under the music directory |
| `title` | string | Private/runtime media-session title; never rendered by the icon control |
| `sequence` | integer | Unique value 0-9 |
| `durationSeconds` | number | 150 seconds for this collection |
| `sampleRate` | integer | 44,100 Hz |
| `channels` | integer | Exactly 2 |
| `encoderKbps` | integer | 128 kbps |
| `runtimeGain` | number | Bounded collection gain matching the existing app master volume |
| `byteLength` | integer | Exact generated MP3 size |
| `sha256` | lowercase hex | Exact 64-character digest |
| `seed` | hexadecimal string | Fixed first-party synthesis seed |
| `compositionSpec` | object | Chords, scale, sparse events, voice mix, tempo, and loop parameters |
| `provenance` | object | Generator, exclusions, rights boundary, and review status |

Validation rejects duplicate IDs, filenames, sequence values, hashes, seeds, empty event sets, unsupported encoding, non-finite values, paths outside the music directory, or reference-derived inputs.

## MusicCollection

| Field | Type | Rules |
| --- | --- | --- |
| `id` | literal | `zenflow-evening-collection-v1` |
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
