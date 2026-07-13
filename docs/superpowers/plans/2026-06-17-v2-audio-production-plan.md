# V2 Audio Production Plan

- Date: 2026-06-17
- Project: ZenFlow / people-first-app V2
- Scope: Web/PWA, Android/Capacitor, iOS/WKWebView, Desktop/Tauri
- Status: Active production queue; generate and integrate one Gemini MP3 at a time.

## Goal

Build a calm, premium, optional sound layer for V2 without making audio mandatory, noisy, or performance-heavy. Every long-form MP3 must be started by the user, must never autoplay, must be easy to stop, and must survive mobile/browser audio restrictions through explicit tap behavior.

## Non-negotiable Rules

1. No autoplay. Every music or ambience track starts only after a user tap/click.
2. Use bundled local MP3 files under `public/sounds/`; no remote audio URLs in runtime.
3. Use `preload="none"` for long ambience/music tracks unless a later performance proof justifies otherwise.
4. Long tracks loop quietly; short event sounds stay in the existing `audioManager` or native notification system unless a real MP3 is needed.
5. Do not replace or visually disturb canonical V2 orb surfaces: `ValenceOrb` remains the visual source of truth.
6. Add localized labels for every visible control in all 8 languages: en, uk, es, de, fr, ja, ar, he.
7. Respect RTL layout and 44px minimum touch targets.
8. Keep audio decorative: if playback fails or is blocked, the workflow still works and shows retry/stop state.
9. Asset budget: prefer 60-90 second seamless MP3 loops for ambience; keep each final file ideally under 3 MB.
10. Verify desktop and phone V2 routes after each integration.

## Existing Sound Inventory

| File | Size | SHA-256 | Current role |
| --- | ---: | --- | --- |
| `public/sounds/measured-breath.mp3` | 4.1 MB | `df3f626504990487132cc68345288103bc23b6b5442cc8160705b3b6001212f4` | Auth screen, user-started breathing/arrival control |
| `public/sounds/polished-stone-and-paper.mp3` | 2.1 MB | `a504c6d135e1a090188add987c4e2d02d0ae3b32b800ed49081a572b6ae85483` | Orb V2 optional ambience |
| `public/sounds/v2-diary-reflection-loop.mp3` | 1.7 MB | `79a8dd1b0cac98b17cb67f5c448ac8610c65dbaa2469a99baee40830584e6a41` | Diary V2 optional ambience; Gemini source `Ink_and_Felt.mp3`, 74.501s, 192 kbps, 44.1 kHz stereo |
| `public/sounds/cafe-noise-32940.mp3` | 1.9 MB | `c28b74685b2799fc1f12c0d566768a79e2c5776c1abdc4d79de4210bbb8c6432` | Existing hyperfocus ambient option |
| `public/sounds/fireplace-fx-56636.mp3` | 1.8 MB | `d267f9850eac15ffcc0c8815437ab3569b6ab82db3e1206d028bbb0f56ea41c7` | Existing hyperfocus ambient option |
| `public/sounds/mixkit-calm-thunderstorm-in-the-jungle-2415.mp3` | 576 KB | `8a99c0dc025281abf9e6f8b826dc5da5dedaa90ce93b31086869aebfeb516cd5` | Existing hyperfocus ambient option |
| `public/sounds/mixkit-small-waves-harbor-rocks-1208.mp3` | 916 KB | `cc87846e1db597a0af8141295df4eb813f7fa788751aa0bd18731ee26f8c03c9` | Existing hyperfocus ambient option |
| `public/sounds/mixkit-underwater-transmitter-hum-2135.mp3` | 164 KB | `1884a0e71d5b31c7d578ea0a1a059d8228f2043498cf3757a621c83d7b35d818` | Existing hyperfocus ambient option |
| `public/sounds/mixkit-wildlife-environment-in-a-river-2456.mp3` | 1.4 MB | `9fd5be28e9a6c8b6dcc4ea836c34d7f0e1c9a960c65ef30042b0af531b2936af` | Existing hyperfocus ambient option |

## V2 Audio Map

| Priority | Surface | Audio need | Why it belongs there | Implementation status |
| ---: | --- | --- | --- | --- |
| 0 | Auth entry | Long calm arrival/breath loop | Reduces cold-start harshness and creates first emotional tone before the app opens | Done: `measured-breath.mp3` with user-started play/pause |
| 0 | Orb V2 | Low tactile orb ambience | The Orb is the emotional check-in core; ambience should feel like a quiet object in the hand, not a song | Done: `polished-stone-and-paper.mp3` with user-started play/pause/retry |
| 1 | Diary V2 | Seamless writing/reflection loop | The diary is the longest quiet-session surface and previously had no ambient bed except user-recorded entry audio | Done: Gemini `Ink_and_Felt.mp3` integrated as `v2-diary-reflection-loop.mp3` |
| 2 | Habits V2 | Very short completion accent or keep generated tone | Habit completion needs feedback, but too much audio can become annoying; existing haptics/audioManager may be enough | Do not generate until Diary is validated |
| 3 | Settings/Notifications | Preview tone only for native notification choices | Settings should preview choices, not run music | Use existing notification channel model first |
| 4 | Focus/Hyperfocus | Curated ambient library | Already has local ambience and a sound selector; expand only if existing choices feel off-brand | Later, only after V2 core surfaces |
| 5 | Streak/level-up | Brief reward sound | Reward should be rare and subtle; current oscillator sounds are already wired | Replace only after user testing says it feels cheap |
| 6 | Error/blocked states | Soft negative cue | Audio errors can annoy; prefer visual retry text and haptic warning | No MP3 needed now |

## Gemini Generation Queue

Generate one item, download MP3, normalize/inspect, integrate, verify, then move to the next. Do not generate the whole catalog blindly.

1. `v2-diary-reflection-loop.mp3` — done; generated in Gemini as `Ink_and_Felt.mp3`, integrated into Diary V2.
2. `v2-habit-complete-soft-accent.mp3` — only if we decide a file-based accent is better than the current generated chime.
3. `v2-focus-deep-work-loop.mp3` — only if existing hyperfocus sounds do not fit V2 premium tone.
4. `v2-evening-review-loop.mp3` — optional, for weekly/insights/review surfaces if they become longer sessions.
5. `v2-notification-preview-soft.mp3` — optional native preview only; likely unnecessary while Android channels use system sounds.

## Prompt 1: Diary Reflection Loop

Use this exact prompt in Gemini for the next MP3:

```text
Create one seamless ambient music loop for a premium mindfulness journaling app screen.

Purpose: V2 Diary / writing and reflection mode. The user may write for several minutes, so the track must support calm focus without demanding attention.

Duration: 70 to 90 seconds.
Format: MP3 if available.
Looping: must feel seamless when repeated; no obvious beginning or ending.
Mood: intimate, grounded, warm, private, emotionally safe, thoughtful.
Tempo: no clear beat, no drums, no pulse stronger than a slow breath.
Instrumentation: soft felt piano fragments, very quiet warm pads, subtle paper/cloth texture, faint room air, gentle low-mid warmth. Optional barely audible glass/stone resonance.
Dynamics: very stable, no sudden swells, no drops, no loud transient hits.
Mix: quiet background level, no clipping, no distortion, no harsh high frequencies, no deep sub-bass rumble.
Avoid completely: vocals, lyrics, spoken words, choir, pop structure, cinematic trailer rise, orchestral drama, bells that sound like notifications, horror tension, rain/thunder/waves/cafe/fireplace/nature ambience, ASMR mouth sounds, obvious metronome, sad melody, triumphant melody.
Target feeling: sitting at a clean desk late evening, writing honestly, breathing slower, feeling held but not manipulated.
Name suggestion: v2-diary-reflection-loop.
```

Acceptance criteria for the downloaded MP3:

1. 70-90 seconds, or close enough to loop without fatigue.
2. No vocals or speech.
3. No strong melody that competes with reading/writing.
4. No obvious alert-like chimes.
5. No nature/cafe/fireplace overlap with existing hyperfocus library.
6. Works at low volume around 0.28-0.36.
7. File name copied to `public/sounds/v2-diary-reflection-loop.mp3` after inspection.

## Diary Integration Contract

Target files are expected to be:

- `src/pages/nav-v2/DiaryPage.tsx` for V2 page-level optional audio.
- `src/pages/nav-v2/__tests__/DiaryPage*.test.*` or a new focused test for the page-level control.
- `src/i18n/languages/*.ts` and `src/i18n/types.ts` for labels.
- `ARCHITECTURE.md` counts regenerated after adding MP3 size.

Expected behavior:

1. Render hidden/local `<audio>` for the loop with `loop`, `preload="none"`, no `autoplay`.
2. Render a compact play/pause/retry control near the Diary page chrome, not inside a card-within-card.
3. Control starts playback only from user tap.
4. Pause toggles immediately.
5. Blocked playback sets retry state.
6. Unmount pauses audio and clears `src`.
7. The journal editor, voice-note player, and entry audio attachments stay untouched.
8. Route performance must not regress: no preload and no heavy work on first interactive frame.

## Verification Checklist Per Track

Automated:

1. Target unit/component test red before implementation, green after.
2. `npm run typecheck`.
3. `npm run i18n:check` and `npm run i18n:deep` if labels change.
4. `npm run check:colors` for UI class/style changes.
5. `npm run check:canonical-orbs` if Orb files or shared visuals are touched.
6. `npm run doc-counts` after adding/removing sound files.

Runtime:

1. Local V2 phone route: `/people-first-app/diary?nav=v2&navLayout=phone`.
2. Local V2 desktop/web route: `/people-first-app/diary?nav=v2&navLayout=web` or desktop viewport.
3. Confirm MP3 response is `200 audio/mpeg`.
4. Confirm audio is paused before tap.
5. Confirm tap plays, second tap pauses.
6. Confirm no console errors from the new control.
7. Capture phone and desktop screenshots.

Known current external blocker:

- `npm run check:visual` has a pre-existing failure in `src/pages/nav-v2/DayCosmicBackground.css` about the Paper Orb daylight corona. Do not mark full visual suite PASS until that unrelated guard is fixed.

## Desktop Version Answer

The desktop V2 shell exists and is selected through the V2 navigation orchestrator. It uses the web/desktop sidebar layout when the device tier is not phone, and Tauri desktop runtime is covered by existing desktop-runtime selection tests. Audio additions must be verified in both phone and desktop/web layouts.

## Production Log: Diary V2 Ambience

Generated and downloaded from Gemini on 2026-06-17:

- Source download: `/Users/yehor/Downloads/Ink_and_Felt.mp3`.
- Project asset: `public/sounds/v2-diary-reflection-loop.mp3`.
- SHA-256: `79a8dd1b0cac98b17cb67f5c448ac8610c65dbaa2469a99baee40830584e6a41`.
- Format evidence: MP3, ID3 2.3, MPEG layer III, 192 kbps, 44.1 kHz, joint stereo.
- Duration evidence: `afinfo` estimated duration `74.501167 sec`.
- Runtime integration: `src/pages/nav-v2/DiaryPage.tsx` renders a user-started loop with `preload="none"`, `loop`, `playsInline`, no autoplay, play/pause/retry state, and unmount cleanup.
- Tests added: `src/pages/nav-v2/__tests__/DiaryPage.audio.test.tsx`.
- i18n added: `diaryAmbienceLabel`, `diaryAmbiencePlay`, `diaryAmbiencePause` in all 8 supported languages.

Fresh verification:

- PASS: red baseline before implementation: `npm test -- src/pages/nav-v2/__tests__/DiaryPage.audio.test.tsx` failed 3/3 because audio/control did not exist.
- PASS: target test after implementation: 3/3 passed.
- PASS: nearby tests: `npm test -- src/pages/nav-v2/__tests__/DiaryPage.audio.test.tsx src/pages/nav-v2/__tests__/DiaryRouteLoader.test.ts src/pages/nav-v2/__tests__/integration.orbToDiaryHandoff.test.tsx` -> 12/12 passed.
- PASS: `npm run typecheck`.
- PASS: `npm run i18n:check` and `npm run i18n:deep` -> 3058 keys/string values across 8 languages.
- PASS: `npm run lint`.
- PASS: `npm run check:colors`.
- PASS: `npm run doc-counts`; `ARCHITECTURE.md` regenerated.
- PARTIAL: `npm run check:visual` passed canonical orb, logos, and visual regression guard, then failed on pre-existing `src/pages/nav-v2/DayCosmicBackground.css` Paper Orb daylight-corona guard.
- PASS: browser phone route `/people-first-app/diary?nav=v2&dev=true&navLayout=phone`: before click paused, no autoplay; after click playing; second click paused; MP3 served as `audio/mpeg`.
- PASS: browser desktop route `/people-first-app/diary?nav=v2&dev=true&navLayout=web`: same behavior.
- Evidence files: `output/playwright/diary-ambience-phone.png`, `output/playwright/diary-ambience-desktop.png`, `output/playwright/diary-ambience-results.json`.
- UNVERIFIED: Snyk code scan fallback was started with `snyk code test --severity-threshold=high --json-file-output=output/snyk-code-20260617-diary-audio.json .`, but produced no output/report and was stopped after repeated waits.
