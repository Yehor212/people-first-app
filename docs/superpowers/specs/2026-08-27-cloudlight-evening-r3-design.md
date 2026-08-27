# Cloudlight Evening R3 Production Design

- **Date:** 2026-08-27
- **Status:** WRITTEN SPECIFICATION AWAITING OWNER REVIEW
- **Scope:** audio composition, rendering, rights provenance, audit, owner selection, and hash-bound runtime-asset replacement
- **Write boundary:** this document only; no production audio, application code, native project, package, deployment, push, release, or external message is changed by this design step
- **Execution model:** SOLO; no delegated agent evidence

## Goal

Produce an original ZenFlow evening-music work that approaches the reference's high-level calm, nocturnal, spacious, warm, low-urgency mood and production grammar without copying protected melody, harmony, arrangement, recording, samples, score, MIDI, or other recognizable expression. Deliver a 166-second linear review master and a separate seamless 150-second runtime loop, then replace the current runtime asset only after the owner approves one exact candidate hash.

The product outcome is gentle background music that helps the entry experience feel protected and unhurried. It is not a therapeutic intervention, sleep treatment, anxiety treatment, or promise that every listener will relax.

## Relationship To The Existing Cloudlight Design

This R3 document refines `docs/superpowers/specs/2026-08-27-cloudlight-evening-global-audio-design.md`.

- The existing document remains authoritative for the already implemented preference, playback ownership, lifecycle, navigation control, caching, accessibility, and cross-platform behavior unless this R3 document explicitly changes an audio-artifact contract.
- R3 supersedes the older composition, synthesis, source-duration, bitrate, provenance, technical-audit, and human-listening sections.
- The older deterministic additive-synthesis mandate becomes a deterministic first-party MIDI and automation source rendered through the locally installed GarageBand instrument and effect library.
- The older single 150-second source becomes two outputs from one composition session: a 166-second linear review master and a 150-second seamless runtime loop.
- The shipped application keeps the current production asset until an owner-selected R3 runtime MP3 passes every applicable gate and its SHA-256 is recorded.

If the two documents conflict outside those audio-artifact sections, implementation stops for owner review instead of silently choosing one.

## Explicit Requirements

- Evaluate the full 0:00-2:46 reference arc as mood research; do not design from only its opening seconds.
- Use the approved GarageBand Hybrid workflow: first-party deterministic notes, timing, voicing, and automation rendered with GarageBand instruments and effects.
- Use no Apple Loop, Live Loop, Drummer pattern, stock phrase, third-party sample, reference sample, downloaded waveform, extracted stem, copied MIDI, or transcribed score.
- Create three blind candidates from the same original composition. Candidate differences are limited to mix balance.
- Keep a 166-second linear listening version for owner review.
- Keep a separate, exactly 150-second runtime loop with no endpoint fade and no audible seam.
- Audit the whole decoded file, not only the generator or source project.
- Treat automated audio models as diagnostic only. They cannot create `OWNER_ARTISTIC_PASS`, `AUDIO_FIT`, legal clearance, or release approval.
- Preserve the Japanese fūrin notification cue, Hyperfocus families, auth ambience, Orb ambience, Diary ambience, feedback cues, haptics, and OS notification-channel ownership.
- Do not replace production bytes before the owner names candidate 01, 02, 03, or `NONE` and that selection is bound to an exact SHA-256.
- Add no paid service, remote audio API, new production dependency, analytics event, account data, permission, or streaming endpoint.

## Necessary Implied Requirements

- Freeze and hash the current production asset before creating candidates so rollback is exact.
- Keep composition source, render environment, instrument choices, automation, encoder settings, candidate mapping, and every output hash in a machine-readable provenance ledger.
- Separate composition similarity review from codec quality review. A musically correct master can still fail after MP3 encoding.
- Compare linear masters before comparing runtime encodes; otherwise codec differences can bias artistic selection.
- Test low-volume audibility and fatigue on both headphones and a built-in phone-class speaker.
- Test three consecutive runtime loops because one boundary alone can miss cumulative decoder or scheduling behavior.
- Keep all rejected candidates and reports outside production paths; rejection evidence is retained and never promoted by filename alone.
- Rotate the runtime cache identity or revision when approved bytes change so installed PWAs cannot retain the old asset under a stable URL.
- Preserve one long-running ZenFlow ambience owner and the first-ever opt-in default. R3 does not authorize surprise autoplay.
- Treat physical-device acoustics, interruption behavior, store delivery, public deployment, and legal conclusions as separate proof domains.

## Current Verified Baseline

The following evidence was captured in the isolated locked worktree on 2026-08-27:

| Item                       | Verified value                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Branch                     | `codex/audio-cc0-rights-pack-20260825`                                                                                         |
| Worktree lock              | Present; reason `ZenFlow codex isolated workspace`                                                                             |
| Existing dirty paths       | Five pre-existing R3/v2 script or package paths, classified as inherited task work and excluded from this document-only commit |
| Runtime asset              | `public/sounds/cloudlight-evening-loop.mp3`                                                                                    |
| Deploy mirror              | `docs/sounds/cloudlight-evening-loop.mp3`                                                                                      |
| Current SHA-256            | `d096c668ef6471f855b49c93bc5509ccbd63ac1fb93dc9af96ba3c7c9e65be40` for both files                                              |
| Current size               | 2,400,757 bytes for each copy                                                                                                  |
| Current container metadata | MP3, stereo, 44,100 Hz, 128,000 bit/s, estimated 150.047313 seconds via macOS `afinfo`                                         |
| Installed GarageBand       | 10.4.14, build 6648                                                                                                            |
| Runtime element            | one local `<audio loop playsInline preload="none">` path                                                                       |
| Runtime gain               | master volume multiplied by `0.18`                                                                                             |
| Local FFmpeg limitation    | bundled FFmpeg 8.1.2 cannot decode this MP3 and exposes no `ebur128`, `loudnorm`, or `astats` filter                           |

The current audio's existence and matching hashes do not establish artistic quality. Existing rejected review candidates remain `ARTISTIC FAIL`.

## Research And Reference Boundary

### Permitted observation

The reference is `Cloudbound Evening` at:

https://www.youtube.com/watch?v=cJvhJqgDbKI

It is a mood and product-function reference only. Permitted observations are abstract:

- low urgency;
- dark-evening warmth without threat;
- long, blended reverberant fields;
- sparse foreground gestures;
- restrained upper detail;
- minimal rhythmic activity;
- gradual density change rather than verse/chorus drama;
- space for attention rather than a foreground song.

### AI-assisted whole-track observation

The following reference map came from a whole-track AI-assisted YouTube observation and is `UNVERIFIED_AI_ASSISTED`. YouTube states that AI answers can vary, and the environment did not provide a retained reference waveform or a reproducible signal analysis:

| Reference region | Approximate observation                                |
| ---------------- | ------------------------------------------------------ |
| 0:00-0:30        | pad and drone establish the field                      |
| 0:30-1:00        | warmth and upper shimmer increase                      |
| 1:00-1:30        | bell-like or granular detail and width appear          |
| 1:30-2:00        | the ambient wash reaches its widest state              |
| 2:00-2:30        | a subordinate piano-like layer becomes more noticeable |
| 2:30-2:46        | the linear version fades                               |

Approximate whole-track presence estimates are pad 90%, drone 70%, shimmer 60%, piano 20%, and percussion 0%. These are design hypotheses, not transcription evidence.

### Forbidden operations

- Downloading, screen-recording, caching, decoding, or retaining the reference audio for production analysis.
- Sampling, stem separation, fingerprint matching, source separation, pitch tracking, MIDI extraction, score transcription, chord transcription, or waveform comparison.
- Reusing a recognizable phrase, melody contour, bass motion, chord sequence, signature voicing, exact instrument chain, or arrangement sequence.
- Training, prompting, or conditioning an audio generator with the reference recording.
- Calling the new work a cover, remix, arrangement, recreation, or replacement recording.
- Using “maximally similar” to justify copying protected expression. Similarity is limited to the abstract emotional and functional axes in this document.

### Independent-creation controls

- The R3 note set, harmonic fields, registral plan, timing, voicing, automation, and form are authored from this specification without reference audio in the production session.
- No melodic cell longer than three pitches is intentionally repeated as a foreground identity.
- No candidate is auditioned side-by-side against a locally captured reference.
- The provenance ledger records that the reference audio was not an input.
- The owner listening form includes a “recognizable reference phrase” rejection item.

## Emotional And Perceptual Target

The mix aims for these review ratings on a 1-5 owner scale:

| Attribute         | Target | Rejection signal                             |
| ----------------- | -----: | -------------------------------------------- |
| Calm              |    4.7 | urgency, tension, pulse, startling events    |
| Spaciousness      |    4.5 | cramped center, short room, dense foreground |
| Warmth            |    3.8 | sterile highs or sentimental lushness        |
| Brightness        |    1.8 | glassy, sharp, sparkling, alarm-like top end |
| Melodic salience  |    1.3 | memorable hook or singable foreground        |
| Drama             |    0.6 | cinematic rise, climax, drop, cadence        |
| Rhythmic activity |    0.2 | beat, ostinato, arpeggio, repeating bell     |
| Felt safety       |    4.5 | ominous sub, horror texture, unstable motion |

Qualitative target:

- calm and protected;
- dark, but not sad or ominous;
- airy, but with no audible wind, rain, static, hiss, or breathing;
- warm, but not sentimental;
- musical, but not a piano solo;
- changing slowly, but not empty or broken;
- suitable for low-volume background use, but not “spa”, lofi beat, fantasy soundtrack, or cinematic underscore.

## Composition Architecture

### Linear review master: 166 seconds

| Time      | Function       | Required behavior                                                                         |
| --------- | -------------- | ----------------------------------------------------------------------------------------- |
| 0:00-0:08 | safe entry     | stable harmonic cloud; only the linear review master receives a 150-300 ms safety fade-in |
| 0:08-0:30 | establish      | pad and centered drone, no foreground motif                                               |
| 0:30-0:55 | warm           | slow inner-voice and spectral-warmth change                                               |
| 0:55-1:10 | reveal         | first sparse shimmer details enter below attention                                        |
| 1:10-1:35 | widen          | side energy and tail density increase gradually                                           |
| 1:35-1:58 | broadest field | maximum spaciousness without a climax                                                     |
| 1:58-2:05 | clear space    | reduce upper detail to prepare contrast                                                   |
| 2:05-2:20 | piano window   | five to eight soft piano gestures, never a phrase-led solo                                |
| 2:20-2:30 | release        | piano tails decay; pad and drone remain                                                   |
| 2:30-2:46 | linear outro   | 16-second musical and gain fade; no new event                                             |

### Runtime loop: exactly 150 seconds

- Render separately from the same GarageBand session and composition source.
- Use no fade-in or fade-out at the file boundary.
- Finish all piano note-on events by approximately 2:18.
- Keep the final 12 seconds pad-only and compatible in harmony, level, spectral centroid, stereo image, and slope with the first 12 seconds.
- Preserve natural reverb continuity through a cyclic pre-roll/post-roll render, not by cutting tails at 2:30.
- Inspect boundaries at 150 and 300 seconds in a decoded triple-repeat render.
- Reject any click, image jump, room reset, bass discontinuity, reverb collapse, or perceptible restart.

The linear and loop renders may differ only in endpoint automation and the linear outro. Their note events and mix state through 2:30 remain traceably linked.

## Musical Language

- Nominal internal grid: 54-58 BPM.
- Audible beat: none.
- Audible meter: none.
- Percussion: none.
- Ostinato, arpeggiator, pulsing bass, side-chain pumping, ticking texture, and regularly spaced bells: prohibited.
- Harmony: original open and suspended fields with slowly changing common tones.
- Cadence: no dominant-to-tonic arrival and no emotionally conclusive ending inside the runtime loop.
- Foreground identity: no repeated four-note hook and no singable melody.
- Timing: note and automation offsets vary by approximately 0.4-1.2 seconds from the internal grid.
- Piano spacing: normally 7-18 seconds between gestures.
- Piano gestures: one to three notes, soft velocity, differing register and duration, no question-and-answer phrase.
- Tonal stability: enough common-tone continuity to feel safe; enough voicing drift to avoid a static frozen chord.

The exact original pitches and voicings belong in the implementation plan and generated MIDI receipt, not in this design document. This prevents a polished plan from being mistaken for a finished composition.

## Layer Contract

### Foundation pad

- Present for 90-100% of the work.
- Attack: 2.5-4.5 seconds.
- Release: 8-14 seconds.
- Core spectral area: approximately 220 Hz-1.8 kHz.
- Upper roll-off target: approximately 6.5-8.5 kHz.
- Slow timbral movement: approximately 0.03-0.09 Hz.
- Pitch drift: bounded to approximately +/-3-5 cents.
- No obvious chorus cycle, filter sweep, rhythmic tremolo, or “seasick” detuning.

### Drone

- Primary energy: approximately 90-280 Hz.
- High-pass protection: approximately 30-40 Hz.
- Energy below approximately 140-160 Hz remains near mono.
- Balance: approximately 8-12 dB below the foundation pad.
- Reject if the drone reads as machinery, aircraft, threat, pressure, or subwoofer test material.

### Shimmer

- First eligible entry: after 0:55.
- Highest activity: approximately 1:10-1:55.
- Balance: approximately 14-18 dB below the pad.
- Useful band: approximately 1.6-5.5 kHz with damping above approximately 7-9 kHz.
- Attack: approximately 30-120 ms.
- Decay: approximately 6-12 seconds.
- Events are irregular and non-melodic.
- Reject if it resembles the fūrin notification, a UI success cue, a doorbell, magic sparkle, alarm, or glass transient.

### Piano

- Eligible only after 2:00 in the linear form.
- Five to eight gestures total.
- Balance: approximately 12-16 dB below the pad.
- Source: a GarageBand sampled Steinway-class acoustic piano; the exact installed patch name and library version must be captured at render time.
- Performance: very soft velocity, rounded attack, no hard hammer noise.
- Image: centered and moderately narrow.
- Reverb return is more prominent than the dry attack.
- Reject if the owner follows the piano instead of the ambient field.

### Synthetic air

- Fully synthesized; no field recording, noise recording, breathing, wind, rain, surf, tape hiss, vinyl, or static source.
- Balance: approximately 22-28 dB below the pad.
- It may soften spectral gaps but must not be identifiable as a noise effect.

## GarageBand Hybrid Production Method

“Hybrid” means human-directed original composition data plus GarageBand software instruments and effects. It does not mean hybridizing the reference recording with generated audio.

1. Generate or hand-author one canonical first-party MIDI score and one canonical automation manifest.
2. Hash those sources before opening GarageBand.
3. Import the MIDI into a new R3 GarageBand project.
4. Use only playable GarageBand instruments and effects. Do not place Apple Loops, Live Loops, Drummer regions, stock audio phrases, or third-party audio files on the timeline.
5. Record the exact GarageBand version, build, macOS version, installed instrument patch names, plugin order, plugin settings, track gains, sends, pan, automation, project sample rate, and project-bundle SHA-256.
6. Freeze the composition before candidate mixing.
7. Create candidates 01-03 by changing only the approved mix-difference controls.
8. Export 48 kHz, 24-bit stereo WAV masters without normalization.
9. Export the 166-second review master and 150-second cyclic runtime master separately.
10. Encode delivery MP3s from the approved WAV using a documented, independently audited encoder path.

The canonical MIDI and automation must be deterministic. GarageBand render byte identity is a verification target, not an assumption: render twice and compare decoded audio metrics and hashes. If hashes differ, preserve both renders, identify metadata or stochastic-plugin causes, and do not claim byte-deterministic rendering.

## Candidate Strategy

All three candidates use the same notes, form, timing, instruments, effects, and base automation:

| Blind candidate | Only permitted difference                                               |
| --------------- | ----------------------------------------------------------------------- |
| 01              | darkest; pad dominant; least upper energy                               |
| 02              | approximately 1-1.5 dB more shimmer and slightly greater width          |
| 03              | approximately 1-1.5 dB more piano presence without changing note events |

Rules:

- Public review filenames expose only `candidate-01`, `candidate-02`, and `candidate-03`.
- A sealed machine-readable manifest maps blind ID to mix settings and SHA-256.
- Loudness-match candidates before owner comparison so “louder” does not win by bias.
- Candidate order is randomized in the review page or playlist.
- The owner chooses `01`, `02`, `03`, or `NONE`.
- If the result is `NONE`, change exactly one category in the next iteration: composition, instrument timbre, space, balance, or encoding. Do not change several categories and lose causal evidence.

## Reverb And Stereo Contract

- Main hall decay: approximately 6-9 seconds.
- Pre-delay: approximately 5-18 ms.
- Reverb low-cut: approximately 100-150 Hz.
- Reverb damping focus: approximately 3.5-5.5 kHz.
- Early reflections: quiet and non-roomy.
- Drone: centered.
- Pad: stable center plus slow side energy.
- Shimmer: approximately +/-25-55% pan range, irregular rather than ping-pong.
- Piano: moderately narrow and near center.
- Reverb tails: widest layer, with mono-safe dry anchors.

Reject:

- audible ping-pong delay;
- negative or unstable mono correlation;
- moving bass;
- “cathedral” shimmer;
- dramatic width automation;
- chorus-induced pitch nausea;
- a stereo image that collapses on phone or mono playback.

## Mastering And Delivery Contract

### Source master

- WAV, stereo, 48 kHz, 24-bit PCM.
- No normalization during export.
- No sample clipping or pinned sample runs.
- Provisional integrated loudness target: -24 +/-1 LUFS.
- Provisional true-peak ceiling: <= -2 dBTP.
- Provisional loudness range: 3-6 LU.
- No local level jump greater than approximately 2-3 dB unless the transition is perceptually masked and owner-approved.

These are restrained-background starting targets, not release proof. If physical-device listening shows that the existing runtime multiplier `0.18` makes the work lose body, preserve the source master and evaluate the app gain independently. Do not master aggressively merely to compensate for runtime gain.

### Delivery encode

- MP3, stereo, 44.1 kHz.
- Compare 160 kbit/s and 192 kbit/s encodes from the same approved WAV.
- Prefer 160 kbit/s only when blind listening and objective decode comparison reveal no material degradation.
- Target runtime size: <= 3.2 MB.
- If 192 kbit/s is required for quality and exceeds the size budget, stop for an explicit budget decision rather than hiding the increase.
- Capture encoder name, version, exact arguments/settings, gapless metadata behavior, file size, duration, and SHA-256.

### Metering limitation

The current bundled FFmpeg cannot decode the existing MP3 and lacks standards-compliant loudness filters. Therefore:

- `afinfo` metadata is valid only for container-format inspection;
- sample peak, RMS, or a locally approximated K-weighted value must not be labeled LUFS or dBTP;
- formal ITU-R BS.1770-5 loudness and true-peak results remain `UNVERIFIED` until an isolated conformant meter is approved and run;
- no package, Homebrew formula, binary, plugin, or dependency is installed without explicit owner approval of source and destination.

## Rights And Provenance

Apple's GarageBand support guidance expressly permits included loop content to be used in original compositions and audio projects, including distribution of those projects, while prohibiting standalone redistribution or repackaging of the loops:

https://support.apple.com/en-ca/102034

R3 uses no ready-made loop. The support page is not treated as complete clearance for every installed instrument patch. Before rendering, Gate 1 must also retain the exact GarageBand software license and library terms applicable to the installed sampled instruments. The instrument samples remain Apple-supplied, non-exclusive building material and are not claimed as a ZenFlow-owned sample library. Until those exact terms are captured, instrument-library license coverage remains `UNVERIFIED`.

The deliverable provenance ledger records:

- original composition author and owner direction;
- AI assistance limited to planning, source-code assistance, and diagnostic review;
- canonical MIDI SHA-256;
- automation-manifest SHA-256;
- GarageBand project SHA-256;
- GarageBand 10.4.14 build 6648 or the exact version actually used;
- macOS version;
- exact instrument and effect inventory;
- proof that no audio region, Apple Loop, third-party file, or reference file exists in the project;
- 48 kHz/24-bit WAV hashes;
- candidate mapping and hashes;
- encoder and settings;
- MP3 hashes;
- Apple license evidence URL and capture date;
- owner-selected candidate ID and exact approved hash;
- final production/public/docs/native package hash inventory.

The intended asset-specific notice remains:

`Copyright © 2026 Yehor212 / ZenFlow. All rights reserved.`

This notice covers only the original human-authored expressive contributions and resulting project/master to the extent permitted by applicable law. It does not claim exclusive ownership of GarageBand's sample library. Human-authorship sufficiency, copyrightability, non-infringement, and enforceability across jurisdictions remain `UNVERIFIED` pending qualified legal review. The U.S. Copyright Office's current AI copyrightability report is a governing research input, not legal advice:

https://www.copyright.gov/ai/

## Strict Audit Gates

### Gate 1: rights and provenance

Required PASS conditions:

- every source and candidate hash is present;
- no external audio file, reference capture, loop region, third-party sample, secret, or personal data is present;
- GarageBand version and instrument/effect inventory are recorded;
- candidate mapping is sealed before owner review;
- license evidence is retained;
- no production path contains an unapproved candidate.

Any missing origin or hash is `FAIL`, not “probably first-party”.

### Gate 2: decoded whole-timeline technical audit

Run against each decoded WAV master and each decoded delivery MP3:

- channel count, sample rate, bit depth/codec, duration, bitrate, and size;
- decode success from start to end;
- sample clipping, pinned samples, NaN/invalid data, and DC offset;
- formal LUFS, LRA, and dBTP only through a conformant BS.1770 meter;
- windowed RMS and peak trace across the full 166 or 150 seconds;
- silence, dropout, discontinuity, and unexpected onset inventory;
- spectral balance by section and excessive upper-band energy;
- low-frequency mono containment;
- stereo correlation and mono fold-down energy safety;
- transient ceiling and notification-like onset flags;
- start/end amplitude, slope, RMS, spectral, and stereo compatibility;
- triple-repeat seam analysis at 150 and 300 seconds;
- encoder delay/padding and browser gapless behavior;
- second-render source comparison;
- exact hash agreement across every copied or packaged artifact.

A single-file check cannot establish cross-platform packaging parity.

### Gate 3: AI diagnostic audit

CLAP, YAMNet, or a comparable local classifier may be used only as a triage instrument.

Positive diagnostic concepts:

- warm dark ambient;
- calm evening atmosphere;
- soft spacious pad;
- sparse subordinate piano;
- low urgency;
- relaxing background music.

Negative diagnostic concepts:

- piano solo;
- notification bell;
- alarm;
- wind;
- rain;
- static;
- voice;
- breathing;
- drums;
- horror ambience;
- dramatic riser;
- cinematic climax.

The diagnostic must inspect windows across the full file, publish model/version/configuration, show raw scores, and report instability. The current AI auditor is `TRIAL_ONLY_NOT_ADMITTED`. It can reject or prioritize review; it cannot approve pleasure, relaxation, originality, culture fit, or release.

### Gate 4: owner artistic audit

The owner reviews the complete 166-second linear candidates:

- once on headphones;
- once on a built-in phone or laptop speaker;
- at low and normal comfortable volume;
- with candidate identities blinded and loudness matched;
- with a 15-minute repeated-listening fatigue check;
- with the final loop repeated at least three times.

The review form records:

- calm, spaciousness, warmth, brightness, melodic salience, drama, rhythm, and safety ratings;
- whether piano became foreground;
- whether shimmer resembled a notification;
- whether any wind, rain, breath, hiss, or static was perceived;
- whether any passage felt sad, anxious, cinematic, ominous, empty, or broken;
- whether any phrase seemed recognizable from the reference;
- whether the phone speaker lost warmth or body;
- whether any seam was heard;
- candidate choice `01`, `02`, `03`, or `NONE`;
- reviewed SHA-256.

Only this hash-bound response may create `OWNER_ARTISTIC_PASS`. AI confidence, technical PASS, or the assistant's listening description cannot substitute for it.

### Gate 5: runtime and package audit

After owner approval and only after a test-first implementation plan:

- Web/Vite: local playback, visible blocked/resume/error state, mute/volume, navigation persistence, and no startup fetch before intent.
- Installed PWA: verified full-200 cache admission, immutable revision/hash, offline playback after cache, Range behavior only from a verified full body, and stale-cache rejection.
- Android/Capacitor: exact bundled hash, emulator semantic interaction, lifecycle and logcat evidence, and no fūrin notification regression.
- iOS/WKWebView: exact bundled hash, gesture unlock/resume, lifecycle, and simulator/build evidence when available.
- Desktop/Tauri: exact bundled hash, sidebar behavior, package inventory, and runtime evidence when available.
- Runtime loop: no audible seam over three repeats on each exercised engine.
- Long-audio ownership: Cloudlight never overlaps auth, Orb, Diary, or Hyperfocus ambience.
- Preference: first-ever off; later opt-in attempts resume only as platform policy permits.
- Accessibility: visible state, native button semantics, keyboard/touch access, screen-reader name, and no sound-only meaning.

An Android emulator does not prove physical speaker acoustics, Bluetooth routing, OEM audio focus, interruption handling, or fatigue.

## Kill Criteria

Any one of these rejects a candidate:

- foreground or singable piano;
- recognizable hook or repeated four-note identity;
- audible pulse, arpeggio, beat, or pumping;
- shimmer that resembles notification, fūrin, alarm, or UI feedback;
- wind, rain, breathing, hiss, static, voice, field recording, or obvious noise bed;
- sad, anxious, ominous, horror, sentimental, spa, lofi, or cinematic reading;
- sharp transient or bright glass edge;
- empty/broken opening;
- phone-speaker loss of body;
- mono cancellation or unstable low end;
- any audible loop seam or room reset;
- missing provenance or source hash;
- AI output presented as human approval;
- production promotion without the exact owner-approved SHA-256.

## Integration Boundary

R3 does not redesign the player.

- Preserve the current streaming `<audio loop>` path as the first implementation choice.
- Use an `AudioBufferSourceNode` fallback only if runtime evidence proves the media-element path cannot meet the seam contract. A decoded 150-second stereo buffer can consume tens of megabytes, so memory cost must be measured first.
- Preserve the current `0.18` runtime multiplier until device evidence justifies a separately reviewed change.
- Preserve on-demand cache admission, first-ever off, visible resume behavior, Media Session handling, lifecycle handling, and the long-audio coordinator.
- Preserve notification, Hyperfocus, auth, Orb, Diary, feedback, and haptic asset families.
- Do not touch UI placement, copy, or settings unless a failing integration test proves an R3-specific change is necessary.

Likely future implementation surfaces, subject to the implementation plan:

- deterministic MIDI and automation source;
- GarageBand project and render receipts;
- candidate generator/auditor tooling and focused tests;
- `package.json` task wiring;
- `scripts/check-app-audio-assets.cjs` thresholds and provenance assertions;
- Cloudlight license and product-operations documents;
- owner review manifest;
- approved `public` and `docs` MP3 copies;
- cache revision and size/hash contracts;
- Capacitor and Tauri package-hash evidence.

This list is not authority to edit all listed files. The implementation plan must name the smallest exact path set.

## Platform And Quality Matrix

| Surface              | Design status | Required evidence before PASS                                                                               |
| -------------------- | ------------- | ----------------------------------------------------------------------------------------------------------- |
| Web/Vite             | UNVERIFIED    | focused tests, production build, browser media/network/console proof                                        |
| Installed PWA        | UNVERIFIED    | full-body hash cache test, offline/Range proof, stale-revision proof                                        |
| Android              | UNVERIFIED    | Capacitor sync, APK inventory, emulator semantic flow, lifecycle/logcat; physical acoustics remain separate |
| iOS                  | UNVERIFIED    | Capacitor sync, Xcode/simulator proof where available, gesture/lifecycle; physical routing remains separate |
| Desktop/Tauri        | UNVERIFIED    | frontend/build/package inventory and runtime proof where available                                          |
| Store/Release        | UNVERIFIED    | signed artifacts, console state, review, publication, and public delivery are independent                   |
| Accessibility        | UNVERIFIED    | visible control status and no sound-only meaning; no UI change is currently authorized                      |
| Performance          | UNVERIFIED    | startup/network/memory trace, one media element, no eager decode, asset-size budget                         |
| Security And Privacy | UNVERIFIED    | local same-origin asset only, no PII, no secret, no remote stream, no new dependency, scoped scan           |
| Testing              | UNVERIFIED    | RED characterization, focused GREEN, broader audio/lifecycle/cache/package regression                       |
| Operations           | UNVERIFIED    | provenance ledger, exact rollback, review receipt, release notes, owner handoff                             |

## Phased Delivery

### Phase 0: baseline freeze

- Record current Git state and classify inherited dirty files.
- Hash current production and deploy copies.
- Capture current player, cache, manifest, and package contracts.
- Verify the candidate workspace is outside production paths.

Acceptance: exact old hashes and rollback targets exist; no production byte changed.

### Phase 1: composition source

- Create deterministic original MIDI and automation.
- Add source-focused tests for duration, event density, prohibited repetition, piano window, note spacing, and cyclic pad endpoints.
- Record human authorship and reference-boundary receipts.

Acceptance: source checks pass and no external audio input exists.

### Phase 2: GarageBand rendering

- Build the GarageBand project with approved instruments and effects.
- Freeze the project and environment inventory.
- Export WAV candidate masters and both duration forms.
- Run second-render reproducibility checks.

Acceptance: three blind candidates differ only in the declared mix controls.

### Phase 3: strict audit

- Run rights/provenance, decoded signal, seam, mono, full-timeline, and AI-diagnostic checks.
- Encode and compare 160/192 kbit/s delivery variants.
- Produce a review manifest and concise listening packet.

Acceptance: no technical or provenance FAIL; formal unsupported measurements remain visibly `UNVERIFIED`.

### Phase 4: owner selection

- Present the three blind linear candidates and their exact hashes.
- Run owner listening and fatigue protocol.
- Record `01`, `02`, `03`, or `NONE`.

Acceptance: `OWNER_ARTISTIC_PASS` exists only for one exact hash, or all candidates remain rejected.

### Phase 5: runtime-loop mastering

- Finalize the corresponding 150-second cyclic master and delivery encode.
- Run triple-repeat and codec seam checks.
- Return the exact loop to the owner if the runtime encode materially differs from the reviewed master.

Acceptance: owner-selected lineage, technical gates, and loop hash are bound.

### Phase 6: test-first integration

- Add RED tests for manifest, hash, cache revision, asset size, decode metrics, and preservation of unrelated sound families.
- Replace only the approved production/deploy bytes and required contracts.
- Run focused GREEN and blast-radius checks.

Acceptance: all changed contracts pass without weakening thresholds.

### Phase 7: platform and release handoff

- Sync and build only authorized platforms.
- Verify exact packaged hashes and runtime behavior.
- Keep store, deploy, Telegram, and release states separate.

Acceptance: each surface has direct evidence or an exact `UNVERIFIED` reason. No push, deploy, store action, or Telegram write occurs without the relevant authorization and authenticated target.

## Rollback

Rollback restores:

- `public/sounds/cloudlight-evening-loop.mp3` to SHA-256 `d096c668ef6471f855b49c93bc5509ccbd63ac1fb93dc9af96ba3c7c9e65be40`;
- `docs/sounds/cloudlight-evening-loop.mp3` to the same SHA-256;
- the previous audio manifest size/hash and deterministic-spec values;
- the previous runtime-audio cache revision and package expectations;
- any R3-specific source, tests, receipts, or docs through a reviewable follow-up commit.

Then rerun focused audio checks, Web build, Capacitor sync/package checks for any platform touched, Tauri checks where touched, and exact installed/package hash comparison.

Rejected candidates and their audit evidence are retained outside production paths. Rollback does not delete evidence, reset unrelated work, rewrite history, or clean the worktree.

## Non-Goals

- No notification-sound change.
- No Hyperfocus sound change.
- No auth, Orb, or Diary ambience change.
- No UI or sidebar redesign.
- No autoplay-policy expansion.
- No reference cover, interpolation, transcription, sound-alike recording, or sampled use.
- No third-party or generative-audio service.
- No new paid tool, production dependency, or runtime audio generator.
- No push, PR, merge, deployment, store publication, or Telegram send in the design phase.
- No claim of medical benefit, guaranteed relaxation, universal pleasantness, legal clearance, or release readiness.

## Acceptance Criteria

The design is ready for implementation planning only when:

- the owner reviews this exact written document and explicitly approves it;
- the relationship to the existing global Cloudlight design is unambiguous;
- explicit and implied requirements, non-goals, kill criteria, rollback, and platform proof boundaries are present;
- the reference boundary prohibits copied protected expression;
- the 166-second linear and 150-second loop forms are internally consistent;
- candidate differences are bounded and blind;
- unsupported BS.1770 metering is not presented as PASS;
- AI audit remains diagnostic and owner approval remains human and hash-bound;
- no production asset or unrelated sound family changed during specification.

Implementation is complete only later, when one owner-approved hash passes the applicable technical, provenance, runtime, package, and platform gates. A written specification alone is not implementation.

## Stop Conditions

Stop and request owner direction if:

- the owner wants a recognizable melody, phrase, harmony, or arrangement from the reference;
- GarageBand requires a paid download, license change, account change, or third-party plugin;
- the installed instrument/library provenance cannot be recorded;
- a standards-compliant meter requires unapproved installation;
- candidate quality requires changing composition after blind mix comparison;
- 192 kbit/s is required but violates the approved size budget;
- the media-element loop cannot meet the seam contract and a memory-heavy decode path is proposed;
- another agent modifies an overlapping production, manifest, cache, or package path before integration;
- the current production hash no longer matches the frozen baseline;
- owner listening returns `NONE`.

## UNVERIFIED Ledger

- No R3 MIDI, automation, GarageBand project, WAV, MP3, candidate, or new sound exists yet.
- The written specification has not yet received owner review after being committed.
- The AI-assisted reference timeline is not reproducible signal analysis.
- No reference audio was retained, so exact production characteristics are intentionally unknown.
- The existing dirty R3/v2 scripts have not been adopted, rejected, or committed by this document step.
- Formal ITU-R BS.1770-5 LUFS/LRA/dBTP measurement is unavailable in the current bundled FFmpeg environment.
- GarageBand instrument-library completeness and exact patch identity are not yet captured.
- The exact installed GarageBand license and sampled-instrument library terms are not yet retained, so the Apple Support page alone is not a complete rights PASS.
- Human-authorship sufficiency, non-infringement, copyrightability, and enforceability are not legal PASS.
- Pleasantness, calm, fatigue, cultural fit, non-resemblance, and `AUDIO_FIT` have no human PASS.
- Web/PWA/Android/iOS/Desktop runtime behavior for R3 is not tested.
- Physical phone speakers, headphones, Bluetooth, interruptions, audio focus, and OEM behavior are not tested.
- No production asset, native package, signed artifact, public deployment, store state, Telegram message, or release was changed or verified.

## Primary Standards And Sources

- Apple Support, GarageBand audio-content use: https://support.apple.com/en-ca/102034
- U.S. Copyright Office, Copyright and Artificial Intelligence: https://www.copyright.gov/ai/
- ITU-R BS.1770-5, programme loudness and true-peak measurement: https://www.itu.int/rec/R-REC-BS.1770-5-202311-I
- ITU-R BS.1534-3, MUSHRA subjective audio assessment: https://www.itu.int/rec/R-REC-BS.1534
- W3C Web Audio API: https://www.w3.org/TR/webaudio/
- ZenFlow workspace, no-template, best-practices, test-first, completion, audio-operations, and non-Hyperfocus sound policies in this repository

## Completeness Check

- Goal and non-goals: covered.
- Existing architecture and conflicting predecessor contracts: covered.
- Originality, rights, human authorship, and license limitations: covered with legal status `UNVERIFIED`.
- Full 166-second form and 150-second loop: covered.
- Instrument, mix, reverb, stereo, mastering, encoding, and size constraints: covered.
- Objective, AI-diagnostic, human, runtime, package, and platform gates: covered.
- Accessibility, privacy, performance, caching, operations, rollback, and cross-platform proof: covered.
- Blocking product decision: none before written owner review.
- Next allowed action: owner review of this exact specification; after approval, create the implementation plan.
