# ZenFlow Experience Quality Audit — 2026-07-28

## Executive verdict

`GO_FOR_PROVEN_SCOPE` for the bounded shared-runtime remediations listed below.
`STOP` for release-readiness or whole-product conformance claims.

The audit found and fixed reachable defects in V2 progression overlays,
challenge deep-link truthfulness, mood-only saving, observational insight
language, Settings containment/focus/compact row anatomy, compact language
selection, Android first-launch push cleanup, iOS scene lifecycle and Google
auth routing, update-dialog icon semantics, and telemetry content-field
containment. Production dependency advisories were removed from the lockfile
without adding a dependency. The current checkout is not a
release-attributable candidate: it started on `main` at
`00fdb2ea0e5205f4bee76bbec3109bf98865627f`, was 18 commits behind
`origin/main`, and contained extensive pre-existing tracked and untracked work.
No pull, rebase, reset, merge, push, deployment, production write, live account
deletion, or live sync mutation was performed.

`HUMAN_ACCEPTANCE: UNVERIFIED`

## Evidence boundary

| Item | Recorded value |
|---|---|
| Local repository | `/Users/yehor/Documents/Codex/2026-06-10/new-chat/people-first-app` |
| User-declared canonical Windows path | `C:\project\people-first-app` |
| Remote identity | `https://github.com/Yehor212/people-first-app.git` |
| Branch / starting HEAD | `main` / `00fdb2ea0e5205f4bee76bbec3109bf98865627f` |
| Working-copy condition | Dirty before this audit; unrelated work preserved |
| Audit date / timezone | 2026-07-28 / America/Winnipeg |
| Public target inspected | `https://yehor212.github.io/people-first-app/` |
| Production-equivalent local target | Fresh local Vite production build |
| Screenshot comparison source | User-supplied ZenFlow and Finch screenshots; Finch used only as a grouped-list principle signal |
| Test data | Repository-owned isolated fixtures only; no fabricated production records |

Evidence labels in this document are `DIRECT_LOCAL`, `DIRECT_RUNTIME`,
`AUTHORITATIVE_EXTERNAL`, `HUMAN_RESEARCH`, `INFERENCE`, and `UNKNOWN`.
A screenshot proves only the captured state and viewport. Automated checks prove
only their assertions. Build success is not treated as visual, native, public,
or human-acceptance proof.

## Scope actually inspected

### Surface inventory

The source inventory follows the current production tree (`App` → `Index` →
`AuthGate` / V2 shell), `useNavigationV2`, Settings navigation, modal/overlay
state, and native handoffs. `PASS` is deliberately bounded; `UNVERIFIED` means
the surface was located but the required state or platform was not exercised.

| Surface / entry | User job and primary action | Prerequisites and important states | Owning source / proof | Status |
|---|---|---|---|---|
| Startup / splash | Reach a stable first screen | cold/warm start, update, offline | `src/App.tsx`, `src/components/AuthGate.tsx`; local browser, Android emulator, and iOS simulator cold start | PASS for local browser, Android debug, and the recorded iOS simulator state; PWA update and packaged Desktop UNVERIFIED |
| Language selection | Choose one of 8 locales | loading, save error, text expansion, RTL | `LanguageSelector`, `LanguageContext`; component tests and Android screenshot | PASS for component contract and Android compact English state; native locale switching UNVERIFIED |
| Theme selection at entry | Choose Light, Dark, or System | system theme, contrast, persistence | `LanguageSelector`, `useThemeStore`; Android first screen | PASS for visible Android debug state; persistence across process death UNVERIFIED |
| Onboarding | Understand and configure entry flow | complete, skip, resume | `OnboardingFlow`, `AuthGate` | SOURCE_DEFINED; runtime states UNVERIFIED |
| Native notification permission | Make an informed permission choice | granted, denied, later, system settings | `NotificationPermission`, `AuthGate` | SOURCE_DEFINED; Android/iOS permission dialogs UNVERIFIED |
| Authentication / session | Sign in, recover, sign out | anonymous, provider, error, owner boundary | `AuthGate`, Settings Account handlers | PASS for source/tests proving Android-native Google versus iOS owner-bound OAuth routing; live provider and session recovery UNVERIFIED |
| Orb `/orb` | Record current mood | empty, selection, mood-only save, optional diary continuation | `OrbPage`, `OrbPageSteps`, `useOrbMoodFlow` | PASS for split-action source/tests and local browser route; native interaction UNVERIFIED |
| Habits `/habits` | Review and act on habits | empty, populated, insight, streak, unlock | `HabitsPage`, `HeroInsightStrip`, `insightsEngine` | PASS for observational-copy tests; data-rich runtime and human comprehension UNVERIFIED |
| Diary `/diary` | Write and review journal entries | empty, loading, edit, import/export, offline, conflict | `JournalModule` and feature modules | Route readiness PASS locally; sensitive data flows and recovery matrix UNVERIFIED |
| Planning `/planning` | Plan and review scheduled work | empty, populated, resize | `PlanningPage` | Route readiness PASS locally; task-state matrix UNVERIFIED |
| Settings `/settings` overview | Find a preference area | grouped list, keyboard, selected row, compact/wide | `SettingsPage`, `SettingsModuleList`, `SettingsModuleCard` | PASS for local browser mobile/desktop and focused tests |
| Settings Account | Understand identity, providers, sign out, delete | anonymous, signed in, checking, unavailable, error, destructive confirm | `V2SettingsAccountPanel`, `V2SettingsAccountDeletion` | PASS for source/component tests and signed-out browser; live deletion intentionally UNVERIFIED |
| Settings Appearance | Change theme/accent/language | Paper, Ink, OLED, System, high contrast | Appearance and Language panels | PASS for local browser Paper/Ink/OLED and ar RTL bounded states |
| Settings Sound | Configure supported sound preferences | unsupported/native failure, reduced motion | `V2SettingsSoundPanel` | SOURCE_DEFINED; audio/haptic devices UNVERIFIED |
| Settings Notifications | Configure reminders and handoffs | permission denied, scheduling failure, retry | `V2SettingsNotificationsPanel`, reminder lifecycle | Source/tests inspected; native scheduling matrix UNVERIFIED |
| Settings Privacy/Data | Understand privacy, import/export | auth boundary, offline, partial failure, recovery | Privacy/Data panels and owner-boundary helpers | Source/tests inspected; live backend and filesystem recovery UNVERIFIED |
| Settings About / legal | Read version, help, policy, licenses | external link, offline | `V2SettingsAboutPanel`, public legal files | SOURCE_DEFINED; every external destination UNVERIFIED |
| Progression unlock overlay | Understand newly available feature | locked/unlocked, close, keyboard/back | `V2ProgressionModalLayer` | PASS for mount/state/component tests; native Back runtime UNVERIFIED |
| Challenge invite modal | Inspect a valid encoded invite | valid, malformed, close | `V2ProgressionModalLayer`, `useDeepLinkHandler` | PASS for visible renderer and canonical encoded-payload contract; real OS handoff UNVERIFIED |
| Not Found / invalid route | Recover from unknown path | browser history, bad deep link | `useNavigationV2`, V2 shell | SOURCE_DEFINED; runtime matrix UNVERIFIED |
| Command palette / drawer / sidebar | Navigate with keyboard, mouse, touch | narrow/wide, open/close, focus restoration | V2 navigation components | Local route traversal exercised; full assistive-tech matrix UNVERIFIED |
| Error/offline/update banners | Understand state and recover | offline, stale, update, retry | shell banners and service worker | Latest repeated public smoke reached all tested routes with no console/request failures; the earlier one-time script 503 root cause and PWA recovery remain UNVERIFIED |
| Android native shell | Start, render WebView, background/resume | first install, app Back, permissions | Capacitor Android debug artifact | Debug build and clean emulator launch exercised; signed device/store artifact UNVERIFIED |
| iOS native shell | Start WKWebView and preserve safe areas | build, simulator, permissions, lifecycle | Capacitor iOS project, `SceneDelegate`, simulator receipt | PASS for current-source simulator build/install/cold launch and bounded background privacy-shield/resume evidence; permissions, VoiceOver, physical device, signed archive/store artifact UNVERIFIED |
| Desktop / Tauri | Render and resize desktop shell | narrow/standard/wide, keyboard, package | `src-tauri` | Build status recorded in verification matrix; packaged GUI runtime remains bounded by recorded evidence |
| Ads, consent, monetization | Give granular consent and avoid accidental action | consent, no-consent, unavailable, rewarded path | `AdContext` and Settings privacy surfaces | Source-level boundary inspected; live SDK, store declaration, paywall/reward runtime UNVERIFIED |
| Community/social/world | Use exposed social surfaces | availability, auth, empty/error | no dedicated current V2 route found in the five-page navigation | N/A for a dedicated current route; indirect or future reachability UNKNOWN |

### Platform, theme, locale, and state matrix

| Dimension | Evidence-backed result |
|---|---|
| Web/Vite | PASS for fresh build, five V2 route readiness, Settings grouped-list runtime, bounded keyboard focus, and selected local states |
| Installed PWA | UNVERIFIED for install/update/offline lifecycle; service-worker-disabled performance smoke does not prove PWA |
| Android/Capacitor | Debug build and clean emulator first-screen runtime checked; permissions, OS deep links, TalkBack, process death, haptics, notifications, and signed release remain UNVERIFIED |
| iOS/WKWebView | PASS for current-source build/install/cold launch on an isolated iPhone 17e iOS 26.5 simulator, UIScene startup without lifecycle warnings, and bounded app-switcher privacy shield/resume; JS deep-link destination, VoiceOver, permissions, physical device, release signing, and store artifact remain UNVERIFIED |
| Desktop/Tauri | See current-state build receipt below; packaged keyboard/window/runtime evidence remains bounded by the recorded commands |
| Paper / Ink / OLED | PASS for bounded local Settings screenshots |
| System theme | Source/component coverage; full native chrome synchronization UNVERIFIED |
| High contrast / forced colors | PASS for bounded browser Settings state; Windows/macOS native high-contrast runtime UNVERIFIED |
| Reduced motion | PASS for bounded browser Settings state with animated backgrounds disabled; every animated asset and native transition UNVERIFIED |
| `en`, `uk`, `es`, `de`, `fr`, `ja`, `ar`, `he` | Static key parity/quality checks PASS; `ar` and `he` directionality covered by tests; bounded `ar` browser runtime PASS; native-speaker cultural acceptance UNVERIFIED |
| Compact mobile / desktop standard / wide | Settings browser states PASS; all other surfaces retain individual statuses above |
| Loading / empty / error / offline / stale / conflict / retry / destructive recovery | Located in source selectively; no whole-product runtime claim. Public script-load failure is FAIL; unexercised cells are UNVERIFIED |
| Keyboard / mouse / touch | Keyboard focus checked on bounded Settings state; browser pointer traversal and Android touch launch checked; full manual matrix UNVERIFIED |
| Screen reader | Automated semantics and source contracts only; VoiceOver/TalkBack/NVDA manual proof UNVERIFIED |

## Current system diagnosis

The strongest common cause was presentation and state ownership drifting apart:
state producers existed without a V2 renderer; one action mixed mood persistence
with navigation; a source-level parser advertised a challenge format with no
valid destination; and Settings used repeated containment at page, group, row,
and account-block levels. A second cause was evidence language exceeding the
underlying data: uncontrolled historical averages were presented with causal
verbs and an uncalibrated “confidence” treatment. A third cause was platform
specialization that used a generic `isNative` branch where only Android had the
native Google picker, and retained application-delegate lifecycle behavior
without the required scene registration. A fourth cause was first-run state
being treated as an explicit opt-out in the native push cleanup effect.

The existing architecture worth preserving was retained: IndexedDB remains
local truth, Zustand ownership and hydration boundaries remain intact, Style
Dictionary remains the token pipeline, existing auth/sync/deletion handlers
remain the owners of their side effects, Lucide remains the Settings utility
icon family, and the canonical leaf/orb assets were not replaced.

## Design-system and token conformance inventory

| Layer | Current source and runtime | Result / disposition |
|---|---|---|
| Token source | `src/design-tokens/tokens.json` | KEEP as canonical Style Dictionary input |
| Generated CSS | `src/generated/tokens.css`, imported by `src/index.css` | PASS for generated-runtime reachability |
| Generated TypeScript | `src/generated/tokens.ts` | KEEP; generated, not hand-edited |
| Theme runtime | theme store plus `src/styles/themes.css` and Settings theme customization | KEEP; semantic Settings variables exist outside the generated token source, so consolidation is a P2 migration rather than a safe audit-wide rewrite |
| Spacing and target contract | shared Settings page/group/row primitives | PASS for bounded grouped-list migration; row target remains at least project baseline |
| Container contract | one page/detail surface, one group surface, borderless rows with logical dividers | PASS in remediated Settings scope |
| Focus contract | detail heading owns programmatic focus; structural region is not a second tab stop; inset focus ring remains visible | PASS in bounded browser/component proof |
| Selected-choice contract | `aria-pressed` plus a visible non-color Lucide check; stacked placement uses logical `end` | PASS in bounded Paper LTR and OLED RTL runtime |
| Motion contract | shared Settings motion surface and reduced-motion path | PASS for bounded Settings state; whole-product motion audit UNVERIFIED |
| Utility icons | Settings uses Lucide with decorative icons hidden where text carries the name | KEEP / NORMALIZE as surfaces migrate |
| Other icon library | Phosphor remains elsewhere in the existing product | ACCEPTED_TRANSITION; audit did not justify a risky whole-product replacement |
| Expressive assets | canonical leaf/orb and existing ZenFlow assets | KEEP; no Finch or competitor asset copied |

### Canonical grouped Settings contract

1. A section label sits outside one group surface.
2. `SettingsModuleList` owns the group material, radius, and clipping.
3. `SettingsModuleCard` owns row semantics, logical inset divider, selected
   state, and full-row hit target; it does not add another card border or radius.
4. An icon is optional and decorative when the text already names the action.
5. A chevron means navigation/disclosure only.
6. Account identity and provider facts use flat rows; checking, error,
   recovery, and destructive entities may remain contained.
7. The detail region is structural and visually transparent. Its `h2` receives
   focus on destination change.
8. Auth, sync, storage, consent, deletion, import/export, and remote-commit
   semantics stay in their existing handlers.

The canonical contract is recorded in
`docs/superpowers/specs/2026-07-12-settings-simplification-live-apply-design.md`;
this audit does not create a competing design-system hierarchy.

## Component and pattern matrix

| Canonical component/pattern | Anatomy / allowed states | Forbidden combination | Evidence |
|---|---|---|---|
| Settings group | external label + one group surface + rows | card-in-card for ordinary navigation rows | component tests + browser screenshots |
| Settings row | optional icon, label/supporting text, trailing affordance | row border + radius + parent border for ordinary rows | component tests + browser screenshots |
| Settings binary row | utility icon, label/description, switch, one aligned divider | nested bordered/shadowed toggle card inside a panel | component tests + computed browser styles |
| Settings choice | optional utility icon/preview, label, visible check when selected, `aria-pressed` | selection communicated only by border/background/accent color | red/green test + LTR/RTL screenshots |
| Settings detail region | transparent region + focused heading + content | focusable region followed by separately focused heading | component and E2E tests |
| Account fact row | label/value/status inside flat group | nested bordered block for ordinary identity/provider facts | component tests |
| Recovery/destructive block | consequence, recovery/confirmation, explicit action | destructive action visually mixed with ordinary preferences | source/component tests |
| Mood confirmation | “Save mood” followed by optional “Continue to diary” | diary navigation as a side effect of the only save action | hook/component tests |
| Observational insight | compared averages, sample counts, association wording | causal verbs or model-like confidence probability | engine/component/i18n tests |
| Progression modal | visible modal/overlay, state-derived content, close path | reachable producer with no renderer | orchestrator/component tests |
| Language grid | auto-fit columns with a readable minimum, wrapping, RTL per item | three compressed columns that split short language names letter-by-letter | component test + Android screenshot |
| Native push consent effect | initialize after explicit enable; revoke after observed true→false/known consent | first-run false default treated as an opt-out requiring remote cleanup | hook test + Android clean-install screenshot |

## Icon and asset provenance ledger

This is the bounded ledger for assets encountered in the remediated surfaces,
not a claim that every repository asset has been manually licensed again.

| Asset ID | Source/path | Provenance / license evidence | Purpose and treatment | RTL/theme | Disposition |
|---|---|---|---|---|---|
| `utility/settings/*` | `lucide-react` imports in Settings | dependency manifest / upstream package license | 24px-class utility icons; `aria-hidden` when adjacent text names the row | directional arrows mirror where semantics require | KEEP |
| `utility/language/check` | Lucide `Check` | same dependency evidence | selected language status with radio semantics | no mirroring | KEEP |
| `utility/settings-choice/check` | Lucide `Check` in `SettingsChoiceButton` | same dependency evidence | persistent non-color selected marker; decorative because `aria-pressed` carries semantics | logical-end placement; no mirroring | KEEP |
| `utility/update-dialog/*` | Lucide icons in `UpdateRequiredDialog` | dependency manifest / upstream package license | decorative beside visible text and hidden from the accessibility tree | no directional mirroring required | NORMALIZED |
| `utility/language/retry` | Lucide `RefreshCw` | same dependency evidence | retry action paired with text | no mirroring | KEEP |
| `brand/leaf` | existing ZenFlow generator-owned logo assets | repository logo protocol and generator sources | brand identity, not a utility affordance | theme variants owned by existing pipeline | KEEP |
| `orb/valence` | canonical `ValenceOrb` / `MiniValenceOrb` sources | repository canonical-orb contract | mood/state-of-mind identity | reduced-motion fallback owned by existing contract | KEEP |
| `reference/finch` | user-supplied screenshot only | third-party comparative reference; no repository use | hierarchy signal only | N/A | REMOVE_FROM_IMPLEMENTATION / NOT_COPIED |

## Migration and deprecation map

| Before | After | Data/auth/sync effect | Rollback |
|---|---|---|---|
| V2 progression state with no mounted renderer | scoped `V2ProgressionModalLayer` in V2 orchestrator | none | remove mount and component if producers are intentionally retired |
| parser accepted short challenge IDs that had no valid V2 destination | only canonical encoded invite payload remains supported | none | restore only with a tested compatibility adapter and destination |
| one mood action persisted and navigated to Diary | mood-only save plus separate optional Diary action | same mood persistence; navigation becomes explicit | restore combined action only if product and agency evidence justify it |
| causal “improves/boosts” language and confidence badge | observational comparison wording with sample disclosure | no history or aggregation schema change | restore only with a valid causal design and calibrated measure |
| Settings row-as-card and account block nesting | one grouped surface with rows and limited recovery containment | no handler migration | revert primitive presentation and its characterization tests |
| focusable Settings detail region plus heading focus | transparent structural region and heading focus owner | none | restore only with a single documented focus owner |
| first-run default false triggered remote push cleanup | default false before consent is inert; known enable/disable still revokes | narrows side effect to explicit consent history | revert guard only if a durable “previously registered” signal replaces it |
| 7rem auto-fit language minimum allowed compressed columns | 9rem minimum chooses fewer readable columns | none | adjust token/minimum only with compact runtime proof |
| compact Settings module changed to icon/chevron row then text rows | stable icon → text → chevron three-column anatomy at every compact width | none | reopen only if 320px/max-text evidence shows clipping or unreachable actions |
| nested bordered `ToggleRow` cards | flat grouped rows with one logical divider and preserved 48px-class switch target | preference behavior unchanged | restore the smallest state surface only if row/focus separation becomes insufficient |
| selected choices depended mainly on color | `aria-pressed` plus a visible Lucide check | preference behavior unchanged | remove only if another non-color marker is proven clearer and equally accessible |
| collapsed inline accent previews | caller-owned flex row preserving 20×20 circular swatches | no token or preference change | revert wrapper only if all four previews remain measurable and distinct |
| application-delegate-only iOS lifecycle | registered `SceneDelegate` owns scene lifecycle, privacy shield, and Capacitor URL/user-activity forwarding | no user-data migration | revert only with an Apple-supported lifecycle implementation and cold/warm link tests |
| every native Google sign-in used the Android picker | Android keeps native picker; iOS uses existing attempt/owner-bound OAuth callback | auth-provider routing only; no token/schema migration | revert only if a supported iOS native picker and migration/test contract are introduced |
| content-shaped telemetry fields could pass the sink | structured private-writing/wellbeing field names are redacted while operational metadata remains | telemetry payload containment only | narrow rules only with negative controls proving no private canary can pass |

## Changes implemented

| Files / symbols | Before → after behavior | Migration or data effect |
|---|---|---|
| `V2ProgressionModalLayer.tsx`, `NavV2Orchestrator.tsx` | reachable unlock/challenge state had no V2 renderer → scoped lazy modal/overlay renderer with close paths | no storage, auth, sync, or route migration |
| `deepLinks.ts` and tests | short challenge IDs were accepted despite no valid destination → unsupported parser branch removed; canonical encoded invite path retained | old unsupported links now recover as unknown instead of false success |
| `useOrbMoodFlow.ts`, `OrbPage.tsx`, `OrbPageSteps.tsx` | the only save action also opened Diary → mood saves independently and Diary continuation is a separate action | mood persistence contract retained; navigation side effect narrowed |
| `insightsEngine.ts`, `reflectionIntelligence.ts`, `InsightCard.tsx`, `InsightsPanel.tsx`, `HeroInsightStrip.tsx`, all locale dictionaries | causal verbs and confidence styling → observational wording, compared averages, sample counts, no pseudo-probability presentation | no user history, metric schema, or backend change |
| Settings page/primitives/panels and characterization tests | nested row cards/account facts/detail container → one grouped surface, flat ordinary rows, transparent structural detail region, heading focus | presentation only; handler ownership retained |
| `V2SettingsAppearancePanel.tsx` | a contained customization inset nested inside the containing Appearance surface → structural wrapper with internal headings/dividers | presentation only |
| Settings motion specification | draft required 8px panel translation while implementation and tests were opacity-only → canonical contract now records the safer opacity-only large-surface transition and rejection criteria | documentation/contract alignment; runtime unchanged |
| `useNotificationSetup.ts` and test | clean first launch could treat default false as explicit push opt-out and attempt cleanup → no cleanup before consent is known; true→false revocation remains | prevents an unauthorized/unnecessary remote cleanup attempt; no token or data fabrication |
| `LanguageSelector.tsx` and test | compact auto-fit could form three unreadably narrow columns → 9rem readable minimum chooses fewer columns and keeps wrapping/RTL | layout only |
| `themes.css` / Settings detail contract | detail region rendered another material card and owned a second focus target → visually transparent structure; destination heading owns focus | presentation/focus only |
| `SettingsModuleCard.tsx`, `V2SettingsControlPrimitives.tsx` | compact module anatomy could stack and ordinary toggles were nested cards → stable three-column modules and flat divided toggle rows | presentation only |
| `SettingsChoiceButton`, `V2SettingsAppearanceAccent.tsx` | selected choices depended mainly on color and accent swatches collapsed as inline spans → visible check plus caller-specific flex swatch row | presentation/semantics only |
| `UpdateRequiredDialog.tsx` | decorative adjacent icons were exposed without an independent name → icons are hidden where visible text owns the name | accessibility-tree normalization only |
| `AppDelegate.swift`, new `SceneDelegate.swift`, `Info.plist`, Xcode project, native tests | deprecated application-only lifecycle → registered scene lifecycle with privacy shield and Capacitor cold/warm URL/user-activity forwarding | native lifecycle only; no storage/auth/sync migration |
| auth-screen and Settings account Google handlers/tests | iOS entered Android-only native picker path → Android retains native picker; iOS uses the existing attempt-bound OAuth callback | provider routing only; live sign-in not exercised |
| `sentry.ts`, `sentryPrivacy.test.ts` | generic structured content fields could carry private writing → journal/diary/mood/reflection/gratitude/coach/audio content keys are redacted, operational fields retained | telemetry containment; no business/user data changed |
| `package-lock.json` | production audit reported vulnerable `brace-expansion`, `postcss`, and nested `nanoid` versions → lock resolves `5.0.8`, `8.5.24`, and `3.3.16` | dependency resolution only; no new production dependency |
| Settings design spec and this audit | partial runtime state and unsupported completion wording → explicit bounded contract, finding, command, screenshot, platform, and residual-risk ledgers | documentation only |

No competitor composition, icon, copy, color, monetization banner, or expressive
asset was copied. No production mock/demo/sample record was added.

## Decision register

| Decision | Evidence / alternatives | Rejection or rollback criterion |
|---|---|---|
| Mount a scoped V2 progression layer rather than legacy `ModalLayer`/`OverlayLayer` | legacy layer contains V1 navigation; scoped renderer closes the specific reachable V2 gap | reject if state cleanup, focus, visibility gating, or Android Back regresses |
| Retire unsupported short challenge IDs | parser advertised behavior with no destination; treating an ID as encoded payload would be unsafe guessing | reintroduce only through a compatibility adapter with cold/warm OS deep-link tests |
| Use observational insight language | current inputs are uncontrolled historical associations; alternative causal wording requires a valid causal design | reject if any locale reintroduces causal certainty or hides sample basis |
| Split mood save and Diary continuation | preserves agency and the same persistence function; alternative combined action adds an unrequested transition | reject if deterministic tests show duplicate/lost saves or Diary still opens from save-only |
| One group surface with flat rows | current Settings user job is scanning/navigating; ordinary facts are not separate entities | retain containment for recovery, warning, dependent, or destructive entities |
| Make Appearance inner wrapper structural | outer `PanelFrame` already provides the semantic/material container | roll back if headings/dividers, focus, or non-text contrast cease to separate controls |
| Retain opacity-only overview/detail motion | current source/tests already avoid transforming large blurred surfaces; safer for clipping/compositor/focus | reconsider with matched LTR/RTL normal-motion evidence; reject any spatial alternative under reduced motion or with focus/paint defects |
| Treat unseen first-run push false as neutral | default false is not evidence that a token was previously registered; alternatives require a durable registration-history signal | reject if an explicit previously-enabled transition no longer attempts revocation |
| Raise language grid minimum from 7rem to 9rem | Android compact screenshot demonstrated character-by-character splits; fewer columns is reversible | adjust only after compact 320–390 CSS px evidence across all 8 labels |
| Keep selected semantics and add a visible marker | `aria-pressed` is correct for assistive technology but the bounded runtime showed ambiguous visual redundancy | reject any marker that clips translated labels or creates a duplicate spoken announcement |
| Repair accent previews at the caller | generic choice content also supports stacked multi-line sound copy; changing its layout would widen blast radius | reject if a measured swatch is not 20×20 or if compact/RTL overflows |
| Adopt UIScene before the platform requirement becomes a launch failure | Apple primary guidance and a current-source simulator launch support migration; application-only callbacks are insufficient | reject if cold/warm URL forwarding, app-switcher shield, resume, or launch regresses |
| Keep Google native picker Android-specific | repository-native picker implementation is Android-owned; iOS already has an owner/attempt-bound OAuth callback | reject if live iOS callback ownership/session tests fail |
| Add sink-side telemetry containment without claiming full closure | private content canaries provide a bounded negative control; arbitrary future top-level strings still need producer constraints | reopen/expand only through a typed allowlist that preserves required operational diagnostics |
| Preserve Style Dictionary and current architecture | generated token outputs are imported and local truth/handler boundaries are established | redesign only with separate architectural authority and migration proof |

## External source registry

Checked on 2026-07-28. “Does not prove” is part of each source boundary.

| Source | Document/version date | Class | ZenFlow applicability | Does not prove | Platforms / recheck |
|---|---|---|---|---|---|
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | W3C Recommendation, 2023-10-05 | NORMATIVE | applicable Web/PWA success criteria and shared web-content semantics | full conformance from automation or a few screens | Web/PWA; recheck on normative revision, max 12 months |
| [ARIA APG](https://www.w3.org/WAI/ARIA/apg/) and [APG introduction](https://www.w3.org/WAI/ARIA/apg/about/introduction/) | living WAI guidance, checked 2026-07-28 | HEURISTIC | roles, states, focus, and keyboard patterns | a visual design system or automatic accessibility | shared web UI; recheck on component-pattern change, max 12 months |
| [WAI Selecting Evaluation Tools](https://www.w3.org/WAI/test-evaluate/tools/selecting/) | living WAI guidance | HEURISTIC | explains automation/manual-evaluation boundary | accessibility from an axe/Lighthouse result | all web-content surfaces; max 12 months |
| [Apple Settings HIG](https://developer.apple.com/design/human-interface-guidelines/settings) | page change noted 2024-06-10 | PLATFORM | iOS Settings expectations and native handoff decisions | WKWebView/native runtime parity | iOS; recheck before iOS release or max 12 months |
| [Apple Accessibility HIG](https://developer.apple.com/design/human-interface-guidelines/accessibility) | living guidance | PLATFORM | VoiceOver, target, content, and motion considerations | WCAG conformance or device proof | iOS; before release/max 12 months |
| [Apple Right to Left](https://developer.apple.com/design/human-interface-guidelines/right-to-left) | living guidance | PLATFORM | semantic direction and mirroring | Arabic/Hebrew cultural acceptance | iOS/shared RTL; on RTL UI change/max 12 months |
| [Apple Motion](https://developer.apple.com/design/human-interface-guidelines/motion) | living guidance | PLATFORM | purposeful motion and Reduce Motion | ZenFlow motion acceptance | iOS/shared motion; on motion change/max 12 months |
| [Apple TN3187: Migrating to the UIKit scene-based life cycle](https://developer.apple.com/documentation/Technotes/tn3187-Migrating-to-the-UIKit-scene-based-life-cycle) and [Transitioning to the UIKit scene-based life cycle](https://developer.apple.com/documentation/uikit/transitioning-to-the-uikit-scene-based-life-cycle) | current Apple guidance checked 2026-07-28 | PLATFORM | required iOS scene registration, launch/lifecycle callbacks, and migration boundary | signed archive, device lifecycle, or JavaScript deep-link destination | iOS; before SDK/platform release change/max 6 months |
| [Android Settings pattern](https://developer.android.com/design/ui/mobile/guides/patterns/settings) | updated 2025-12-10 | PLATFORM | group containment, hierarchy, and predictable rows | ZenFlow visual identity or device behavior | Android/shared Settings; before release/max 12 months |
| [Android Core app quality](https://developer.android.com/docs/quality-guidelines/core-app-quality) | current archive checked 2026-07-28 | PLATFORM | lifecycle, navigation, performance, privacy, and quality checklist | signed artifact/store compliance from source | Android; before each release/max 6 months |
| [Android accessibility](https://developer.android.com/guide/topics/ui/accessibility/index.html) and [Views guidance](https://developer.android.com/guide/topics/ui/accessibility/views/apps-views) | updated 2026-04-22 | PLATFORM | TalkBack/semantics and 48dp target guidance | real-device assistive-tech behavior | Android; on interaction change/max 12 months |
| [Material 3 states](https://m3.material.io/foundations/interaction/states/overview), [lists](https://m3.material.io/components/lists/overview), and [canonical layouts](https://m3.material.io/foundations/layout/canonical-examples/overview) | living guidance | PLATFORM | shared-state, list, and adaptive-layout vocabulary | a mandate to turn ZenFlow into Material | Android/shared UI; on pattern change/max 12 months |
| [Microsoft app settings guidance](https://learn.microsoft.com/en-us/windows/apps/design/app-settings/guidelines-for-app-settings) | updated 2026-04-15 | PLATFORM | constrained desktop Settings layout and scanability | a WinUI mandate for cross-platform Tauri | Desktop; before packaged release/max 12 months |
| [Nielsen Norman usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) | published 1994; reviewed 2024-01-30 | HEURISTIC | consistency, status, error recovery, and control review | target-user research or product-market value | all surfaces; max 24 months |
| [ISO/IEC 25010:2023 abstract](https://www.iso.org/standard/78176.html) | edition 2, 2023-11 | HEURISTIC | top-level product-quality categories | the content of the paid full standard | all platforms; max 24 months |
| [Core Web Vitals](https://web.dev/articles/vitals) | updated 2024-10-31 | PERFORMANCE | LCP, INP, and CLS field-signal framing | field health from a local lab run | Web/PWA; on metric revision/max 12 months |
| [OWASP MASVS](https://mas.owasp.org/MASVS/) and [MASTG](https://mas.owasp.org/MASTG/) | MASTG 2.0 release 2026-07-04 | SECURITY | mobile/hybrid threat and verification baseline | a clean mobile security verdict without scoped testing | Android/iOS; before security release review/max 6 months |
| [DTCG Format 2025.10](https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/) | Final Community Group Report, 2025-10-28 | COMMUNITY | vendor-neutral token interchange reference | a W3C Recommendation or reason to replace Style Dictionary | design tooling; on token-pipeline change/max 12 months |

Conflict resolution used the requested order: mandatory security/accessibility and
store requirements, current local product contract, platform-native
expectations, supported user job, measured runtime, then a reversible product
decision with rejection criteria.

## Findings register

### ZF-EQ-001 — V2 progression state had no renderer

```yaml
ID: ZF-EQ-001
TITLE: Reachable V2 progression state had no mounted destination
SEVERITY: P1
CONFIDENCE: HIGH
SURFACE: V2 shell progression overlays
ROUTE_OR_ENTRY: Any V2 page after a feature unlock or valid encoded challenge invite
FILES_AND_SYMBOLS: V2ProgressionModalLayer; NavV2Orchestrator; challenge/unlock handlers
PLATFORMS: Web, PWA, Android, iOS, Desktop
THEMES: All
LOCALES: All 8
STATES: unlocked feature; valid challenge invite; close
OBSERVATION: Producers wrote visible-state intent but the V2 production tree rendered neither destination.
EXPECTED_CONTRACT: Every reachable modal state has a visible, semantic, closeable renderer.
ROOT_CAUSE: Legacy layers were not mounted in V2 and could not be mounted wholesale because they contain V1 navigation.
USER_JOB_IMPACT: A valid action appeared to do nothing.
ACCESSIBILITY_IMPACT: No dialog semantics or close/focus path existed.
PRIVACY_SECURITY_IMPACT: None confirmed.
PERFORMANCE_RELIABILITY_IMPACT: Invisible state persisted without a usable destination.
EVIDENCE:
  DIRECT_LOCAL: Production-tree search, state-producer inspection, red/green orchestrator tests.
  DIRECT_RUNTIME: Local route readiness; modal native runtime remains UNVERIFIED.
  AUTHORITATIVE_EXTERNAL: ARIA APG dialog principles, applied as guidance.
  HUMAN_RESEARCH: UNKNOWN
INFERENCE_AND_ALTERNATIVES: Mounting legacy layers would restore UI but reintroduce V1 route behavior; a scoped V2 renderer has the smaller blast radius.
RECOMMENDATION: Keep the scoped V2 layer and its close-state tests.
REJECTION_CRITERION: Focus, visibility gating, state cleanup, or Android Back fails.
WRITE_SET: V2ProgressionModalLayer.tsx; NavV2Orchestrator.tsx; focused tests.
MIGRATION_OR_DATA_EFFECT: None.
TEST_FIRST_PROOF: A focused test failed before the renderer was mounted and passed after implementation.
ACCEPTANCE_CRITERIA: Both supported states render and close without mounting legacy V1 navigation.
ROLLBACK: Remove the scoped layer only if the producers are intentionally retired with tests.
VERIFICATION: Targeted component/orchestrator suite passed.
STATUS: FIXED
```

### ZF-EQ-015 — Update-dialog decorative icon semantics

```yaml
ID: ZF-EQ-015
TITLE: Update dialog exposed decorative adjacent icons to assistive technology
SEVERITY: P2
CONFIDENCE: HIGH
SURFACE: Required update dialog
ROUTE_OR_ENTRY: UpdateRequiredDialog
FILES_AND_SYMBOLS: UpdateRequiredDialog.tsx and component test
PLATFORMS: Web, PWA, Android, iOS, Desktop
THEMES: All
LOCALES: All
STATES: required update; action/error
OBSERVATION: Adjacent visible text already named the actions/status while Lucide icons were not consistently hidden.
EXPECTED_CONTRACT: Decorative icons do not add redundant or unnamed accessibility-tree content.
ROOT_CAUSE: Icon semantics were left implicit.
USER_JOB_IMPACT: Screen-reader output could become noisy or ambiguous.
ACCESSIBILITY_IMPACT: Redundant decorative content.
PRIVACY_SECURITY_IMPACT: None.
PERFORMANCE_RELIABILITY_IMPACT: None.
EVIDENCE:
  DIRECT_LOCAL: Source diff and focused component test.
  DIRECT_RUNTIME: Screen-reader runtime UNVERIFIED.
  AUTHORITATIVE_EXTERNAL: WCAG/ARIA name-role-value boundary.
  HUMAN_RESEARCH: N/A
INFERENCE_AND_ALTERNATIVES: Icons carrying an independent status would require an explicit name; these do not.
RECOMMENDATION: Keep adjacent text as the accessible name and icons aria-hidden.
REJECTION_CRITERION: A future icon becomes the only status/action label.
WRITE_SET: UpdateRequiredDialog.tsx; test.
MIGRATION_OR_DATA_EFFECT: None.
TEST_FIRST_PROOF: Focused semantics assertion.
ACCEPTANCE_CRITERIA: Visible text remains; decorative icons are absent from the accessibility tree.
ROLLBACK: Restore only with an explicit independent accessible label.
VERIFICATION: Focused and integrated test suites PASS.
STATUS: FIXED
```

### ZF-EQ-016 — Production dependency advisory resolution

```yaml
ID: ZF-EQ-016
TITLE: Production lock resolved advisory-affected transitive versions
SEVERITY: P1
CONFIDENCE: HIGH
SURFACE: Production dependency graph
ROUTE_OR_ENTRY: npm audit --omit=dev
FILES_AND_SYMBOLS: package-lock.json
PLATFORMS: Build/runtime dependency graph
THEMES: N/A
LOCALES: N/A
STATES: install/build
OBSERVATION: Production audit identified advisory-affected brace-expansion, postcss, and nested nanoid resolutions.
EXPECTED_CONTRACT: The lockfile resolves production dependencies to non-vulnerable compatible releases without a forced breaking upgrade.
ROOT_CAUSE: Stale compatible transitive lock resolutions.
USER_JOB_IMPACT: No exploit was demonstrated; vulnerable build/runtime dependency versions increased attack surface.
ACCESSIBILITY_IMPACT: None.
PRIVACY_SECURITY_IMPACT: Dependency attack-surface reduction.
PERFORMANCE_RELIABILITY_IMPACT: Compatible patch-level resolution.
EVIDENCE:
  DIRECT_LOCAL: Lock resolves brace-expansion 5.0.8, postcss 8.5.24, and nanoid 3.3.16; npm audit --omit=dev exit 0 with zero findings; production build PASS.
  DIRECT_RUNTIME: Public deployment was not changed.
  AUTHORITATIVE_EXTERNAL: GitHub advisory GHSA-mh99-v99m-4gvg and npm release metadata.
  HUMAN_RESEARCH: N/A
INFERENCE_AND_ALTERNATIVES: Root node_modules remains older than the lock in this mixed checkout; a clean install is still required for release attribution.
RECOMMENDATION: Use the reviewed lockfile in a clean release lane and rerun install/build/audit.
REJECTION_CRITERION: Clean install resolves an advisory-affected version or changes the production graph unexpectedly.
WRITE_SET: package-lock.json.
MIGRATION_OR_DATA_EFFECT: None.
TEST_FIRST_PROOF: Baseline audit finding then clean production audit/build.
ACCEPTANCE_CRITERIA: Clean candidate audit has zero production findings.
ROLLBACK: Restore the prior lock only if an attributable compatibility failure is reproduced.
VERIFICATION: Production dependency graph PASS; clean-install attribution remains UNVERIFIED.
STATUS: FIXED
```

### ZF-EQ-017 — Development dependency and installed-tree evidence gap

```yaml
ID: ZF-EQ-017
TITLE: Development audit remains high and root installed tree is stale versus lock
SEVERITY: P2
CONFIDENCE: HIGH
SURFACE: Tooling/evidence integrity
ROUTE_OR_ENTRY: npm audit; native proof builds
FILES_AND_SYMBOLS: package-lock.json; node_modules; development toolchains
PLATFORMS: CI, Android/iOS/Desktop build evidence
THEMES: N/A
LOCALES: N/A
STATES: local install/build
OBSERVATION: Full audit reports 15 high development findings in old major chains; npm's proposed force fix is breaking. Root installed postcss/nanoid/brace-expansion versions are older than the repaired lock.
EXPECTED_CONTRACT: Release evidence is built from a clean install attributable to the reviewed lock.
ROOT_CAUSE: Long-lived dirty shared checkout and development dependency chains.
USER_JOB_IMPACT: Product runtime compromise was not shown; release evidence can be attributed to stale tooling.
ACCESSIBILITY_IMPACT: None direct.
PRIVACY_SECURITY_IMPACT: Development supply-chain exposure.
PERFORMANCE_RELIABILITY_IMPACT: Build reproducibility risk.
EVIDENCE:
  DIRECT_LOCAL: Full/production audit and installed-versus-lock inspection.
  DIRECT_RUNTIME: Native debug receipts were not rebuilt from a clean lock install.
  AUTHORITATIVE_EXTERNAL: npm advisory output.
  HUMAN_RESEARCH: N/A
INFERENCE_AND_ALTERNATIVES: Forcing major upgrades inside this audit would exceed the bounded change and may break toolchains.
RECOMMENDATION: Isolate a clean integration worktree, run npm ci, update development chains separately, and regenerate native/package proof.
REJECTION_CRITERION: Clean npm ci plus full audit/builds prove the finding absent without forced breaking changes.
WRITE_SET: None further in this mixed lane.
MIGRATION_OR_DATA_EFFECT: None.
TEST_FIRST_PROOF: N/A.
ACCEPTANCE_CRITERIA: Clean installed tree matches lock and accepted dev advisories have owner/expiry or are fixed.
ROLLBACK: Revert only attributable dependency updates.
VERIFICATION: OPEN/BLOCKED by clean integration lane.
STATUS: BLOCKED
```

### ZF-EQ-018 — Bundle and Android memory warning budget

```yaml
ID: ZF-EQ-018
TITLE: Main bundle and Android renderer warnings need bounded performance work
SEVERITY: P2
CONFIDENCE: MEDIUM
SURFACE: Startup and shared runtime
ROUTE_OR_ENTRY: production build; Android debug lifecycle
FILES_AND_SYMBOLS: generated production chunks; WebView runtime
PLATFORMS: Web/PWA and Android
THEMES: Tested first-screen states
LOCALES: Tested bounded states
STATES: cold start; background/resume
OBSERVATION: Main minified chunk is 826.64 kB and exceeds the configured warning threshold; Android old/current comparison emitted unchanged Chromium tile-memory warnings.
EXPECTED_CONTRACT: User-critical startup/interactions stay within measured route/device budgets.
ROOT_CAUSE: Broad shared initial graph; Android warning cause not isolated.
USER_JOB_IMPACT: Potential slower startup or memory pressure; no observed fatal/ANR.
ACCESSIBILITY_IMPACT: Latency can impair task completion.
PRIVACY_SECURITY_IMPACT: None identified.
PERFORMANCE_RELIABILITY_IMPACT: Startup/resource risk.
EVIDENCE:
  DIRECT_LOCAL: Production build warning and chunk inventory.
  DIRECT_RUNTIME: Public route smoke and Android emulator lifecycle; no fatal/ANR.
  AUTHORITATIVE_EXTERNAL: Core Web Vitals applies only to measured web signals.
  HUMAN_RESEARCH: N/A
INFERENCE_AND_ALTERNATIVES: A warning is not a user regression; route splitting needs trace-based ownership and must not degrade canonical visuals.
RECOMMENDATION: Profile exact route imports and low-end/native memory before splitting.
REJECTION_CRITERION: Repeated measurements meet current budgets without visual/function regression.
WRITE_SET: None in this audit.
MIGRATION_OR_DATA_EFFECT: None.
TEST_FIRST_PROOF: N/A.
ACCEPTANCE_CRITERIA: Attributable before/after performance proof on representative targets.
ROLLBACK: Revert any split that increases latency, request failure, or visual degradation.
VERIFICATION: OPEN; public smoke PASS for tested routes, field/native resource health UNVERIFIED.
STATUS: OPEN
```

### ZF-EQ-019 — iOS scene lifecycle

```yaml
ID: ZF-EQ-019
TITLE: iOS project lacked the scene lifecycle required by current Apple guidance
SEVERITY: P1
CONFIDENCE: HIGH
SURFACE: iOS application lifecycle
ROUTE_OR_ENTRY: cold launch; background/resume; URL/user activity
FILES_AND_SYMBOLS: AppDelegate.swift; SceneDelegate.swift; Info.plist; project.pbxproj; native tests
PLATFORMS: iOS
THEMES: System runtime
LOCALES: Startup state
STATES: cold launch; inactive/background; resume; warm/cold handoff
OBSERVATION: Privacy shield and Capacitor handoff lived only in application-delegate callbacks without a registered scene manifest/delegate.
EXPECTED_CONTRACT: A registered UIScene lifecycle owns scene callbacks and preserves Capacitor URL/user-activity forwarding.
ROOT_CAUSE: Legacy lifecycle template persisted.
USER_JOB_IMPACT: Future SDK/runtime launch failure and lost scene-specific lifecycle/handoff risk.
ACCESSIBILITY_IMPACT: Complete launch failure would block all tasks.
PRIVACY_SECURITY_IMPACT: App-switcher privacy shield must remain before inactive snapshots.
PERFORMANCE_RELIABILITY_IMPACT: Launch/lifecycle reliability.
EVIDENCE:
  DIRECT_LOCAL: Xcode/source registration and red/green lifecycle/privacy tests.
  DIRECT_RUNTIME: Current-source iPhone 17e iOS 26.5 simulator build/install/cold launch; zero UIScene warning/fault/fatal/assert; bounded privacy-shield/resume screenshots.
  AUTHORITATIVE_EXTERNAL: Apple TN3187 and UIKit transition guidance.
  HUMAN_RESEARCH: N/A
INFERENCE_AND_ALTERNATIVES: Simulator success does not prove signed archive, physical device, or JavaScript destination.
RECOMMENDATION: Keep scene registration and include signed-device deep-link/lifecycle proof in release verification.
REJECTION_CRITERION: Cold/warm launch or URL forwarding fails; privacy shield does not cover inactive snapshots; resume loses content.
WRITE_SET: iOS lifecycle files and tests.
MIGRATION_OR_DATA_EFFECT: None.
TEST_FIRST_PROOF: Scene registration/forwarding tests failed before implementation and passed after.
ACCEPTANCE_CRITERIA: Registered scene builds/launches and preserves bounded lifecycle behaviors.
ROLLBACK: Revert as one native lifecycle unit only to a supported equivalent.
VERIFICATION: FIXED for source/simulator scope; signed device/archive remains UNVERIFIED.
STATUS: FIXED
```

### ZF-EQ-020 — iOS Google authentication routing

```yaml
ID: ZF-EQ-020
TITLE: iOS was routed through an Android-only native Google picker
SEVERITY: P1
CONFIDENCE: HIGH
SURFACE: Sign-in and Settings account linking
ROUTE_OR_ENTRY: Google provider action
FILES_AND_SYMBOLS: auth-screen useAuthHandlers; account-section useAccountAuth; native OAuth tests
PLATFORMS: Android, iOS, Web
THEMES: N/A
LOCALES: Provider action labels
STATES: provider launch; missing/untrusted URL; owner/attempt boundary
OBSERVATION: The shared `isNative` branch selected an Android-owned native picker for iOS.
EXPECTED_CONTRACT: Android uses its native picker; iOS/Web use the existing attempt-bound OAuth redirect appropriate to their platform.
ROOT_CAUSE: Platform capability was conflated with generic native status.
USER_JOB_IMPACT: iOS Google sign-in could present a false/broken affordance.
ACCESSIBILITY_IMPACT: Unreachable provider task.
PRIVACY_SECURITY_IMPACT: OAuth attempts must remain owner/attempt bound.
PERFORMANCE_RELIABILITY_IMPACT: Provider failure/recovery risk.
EVIDENCE:
  DIRECT_LOCAL: Red/green hook tests for both entry points and Android preservation.
  DIRECT_RUNTIME: Live provider authorization/callback UNVERIFIED.
  AUTHORITATIVE_EXTERNAL: Platform implementation boundary is repository-local.
  HUMAN_RESEARCH: N/A
INFERENCE_AND_ALTERNATIVES: A future supported iOS native picker could replace OAuth only with its own owner/session tests.
RECOMMENDATION: Keep `isAndroid` as the native-picker gate.
REJECTION_CRITERION: Android native picker regresses or iOS OAuth callback loses exact attempt/owner binding.
WRITE_SET: Two handlers and focused tests.
MIGRATION_OR_DATA_EFFECT: No token/schema migration; provider launch path only.
TEST_FIRST_PROOF: iOS route expectation failed before the branch change; Android preservation remained green.
ACCEPTANCE_CRITERIA: Source/tests select the correct platform path.
ROLLBACK: Restore only with a supported iOS-native implementation and live regression proof.
VERIFICATION: FIXED structurally; live auth UNVERIFIED.
STATUS: FIXED
```

### ZF-EQ-021 — Compact Settings module anatomy

```yaml
ID: ZF-EQ-021
TITLE: Compact Settings rows broke leading-text-trailing scan order
SEVERITY: P2
CONFIDENCE: HIGH
SURFACE: Settings overview
ROUTE_OR_ENTRY: /settings at 320–390 CSS px
FILES_AND_SYMBOLS: SettingsModuleCard.tsx; SettingsTextReflow tests
PLATFORMS: Shared Web/PWA/Capacitor/WKWebView/Tauri content
THEMES: Paper and OLED bounded evidence
LOCALES: en and RTL ar/he bounded evidence
STATES: selected/unselected; 150% text
OBSERVATION: Compact CSS placed icon/chevron above label/description and misaligned the divider.
EXPECTED_CONTRACT: Stable leading icon, text column, and trailing chevron with a divider aligned to the text column.
ROOT_CAUSE: Breakpoint-specific grid redefinition.
USER_JOB_IMPACT: Common phone widths disrupted Settings scanning and destination association.
ACCESSIBILITY_IMPACT: Visual order could diverge from the stable semantic order.
PRIVACY_SECURITY_IMPACT: None.
PERFORMANCE_RELIABILITY_IMPACT: None.
EVIDENCE:
  DIRECT_LOCAL: Red/green component assertions.
  DIRECT_RUNTIME: 320px en/he computed three-column geometry and zero overflow; final 390px screenshots cover related shared styling.
  AUTHORITATIVE_EXTERNAL: Android Settings/list guidance as platform vocabulary, not a ZenFlow template.
  HUMAN_RESEARCH: N/A
INFERENCE_AND_ALTERNATIVES: Very large text increases row height; clipping is not an acceptable density shortcut.
RECOMMENDATION: Keep the three-column anatomy at every width and allow vertical expansion.
REJECTION_CRITERION: Slots overlap/clip, logical divider drifts, or focus/targets become unreachable.
WRITE_SET: SettingsModuleCard.tsx; tests.
MIGRATION_OR_DATA_EFFECT: None.
TEST_FIRST_PROOF: Compact anatomy assertions failed before implementation and passed after.
ACCEPTANCE_CRITERIA: Stable slot order, aligned logical divider, zero horizontal overflow.
ROLLBACK: Restore only with a proven alternate compact anatomy.
VERIFICATION: FIXED for source/browser scope; native Settings rendering UNVERIFIED.
STATUS: FIXED
```

### ZF-EQ-022 — Nested Settings toggle cards

```yaml
ID: ZF-EQ-022
TITLE: Ordinary binary preferences remained cards inside the Appearance card
SEVERITY: P2
CONFIDENCE: HIGH
SURFACE: Appearance/high contrast/reduce motion and shared ToggleRow consumers
ROUTE_OR_ENTRY: Settings detail panels
FILES_AND_SYMBOLS: V2SettingsControlPrimitives ToggleRow; tests
PLATFORMS: Shared Web/PWA/Android/iOS/Desktop content
THEMES: Paper/OLED bounded evidence
LOCALES: en/ar/he bounded evidence
STATES: on/off/disabled
OBSERVATION: ToggleRow added radius, border, tinted background, icon chip, and containment inside PanelFrame.
EXPECTED_CONTRACT: Ordinary sibling preferences are flat rows separated by one divider while focus/state/target remain clear.
ROOT_CAUSE: A shared primitive treated every binary preference as an independent entity card.
USER_JOB_IMPACT: Card soup weakened hierarchy and made ordinary preferences look heavier than their role.
ACCESSIBILITY_IMPACT: Cognitive grouping ambiguity; semantics remained a switch.
PRIVACY_SECURITY_IMPACT: None.
PERFORMANCE_RELIABILITY_IMPACT: Less material/shadow work.
EVIDENCE:
  DIRECT_LOCAL: Red/green class contract.
  DIRECT_RUNTIME: Transparent background, zero radius/shadow/side/top borders, single divider, 52×48 switch box, zero overflow in bounded LTR/RTL states.
  AUTHORITATIVE_EXTERNAL: Platform list/state guidance.
  HUMAN_RESEARCH: N/A
INFERENCE_AND_ALTERNATIVES: Recovery/dependent entities may still require containment.
RECOMMENDATION: Keep flat ordinary rows; use containment only for documented semantic exceptions.
REJECTION_CRITERION: Row/focus/switch state becomes visually indistinguishable.
WRITE_SET: ToggleRow primitive; tests.
MIGRATION_OR_DATA_EFFECT: None.
TEST_FIRST_PROOF: Nested-surface assertions failed before implementation and passed after.
ACCEPTANCE_CRITERIA: One parent surface, flat rows, aligned divider, preserved state and target.
ROLLBACK: Restore only the minimum documented state surface.
VERIFICATION: FIXED for source/browser scope.
STATUS: FIXED
```

### ZF-EQ-023 — Live Supabase security advisor divergence

```yaml
ID: ZF-EQ-023
TITLE: Production RAG security advisor findings are not reconciled with local migrations
SEVERITY: P1
CONFIDENCE: HIGH
SURFACE: Supabase RAG schema/function boundary
ROUTE_OR_ENTRY: rag_chunks; match_rag_chunks
FILES_AND_SYMBOLS: Production schema plus later local hardening migrations
PLATFORMS: Backend consumers on all clients
THEMES: N/A
LOCALES: N/A
STATES: authenticated RAG access
OBSERVATION: Read-only Supabase MCP advisors report RLS enabled without a policy on rag_chunks and authenticated execution of SECURITY DEFINER match_rag_chunks. Production migration history is behind later local migrations.
EXPECTED_CONTRACT: Production access policy/function execution match an owner-reviewed least-privilege migration set.
ROOT_CAUSE: Approved local hardening appears not deployed, or production intentionally differs; exact rollout intent is owner-only.
USER_JOB_IMPACT: RAG availability/security behavior may differ from current source expectations.
ACCESSIBILITY_IMPACT: None direct.
PRIVACY_SECURITY_IMPACT: Live least-privilege warning.
PERFORMANCE_RELIABILITY_IMPACT: Applying incomplete policy changes could break RAG.
EVIDENCE:
  DIRECT_LOCAL: Later local migration set and schema/type divergence.
  DIRECT_RUNTIME: Supabase MCP project health, migration list, generated types, and security advisors; no data/DDL write.
  AUTHORITATIVE_EXTERNAL: Supabase database-linter findings 0008 and 0029.
  HUMAN_RESEARCH: N/A
INFERENCE_AND_ALTERNATIVES: Production may be staged behind source; local migrations may contain the intended fix but were not release-authorized here.
RECOMMENDATION: Database/security owner reviews the full pending migration set, verifies least privilege, stages/rolls back in an authorized release, then reruns advisors and client tests.
REJECTION_CRITERION: Advisors clear or a reviewed documented exception proves the effective policy/function boundary safe.
WRITE_SET: None; remote DDL/deploy not authorized.
MIGRATION_OR_DATA_EFFECT: Potential production policy/function migration; outside this audit.
TEST_FIRST_PROOF: N/A.
ACCEPTANCE_CRITERIA: Authorized migration identity, zero applicable advisor finding, RAG positive/negative access tests.
ROLLBACK: Use the owner-approved migration rollback; never ad-hoc remote SQL.
VERIFICATION: Live finding BLOCKED by deployment authority.
STATUS: BLOCKED
```

### ZF-EQ-024 — Selected-state and accent-preview visual redundancy

```yaml
ID: ZF-EQ-024
TITLE: Appearance choices relied on color and accent previews collapsed
SEVERITY: P2
CONFIDENCE: HIGH
SURFACE: Appearance mode, accent, and language choices
ROUTE_OR_ENTRY: Settings Appearance
FILES_AND_SYMBOLS: SettingsChoiceButton; AppearanceAccent; SettingsTextReflow test
PLATFORMS: Shared Web/PWA/Android/iOS/Desktop content
THEMES: Paper and OLED
LOCALES: en and ar runtime; shared static coverage
STATES: selected/unselected
OBSERVATION: Selected choices lacked a persistent non-color marker; inline accent swatches rendered as thin strokes.
EXPECTED_CONTRACT: `aria-pressed` plus visible non-color redundancy; previews retain a measurable circular visual.
ROOT_CAUSE: Selection styling used color/material only and inline spans ignored width/height.
USER_JOB_IMPACT: Users could misidentify the current theme/accent/language and could not read accent alternatives accurately.
ACCESSIBILITY_IMPACT: Use-of-color and state redundancy failure; semantic `aria-pressed` already existed.
PRIVACY_SECURITY_IMPACT: None.
PERFORMANCE_RELIABILITY_IMPACT: None material.
EVIDENCE:
  DIRECT_LOCAL: Two separate red/green assertions.
  DIRECT_RUNTIME: Final LTR Paper and RTL OLED screenshots; zero document/choice overflow; swatches 20×20; selected markers present.
  AUTHORITATIVE_EXTERNAL: WCAG use-of-color boundary and current ZenFlow component contract.
  HUMAN_RESEARCH: N/A
INFERENCE_AND_ALTERNATIVES: A generic flex rewrite would break stacked sound-choice copy, so the swatch layout remains caller-owned.
RECOMMENDATION: Keep the canonical check and caller-specific swatch row.
REJECTION_CRITERION: Marker clips/wraps ambiguously, receives a duplicate spoken name, or any swatch loses its 20×20 circle.
WRITE_SET: V2SettingsControlPrimitives.tsx; V2SettingsAppearanceAccent.tsx; test.
MIGRATION_OR_DATA_EFFECT: None.
TEST_FIRST_PROOF: RED missing marker; GREEN marker. RED non-flex swatch parent; GREEN four circular flex items.
ACCEPTANCE_CRITERIA: Visible markers and distinct 20×20 swatches with zero overflow in bounded LTR/RTL states.
ROLLBACK: Revert only to another non-color marker and measurable preview implementation.
VERIFICATION: FIXED for source and bounded browser runtime; native/package parity UNVERIFIED.
STATUS: FIXED
```

## Verification command ledger

All commands used the repository root as working directory unless noted.
Timestamps are UTC and results are fresh for the current dirty snapshot.

| Timestamp | Exact command / scope | Exit | Relevant result |
|---|---|---:|---|
| 2026-07-28T21:42:57Z | `npx vitest run --configLoader runner --exclude 'output/**' --exclude '.codex-recovery/**' --exclude '.superpowers/**' <31 listed remediation files> --testTimeout=60000 --hookTimeout=60000 --teardownTimeout=30000` | 0 | 31 files; 475 passed; 7 todo; 482 total |
| 2026-07-28T21:43Z | `npm run typecheck` | 0 | app and node TypeScript projects passed |
| 2026-07-28T21:44Z | scoped `npx eslint --max-warnings=0` over final Settings, Sentry, auth, and iOS test changes | 0 | no warnings/errors |
| 2026-07-28T21:44–21:45Z | `npm run build` | 0 | 3213 modules; production artifact validation passed; main 826.64 kB warning retained |
| 2026-07-28T21:45Z | `npm run check:production-data-integrity:bundle` | 0 | 2354 scanned, 769 reachable, 0 errors/warnings |
| 2026-07-28T21:45Z | `npm run check:production-data-integrity:diff` | 0 | 2354 scanned, 769 reachable, 0 errors/warnings |
| 2026-07-28T21:46:02Z | `ZENFLOW_PLAYWRIGHT_USE_LOCAL_SERVER=true ZENFLOW_PLAYWRIGHT_LOCAL_PORT=4207 npx playwright test e2e/nav-v2-settings.spec.ts --project=chromium --workers=1 --retries=0` | 0 | 13/13; expected reduced-motion and unsupported ambient-audio warnings only |
| 2026-07-28T21:55Z | `snyk code test --severity-threshold=high src` | 0 | zero high Snyk Code findings after the final source delta |
| 2026-07-28T20:56:52Z | `npm audit --omit=dev --audit-level=high` | 0 | zero production dependency findings |
| 2026-07-28T20:57:59Z | `npm run smoke:chrome-performance` | 0 | latest public phone/desktop route matrix ready; zero console/request/response failures |
| 2026-07-28T22:00–22:01Z | `npm run check:no-ai-templates` | 0 | final documentation/policy quality gate passed after the closure wording update |
| 2026-07-28T22:01Z | `npm run check:best-practices` | 0 | final 66-invariant gate passed after the closure wording update |
| 2026-07-28T21:52Z | `npm run check:visual && npm run check:colors` | 0 | canonical orbs, 118 images/6 SVG logo sources, visual guard, V2 Paper, and hardcoded-color scan passed |
| 2026-07-28T22:01–22:02Z | `npm run check:production-data-integrity:diff` | 0 | final documentation/source diff scan: 2354 scanned, 769 reachable, zero findings |
| 2026-07-28T22:02–22:03Z | `git diff --check` plus the bounded report-structure check | 0 | no whitespace errors; 24 unique finding IDs, 48 balanced fences, final status, and terminal newline |
| 2026-07-28 | `npm run i18n:check` / `npm run i18n:deep` / `npm run check:translation-quality` | 0 | 3577 keys across 8 locales; deep and quality checks passed |
| 2026-07-28 | `npm run check:sync-contract` | 0 | 409 static sync invariants |
| 2026-07-28 | `npm run doc-counts` | 1 | stale generated architecture counts; ZF-EQ-011 |
| 2026-07-28 | `npm run check:types-fresh` | 1 | local migration/type freshness divergence; ZF-EQ-012 |
| 2026-07-28 | full root `npm audit` | 1 | 15 high development findings; ZF-EQ-017 |
| 2026-07-28 | quick local security-suite rerun | 130 | interrupted after recovery copies expanded scanner scope; not PASS; earlier bounded quick report exists |
| 2026-07-28 | `npm run ci:preflight` | SKIP | known `doc-counts`, `types-fresh`, dirty-attribution, and recursive full-lint blockers made a release verdict invalid |

The authoritative full focused command is preserved at
`.codex-recovery/zenflow-experience-audit-2026-07-28/final-verification/focused-regression-commands-2026-07-28.md`.
The invalid earlier Vitest invocation that discovered copied `output/**`
installations is explicitly excluded from proof.

## Runtime and cross-platform verification matrix

| Platform | Evidence-backed result | Blockers / limits |
|---|---|---|
| Web/Vite | PASS for final production build, Settings E2E 13/13, Paper LTR and OLED RTL final Appearance captures, grouped-list computed styles, focus/route behavior in covered flows | whole-product state matrix and manual screen reader remain UNVERIFIED |
| Public Web | Latest cache-busted phone/desktop route matrix PASS | earlier transient 503 root cause and deployment logs UNKNOWN; no deploy performed |
| Installed PWA | Shared build/service worker produced | install, update, offline/reconnect, stale-cache recovery UNVERIFIED |
| Android/Capacitor | Debug APK build/install, clean emulator first screen, background/resume, no fatal/ANR | final Settings marker/swatches not traversed natively; permissions, deep links, TalkBack, process death, signed/store artifact UNVERIFIED |
| iOS/WKWebView | Current-source simulator build/install/cold launch; UIScene warning-free bounded log; privacy-shield/resume evidence | JS destination for OS link, permissions, VoiceOver, physical device, signed archive/store artifact UNVERIFIED; debug codesign receipt affected by rematerializing FileProvider xattrs |
| Desktop/Tauri | macOS arm64 compile/package receipt | GUI runtime/window evidence blocked by local WebKit/cache state; Windows build missing `link.exe`; signing/release UNVERIFIED |
| Supabase MCP | ACTIVE_HEALTHY project identified; migration/type/security-advisor read-only checks completed | migration deployment/types reconciliation and security findings require owner/deploy authority |

## Screenshot and artifact ledger

| Artifact | SHA-256 | What it proves |
|---|---|---|
| final Settings overview mobile en Paper | `18f9a8686ef206d0db8492d5ff65c09a86df448444bf6cb4857b87e6caf49fe3` | visible grouped overview at 390×844 before final choice-marker-only delta |
| final Appearance mobile en Paper before marker delta | `6ca135cb7e7bcf1bf47b3007c38fe5fcd9bd0801b3b1313ebf64ee6f33a9666b` | flat ToggleRows and detail hierarchy; also exposed the choice/swatch defects |
| final overview mobile ar OLED | `74d2cb28efb300a3dd3421eed8d4bd6f134135fe8b8ccb22e6e3b2ac76ef70d0` | bounded RTL overview before final choice-marker-only delta |
| final Appearance desktop en Paper | `408e15263be36834d994fd9783c379c4c19d93517d073a931e6277722c88c8d7` | desktop list-detail hierarchy before final choice-marker-only delta |
| final Appearance mobile en Paper with markers/swatches | `2fe43067fc26c32f20f124a983486fb718fa739f49e501d17d0524417e734ec3` | visible Light/Green/English markers and four circular swatches, zero overflow |
| final Appearance mobile ar OLED with markers/swatches | `421d1238f946bad8bd6fc966c1c3f82dc863556fc3e9142d88e2b788aaec9d38` | RTL Black/Green/Arabic markers, circular swatches, zero overflow |
| Android clean emulator first screen | `d71b991cd2328dbdd0186d70536fa7476573d12569aeaa1b89d3a62c92e7b6bd` | visible bounded clean-launch state |
| iOS final cold launch | `ee7aa4a1c034ae88da108b19ce94b8fa1585783200bec37218d6c6720ea92a81` | visible current-source simulator cold launch |
| iOS bounded runtime receipt | `4bf44504f3edab2c7e9b5ae8b5eebbd8004327dfb17cdd95f90ef10f8f596017` | build/install/launch/log commands and result |
| iOS app-switcher shield / resume | `9448bb45ce8a9f00f11e963f7ddb5a3bb6731c1cf9c3e2f97e5a8ff52b0b6584` / `356d3946146f663b8d6c4320d652270ddcbf01287935fce72fded3d43b22096f` | blur before inactive snapshot and bounded restored content |
| iOS FileProvider xattr investigation | `8f82bc3f9436ec79a5d0a33e4a4d5ee49a73d61d71fdcab951c7b4ea2af1810b` | strict debug-bundle signing blocker investigation, not release proof |
| Desktop evidence summary | `ab700e9d00e77669848d02634826153d585a20940e878636c0a10f783c4d9d73` | bounded compile/package and runtime blockers |
| latest public performance JSON | `eb825b8418d0170a7f3c11af8daf10978ce18853f3a938289e6b9d98e2b0ca59` | latest public route/network/console observations |

## Top findings by severity

- P0: none confirmed.
- P1 fixed in proven scope: missing progression renderer, causal insight
  overclaim, production dependency advisory resolution, iOS scene lifecycle,
  and iOS Google routing.
- P1 blocked/unverified: local/production Supabase migration/type divergence,
  live Supabase security advisors, release attribution, native signed/store
  artifacts, and the earlier public 503 root cause.
- P2 fixed in proven scope: challenge-link truthfulness, mood-only save,
  Settings grouped containment/focus/row anatomy/toggles/selected states,
  language grid, Android first-run push cleanup, update-dialog icon semantics,
  and structured telemetry containment.
- P2 open/blocked: native secure auth storage migration, development dependency
  chain, full telemetry producer/server boundary, and measured bundle/native
  resource work.
- P3: no standalone polish item was prioritized over the above system defects.

## Unverified / blockers

- The shared checkout is dirty, behind `origin/main`, and not an attributable
  release candidate. The audit did not pull, reset, rebase, merge, or overwrite
  unrelated work.
- `doc-counts` and `check:types-fresh` fail for real candidate-governance
  reasons; they were not silenced.
- Production Supabase is behind the local migration set. No DDL, migration,
  Edge Function, auth, sync, user-data, or deployment write was performed.
- Supabase advisors 0008 and 0029 remain live until an authorized database
  owner reconciles the pending migration set.
- Native secure session storage needs a versioned Android/iOS migration and
  explicit dependency/plugin authority; it was not patched as visual CSS.
- Installed PWA lifecycle, physical Android/iOS, VoiceOver/TalkBack/NVDA,
  packaged Tauri/Windows, store artifacts, signing, field performance, and
  human/native-speaker research remain UNVERIFIED.
- Full development dependency remediation, clean `npm ci`, and regenerated
  native/package proof remain blocked by the mixed checkout/integration lane.
- Role-10 isolated, hash-bound whole-audit closure was not established; this
  prevents a whole-product/release `GO`.

## Residual risks

- Sink-side telemetry redaction is containment, not proof that arbitrary future
  producer strings or server-side Sentry processing cannot expose private
  content.
- The UIScene simulator proof does not establish App Store archive signing or
  physical-device deep-link destination behavior.
- Shared React/CSS source does not by itself prove final Settings rendering in
  every native/package shell.
- Large translated text can produce tall Settings rows; the bounded checks show
  reflow rather than clipping, but human scanability at maximum scale is
  UNVERIFIED.
- No finding is evidence that users prefer the visual direction or experience
  a psychological benefit.

`HUMAN_ACCEPTANCE: UNVERIFIED`

Closure interpretation at this evidence checkpoint is `STOP` for
whole-product/release readiness.

`GO_FOR_PROVEN_SCOPE` for the listed source, test, build, bounded browser,
Android first-screen, iOS simulator-lifecycle, public-read-only, and Supabase
read-only findings. No push, merge, deployment, production write, or remote
configuration change was performed.

## Remaining previously catalogued findings

### ZF-EQ-005 — Settings containment drift

```yaml
ID: ZF-EQ-005
TITLE: Ordinary Settings rows and account facts created repeated nested cards
SEVERITY: P2
CONFIDENCE: HIGH
SURFACE: Settings overview and Account detail
ROUTE_OR_ENTRY: /settings; account destination
FILES_AND_SYMBOLS: SettingsModuleList; SettingsModuleCard; SettingsInset; V2SettingsAccountPanel
PLATFORMS: Web, PWA, Android, iOS, Desktop
THEMES: Paper, Ink, OLED, System, high contrast
LOCALES: All 8
STATES: compact/wide; selected; signed out/signed in; checking/error/recovery
OBSERVATION: Page, group, row, and ordinary identity/provider facts each added similar material containment.
EXPECTED_CONTRACT: One semantic containment level owns one primary surface; ordinary rows use spacing/dividers.
ROOT_CAUSE: Reusable presentation wrappers were composed without a containment-level contract.
USER_JOB_IMPACT: Repeated visual weight weakened scan order and made navigation rows resemble independent CTAs.
ACCESSIBILITY_IMPACT: Visual affordance did not consistently distinguish navigation, facts, status, and recovery.
PRIVACY_SECURITY_IMPACT: Destructive/account states risked competing with ordinary preferences; handler semantics were unchanged.
PERFORMANCE_RELIABILITY_IMPACT: Extra blur/border/shadow layers increased paint complexity.
EVIDENCE:
  DIRECT_LOCAL: Primitive/panel inspection and characterization/component tests.
  DIRECT_RUNTIME: Matched bounded Settings browser screenshots and geometry checks.
  AUTHORITATIVE_EXTERNAL: Android Settings, Apple Settings, Material lists, and Microsoft Settings guidance, applied within ZenFlow's own language.
  HUMAN_RESEARCH: UNKNOWN
INFERENCE_AND_ALTERNATIVES: Flattening every state would hide recovery boundaries; only ordinary rows/facts were flattened.
RECOMMENDATION: Keep one group surface and allow containment only for separate warning, dependent, recovery, or destructive entities.
REJECTION_CRITERION: Row meaning, selected state, focus, contrast, or destructive separation becomes ambiguous.
WRITE_SET: Shared Settings primitives, overview modules, Account panel, tests and design contract.
MIGRATION_OR_DATA_EFFECT: Presentation only.
TEST_FIRST_PROOF: Existing row anatomy was characterized before primitive changes; focused suites passed after migration.
ACCEPTANCE_CRITERIA: Ordinary rows do not own an extra border/radius/shadow; Account facts remain readable; recovery entities retain distinction.
ROLLBACK: Revert the shared primitive wave as one unit.
VERIFICATION: Component suites and bounded local browser mobile/desktop/RTL/theme evidence passed.
STATUS: FIXED
```

### ZF-EQ-006 — Settings detail focus and material ownership

```yaml
ID: ZF-EQ-006
TITLE: Structural Settings detail region behaved like another card and a second focus stop
SEVERITY: P2
CONFIDENCE: HIGH
SURFACE: Settings list-detail
ROUTE_OR_ENTRY: /settings after opening any detail
FILES_AND_SYMBOLS: SettingsPageComponents; SettingsPage; themes.css; nav-v2-settings E2E
PLATFORMS: Web, PWA, Android, iOS, Desktop
THEMES: Paper, Ink, OLED, high contrast
LOCALES: All 8
STATES: compact navigation; desktop list-detail; keyboard focus
OBSERVATION: The structural detail region added material containment and could compete with its heading for focus ownership.
EXPECTED_CONTRACT: The region groups content; the destination heading receives programmatic focus once.
ROOT_CAUSE: Layout, material, and focus responsibilities were assigned to the same wrapper.
USER_JOB_IMPACT: Extra visual nesting and potentially confusing keyboard destination.
ACCESSIBILITY_IMPACT: Duplicate focus ownership and clipped focus were plausible.
PRIVACY_SECURITY_IMPACT: None.
PERFORMANCE_RELIABILITY_IMPACT: Unnecessary backdrop/material layer.
EVIDENCE:
  DIRECT_LOCAL: Source/computed-style contract and red/green component assertions.
  DIRECT_RUNTIME: Local browser heading focus, transparent region, no horizontal overflow; one capture was rejected as unstable.
  AUTHORITATIVE_EXTERNAL: WCAG focus/order requirements and APG focus guidance.
  HUMAN_RESEARCH: UNKNOWN
INFERENCE_AND_ALTERNATIVES: A focusable region could announce context, but the separately labeled heading is the clearer single owner here.
RECOMMENDATION: Keep structural region nonfocusable/transparent and focus the heading.
REJECTION_CRITERION: Focus does not land on the heading, ring is clipped, viewport moves horizontally, or assistive reading order regresses.
WRITE_SET: SettingsPageComponents.tsx; themes.css; component/E2E tests.
MIGRATION_OR_DATA_EFFECT: None.
TEST_FIRST_PROOF: Two focused assertions failed before the ownership change and passed afterward.
ACCEPTANCE_CRITERIA: Region has no independent card material/tab stop; heading receives focus; width remains within viewport.
ROLLBACK: Restore only with one documented focus owner and matched runtime proof.
VERIFICATION: 166-test focused Settings run and 13-case Settings E2E passed; stable repeated focus capture remains a visual evidence limitation.
STATUS: FIXED
```

### ZF-EQ-007 — Appearance nested surface and motion-contract divergence

```yaml
ID: ZF-EQ-007
TITLE: Appearance kept an inner material card and its motion spec contradicted runtime
SEVERITY: P2
CONFIDENCE: HIGH
SURFACE: Settings Appearance and Settings overview/detail transition
ROUTE_OR_ENTRY: /settings appearance
FILES_AND_SYMBOLS: V2SettingsAppearancePanel; SettingsMotionSurface; SettingsPageMotionContract; Settings simplification design spec
PLATFORMS: Web, PWA, Android, iOS, Desktop
THEMES: Paper primarily; shared motion across themes
LOCALES: All 8
STATES: Appearance detail; normal motion; reduced motion
OBSERVATION: A contained SettingsInset sat inside PanelFrame; the spec required 8px movement while source/tests intentionally used opacity only.
EXPECTED_CONTRACT: One Appearance material surface and one internally consistent, reduced-motion-safe transition contract.
ROOT_CAUSE: A presentation wrapper survived the grouped-list migration; the approved draft and later compositor-risk implementation diverged.
USER_JOB_IMPACT: Paper hierarchy remained visually dense; motion behavior could not be evaluated against a truthful contract.
ACCESSIBILITY_IMPACT: Unnecessary boundaries increase cognitive load; spatial motion must not occur under Reduce Motion.
PRIVACY_SECURITY_IMPACT: None.
PERFORMANCE_RELIABILITY_IMPACT: Transforming a large blurred surface increases clipping/compositor risk.
EVIDENCE:
  DIRECT_LOCAL: Critic source locators; red/green structural test; motion source/test/spec comparison.
  DIRECT_RUNTIME: Earlier Paper screenshot exposed nested material; post-fix matched screenshot and motion recording remain UNVERIFIED.
  AUTHORITATIVE_EXTERNAL: Apple Motion and WCAG reduced-motion applicability.
  HUMAN_RESEARCH: UNKNOWN
INFERENCE_AND_ALTERNATIVES: Spatial motion may improve continuity, but current evidence favors reversible opacity-only behavior.
RECOMMENDATION: Structural inner wrapper; canonical opacity-only large-surface transition; retain explicit rejection criteria.
REJECTION_CRITERION: Section separation/focus/contrast weakens, or opacity-only continuity fails in matched runtime evidence.
WRITE_SET: V2SettingsAppearancePanel.tsx; structural test; Settings design contract.
MIGRATION_OR_DATA_EFFECT: Presentation/documentation only.
TEST_FIRST_PROOF: New structural assertion failed with the nested inset and passed after replacement.
ACCEPTANCE_CRITERIA: No contained customization inset inside PanelFrame; source/tests/spec agree; reduced-motion path remains instant.
ROLLBACK: Restore containment only with a distinct semantic entity; revisit spatial motion only with LTR/RTL and reduced-motion proof.
VERIFICATION: Structural test PASS; normal/reduced-motion video and post-fix Paper screenshot UNVERIFIED.
STATUS: FIXED
```

### ZF-EQ-008 — Android first-launch push cleanup

```yaml
ID: ZF-EQ-008
TITLE: First native launch attempted push cleanup before consent history existed
SEVERITY: P1
CONFIDENCE: HIGH
SURFACE: Native first-run shell
ROUTE_OR_ENTRY: Clean Android/iOS install before language/onboarding consent
FILES_AND_SYMBOLS: useNotificationSetup push-consent effect; focused hook test
PLATFORMS: Android, iOS shared Capacitor code
THEMES: All
LOCALES: All 8
STATES: consent never shown; explicit enable; explicit disable; cleanup failure
OBSERVATION: A null previous state plus default false entered token revocation and displayed an alarming cleanup error on a clean Android install.
EXPECTED_CONTRACT: Default false is neutral until consent/history proves an enabled-to-disabled transition.
ROOT_CAUSE: Absence of consent was treated as an explicit opt-out.
USER_JOB_IMPACT: First launch showed a severe remote-notification error before the user made any choice.
ACCESSIBILITY_IMPACT: A large error interrupted the entry task and status announcement.
PRIVACY_SECURITY_IMPACT: Unnecessary remote/native cleanup attempt crossed a permission boundary without evidence of prior registration.
PERFORMANCE_RELIABILITY_IMPACT: Avoidable network/plugin failure and retry UI.
EVIDENCE:
  DIRECT_LOCAL: Red test recorded removePushToken once; green test recorded zero before consent.
  DIRECT_RUNTIME: Clean Android old-APK screenshot reproduced the error; current-APK result recorded below.
  AUTHORITATIVE_EXTERNAL: Platform permission/least-surprise guidance; source truth remains decisive.
  HUMAN_RESEARCH: UNKNOWN
INFERENCE_AND_ALTERNATIVES: A durable registered-token history flag could be stronger; it does not currently exist in this effect.
RECOMMENDATION: Keep first-run guard and preserve known true-to-false revocation tests.
REJECTION_CRITERION: Explicit disable no longer revokes, or clean launch still attempts cleanup.
WRITE_SET: useNotificationSetup.ts; useNotificationSetup.test.tsx.
MIGRATION_OR_DATA_EFFECT: Narrows side effects; no user data, token, schema, or backend migration.
TEST_FIRST_PROOF: 2026-07-28T19:36:53Z red 1 failed/37 passed; 19:37:15Z green 38/38.
ACCEPTANCE_CRITERIA: Clean first launch shows no revocation incident; explicit disable retains cleanup.
ROLLBACK: Replace only with a tested durable prior-registration signal.
VERIFICATION: Hook suite PASS; final clean-install Android screenshot/log status recorded below.
STATUS: FIXED
```

### ZF-EQ-009 — Compact language grid

```yaml
ID: ZF-EQ-009
TITLE: Compact native language grid split short names character by character
SEVERITY: P2
CONFIDENCE: HIGH
SURFACE: Language selection
ROUTE_OR_ENTRY: Clean first launch
FILES_AND_SYMBOLS: LanguageSelector grid class; LanguageSelector test
PLATFORMS: Web, PWA, Android, iOS, Desktop shared renderer
THEMES: Light, Dark, System
LOCALES: en, uk, es, de, fr, ja, ar, he
STATES: compact width; font scale; RTL labels
OBSERVATION: A 7rem minimum allowed three columns in the native compact viewport, splitting English, Spanish, German, and French into narrow fragments.
EXPECTED_CONTRACT: Language names remain recognizable; grid reduces column count before destructive wrapping.
ROOT_CAUSE: Auto-fit minimum optimized item count rather than minimum readable label width.
USER_JOB_IMPACT: The first decision screen was hard to scan.
ACCESSIBILITY_IMPACT: Text expansion and cognitive readability regressed.
PRIVACY_SECURITY_IMPACT: None.
PERFORMANCE_RELIABILITY_IMPACT: None material.
EVIDENCE:
  DIRECT_LOCAL: Red/green class contract test.
  DIRECT_RUNTIME: Android clean-install before/after screenshots.
  AUTHORITATIVE_EXTERNAL: WCAG reflow/text-spacing applicability and platform layout guidance.
  HUMAN_RESEARCH: UNKNOWN
INFERENCE_AND_ALTERNATIVES: Fixed two columns would waste wider layouts; a larger auto-fit minimum remains adaptive.
RECOMMENDATION: Keep 9rem minimum and per-item RTL/wrapping.
REJECTION_CRITERION: Any supported label clips, overflows, or splits destructively at 320–390 CSS px or supported font scale.
WRITE_SET: LanguageSelector.tsx; LanguageSelector.test.tsx.
MIGRATION_OR_DATA_EFFECT: None.
TEST_FIRST_PROOF: 2026-07-28T19:45:03Z red 1 failed/4 passed; 19:45:14Z green 5/5.
ACCEPTANCE_CRITERIA: Compact runtime uses fewer readable columns with no horizontal overflow.
ROLLBACK: Tune minimum only with matched runtime evidence across all labels.
VERIFICATION: Component suite PASS; final Android screenshot result recorded below.
STATUS: FIXED
```

### ZF-EQ-010 — Public deployment script failure

```yaml
ID: ZF-EQ-010
TITLE: Public GitHub Pages smoke observed a script request failure
SEVERITY: P1
CONFIDENCE: MEDIUM
SURFACE: Public Web/PWA
ROUTE_OR_ENTRY: https://yehor212.github.io/people-first-app/
FILES_AND_SYMBOLS: Deployed artifact outside authorized local-only remediation
PLATFORMS: Public Web/PWA
THEMES: Tested default state only
LOCALES: Tested public state only
STATES: cache-busted load
OBSERVATION: One public smoke observed routeReady false with a script 503; the later repeated full public route matrix reached routeReady/appReady with zero console errors, failed requests, or failed responses.
EXPECTED_CONTRACT: A cache-busted public route loads its version-matched assets and reaches route-ready state.
ROOT_CAUSE: UNKNOWN; deployment/CDN/cache incident was not safely attributable from local evidence.
USER_JOB_IMPACT: Public app may fail to start for the observed request.
ACCESSIBILITY_IMPACT: Complete task unavailability.
PRIVACY_SECURITY_IMPACT: No leak confirmed.
PERFORMANCE_RELIABILITY_IMPACT: Startup failure.
EVIDENCE:
  DIRECT_LOCAL: Smoke JSON/command summary.
  DIRECT_RUNTIME: Fresh public request observed routeReady false and HTTP 503.
  AUTHORITATIVE_EXTERNAL: Core Web Vitals does not classify an unavailable route as healthy.
  HUMAN_RESEARCH: UNKNOWN
INFERENCE_AND_ALTERNATIVES: CDN transient, stale HTML, missing asset, or deployment mismatch remain alternatives.
RECOMMENDATION: Inspect deployed HTML/asset hashes and CI/deployment logs before any deploy.
REJECTION_CRITERION: Version-bound repeated probes and deployment logs attribute the earlier failure or demonstrate a durable correction.
WRITE_SET: None; deploy not authorized.
MIGRATION_OR_DATA_EFFECT: None.
TEST_FIRST_PROOF: N/A; external runtime observation.
ACCEPTANCE_CRITERIA: Version-bound public route and all required assets return success repeatedly.
ROLLBACK: Use the existing deployment rollback procedure only with explicit authorization.
VERIFICATION: Latest repeated public matrix PASS for the tested routes; earlier incident root cause and PWA update/recovery remain UNVERIFIED.
STATUS: UNVERIFIED
```

### ZF-EQ-011 — Stale architecture counts

```yaml
ID: ZF-EQ-011
TITLE: Architecture generated counts do not match the current dirty filesystem
SEVERITY: P2
CONFIDENCE: HIGH
SURFACE: Repository governance
ROUTE_OR_ENTRY: doc-counts gate
FILES_AND_SYMBOLS: ARCHITECTURE.md generated count block; doc-count scripts
PLATFORMS: All development/release paths
THEMES: N/A
LOCALES: N/A
STATES: Current dirty checkout
OBSERVATION: npm run doc-counts exited 1.
EXPECTED_CONTRACT: Generated architecture facts match the candidate filesystem.
ROOT_CAUSE: Concurrent/pre-existing repository changes outpaced count regeneration.
USER_JOB_IMPACT: Reviewers cannot rely on current architecture counts.
ACCESSIBILITY_IMPACT: None direct.
PRIVACY_SECURITY_IMPACT: Stale governance can hide scope drift.
PERFORMANCE_RELIABILITY_IMPACT: Release attribution risk.
EVIDENCE:
  DIRECT_LOCAL: Fresh nonzero command result.
  DIRECT_RUNTIME: N/A
  AUTHORITATIVE_EXTERNAL: N/A
  HUMAN_RESEARCH: N/A
INFERENCE_AND_ALTERNATIVES: Updating generated counts in this mixed checkout could absorb unrelated work and falsely define a release candidate.
RECOMMENDATION: Regenerate only in an owner-attributed integration candidate.
REJECTION_CRITERION: Fresh doc-counts passes and generated diff is reviewed against the intended candidate.
WRITE_SET: None in this audit.
MIGRATION_OR_DATA_EFFECT: None.
TEST_FIRST_PROOF: N/A.
ACCEPTANCE_CRITERIA: Fresh exit 0 on a clean attributable candidate.
ROLLBACK: Revert only the generated block from that candidate if counts are wrong.
VERIFICATION: FAIL.
STATUS: BLOCKED
```

### ZF-EQ-012 — Stale Supabase generated types

```yaml
ID: ZF-EQ-012
TITLE: Supabase generated types are older than the newest migration
SEVERITY: P1
CONFIDENCE: HIGH
SURFACE: Auth/sync/data client contract
ROUTE_OR_ENTRY: check:types-fresh
FILES_AND_SYMBOLS: src/types/supabase.ts; Supabase migrations
PLATFORMS: Web, PWA, Android, iOS, Desktop
THEMES: N/A
LOCALES: N/A
STATES: Any backend interaction using generated types
OBSERVATION: Freshness check reported the type file approximately 10,633 minutes older than the newest local migration. Read-only Supabase MCP comparison showed production's latest migration is 20260715121005 while the local migration set continues through at least 20260722213200; generated production types also differ semantically from the local file.
EXPECTED_CONTRACT: Generated client types correspond to the authorized backend schema/migration set.
ROOT_CAUSE: The production schema is behind the current local migration set, so regenerating from production cannot represent the local candidate and touching timestamps cannot establish correctness.
USER_JOB_IMPACT: Compile-time guarantees may omit current schema or RPC behavior.
ACCESSIBILITY_IMPACT: None direct.
PRIVACY_SECURITY_IMPACT: Auth/owner-boundary assumptions can be stale.
PERFORMANCE_RELIABILITY_IMPACT: Runtime contract mismatch risk.
EVIDENCE:
  DIRECT_LOCAL: Fresh check:types-fresh exit 1 plus local migration/type comparison.
  DIRECT_RUNTIME: Read-only Supabase MCP migration list and generated-type comparison; no schema/data write.
  AUTHORITATIVE_EXTERNAL: N/A
  HUMAN_RESEARCH: N/A
INFERENCE_AND_ALTERNATIVES: Production may intentionally await deployment, or the local migration set may not yet be an approved release candidate. Either way, overwriting local types from the older production schema would be misleading.
RECOMMENDATION: In an owner-attributed release lane, reconcile and deploy the approved migration set first or explicitly choose the production schema as the candidate; then regenerate types and run migration/RPC/auth/sync checks.
REJECTION_CRITERION: Fresh types-fresh, typecheck, and scoped schema tests pass against the intended target.
WRITE_SET: None; live target authorization/evidence required.
MIGRATION_OR_DATA_EFFECT: Type generation only when authorized; no migration in this audit.
TEST_FIRST_PROOF: N/A.
ACCEPTANCE_CRITERIA: Generated bytes and schema identity are attributable and fresh.
ROLLBACK: Roll back the attributable migration/type candidate together; never restore bytes solely to satisfy file age.
VERIFICATION: FAIL.
STATUS: BLOCKED
```

### ZF-EQ-013 — Native auth session storage hardening

```yaml
ID: ZF-EQ-013
TITLE: Native auth persistence still uses WebView localStorage rather than secure platform storage
SEVERITY: P2
CONFIDENCE: HIGH
SURFACE: Authentication persistence
ROUTE_OR_ENTRY: Native sign-in/session restore
FILES_AND_SYMBOLS: supabaseClient native storage adapter
PLATFORMS: Android, iOS
THEMES: N/A
LOCALES: N/A
STATES: signed in; process restart; compromised WebView
OBSERVATION: Current source returns window.localStorage and documents secure storage as future hardening.
EXPECTED_CONTRACT: Sensitive native session persistence uses a threat-modeled platform-appropriate boundary.
ROOT_CAUSE: Shared web adapter was retained for native builds.
USER_JOB_IMPACT: No active compromise was demonstrated; exposure severity rises if the WebView context is compromised.
ACCESSIBILITY_IMPACT: None.
PRIVACY_SECURITY_IMPACT: Persisted session material is accessible to WebView JavaScript.
PERFORMANCE_RELIABILITY_IMPACT: Migration/session-continuity risk for any future fix.
EVIDENCE:
  DIRECT_LOCAL: Security review source inspection.
  DIRECT_RUNTIME: Native storage contents and attack path UNVERIFIED.
  AUTHORITATIVE_EXTERNAL: OWASP MASVS/MASTG secure-storage applicability.
  HUMAN_RESEARCH: N/A
INFERENCE_AND_ALTERNATIVES: A secure-storage migration needs logout, rollback, corruption, backup, and cross-version design; it is not a safe visual-audit patch.
RECOMMENDATION: Plan a separate versioned native storage migration and threat model.
REJECTION_CRITERION: Platform storage, migration, logout, process-death, and rollback tests pass.
WRITE_SET: None in this audit.
MIGRATION_OR_DATA_EFFECT: Future session migration; outside authorized bounded remediation.
TEST_FIRST_PROOF: N/A.
ACCEPTANCE_CRITERIA: Threat-model-approved adapter and compatibility tests on Android/iOS.
ROLLBACK: Versioned adapter falls back only without exposing or losing valid sessions.
VERIFICATION: Source finding HIGH confidence; exploitability/runtime UNVERIFIED.
STATUS: BLOCKED
```

### ZF-EQ-014 — Telemetry sensitive-content boundary

```yaml
ID: ZF-EQ-014
TITLE: Sentry denylist does not structurally prove journal/mood content cannot reach telemetry
SEVERITY: P2
CONFIDENCE: MEDIUM
SURFACE: Observability
ROUTE_OR_ENTRY: Any captureError/captureMessage/breadcrumb/context producer
FILES_AND_SYMBOLS: sentry.ts and telemetry producers
PLATFORMS: All Sentry-enabled builds
THEMES: N/A
LOCALES: N/A
STATES: error/diagnostic capture
OBSERVATION: Baseline scrubbing covered credentials and selected PII but allowed structured private-writing/wellbeing canaries under content-shaped fields; no active raw-content caller was confirmed.
EXPECTED_CONTRACT: Sensitive journal/mood data is impossible or rejected at the telemetry boundary.
ROOT_CAUSE: The sink lacked a structured content-field boundary and still relies on pattern-based rejection rather than typed producer allowlists.
USER_JOB_IMPACT: No current leak was proven; future callers could bypass name-based scrubbing.
ACCESSIBILITY_IMPACT: None.
PRIVACY_SECURITY_IMPACT: Potential sensitive-content telemetry exposure.
PERFORMANCE_RELIABILITY_IMPACT: Overbroad scrubbing could also remove useful diagnostics.
EVIDENCE:
  DIRECT_LOCAL: Security review plus red canary test and green Sentry privacy/transport tests.
  DIRECT_RUNTIME: Sentry project processing and retention UNVERIFIED.
  AUTHORITATIVE_EXTERNAL: OWASP privacy/security principles; exact app boundary remains local.
  HUMAN_RESEARCH: N/A
INFERENCE_AND_ALTERNATIVES: The bounded redaction contains structured key paths and preserves operational metadata; arbitrary top-level strings and future producer names still require a typed/allowlisted producer contract.
RECOMMENDATION: Keep the canary boundary, inventory producers, and migrate generic telemetry producers toward privacy-safe typed payloads.
REJECTION_CRITERION: A private canary reaches serialized output, operational metadata is unnecessarily removed, or the containment is represented as proof against arbitrary strings.
WRITE_SET: sentry.ts; sentryPrivacy.test.ts.
MIGRATION_OR_DATA_EFFECT: Telemetry payload redaction only; no user/business data migration.
TEST_FIRST_PROOF: RED exposed four structured private canaries; GREEN redacts them while preserving operation, retryCount, contentType, responseStatus, and errorCode.
ACCEPTANCE_CRITERIA: Structured canaries are rejected; full closure additionally requires producer and server-side owner review.
ROLLBACK: Preserve minimal technical diagnostics while removing only unsafe payload fields.
VERIFICATION: Structured containment FIXED for tested fields; active leak and complete arbitrary-string prevention UNKNOWN.
STATUS: OPEN
```


### ZF-EQ-002 — Unsupported short challenge link

```yaml
ID: ZF-EQ-002
TITLE: Parser advertised a challenge-link format with no valid V2 destination
SEVERITY: P2
CONFIDENCE: HIGH
SURFACE: Deep links
ROUTE_OR_ENTRY: zenflow://challenge/<short-id> and equivalent web path
FILES_AND_SYMBOLS: deepLinks.ts; deep-link tests; useDeepLinkHandler canonical invite path
PLATFORMS: Web, PWA, Android, iOS, Desktop
THEMES: N/A
LOCALES: N/A
STATES: cold/warm link; malformed link
OBSERVATION: The generic parser accepted a short ID although V2 only had a meaningful encoded invite payload.
EXPECTED_CONTRACT: Accepted links reach a real recoverable destination; unsupported input is not reported as success.
ROOT_CAUSE: Two incompatible challenge-link schemas evolved independently.
USER_JOB_IMPACT: A plausible link silently failed.
ACCESSIBILITY_IMPACT: No destination or recovery content.
PRIVACY_SECURITY_IMPACT: Treating arbitrary IDs as payloads would require unsafe guessing.
PERFORMANCE_RELIABILITY_IMPACT: False dispatch success.
EVIDENCE:
  DIRECT_LOCAL: Parser/subscriber inspection and focused tests.
  DIRECT_RUNTIME: OS-level handoff UNVERIFIED.
  AUTHORITATIVE_EXTERNAL: UNKNOWN
  HUMAN_RESEARCH: UNKNOWN
INFERENCE_AND_ALTERNATIVES: A compatibility adapter is possible only with a defined authoritative resolver.
RECOMMENDATION: Retain only the canonical encoded invite until such an adapter exists.
REJECTION_CRITERION: A shipped legacy short-link population with an authoritative resolution contract is proven.
WRITE_SET: deepLinks.ts and tests.
MIGRATION_OR_DATA_EFFECT: Unsupported short links now fall into recovery rather than false success.
TEST_FIRST_PROOF: Existing parser behavior was characterized; post-change assertions cover rejection and canonical payload preservation.
ACCEPTANCE_CRITERIA: Unsupported short IDs are not dispatched; valid encoded invites remain supported.
ROLLBACK: Restore through a tested compatibility adapter, not the removed blind parser.
VERIFICATION: Focused deep-link suite passed; existing todo cases remain explicitly unverified.
STATUS: FIXED
```

### ZF-EQ-003 — Mood save forced Diary navigation

```yaml
ID: ZF-EQ-003
TITLE: Mood persistence and starting a diary entry were conflated
SEVERITY: P2
CONFIDENCE: HIGH
SURFACE: Orb mood flow
ROUTE_OR_ENTRY: /orb after choosing mood
FILES_AND_SYMBOLS: useOrbMoodFlow; OrbPage; OrbPageSteps
PLATFORMS: Web, PWA, Android, iOS, Desktop
THEMES: All
LOCALES: All 8
STATES: selected mood; save; optional continuation
OBSERVATION: The only save action persisted mood, reset diary context, and navigated to Diary.
EXPECTED_CONTRACT: A user can record mood without accepting a sensitive-writing transition.
ROOT_CAUSE: Persistence and cross-feature navigation were owned by one handler.
USER_JOB_IMPACT: Mood-only users had to abandon the flow or accept extra work.
ACCESSIBILITY_IMPACT: Additional unexpected context change.
PRIVACY_SECURITY_IMPACT: No data leak confirmed; agency around sensitive writing was reduced.
PERFORMANCE_RELIABILITY_IMPACT: Unnecessary route/state mutation.
EVIDENCE:
  DIRECT_LOCAL: Handler/render inspection and red/green hook/component tests.
  DIRECT_RUNTIME: Local Orb route readiness; native touch flow UNVERIFIED.
  AUTHORITATIVE_EXTERNAL: Nielsen user-control heuristic, used as heuristic only.
  HUMAN_RESEARCH: UNKNOWN
INFERENCE_AND_ALTERNATIVES: A combined CTA could improve conversion but is not evidence of informed choice.
RECOMMENDATION: Keep mood-only save primary and Diary continuation separate.
REJECTION_CRITERION: Duplicate/lost persistence or Diary still opens from save-only.
WRITE_SET: useOrbMoodFlow.ts; OrbPage.tsx; OrbPageSteps.tsx; tests/copy.
MIGRATION_OR_DATA_EFFECT: Same mood record; narrower navigation side effect.
TEST_FIRST_PROOF: Mood-only and navigation behavior were split into failing then passing focused assertions.
ACCEPTANCE_CRITERIA: Save persists once and stays on the flow; continuation navigates only after a separate action.
ROLLBACK: Recombine only with explicit product/agency evidence and regression tests.
VERIFICATION: Focused Orb suite passed.
STATUS: FIXED
```

### ZF-EQ-004 — Causal insight overclaim

```yaml
ID: ZF-EQ-004
TITLE: Observational history was presented as causal improvement with pseudo-confidence
SEVERITY: P1
CONFIDENCE: HIGH
SURFACE: Habits insights and shared insight cards
ROUTE_OR_ENTRY: /habits and any shared insight renderer
FILES_AND_SYMBOLS: insightsEngine; reflectionIntelligence; InsightCard; InsightsPanel; HeroInsightStrip; 8 locale dictionaries
PLATFORMS: Web, PWA, Android, iOS, Desktop
THEMES: All
LOCALES: en, uk, es, de, fr, ja, ar, he
STATES: sufficient/sparse samples; positive/neutral association
OBSERVATION: Uncontrolled average differences used causal verbs and a confidence-like badge not calibrated as probability.
EXPECTED_CONTRACT: Product copy states measured facts and limitations without claiming causality.
ROOT_CAUSE: Ranking strength and sample-size heuristics leaked into user-facing epistemic certainty.
USER_JOB_IMPACT: Users could mistake correlation for proof and feel pressure around habits or mood.
ACCESSIBILITY_IMPACT: Status meaning was compressed into a confidence treatment.
PRIVACY_SECURITY_IMPACT: Sensitive wellbeing inference boundary; no data collection change.
PERFORMANCE_RELIABILITY_IMPACT: None material.
EVIDENCE:
  DIRECT_LOCAL: Formula/copy inspection; counterexample-oriented engine/component/i18n tests.
  DIRECT_RUNTIME: Data-rich rendered state UNVERIFIED.
  AUTHORITATIVE_EXTERNAL: No external source can convert this observational design into causal proof.
  HUMAN_RESEARCH: UNKNOWN
INFERENCE_AND_ALTERNATIVES: Association may be useful, but directionality, confounding, and multiple comparisons remain alternatives.
RECOMMENDATION: Keep average/count disclosure and association language; do not show probability-like confidence.
REJECTION_CRITERION: Any locale reintroduces improves, boosts, causes, or unsupported confidence.
WRITE_SET: Insight engines/renderers/tests and 8 locale dictionaries.
MIGRATION_OR_DATA_EFFECT: No history, aggregation, schema, sync, or backend change.
TEST_FIRST_PROOF: Causal output and presentation were reproduced before the bounded rewrite; focused suites passed after it.
ACCEPTANCE_CRITERIA: Copy is observational, sample basis is available, and sparse/counterexample cases do not overclaim.
ROLLBACK: Only after an appropriate causal design and calibrated measure exist.
VERIFICATION: Engine/reflection/shared-card/Habits suites and locale checks passed.
STATUS: FIXED
```

## Final conclusion

The late findings above do not weaken the bounded fixes: each
finding-registered, high-confidence problem in the actually inspected scope
that was safely remediable without changing protected production data, backend
state, auth/session storage semantics, release configuration, or unrelated
work was implemented and rerun. This is not an exhaustiveness claim: the
missing hash-bound requirement/closure map remains a blocker. Items left
`BLOCKED`, `OPEN`, or `UNVERIFIED` name the authority or evidence that is still
missing; they are not presented as silently fixed.

`HUMAN_ACCEPTANCE: UNVERIFIED`

`FINAL STATUS: STOP` for whole-product/release readiness.

`GO_FOR_PROVEN_SCOPE` for the explicitly verified remediations and runtime
states in this report.
