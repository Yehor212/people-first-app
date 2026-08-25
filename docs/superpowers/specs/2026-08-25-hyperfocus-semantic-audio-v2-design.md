# Hyperfocus Semantic Audio V2 Design

## Status

- **Design path:** architectural.
- **Owner direction:** approved in chat on 2026-08-25 for written-spec capture.
- **Implementation gate:** the owner must review this committed file before an implementation plan is created.
- **Runtime gate:** this design does not authorize source acquisition, runtime promotion, deployment, store submission, or publication.
- **Current review artifact:** `REJECTED_HUMAN_SEMANTIC_MISMATCH`.

This specification supersedes the source-to-variant mapping, Hyperfocus DSP, product naming, and human-review sections of `2026-08-25-hyperfocus-cc0-audio-rights-pack-design.md`. Its rights, quarantine, workspace, and evidence boundaries remain applicable where they do not conflict with this document.

## Goal

Produce a new 18-file Hyperfocus nature pack whose audible scene matches its literal family name, whose three intensity levels remain the same scene, and whose source rights, processing, technical quality, human acceptance, packaging, rollout, and rollback are independently traceable.

The six product families remain:

- `forest`;
- `rain`;
- `ocean`;
- `fireplace`;
- `river`;
- `wind`.

Each family retains the saved level IDs `soft`, `deep`, and `intense`. Existing family IDs, level IDs, legacy aliases, preference storage, user-start behavior, master mute, and audio comfort controls remain unchanged.

## User Failure Mode

The owner listened to the generated review artifact and rejected it because the audio did not correspond to the displayed names. This is a product-semantic failure even though the artifact passed the existing automated signal checks.

The desired outcome is not merely technically valid audio. A user choosing **Ocean · Intense** must hear an ocean scene, not a different scene that was assigned an ocean-themed subtitle after generation. Moving from **Soft** to **Deep** to **Intense** must preserve the same recognizable scene rather than switching recordings.

## Current Evidence And Root Cause

The current branch and exact private artifact were inspected on 2026-08-25:

- source head: `e74a6b93b54afec99737ee54252dab92c34ba56c`;
- GitHub Actions run: `32816404725`;
- artifact ID: `9551607003`;
- archive SHA-256: `48931c2f8723e246112303604dd5a070107733850c2ea9d53e23b5c8a66eeb6b`;
- machine status before owner review: review-only technical success;
- authoritative owner result after listening: `REJECTED_HUMAN_SEMANTIC_MISMATCH`.

Four causes are directly visible in the current implementation:

1. **Labels precede evidence.** `config/audio/cc0-kimi-audio-review-spec.json` assigns scene-specific labels such as `Bird Canopy`, `Forest Night`, `Rock Pools`, `Heavy Surf`, and `Mountain Wind` before any blind source acceptance.
2. **Levels change recordings.** Eighteen Hyperfocus roles are mapped to fifteen source recordings. Forest, ocean, river, wind, and part of rain use different sources across their levels.
3. **Levels change source windows.** `scripts/audio_review/dsp.py` derives a different offset from `family:level:seed`, so two levels can use different moments even when they share a source.
4. **DSP adds new scene material.** `_family_texture()` generates colored noise and fireplace impulses; `render_hyperfocus()` mixes that synthetic layer into the source at level-dependent amounts.

The rights ledger also shows mappings that do not establish the promised scene, for example:

- `ocean:intense` / `Heavy Surf` uses source title `Cliff #1`;
- `wind:intense` / `Mountain Wind` uses `Strong Wind in a Village`;
- `forest:intense` / `Forest Night` uses `Forests of Gironde, France`;
- `forest:deep` / `Bird Canopy` uses `Forest #3`.

Source titles alone do not prove an audible mismatch. They demonstrate that the product claims were not evidence-bound. The owner's hash-bound listening rejection is the decisive semantic evidence.

## Explicit Requirements

The owner has approved all of the following:

1. Six literal families multiplied by three literal intensity levels.
2. Removal of unproven poetic or scene-specific level subtitles.
3. Exactly three anonymized, rights-clear raw source candidates plus `NONE` for each family.
4. The current source may compete only as an anonymous candidate and receives no incumbent preference.
5. One owner-approved source and one owner-approved PCM window per family.
6. The same source window and the same canonical loop base for `soft`, `deep`, and `intense`.
7. Source-preserving mastering only: bounded loudness, dynamics, and broad EQ.
8. No synthetic noise, generated texture, additional layers, pitch shift, time stretch, scene substitution, or level-specific source offset.
9. A blind intensity-ordering test followed by a labeled confirmation test.
10. A fail-closed, atomic `18/18` release gate with no partial pack and no fallback to the rejected artifact.

## Implied Requirements

The following work is necessary to make the explicit requirements enforceable:

- split source audition, window audition, mastering, semantic review, rights approval, and runtime promotion into separate state transitions;
- bind every decision to exact source, base-PCM, candidate, output, and package hashes;
- invalidate review when bytes, processing parameters, blind mappings, or reviewer-required playback contexts change;
- update all eight supported locales so the UI no longer asserts scene details that the audio cannot prove;
- preserve the existing 26-hash quarantine denylist at source, candidate, output, build, and package boundaries;
- version the v2 review and runtime manifests so stale PWA or native bytes cannot be mistaken for the approved pack;
- keep automated sound-event classification advisory and incapable of creating semantic or human `PASS`;
- preserve current runtime audio until a separate promotion operation proves the complete v2 pack.

## Non-Goals

- No new sound family, intensity level, preference key, or legacy alias.
- No Hyperfocus control redesign.
- No change to auth, IndexedDB, Supabase, sync, journal audio, reminders, notification channels, haptics, ads, analytics, or monetization.
- No change to the eight current non-Hyperfocus ambience and feedback assets.
- No AI-generated audio, procedural audio, synthetic business data, or runtime download service.
- No paid API, service, library, or dependency without separate owner approval.
- No use of quarantined or blocked recovered audio as a source, derivation input, fallback, reference anchor, or runtime asset.
- No claim of formal MUSHRA compliance, legal advice, artistic acceptance, store approval, or published release without the corresponding evidence.

## Product Taxonomy And Copy

The product presents the family and intensity as two separate literal concepts:

| Family ID   | Family label | Level IDs and English labels                      |
| ----------- | ------------ | ------------------------------------------------- |
| `forest`    | Forest       | `soft` / Soft, `deep` / Deep, `intense` / Intense |
| `rain`      | Rain         | `soft` / Soft, `deep` / Deep, `intense` / Intense |
| `ocean`     | Ocean        | `soft` / Soft, `deep` / Deep, `intense` / Intense |
| `fireplace` | Fireplace    | `soft` / Soft, `deep` / Deep, `intense` / Intense |
| `river`     | River        | `soft` / Soft, `deep` / Deep, `intense` / Intense |
| `wind`      | Wind         | `soft` / Soft, `deep` / Deep, `intense` / Intense |

`src/lib/hyperfocusAudioCatalog.ts` keeps the existing 18 variant IDs and translation keys. Its fallback labels become `Soft`, `Deep`, and `Intense`. The existing family-specific translation keys remain for compatibility, but each supported locale expresses only the corresponding intensity level; it must not add a location, time of day, animal, weather event, terrain, or other unverified scene claim.

All `en`, `uk`, `es`, `de`, `fr`, `ja`, `ar`, and `he` values require key-parity, translation-quality, and RTL checks. Automated checks cannot establish native-speaker quality, so that evidence remains `UNVERIFIED` until a qualified human review occurs.

## Architecture Overview

The v2 pipeline has six isolated boundaries:

1. **Rights-qualified source pool** — acquires and authenticates candidate source recordings without product writes.
2. **Blind source and window audition** — presents anonymized raw candidates and records owner decisions.
3. **Canonical base-loop builder** — creates one hash-bound 30-second PCM loop per family from the approved source window.
4. **Source-preserving masterer** — creates three bounded intensity variants from the same canonical base.
5. **Independent technical and semantic verifier** — checks bytes, provenance, signal constraints, blind decisions, and required listening evidence.
6. **Atomic promoter** — can copy all 18 files into product paths only after every prerequisite is current and valid.

No boundary may infer a later approval. In particular, rights qualification does not imply semantic fit, technical QC does not imply human acceptance, and a review-package `PASS` does not imply runtime promotion or release.

## State Machine

Each family follows this state sequence:

```text
DISCOVERED
  -> RIGHTS_CAPTURED
  -> SOURCE_BLIND_READY
  -> SOURCE_SELECTED
  -> WINDOW_BLIND_READY
  -> WINDOW_SELECTED
  -> BASE_LOOP_VERIFIED
  -> MASTERED_TRIO_READY
  -> TECHNICAL_PASS
  -> HUMAN_SEMANTIC_PASS
  -> OWNER_RIGHTS_PASS
  -> PROMOTION_READY
```

Terminal or exceptional states are:

- `NONE_SELECTED` — the owner rejected all source or window candidates;
- `REVISE` — source remains eligible but the base loop or mastering recipe must change;
- `REJECTED_HUMAN_SEMANTIC_MISMATCH` — the exact reviewed bytes failed family, scene, or intensity meaning;
- `REJECTED_TECHNICAL_QC` — the exact bytes failed objective requirements;
- `RIGHTS_BLOCKED` — source-specific rights evidence is absent, changed, or contradictory;
- `REVOKED` — a previously accepted source or artifact is no longer eligible;
- `PROMOTED` — all 18 exact output hashes were copied as one runtime revision;
- `ROLLED_BACK` — runtime returned to the exact previous released revision.

Changing any source byte, source window, base-loop byte, processing parameter, encoded output, blind mapping, or required review field invalidates every downstream state.

## Rights-Qualified Source Pool

### Candidate Count And Scope

Each family must have exactly three audition candidates. All three must pass the source-specific rights gate before they receive blind labels. If fewer than three candidates qualify, the family remains `RIGHTS_BLOCKED`; the pipeline must not silently reduce the comparison set.

Candidates use CC0 1.0 recordings whose item pages bind the recording, author, and license. A directly negotiated license is outside this v2 comparison set and requires a separate owner/legal decision.

### Rights Receipt

Every candidate receives a private receipt binding:

- provider and canonical item-page URL;
- provider item ID, displayed title, and author/recorder;
- acquisition timestamp in UTC;
- canonical CC0 URL and the provider's license-page URL;
- source-page and license-page snapshot hashes;
- final audio URL and redirect chain without credentials;
- downloaded filename, byte count, MIME signature, duration, channels, sample rate, and bit depth;
- source-file SHA-256;
- normalized commercial-use, modification, distribution, and redistribution evidence;
- known restrictions, no-warranty language, and third-party-right caveats;
- acquisition tool version and operator identity;
- status `ACQUIRED`, `RIGHTS_REVIEWED`, `REJECTED`, or `REVOKED`.

The Creative Commons CC0 deed permits copying, modification, distribution, and commercial use but explicitly does not clear unrelated privacy, publicity, patent, or trademark rights and provides no warranty: <https://creativecommons.org/publicdomain/zero/1.0/>. BigSoundBank's current license page states sharing, adaptation, commercial use, and CC0 1.0: <https://bigsoundbank.com/licenses.html>. These general pages do not replace an item-specific receipt or owner/legal decision.

Private source files and page snapshots remain outside tracked, runtime, build, and public asset paths. The tracked manifest records hashes and canonical URLs, not private source bytes or full page captures.

### Acquisition Safety

The acquisition boundary must:

- accept only manifest-declared candidate IDs;
- use HTTPS and an exact provider-host allowlist;
- reject credentials, userinfo, query secrets, unexpected ports, unsupported redirects, and undeclared cross-host downloads;
- limit response size and validate content signatures before decoding;
- use a new private temporary directory, exclusive creation, and atomic rename;
- refuse overwrites and preserve partial failures outside product and evidence roots;
- run the quarantine denylist check before a source becomes eligible.

Network failure, source-page drift, license drift, or a changed source hash is `RIGHTS_BLOCKED`, never permission to reuse cached or quarantined bytes without a new receipt.

## Blind Source Audition

### Bundle Construction

For each family, the tool creates one private bundle containing:

- `A`, `B`, and `C`, assigned by a recorded randomization seed;
- a mandatory `NONE` decision;
- equal-duration raw previews;
- a private mapping from blind ID to rights-receipt and source hashes;
- a bundle manifest and `SHA256SUMS`.

The current source may be one of `A`, `B`, or `C`, but the UI and review files must not identify it as current, previous, incumbent, or recommended.

Preview creation may decode and resample for a common playback container. Loudness matching is applied as non-destructive playback-gain metadata so that loudness alone does not reveal a candidate. Preview bytes must not contain EQ, compression, limiting, cross-source mixing, synthetic texture, denoising that changes scene identity, pitch shift, time stretch, or a product subtitle.

### Source Decision

The owner reviews candidates at matched playback level and records for each:

- family identity, 1 through 5;
- scene purity, 1 through 5;
- unwanted foreground events;
- fatigue or irritation risk;
- loop potential;
- decision `SELECT`, `REJECT`, or `NONE`;
- reviewer, timestamp, output device, and notes.

A source can be selected only when family identity and scene purity are each at least 4, no hard-reject event is present, and the owner explicitly chooses it. `NONE` is a valid and expected outcome. Automated sound-event analysis may flag voice, music, animals, vehicles, machinery, alarms, thunder, impacts, water, fire, or wind using an ontology such as Google AudioSet, but it remains advisory: <https://research.google.com/audioset/ontology/>.

## Blind Window Audition

After a source wins, the tool proposes three distinct, deterministic 30-second PCM windows from that exact source plus `NONE`. Window labels are independently randomized as `A`, `B`, and `C`; source names and timestamps remain hidden during review.

Each window must:

- be contiguous in the source before loop construction;
- exclude speech, music, alarms, thunder, vehicles, machinery, foreground human sounds, dominant wildlife, and hard one-shot distractions;
- retain the family scene without another source or generated layer;
- leave enough boundary context for one shared loop crossfade;
- record exact start and end sample indices against the source SHA-256.

The owner selects exactly one window or `NONE`. The chosen `source_sha256`, `start_sample`, and `end_sample` become immutable inputs to the canonical base-loop builder.

## Canonical Base Loop

The base-loop builder creates exactly one 30.000-second, 48,000 Hz, stereo float PCM loop per family.

It may perform only:

1. deterministic decode to 48 kHz stereo PCM;
2. exact extraction of the approved source sample window;
3. DC removal when measured DC exceeds the accepted technical bound;
4. one documented equal-power boundary crossfade;
5. one final common gain trim to prevent intermediate clipping.

The crossfade position, duration, curve, and resulting `base_pcm_sha256` are shared by all three levels. The base builder may not use a different offset, crossfade, or source segment per level.

Mono duplication, artificial stereo widening, source separation, content-aware fill, generative repair, procedural noise, or mixing another recording is prohibited. A mono source is ineligible for this v2 pack because the runtime contract requires a source-authentic stereo scene.

## Source-Preserving Mastering

### Allowed Operations

All three levels read the same canonical base PCM hash. A level recipe may use only:

- scalar gain;
- broad, minimum-phase high-pass, low-pass, shelf, or bell EQ;
- bounded broadband compression;
- bounded transient control;
- a safety limiter used only to enforce the peak ceiling;
- deterministic MP3 encoding.

### Prohibited Operations

The masterer must reject recipes containing:

- synthetic, procedural, generated, or sampled texture;
- another source recording or another window from the approved source;
- pitch shift, time stretch, granular synthesis, convolution scene replacement, source separation, or content-aware generation;
- level-specific looping, offset, randomized phase, stereo widening, or channel decorrelation;
- inserted crackle, bird, wave, rain, wind, fire, river, impact, music, voice, or alarm event;
- adaptive parameters that are not recorded in the immutable recipe.

### Bounded Intensity Envelope

The implementation uses an ITU-R BS.1770-compatible measurement for integrated loudness and true peak. EBU R 128 is used for the measurement vocabulary and the conservative `-1 dBTP` production ceiling, not as a claim that these app ambience files are broadcast-normalized: <https://tech.ebu.ch/docs/r/r128.pdf>.

For every decoded delivery trio:

- integrated loudness is strictly `soft < deep < intense`;
- each adjacent level differs by 3 through 5 LU;
- total soft-to-intense spread is 6 through 10 LU;
- maximum true peak is at most `-1.0 dBTP`;
- broad EQ gain is bounded to `±3 dB` per band;
- compressor ratio is at most `2:1`;
- measured peak gain reduction is at most `4 dB`;
- no level may clip, contain invalid samples, or exceed the family recipe's recorded bounds.

The exact per-family targets are frozen in the recipe before the blind trio is rendered. They may be revised only by producing a new recipe ID, new output hashes, and a new human review. Thresholds must not be weakened after a failure to make an artifact appear green.

## Technical Quality Contract

Every mastered output must satisfy:

- MP3 delivery format;
- decoded sample rate exactly 48,000 Hz;
- exactly two channels;
- decoded duration within the existing documented encoder-padding tolerance around 30 seconds;
- fixed approved bitrate profile across all 18 files;
- no clipped decoded samples, NaN, infinity, or unsafe DC offset;
- true peak at or below `-1.0 dBTP`;
- bounded start/end energy difference;
- bounded boundary derivative and seam discontinuity;
- no encoder, decode, or metadata error;
- exact source, window, base PCM, recipe, output, and package hash chain;
- strict `soft < deep < intense` automatic progression;
- identical source SHA, sample window, and base PCM SHA across a family trio;
- denylist absence at source, candidate, output, build, and package boundaries.

Technical QC reports semantic status as `UNVERIFIED` until a real reviewer completes the human gate. No numerical metric, classifier score, source title, model output, or CI result can set `HUMAN_SEMANTIC_PASS`.

## Human Semantic Acceptance

### Blind Mastered-Trio Gate

For each family, the tool presents the exact three mastered output hashes in randomized `X`, `Y`, and `Z` order without level labels. The owner must:

1. identify the ascending intensity order correctly;
2. confirm that all three files remain the same family and the same recognizable scene;
3. report any new event, changed location impression, foreground distraction, pumping, harshness, or fatigue;
4. choose `ACCEPT`, `REVISE`, or `REJECT_ALL`.

Failure to order the trio, a perceived scene change, or any family mismatch prevents promotion even when technical metrics pass.

### Labeled Confirmation Gate

After the blind order is recorded, the same hashes are revealed as `Soft`, `Deep`, and `Intense`. Each file requires:

- at least ten continuous minutes of looped listening on headphones;
- at least ten continuous minutes of looped listening through a built-in speaker;
- confirmation of family identity, same-scene continuity, loop seam comfort, intensity fit, and fatigue tolerance;
- reviewer identity, UTC timestamp, playback context, exact SHA-256, decision, and notes.

This strict protocol requires at least 360 minutes for the 18 final files across the two required contexts. The tool may organize playback and validate form completeness, but it cannot claim that listening occurred or fill the decision fields.

The blind method is informed by the bias-control principles of ITU-R BS.1534, but ZenFlow does not claim formal MUSHRA compliance because this is an owner product-fit test rather than a controlled laboratory codec assessment: <https://www.itu.int/rec/R-REC-BS.1534/en>.

## Review Artifact Contract

The v2 review artifact contains exactly 18 Hyperfocus delivery files plus evidence. The eight non-Hyperfocus ambience and feedback files are not rebuilt or bundled as v2 candidates.

Required evidence files are:

- `rights-ledger.json`;
- `source-audition.json`;
- `window-audition.json`;
- `base-loop-manifest.json`;
- `mastering-recipes.json`;
- `provenance.json`;
- `qc-report.json`;
- `semantic-review.json`;
- `build-environment.json`;
- `promotion-readiness.json`;
- `SHA256SUMS`;
- `README.md`.

The artifact is built in a new sibling temporary directory and atomically renamed only after independent verification. An existing artifact is never overwritten. The v1 artifact remains preserved under its original identity and rejected status.

## Evidence Integrity

Each evidence document records its schema version and canonical serialization hash. The independent verifier checks:

- exact inventory and no unexpected audio or private source files;
- every evidence file listed in `SHA256SUMS`;
- source receipt hashes and candidate mapping consistency;
- blind mapping secrecy during the review stage and controlled reveal afterward;
- state-machine transition legality;
- source/window/base identity across each trio;
- recipe allowlist and parameter bounds;
- output technical constraints;
- human review fields against exact output hashes;
- owner rights decision against exact selected source hashes;
- quarantine denylist absence;
- source-head, workflow, dependency-lock, encoder, decoder, and build-environment identity.

A human decision imported from another artifact, another hash, an incomplete playback context, or a pre-master source does not count.

## Runtime Integration

Runtime integration preserves existing semantic IDs and storage behavior. The expected product changes after promotion approval are limited to:

- literal level fallback labels in `src/lib/hyperfocusAudioCatalog.ts`;
- literal level values for the existing 18 keys in all eight locale files;
- 18 versioned Hyperfocus MP3 files;
- generated runtime manifest, provenance, rights notice, QC, and cache revision;
- tests and checks that enforce exact catalog, source, hash, and package identity.

Versioned runtime filenames are required for v2 because byte replacement under old URLs risks stale installed-PWA and native-package evidence. The semantic IDs remain stable while the generated manifest maps them to the v2 filenames.

No runtime SDK, remote audio request, microphone permission, streaming source, credential, or private receipt is introduced.

## Atomic Promotion

Promotion is a separate explicit command. It performs no network acquisition and accepts only one independently verified v2 artifact.

Promotion is allowed only when:

- all six sources and six windows have owner selections;
- all selected sources have current `RIGHTS_REVIEWED` receipts;
- all six family trios have technical `PASS`;
- all six blind trio reviews and all 18 labeled reviews have human `PASS`;
- the owner records an explicit rights decision for the selected source hashes;
- none of the 26 denied hashes is present;
- the artifact source head and expected repository head match the approved promotion input;
- all 18 runtime destinations, generated metadata, notices, and cache revision can be committed atomically.

The command must reject `17/18`, mixed artifact IDs, mixed source heads, mixed runtime revisions, missing human evidence, or any attempt to use the rejected v1 artifact. It writes to staging first, verifies the staged tree, and promotes all tracked outputs as one reviewable change.

## Rollout And Rollback

1. The current released runtime pack remains unchanged while v2 is sourced, reviewed, and packaged.
2. The rejected v1 review artifact remains quarantined and cannot serve as a fallback or rollback target.
3. V2 is promoted only as one `18/18` revision.
4. `audio.kill_switch` remains the emergency playback stop; using it in production is a separate release operation.
5. Web/PWA, Android, iOS, and Desktop package hashes must converge on the promoted v2 manifest before release eligibility is claimed.
6. Task completion, merge, build inclusion, signed artifact creation, store submission, review, publication, and public availability remain separate states.

Rollback restores the exact prior released 18-file pack, generated manifest, provenance, notices, and cache revision from a reviewed commit. It then reruns the complete app-audio, package, cache, and denylist checks. Web/PWA requires a new deployment and cache-busted public verification; Android, iOS, and Desktop require a new package or a separately proven kill-switch response.

Private source and rights evidence is retained for audit. Rollback never deletes it and never unquarantines the rejected v1 artifact.

## Failure Handling

- Fewer than three rights-qualified sources: `RIGHTS_BLOCKED`; continue source research without generating a trio.
- Owner selects `NONE`: preserve evidence, reject the candidate set, and source three new candidates.
- Blind mapping is disclosed early: invalidate that audition and rerandomize a new bundle.
- No acceptable 30-second window: `NONE_SELECTED`; reject the source for this product role.
- Recipe contains a prohibited operation: fail before rendering.
- Source, window, base, recipe, or output hash changes: invalidate all downstream evidence.
- Technical QC fails: keep outputs outside product paths and create a new recipe or base-loop artifact.
- Blind ordering fails or scene identity changes: `REVISE` or `REJECT_ALL` according to the owner decision.
- Human family mismatch: `REJECTED_HUMAN_SEMANTIC_MISMATCH`; automation cannot override it.
- License or item page changes: `RIGHTS_BLOCKED` or `REVOKED`; no cached-rights fallback.
- Package or platform hash mismatch: no promotion or release claim.
- Current worktree becomes unsafe, unlocked, or unexpectedly dirty: preserve evidence and stop synchronization or handoff.

## Security And Privacy Boundary

The acquisition/downloader is the only new network trust boundary. It requires narrow allowlists, response limits, redirect validation, exclusive writes, hash verification, and the narrowest applicable security-suite scan.

The pipeline processes public source recordings and private rights receipts only. It must not read or emit journal content, recorded user audio, user IDs, emails, auth tokens, environment files, production data, telemetry payloads, or credentials. Logs use candidate IDs and hashes, not secret URLs or raw headers.

No source, review, or rights tool enters the production runtime bundle.

## Platform And Domain Matrix

| Surface           | Impact                                       | Required evidence before release                                                                  | Current status                              |
| ----------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Web/Vite          | New versioned asset paths and literal labels | production build, exact `dist` hashes, user-start playback, clean console/network                 | `UNVERIFIED`                                |
| Installed PWA     | Cache revision and offline/range playback    | exact cache manifest, full-body hash admission, offline playback, stale-revision rejection        | `UNVERIFIED`                                |
| Android/Capacitor | Packaged v2 bytes and labels                 | `cap:sync:android`, APK/AAB hashes, installed playback, focus/background smoke                    | `UNVERIFIED`                                |
| iOS/WKWebView     | Packaged v2 bytes and labels                 | `cap:sync:ios`, app/archive hashes, gesture unlock and interruption smoke                         | `UNVERIFIED`                                |
| Desktop/Tauri     | Packaged v2 bytes and labels                 | package resource hashes, installed playback, suspend/resume smoke                                 | `UNVERIFIED`                                |
| Store/Release     | Rights and signed-artifact identity          | private rights packet, owner/legal decision, signed artifact, submission and publication evidence | `UNVERIFIED`                                |
| Accessibility     | Audio remains optional and user-started      | master mute, visible non-audio state, keyboard/screen-reader controls, no surprise resume         | existing behavior retained; v2 `UNVERIFIED` |
| Localization/RTL  | Literal level copy in eight locales          | key parity, translation checks, `ar`/`he` RTL review, qualified-human language review             | `UNVERIFIED`                                |
| Performance       | Same 18-role scope, versioned bytes          | bundle delta, no eager preload, decode/start latency, memory behavior                             | `UNVERIFIED`                                |
| Security/Privacy  | Build-time acquisition only                  | narrow security suite, source/secret scan, no runtime dependency or PII                           | `UNVERIFIED`                                |
| Auth/Storage/Sync | No contract change                           | diff proves no affected runtime path                                                              | expected `N/A`; implementation `UNVERIFIED` |

## Test-First Verification Design

Before changing generator or production behavior, add focused failing tests that prove the current v1 design violates the new contracts:

1. reject a family whose levels reference different source hashes;
2. reject a family whose levels reference different sample windows or base PCM hashes;
3. reject synthetic texture, added layers, randomized level offsets, pitch/time changes, or stereo widening;
4. reject scene-specific product subtitles instead of literal intensity labels;
5. require exactly three blind source candidates plus `NONE` per family;
6. require exactly three blind window candidates plus `NONE` after source selection;
7. prevent automation from setting source selection, `HUMAN_SEMANTIC_PASS`, owner rights approval, or listening completion;
8. invalidate downstream review when any bound hash or recipe changes;
9. enforce allowed mastering operations and numeric bounds;
10. enforce exact 18-file review and promotion inventories;
11. reject partial or mixed-revision promotion;
12. reject every quarantined hash at source, candidate, artifact, runtime, and package boundaries;
13. preserve existing family IDs, level IDs, aliases, preference compatibility, and user-start controls;
14. require literal level values and locale-key parity across all eight languages;
15. prove deterministic output from identical source, window, base, recipe, encoder, and environment inputs.

After the minimal implementation turns those tests green, rerun the focused Python/Vitest suites, existing Hyperfocus and app-audio checks, translation checks, no-AI-template and best-practices guards, production-data-integrity diff scan, build, artifact scans, and platform-specific package evidence.

Security scanning applies to the acquisition and evidence trust boundary. Missing Snyk or scanner authorization is `UNVERIFIED`, not `PASS`.

## Expected Implementation Write Set

The implementation plan may include only task-grounded changes under:

- `config/audio/` for v2 candidate, recipe, review, and quarantine schemas;
- `scripts/audio_review/` and focused tests for acquisition, audition, base-loop, mastering, verification, and promotion;
- `.github/workflows/cc0-kimi-audio-review.yml` for review-only artifact generation and validation;
- `docs/audio/` for source shortlist, operator flow, provenance, rights, QC, and semantic evidence contracts;
- `src/lib/hyperfocusAudioCatalog.ts` and its tests for literal fallback labels without ID changes;
- the eight existing `src/i18n/languages/*.ts` files and translation tests;
- generated Hyperfocus manifest/provenance files;
- `public/sounds/hyperfocus/` only after a separate promotion gate accepts all 18 exact hashes;
- service-worker/cache ownership only when characterization proves a revision update is required;
- `THIRD_PARTY_NOTICES.md` after selected source receipts identify the exact authors and items.

Unexpected auth, storage, sync, journal, monetization, general UI, native-source, dependency, or unrelated documentation changes require a new scoped decision.

## Risks And Rejection Criteria

| Risk                                  | Mitigation                                                           | Reject or stop when                                                     |
| ------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| CC0 label is inaccurate or incomplete | item-specific receipt, snapshots, hashes, owner/legal review         | source/page/license evidence is missing, changed, or contradictory      |
| Blind test is biased                  | hidden source names, equal playback gain, randomized mapping, `NONE` | mapping leaks or current source is identified                           |
| Levels become different scenes        | one source, one window, one base PCM hash                            | any trio member differs on source/window/base                           |
| Mastering invents content             | operation allowlist and bounded parameters                           | recipe adds texture, source, event, pitch/time, width, or random offset |
| Metrics pass but meaning fails        | blind ordering plus labeled owner review                             | owner cannot order intensity or hears a family/scene mismatch           |
| Review is fabricated or stale         | exact hashes, contexts, timestamps, immutable state transitions      | required listening evidence is incomplete or bound to other bytes       |
| Stale runtime bytes survive           | versioned filenames and exact package hashes                         | cache/native package does not match promoted manifest                   |
| Partial pack reaches users            | atomic `18/18` promoter                                              | any family or platform artifact is incomplete or mixed                  |
| Rollback selects rejected material    | previous released revision only                                      | target is v1 rejected artifact or lacks exact reviewed hashes           |

## Done Criteria

Implementation is complete only when current evidence proves:

- six owner-selected CC0 sources and six owner-selected source windows;
- one source SHA, window, and base PCM SHA shared by every family trio;
- no synthetic layer, added recording, alternate window, or prohibited transform;
- all 18 literal family/level mappings and all eight locale values are consistent;
- source, rights, blind mapping, base, recipe, output, artifact, runtime, and package hashes agree;
- every technical gate passes without weakened thresholds or exclusions;
- all six blind trio orders and all 18 labeled, two-context listening reviews are complete and accepted by a real owner/reviewer;
- owner/legal rights decision is explicit for the exact selected sources;
- none of the 26 denied hashes appears anywhere in the source-to-package chain;
- promotion is atomic and rollback targets the exact prior released revision;
- Web/PWA, Android, iOS, Desktop, Store/Release, localization, performance, accessibility, and security states are explicit;
- the final diff contains no unrelated changes, private source bytes, private page snapshots, credentials, user data, fabricated decisions, or test-only runtime dependency.

## UNVERIFIED Ledger At Design Time

- The next three rights-qualified candidates for each family have not yet been selected.
- No v2 source or window has owner acceptance.
- No v2 mastering recipe or output exists.
- Loudness bounds are designed but not calibrated against selected sources.
- No v2 human listening, legal decision, platform package, runtime, signed artifact, store, deployment, or public-release proof exists.
- Native-speaker quality for updated translations has not been reviewed.
- The existing broad `check:app-audio` historical-output condition must be freshly characterized before release work; this design does not authorize cleanup.

## Approval Boundary

Owner approval of this committed specification authorizes creation of a detailed implementation plan. It does not itself authorize:

- downloading or purchasing a source;
- accepting a rights or human-review decision on the owner's behalf;
- moving, deleting, or cleaning historical artifacts;
- promoting audio into product paths;
- committing private source recordings or full rights snapshots;
- pushing the branch, opening or merging a pull request, deploying, changing remote flags, or submitting a store release.

Those actions remain subject to the implementation plan, repository gates, exact-target verification, and any explicit action-boundary approval.
