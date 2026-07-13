# Settings Simplification And Live Apply Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Subagent-driven execution is preferred when agent quota is available; the coordinator must independently verify every report.

**Goal:** Replace the cluttered V2 Settings experience with the approved Variant A: five useful destinations, immediate application of safe preferences, explicit reminder consent, contextual ambience controls, complete exit motion, natural eight-locale copy, and evidence-backed behavior across supported platforms.

**Architecture:** Keep the existing V2 list/detail shell and Settings component family. Reduce the Appearance payload to a versioned accent/high-contrast model with a pure legacy migration, make local writes report success before DOM/store commit, keep destructive and remote actions confirmed, and move contextual audio controls to their owning features. Preserve auth, sync owner boundaries, imports, deletion safeguards, canonical orbs, and public routes.

**Tech Stack:** React 18, TypeScript, Zustand, Vitest/Testing Library, Framer Motion, Tailwind, custom i18n, Capacitor 8.

## Global Constraints

- Work in `main` because the user explicitly requested the canonical main worktree.
- Do not commit, stage, push, deploy, or write remote data unless the user separately requests it.
- No production mocks, demo data, placeholders, generated icons, `Sparkles`, wand, bot, or magic shorthand.
- Use existing Lucide icons only where they clarify a top-level destination or real action.
- Safe local preferences apply immediately; storage failure restores the prior UI/DOM state and shows a localized error.
- Account deletion, reset, import/replace, permissions, sign-out recovery, and remote operations retain confirmation/error handling.
- Touch targets remain at least 44 CSS px; logical RTL spacing and Android Back are mandatory.
- Operating-system Reduce Motion always wins over the in-app preference.
- Appearance remains device-local; no account-level theme sync is introduced.
- Old Appearance and Sound payloads stay readable; no real user record is deleted during migration.
- Browser automation requires the user's explicit tool permission immediately before Playwright/Browser execution.

---

## PRE-FLIGHT ARTIFACT

### Atomic goal

The task passes when a user can find every useful setting, safely change Appearance/Sound/Reminders in one interaction, recover from local persistence failure, navigate with complete enter/exit/focus behavior, and no removed or unavailable control remains visible.

### Explicit requirements

- Remove useless Settings controls and generated-looking visual clutter.
- Remove Comfort, Intensity, mood palettes, Preview, Apply, persistent Undo table, duplicate Sound controls, and AI/magic icons.
- Apply safe preferences immediately like Telegram.
- Improve colors across Paper, Ink, and OLED.
- Add missing hide/exit animation.
- Review all Settings and all user scenarios.
- Use deep official research and evidence from the coordinator and ten independent roles.

### Implied requirements

- Preserve legacy preferences without silently enabling disabled sounds.
- Do not turn one reminder toggle into twenty weekly notifications without category-level consent.
- Handle local storage rejection, reload, malformed payload, and multi-tab convergence.
- Keep permission denial, scheduling rollback, Android Back, focus restoration, and system Reduce Motion truthful.
- Cover Web/PWA, Android, iOS, Desktop/Tauri, phone/wide layouts, keyboard, screen readers, long copy, and RTL.
- Keep auth, owner boundaries, export/import/reset, and production-data protections unchanged.

### Current evidence

- `src/pages/nav-v2/settings/V2SettingsAppearancePanel.tsx` uses draft/Preview/Apply while mode, font, and motion already apply immediately.
- `src/pages/nav-v2/settings/V2SettingsAppearanceAdvanced.tsx` exposes five palettes, five accents, three intensities, nested Comfort, three accessibility-like toggles, and repeated `Sparkles`.
- `src/stores/themeCustomization.ts` persists unused `warmth`, hidden `depth`, and couples accent selection to opacity/blur/shadow.
- `src/pages/nav-v2/settings/V2SettingsSoundPanel.tsx` duplicates profiles, four cue toggles, texture filters, reminder preview, and diary ambience.
- `src/pages/nav-v2/settings/V2SettingsNotificationsPanel.tsx` renders a disabled native-only switch on Web.
- `src/pages/nav-v2/settings/V2SettingsPrivacyPanel.tsx` places account reminders under Privacy.
- `src/pages/nav-v2/settings/components/SettingsPageComponents.tsx` conditionally unmounts mobile list/detail without an exit lifecycle.
- `src/lib/reminders.ts` defaults to four global reminder times on weekdays; `src/lib/localNotifications.ts` schedules those as twenty recurring notifications after one master enable.
- `src/pages/nav-v2/settings/V2SettingsNotificationsPanel.tsx` allows every day to be deselected while `src/lib/localNotifications.ts` interprets an empty day list as daily delivery.
- `src/components/settings/account-section/useAccountAuth.ts` resets the name to `Friend` after sign-out through a callback whose current owner in `src/hooks/useSettingsHandlers.ts` marks every value as user-chosen.
- Baseline command: `npm test -- src/pages/nav-v2/__tests__/SettingsPage.test.tsx src/stores/__tests__/themeCustomization.test.ts src/stores/__tests__/themeStore.test.ts src/hooks/__tests__/useShouldAnimate.test.ts src/components/navigation-v2/__tests__/ThemeToggleV2.test.tsx src/features/journal/__tests__/JournalSettingsContent.static.test.ts src/i18n/__tests__/settingsSafetyCopyKeys.test.ts`.
- Baseline result: 163 tests passed and one pre-existing French Settings copy test failed with six exact-value mismatches. This failure is not attributed to the new work and must be resolved by the new copy pass.
- `docs/visual-aesthetic.md` is referenced by the Ruflow+ blueprint but is absent in this checkout; that document-specific review remains `UNVERIFIED` and is replaced by current screenshots, local tokens, the visual guard, browser proof, and the visual critic.

### Failure modes

1. `src/stores/themeStore.ts` could update DOM/store before a rejected local write, making Settings claim success that does not survive reload. Prevention: persist the exact next payload first, commit DOM/state only on success, and RED-test rejection.
2. `src/lib/localNotifications.ts` could retain the implicit twenty-notification schedule. Prevention: migrate explicit mood/focus category flags, default new/disabled users to no categories, preserve active legacy users, and test generated schedules.
3. `src/lib/localNotifications.ts` could convert “no selected days” into daily reminders. Prevention: empty global day selection schedules nothing and the UI shows a truthful recovery prompt.
4. `src/pages/nav-v2/settings/components/SettingsPageComponents.tsx` could restore focus before exit or double-handle Android Back. Prevention: one keyed `AnimatePresence` lifecycle, inert exiting content, deduped close state, and focused component tests.
5. `src/styles/themes.css` could make a new accent readable in one mode but fail in Paper/OLED or high contrast. Prevention: role-pair matrix test for every mode × accent × contrast state and visual screenshots.
6. Moving ambience could leave a real sound unreachable. Prevention: remove Settings preview only after a real Journal control is rendered; preserve Focus/Orb controls and test source ownership.
7. `src/components/settings/account-section/useAccountAuth.ts` could turn the historical `Friend` seed into a custom identity after sign-out. Prevention: carry an explicit `userChosen=false` reset signal and RED-test the owner callback.

### Scope boundaries

Write only V2 Settings, theme/motion/local preference helpers, reminder category migration/scheduling, Journal ambience ownership, Settings i18n values/tests, and Settings visual tokens. Do not modify Supabase schema, auth ownership, cloud event ordering, user content, orb renderers, deployment, store metadata, or native permission manifests.

### Platform matrix before implementation

| Surface | Planned proof |
| --- | --- |
| Web/PWA | Module visibility, reload/cross-tab, phone/wide browser screenshots, console/network check, production build |
| Android | Static Back/permission tests, Android build; emulator runtime remains required for final native PASS |
| iOS | Safe-area/static build checks; simulator runtime remains required for final native PASS |
| Desktop/Tauri | Wide layout, keyboard/focus, build/static contract where available |
| Store/Release | No store/deploy write; status remains UNVERIFIED |
| Accessibility | DOM semantics, keyboard/focus, 44px contract, contrast matrix, reduced motion, RTL screenshots |
| Performance | motion guard, production build, Settings route performance smoke |
| Security/Privacy | owner-boundary regressions, production-data checks, Snyk/security suite |
| Testing | focused RED/GREEN, blast-radius suites, browser/native proof where available |
| Operations | rollback by bounded diff/revert; no remote change |

### Verdict

`GO`. The user approved Variant A and explicitly authorized implementation on `main`. Missing native/browser/ten-role evidence blocks final closure, not safe local TDD progress.

---

### Task 1: Establish Variant A RED contracts

**Files:**
- Modify: `src/pages/nav-v2/__tests__/SettingsPage.test.tsx`
- Modify: `src/stores/__tests__/themeCustomization.test.ts`
- Modify: `src/stores/__tests__/themeStore.test.ts`
- Modify: `src/hooks/__tests__/useReminderMigration.test.ts`
- Modify: `src/lib/__tests__/localNotifications.test.ts`
- Modify: `src/components/settings/account-section/__tests__/useAccountAuth.nativeOAuth.test.tsx`
- Modify: `src/hooks/__tests__/useSettingsHandlers.test.ts`
- Modify: `src/components/navigation-v2/__tests__/ThemeToggleV2.test.tsx`
- Modify: `src/features/journal/__tests__/JournalSettingsContent.static.test.ts`
- Modify: `src/i18n/__tests__/settingsSafetyCopyKeys.test.ts`
- Modify: `src/styles/themes.contrast.test.ts`

**Interfaces:**
- Produces the executable behavior contract for every later task.
- Uses real production modules where feasible; isolated test doubles remain test-only under the production-data policy.

- [ ] Add assertions that Appearance contains System/Light/Dark/Black, four named accents, text size, High contrast, Reduce motion, Language, and Reset.
- [ ] Add negative assertions for Preview, Apply, persistent Undo table, Comfort, Intensity, mood palettes, Reduce glow, separate transparency, repeated leaf medallion, and `Sparkles`.
- [ ] Add tests proving accent/high-contrast selection calls the committed store action immediately.
- [ ] Add store tests for legacy migration, write failure rollback, reset/undo, malformed input, and cross-tab adoption without echo.
- [ ] Add reminder migration tests: active legacy settings map to both categories enabled; disabled/new settings map to neither category enabled.
- [ ] Add schedule tests: only explicitly enabled mood/focus categories generate global notifications, and an empty day selection schedules nothing rather than daily notifications.
- [ ] Add account tests proving sign-out restores the historical `Friend` seed without marking it as a custom user name.
- [ ] Add Sound assertions for master, conditional volume, native haptics, Background sounds, Activity sounds, and absence of profiles/textures/preview/diary ambience.
- [ ] Add IA assertions: About is not a destination, Web omits unavailable Reminders, account reminders render only inside Reminders, and Help/legal/version are footer rows.
- [ ] Add motion/focus assertions for list/detail exit and View Transition gating through the effective motion source.
- [ ] Add Journal ownership assertion for the real diary ambience control.
- [ ] Add exact natural-copy assertions for all eight locales and negative implementation-term assertions.
- [ ] Add contrast-matrix assertions for every shipped mode × accent × high-contrast state.
- [ ] Run the focused command and record expected RED failures caused by the unimplemented Variant A contract.

### Task 2: Make local preference writes honest and migratable

**Files:**
- Modify: `src/lib/safeJson.ts`
- Modify: `src/stores/themeCustomization.ts`
- Modify: `src/stores/themeStore.ts`
- Modify: `src/hooks/useFontScale.ts`
- Modify: `src/lib/dopamineSettings.ts`
- Modify: `src/lib/audioManager.ts`
- Modify: `src/lib/audioComfort.ts`
- Modify: `src/hooks/useAudioComfortSettings.ts`
- Modify: `src/main.tsx`

**Interfaces:**
- `storageSetRaw(key: string, value: string): boolean` reports persistence success.
- `ThemeAccentFamily = "green" | "blue" | "violet" | "amber"`.
- `ThemeCustomization = { schemaVersion: 1; accentFamily: ThemeAccentFamily; highContrast: boolean }`.
- `ThemeWriteResult = { ok: true } | { ok: false; reason: "storage-unavailable" }`.
- Theme actions return `ThemeWriteResult`; ignored return values remain source-compatible.
- `bindThemeRuntimeListeners(): () => void` owns OS color-scheme plus storage-event convergence.
- Font, dopamine, audio, and audio-comfort write APIs return success without changing runtime state on failure.

- [ ] Change raw storage writes to return `true`/`false` while preserving existing callers.
- [ ] Replace the combinatorial customization type with the versioned visible model.
- [ ] Implement pure v0 normalization: palette and legacy accent map to the closest new accent; legacy high contrast or reduced transparency maps to `highContrast`; mode remains untouched.
- [ ] Make accent recipes change only accent-owned semantic roles; make High contrast own solid surfaces/strong borders.
- [ ] Persist the exact next theme payload before DOM/store commit; report failure without a fake success.
- [ ] Add one-step previous customization for transient Undo.
- [ ] Adopt valid newer storage events without write echo; ignore malformed events.
- [ ] Make font, motion, master sound, volume, background sound, activity sound, and haptics keep their previous value when persistence fails.
- [ ] Run Task 1 store/helper tests GREEN before continuing.

### Task 3: Replace Appearance with immediate, familiar controls

**Files:**
- Modify: `src/pages/nav-v2/settings/V2SettingsAppearancePanel.tsx`
- Modify: `src/pages/nav-v2/settings/V2SettingsAppearanceBasics.tsx`
- Delete: `src/pages/nav-v2/settings/V2SettingsAppearanceAdvanced.tsx`
- Create: `src/pages/nav-v2/settings/V2SettingsAppearanceAccent.tsx`
- Modify: `src/pages/nav-v2/settings/components/V2SettingsControlPrimitives.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/navigation-v2/ThemeToggleV2.tsx`

**Interfaces:**
- `AppearanceBasics` renders the four-mode choice plus text size and Reset overflow.
- `AppearanceAccent` renders four named radio-like buttons/swatches and High contrast.
- `AppearancePanel` owns a transient `Changed · Undo`/error live region; no staged draft exists.
- `ToggleRow.icon` becomes optional so inner settings rows need not carry decorative badges.

- [ ] Remove draft, preview, Apply, permanent action deck, advanced disclosure, Comfort, repeated leaf/eyebrow, and sparkle iconography.
- [ ] Apply mode, accent, high contrast, text size, and Reduce motion in their activating interaction.
- [ ] Show a concise polite changed status; expose Undo only when an exact prior customization exists.
- [ ] Show a persistent assertive save error and retain the previous selected state on write failure.
- [ ] Disable in-app re-enabling when OS Reduce Motion is active and explain the effective state.
- [ ] Make `AnimationGate` consume the same user/OS/battery/runtime effective source as other motion helpers.
- [ ] Make `ThemeToggleV2` skip View Transitions whenever the effective motion source disallows motion.
- [ ] Keep Reset in a keyboard-safe overflow menu with enter and exit animation.
- [ ] Run focused Appearance, motion, store, and ThemeToggle tests GREEN.

### Task 4: Simplify Sound and move contextual ambience

**Files:**
- Modify: `src/pages/nav-v2/settings/V2SettingsSoundPanel.tsx`
- Delete: `src/pages/nav-v2/settings/V2SettingsDiaryAmbienceControl.tsx`
- Create: `src/features/journal/JournalAmbienceSetting.tsx`
- Modify: `src/features/journal/JournalSettingsContent.tsx`
- Modify: `src/pages/nav-v2/DiaryPage.tsx`

**Interfaces:**
- Background sounds writes `ambientEnabled`; enabling clears obsolete texture exclusions only after explicit user action.
- Activity sounds writes completion and milestone cues together; legacy partial state reads as on when either category remains audible.
- Reminder cue preference remains preserved but is not duplicated in global Sound.
- Journal ambience uses the real `diary-reflection-loop` asset, user-started playback, master volume, and Background sounds gate.

- [ ] Keep App sounds, conditional Volume, native Haptics, Background sounds, and Activity sounds.
- [ ] Remove profiles, texture filters, separate completion/milestone/reminder rows, reminder preview, and diary ambience from global Settings.
- [ ] Do not silently enable a legacy-disabled reminder cue.
- [ ] Render the real diary ambience control inside Journal settings; keep Orb and Focus ownership unchanged.
- [ ] Remove the unused hidden Diary page audio element after Journal owns the live element.
- [ ] Surface write failures in the Sound panel and retain previous values.
- [ ] Run Sound/Journal/audio tests GREEN.

### Task 5: Correct Reminders consent and Settings information architecture

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/reminders.ts`
- Modify: `src/lib/schemas.ts`
- Modify: `src/hooks/useReminderMigration.ts`
- Modify: `src/lib/localNotifications.ts`
- Modify: `src/pages/nav-v2/SettingsPage.tsx`
- Modify: `src/pages/nav-v2/settings/types.ts`
- Modify: `src/pages/nav-v2/settings/settingsNavigation.ts`
- Modify: `src/pages/nav-v2/settings/V2SettingsControlDeck.tsx`
- Modify: `src/pages/nav-v2/settings/V2SettingsNotificationsPanel.tsx`
- Modify: `src/pages/nav-v2/settings/V2SettingsPrivacyPanel.tsx`
- Modify: `src/pages/nav-v2/settings/V2SettingsAboutPanel.tsx`
- Modify: `src/components/settings/account-section/types.ts`
- Modify: `src/components/settings/account-section/useAccountAuth.ts`
- Modify: `src/hooks/useSettingsHandlers.ts`

**Interfaces:**
- `ReminderSettings.moodCheckInsEnabled?: boolean` and `focusReminderEnabled?: boolean` are device-delivery consent fields.
- Active legacy settings migrate both fields to `true`; disabled/new settings migrate both to `false`.
- `buildGlobalReminderNotifications` includes only explicitly enabled categories.
- `SettingsSupportFooter` replaces the About destination.

- [ ] Keep five actionable destinations on capable native builds: Account, Appearance, Sound, Reminders, Privacy & data.
- [ ] Omit Reminders on Web/PWA when no actionable capability exists; do not render a disabled native-only switch.
- [ ] After permission grant, leave new/previously disabled category toggles off until the user selects Mood check-ins or Focus reminder.
- [ ] Preserve active legacy users by migrating both currently scheduled categories on.
- [ ] Place mood times only under Mood check-ins and focus time only under Focus reminder.
- [ ] Keep days and quiet hours shared and hide schedule details when no category is selected.
- [ ] Treat an empty day selection as no delivery and show a concise “choose at least one day” status; never reinterpret it as every day.
- [ ] Move Android account reminders from Privacy into Reminders.
- [ ] Keep notification sound selection Android-only with existing rollback.
- [ ] Remove About from routing/types/control deck; render feedback, legal, licenses, version, install/update as quiet footer rows.
- [ ] Do not render a marketing summary or raw release notes.
- [ ] Keep Account, data import/export/reset, ad consent, journal auto-lock, deletion, and sign-out recovery behavior unchanged.
- [ ] Reset the historical `Friend` seed after sign-out with `userNameCustom=false`; ordinary profile edits still set `userNameCustom=true`.
- [ ] Run reminder, account/privacy/data, and Settings IA tests GREEN.

### Task 6: Add complete mobile enter/exit and focus behavior

**Files:**
- Modify: `src/pages/nav-v2/settings/components/SettingsPageComponents.tsx`
- Modify: `src/pages/nav-v2/SettingsPage.tsx`
- Modify: `src/pages/nav-v2/settings/V2SettingsAppearanceBasics.tsx`

**Interfaces:**
- Mobile workspace uses one keyed `AnimatePresence mode="wait"` lifecycle for overview/detail.
- Normal detail enter/exit: opacity plus 8px logical-axis movement, 180ms.
- Reduced motion: opacity duration zero and no spatial/height/view transition.
- `onMobileTransitionComplete(view)` triggers focus restoration after exit.

- [ ] Keep desktop list/detail mounted without mobile transition churn.
- [ ] Mark exiting content inert and prevent duplicate close/back actions during the exit.
- [ ] Restore focus to the originating card only after detail exit completes.
- [ ] Focus the detail region only after detail enter completes.
- [ ] Deduplicate Android Back/history while a close is active.
- [ ] Animate the Reset overflow menu out before removing it.
- [ ] Run component motion/focus/history tests GREEN.

### Task 7: Neutralize Settings surfaces and rewrite natural copy

**Files:**
- Modify: `src/styles/themes.css`
- Modify: `src/i18n/types.ts`
- Modify: `src/i18n/languages/en.ts`
- Modify: `src/i18n/languages/uk.ts`
- Modify: `src/i18n/languages/es.ts`
- Modify: `src/i18n/languages/de.ts`
- Modify: `src/i18n/languages/fr.ts`
- Modify: `src/i18n/languages/ja.ts`
- Modify: `src/i18n/languages/ar.ts`
- Modify: `src/i18n/languages/he.ts`

**Interfaces:**
- Appearance labels: System, Light, Dark, Black; ZenFlow green, Blue, Violet, Amber; Text size; High contrast; Reduce motion.
- Sound labels describe App sounds, Background sounds, Activity sounds, and Haptics in user language.
- Reminder copy names the recurring schedule and category effect without implementation terms.

- [ ] Replace green-tinted Settings shell/card/panel tokens with neutral Paper, Ink, and OLED roles while keeping ZenFlow green as the default accent.
- [ ] Remove obsolete palette-specific and transparency/glow selectors that no live state emits.
- [ ] Keep accent limited to selection, focus, switches, and primary emphasis.
- [ ] Translate whole thoughts in all eight locales; do not concatenate translated fragments.
- [ ] Avoid `platform`, `PWA`, renderer/GPU, local storage, queue, database/cache, and other implementation terms in ordinary Settings copy.
- [ ] Preserve placeholders and logical RTL behavior.
- [ ] Run contrast matrix, `npm run i18n:check`, `npm run i18n:deep`, `npm run check:translation-quality`, and `npm run check:no-ai-templates` GREEN.

### Task 8: Full proof, review, and ten-role closure

**Files:**
- Modify if required by test changes: `e2e/nav-v2-settings.spec.ts`
- No production file changes after final proof without rerunning the complete affected matrix.

- [ ] Run focused Settings/store/reminder/audio/journal tests after the final edit.
- [ ] Run `npm run typecheck`, `npm run lint`, `npm run check:all`, and a production build.
- [ ] Run production-data source/diff/build/bundle checks and verify exact baseline/waiver ledgers.
- [ ] Run `npm run check:canonical-orbs`, `npm run check:visual`, fullscreen static contracts, and Settings performance smoke.
- [ ] Run Snyk Code if callable; otherwise local Snyk CLI fallback, plus the scoped security suite. Missing auth/network remains UNVERIFIED.
- [ ] With explicit browser-tool permission, run Settings E2E and capture phone/desktop screenshots for Paper/Ink/OLED, long Ukrainian/German, Arabic/Hebrew RTL, keyboard, reduced motion, and storage/permission error states.
- [ ] Run Android build and iOS sync/build gates where the local toolchain supports them; physical/simulator evidence remains UNVERIFIED if unavailable.
- [ ] Run the local visual-integrity critic against current screenshots and source artifacts.
- [ ] Dispatch exact roles 2–9 as independent read-only reviews and verify every cited finding locally.
- [ ] Run role 10 isolated Pass A against plan/diff/evidence and Pass B after every STOP is closed.
- [ ] Role 1 coordinator issues final `GO` only when all ten roles return evidence-backed `GO`; usage-limit errors, interruptions, or summaries without proof do not count.
- [ ] Write the final Best Practices Packet and Done Packet with PASS/PARTIAL/UNVERIFIED/FAIL rows.

## Self-review

- Spec coverage: all twenty specification sections map to Tasks 1–8.
- Placeholder scan: no `TODO`, `TBD`, fake data, future implementation placeholder, or generic “add tests” step remains.
- Type consistency: new Appearance and Reminder field names are defined once above and reused consistently.
- Scope control: no Supabase migration, auth rewrite, orb replacement, dependency addition, deploy, or remote write is planned.
- Commit steps are intentionally omitted because the user did not authorize staging or commits; verification evidence remains in the working tree and command output.

## UNVERIFIED before execution

- Browser automation permission for Playwright/Browser.
- Physical Android/iOS and packaged Tauri runtime availability.
- Human native-speaker acceptance for all eight locales.
- Public GitHub Pages state because no deployment is authorized.
- Ten-role closure because current subagent runs can still be blocked by the external usage limit.
