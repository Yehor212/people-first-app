# Feature Specification: Calm Music Collection And Soft Theme Change

**Feature Branch**: `codex/japanese-audio-theme-transition-20260902`

**Created**: 2026-09-02

**Status**: Approved for implementation

**Production amendment, 2026-09-10**: The owner approved the three exact PagDev fireplace pilots, the separately proposed 128 MiB PDI work budget, and Android release to all users at `2026-09-10T01:50:52Z`. The current release target is Google Play Production at 100%; this supersedes US3's historical Internal testing-only audience, without waiving its technical, CI, identity, signing, provenance or honest-review conditions. Existing Focus/transport and R7 scope is retained. `plan.md` and `contracts/android-internal-release.md` define execution and release boundaries; `docs/audio/fireplace-pagdev-provenance.json` binds the selected files. No undocumented listening context is asserted.

**Restoration amendment, 2026-09-09**: The owner identified the original R7 ten-track review set and explicitly requested that all ten replace the current substitute collection, plus recovery of the Hyperfocus nature sounds. This amendment changes audio selection and audibility only; previous theme, authentication, and release work is not reopened. Implementation continues in the existing locked `codex/android-103ms-20260904` lane.

**Input**: User description: "Create roughly ten calm Japanese-vibe music pieces, play them from the account-entry and navigation-menu surfaces through an icon-only sound control, make light/dark changes soft instead of jumpy, verify sound and music in the Android emulator, commit and merge to main, and prepare a Google Play pre-release without mock data."

## User Scenarios & Testing

### User Story 1 - Start Calm Music From Entry Or Navigation (Priority: P1)

A person can start or stop a collection of ten calm original ZenFlow music pieces from either the account-entry screen or the navigation menu without reading a visible music label. The same playback session continues across account completion and normal navigation rather than restarting or overlapping.

**Why this priority**: Music is the requested primary experience, and a single continuous owner prevents confusing duplicate audio during the most important transition into the app.

**Independent Test**: Begin signed out with music off, activate the sound icon, authenticate or enter the app, open the navigation menu, and observe continuous single-owner playback plus a matching icon state.

**Acceptance Scenarios**:

1. **Given** a first-time or explicitly disabled listener, **When** the account-entry screen opens, **Then** no audible music starts until the listener activates the sound icon.
2. **Given** music is enabled and playing on account entry, **When** the person completes account entry and opens the navigation menu, **Then** playback continues without restarting, doubling, or changing volume unexpectedly.
3. **Given** music is playing, **When** the sound icon is activated on either supported surface, **Then** playback stops and every instance of the control reflects the stopped state.
4. **Given** the saved music preference is enabled, **When** a later foreground app session permits playback, **Then** the collection resumes; if the platform blocks playback, the next eligible user gesture resumes it without claiming success early.
5. **Given** another long ZenFlow ambience takes ownership, **When** it starts, **Then** the music yields and resumes only after ownership becomes available and the saved preference still permits it.

---

### User Story 2 - Experience A Soft Theme Change (Priority: P1)

A person switching between light and dark appearance sees one calm, brief transition instead of a hard visual jump, blank region, partially drawn drawer, or long input stall.

**Why this priority**: The existing abrupt switch was retained to avoid an Android rendering failure, so the replacement must improve perceived softness without reintroducing the more serious raster defect.

**Independent Test**: Repeatedly switch light to dark and dark to light from account entry, navigation, and Settings while preserving readable content and measuring the same Android interaction window.

**Acceptance Scenarios**:

1. **Given** normal motion is allowed, **When** the person changes light or dark appearance, **Then** a single soft transition settles within 300 milliseconds and the chosen theme remains persisted.
2. **Given** reduced motion is requested, **When** the theme changes, **Then** the theme commits immediately with no animated veil and no loss of information.
3. **Given** a navigation drawer is open on Android, **When** the theme changes, **Then** text and surfaces never enter a low-contrast intermediate palette and the drawer remains fully drawn.
4. **Given** repeated rapid theme requests, **When** the previous transition has not settled, **Then** the latest selection wins without stacked overlays, stale timers, flicker, or blocked input.
5. **Given** preference persistence fails, **When** a theme is requested, **Then** the previous theme remains active and the existing failure explanation remains available.

---

### User Story 3 - Receive A Traceable Internal Android Build (Priority: P2)

The owner receives an Android App Bundle built from the exact merged main commit and prepared only for Google Play Internal testing after the ten exact music masters have been reviewed.

**Why this priority**: Store upload is valuable only after the experience, rights evidence, signing identity, and artifact provenance are trustworthy.

**Independent Test**: Trace the merged commit to the signed bundle, verify its unique version code and installed delivery artifact, then observe the same release in the Internal testing track without promoting it to Production.

**Acceptance Scenarios**:

1. **Given** all local and CI gates pass and the owner approves the ten exact music hashes, **When** the release bundle is built, **Then** it is signed with the existing authorized upload identity and carries a version code higher than every uploaded compatible build.
2. **Given** the exact bundle is ready, **When** it is uploaded, **Then** it is assigned only to Internal testing and remains absent from Production.
3. **Given** signing credentials, Play access, owner audio approval, or a required check is unavailable, **When** release preparation reaches that gate, **Then** the upload stops with an explicit UNVERIFIED or FAIL status rather than substituting a debug key or unreviewed asset.

### User Story 4 - Hear The Selected Originals And Nature Sounds (Priority: P1)

The listener hears the ten R7 compositions previously selected, not a newly generated approximation. Hyperfocus offers forest, rain, ocean, fireplace, river, and wind, each at Soft, Deep, and Intense levels.

**Independent Test**: Activate music and traverse all ten original recordings; select each of the eighteen nature variants in the existing Hyperfocus flow. Compare the played files to the retained originals and keep personal focus history untouched during verification.

**Acceptance Scenarios**:

1. **Given** an upgrade from the former collection, **When** music is enabled, **Then** only Shoji Rain, Moss Garden, Lantern Reflection, Snow Over Cedar, Paper Cranes, Tea Room Dawn, River Stones, Camellia Evening, Temple Path, and Home Beneath Clouds play in that order.
2. **Given** the selected master volume, **When** a mastered R7 recording plays, **Then** no additional fixed music attenuation is applied; mute, zero volume, comfort restrictions, and foreground-only playback remain effective.
3. **Given** any nature family and level, **When** the listener deliberately starts that sound, **Then** the corresponding original recording plays with a truthful loading/playing/error state and no overlapping music.
4. **Given** a retained original already present in the app, **When** restoration is performed, **Then** it is verified and kept byte-identical rather than regenerated or duplicated.

### User Story 5 - Focus-Only Planning (Priority: P1)

Approved by the owner at 2026-09-09T23:45:01Z: Planning exposes only the existing Focus timer and its Hyperfocus entry. Hide non-focus UI without deleting schedule, habit, mood or focus data. An optional small noninteractive future-feature hint must not promise a date.

**Independent Test**: Render with existing test records, verify absent overview/modes/schedule/review/bridges and zero render-triggered writes; preserve Focus completion/minute callbacks, loading, Hyperfocus entry and RTL/safe-area behavior.

**Acceptance Scenarios**:

1. Hidden workspace sections are absent from visual/accessibility trees and do not run their periodic/model computation.
2. Existing Focus/Hyperfocus single-timer, reflection and completion flows remain functional; obsolete planning-date URLs do not alter stored records.
3. Mobile safe areas, ar/he and desktop width keep the focused layout usable without an empty schedule column.

### User Story 6 - Manual Music Transport And A Convincing Hearth (Priority: P1)

The same owner approval requests previous/next music controls in navigation and a new fireplace. ACE-Step is authorized only as a feasibility trial; actual environmental suitability is not assumed. All ten R7 originals, other fifteen nature files and current system volumes remain unchanged.

**Independent Test**: Traverse all ten R7 IDs both ways while playing/off/muted/paused and with another owner; race rapid requests and errors. Separately audition an exact-hash fireplace pilot before runtime integration.

**Acceptance Scenarios**:

1. Previous/next wrap, persist the chosen cursor and leave the drawer open; auth retains its single sound-state button.
2. Off/paused/blocked/muted/Hyperfocus selection stays silent. Explicit play can resume; stale play results and rapid selection cannot revive an old track, steal ownership or pause a newer successful one.
3. One decoder, cancellable short fades, bounded errors, eight-locale accessible labels and owner-bound system transport work without new permissions/dependencies.
4. Fireplace sounds like an indoor wood hearth at three distinct activity levels, not gain-only copies. Exact provenance, unclipped decode, loop/transient checks and direct hash-bound human audition are required; metrics or generation success alone do not prove realism.

### Edge Cases

- One or more music files are missing, truncated, corrupt, silent, clipped, incorrectly encoded, or fail their declared hash.
- Playback is requested while master audio is muted, ambient comfort is disabled, the app is backgrounded, the device receives a call, or another long audio owner is active.
- The current or next music file cannot decode; the player skips only within a bounded attempt count and never loops endlessly through failures.
- The listener closes and reopens the app during a track change, or signs in while playback is loading.
- The platform exposes no autoplay capability until a user gesture.
- The device is offline before any track has been cached, or storage quota prevents caching the next track.
- The theme changes while the drawer, keyboard, modal, or a heavy animated background is present.
- The operating-system theme changes while the app preference follows the system.
- Text scale, long translations, and right-to-left layout must not reduce the icon touch target or move it into an unsafe area.
- A new bundle version code conflicts with an artifact already present in Play Console.
- The authorized upload key is missing or differs from the Play-registered upload certificate.

## Requirements

### Functional Requirements

- **FR-001**: The product MUST ship exactly ten distinct long-form ZenFlow music masters in the approved collection.
- **FR-002**: The collection MUST contain exactly the ten owner-selected R7 originals named in US4, replacing all ten former procedural music pieces.
- **FR-003**: Restoration MUST reuse the retained R7 recordings unchanged, with their actual local ACE-Step generation provenance. No new generation, third-party sample, reference recording, quarantined recording, or unverified substitute is admitted. This owner-selected R7 set replaces the former procedural-only music requirement; the existing non-music synthesis boundary remains unchanged.
- **FR-004**: Every music master MUST have a file-bound provenance record, exact byte size, duration, encoding properties, and SHA-256 digest.
- **FR-005**: The disputed `Zenflow.m4a` and every recording derived from the unlicensed Cloudbound reference MUST remain excluded from runtime, bundles, review packets, and store artifacts.
- **FR-006**: The owner MUST review and approve every exact music-master hash before a store upload containing that collection.
- **FR-007**: Music MUST be off for a listener who has never explicitly enabled it.
- **FR-008**: One device-local preference MUST control music from account entry and authenticated navigation without requiring an account or syncing the preference as user content.
- **FR-009**: The product MUST expose the music control on account entry, expanded navigation, collapsed navigation, and the mobile drawer.
- **FR-010**: The music control MUST display only a sound-state icon; it MUST NOT display a visible label, status sentence, track name, or hover tooltip.
- **FR-011**: The icon-only control MUST retain a localized accessible name, programmatic pressed/busy state, keyboard support, visible focus, and a minimum 44-pixel target; mobile entry and drawer targets MUST be at least 48 pixels.
- **FR-012**: The product MUST maintain at most one active long-audio owner and MUST prevent overlapping copies of the music collection.
- **FR-013**: Playback MUST continue across account completion and navigation without an avoidable restart.
- **FR-014**: The collection MUST advance in a stable sequence and soften track boundaries without overlapping long-audio decoders.
- **FR-015**: Playback MUST respect the master mute, volume, ambient-comfort preference, foreground/background lifecycle, platform autoplay rules, interruptions, and competing long-audio ownership.
- **FR-016**: A blocked playback request MUST remain truthful and retry only after an eligible user gesture or explicit control action.
- **FR-017**: Media errors MUST use bounded recovery, skip a failing item when another verified master is available, and stop in an explicit error state when the collection cannot continue.
- **FR-018**: Offline caching MUST begin only after music intent and MUST verify complete same-origin bodies against the declared size, media type, and SHA-256 before reuse.
- **FR-019**: Startup MUST NOT preload all ten long tracks; only the active and next required masters may be prepared after user intent.
- **FR-020**: Switching between light and dark themes MUST use one bounded, input-transparent transition layer while committing the final theme atomically.
- **FR-021**: The transition MUST NOT use blur, backdrop filtering, a full-page captured snapshot, simultaneous per-element palette interpolation, or a second visual design.
- **FR-022**: The transition MUST finish within 300 milliseconds under normal motion and MUST be skipped under reduced motion.
- **FR-023**: Rapid theme requests MUST cancel stale transition work and converge on the latest persisted choice.
- **FR-024**: The existing Android drawer contrast protection MUST remain until the replacement passes fresh raster and frame-timing evidence.
- **FR-025**: Theme changes MUST preserve account-entry state, drafts, focus, drawer ownership, safe areas, system bars, and existing storage-failure recovery.
- **FR-026**: Production runtime MUST contain no mock, demo, sample, placeholder, or fallback business records.
- **FR-027**: User-facing behavior MUST be evaluated separately for Web/Vite, installed PWA, Android/Capacitor, iOS/WKWebView, and Desktop/Tauri.
- **FR-028**: The Android release MUST increment the version code only after inspecting the current Play Console maximum and MUST preserve forward-only schema compatibility.
- **FR-029**: The Android bundle MUST use the existing authorized upload identity; a debug key or newly invented replacement key MUST NOT be used for a testing-track update.
- **FR-030**: The release MUST target Google Play Internal testing only; Production, Open testing, Closed testing, and staged production rollout remain out of scope.
- **FR-031**: The exact source commit, source bundle hash, signing certificate, uploaded artifact, track, and resulting Play Console release state MUST be recorded without exposing credentials.
- **FR-032**: Every required failed or unavailable verification MUST remain visible as FAIL or UNVERIFIED and MUST block the corresponding completion or release claim.
- **FR-033**: Telegram OAuth initiated in the installed Android app MUST return through `com.zenflow.app://login-callback` to `com.zenflow.app/.MainActivity`; a GitHub Pages or PWA destination is a failed native login even when the provider session succeeds.
- **FR-034**: Native OAuth redirect admission MUST include the attempt-bound `zenflowAuthAttempt` query shape without removing the PKCE owner selector, broadening the callback to an unrelated host, or replacing unrelated hosted redirect entries.
- **FR-035**: Telegram readiness MUST report provider discovery, hosted allow-list readback, completed provider login, Android callback reception, session exchange, account-owner admission, Custom Tab closure, and final V2 destination as separate gates.
- **FR-036**: The normal-motion theme transition MUST fade the outgoing interface toward its own background before the atomic palette commit and reveal the incoming interface only after that midpoint commit.
- **FR-037**: Theme transition entry and release MUST animate only compositor-friendly opacity on one pointer-transparent layer; no root snapshot, layout animation, canonical-orb change, or page-wide color interpolation is permitted.
- **FR-038**: Google Android readiness MUST keep debug signer, upload signer, and Play App Signing OAuth clients and runtime proofs separate; no debug proof may satisfy a release-signer gate.
- **FR-039**: A production hosted Auth configuration change MUST run through a main-only, exact-confirmation, least-privilege workflow and MUST verify the resulting configuration through a post-write readback without exposing secrets or redirect inventories.
- **FR-040**: Android, Web, installed PWA, iOS, and Desktop MUST use the same one-veil CSS fade-through; rejected native decor, WebView-visibility, hardware-layer, and separate-window variants MUST remain absent from the selected runtime.
- **FR-041**: During the atomic midpoint, theme palette interpolation MUST be suppressed only on the reviewed surface selectors and buttons; buttons MUST retain `transform` and `opacity` press feedback, and the implementation MUST NOT use a universal descendant selector or stop accepted CSS animations.
- **FR-042**: Perfetto reporting MUST expose actual FrameTimeline rows over 103 ms separately from presentation timestamp gaps, deadline misses, percentiles, maximum duration, `gfxinfo`, and tile/crash/context signals; no one metric may substitute for another.
- **FR-043**: The selected theme coordinator MUST keep latest-request-wins cleanup, synchronous reduced motion, persistence-failure rollback, one input-transparent veil, and no screenshot/bitmap, native overlay, extra renderer, or canonical Orb change.
- **FR-044**: Before any Play release action, the owner account identity state, `com.zenflow.app` package registration state, Play App Signing key registration state, and every draft registration MUST be inspected separately in Play Console.
- **FR-045**: A signing key MUST be added to Android developer verification only when that exact key signs an Android artifact actually distributed outside Google Play; local debug keys and upload-only keys MUST NOT be registered as distribution keys without evidence of such distribution.
- **FR-046**: If Play Console requires manual ownership proof, the exact account-bound `adi-registration.properties` snippet MUST be handled as temporary private evidence, embedded only in a dedicated verification APK signed by the matching existing private key, uploaded to the verification flow, and excluded from source control and release bundles afterward.

- **FR-047**: Every R7 runtime and deployment copy MUST match its original review-file size and SHA-256 without trimming, looping, normalization, or lossy re-encoding.
- **FR-048**: The former collection MUST be absent from shipped music inventories and intent-cache admission; a retired cursor MUST safely select the first original while preserving the listener's opt-in and volume settings.
- **FR-049**: Music MUST use the selected master volume directly for these already-mastered recordings, while preserving mute, zero-volume, comfort, boundary fade, and lifecycle controls.
- **FR-050**: Hyperfocus MUST retain eighteen nature variants, six families by three levels. The approved US6 amendment permits replacing only three owner-rejected fireplace recordings after FR-057 admission; other fifteen remain byte-identical. No music or procedural fallback is admitted.
- **FR-051**: Existing generation tooling MUST NOT overwrite the R7 collection or reintroduce its retired procedural substitute when regenerating non-music ambience and feedback cues.
- **FR-052**: Restoration acceptance MUST distinguish file identity, decoded signal quality, runtime playback, owner selection, formal listening context, and store/legal clearance. A local implementation request does not invent listening duration, headphone/device-speaker approval, legal clearance, or store upload authorization.

- **FR-053**: Planning MUST mount only the existing Focus/Hyperfocus flow, preserving stored records and completion/minute callbacks; hidden workspace calculations MUST not mount.
- **FR-054**: Navigation MUST expose previous/current-state/next icon targets, stacked in collapsed sidebar, at least 44px desktop and 48px drawer. Auth stays one button. All eight locales, keyboard/focus, RTL icons and safe areas remain usable without visible track titles/tooltips.
- **FR-055**: Selection MUST wrap cyclically, persist before changing source, preserve off/paused/playing intent and respect mute/comfort/foreground/ownership. Latest rapid selection wins, even after a full cycle to the same ID, with one element and no stale fade/play effects.
- **FR-056**: Supported Media Session previous/next actions MUST be music-owner-bound and cleared for non-music; unsupported actions degrade without crashing. Decode/error recovery stays bounded to the collection.
- **FR-057**: New fireplace assets MUST pass provenance/hash, signal/loop/transient checks and direct owner audition before runtime admission. ACE-Step remains a private experiment unless it meets the indoor-fire brief. Soft/Deep/Intense differ in activity, not merely gain.
- **FR-058**: Release audibility MUST distinguish app gain from device volume, preserve mute/zero/saved preferences, and assess fresh/existing settings. Current system volumes and R7 bytes remain unchanged; unavailable real-device listening stays UNVERIFIED.

### Key Entities

- **Music Master**: One approved long-form composition with a stable identifier, file path, sequence position, encoding metadata, comfort metadata, byte size, and SHA-256 digest.
- **Music Collection**: The ordered set of exactly ten Music Masters and its versioned provenance/QC contract.
- **Playback Preference**: A device-local enabled/disabled choice that does not contain account or journal data.
- **Playback Session**: The current collection position, truthful playback state, lifecycle state, and single long-audio ownership lease.
- **Theme Transition Session**: The current request identifier, previous palette sample, latest target theme, reduced-motion decision, and bounded completion state.
- **Android Release Artifact**: A versioned, signed App Bundle bound to one merged main commit and one Google Play testing track.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The release inventory contains exactly ten distinct approved music hashes and zero prohibited or unknown-provenance audio hashes.
- **SC-002**: A listener can start or stop music from account entry or navigation with one control activation, and both surfaces report the same state within 100 milliseconds.
- **SC-003**: Account completion and full navigation retain one continuous playback session with zero simultaneous long-audio owners and zero duplicate music elements.
- **SC-004**: Every ten-minute loop review reports no audible seam, clipping, speech, alarm-like transient, copied recognizable phrase, or fatigue-inducing defect for each approved master.
- **SC-005**: A normal light-to-dark or dark-to-light change settles within 300 milliseconds, provides visible feedback within 100 milliseconds, and introduces no Android presentation gap longer than 103 milliseconds in the measured interaction window.
- **SC-006**: Ten repeated Android drawer theme round trips show zero blank, stale, partially drawn, clipped, low-contrast, or input-blocking frames and zero tile-memory/context-loss warnings.
- **SC-007**: All icon-only controls retain at least a 44-pixel target, a localized accessible name, keyboard operation, focus indication, and correct right-to-left placement across eight supported languages.
- **SC-008**: Music remains silent on every first-ever entry until explicit user intent, and disabling it prevents later automatic playback on every supported platform.
- **SC-009**: An offline listener can replay every previously integrity-admitted track, while an uncached track produces a truthful unavailable state rather than invented or substituted audio.
- **SC-010**: Required repository and CI checks report zero task-attributable failures, and every unchecked platform remains explicitly UNVERIFIED.
- **SC-011**: The exact signed bundle accepted by Play Console is traceable to the merged main commit and appears only in Internal testing.
- **SC-012**: Play Console reports the developer identity and `com.zenflow.app` package registration as complete before September 30, 2026, with every actually distributed signing key registered and every irrelevant local/debug key excluded.

## Assumptions

- The 2026-09-09 request resolves the collection as exactly the retained R7 ten tracks. The separately identified R6 Rainlit Chamber is not an eleventh track.
- The desired Japanese character means sparse space, restrained glass-like accents, soft felt-piano colour, and calm pacing; it does not authorize copying a Japanese work or presenting cultural authenticity claims.
- Music remains an optional comfort layer rather than a therapeutic claim, reward mechanism, or required part of account access.
- The visible control is icon-only, while non-visible accessibility names and state descriptions remain required.
- The current app-wide master volume and ambient-comfort controls remain authoritative and are not replaced.
- The current authentication providers and account logic remain unchanged.
- Internal testing is the only authorized Play destination for this feature.
- A missing upload key, missing console permission, failed check, or absent human audio approval is a release STOP rather than permission to weaken the gate.

## Non-Goals

- No streaming service, account-synced playlist, track picker, lyrics, vocals, music recommendations, subscriptions, purchases, or background service playback.
- No production rollout, store-listing redesign, advertising activation, auth-provider change, data migration, or new production dependency.
- No change to canonical ValenceOrb or MiniValenceOrb visuals.
- No reuse of Hyperfocus nature tracks, short feedback cues, or notification sounds as music.
- No mock-data path and no test fixture reachable from the production bundle.
