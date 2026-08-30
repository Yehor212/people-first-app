# Verification Quickstart

1. Run the focused RED/GREEN tests named in `tasks.md`.
2. Run typecheck, lint/i18n/visual contracts, production-data-integrity diff, native patch contracts, UMP/readiness negative controls, and a production build bundle scan.
3. Build the explicit Android QA variant with Google's official test identifiers; hash the APK and record package/version identity.
4. Install that exact hash on the dedicated API 36 emulator.
5. Use UIAutomator-derived targets to exercise eligible/denied states, overlays, IME, back, rotation, split-screen, lifecycle, repeated navigation, RTL, large font, and safe-area reachability.
6. Capture same-state screenshots and native logs. Never click the ad.
7. Keep live serving, Play Console, signed release, physical device, iOS/PWA/Desktop runtime, TalkBack human quality, and artistic acceptance `UNVERIFIED` unless freshly proven.
