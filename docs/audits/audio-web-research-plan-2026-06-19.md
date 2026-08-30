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
- Exact product reference: [Cloudbound Evening](https://www.youtube.com/watch?v=cJvhJqgDbKI) by 3 Minute Escape; its public description frames it for relaxation, focus, and emotional reset.
- YouTube Help: [License types on YouTube](https://support.google.com/youtube/answer/2797468) — Standard YouTube License is the default, and YouTube cannot grant reuse rights for another creator’s upload.
- U.S. Copyright Office: [What musicians should know](https://www.copyright.gov/engage/musicians/) and [AI Part 2 copyrightability report](https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-2-Copyrightability-Report.pdf) — composition and recording rights are separate, and AI assistance does not by itself prove human-authored copyright.
- Garzonis et al., CHI 2009: [Auditory icon and earcon mobile service notifications](https://doi.org/10.1145/1518701.1518932) — mobile notification sounds should be intentionally learnable and minimally intrusive rather than arbitrary decoration.

## Source-Driven Requirements

| Requirement | Source basis | Current state | Decision |
| --- | --- | --- | --- |
| No surprise audio on load. | Chrome and MDN both treat audible playback without user intent as autoplay risk. | Ambience is tap-started; procedural feedback only fires from user-visible actions. | PASS. Keep this invariant. |
| User must have control. | WCAG 1.4.2 requires pause/stop or independent volume for auto audio over 3 seconds. | Master mute and volume exist; long tracks are not automatic. | PASS. Keep volume/mute visible in Settings > Sound. |
| Sound cannot be the only signal. | Apple accessibility guidance recommends pairing audio cues with visual or other feedback. | Action sounds sit beside existing UI state and haptics. | PASS. Do not make sound-only success/error states. |
| Sound should be meaningful, not constant. | Material sound guidance frames sound as functional feedback and earcons for state changes. | Generic taps, navigation, picker moves, and routine UI churn remain silent. | PASS. No tap library needed. |
| Short custom notification sounds only when they add product value. | Apple and Android notification guidance support short custom sounds under platform control. | Android exposes default, optional fūrin, vibration-only, and silent profiles; existing users remain on their prior selection. | PASS. Fūrin uses a new immutable channel and rollback-safe rescheduling. |
| A reference link is not a redistribution license. | YouTube documents Standard as the default license and cannot grant rights to another creator’s upload; the Copyright Office separates composition and recording rights. | The reference contributes only high-level mood/function words. No source audio, sample, melody, harmony, or title is shipped. | PASS for clean-room separation. Exact project-wide license remains UNVERIFIED because root `LICENSE` is missing. |
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
| RESOLVED | Native notification cue needed a distinct, rights-safe identity. | Reusing a stock fūrin reference would add external provenance and would not be unique. | The 0.92-second clean-room modal-glass fūrin is generated from code, hash-bound to the MP3 preview and Android WAV, and offered only as an explicit user choice. |
| RESOLVED | A requested app-entry music loop needed independent rights, lifecycle control, and a non-overlapping audio owner. | Treating a public YouTube upload as reusable, autoplaying on first launch, or mixing it with Orb/Diary/Hyperfocus would create rights, accessibility, and fatigue risks. | Cloudlight Evening is a separate original 150-second deterministic composition with an asset-specific proprietary notice, first-run off, persistent opt-in, sidebar/drawer control, and exclusive long-audio ownership. |
| P2 | No brand sonic logo. | Generated audio could add identity, but not to every completion. | Optional later: one onboarding/sign-in identity cue, tested against calm/wellness tone. |

## Generation Decision

Keep the approved fūrin as the custom native notification cue and add Cloudlight Evening only as the explicitly approved persistent background-music asset; do not expand routine action sounds.

Reasons:

- The notification need remains a short optional fūrin identity cue; the separate Cloudlight request is a controlled long-form ambience feature.
- Procedural WebAudio adds no bundle weight and starts immediately after user gestures.
- MP3 ambience already covers mood and texture.
- The fūrin cue justifies native asset governance because its exact bytes must be stable, previewable, and selectable without changing existing users.
- Cloudlight justifies a separate generator, rights notice, long-loop QC, lifecycle state machine, and immediate navigation control.

Generation becomes justified only for:

1. A branded sonic logo for onboarding or sign-in.
2. A native notification sound under about one second.
3. The approved 150-second Cloudlight Evening ambience loop.

Acceptance criteria for any future generated sound:

- Clear purpose tied to one event family.
- No speech, no jarring alarm tone, no arcade fanfare for wellness flows.
- Short: action and notification feedback stay under about one second; the separate Cloudlight ambience is 150 seconds and becomes eligible only after explicit opt-in.
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

The approved result keeps fūrin as the notification cue and adds one separate Cloudlight Evening loop. Numerical and installed-runtime proof can establish technical readiness; human listening, pleasantness, legal review, and public/store release remain separate gates.
