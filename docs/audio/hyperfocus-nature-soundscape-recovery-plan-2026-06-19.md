# Hyperfocus Nature Soundscape Recovery Plan

Goal: recover the Hyperfocus audio project from music-like outputs by enforcing nature/environmental field-recording soundscapes before any new Gemini/Lyria generation.

## Correct Direction

- These are concentration soundscapes, not songs.
- The target is real environmental ambience: fireplace crackle, underwater pressure, rain/thunder, ocean, river, and neutral cafe room tone.
- Every generation prompt must say field-recording/environmental soundscape and must forbid vocals, lyrics, melody, beat, drums, instruments, and song structure.
- Do not include artist, celebrity, K-pop, pop-song, catchy, melodic, upbeat, chorus, verse, drop, soundtrack, or cinematic wording in positive prompts.

## Families And Levels

| Family | Soft | Deep | Intense |
| --- | --- | --- | --- |
| fireplace | Embers | Hearth | Bonfire |
| underwater | Shallow Drift | Deep Current | Abyss Focus |
| thunderstorm | Distant Rain | Steady Storm | Monsoon Wall |
| ocean | Shoreline | Rock Pools | Heavy Surf |
| river | Brook | Forest River | Whitewater |
| cafe | Quiet Corner | Work Cafe | Busy Rush |

## Gate

1. Run `node scripts/check-hyperfocus-nature-soundscape-contract.cjs`.
2. Generate only `fireplace:soft` first when credits allow.
3. Keep raw output in quarantine until objective QC and audible review pass.
4. Reject immediately if it has vocals, lyrics, melody, beat, drums, instruments, song sections, pop feel, or soundtrack feel.
5. Generate the remaining 17 variants only after accepted pilot evidence exists.

## Still UNVERIFIED

- The 18 generated MP3 files do not exist yet.
- Audible review and emulator playback with generated assets remain blocked until generation credits/assets are available.
