# Audio security and privacy checklist

| Control | Evidence and implementation check | Status |
|---|---|---|
| Selected URL authority | Worker resolves `assetId` from a compile-time allowlist; messages never carry a URL. Test unknown/traversal ID rejection. | Planned |
| Origin and response integrity | Require same origin, complete `200`, exact revision/size/SHA-256 before cache admission; reject opaque, `206`, and mismatch responses. | Planned |
| Range safety | `RangeRequestsPlugin` sees only verified complete bodies; offline miss renders unavailable. | Planned |
| Cache isolation | Exact revisioned key delete only; tests show unrelated same-origin cache and unselected audio survive. | Planned |
| Quota safety | `estimate()` and `persist()` only within explicit offline-download activation; no broad/user-data eviction; quota failures are honest. | Planned |
| User agency | No cold warming/autoplay/query override; hidden/pagehide/pause stop; visible Resume only. | Planned |
| Privacy | No journal/mood/habit/focus/account content, raw URL, digest, or request ID in user copy or telemetry. | Planned |
| Media Session | Localized app-owned strings only; no user content and no remote artwork/stream. | Planned |
| Durable success | Cue call follows local commit; rejected/conflicted/pending writes have a negative control. | Planned |
| Unlock proof | Only resolved media play or observed running AudioContext sets `audioUnlocked`; rejected/suspended negative controls remain false. | Planned |
| Technical audio QC | Decode/duration/channels/sample rate/clipping/true peak/loop seam/ramps/duplicates have retained command evidence. | Planned |
| Human `AUDIO_FIT` | User/product owner reviews three playback classes plus startle/fatigue/masking/associations/cultural neutrality; automation cannot approve. | UNVERIFIED human |
| Supply chain | No dependency or asset addition; preserve current generated-audio provenance. Legal review of `lamejs` remains outside scope. | UNVERIFIED legal |
| Native boundary | No Android/iOS/Tauri edit and no notification-channel migration; shared logic must capability-gate PWA route. | Planned; device proof UNVERIFIED |
| Production data | No fixture/demo data, persistence schema, sync, analytics, export, or production write. Run PDI diff/full checks after code changes. | Planned |

**Abuse cases to test**: forged worker message; unknown asset ID; selected path with query/fragment; cross-origin redirect; stale revision; content-length mismatch; SHA mismatch; partial response; duplicate tab selection; cancellation race; quota error; persistence call outside explicit download; malicious cache name; rejected unlock; background/resume auto-play attempt; failed persistence cue attempt.

**Verdict**: GO for artifact generation. STOP any implementation that accepts caller URLs, caches unverified bytes, restores audio from a generic gesture, leaks private content, or expands native/dependency/asset scope.
