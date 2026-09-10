# Research Decisions

## 2026-09-09: Focus, Transport And Fireplace Approval

The owner approved US5/US6 at 23:45:01Z, following direct rejection of the fire at 23:30. Current `PlanningPage.tsx` mounts the overview, modes, bridges, schedule, review and Focus together and calculates a minute-based model; only the Focus host should remain reachable from navigation. Preserve the inactive workspace module and its existing behavior tests, not stored-data deletion or a runtime feature flag. `BackgroundMusicToggle.tsx` is currently one icon and the hook has only natural-end advancement; manual next/previous needs distinct paused-intent and race handling rather than calling the end handler.

ACE-Step's official musicians guide describes music generation, not verified environmental SFX support: https://ace-step.github.io/ACE-Step-1.5/en/ace_step_musicians_guide . The installed source revision is `dce621408bee8c31b4fcf4811682eb9359e1bc94`; the retained model revision is `19671f406d603126926c1b7e2adc169acbcade22`. One local 30-second trial is permitted with offline flags, no imported audio, no LoRA and no language model. Suitability and human approval remain UNVERIFIED until actual assessment. Existing fire assets are source-licensed recordings, but the owner's audible rejection invalidates perceived-quality acceptance; their successful decode is not a realism score.

Alternatives rejected: auto-enabling from skip controls; two-decoder crossfade; overwriting saved volume; using noise synthesis as a fireplace fallback; applying signal gain to R7; substituting AI output without listening. A small future-feature hint is optional and can be omitted if it adds clutter or an unsupported promise.

## 2026-09-09: Recover The Actual Selected Originals

**Decision**: Replace the substitute collection with the exact ten R7 review MP3s retained in `cloudbound-original-r7-soft-japanese-10`; no generation or audio transformation. This supersedes Decisions 1 and 2 for music only.

**Evidence**: The retained master receipt contains ten unique MP3 hashes, ten WAV hashes and ten source FLAC hashes; all thirty files independently matched on 2026-09-09. Current runtime contained none of the ten MP3 hashes. The source run receipt records local ACE-Step text-to-music with no imported reference audio. The Hyperfocus `runtime-masters-v2` pack contains eighteen MP3s already byte-identical to the current runtime files.

**Alternatives rejected**: Regeneration or re-encoding changes the selected recordings; renaming substitutes does not restore them; adding R6 Rainlit Chamber would make eleven tracks. Recopying identical nature files does not diagnose a playback-access problem. Owner selection is recorded separately from formal device/headphone listening and legal clearance.

Decisions 1–2 below describe the superseded September 2 investigation, not the current availability of originals.

## Decision 1: Reconstruct The Remembered Set As Ten First-Party Masters

**Decision**: Keep the current approved Cloudlight master and generate nine new original pieces from deterministic numerical composition specifications.

**Rationale**: Current `main` contains nine non-Hyperfocus files but only one is long-form music; the other eight have ambience or cue roles. The former R3 workspace retained one composition and three mix definitions, not ten publishable masters. The disputed downloaded recording is byte-identical to the reference after decode and lacks redistribution evidence, so it remains excluded.

**Alternatives considered**: Treating all nine existing files as music was rejected because it would repurpose cues and feature-specific ambience. Recovering exact old files is not currently possible because no approved ten-master set exists on disk. Shipping one track only does not satisfy the selected option.

## Decision 2: Reuse The Existing Deterministic Synthesis Boundary

**Decision**: Extend `scripts/generate-non-hyperfocus-audio.cjs` with data-driven music specifications, additive soft-piano/plucked-glass/pad voices, fixed seeded timing, circular loop mastering, and exact provenance output.

**Rationale**: This preserves the existing clean-room, no-sample, reproducible workflow and avoids a new encoder or runtime dependency. The composition family uses sparse timing, open intervals, restrained pentatonic colour, and silence as high-level design vocabulary without copying a reference melody or harmony.

**Alternatives considered**: Stock or CC audio adds rights/source dependency and was not requested. Generative-audio services add external publication, uncertain licenses, cost, and non-determinism. GarageBand rendering would require a manual ten-project evidence workflow and is not available as an automated reproducible release input here.

## Decision 3: One Global Playback Owner And One Media Element

**Decision**: Mount the existing provider above `AuthGate`, expose the same controller to account entry and navigation, and use one media element that advances through a stable collection order with a short fade-out/switch/fade-in boundary.

**Rationale**: One element minimizes WebView decoder/memory pressure and guarantees that auth completion cannot produce two audible owners. The existing coordinator, foreground lifecycle, master volume, comfort settings, Media Session, and autoplay recovery remain authoritative.

**Alternatives considered**: Two-player crossfade was rejected because overlapping decoders increase mobile resource pressure. Independent auth and navigation players were rejected because their ownership and persistence could diverge. A native background service is outside the requested foreground-only experience.

## Decision 4: First-Run Silence And Intent-Bound Cache

**Decision**: Keep the first-ever preference off, start only from the icon, and integrity-cache only the selected and next master after intent.

**Rationale**: This protects screen-reader use and complies with the product's existing audio policy. It also prevents ten long files from entering startup work or PWA install cache.

**Alternatives considered**: Audible autoplay and full-album precache were rejected for accessibility, browser policy, startup, storage, and offline-quota reasons.

## Decision 5: One Icon-Only Component Across Four Presentations

**Decision**: Extend `BackgroundMusicToggle` with `auth`, `sidebar-expanded`, `sidebar-collapsed`, and `drawer` presentations that all render a single icon-only button with no visible label or native title tooltip.

**Rationale**: Reusing one control keeps state and accessibility semantics identical. The visible state uses sound-off, loading, playing, and unavailable icon treatment; localized names and status remain available to assistive technology.

**Alternatives considered**: Keeping visible menu text violates the request. Creating a second auth-specific component duplicates state and error logic. Removing accessible naming would make the control unusable for screen readers.

## Decision 6: Atomic Theme Commit Plus A Compositor-Only Veil

**Decision**: Capture the pre-change background colour, persist the request, commit the new theme atomically, then fade one pointer-transparent solid/gradient veil over 260-300 ms. Skip the veil for reduced motion and cancel stale sessions on rapid changes.

**Rationale**: The user perceives a soft handoff while text and surface contrast never interpolate through invalid states. Only opacity is animated; no blur, backdrop filter, captured page image, or per-element transition is introduced. The Android drawer's existing transition suppression remains active under the veil.

**Alternatives considered**: Root View Transitions capture old/new snapshots and were rejected because ZenFlow's heavy WebView/canvas path previously suffered incomplete drawing under compositor pressure. Global CSS colour transitions repaint many elements. A blurred overlay violates the Android layer budget.

## Decision 7: Performance Acceptance Is Action-Bound

**Decision**: Capture a before and after theme journey with the same emulator, APK identity, theme sequence, UI-tree-derived inputs, and separate visual versus CDP-off performance passes.

**Rationale**: A screenshot cannot prove motion. The accepted run requires visible feedback within 100 ms, no theme-window presentation gap over 103 ms, no tile-memory/context-loss signal, and no raster loss in ten round trips.

**Alternatives considered**: Build success, UI-tree reachability, encoded-video frame rate, or a single screenshot cannot establish smoothness.

## Decision 8: Internal Testing Is A Fail-Closed Release Gate

**Decision**: Merge through required PR checks, inspect the Play Console maximum version code, bump above it, build with the existing authorized upload identity, upload the exact AAB only to Internal testing, and obtain action-time confirmation before rollout.

**Rationale**: Internal testing is the least broad release target and was explicitly approved. Artifact identity, signing, audio approval, and required checks remain separate gates.

**Alternatives considered**: Production, Open, Closed, Internal App Sharing, debug signing, or a newly invented upload key are outside the approved release contract.
