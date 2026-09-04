# Research Decisions

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
