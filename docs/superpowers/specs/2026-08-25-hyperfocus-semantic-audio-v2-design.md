# Hyperfocus Semantic Audio V2 Design

## Status

- **Design path:** architectural.
- **Owner direction:** source-preserving v2 and the fail-closed hybrid AI audit were approved in chat on 2026-08-25 for written-spec capture.
- **Implementation gate:** the owner must review this committed file before an implementation plan is created.
- **Runtime gate:** this design does not authorize model/dependency installation, source acquisition, runtime promotion, deployment, store submission, or publication.
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
- authoritative owner result after listening: only `fireplace:deep` matches its role; the other 17 files fail;
- bounded human result: `1/18 PASS`, `17/18 FAIL`, and overall `REJECTED_HUMAN_SEMANTIC_MISMATCH`.

This verdict is bounded to the exact artifact above. It is authoritative product-owner feedback for this design, but the package's generated `human-review.json` still contains pending decisions. A durable review receipt must bind the owner's decisions to the exact 18 output hashes without an agent completing or backdating human fields.

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
11. A read-only AI auditor with separate open-vocabulary semantic and temporal sound-event channels.
12. Mandatory AI `ABSTAIN` when the evidence is out of distribution, uncalibrated, contradictory, or below the frozen decision margin.
13. AI may block a candidate but may never create `HUMAN_SEMANTIC_PASS`, owner approval, rights approval, or release approval.
14. The current `1 PASS / 17 FAIL` artifact is a visible regression fixture, not an independent holdout or proof of model generalization.

## Implied Requirements

The following work is necessary to make the explicit requirements enforceable:

- split source audition, window audition, mastering, semantic review, rights approval, and runtime promotion into separate state transitions;
- bind every decision to exact source, base-PCM, candidate, output, and package hashes;
- invalidate review when bytes, processing parameters, blind mappings, or reviewer-required playback contexts change;
- update all eight supported locales so the UI no longer asserts scene details that the audio cannot prove;
- preserve the existing 26-hash quarantine denylist at source, candidate, output, build, and package boundaries;
- version the v2 review and runtime manifests so stale PWA or native bytes cannot be mistaken for the approved pack;
- add an independent AI-audit state machine whose `FAIL` or `ABSTAIN` blocks promotion while its `PASS` remains non-convertible to human acceptance;
- freeze and hash model identities, preprocessing, prompt banks, calibration data, holdout manifests, thresholds, and per-window results;
- separate visible regression, calibration, and owner-controlled holdout data so threshold tuning cannot consume evaluation evidence;
- report per-family false accepts, false rejects, abstention, calibration, risk-versus-coverage, and confidence intervals instead of one aggregate accuracy;
- isolate model weights and ML dependencies from the generator, product runtime, credentials, and private user data;
- preserve current runtime audio until a separate promotion operation proves the complete v2 pack.

## Non-Goals

- No new sound family, intensity level, preference key, or legacy alias.
- No Hyperfocus control redesign.
- No change to auth, IndexedDB, Supabase, sync, journal audio, reminders, notification channels, haptics, ads, analytics, or monetization.
- No change to the eight current non-Hyperfocus ambience and feedback assets.
- No AI-generated audio, procedural audio, synthetic business data, or runtime download service.
- No hosted audio-LLM or majority-vote council as a release authority.
- No online model inference, automatic model-weight download during audit, or ML package in the production runtime bundle.
- No claim that an AI similarity score is a calibrated probability before local calibration and holdout validation.
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

The v2 pipeline has seven isolated boundaries:

1. **Rights-qualified source pool** — acquires and authenticates candidate source recordings without product writes.
2. **Blind source and window audition** — presents anonymized raw candidates and records owner decisions.
3. **Canonical base-loop builder** — creates one hash-bound 30-second PCM loop per family from the approved source window.
4. **Source-preserving masterer** — creates three bounded intensity variants from the same canonical base.
5. **Independent read-only AI auditor** — runs frozen semantic, event, uncertainty, and same-scene checks without importing generator DSP code or writing product paths.
6. **Independent evidence verifier** — checks bytes, provenance, signal constraints, AI receipts, blind decisions, and required listening evidence.
7. **Atomic promoter** — can copy all 18 files into product paths only after every prerequisite is current and valid.

No boundary may infer a later approval. In particular, rights qualification does not imply semantic fit, technical QC does not imply AI or human acceptance, AI `PASS` does not imply human acceptance, and a review-package `PASS` does not imply runtime promotion or release.

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
  -> AI_AUDIT_PASS
  -> HUMAN_SEMANTIC_PASS
  -> OWNER_RIGHTS_PASS
  -> PROMOTION_READY
```

Terminal or exceptional states are:

- `NONE_SELECTED` — the owner rejected all source or window candidates;
- `REVISE` — source remains eligible but the base loop or mastering recipe must change;
- `REJECTED_HUMAN_SEMANTIC_MISMATCH` — the exact reviewed bytes failed family, scene, or intensity meaning;
- `REJECTED_TECHNICAL_QC` — the exact bytes failed objective requirements;
- `AI_AUDIT_FAIL` — a frozen AI gate found a calibrated semantic or prohibited-event failure;
- `AI_AUDIT_ABSTAIN` — model evidence is uncertain, contradictory, out of distribution, uncalibrated, or outside validated coverage;
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

A source can be selected only when family identity and scene purity are each at least 4, no hard-reject event is present, and the owner explicitly chooses it. `NONE` is a valid and expected outcome. Before AI-auditor admission, automated sound-event analysis is advisory and remains `UNVERIFIED`. After admission, the same frozen semantic/event policy audits source previews: `FAIL` or `ABSTAIN` blocks a source from window selection, while AI `PASS` still cannot select it for the owner. The event ontology may use Google AudioSet categories for voice, music, animals, vehicles, machinery, alarms, thunder, impacts, water, fire, and wind: <https://research.google.com/audioset/ontology/>.

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

## AI-Assisted Semantic Audit

### Evidence Boundary

The AI auditor is a read-only release veto and diagnostic instrument. It emits exactly one of:

- `PASS` — all required frozen model gates passed within their validated coverage;
- `FAIL` — at least one calibrated hard semantic or prohibited-event condition failed;
- `ABSTAIN` — evidence is uncertain, contradictory, out of distribution, uncalibrated, affected by model/runtime drift, or outside the validated coverage;
- `UNVERIFIED` — the audit did not run or its model, data, configuration, or evidence identity is incomplete.

`FAIL`, `ABSTAIN`, and `UNVERIFIED` block promotion. AI `PASS` is necessary after the auditor is admitted, but it is never sufficient and cannot set a human, rights, promotion, integration, or release status.

This follows the NIST AI RMF requirement to document test sets, metrics, tools, uncertainty, benchmarks, deployment-relevant conditions, and human-AI responsibilities: <https://airc.nist.gov/airmf-resources/airmf/5-sec-core/>.

### Independent Audit Boundary

The auditor lives outside `scripts/audio_review/` and does not import generator DSP, recipe selection, candidate ranking, or promotion code. Its only inputs are:

- an immutable review-artifact directory;
- the tracked audit policy and family ontology;
- approved, locally cached model code and weight files whose identities match the model manifest;
- a frozen calibration manifest and thresholds;
- an optional owner-controlled holdout available only to the evaluation command.

The generator cannot read AI scores, prompts, holdout labels, or thresholds while creating or tuning candidates. This prevents direct optimization for an evaluator score instead of human meaning. The audit command has no write access to source, candidate, runtime, build, cache, or model directories; it writes a new evidence packet by exclusive creation and atomic rename.

### Two Independent Model Channels

The architecture requires two complementary channels rather than one model score.

1. **Open-vocabulary semantic channel.** A CLAP-family audio-language model compares each audit window with frozen positive, sibling-family, ambiguous-scene, and hard-negative text prompt banks. CLAP connects natural-language descriptions and audio in a shared embedding space, but its similarity is not treated as a calibrated probability: <https://www.microsoft.com/en-us/research/publication/clap-learning-audio-concepts-from-natural-language-supervision/>.
2. **Temporal sound-event channel.** An independently implemented AudioSet-family model detects short speech, music, alarms, sirens, vehicles, machinery, tools, thunder, explosions, human sounds, footsteps, crowds, dominant wildlife, impacts, and other prohibited events. The selected backend must expose frame-level scores. YAMNet is one candidate because it reports 521 AudioSet classes over approximately 0.96-second frames with a 0.48-second hop: <https://github.com/tensorflow/models/blob/master/research/audioset/yamnet/README.md>. PANNs and BEATs remain bake-off candidates rather than pre-approved dependencies: <https://github.com/qiuqiangkong/audioset_tagging_cnn> and <https://www.microsoft.com/en-us/research/publication/beats-audio-pre-training-with-acoustic-tokenizers/>.

The two channels may share public training concepts such as AudioSet, so they are not assumed statistically independent. Disagreement never becomes a vote; it produces `ABSTAIN` or `FAIL` according to the frozen gate.

### Model Selection Bake-Off

No model package or weight file is approved by this design alone. The implementation plan must compare at least:

- one open-vocabulary semantic backend;
- two temporal event backends with different architectures;
- a deterministic no-ML baseline that uses provenance and signal checks only.

Each candidate is evaluated on the same calibration and visible regression data. Selection considers:

- per-family false-accept and false-reject counts;
- prohibited-event recall at the temporal window level;
- `ABSTAIN` coverage and selective risk;
- calibration error and confidence intervals;
- CPU determinism, latency, memory, dependency size, and failure behavior;
- code, model-weight, and dataset licenses;
- exact source/revision/hash provenance and serialization safety;
- ability to run offline without credentials or runtime integration.

A higher public benchmark score does not win automatically. HEAR evaluates audio representations across many domains and explicitly leaves open whether one general representation can match the human ear across tasks: <https://hearbenchmark.com/>.

### Canonical Audit Views

The auditor derives temporary, hash-bound analysis views without changing product bytes:

1. exact selected source excerpt;
2. canonical base PCM;
3. `soft`, `deep`, and `intense` decoded delivery files;
4. loudness-normalized copies used only for semantic comparison;
5. model-native mono/resampled views required by the approved model.

Every conversion records input SHA-256, output SHA-256, decoder, sample rate, channel operation, gain, window boundaries, command arguments, tool version, and environment identity. The original stereo delivery is still used for signal and human checks. Model-native mono views cannot establish stereo quality.

### Temporal Windowing

Whole-file averages are insufficient because they can hide a short voice, alarm, vehicle, bird call, or hard impact. The auditor therefore records:

- whole-file semantic results;
- overlapping semantic-window results using one frozen duration and hop selected during calibration;
- native frame-level event scores from the temporal model;
- maximum, high-percentile, duration-above-threshold, and first/last occurrence for every hard-negative event;
- start/end boundary windows inspected separately for loop-join artefacts.

The initial semantic-window candidate is ten seconds with a five-second hop. It becomes binding only after calibration shows that it detects the visible and hidden failure modes without unacceptable false accepts. Event timing follows the selected model's native framing and must not be replaced by a clip mean.

### Family Ontology And Prompt Bank

The tracked policy defines literal family meaning and hard exclusions without using poetic product subtitles:

| Family      | Required core evidence                                                       | Family-confusion and scene claims that do not count as proof                                                |
| ----------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `forest`    | sustained wooded outdoor ambience with trees or foliage perceptually present | bird-only, insect-only, generic wind-only, village, traffic, night, canopy, or named-location claim         |
| `rain`      | sustained audible rainfall                                                   | thunderstorm, isolated drops, umbrella/interior identity, vehicle wash, or named-surface claim              |
| `ocean`     | sustained sea or ocean waves/surf                                            | cliff-only, harbor-only, generic wind, river, waterfall, or named-coast claim                               |
| `fireplace` | sustained indoor fireplace fire/embers/crackle                               | outdoor campfire, explosion, machinery, isolated impacts, or room narrative not audible in the recording    |
| `river`     | sustained flowing river or stream                                            | dam-only, waterfall-only, rain, ocean surf, wildlife-only, or named-terrain claim                           |
| `wind`      | sustained natural wind or air movement                                       | village ambience, vehicle noise, machinery, whistle, storm/thunder, or foliage/forest scene dominating wind |

For each family the policy contains:

- multiple positive descriptions of the same literal concept;
- the other five families as sibling negatives;
- family-specific confounders and ambiguous mixed scenes;
- universal prohibited-event descriptions;
- a frozen prompt-bank version and SHA-256.

Scores are aggregated across a prompt ensemble rather than one sentence because prompt wording can materially change zero-shot audio classification. Prompt-ensemble improvements have been reported across multiple CLAP-like models and datasets: <https://aclanthology.org/2025.naacl-long.616/>. Prompt additions, removals, translations, or rewording require a new policy version, calibration run, and holdout evaluation.

### Semantic Decision Features

For every source, base, and delivery window the auditor records:

- target-family prompt score distribution;
- best sibling-family score and target margin;
- best hard-negative prompt and margin;
- score variance across positive prompt paraphrases;
- temporal stability across windows;
- source-to-base and base-to-delivery embedding distances;
- trio pairwise distances after analysis-only loudness normalization;
- temporal event scores and durations;
- model-specific raw outputs needed to reproduce the decision.

Embedding proximity is only a drift signal. Deterministic source/window/base identity remains the primary same-scene proof because similar embeddings can conceal a different recording and different embeddings can result from acceptable mastering.

### Calibration And Abstention

Raw model confidence is not accepted. Modern neural-network confidence can be miscalibrated, so any probability-like field requires a predeclared calibration method fitted only on the calibration split: <https://proceedings.mlr.press/v70/guo17a.html>.

The calibration process freezes:

- model and preprocessing identities;
- semantic and event features used by the gate;
- per-family thresholds;
- hard-fail event thresholds and duration rules;
- target-versus-sibling and target-versus-negative margins;
- disagreement, out-of-distribution, and missing-window rules;
- calibration method and parameters;
- acceptable selective-risk and coverage bounds.

The evaluator uses a rejection function rather than forcing a label. Selective classification explicitly models the trade-off between retained coverage and error risk: <https://proceedings.neurips.cc/paper/2017/file/4a8423d5e91fda00bb7e46540e2b0cf1-Paper.pdf>.

The auditor returns `ABSTAIN` when any required score lies outside calibrated support, model channels disagree materially, prompt variance is excessive, a mixed scene has no validated rule, the runtime/model differs from the frozen identity, or the calibration/holdout evidence is insufficient.

### Visible Regression, Calibration, And Holdout Separation

The exact current artifact is a visible regression fixture with owner-provided binary labels:

- expected semantic `PASS`: `fireplace:deep` only;
- expected semantic `FAIL`: the other 17 files;
- overall expected result: `FAIL`.

This is a semantic regression expectation only. `fireplace:deep` does not become source-, recipe-, artifact-, or release-eligible: it remains part of the rejected v1 artifact, and the v2 provenance/recipe gates independently reject that artifact.

Because this fixture and its labels have already influenced the design, it cannot establish independent generalization. The auditor may not tune prompts, features, calibration, or thresholds on this fixture. Those decisions are made from a separate calibration set, then the visible fixture is rerun as a regression check.

A semantic-generalization claim additionally requires an owner-controlled holdout:

- held outside tracked prompts, generator context, RAG, model-tuning packets, and candidate metadata;
- exact manifest hash, creation date, family and failure-mode coverage, and owner custody;
- positive, cross-family, mixed-scene, ambiguous, hard-negative, transient-contamination, mastering, codec, and out-of-distribution cases;
- exposure and near-duplicate checks against calibration, visible fixtures, source candidates, prior artifacts, prompts, and conversation-derived design material;
- retirement and replacement of any exposed holdout item;
- results disclosed only after model, preprocessing, prompts, calibration, and thresholds are frozen.

Test-only contaminations may add short speech, music, alarm, vehicle, animal, impact, or cross-family overlays to rights-clear fixtures. These negative controls remain isolated test data and never enter production, candidates, model training, or runtime bundles.

### Human Ground Truth And Statistical Scope

Owner labels define ZenFlow product fit for the exact reviewed artifacts. They do not prove population-level preference or model generalization. Calibration and holdout records must identify reviewer, method, exact hashes, playback conditions, disagreements, adjudication, and limitations.

If multiple reviewers are used, inter-rater agreement is reported before adjudication and raw disagreement is preserved. A formal generalizable listening study requires a statistically designed panel; ITU-R BS.1284 normally prefers expert listeners and names ten experts as the minimum for high-quality sound evaluation: <https://www.itu.int/dms_pubrec/itu-r/rec/bs/R-REC-BS.1284-2-201901-I%21%21PDF-E.pdf>. An owner-only gate remains valid for product approval but cannot be described as a formal panel result.

Metrics are reported per family and failure mode:

- confusion matrix;
- false-accept and false-reject counts and rates;
- precision and recall for critical rejection classes;
- `ABSTAIN` rate and coverage;
- selective risk versus coverage;
- calibration error and probability-score diagnostics where applicable;
- exact binomial confidence intervals;
- critical misses listed individually.

Aggregate accuracy, mean score, or a majority vote cannot hide one critical false accept. Zero observed false accepts does not establish zero risk. For sufficiently large zero-event samples, the approximate 95% upper bound is `3/n`, which makes the required test size explicit rather than implying certainty from a small fixture: <https://www.bmj.com/content/311/7005/619.abstract>.

### Model And Dataset Documentation

Every admitted backend receives a tracked model card covering intended use, forbidden use, architecture, code and weight provenance, preprocessing, public benchmarks, local calibration, per-family performance, limitations, security, determinism, resource use, and re-review triggers. Model cards are used to expose applicability and limitations rather than turn a public benchmark into local proof: <https://research.google/pubs/model-cards-for-model-reporting/>.

Every calibration or holdout collection receives a datasheet recording motivation, composition, rights, collection, labeling, preprocessing, splits, contamination checks, maintenance, and prohibited reuse: <https://www.microsoft.com/en-us/research/publication/datasheets-for-datasets/>.

### Auditor Admission And Drift

The AI auditor becomes a required promotion gate only after:

- one semantic and one temporal backend complete supply-chain review;
- calibration, visible regression, and hidden holdout all run against exact frozen identities;
- zero critical false accepts occur on the accepted evaluation scope;
- every metric and confidence interval is reported without threshold leakage;
- repeat runs on the canonical CPU environment remain within exact or documented numeric tolerances;
- the owner approves the bounded model card and residual-risk statement.

Before admission, AI status remains `UNVERIFIED` and cannot be represented as a release check. After admission, any change to model code, weights, ML dependencies, OS/architecture, decoder, preprocessing, prompt bank, ontology, calibration data, thresholds, or holdout invalidates the baseline and requires re-evaluation.

## Human Semantic Acceptance

### Blind Mastered-Trio Gate

For each family, the tool presents matched 15-to-20-second excerpts from the exact three mastered output hashes in randomized `X`, `Y`, and `Z` order without level labels. The owner controls switching and may repeat excerpts. Playback gain is matched for the semantic/same-scene question, while a separate unmapped-level pass tests the intended intensity order. The owner must:

1. identify the ascending intensity order correctly;
2. confirm that all three files remain the same family and the same recognizable scene;
3. report any new event, changed location impression, foreground distraction, pumping, harshness, or fatigue;
4. choose `ACCEPT`, `REVISE`, or `REJECT_ALL`.

Failure to order the trio, a perceived scene change, or any family mismatch prevents promotion even when technical metrics pass.

The short-comparison protocol follows the memory, randomization, and listener-controlled switching considerations in ITU-R BS.1284. It is a ZenFlow product test, not a claim of formal ITU or MUSHRA compliance.

### Labeled Confirmation Gate

After the blind order is recorded, the same hashes are revealed as `Soft`, `Deep`, and `Intense`. Each file requires:

- at least ten continuous minutes of looped listening on headphones;
- at least ten continuous minutes of looped listening through a built-in speaker;
- confirmation of family identity, same-scene continuity, loop seam comfort, intensity fit, and fatigue tolerance;
- reviewer identity, UTC timestamp, playback context, device, approximate playback level, environment, exact SHA-256, decision, and notes.

This strict protocol requires at least 360 minutes of playback for the 18 final files across the two required contexts. A review session must not exceed 15 to 20 minutes without interruption; consecutive sessions require a rest period at least as long as the preceding session. Playback time, rest time, and interruptions are recorded separately. The tool may organize playback and validate form completeness, but it cannot claim that listening or rest occurred or fill the decision fields.

The blind method is informed by the bias-control principles of ITU-R BS.1534, but ZenFlow does not claim formal MUSHRA compliance because this is an owner product-fit test rather than a controlled laboratory codec assessment: <https://www.itu.int/rec/R-REC-BS.1534/en>. The report preserves the distinction between owner acceptance, any future expert-panel result, and intended-user research.

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
- `ai-model-manifest.json`;
- `ai-audit-policy.json`;
- `ai-calibration-report.json`;
- `ai-visible-regression.json`;
- `ai-holdout-attestation.json`;
- `ai-audit-report.json`;
- `ai-model-card.json`;
- `ai-dataset-datasheet.json`;
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
- model code, weight, license, dependency, preprocessing, prompt-bank, ontology, calibration, threshold, environment, and report hashes;
- visible-regression expectations and exact output hashes, including `fireplace:deep` as the only current positive control;
- holdout suite identity, custody, non-exposure attestation, coverage, and result binding without exposing private holdout contents;
- per-window semantic/event evidence, AI verdict logic, calibration scope, confidence intervals, and drift status;
- proof that AI output did not create or modify human, rights, promotion, or release fields;
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
- the admitted AI auditor returns `PASS` for all 18 exact delivery hashes with no model, policy, calibration, holdout, environment, or report drift;
- all six blind trio reviews and all 18 labeled reviews have human `PASS`;
- the owner records an explicit rights decision for the selected source hashes;
- none of the 26 denied hashes is present;
- the artifact source head and expected repository head match the approved promotion input;
- all 18 runtime destinations, generated metadata, notices, and cache revision can be committed atomically.

The command must reject `17/18`, mixed artifact IDs, mixed source heads, mixed runtime revisions, AI `FAIL`/`ABSTAIN`/`UNVERIFIED`, missing human evidence, or any attempt to use the rejected v1 artifact. It writes to staging first, verifies the staged tree, and promotes all tracked outputs as one reviewable change.

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
- AI auditor is not admitted: retain `UNVERIFIED` and block promotion without pretending that technical or human evidence ran the missing AI gate.
- AI returns `FAIL`: preserve per-window evidence, keep the candidate outside product paths, and revise the source, window, or mastering recipe rather than weakening prompts or thresholds.
- AI returns `ABSTAIN`: preserve the candidate and investigate coverage, model disagreement, mixed-scene ambiguity, or drift; do not coerce a label.
- Visible regression accepts any of the 17 owner-rejected files or rejects the sole positive without a reviewed explanation: auditor admission fails.
- Hidden holdout is exposed, tuned against, copied into RAG/context, or changed after threshold freeze: invalidate the evaluation and rotate the affected holdout items.
- Model code, weight, dependency, prompt, preprocessing, calibration, threshold, or runtime identity changes: invalidate AI evidence and rerun admission.
- Blind ordering fails or scene identity changes: `REVISE` or `REJECT_ALL` according to the owner decision.
- Human family mismatch: `REJECTED_HUMAN_SEMANTIC_MISMATCH`; automation cannot override it.
- License or item page changes: `RIGHTS_BLOCKED` or `REVOKED`; no cached-rights fallback.
- Package or platform hash mismatch: no promotion or release claim.
- Current worktree becomes unsafe, unlocked, or unexpectedly dirty: preserve evidence and stop synchronization or handoff.

## Security And Privacy Boundary

The acquisition/downloader and model supply chain are separate network and code-execution trust boundaries. They require narrow allowlists, response limits, redirect validation, exclusive writes, hash verification, isolated execution, and the narrowest applicable security-suite scan.

Every model backend requires:

- exact upstream repository, revision, code license, weight license, weight URL, byte count, and SHA-256;
- an explicit review of model-card limitations, training-data provenance, supported inputs, and intended use;
- an offline cache populated only by an explicit acquisition command, never automatic inference-time download;
- safe serialization when an upstream format permits it; `safetensors` or a validated non-executable format is preferred;
- a sandboxed, read-only CPU process with no credentials, network, repository write access, production data, or user files;
- resource limits for file size, duration, decode time, memory, CPU time, output rows, and evidence bytes;
- a pinned Python/OS/architecture/dependency environment and current vulnerability scan;
- no native plugin, custom operator, distributed service, telemetry, or runtime package.

PyTorch states that models should be treated as programs and that loading an untrusted model is equivalent to running untrusted code: <https://github.com/pytorch/pytorch/blob/main/SECURITY.md>. A PyTorch backend must use a current patched release and cannot load an unaudited pickle/`.pth` checkpoint on the host. The implementation review must account for the published checkpoint-loading vulnerability affecting PyTorch versions through 2.9.1: <https://github.com/pytorch/pytorch/security/advisories/GHSA-63cw-57p8-fm3p>.

Canonical AI evidence runs on the frozen CPU environment. GPU/MPS results may be recorded as performance experiments but cannot replace the canonical report because PyTorch does not guarantee identical results across releases, commits, platforms, or CPU/GPU backends: <https://docs.pytorch.org/docs/stable/notes/randomness.html>.

The pipeline processes public source recordings and private rights receipts only. It must not read or emit journal content, recorded user audio, user IDs, emails, auth tokens, environment files, production data, telemetry payloads, or credentials. Logs use candidate IDs and hashes, not secret URLs or raw headers.

No source, review, rights, model, calibration, or AI-audit tool enters the production runtime bundle.

## Platform And Domain Matrix

| Surface           | Impact                                         | Required evidence before release                                                                    | Current status                              |
| ----------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Web/Vite          | New versioned asset paths and literal labels   | production build, exact `dist` hashes, user-start playback, clean console/network                   | `UNVERIFIED`                                |
| Installed PWA     | Cache revision and offline/range playback      | exact cache manifest, full-body hash admission, offline playback, stale-revision rejection          | `UNVERIFIED`                                |
| Android/Capacitor | Packaged v2 bytes and labels                   | `cap:sync:android`, APK/AAB hashes, installed playback, focus/background smoke                      | `UNVERIFIED`                                |
| iOS/WKWebView     | Packaged v2 bytes and labels                   | `cap:sync:ios`, app/archive hashes, gesture unlock and interruption smoke                           | `UNVERIFIED`                                |
| Desktop/Tauri     | Packaged v2 bytes and labels                   | package resource hashes, installed playback, suspend/resume smoke                                   | `UNVERIFIED`                                |
| Store/Release     | Rights and signed-artifact identity            | private rights packet, owner/legal decision, signed artifact, submission and publication evidence   | `UNVERIFIED`                                |
| Accessibility     | Audio remains optional and user-started        | master mute, visible non-audio state, keyboard/screen-reader controls, no surprise resume           | existing behavior retained; v2 `UNVERIFIED` |
| Localization/RTL  | Literal level copy in eight locales            | key parity, translation checks, `ar`/`he` RTL review, qualified-human language review               | `UNVERIFIED`                                |
| AI Audit          | Offline review-only semantic and event models  | admitted model cards, calibration, visible regression, hidden holdout, repeatability, exact reports | `UNVERIFIED`                                |
| Performance       | Same 18-role runtime scope; audit runs offline | runtime bundle delta, no eager preload, decode/start latency, audit CPU/memory/time ceilings        | `UNVERIFIED`                                |
| Security/Privacy  | Build-time source and model acquisition only   | narrow security suite, weight/dependency/source/secret scans, sandbox, no runtime dependency or PII | `UNVERIFIED`                                |
| Auth/Storage/Sync | No contract change                             | diff proves no affected runtime path                                                                | expected `N/A`; implementation `UNVERIFIED` |

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
16. require separate semantic and temporal model receipts and reject a single-score auditor;
17. reject whole-file-only aggregation that hides a prohibited transient event;
18. require per-window target, sibling, hard-negative, prompt-variance, and event evidence;
19. require calibrated per-family thresholds and reject raw confidence presented as probability;
20. emit `ABSTAIN` for uncalibrated, out-of-distribution, contradictory, low-margin, excessive-prompt-variance, or drifted inputs;
21. freeze prompt, ontology, preprocessing, calibration, threshold, model, weight, dependency, and environment hashes before evaluation;
22. prevent calibration, generator, RAG, and candidate processes from reading hidden holdout content or labels;
23. invalidate an exposed, near-duplicate, or post-freeze-modified holdout;
24. preserve the current visible regression expectation: only `fireplace:deep` is positive and the other 17 are negative;
25. fail auditor admission when any owner-negative visible fixture is accepted or the positive is rejected without a reviewed disposition;
26. report per-family false accepts, false rejects, abstention, selective risk, calibration diagnostics, confidence intervals, and every critical miss;
27. reject aggregate accuracy or majority voting as an override for a critical false accept;
28. fail on model code/weight/license/hash drift, unsafe serialization, inference-time download, network access, credentials, or audit writes outside its evidence root;
29. prove canonical CPU repeatability within frozen numeric tolerances and classify cross-backend differences as drift evidence;
30. prove no ML model, weight, native library, audit package, prompt bank, calibration data, or holdout content enters source/runtime bundles or platform artifacts.

After the minimal implementation turns those tests green, rerun the focused builder/auditor Python suites, model-manifest and sandbox checks, visible regression, owner-controlled holdout, focused Vitest suites, existing Hyperfocus and app-audio checks, translation checks, no-AI-template and best-practices guards, production-data-integrity diff scan, build, artifact scans, and platform-specific package evidence.

Security scanning applies to source acquisition, model/dependency acquisition, checkpoint loading, decoder inputs, evidence parsing, and isolated execution. Missing Snyk or scanner authorization is `UNVERIFIED`, not `PASS`.

## Expected Implementation Write Set

The implementation plan may include only task-grounded changes under:

- `config/audio/` for v2 candidate, recipe, review, quarantine, family ontology, prompt-bank, model-manifest, calibration, threshold, and evidence schemas;
- `scripts/audio_review/` and focused tests for acquisition, audition, base-loop, mastering, verification, and promotion;
- a new isolated `scripts/audio_audit/` package and focused tests for read-only preprocessing, semantic/event backends, calibration, abstention, visible regression, hidden-holdout evaluation, reporting, and independent verification;
- a separate hash-locked audit-only dependency manifest under `scripts/audio_audit/`; no ML dependency may be added to production dependencies or loaded by app code;
- `.github/workflows/cc0-kimi-audio-review.yml` for review-only artifact generation and validation;
- `docs/audio/` for source shortlist, operator flow, provenance, rights, QC, AI model cards, dataset datasheets, calibration, semantic evidence, and residual-risk contracts;
- `src/lib/hyperfocusAudioCatalog.ts` and its tests for literal fallback labels without ID changes;
- the eight existing `src/i18n/languages/*.ts` files and translation tests;
- generated Hyperfocus manifest/provenance files;
- `public/sounds/hyperfocus/` only after a separate promotion gate accepts all 18 exact hashes;
- service-worker/cache ownership only when characterization proves a revision update is required;
- `THIRD_PARTY_NOTICES.md` after selected source receipts identify the exact authors and items.

Unexpected auth, storage, sync, journal, monetization, general UI, native-source, dependency, or unrelated documentation changes require a new scoped decision.

## Risks And Rejection Criteria

| Risk                                  | Mitigation                                                                       | Reject or stop when                                                          |
| ------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| CC0 label is inaccurate or incomplete | item-specific receipt, snapshots, hashes, owner/legal review                     | source/page/license evidence is missing, changed, or contradictory           |
| Blind test is biased                  | hidden source names, equal playback gain, randomized mapping, `NONE`             | mapping leaks or current source is identified                                |
| Levels become different scenes        | one source, one window, one base PCM hash                                        | any trio member differs on source/window/base                                |
| Mastering invents content             | operation allowlist and bounded parameters                                       | recipe adds texture, source, event, pitch/time, width, or random offset      |
| Metrics pass but meaning fails        | blind ordering plus labeled owner review                                         | owner cannot order intensity or hears a family/scene mismatch                |
| One AI score appears authoritative    | separate semantic/event channels, calibrated margins, `ABSTAIN`, human authority | one model, aggregate, or raw confidence is used as release proof             |
| Auditor is tuned to known failures    | distinct calibration, visible regression, and owner-controlled hidden holdout    | prompts/thresholds consume holdout data or current 18 are called independent |
| Short contaminant is averaged away    | native temporal frames plus max/percentile/duration evidence                     | only whole-file means are recorded                                           |
| Model or prompt drift changes verdict | exact code/weight/prompt/preprocess/calibration/runtime hashes                   | any bound identity changes without full re-admission                         |
| Model weights execute untrusted code  | audited source, safe format, patched framework, isolated offline CPU process     | unaudited checkpoint or automatic download would execute                     |
| Review is fabricated or stale         | exact hashes, contexts, timestamps, immutable state transitions                  | required listening evidence is incomplete or bound to other bytes            |
| Stale runtime bytes survive           | versioned filenames and exact package hashes                                     | cache/native package does not match promoted manifest                        |
| Partial pack reaches users            | atomic `18/18` promoter                                                          | any family or platform artifact is incomplete or mixed                       |
| Rollback selects rejected material    | previous released revision only                                                  | target is v1 rejected artifact or lacks exact reviewed hashes                |

## Done Criteria

Implementation is complete only when current evidence proves:

- six owner-selected CC0 sources and six owner-selected source windows;
- one source SHA, window, and base PCM SHA shared by every family trio;
- no synthetic layer, added recording, alternate window, or prohibited transform;
- all 18 literal family/level mappings and all eight locale values are consistent;
- source, rights, blind mapping, base, recipe, output, artifact, runtime, and package hashes agree;
- every technical gate passes without weakened thresholds or exclusions;
- one admitted open-vocabulary semantic backend and one admitted temporal event backend match their exact audited model manifests;
- calibration, visible regression, owner-controlled hidden holdout, confidence intervals, and canonical CPU repeatability are current for the frozen auditor identity;
- the visible regression reports only `fireplace:deep` as positive and all other current artifact files as negative, with no critical false accept hidden by aggregation;
- all 18 v2 files receive AI `PASS`; any `FAIL`, `ABSTAIN`, `UNVERIFIED`, drift, or exposed holdout blocks promotion;
- no AI output created or modified human, rights, promotion, integration, release, store, or publication evidence;
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
- No semantic or temporal model backend, code revision, weight file, license, dependency lock, safe serialization path, sandbox, prompt bank, calibration set, threshold set, hidden holdout, model card, or dataset datasheet has been admitted.
- The owner's `1 PASS / 17 FAIL` feedback is available in the conversation and bounded to the exact artifact, but the durable hash-bound review receipt remains pending and cannot be filled by an agent.
- AI precision, recall, false-accept risk, abstention coverage, calibration, latency, memory, determinism, and supply-chain security remain `UNVERIFIED` until implementation and admission evidence exist.
- No v2 human listening, legal decision, platform package, runtime, signed artifact, store, deployment, or public-release proof exists.
- Native-speaker quality for updated translations has not been reviewed.
- The existing broad `check:app-audio` historical-output condition must be freshly characterized before release work; this design does not authorize cleanup.

## Approval Boundary

Owner approval of this committed specification authorizes creation of a detailed implementation plan. It does not itself authorize:

- downloading or purchasing a source;
- downloading, installing, or executing model code, model weights, ML frameworks, native ML libraries, or new dependencies;
- choosing a model backend, weight format, calibration corpus, threshold, or residual-risk acceptance without the implementation-plan evidence and required approval;
- accepting a rights or human-review decision on the owner's behalf;
- moving, deleting, or cleaning historical artifacts;
- promoting audio into product paths;
- committing private source recordings or full rights snapshots;
- pushing the branch, opening or merging a pull request, deploying, changing remote flags, or submitting a store release.

Those actions remain subject to the implementation plan, repository gates, exact-target verification, and any explicit action-boundary approval.
