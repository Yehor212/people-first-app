# Hyperfocus Runtime Loop And Tone Design

## Goal

Promote all eighteen owner-accepted Hyperfocus source-audition recordings into the existing six-family, three-intensity runtime contract, render technically loop-safe 30-second MP3 masters, add a bounded user-controlled `3–16 kHz` tone filter without changing pitch or playback rate, and prove the same bytes reach Web/PWA, Android, iOS, and Desktop packaging.

## Explicit Requirements

- Use all eighteen sounds from the verified private source-audition bundle.
- Assign three sounds in each family to `soft`, `deep`, and `intense` by measured signal intensity; blind `A/B/C` labels are never treated as intensity.
- Produce a continuous loop for every runtime file.
- Keep the existing reliable HTML media playback and lifecycle behavior.
- Add a user-adjustable kHz control.
- At the end, open a localhost comparison with multiple placement variants so the owner chooses where the control belongs.
- Cover Web/Vite, installed PWA, Android/Capacitor, iOS/WKWebView, and Desktop/Tauri.

## Current Evidence

- Runtime variants are owned by `src/lib/hyperfocusAudioCatalog.ts` and resolve to `public/sounds/hyperfocus/hyperfocus-{family}-{level}.mp3` through `src/lib/hyperfocusGeneratedAudioManifest.ts`.
- `AmbientSoundGenerator` in `src/lib/ambientSounds.ts` reuses one iOS-blessed `HTMLAudioElement`, sets `loop = true`, coordinates unlock/resume, and supplies family fallback audio.
- `src/sw.ts` caches same-origin audio through a `CacheFirst` route named `zenflow-runtime-audio` for up to 30 days. Replacing bytes under the same URLs without changing that namespace can retain old audio.
- Capacitor uses `dist` through `capacitor.config.ts`; `cap:sync:android` and `cap:sync:ios` copy generated web assets into ignored native public folders.
- Tauri uses `../dist` as `frontendDist`, so the Vite/Tauri build output is the desktop asset source.
- The private source-audition bundle has 18 hash-bound 48 kHz stereo PCM windows, technical `PASS`, AI status `TRIAL_ONLY_NOT_ADMITTED`, human status `PENDING_OWNER_SOURCE_REVIEW`, and runtime promotion `false`. The current user instruction accepts the set for implementation, but it does not convert AI, legal, final-loop listening, public deploy, physical-device, or store evidence into `PASS`.

## Architecture

### 1. Source-to-level assignment

Every family keeps all three approved source identities. The mastering tool measures the reviewed 20-second PCM window using independent metrics:

- RMS dBFS;
- first-difference RMS (`motionDb`);
- zero crossings per second;
- crest factor.

It computes the existing project-compatible intensity score:

```text
(rmsDb + 60) * 1.2 + (motionDb + 70) * 0.45 + min(20, zeroCrossingsPerSecond / 400)
```

The three rows sort ascending by `(intensityScore, candidateId)`. Lowest becomes `soft`, middle `deep`, highest `intense`. The tracked runtime promotion manifest records source, preview, output, metric, level, and rank hashes so no blind label can influence the assignment.

### 2. Loop construction

The exact reviewed 20-second PCM preview remains the only artistic input. A deterministic 15-second circular base is created by equal-power overlapping the final five seconds with the first five seconds, followed by the untouched middle ten seconds. The circular base is rotated, without dropping or adding frames, to the deterministic boundary with the lowest adjacent jump plus local 20 ms RMS score. The 15-second base is repeated exactly twice to form a 30-second delivery waveform.

Level RMS targets are `-30 dBFS` for `soft`, `-26 dBFS` for `deep`, and `-22 dBFS` for `intense`. Gain is linked across both channels. If the requested gain would violate the peak ceiling, the output is scaled down rather than clipped; a family fails packaging when the decoded MP3 then loses the required 3 dB adjacent progression.

Allowed delivery operations are:

```text
decode-pcm
equal-power-loop-crossfade
quiet-boundary-rotate
repeat-exactly-twice
linked-gain
safety-peak-limit
encode-mp3
```

No second source, synthetic texture, generative repair, pitch shift, time stretch, stereo widening, source separation, denoising, or random offset is permitted. The linked periodic safety limiter uses 5 ms lookahead, 100 ms release, and a `-6 dBFS` pre-encode ceiling; it applies one smooth gain factor to both channels per frame and processes the circular 15-second base before repeating it. The 5 dB codec headroom protects against the measured worst-case MP3 ringing around fireplace crackles. Output targets are 48 kHz stereo, 30 seconds before MP3 framing, 128 kbps MP3, decoded peak no greater than `-1 dBFS`, zero clipped samples, and decoded boundary metrics within the existing Hyperfocus QC limits. The final decoded MP3 must preserve at least a 3 dB adjacent intensity step within each family.

### 3. Tone control

The control represents a low-pass cutoff, not a sample rate and not playback speed:

- public range: `3–16 kHz`;
- default: `16 kHz`;
- step: `0.5 kHz`;
- internal range: `3000–16000 Hz`;
- native input semantics: `type="range"`, numeric value, keyboard support, visible value and accessible name;
- persistence: local app setting through the repository storage helpers; no Dexie schema, sync, analytics, or cloud write;
- failure behavior: if Web Audio graph creation is unsupported or fails, playback continues through the existing unfiltered HTML media path and the status is exposed as degraded rather than silencing audio.

`AmbientSoundGenerator` keeps one media element. A single `MediaElementAudioSourceNode` and `BiquadFilterNode` may be attached at most once to that element. Cutoff changes use a short parameter ramp to avoid zipper noise. The implementation never writes `playbackRate`, `preservesPitch`, source duration, or loop points in response to the slider.

### 4. UI placement gate

Production placement is intentionally deferred until the final localhost comparison. A non-shipping local design lab will show the same real selector state and three options:

1. Inline beneath the active intensity row.
2. A compact tone button that opens an anchored popover.
3. A dedicated row inside the expanded sound panel.

Each option uses at least a 44 px target, works with keyboard and touch, displays the kHz value, remains understandable without color, and demonstrates narrow mobile, RTL, desktop-width, muted, and Web-Audio-degraded states. The owner choice is required before production UI placement is integrated. The design lab must not enter `public`, `dist`, Capacitor, Tauri, or production routing.

### 5. PWA cache migration

The runtime audio cache moves to a new versioned namespace. Activation deletes only the exact legacy Hyperfocus audio cache namespace after the new service worker activates. Warm-cache paths stay stable, cache warming remains non-blocking and bounded, and full-response plus range-request behavior remains intact. Existing unrelated caches are not cleared.

### 6. Provenance and rollback

Tracked evidence maps every runtime output SHA-256 to:

- BigSoundBank item page, title, author, and CC0 evidence;
- source and reviewed-preview hashes;
- exact source-to-level ranking metrics;
- exact loop/mastering operations;
- private LAME 4.0 executable/source/build hashes and fixed encoder argv;
- decoded QC and AI diagnostic status;
- owner/human, legal, platform, store, and release boundaries.

The existing eighteen runtime filenames stay unchanged, so stored selections and legacy family aliases remain compatible. Rollback is an ordinary Git revert of the asset, manifest, cache-namespace, and runtime commits; no user data migration exists.

## Cross-Platform Matrix

| Surface            | Intended result                                                                                                             | Required evidence                                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Web/Vite           | New MP3 hashes resolve through existing stable paths; tone graph works or safely bypasses.                                  | Unit tests, production build, browser playback/network/console proof.                                                           |
| Installed PWA      | New cache namespace cannot reuse old audio; offline range playback remains functional.                                      | Service-worker tests and PWA offline/range Playwright flow.                                                                     |
| Android/Capacitor  | Synced assets exactly match source runtime hashes and WebView control works.                                                | `cap:sync:android`, bundle/APK inventory, emulator semantic interaction when available.                                         |
| iOS/WKWebView      | Synced assets exactly match; blessed element and resume lifecycle remain intact.                                            | `cap:sync:ios`, Xcode/simulator build when available, user-gesture lifecycle test.                                              |
| Desktop/Tauri      | `dist` contains exact hashes and Tauri frontend embedding references them.                                                  | Desktop config/toolchain checks and build/artifact scan when locally supported.                                                 |
| Store/Release      | No publication is implied.                                                                                                  | Signed store artifacts, consoles, public URL, and staged rollout remain `UNVERIFIED` unless separately authorized and observed. |
| Accessibility/i18n | Final selected slider location supports keyboard, screen reader, touch, and RTL.                                            | Component tests plus localhost visual/runtime review in all relevant states.                                                    |
| Performance        | Only the selected sound is decoded/routed; no eager decoding of 18 files; asset count and size stay within current budgets. | Bundle size check, browser trace/memory observation, startup smoke.                                                             |
| Security/privacy   | Same-origin local assets only; no microphone, PII, auth, sync, analytics, or external DSP service.                          | Scoped security suite and production-data-integrity checks.                                                                     |

## Test-First Acceptance

- A failing mastering test proves blind labels are not level order and exact all-18 coverage is required.
- A failing loop test proves the pre-mastered reviewed window does not satisfy the 30-second delivery/seam contract.
- A failing tone-controller test proves cutoff clamping, persistence, bypass, and no pitch-rate mutation are absent before implementation.
- A failing service-worker test proves the old cache namespace can retain stale audio.
- All focused tests turn green without weakening existing audio limits.
- Independent verifier recomputes all hashes and decoded signal metrics before runtime assets are copied.
- Existing audio, catalog, lifecycle, i18n, PWA, build, integrity, and security gates pass or remain explicitly `FAIL`/`UNVERIFIED` with exact reasons.

## Non-Goals

- No new paid service, external audio API, model dependency, npm production dependency, native plugin, cloud preference, analytics event, auth/sync change, or deployment.
- No runtime audio generation, mock/sample fallback, binaural-beat claim, hearing/medical claim, pitch control, or playback-speed control.
- No final production slider placement before owner selection from the localhost lab.
- No claim that automated seam metrics replace long human loop listening.

## UNVERIFIED Ledger

- Final 10-minute-per-file human loop/fatigue review of the mastered MP3s.
- Legal clearance beyond source-specific CC0 evidence and owner authorization.
- Physical Android device, physical iOS device, OEM audio behavior, and Bluetooth routing.
- Signed Android/iOS/Desktop store artifacts, store review, public deployment, and cache-busted production behavior.
- Final artistic/craft acceptance of slider placement until the localhost choice is recorded.
- Third-party LAME 4.0 source scan remains `FAIL_SCOPED_EXTERNAL_SOURCE`: the private build uses only fixed trusted local WAV/MP3 paths and is never shipped, but this containment is not a scanner `PASS`.
