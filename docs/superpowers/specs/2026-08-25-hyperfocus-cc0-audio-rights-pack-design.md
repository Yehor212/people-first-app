# Hyperfocus CC0 Audio Rights Pack Design

## Status

- Design direction approved by the owner on 2026-08-25.
- Implementation is not approved until the owner reviews this written specification.
- No quarantined audio bytes may enter a build, candidate, source master, or release artifact.

## Goal

Replace the complete 18-file Hyperfocus nature pack with newly produced, rights-traceable local audio while preserving the existing six families, three intensity levels, saved identifiers, user controls, and cross-platform runtime behavior.

The resulting release must prove both technical correctness and a reviewable chain of rights. Audio quality, file presence, a provider's general terms, or a green build cannot substitute for source-specific provenance and human listening approval.

## Approved Direction

Use a clean rebuild from source recordings whose official item pages explicitly apply CC0 or an equivalent public-domain dedication that permits commercial use, modification, and redistribution. The current primary source catalog is BigSoundBank / LaSonotheque because its item pages identify the author and recording details and explicitly permit use in apps, transformation, commercial use, and redistribution.

The rebuilt pack must not use:

- Kimi-generated or Kimi-processed bytes;
- any of the 17 review-only quarantined MP3 files;
- the nine blocked recovered files;
- Mixkit source recordings or their current derived MP3 files;
- AI audio model outputs;
- voice, breath, musical, melodic, rhythmic, or artist-style references;
- any source without an exact source-file hash and a contemporaneous rights receipt.

The eight current non-Hyperfocus first-party files remain unchanged:

- `soft-air-veil.mp3`;
- `gentle-water-bed.mp3`;
- `soft-rain-veil.mp3`;
- `feedback-success.mp3`;
- `feedback-complete.mp3`;
- `feedback-streak.mp3`;
- `feedback-milestone.mp3`;
- `feedback-notification.mp3`.

## Why The Current Pack Is Not The Target

The current 18 Hyperfocus files pass the repository's objective QC. They are not being replaced because the files are technically broken. They are being replaced to improve the rights boundary for a public repository and downloadable public assets.

The current Mixkit license permits sound effects in commercial End Products, including games, but prohibits redistributing an item on its own, as stock, in a tool or template, or with source files. ZenFlow publishes MP3 files in a public repository and serves them as directly addressable web assets. This creates avoidable interpretation risk even though bundled app use is permitted.

BigSoundBank's item pages and license permit commercial use, adaptation, and redistribution. CC0 still provides no warranty that every possible third-party right is absent, so a current source-specific receipt and owner/legal review remain mandatory.

## Existing Evidence Boundary

The recovery ledger records two distinct groups:

1. Seventeen source-derived Hyperfocus candidates are quarantined because they are 44.1 kHz and lack updated output hashes, progression ledgers, and fresh human listening approval.
2. Nine recovered files lack sufficient hash-bound generation or redistribution evidence. Their concepts already have current release replacements and the recovered bytes remain blocked.

The external review folder is listening evidence only. It is not a source library, product lane, or release handoff.

## Existing Reconstruction Branches

Two unmerged remote branches already contain review-only reconstruction work and must be treated as untrusted prior implementation, not duplicated blindly.

### CC0 branch selected for salvage

`origin/codex/cc0-kimi-audio-reconstruction` at `9f7e037a24a26793932a4d0dbb63341b03823a74` contains 19 changed paths and a 19-commit Python review tool. It already implements:

- an exact 26-role review-only specification;
- fail-closed BigSoundBank page/license/audio acquisition;
- source, page, license, recipe, output, and package hashing;
- 48 kHz stereo DSP and MP3 encoding through `libmp3lame`;
- first-party deterministic ambience and feedback reconstruction;
- objective QC, atomic package promotion, and independent verification;
- a read-only GitHub Actions artifact workflow;
- a human-review packet with every decision initially pending.

Current CI evidence is partial:

- 14 Python tests passed on GitHub Actions;
- Drift Checks passed;
- Production Data Integrity passed;
- the live review-package build failed closed at source item `2715` because the page parser did not recognize the live page body's formatted sound number;
- no review artifact was produced by the CC0 workflow;
- no human listening or runtime promotion was performed.

The failed live run is <https://github.com/Yehor212/people-first-app/actions/runs/32800166841>. Its failure is evidence that the rights gate stopped on live-page drift, not evidence that the source was accepted or rejected artistically.

The implementation plan must audit and selectively reuse this exact branch. It must fix the page-number binding without weakening the source identity gate, then rerun the live build. Rewriting the tool from scratch is allowed only if the audit proves the existing boundary cannot be repaired safely.

### First-party branch retained as fallback only

`origin/codex/first-party-audio-reconstruction-v5` at `bef29b538891695e56adf90a12567bef74fbf2c5` produced a successful deterministic first-party review artifact. It is a different artistic and rights approach. It must not be merged with the CC0 source pipeline or used as silent fallback. Switching to it requires a new owner design decision because the approved direction is realistic CC0 field-recording reconstruction.

## External Rights Basis

- Apple App Review Guideline 5.2 requires app content to be created by the developer or licensed for use and requires authorization to be available on request: <https://developer.apple.com/app-store/review/guidelines/>.
- Google Play Developer Distribution Agreement sections 11.1 and 11.2 require the developer to own the applicable rights or have permission to distribute third-party material: <https://play.google.com/intl/ALL_us/about/developer-distribution-agreement.html>.
- Mixkit's Sound Effects Free License permits commercial End Products but prohibits redistribution of an item on its own, as stock, in a tool/template, or with source files: <https://mixkit.co/license/#sfxFree> and <https://mixkit.co/terms/>.
- BigSoundBank explicitly permits commercial use, adaptation, and redistribution and identifies its public-domain-equivalent terms as CC0: <https://bigsoundbank.com/licenses.html>.
- The canonical CC0 1.0 deed permits copying, modification, distribution, and performance, including commercial use, while warning that it gives no warranty and does not clear unrelated third-party rights: <https://creativecommons.org/publicdomain/zero/1.0/>.
- The U.S. Copyright Office states that prompt-only generative output is not protected without sufficient human authorship. This is a U.S. copyrightability boundary, not a global legal conclusion: <https://www.copyright.gov/newsnet/2025/1060.html>.

These sources justify the technical evidence strategy. They do not authenticate a specific downloaded file, replace source-specific receipts, or constitute legal advice.

## Product Scope

### In Scope

- Rebuild all 18 variants:
  - `forest:{soft,deep,intense}`;
  - `rain:{soft,deep,intense}`;
  - `ocean:{soft,deep,intense}`;
  - `fireplace:{soft,deep,intense}`;
  - `river:{soft,deep,intense}`;
  - `wind:{soft,deep,intense}`.
- Preserve current runtime filenames unless a versioned filename is required for reliable cache invalidation.
- Preserve family IDs, level IDs, legacy aliases, localized labels, Settings controls, comfort profiles, master mute, and user-start semantics.
- Add source acquisition, provenance, quarantine-denylist, deterministic processing, QC, packaging, and release-evidence contracts.
- Produce private, hash-bound source and license receipts.
- Produce human listening materials and require owner `AUDIO_FIT` acceptance.
- Verify Web/Vite, installed PWA, Android/Capacitor, iOS/WKWebView, and Desktop/Tauri artifacts.

### Non-Goals

- No redesign of Hyperfocus UI or audio controls.
- No new sound families or levels.
- No migration of user preferences or storage identifiers.
- No notification-channel sound changes.
- No microphone permission, runtime recording, streaming audio, or remote audio generation.
- No paid service, paid API, commissioned recording, or new production dependency without separate owner approval.
- No attempt to make the new files waveform-identical to quarantined audio.
- No claim that an agent can provide legal advice, human artistic acceptance, store approval, or published-release proof.

## Source Candidate Matrix

The following pages are acquisition candidates, not pre-approved artistic selections. A source can enter private staging only after its live item page still states CC0 or an equivalent public-domain dedication and the downloaded file matches a newly recorded SHA-256 receipt.

| Family    | Primary candidates                                                                                                                                                                                                                                                   | Initial role                                                    | Reject when                                                                                        |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Forest    | BigSoundBank [`Forest #2` item 1348](https://bigsoundbank.com/forest-2-s1348.html); [`Forest #3` item 2715](https://bigsoundbank.com/forest-3-s2715.html)                                                                                                            | long 48 kHz stereo beds for soft/deep/intense derivation        | foreground speech, traffic, machinery, repetitive bird call, hard transient                        |
| Rain      | [`Summer Rain on Terrace` item 1019](https://bigsoundbank.com/summer-rain-on-terrace-s1019.html); [`Rain on concrete` item 1289](https://bigsoundbank.com/rain-on-concrete-s1289.html)                                                                               | stereo rain bed plus optional impact texture                    | thunder, vehicle/interior identity, sharp isolated drops, mono image that cannot be safely widened |
| Ocean     | [`Sea Waves` item 698](https://bigsoundbank.com/sea-waves-s0698.html); [`Cliff #1` item 2570](https://bigsoundbank.com/cliff-1-s2570.html)                                                                                                                           | moderate and stronger 48 kHz stereo surf                        | voices, close wildlife calls, harsh crash repetition, unsafe peak structure                        |
| Fireplace | [`Fireplace #4` item 2856](https://bigsoundbank.com/fireplace-4-s2856.html)                                                                                                                                                                                          | one 48 kHz stereo indoor-hearth master for three derived levels | outdoor ambience, voices, metal impacts, dominant one-shot crack                                   |
| River     | [`Small Stream #4` item 1354](https://bigsoundbank.com/small-stream-4-s1354.html); [`Mountain Stream #7` item 3222](https://bigsoundbank.com/mountain-stream-7-s3222.html); [`Mountain stream #1` item 2754](https://bigsoundbank.com/mountain-stream-1-s2754.html)  | low, medium, and dense 48 kHz stereo flow candidates            | voices, footsteps, traffic, loud birds, waterfall roar that masks focus                            |
| Wind      | [`Wind in Tall Grass` item 908](https://bigsoundbank.com/wind-in-tall-grass-s0908.html); [`Wind in the Trees` item 904](https://bigsoundbank.com/forest-wind-in-the-trees-s0904.html); [`Wind in shrub` item 907](https://bigsoundbank.com/wind-in-shrub-s0907.html) | soft vegetation, medium canopy, and denser wind candidates      | microphone overload, branches striking, speech, vehicles, repetitive squeaks                       |

Human selection may choose one source for all three levels of a family when deterministic processing produces a clear progression. It may choose separate sources only when they remain perceptually coherent and pass the foreground-distraction gate.

The existing CC0 branch declares the earlier shortlist `100, 2715, 699, 2679, 1019, 1047, 698, 2570, 2856, 823, 3218, 871, 908, 904, 625`. Every item in that list remains `UNVERIFIED` for the new pack until its live page, downloaded hash, rights receipt, technical properties, and human source screening pass. The implementation plan must compare that exact list with the independently researched matrix above, retain only source-specific winners, and update the review specification through a test-first commit rather than silently mixing the lists.

## Rights Architecture

### Private Rights Receipt

Each acquired source receives a private receipt under an ignored task-local evidence directory outside shipped asset paths. The receipt binds:

- provider and canonical item-page URL;
- item number and source title;
- named author or recorder shown on the item page;
- license identifier and canonical license URL;
- acquisition timestamp in UTC;
- final resolved download URL and redirect chain without credentials;
- source filename, bytes, MIME signature, sample rate, channels, bit depth, and duration;
- source-file SHA-256;
- SHA-256 of a saved item-page snapshot;
- SHA-256 of a saved license-page snapshot;
- a normalized permission statement covering commercial use, adaptation, distribution, and redistribution;
- a normalized restrictions and warranty statement;
- the operator identity that performed the acquisition;
- review status: `ACQUIRED`, `RIGHTS_REVIEWED`, `REJECTED`, or `REVOKED`.

Saved HTML/PDF receipts remain private release evidence and are not committed. The tracked rights manifest records their hashes and canonical URLs but not the provider's full page content.

### Tracked Rights Manifest

Add a machine-readable tracked manifest at `docs/audio/hyperfocus-cc0-rights-manifest.json`. It maps every source hash and every final output hash to:

- source ID and item number;
- provider and author;
- license identifier and URL;
- acquisition date;
- private receipt hashes;
- processing recipe ID and version;
- output variant ID, path, SHA-256, and bytes;
- technical QC status;
- human review status;
- owner/legal decision status;
- revocation and rollback fields.

The manifest may say `UNVERIFIED` while work is in progress. It must never say `PASS`, `APPROVED`, or `RELEASED` without the corresponding current evidence.

### Notices And Rights Claims

- Update `THIRD_PARTY_NOTICES.md` with BigSoundBank / LaSonotheque, the selected item numbers, authors, and CC0 reference.
- Keep attribution even when not mandatory.
- Do not register source recordings or the derived pack in Content ID or another rights-management system.
- Do not claim ownership of the original CC0 recordings.
- Human-authored processing, arrangement, and code may be documented without asserting exclusivity over the source recording.
- Store authorization evidence must be available privately if Apple or Google requests it.

## Quarantine Architecture

Add `config/audio-quarantine-denylist.json` as the machine-readable canonical denylist for the 26 recovered hashes in the recovery ledger.

Each entry records:

- SHA-256;
- original recovery filename;
- classification: `QUARANTINED` or `BLOCKED`;
- reason;
- evidence ledger path;
- prohibition: `NO_SOURCE`, `NO_DERIVATION_INPUT`, `NO_RUNTIME`, `NO_PACKAGE`, `NO_RELEASE`.

The validator fails when any denied hash appears in:

- task-local source staging;
- candidate staging;
- `public/sounds`;
- `docs/sounds`;
- `dist`;
- Android assets, APK, or AAB;
- iOS app assets or packaged archive;
- Tauri resources or installers;
- release evidence directories.

Filename equality is not a violation because product filenames are intentionally stable. Hash equality is always a blocking violation.

## Source Acquisition Boundary

Create a dedicated acquisition command that performs no product writes. It must:

1. Accept only source IDs declared in the tracked candidate manifest.
2. Use HTTPS and an exact BigSoundBank host allowlist.
3. Reject credentials, userinfo, query secrets, unexpected ports, unsupported redirects, and cross-host download redirects unless explicitly declared.
4. Enforce response-size, content-signature, and audio-format limits.
5. Download into a new private temporary directory.
6. Compute and compare SHA-256 before promotion to private source staging.
7. Save item/license receipts and their hashes in the same transaction.
8. Use exclusive creation and atomic rename inside the exact private staging root.
9. Refuse to overwrite an existing source or receipt.
10. Leave partial downloads outside every product and release path.

Network unavailability, page drift, missing license language, or a changed source hash is `STOP`, not permission to reuse an old or quarantined file.

## Deterministic Processing Boundary

Create one generator-owned build command for Hyperfocus CC0 outputs. It reads only:

- the tracked source/recipe manifest;
- private source files whose hashes match approved receipts;
- fixed processing parameters committed with the generator.

It performs:

1. decode to 48 kHz stereo PCM;
2. deterministic segment selection;
3. channel validation; a mono source may be used only as a subordinate texture mixed beneath an independently verified stereo bed, never as the sole source and never through artificial stereo widening;
4. high-pass/low-pass shaping appropriate to the family;
5. deterministic loop crossfade;
6. transient control without destructive limiting;
7. deterministic level-specific density and gain shaping;
8. encode to the approved MP3 profile;
9. decode the final MP3 for metrics;
10. write candidates only to task-local candidate staging;
11. emit a recipe/input/output hash report.

The generator must not write directly to `public/sounds/hyperfocus`. Promotion is a separate explicit step that requires all machine gates plus human selection.

The encoder version, license, invocation, and whether its code enters the runtime bundle must be recorded. `lamejs@1.2.1` may remain a dev-time encoder only after the project owner or qualified reviewer accepts the LGPL obligations. Without that decision, encoder legal status remains a blocking `UNVERIFIED` row.

## Audio Quality Contract

Every promoted output must satisfy the current Hyperfocus contracts plus the additions below.

### Format

- MP3;
- 48,000 Hz decoded sample rate;
- two channels;
- decoded duration from 29.9 through 30.1 seconds, including documented encoder padding;
- 128 kbps encoding across all 18 files;
- bounded bytes consistent with current bundle budgets.

### Signal

- no clipped decoded samples;
- bounded peak and RMS;
- bounded start/end RMS delta;
- bounded seam mean absolute difference;
- no unsafe DC offset;
- no start or end transient caused by the loop join;
- family progression strictly satisfies `soft < deep < intense` under the repository intensity metric;
- soft-to-deep and deep-to-intense gaps are each at least 3.0 intensity-score points and remain perceptible in human review.

### Audible Exclusions

- speech, intelligible or indistinct;
- breathing or human body sounds;
- melody, harmony, beat, song, or musical instrument;
- siren, alarm, notification-like cue, or emergency signal;
- thunder or explosion;
- foreground children, crowd, footsteps, vehicles, tools, or machinery;
- harsh one-shot impact;
- repetitive wildlife call that dominates attention;
- obvious loop cadence or phase cancellation.

Automated classification may flag candidates but cannot produce `AUDIO_FIT` approval.

## Human Review Contract

The owner review bundle contains blind labels rather than provider or candidate names. For each variant it provides:

- current release reference;
- new CC0 candidate;
- optional quarantined listening reference located outside the worktree and never copied into it;
- waveform and objective metrics as secondary evidence;
- normalized playback gain so loudness alone does not bias selection.

Required human checks:

1. Source screening for speech, music, distractions, or content mismatch.
2. Short A/B review of current versus new candidate.
3. Seam listening across repeated loop boundaries.
4. At least ten continuous minutes for every candidate that remains eligible.
5. Low-volume headphones and ordinary speaker playback.
6. Soft/deep/intense progression review within each family.
7. Fatigue and irritation review after repeated use.

Each candidate receives `ACCEPT`, `REVISE`, or `REJECT` with reviewer, timestamp, playback context, and notes. Only a real owner or explicitly designated human reviewer can set `AUDIO_FIT=PASS`.

## Runtime Integration

Keep the existing runtime boundary:

- `src/lib/hyperfocusAudioCatalog.ts` owns family/level mappings and aliases.
- `src/lib/hyperfocusGeneratedAudioManifest.ts` owns promoted file metadata.
- `public/sounds/hyperfocus/` owns current web/native source assets.
- `scripts/check-hyperfocus-audio-assets.cjs` owns objective pack validation.
- `scripts/check-app-audio-assets.cjs` owns cross-inventory/stale-path validation.

Integration updates only generator-owned metadata, provenance, notices, cache revisions, and the 18 promoted bytes. No component, state, storage, or user-copy change is expected.

If runtime filenames remain unchanged, the service-worker and native packaging evidence must prove that stale cached bytes cannot survive the revision. If that proof is not reliable, use versioned filenames and update only the generated manifest while preserving semantic IDs.

## Offline And Lifecycle Contract

- Audio remains user-started; no autoplay or cold-start warming.
- Long ambience is fetched or decoded only after explicit selection or playback intent.
- PWA cache admission accepts only same-origin, manifest-listed complete `200` bodies whose path, revision, size, content type, and SHA-256 match the manifest.
- Range playback is permitted only from a verified full cached body.
- Offline deletion remains selected and app-owned; no broad cache deletion.
- Resume after interruption is explicit from the originating control or mapped Media Session action.
- Android audio focus, iOS interruptions, document visibility, app backgrounding, and Desktop suspension must not cause surprise playback.
- Audio never carries the only completion or state feedback.

## Platform Evidence Matrix

| Surface           | Required evidence before release                                                                                                  | Current design status                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Web/Vite          | production build, exact 18 output hashes in `dist`, user-start playback, clean console/network, no external runtime audio request | `UNVERIFIED`                                      |
| Installed PWA     | cache revision, full-body hash admission, offline playback, Range behavior, quota/delete behavior, explicit resume                | `UNVERIFIED`                                      |
| Android/Capacitor | `cap:sync:android`, exact APK/AAB entries and hashes, installed playback, focus/interruption/background smoke                     | `UNVERIFIED`                                      |
| iOS/WKWebView     | `cap:sync:ios`, exact app/archive entries and hashes, gesture unlock, interruption and route-change smoke                         | `UNVERIFIED`                                      |
| Desktop/Tauri     | production package entry/hash proof, installed playback and suspend/resume smoke                                                  | `UNVERIFIED`                                      |
| Store/Release     | private rights packet, accurate release/review notes, signed artifact identity, submission state, publication state               | `UNVERIFIED`                                      |
| Accessibility     | master mute, per-category controls, visible non-audio feedback, no surprise playback                                              | existing contract retained; new pack `UNVERIFIED` |
| Performance       | bundle-size delta, decode/start latency, memory behavior, no eager loading                                                        | `UNVERIFIED`                                      |
| Security/Privacy  | no runtime SDK, streaming, credentials, microphone permission, PII, raw URL/error telemetry                                       | design requirement; implementation `UNVERIFIED`   |

## Governance And Expected Write Set

Implementation must begin with an `AGENT_CHANGE_NOTICE` because it changes protected scripts, configuration, release evidence, service-worker behavior, and cross-platform assets. The notice must bind the exact worktree, base SHA, expected write set, rollback, and tests before the first production or generator edit.

Expected tracked paths are limited to:

- selectively reused and reviewed `.github/workflows/cc0-kimi-audio-review.yml`;
- selectively reused and reviewed `config/audio/cc0-kimi-audio-review-spec.json`;
- selectively reused and reviewed `scripts/audio_review/` tooling and tests;
- existing review-only CC0 design, plan, and operator documentation when needed to preserve provenance of the prior implementation;
- new source/recipe and rights manifests under `docs/audio/`;
- new quarantine denylist under `config/`;
- acquisition, generation, and validation scripts plus focused tests under `scripts/`;
- `package.json` script wiring only when a first-party command needs registration;
- 18 promoted files under `public/sounds/hyperfocus/` only after all promotion gates pass;
- generated `src/lib/hyperfocusGeneratedAudioManifest.ts`;
- current Hyperfocus provenance, intensity, QC, notices, and release documentation;
- `src/sw.ts` or an owned audio-cache manifest only when characterization proves a cache revision change is required.

Unexpected UI, storage, sync, auth, monetization, translation, native source, or unrelated documentation changes are out of scope and require a new design decision.

## Verification Plan

### Baseline

- Record exact `origin/main`, current 18 release hashes, quarantine manifest hash, and recovery-ledger hash.
- Run `npm run check:hyperfocus-audio`.
- Run `npm run check:app-audio` and preserve every existing failure as baseline evidence.
- Record current package scripts, manifests, runtime mappings, PWA cache behavior, and platform artifact state.

### Test-First Changes

Before production scripts or assets change, add failing tests for:

- exact denylist coverage of all 26 recovered hashes;
- rejection of a denied hash at every source/candidate/runtime/package boundary;
- source receipt schema and source SHA enforcement;
- license receipt hash enforcement;
- acquisition host/redirect/path/overwrite failure paths;
- generator refusal when source rights are not `RIGHTS_REVIEWED`;
- generator determinism and recipe/input/output hash binding;
- no Kimi, Mixkit, or AI-audio source provider in the new pack;
- exact 18-file format and progression requirements;
- manifest/provenance/output equality;
- stale cache revision rejection;
- current semantic IDs and legacy aliases remaining unchanged.

### Focused Green Evidence

At minimum:

```text
npm run check:hyperfocus-audio
npm run check:app-audio
npm run test -- src/lib/__tests__/hyperfocusAudioProgression.test.ts
npm run test -- src/lib/__tests__/hyperfocusAudioCatalog.test.ts
npm run test -- src/lib/__tests__/hyperfocusAudioCatalog.generatedManifest.test.ts
npm run test -- scripts/__tests__/check-hyperfocus-audio-assets.test.ts
npm run test -- scripts/__tests__/check-app-audio-assets.test.ts
npm run check:no-ai-templates
npm run check:best-practices
npm run check:all
npm run build
```

Run Snyk or the documented local fallback for changed JavaScript/TypeScript, and run the narrowest relevant local security-suite profile for the acquisition/downloader trust boundary. A blocked scanner is `UNVERIFIED`, not `PASS`.

### Artifact Proof

- Web `dist` manifest and per-file SHA-256.
- PWA cache manifest revision and runtime receipt.
- Android APK and release AAB archive entry hashes.
- iOS generated app and release archive entry hashes.
- Desktop package resource hashes.
- Hash scan proving none of the 26 denied hashes is present.
- Source-to-output rights manifest whose output hashes match every packaged target.

## Existing `check:app-audio` Failure

The current broad check fails because historical `output/**` snapshots contain stale audio paths. This is not evidence that the current 18 Hyperfocus source files fail objective QC, but it is a real release-gate failure.

The implementation must not weaken or bypass the scan. Before release:

1. Inventory every matched top-level output artifact and hash the exact directories.
2. Classify each as active evidence, recovery evidence, or disposable generated output.
3. Request owner authorization for an exact recoverable move of recovery material outside the repository root.
4. Move only approved paths to an explicit external recovery archive; do not delete them.
5. Rerun `npm run check:app-audio` normally.

No cleanup occurs under this design approval alone.

## Rollout

1. Keep the current pack live while the CC0 pack is built and reviewed.
2. Promote all 18 accepted variants as one atomic pack revision; never mix rights-pack versions.
3. Keep `audio.kill_switch` available.
4. Verify cache invalidation and packaged hashes before enabling the new revision.
5. Use current runtime controls and safe segmentation only; do not segment by journal, mood, diagnosis, or inferred state.
6. Treat task completion, integration, build inclusion, store submission, and store publication as separate states.

## Rollback

Rollback restores the previous 18 release bytes, generated manifest, provenance, notices, and cache revision from a reviewed commit. It then reruns the complete audio, build, package, and denied-hash checks.

- Web/PWA rollback requires a new deployment and cache-busted public verification.
- Android/iOS/Desktop rollback requires a new signed artifact or update unless the existing kill switch safely disables playback.
- The private rights/source archive is retained for audit and is not deleted during rollback.
- The external quarantine review folder remains untouched.

## Failure Handling

- Changed source hash or license text: `STOP` acquisition; require a new source/rights decision.
- Missing private receipt: `STOP` generation.
- Denied hash found anywhere: `STOP`; preserve exact artifact and path evidence.
- Objective QC failure: keep candidate outside product paths and revise recipe.
- Human rejection: candidate remains private and cannot be promoted.
- Platform package mismatch: no release claim for any platform until exact hashes converge.
- Store request for authorization: provide the private rights packet; do not fabricate or reconstruct receipts after submission.
- Encoder legal decision absent: `STOP` store release while local technical work may remain review-only.
- Current `main` or task lane not clean/locked: preserve state and stop synchronization/handoff.

## Risks And Mitigations

| Risk                                                          | Mitigation                                                                                                               | Release effect                      |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| Provider incorrectly applied CC0 or lacks a third-party right | item-specific author/recording page, license snapshot, source hash, no voice/music/trademark content, owner/legal review | remains `UNVERIFIED` until reviewed |
| Public repository distributes raw audio                       | use a source license that explicitly permits redistribution; never publish unprocessed private masters unnecessarily     | blocks Mixkit/Kimi sources          |
| New pack sounds worse than quarantine/current                 | blind A/B, ten-minute loop review, revision path, current pack retained until promotion                                  | human `AUDIO_FIT` blocks promotion  |
| Numeric intensity passes but levels feel identical            | minimum metric gaps plus human progression review                                                                        | blocks family promotion             |
| Encoder/library obligations are incomplete                    | dev-only dependency inventory, license/source compliance review, no runtime encoder code                                 | blocks store release                |
| Stale PWA/native bytes survive replacement                    | versioned revision or filenames, exact package hashes, cache-busted verification                                         | blocks rollout                      |
| Historical output artifacts keep global gate red              | owner-approved recoverable archive move; no exclusion weakening                                                          | blocks release handoff              |
| Quarantined file is accidentally reused                       | canonical 26-hash denylist at source, candidate, product, build, and package boundaries                                  | immediate `STOP`                    |

## Done Criteria

The work is complete only when all of the following are proven from current evidence:

- all 18 promoted files map to source-specific CC0 rights receipts and exact source hashes;
- no Kimi, Mixkit, AI-audio, unknown, quarantined, or blocked source entered the new pack;
- none of the 26 denied hashes appears in source staging, candidates, runtime files, builds, or packages;
- source, recipe, candidate, promoted output, manifest, provenance, and packaged hashes agree;
- all focused and broad audio checks pass normally;
- `npm run check:app-audio` passes without exclusion or weakened assertions;
- human `AUDIO_FIT` is signed for all 18 variants;
- owner/legal review records an explicit rights decision;
- Web/PWA, Android, iOS, and Desktop artifact and runtime states are explicit;
- signed release artifacts are independently identified;
- store submission and publication states are reported separately and truthfully;
- rollback evidence is current and executable;
- the final worktree diff contains no unrelated changes, private receipts, raw private sources, credentials, or production-derived user data.

## Approval Boundary

Review and approval of this specification authorizes creation of the implementation plan. It does not authorize:

- downloading source audio;
- purchasing a service or dependency;
- moving or deleting historical output artifacts;
- promoting candidate audio into product paths;
- committing private source/license receipts;
- pushing a branch, opening a pull request, deploying, or submitting a store release.

Those actions remain bounded by the implementation plan, repository gates, and any explicit approval required at their action boundary.
