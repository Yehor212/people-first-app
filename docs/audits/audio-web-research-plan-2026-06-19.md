# ZenFlow Audio Web Research Plan - 2026-06-19

## Scope

This audit checks whether ZenFlow missed anything important in app audio after adding local ambience and procedural action feedback. It covers web/PWA, Android, iOS, and Desktop/Tauri behavior.

## External Sources Reviewed

- Apple Human Interface Guidelines: [Playing audio](https://developer.apple.com/design/human-interface-guidelines/playing-audio), [Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback), [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [Notifications](https://developer.apple.com/design/human-interface-guidelines/notifications)
- Google Material Design 2 sound guidance: [About sound](https://m2.material.io/design/sound/about-sound.html), [Applying sound to UI](https://m2.material.io/design/sound/applying-sound-to-ui.html)
- Chrome Developers: [Autoplay policy in Chrome](https://developer.chrome.com/blog/autoplay)
- MDN: [Autoplay guide for media and Web Audio APIs](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay), [Web Audio API best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)
- W3C: [WCAG 2.1 Success Criterion 1.4.2 Audio Control](https://www.w3.org/TR/WCAG21/#audio-control), [Autoplay Policy Detection Working Draft](https://www.w3.org/TR/autoplay-detection/)
- Android Developers: [Haptics design principles](https://developer.android.com/develop/ui/views/haptics/haptics-principles)

## Source-Driven Requirements

| Requirement | Source basis | Current state | Decision |
| --- | --- | --- | --- |
| No surprise audio on load. | Chrome and MDN both treat audible playback without user intent as autoplay risk. | Ambience is tap-started; procedural feedback only fires from user-visible actions. | PASS. Keep this invariant. |
| User must have control. | WCAG 1.4.2 requires pause/stop or independent volume for auto audio over 3 seconds. | Master mute and volume exist; long tracks are not automatic. | PASS. Keep volume/mute visible in Settings > Sound. |
| Sound cannot be the only signal. | Apple accessibility guidance recommends pairing audio cues with visual or other feedback. | Action sounds sit beside existing UI state and haptics. | PASS. Do not make sound-only success/error states. |
| Sound should be meaningful, not constant. | Material sound guidance frames sound as functional feedback and earcons for state changes. | Generic taps, navigation, picker moves, and routine UI churn remain silent. | PASS. No tap library needed. |
| Short custom notification sounds only when they add product value. | Apple notification guidance supports short custom sounds or system sounds. | Native notification settings currently use system/default, gentle, chime, silent channels. | KEEP. Custom native file is optional, not required now. |
| Web Audio should match the content type. | MDN separates full-length tracks from short sample-like sounds. | MP3 ambience stays as files; action SFX stays procedural WebAudio. | PASS. No generated MP3 for action feedback. |
| Haptics, visual motion, and audio should be co-designed. | Android haptics guidance recommends matching event importance and coordinating haptics with sound/visuals. | Habit/focus completion already has haptics plus audio. | PASS with P1 follow-up for amplitude/timing budget. |

## What Was Missed And Fixed Now

### P0: Complete and success were not truly distinct

The action map had separate success and complete types, but playSound("complete") reused the generic success chime. That weakened the sound language because mood save and habit/focus completion felt identical.

Status: fixed in src/lib/audioManager.ts.

New behavior:

- success: brighter C-E-G chime for light acknowledgement.
- complete: lower, warmer triangle-tone contour for habit/focus completion.
- streak and levelUp: still reserved for rare milestones.
- notification: still explicit preview/reminder ping only.

Regression proof: src/lib/__tests__/audioManager.test.ts now captures scheduled oscillator frequencies, durations, and waveforms and verifies complete is not an alias of success.

## Important Gaps Not Implemented In This Pass

These are not blockers for the current release-quality audio decision, but they should stay visible.

| Priority | Gap | Why it matters | Recommended action |
| --- | --- | --- | --- |
| P1 | Audio context architecture is split. | audioManager owns procedural feedback; ambientSounds owns an iOS-blessed HTMLAudioElement and its own AudioContext. A forced unification could break iOS unlock, but the boundary must be explicit. | Keep split for now. Add an ADR before any refactor. Any future merge needs iOS/PWA/browser proof. |
| P1 | No formal feedback duration/frequency budget. | Procedural sounds are small, but future edits could become too long or sharp. | Add a static contract test around feedback shapes if more cues are added. Target: action feedback under about 700 ms, no harsh error tone by default. |
| P1 | No separate ambience vs feedback toggle. | Master mute exists, and feedback follows dopamine settings, but some users may want ambience off while keeping completion cues. | Consider a separate toggle only after product need or user feedback. Avoid settings clutter for now. |
| P2 | Native notification chime is not a branded custom file. | The notification settings expose chime semantics, but Android channels currently rely on system/default sound. | Optional later: create one short native notification file if reminders become a core differentiator. |
| P2 | No brand sonic logo. | Generated audio could add identity, but not to every completion. | Optional later: one onboarding/sign-in identity cue, tested against calm/wellness tone. |

## Generation Decision

Do not generate a new action SFX file now.

Reasons:

- Current need is short UI feedback, not a cinematic asset.
- Procedural WebAudio adds no bundle weight and starts immediately after user gestures.
- MP3 ambience already covers mood and texture.
- Generated files would add asset governance, mastering, platform packaging, and review burden without solving a current gap.

Generation becomes justified only for:

1. A branded sonic logo for onboarding or sign-in.
2. A native notification sound under 1 second.
3. A premium ambience loop where procedural audio cannot express the desired texture.

Acceptance criteria for any future generated sound:

- Clear purpose tied to one event family.
- No speech, no jarring alarm tone, no arcade fanfare for wellness flows.
- Short: action/notification under 1 second; ambience loop only when explicitly user-started.
- Must respect mute/volume and never bypass app settings.
- Must have visual or haptic equivalent.
- Must be packaged and checked across Web/PWA/Android/iOS/Desktop.
- Must pass browser autoplay/user-gesture proof.

## Final Plan

1. Keep action sounds narrow: meaningful completions, rare milestones, explicit notification preview.
2. Keep generic UI silent: no tap, tab, picker, hover, or validation-error noise by default.
3. Keep long MP3s as opt-in ambience only.
4. Preserve the Settings > Sound action map so users can understand where sound appears.
5. Treat audio generation as a brand-asset decision, not an automatic UI-SFX step.
6. Before any future audio expansion, add a small sound-contract test so cue length, type, and event mapping cannot drift silently.

## Completion Verdict

Current implementation is aligned with web/platform/accessibility guidance after the complete cue fix. No new generated sound file is required for the current app audio layer.
