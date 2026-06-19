# ZenFlow Action SFX Audit — 2026-06-18

## Decision

ZenFlow should use sound effects for meaningful completions and rare milestones, not for routine taps, tab changes, picker movement, or every navigation event. The product is a mental-wellness app, so the sonic language should reduce uncertainty and gently confirm progress without creating arcade-style pressure.

## Current Audio Inventory

| Asset | Role | Duration | Size | Decision |
| --- | --- | ---: | ---: | --- |
| measured-breath.mp3 | Entry/auth ambience | 176.82s | 4.1 MB | Keep as opt-in ambience, not action SFX. |
| polished-stone-and-paper.mp3 | Orb ambience | 89.21s | 2.1 MB | Keep as opt-in orb texture. |
| v2-diary-reflection-loop.mp3 | Diary ambience | 74.50s | 1.7 MB | Keep as opt-in diary loop. |
| focus ambience library | Focus background | 13.66s-121.78s | 164 KB-1.9 MB | Keep for focus selection. |

The long MP3s are appropriate for ambience because they carry texture and mood. They are not appropriate for UI feedback, where the target is roughly 80-700 ms and must start instantly after a user gesture.

## Action SFX Matrix

| Action | Sound? | Sound type | Reason |
| --- | --- | --- | --- |
| Mood saved | Yes | success | Confirms an emotional check-in was accepted. |
| Habit completed | Yes | complete | Primary progress action; needs a small reward cue. |
| Journal saved | Yes | success | Confirms private content was stored. |
| Focus completed | Yes | complete | Marks the end of an intentional session. |
| Gratitude saved | Yes | success | Gentle reinforcement without celebration overload. |
| Breathing completed | Yes | success | Soft closure after a guided practice. |
| Achievement unlocked | Yes, rare | levelUp | Reserved for uncommon unlocks. |
| Streak milestone | Yes, rare | streak | Reserved for meaningful streak thresholds. |
| Level up | Yes, rare | levelUp | XP threshold transition. |
| Notification preview | Yes | notification | Explicit preview only. |
| Generic tap, nav, picker movement | No | none | Haptics/visual state already cover these; sound would become noise. |
| Validation/error boundaries | Not by default | none | Avoid anxious error tones in a wellness product; keep visual + haptic unless a specific accessibility setting is added later. |

## Generation Review

Gemini audio generation is not available in this Codex session. The available audio-generation fallback is Picsart with ElevenLabs SFX v2, quoted at 4 credits for a 1-second SFX prompt. I did not generate new SFX because procedural WebAudio better fits this requirement: zero bundle weight, immediate playback, cross-platform consistency, and automatic respect for the existing mute/volume settings.

Future generated audio is still useful for a brand-level sonic logo or an onboarding signature, but not for every completion chime.

## Implementation Notes

- Added a governed action-sound manifest in src/lib/appAudioAssets.ts.
- Wired rewardUser actions to short audio feedback through src/stores/gamificationStore.ts.
- Wired habit completion, which bypasses rewardUser, to the complete cue in src/hooks/useHabitHandlers.ts.
- Wired XP level crossing to the levelUp cue in src/hooks/useGamification.ts.
- Added Settings > Sound action feedback map so the product explains where sounds appear.
- Kept action SFX procedural; no extra MP3 assets were added.

## Verification Targets

- Red/green tests for reward-store action feedback, habit completion feedback, XP level-up feedback, audio manifest, and settings UI.
- Typecheck and i18n checks for the new translation keys.
- Build/package checks to confirm no asset regressions across Web/PWA/native/desktop bundles.
- Browser smoke against Settings > Sound to confirm the action map is visible and mute still gates preview playback.
