# ZenFlow Audio Product Operations Policy

Last updated: 2026-06-30

## Scope

This policy covers app ambience, short feedback sounds, audio comfort settings, audio feedback, and release operations for Web/PWA, Android, iOS/WKWebView, and Desktop/Tauri. Hyperfocus sound selection keeps its own library controls, but the same privacy and release guardrails apply.

## User Controls

- Audio must remain user-started.
- Users need a global app sound switch and a sensory comfort profile.
- Profiles are Quiet, Balanced, and Rich. Quiet keeps completion cues possible while disabling ambience and high-salience cues.
- Per-category audio controls must separate ambience, completion cues, milestone cues, and reminder previews. Haptics remain governed by the existing feedback/haptics settings and may be used only as non-audio fallback, not as an audio-comfort promise.
- Texture avoidance must cover the active non-Hyperfocus ambience textures: air, water, and rain. Hyperfocus keeps separate sound-family controls.

## Fatigue Budget

Short cues have a 30-minute in-memory budget. The goal is to prevent repeated completion sounds from becoming irritating during long sessions. Milestones and reminders are more constrained than ordinary completion cues.

## Privacy-Safe Feedback And Telemetry

Allowed audio feedback fields are finite enums: surface, platform, volume bucket, muted state, ambience enabled, and feedback choice. Stored feedback must be normalized from trusted enum allowlists, capped to 20 local entries, and stripped of unknown fields before new entries are appended. Support snapshots must include a schema version and sanitize AudioContext state and error codes. Forbidden fields include journal text, mood labels, raw audio, private filenames, user IDs, emails, inferred mental state, and free text unless a separate explicit consent flow exists.

Allowed taxonomy:

- audio_play_intent
- audio_play_success
- audio_play_blocked
- audio_stop
- audio_muted
- audio_error
- audio_feedback_submitted

## Rollout And Kill Switch Names

Use these keys when remote design flags or release toggles are wired. A master kill switch must be checked before more granular audio flags:

- audio.all.enabled
- audio.kill_switch
- audio.ambient.auth
- audio.ambient.orb
- audio.ambient.diary
- audio.feedback.completion
- audio.feedback.milestone
- audio.feedback.notification
- audio.hyperfocus.family.rain

Do not segment by journal content, mood labels, inferred anxiety, inferred ADHD, or any private wellness inference. Safe segmentation is limited to platform/runtime, app language/RTL, explicit audio setting, audio capability, and new/returning status.

## Release Checklist

- Run npm run check:app-audio.
- Confirm public/privacy.html matches the submitted artifact.
- Confirm THIRD_PARTY_NOTICES.md, `src/lib/hyperfocusGeneratedAudioManifest.ts`, and audio provenance files match current bundled audio, including MixKit Hyperfocus sources where present.
- Confirm PWA service worker audio caching behavior is intentional.
- Run installed PWA/Android/iOS/Desktop smoke before release claims, including background pause/resume behavior for Auth, Orb, Settings, and Hyperfocus audio.
- Verify cache-busted public URL after deployment.
- Keep formal legal review of dev-time lamejs LGPL obligations as UNVERIFIED until counsel or owner approval records it.

## Rollback

Rollback is a scoped revert of audio asset, manifest, settings, service-worker, and policy changes, followed by npm run check:app-audio and a cache-busted public URL check after deploy.
