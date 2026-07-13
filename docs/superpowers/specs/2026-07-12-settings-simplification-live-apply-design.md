# ZenFlow Settings Simplification And Live Apply Design

Date: 2026-07-12
Status: Approved direction A; written specification awaiting user review
Scope: V2 Settings information architecture, Appearance, Sound, Reminders, Privacy/Data, About, shared Settings primitives, local preference persistence, Settings motion, and all eight supported locales.

## 1. Goal

Make Settings useful, predictable, and calm for ordinary ZenFlow users:

- every safe preference applies immediately;
- each visible control has a distinct user outcome;
- advanced implementation concepts are removed from user language;
- visual choices remain accessible in Paper, Ink, and OLED modes;
- navigation, disclosure, and dismissal have complete enter and exit behavior;
- decorative AI/magic shorthand is removed from Settings;
- account, import, reset, and deletion safety remains unchanged.

## 2. User-Reported Failures

The four supplied screenshots and current source confirm these failures:

1. Appearance uses a large brand medallion and nested cards before the useful controls.
2. Advanced Appearance exposes a combinatorial palette × accent × intensity model.
3. Comfort contains controls whose names do not explain a concrete user result.
4. Preview, Apply, and Undo create a staged workflow while theme mode, text size, and motion already apply immediately.
5. Native `details` elements and conditional renders rotate a chevron or disappear without a matching content exit.
6. Sound presents presets and then repeats the same concepts as individual switches and inverse texture filters.
7. Repeated sparkle icons, icon chips, glass cards, and long descriptions make the screen look generated rather than product-specific.
8. Some platform-specific rows are visible even when the current platform cannot perform the action.

## 3. Current Technical Causes

### 3.1 Appearance state is split

`V2SettingsAppearancePanel.tsx` keeps an uncommitted `draft`, previews it directly in the DOM, and persists it only after Apply. The same panel applies theme mode, font scale, and motion immediately. One screen therefore has two incompatible interaction rules.

`themeStore.ts` already owns immediate DOM application, persistence, reset, and one-step undo. The redesign will make this store boundary the only committed Appearance path.

### 3.2 Visual controls are not independent

`themeCustomization.ts` stores `warmth` even though the recipe does not use it. `depth` affects recipes but is no longer exposed. A single non-default accent also activates opacity, blur, and shadow branches. `reduceGlow` can therefore alter more than glow, and can be visually inert from the default state.

The existing visible model exposes up to 600 combinations per applied mode before font and motion settings. Current contrast evidence does not cover that complete matrix.

### 3.3 Motion authority is fragmented

The persisted motion preference, operating-system Reduce Motion, battery state, runtime performance mode, `motion-safe` CSS, `AnimationGate`, and `ThemeToggleV2` do not all consult one effective state.

Mobile Settings detail, Advanced Appearance, Comfort, and the overflow menu use conditional mounting or native `details` without an exit lifecycle.

### 3.4 Sound duplicates the same decisions

`V2SettingsSoundPanel.tsx` presents Quiet/Balanced profiles, four related sound switches, three inverse texture filters, a reminder preview, and diary ambience. Several controls describe where a sound asset happens to be used instead of a familiar user outcome.

## 4. Source-Backed Design Basis

- Android Settings guidance: keep a manageable number of infrequently accessed preferences, use list/list-detail layouts, place contextual preferences near the feature, use supporting text only when needed, and use icons to clarify meaning or status.
  - https://developer.android.com/design/ui/mobile/guides/patterns/settings
- Microsoft app-settings guidance: keep settings simple and make a safe preference immediately reflect its new value without a commit button.
  - https://learn.microsoft.com/en-us/windows/apps/design/app-settings/guidelines-for-app-settings
- Apple toggle and undo guidance: use toggles only for two opposing states, make state visibly clear, and make reversible exploration predictable.
  - https://developer.apple.com/design/human-interface-guidelines/toggles
  - https://developer.apple.com/design/human-interface-guidelines/undo-and-redo
- W3C motion guidance: non-essential interaction motion must have a reduced-motion path.
  - https://www.w3.org/WAI/WCAG22/Techniques/css/C39
- Material color guidance: custom color must use paired semantic color roles rather than arbitrary foreground/background combinations.
  - https://developer.android.com/develop/ui/compose/designsystems/material3
- Telegram comparison: a small mode/theme set and an app-wide accent are understandable customization primitives. Telegram is a comparator, not authority to copy its visuals.
  - https://telegram.org/blog/themes-accounts

## 5. Approved Information Architecture

### 5.1 Overview

The actionable overview contains five destinations:

1. Account
2. Appearance
3. Sound
4. Reminders
5. Privacy & data

Help, feedback, legal information, version, install, and update actions become quiet footer rows below the main list. They remain reachable but no longer compete with preferences.

The overview remains list/detail on wide screens and list → detail on compact screens. Top-level rows may use one unique semantic Lucide icon. Inner rows default to text plus their actual control and use an icon only when it prevents ambiguity.

### 5.2 Account

Keep:

- user name;
- sign-in state and connected methods;
- account backup/sync status;
- device sessions;
- sign out;
- delete account with the existing owner-bound confirmation.

Change only presentation and hierarchy. Do not alter authentication, sync, deletion, or owner-boundary behavior in this redesign.

### 5.3 Appearance

The Appearance detail contains these groups in this order:

1. Mode: System, Light, Dark, Black.
2. Accent: ZenFlow green, Blue, Violet, Amber.
3. Text size.
4. Accessibility: High contrast and Reduce motion.
5. Language.
6. Reset appearance in the overflow menu.

Remove from user UI:

- Mood palette;
- Morning Hearth, Velvet Library, Botanical Pulse, and Quiet Black as marketing-style presets;
- Intensity;
- Comfort;
- Reduce glow;
- separate Reduce transparency;
- Preview;
- Apply;
- persistent Undo action table;
- the repeated 92px leaf medallion and `ZENFLOW` eyebrow inside the detail screen.

High contrast will use solid-enough surfaces and stronger boundaries as one coherent accessibility outcome. It must affect the shared app surface tokens it claims to affect, not only Settings.

Reduce motion is a positive, truthful preference. Operating-system Reduce Motion always wins. When the device already reduces motion, supporting text says so and the app cannot re-enable it.

### 5.4 Sound

Keep in global Settings:

- App sounds;
- Volume, visible only while app sounds are enabled;
- Haptics on supported native devices;
- Background sounds;
- Activity sounds.

Move:

- reminder sound selection to Reminders;
- diary ambience selection and preview to Journal;
- focus ambience selection and preview to Focus;
- any orb-specific ambience choice to the Orb surface.

Remove from global Settings:

- Sound comfort profiles;
- Air/Water/Rain inverse texture filters;
- separate completion, milestone, and reminder cue toggles;
- duplicate reminder preview.

Existing stored granular fields remain readable during migration so an update does not unexpectedly enable a sound the user had disabled. The new two-control model writes a normalized backward-compatible representation.

### 5.5 Reminders

Native Reminders contains:

- a master reminder state;
- mood check-in times;
- focus reminder time;
- reminder days;
- quiet hours;
- reminder sound on Android;
- account-delivered reminders when that capability exists;
- recovery guidance only when permission or system settings actually block delivery.

Web/PWA must not show a disabled switch that can never work. If there is no actionable reminder capability, the overview omits the destination and the mobile-app explanation appears only where an installation path is genuinely available.

Habit reminders remain configured from each habit because they are contextual to the habit.

### 5.6 Privacy & data

Keep:

- optional rewarded-video consent;
- required Google privacy choices when available;
- journal auto-lock when journal protection exists;
- backup export and import;
- CSV/PDF reports;
- reset local data with its existing typed confirmation;
- direct Privacy and Terms access.

Move account-delivered reminders out of Privacy and into Reminders. Privacy copy must describe data or consent, not notification scheduling.

Destructive and data-transfer actions remain visually separated at the bottom. Immediate apply never applies to import, reset, account deletion, permissions, or remote actions that can fail or have material consequences.

### 5.7 Help and About

Use compact footer rows for:

- Send feedback;
- Privacy;
- Terms;
- Licenses;
- app version;
- install, update check, or store action when supported.

Do not restore the raw developer changelog. Do not render an app-marketing summary inside Settings.

## 6. Immediate-Apply Interaction Contract

For a safe local preference:

1. The user activates a visible option.
2. The option becomes selected immediately.
3. The DOM uses the new semantic tokens in the same interaction.
4. The validated preference is persisted.
5. A short non-modal status appears: `Changed` with an optional `Undo` action.
6. Undo restores the exact previous committed value.

There is no Preview or Apply button.

Continuous controls update the visual result while moving. Persistence may be coalesced, but the final value must be stored before the control settles or the user leaves the screen.

If persistence fails:

- restore the previous store and DOM state;
- retain a localized visible error until the user changes the setting again or retries;
- never announce that the setting was saved;
- never discard the error through a silent catch.

## 7. Preference Model And Migration

### 7.1 New user-facing model

The persisted Appearance payload keeps only fields with a visible effect:

- `mode`: existing theme preference;
- `accent`: four semantic accent families;
- `highContrast`: boolean;
- motion preference remains in one device-local accessibility record;
- font scale remains device-local.

Black remains a mode, not a palette pretending to be available in Light mode.

### 7.2 Migration

The current payload is read as version 0 and normalized once:

- `paletteId` maps to the closest supported mode/accent without changing light/dark mode unexpectedly;
- `accentFamily` maps to one of the four supported accents;
- `contrastMode=high` maps to `highContrast=true`;
- `reduceTransparency=true` also maps to `highContrast=true` because the new high-contrast recipe owns solid readable surfaces;
- `intensity`, `warmth`, `depth`, and `reduceGlow` stop affecting the new recipe;
- the old payload remains parseable for rollback compatibility.

No appearance preference is synced per account in this pass. It remains device-local. Account-level appearance sync is a separate product decision because it requires owner binding and cross-device conflict behavior.

### 7.3 Cross-tab behavior

Valid newer preference changes from another tab are adopted without write echo. Malformed or older events are ignored. All open tabs converge on the latest committed device-local value.

## 8. Color Contract

The visual system uses neutral surfaces and semantic paired roles. Accent color appears in selection, focus, switches, and primary action emphasis; it does not tint every card.

Modes:

- Paper: warm neutral background, near-white raised surface, dark neutral text.
- Ink: neutral green-black background, distinct raised surface, soft light text.
- OLED: true black background, near-black surface, light text.
- System: resolves live to Paper or Ink.

Accents:

- ZenFlow green;
- Blue;
- Violet;
- Amber.

Each accent has separate Paper and dark tonal values and a paired `on-accent` value. Components must use role pairs such as accent/on-accent and surface/on-surface. Accent changes must not alter blur, opacity, depth, or shadow.

Acceptance requires generated verification for every shipped mode × accent × contrast combination. A combination is rejected if normal text, selected text, focus, border, switch, or disabled-state meaning depends only on color or misses the project contrast threshold.

## 9. Motion Contract

One effective motion source combines:

- the user device-local Reduce Motion preference;
- operating-system `prefers-reduced-motion`;
- critical battery state;
- runtime performance degradation.

All Settings transitions use that source.

Normal-motion behavior:

- overview → detail: 180ms opacity plus 8px logical-axis movement;
- detail → overview: matching exit before focus restoration;
- disclosure open/close: 180ms height plus opacity;
- overflow menu: 140ms opacity plus 4px movement;
- transient change status: short opacity transition;
- theme/accent change: no spatial sweep; tokens update immediately with at most a brief color crossfade.

Reduced-motion behavior:

- no spatial movement, height tween, blur tween, or view transition;
- state changes immediately;
- focus and semantic updates remain complete;
- essential progress feedback remains visible without decorative motion.

Leaving content becomes inert during exit, is removed once, and cannot retain focus. Android Back is deduplicated during an active exit.

## 10. Visual And Iconography Contract

- Preserve the canonical ZenFlow leaf shape and existing brand assets.
- Do not repeat the leaf as a decorative medallion inside Appearance.
- Do not use `Sparkles`, wand, bot, magic-star, or AI shorthand anywhere in visible Settings.
- Use the existing Lucide library; do not draw approximate SVGs or introduce generated assets.
- Top-level destinations may use one unique semantic icon.
- Inner rows omit icons when their label and control already explain the action.
- Remove nested card-in-card treatment. Use one grouped surface with separators and clear section headings.
- Keep at least 44 CSS px interactive targets and logical RTL spacing.

The redesign must remain recognizably ZenFlow through typography, neutral paper/ink materials, spacing, one accent, and the canonical shell — not through repeated decorative badges.

## 11. Copy And Localization

All visible copy must be natural in `en`, `uk`, `es`, `de`, `fr`, `ja`, `ar`, and `he`.

Copy rules:

- name the user result, not the implementation mechanism;
- prefer `Reduce motion` to `Animations` when the control reduces effects;
- use color names, not invented mood-brand names;
- avoid `platform`, `renderer`, `GPU`, `local storage`, `sync queue`, and similar implementation terms;
- do not concatenate translated fragments;
- preserve placeholders and RTL safety;
- supporting text appears only when a label or current-value summary is insufficient.

Native-speaker acceptance remains unverified until actual native speakers review the final eight-locale copy.

## 12. Accessibility Contract

- Switches represent only binary states.
- Choice sets expose one selected value through `aria-pressed`, radios, or an equivalent accessible pattern.
- Color swatches have visible names and do not rely on hue alone.
- Focus remains visible and unobscured.
- Heading order and region labels remain stable across overview/detail transitions.
- 200% browser zoom and the repository's 150% app text option do not clip controls.
- `ar` and `he` use logical spacing and motion direction.
- System Reduce Motion cannot be overridden by the app.
- High contrast is a coherent app surface state, not a Settings-only claim.
- Screen-reader state changes use concise live regions without repeated announcements.

## 13. Platform Matrix

### Web/PWA

- immediate DOM and persisted preference update;
- multi-tab convergence;
- no disabled native-only reminder switch;
- service-worker/public behavior is not claimed until deployed and cache-busted verification runs.

### Android

- 48dp-equivalent native interaction expectation remains a verification target;
- Android Back during Settings exit and dialogs;
- reminder permission/system settings;
- notification sound rescheduling rollback;
- haptics only where supported.

### iOS

- WKWebView safe area and font reflow;
- Reduce Motion and VoiceOver;
- notification/Focus-mode guidance;
- no Android-store action.

### Desktop/Tauri

- wide list/detail layout;
- keyboard navigation and focus restoration;
- persisted preference and window reload behavior;
- update capability remains platform-owned.

Physical-device and packaged-runtime proof remains `UNVERIFIED` until those targets are run.

## 14. Security, Privacy, And Data Boundaries

- No new remote write or analytics event is required.
- No raw journal, mood, habit, focus, or account content is read for customization.
- Appearance remains device-local and account-agnostic.
- Existing auth owner boundaries, deletion confirmations, import validation, backup integrity, ad consent, and privacy-choice flows are not weakened.
- Test fixtures remain isolated from production.
- Storage failure is an honest unavailable/error state, never a fake success.

## 15. Verification Design

### 15.1 RED evidence before production edits

Tests must first prove the current failure for:

- staged Preview/Apply instead of immediate apply;
- hidden/nonfunctional customization fields;
- accent changes altering unrelated surface properties;
- absent exit lifecycle;
- false visible motion state when the system reduces motion;
- duplicated Sound controls;
- unavailable Web reminder control;
- forbidden Settings sparkle icons;
- migration of current persisted settings;
- persistence failure and cross-tab convergence.

### 15.2 GREEN evidence

- focused theme/customization/store unit tests;
- focused Settings component tests;
- motion lifecycle and focus tests;
- data/account/privacy regression tests;
- i18n parity, deep, and translation-quality checks;
- no-AI-template guard;
- production-data-integrity diff and bundle checks;
- typecheck, lint, build, and Settings E2E;
- computed contrast matrix for every shipped mode/accent/contrast state;
- screenshots at 320, 390, tablet, and desktop widths for Paper, Ink, OLED, long German/Ukrainian, and Arabic/Hebrew RTL;
- reduced-motion and keyboard flows;
- Snyk Code or the documented fallback for changed first-party code.

### 15.3 Ten-role approval gate

Final closure requires the exact tracked roster:

1. Coordinator / Teamlead
2. Psychology, Human Factors & Emotional Safety
3. Logic, Causality & State Coherence
4. Interaction, Accessibility, Readability, Localization & Culture
5. Technical Architecture, Data & Cross-Platform
6. Security, Privacy & Agent Trust
7. Performance, Reliability & Operations
8. QA, Evidence & Release Verification
9. Product Discovery, Visual Craft & Experience Quality
10. Independent Blind-Spot Sentinel

Roles 2–9 are read-only independent reviews. Role 10 requires an isolated Pass A and a closure Pass B. A specialist `STOP` is fixed and rerun; approvals are not averaged. An unavailable or usage-limited agent remains `UNVERIFIED` and prevents the requested full-team `GO`.

## 16. Rollout And Rollback

Rollout is one bounded Settings/theme change on `main`, without deploy in the implementation step.

Rollback requirements:

- retain a parser for the old persisted customization payload;
- keep migration pure and deterministic;
- keep the old source version in Git history rather than shipping two Settings UIs;
- revert the Settings/theme commit as one unit if migration, accessibility, or platform verification fails;
- do not delete user backups, reports, account data, or granular legacy sound values during rollback.

## 17. Acceptance Criteria

The redesign passes only when all of these are true:

- no visible Preview or Apply control exists for safe local preferences;
- each safe Appearance choice applies and persists in one interaction;
- failure restores the previous state and shows an honest error;
- Appearance has no Comfort, Intensity, Reduce glow, dead warmth/depth UI, marketing palette names, or Settings sparkle icons;
- accent changes alter only accent-owned semantic roles;
- every remaining mode/accent/contrast combination passes the required matrix;
- Sound has no profiles, texture filters, or duplicate preview;
- Web has no disabled native-only reminder switch;
- account reminders appear in Reminders, not Privacy;
- About/legal/version are quiet secondary rows;
- overview/detail, disclosure, and menu have both enter and exit behavior;
- reduced motion removes non-essential motion without breaking focus or state;
- all eight locales pass parity and layout checks, including RTL;
- destructive, import, account, and permission safeguards remain green;
- all ten roles complete the requested approval gate.

## 18. Kill Criteria

Stop or roll back if:

- migration changes a user's light/dark mode unexpectedly;
- a preference reports saved but does not survive reload;
- immediate apply introduces visible flicker, stale cross-tab state, or a race with account sync;
- any retained color combination cannot meet contrast and state-identification requirements;
- motion creates focus loss, duplicate Back handling, or delayed interaction under Reduce Motion;
- simplification removes access to a distinct required user capability rather than moving it contextually;
- Settings reintroduces magic/AI visual shorthand or generic card repetition;
- a security, privacy, production-data, or role-10 closure check returns `STOP`.

## 19. Non-Goals

- No redesign of the whole ZenFlow application.
- No replacement of `ValenceOrb` or `MiniValenceOrb` visuals.
- No free-form color picker, user CSS, theme marketplace, or cloud-theme sharing.
- No account-level appearance synchronization.
- No removal of destructive confirmations.
- No modification of real user data, Supabase state, store listings, deployment, or branch protection.
- No claim that every user will prefer the redesign without human usability evidence.

## 20. Current Unverified Ledger

- Blind-Spot Pass A: two isolated agent attempts ended at the external Codex usage limit and are not counted as approval.
- Human preference testing beyond the reporting user.
- Native-speaker review for all eight locales.
- VoiceOver, TalkBack, physical Android/iOS, and packaged Tauri behavior.
- Public GitHub Pages deployment and cache state.
- Final ten-role approval.
