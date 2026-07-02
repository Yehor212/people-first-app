# Hyperfocus Nature Soundscape Recovery Plan

Goal: recover the Hyperfocus audio project from music-like outputs by enforcing nature/environmental field-recording soundscapes and shipping a runtime-safe real-source pack whose levels audibly progress from calm to medium to noisy.

## Correct Direction

- These are concentration soundscapes, not songs.
- The current target is real environmental ambience: forest, rain, ocean, fireplace, river, and wind. Older cafe, underwater, and thunderstorm ids are retained only as migration aliases.
- Gemini/Lyria UI outputs are not accepted unless they audibly behave like pure SFX/field recordings.
- Do not include artist, celebrity, K-pop, pop-song, catchy, melodic, upbeat, chorus, verse, drop, soundtrack, or cinematic wording in positive prompts.

## Recovery Decision - 2026-06-20, Updated 2026-07-01

Gemini/Lyria UI was tried twice and rejected both times because the outputs were not close enough to pure natural SFX. The project now ships a real-source pack under `public/sounds/hyperfocus/` with 18 manifest-backed variants.

The earlier recovery pack included cafe, underwater, and thunderstorm. The current V2 nature pack retires those from the visible set and ships forest, rain, ocean, fireplace, river, and wind. Each family must satisfy `soft < deep < intense` with at least a 3-point score gap at both steps.

## Current Families And Levels

| Family | Soft / calm | Deep / medium | Intense / noisy | Score gaps |
| --- | --- | --- | --- | --- |
| forest | Wind in the forest (56.79) | Forest birds ambience (65.52) | Forest at night (82.21) | 8.73 / 16.69 |
| rain | Light rain looping (58.16) | Long rain ambience (61.66) | Heavy rain ambience (65.03) | 3.5 / 3.37 |
| ocean | Small waves harbor rocks (56.45) | Sea coast breaking waves (61.02) | Rough sea waves loop (69.53) | 4.57 / 8.51 |
| fireplace | BigSoundBank indoor embers (54.67) | BigSoundBank indoor hearth (62.06) | BigSoundBank full indoor hearth (69.44) | 7.39 / 7.38 |
| river | River water flow and surroundings (59.96) | Wildlife environment in a river (63.6) | Water flowing in the river (76.05) | 3.64 / 12.45 |
| wind | Wind blowing ambience (38.76) | Wind blowing ambience (43.91) | Wind in the top of the mountain (50.51) | 5.15 / 6.6 |

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
