# Hyperfocus Nature Soundscape Recovery Plan

Goal: recover the Hyperfocus audio project from music-like outputs by enforcing nature/environmental field-recording soundscapes and shipping a runtime-safe real-source pack whose levels audibly progress from calm to medium to noisy.

## Correct Direction

- These are concentration soundscapes, not songs.
- The target is real environmental ambience: fireplace crackle, underwater pressure/hum, rain/thunder, ocean, river, and neutral cafe room tone.
- Gemini/Lyria UI outputs are not accepted unless they audibly behave like pure SFX/field recordings.
- Do not include artist, celebrity, K-pop, pop-song, catchy, melodic, upbeat, chorus, verse, drop, soundtrack, or cinematic wording in positive prompts.

## Recovery Decision - 2026-06-20

Gemini/Lyria UI was tried twice and rejected both times because the outputs were not close enough to pure natural SFX. The project now ships a real-source pack under `public/sounds/hyperfocus/` with 18 manifest-backed variants.

The previous recovery pack had unique files but weak sound design: several `soft` assets measured as equal to or noisier than `deep`/`intense`. V3 fixes that with a metric gate: each family must satisfy `soft < deep < intense` with at least a 3-point score gap at both steps.

## Final Families And Levels

| Family       | Soft / calm                              | Deep / medium                            | Intense / noisy                   | Score gaps  |
| ------------ | ---------------------------------------- | ---------------------------------------- | --------------------------------- | ----------- |
| cafe         | Hotel reception and restaurant (56)      | Restaurant crowd talking ambience (59.8) | Big crowd talking loop (67.6)     | 3.8 / 7.8   |
| fireplace    | Campfire burning crackles (26)           | Campfire crackles (32.1)                 | Campfire night wind (53.5)        | 6.1 / 21.4  |
| ocean        | Small waves harbor rocks (59.8)          | Sea coast breaking waves (67.3)          | Rough sea waves loop (72.8)       | 7.5 / 5.5   |
| river        | River water flow and surroundings (41.5) | Wildlife environment in a river (54.8)   | Water flowing in the river (88)   | 13.3 / 33.2 |
| thunderstorm | Thunderstorm and clear rain (55.4)       | Thunderstorm and rain loop (59.4)        | Heavy storm rain loop (65.6)      | 4 / 6.2     |
| underwater   | Diving sea ambience (34)                 | Sinking in the sea (54.9)                | Underwater transmitter hum (61.7) | 20.9 / 6.8  |

## Missing Pieces Added

- Measured acceptance criteria: unique hashes alone are not enough; each family must pass the intensity progression gate.
- Source hygiene: reject music, lyrics, melodies, beats, alarms, screams, children, applause, explosions, and obvious one-shots.
- Concentration fit: soft should be low-distraction, deep should be stable, intense should be denser but still usable as ambience.
- Runtime fit: all files stay MP3 under `public/sounds/hyperfocus` so web/PWA/native/desktop builds use the same paths.
- Provenance: every accepted file records source title, provider, license page, hash, byte size, and measured metrics.

## Verification

- `npm test -- src/lib/__tests__/hyperfocusAudioProgression.test.ts` passes on macOS with real MP3 decoding and metric checks.
- `npm test -- src/lib/__tests__/hyperfocusAudioProgression.test.ts src/lib/__tests__/hyperfocusAudioCatalog.test.ts src/lib/__tests__/hyperfocusAudioCatalog.generatedManifest.test.ts scripts/__tests__/hyperfocus-nature-soundscape-contract.test.ts` passes: 4 files, 8 tests.
- `find public/sounds/hyperfocus -type f -name '*.mp3' | wc -l` returns 18.
- `shasum -a 256 public/sounds/hyperfocus/*.mp3 | awk '{print $1}' | sort | uniq | wc -l` returns 18 unique hashes.
- `afinfo` reads all 18 files as MP3.
- `npm run build` passes and copies all 18 files into `dist/sounds/hyperfocus` with 18 unique hashes.

## Still UNVERIFIED

- Human headphone review of all 18 final variants remains required for subjective taste. The metric gate catches wrong order, not personal preference.
- Full Windows desktop packaging remains dependent on local MSVC `link.exe`; fresh `npm run desktop:check` shows desktop contract PASS with 112 checks, but Windows EXE packaging is blocked by missing MSVC `link.exe`.
