# Kimi K3 Audio Recovery Ledger — 2026-07-25

This ledger records the uncommitted audio work found in the local Kimi audit workspace after it failed to appear in Git history. It is an inventory and release decision, not proof of authorship, licensing, listening quality, or prior completion.

## Release decision

- No Kimi MP3 was copied into the release unchanged.
- Seventeen Hyperfocus candidates were traced to the repository's existing licensed source-derived masters, but every candidate was encoded at 44.1 kHz instead of the required 48 kHz. They remain quarantined because the generated hashes, progression ledgers, and listening review were not updated.
- Nine candidates have no hash-bound provider, prompt/input, stock-sample, or redistribution record in the recovered workspace. They are blocked from shipment.
- The current 18-file Hyperfocus nature pack remains byte-for-byte unchanged.
- The useful feedback concept was reconstructed as five new, deterministic first-party cues. Their generator, exact public/docs hashes, fixed note sequences, exclusions, and encoder are recorded in `non-hyperfocus-generated-audio-provenance.json`.
- The recovered runtime and Settings snapshots were treated as design evidence only. The release-candidate implementation was rebuilt against the current asset resolver, retry behavior, mute/comfort checks, service worker, translation types, and all eight locales.

## Fixed-candidate inventory

All paths below are relative to the local, untracked audit workspace. SHA-256 and byte counts were measured on 2026-07-26.

| Candidate | SHA-256 | Bytes | Disposition |
| --- | --- | ---: | --- |
| `fixed/feedback/feedback-complete.mp3` | `4e8c8f757848aba7337047c4d91ec9f9f5d973454ed9e86d978a1a76ac61296a` | 32,600 | BLOCKED — generation and release-right evidence absent |
| `fixed/feedback/feedback-milestone.mp3` | `49fdbd5296ac8de4b8c44b8f39643607e741109362b94b1cce25deed85967ceb` | 40,124 | BLOCKED — generation and release-right evidence absent |
| `fixed/feedback/feedback-notification.mp3` | `affa686a1772877d8ea23c0769833e89d3c6d234ff2f4a611af85a914978565c` | 8,777 | BLOCKED — generation and release-right evidence absent |
| `fixed/feedback/feedback-streak.mp3` | `015b77908929a3354de99e5d4c6bdb8e5db7a99e03d29cd52f2a1ef573c1b1a6` | 20,480 | BLOCKED — generation and release-right evidence absent |
| `fixed/feedback/feedback-success.mp3` | `84af13be0ebf0b042915a4487650b80bce4f3ed53024540dc0e48c1334752de4` | 12,538 | BLOCKED — generation and release-right evidence absent |
| `fixed/gentle-water-bed.mp3` | `b47f9368dd4ff4df0403825e791ffe5b585032805d3ac6583d33f899e648f220` | 272,509 | BLOCKED — generation evidence absent; duration below the 60-second minimum |
| `fixed/soft-air-veil.mp3` | `79de9727c528e2de3b0986eea739005b3c66955adf0ab0735dd20da1dd5aa7a9` | 258,298 | BLOCKED — generation evidence absent; duration below the 60-second minimum |
| `fixed/soft-rain-veil.mp3` | `b2b08f17fbf6a8ae73bdf1c66fa6fc6f8140d398039bf79cf63e4c3ae32bf5ff` | 272,509 | BLOCKED — generation evidence absent; duration below the 60-second minimum |
| `fixed/hyperfocus/hyperfocus-ocean-intense.mp3` | `a0534266e5fbab15119f1fe8f2fd3bc371090346c04556dc9665549df6bc89e4` | 271,673 | BLOCKED — generated input provenance absent; 44.1 kHz and 16.98 seconds |
| `fixed/hyperfocus/hyperfocus-fireplace-deep.mp3` | `f5c8e70570f38bd86d993d3de484c85ef4e1e8c676094020360042afc5722189` | 481,071 | QUARANTINED — source-derived, but 44.1 kHz and ledgers not updated |
| `fixed/hyperfocus/hyperfocus-fireplace-intense.mp3` | `fa40413b5882b79825af7e74880cd7252268405b97d78655470915ab1c5358cf` | 481,071 | QUARANTINED — source-derived, but 44.1 kHz and ledgers not updated |
| `fixed/hyperfocus/hyperfocus-fireplace-soft.mp3` | `6fd3b57c14f83a6418fc26f6cfa4f346ee4bd7e585c14f2dc9935ac8b142bdd9` | 481,071 | QUARANTINED — source-derived, but 44.1 kHz and ledgers not updated |
| `fixed/hyperfocus/hyperfocus-forest-deep.mp3` | `b79c475c1ee1501e6dfc8949ecf8947baa2c83f76d6e89992d16c9ca7aa111c8` | 481,071 | QUARANTINED — source-derived, but 44.1 kHz and ledgers not updated |
| `fixed/hyperfocus/hyperfocus-forest-intense.mp3` | `a67528b3a9e8621c906c53f28f8e7ca9dc1629e36e57c776c161c3ce4ebf980c` | 481,071 | QUARANTINED — source-derived, but 44.1 kHz and ledgers not updated |
| `fixed/hyperfocus/hyperfocus-forest-soft.mp3` | `e2e5988ccfca12edc45332ce6209660c056936caa4a2d07863be6214d73e0e43` | 481,071 | QUARANTINED — source-derived, but 44.1 kHz and ledgers not updated |
| `fixed/hyperfocus/hyperfocus-ocean-deep.mp3` | `c64fc737ff4e945ad1a198d5ed66ebfc6b1908bb57daa817d8b6e87db86174cc` | 449,306 | QUARANTINED — source-derived, but 44.1 kHz and ledgers not updated |
| `fixed/hyperfocus/hyperfocus-ocean-soft.mp3` | `adc7126e82e1a9e11b19084927c679115698b7b1a29125b3bc0855ca6f5aa323` | 440,946 | QUARANTINED — source-derived, but 44.1 kHz and ledgers not updated |
| `fixed/hyperfocus/hyperfocus-rain-deep.mp3` | `e587d5b24016ee444dfd5de9213709fed1589b738d943d0b2b60f614c22c9d22` | 449,724 | QUARANTINED — source-derived, but 44.1 kHz and ledgers not updated |
| `fixed/hyperfocus/hyperfocus-rain-intense.mp3` | `8e01ff606b2e63cf23fa89406a17db038495980828b6d10d57473069f8c39cd2` | 450,142 | QUARANTINED — source-derived, but 44.1 kHz and ledgers not updated |
| `fixed/hyperfocus/hyperfocus-rain-soft.mp3` | `e4eafb4061e1db9a389b1365180f90afd425cf93c1e8cc244422e0a29061f1a2` | 449,724 | QUARANTINED — source-derived, but 44.1 kHz and ledgers not updated |
| `fixed/hyperfocus/hyperfocus-river-deep.mp3` | `cdcbe3fb0c8c251c2131495c66e22061b18e0091cb26027326ce9d20cfc4e3c5` | 481,489 | QUARANTINED — source-derived, but 44.1 kHz and ledgers not updated |
| `fixed/hyperfocus/hyperfocus-river-intense.mp3` | `13eb0d8d3e12041a534b9e6b9390de0d2c6dfdb5b20e46394782271b53d4621d` | 481,489 | QUARANTINED — source-derived, but 44.1 kHz and ledgers not updated |
| `fixed/hyperfocus/hyperfocus-river-soft.mp3` | `e1a7f87669f5aaba5668cfded53c6d43a7f43eefb4823a456e51a53e507b79a0` | 481,071 | QUARANTINED — source-derived, but 44.1 kHz and ledgers not updated |
| `fixed/hyperfocus/hyperfocus-wind-deep.mp3` | `5004f7057a1bf4678e8201a9eb75ec5ac96baf40a8bea613989e19a016b3122e` | 449,724 | QUARANTINED — source-derived, but 44.1 kHz and ledgers not updated |
| `fixed/hyperfocus/hyperfocus-wind-intense.mp3` | `62f042ea5520d6024d06703497d2a6e43a327c11668020bb8e72094c217ce18c` | 449,724 | QUARANTINED — source-derived, but 44.1 kHz and ledgers not updated |
| `fixed/hyperfocus/hyperfocus-wind-soft.mp3` | `0b859de27b4ea7c5f6ea5a4aa3032ebba586d9308730751a62e171dde3dd4065` | 449,724 | QUARANTINED — source-derived, but 44.1 kHz and ledgers not updated |

## Other recovered material

- Ten source snapshots: six locale files (`de`, `en`, `es`, `fr`, `ja`, `uk`), `audioManager.ts`, `V2SettingsSoundPanel.tsx`, its Settings test, and `src/sw.ts`.
- Four processing/inspection programs: `analyze.py`, `postprocess.py`, `retune.py`, and `spectro.py`.
- Nine pre-processing files under `generated/`, 21 decoded WAV files, 21 spectrograms, six verification images, two temporary WAV files, two Python bytecode files, and the reports `metrics.json` and `family_correlation.json`.
- The reports were not accepted as current proof because their input paths and timestamps do not bind them to every fixed candidate.

None of these local audit artifacts is required at runtime. They remain outside the tracked release to avoid committing redundant binaries, stale reports, machine-generated caches, or unreviewed processing experiments.

## License and provenance boundary

- Kimi's official Terms of Service effective 2026-01-21 state that a compliant user retains ownership of generated Output, while remaining responsible for input rights and non-infringement: `https://www.kimi.com/user/agreement/modelUse?version=v2`. The local audit workspace does not bind the blocked MP3 hashes to a Kimi generation record or disclose their inputs, so that general term is not sufficient proof for these specific files.
- The 17 source-derived Hyperfocus candidates inherit no new third-party source beyond the current MixKit and BigSoundBank materials documented in `THIRD_PARTY_NOTICES.md`, but their transformed output still needs exact ledger updates and acceptance before promotion.
- The five recovered feedback files, three recovered root ambience files, and generated ocean-intense candidate have no sufficient release record in the recovered workspace. Absence of a record is not treated as permission.
- The replacement feedback cues use no Kimi binary or source input. They are generated locally from fixed mathematical waveforms and encoded with the already-declared dev dependency `lamejs@1.2.1`. Formal legal review of the dev-time LGPL obligation remains `UNVERIFIED`, as already stated in the notices.

## Promotion and rollback

A quarantined Hyperfocus file may be reconsidered only after 48 kHz stereo encoding, duration and decoded-metric checks, family-progression tests, exact hash updates in all three Hyperfocus ledgers, source-truthful processing notes, and fresh listening review. Any failed condition keeps the current master.

The feedback recovery can be rolled back by reverting the commit that adds `sounds/feedback/`, the feedback manifest/runtime/UI entries, the generator extension, and this ledger. The existing procedural feedback fallback and unchanged nature pack provide the safe rollback path.
