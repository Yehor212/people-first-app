# ZenFlow UI-System Conformance Contract

Date: 2026-07-28
Status: Canonical source of truth
Subject baseline: `e5016f156497a9d3e55578b773294bf56adce58e`
Applies to: Web/Vite, installed PWA, Android/Capacitor, iOS/WKWebView, Desktop/Tauri
Human acceptance: `UNVERIFIED`

## 1. Authority, Scope, And Evidence Boundary

This document is the one normative ZenFlow grammar for UI foundations, shared
components, cross-feature patterns, platform adaptation, and visual-governance
decisions. It does not replace business, storage, sync, authentication,
privacy, native-shell, canonical-orb, or logo contracts.

The bounded Settings behavior and information architecture remain specified in
`docs/superpowers/specs/2026-07-12-settings-simplification-live-apply-design.md`.
This contract imports that bounded Settings contract by reference. The Settings
document decides Settings-specific jobs and behavior; this document decides the
foundations and shared components used to express them.

Authority order for conflicts:

1. safety, accessibility, store, privacy, auth, sync, and data-integrity
   requirements;
2. the applicable current repository behavior contract;
3. the bounded feature specification for feature jobs, information
   architecture, behavior, persistence, and consequences;
4. this shared UI-system contract for visual grammar, shared component
   anatomy, and presentation;
5. native expectations for the affected platform;
6. a measured runtime result;
7. a reversible product choice with a stated rollback trigger.

The domains in steps 3 and 4 are complementary, not an override chain. A
shared visual rule cannot change a Settings save boundary, auth/sync owner,
destructive consequence, permission timing, or navigation destination. A
feature specification cannot create a parallel shared token/component system.
An unresolved cross-domain conflict is `ASK`, not a preference-based choice.

### 1.1 Non-ownership invariants

- `src/pages/Index.tsx` remains the app-shell orchestration owner.
- In the active V2 entry, `src/components/navigation-v2/NavV2Orchestrator.tsx`
  mounts `V2MindfulMomentLayer` and `V2ProgressionModalLayer`; each feature or
  shared dialog/sheet remains responsible for exactly one explicit dismissal
  and Android Back owner.
- `src/components/ModalLayer.tsx` and `src/components/OverlayLayer.tsx` are
  retained legacy V1 aggregates with no current production importer. They are
  not the active V2 mounting authority and must not be treated as one by a UI
  migration.
- Existing Zustand stores, hydration bridges, IndexedDB/Dexie local truth,
  auth/sync owners, and native platform adapters remain unchanged by
  presentation migrations.
- `src/pages/nav-v2/SettingsPage.tsx` retains Settings destination, history,
  focus-restoration, and compact/wide navigation ownership.
- The UI system may supply presentation and interaction primitives; it must not
  introduce a design-system store, a second persistence path, or a duplicate
  modal/Back/navigation owner.

This contract records intended conformance. It does not claim that current
runtime conforms. The 2026-07-28 audit register keeps twelve migrations open,
and all 517 broad requirement assessments remain `UNVERIFIED`.

Evidence classes retain their audit meanings: `DIRECT_LOCAL`,
`DIRECT_RUNTIME`, `AUTHORITATIVE_EXTERNAL`, `HUMAN_RESEARCH`, `INFERENCE`, and
`UNKNOWN`. A browser screenshot is Web-browser evidence only. It is never
Android, iOS, installed-PWA, Tauri, assistive-technology, or human-acceptance
proof.

### RULE_RECORD

Every new normative rule or exception added to this contract must state:

- Applicability:
- Local evidence:
- Tradeoff:
- Rejection criterion:
- Verification path:

Rules without those five fields are proposals, not accepted contract. An
exception must additionally name an `Exception owner`, an `Expiry or recheck
trigger`, the exact affected files/surfaces, and rollback. No silent waiver is
allowed.

## 2. Foundations

### 2.1 Current source map

| Concern              | Current source                                                      | Authority and current status                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DTCG token values    | `src/design-tokens/tokens.json`                                     | Numeric source for emitted color and typography families; spacing, radius, shadow, motion, and z-index entries are placeholders and do not prove runtime adoption. |
| Token generation     | `src/design-tokens/sd.config.mjs`                                   | Style Dictionary source-to-generated contract.                                                                                                                     |
| Generated values     | `src/generated/tokens.css`, `src/generated/tokens.ts`               | Build outputs; never hand-edit.                                                                                                                                    |
| Runtime theme bridge | `src/index.css`, `src/styles/themes.css`, `tailwind.config.ts`      | Transitional HSL/Tailwind runtime authority until the generated-token migration closes. No new parallel theme family is permitted.                                 |
| Fonts                | `src/styles/fonts.css`, typography tokens, `tailwind.config.ts`     | Self-hosted Latin/Cyrillic assets plus system fallback for uncovered scripts.                                                                                      |
| Effective motion     | `src/hooks/useShouldAnimate.ts`, `src/App.tsx`, `src/lib/motion/**` | Shared runtime decision path; feature code must not create another authority.                                                                                      |
| Shared controls      | `src/components/ui/**`                                              | Existing shadcn/Radix-derived primitives; canonical only after meeting this contract.                                                                              |
| Settings primitives  | `src/pages/nav-v2/settings/components/**`                           | Feature-level migration source, not a second global component system.                                                                                              |
| Safe area and layers | `src/index.css`, overlay primitives, platform contracts             | Transitional runtime source; literal layers must converge on named roles.                                                                                          |
| Icons                | `lucide-react`, canonical ZenFlow assets, asset ledger              | Lucide for utility actions; original governed assets for expression.                                                                                               |

### 2.2 Foundation rule records

#### FND-01 — one generated-token pipeline

- Applicability: Every new or changed shared color, typography, spacing, size,
  radius, elevation, opacity, motion, icon-box, container, or layer role.
- Local evidence: `src/index.css` imports `src/generated/tokens.css`;
  `src/design-tokens/sd.config.mjs` emits CSS and TypeScript from
  `src/design-tokens/tokens.json`.
- Tradeoff: The repository currently has a documented dual-token bridge, so
  migration must be incremental rather than a broad rewrite.
- Rejection criterion: A raw value creates a new semantic role, a generated
  file is hand-edited, or a second token generator/runtime theme family is
  introduced.
- Verification path: `npm run tokens:build`, generated-diff review, typecheck,
  theme tests, visual guards, and production build.

#### FND-02 — semantic roles before screen values

- Applicability: Shared and feature UI across every theme and platform.
- Local evidence: `src/design-tokens/tokens.json` already exposes paired
  surface roles; finding `UI-4` in
  `docs/audits/experience-quality/ui-findings-2026-07-28.md` shows current
  guards do not yet enforce containment/material drift.
- Tradeoff: A bounded expressive scene may need a feature role that ordinary
  utility UI must not reuse.
- Rejection criterion: A screen-specific color, radius, shadow, or spacing
  value substitutes for an existing semantic role without an approved
  exception record.
- Verification path: token inventory, UI-system guard report, component-state
  preview, same-state theme screenshots, and computed-style inspection.

#### FND-03 — logical geometry

- Applicability: Layout, spacing, safe areas, directional icons, motion, and
  text in all eight shipped locales.
- Local evidence: the repository ships `en`, `uk`, `es`, `de`, `fr`, `ja`,
  `ar`, and `he`;
  `docs/audits/experience-quality/ui-baseline-manifest-2026-07-28.json`
  records retained Arabic captures as Web-browser evidence only.
- Tradeoff: Physical coordinates remain valid for non-directional device
  geometry such as viewport coordinates or canvas math.
- Rejection criterion: A physical left/right rule changes reading order,
  clips Arabic/Hebrew, or mirrors a non-directional icon.
- Verification path: i18n checks, RTL static guard, `ar`/`he` runtime at compact
  and wide widths, and mixed-direction user-content checks.

## 3. Semantic Color Pairs And Theme Recipes

Canonical pairs are:

| Surface or state role         | Required foreground/partner             | Meaning boundary                                              |
| ----------------------------- | --------------------------------------- | ------------------------------------------------------------- |
| `background`                  | `foreground`                            | Page canvas and default text.                                 |
| `card` / group surface        | `card-foreground`                       | One meaningful contained entity or group.                     |
| `popover`                     | `popover-foreground`                    | Transient non-modal overlay content.                          |
| `primary`                     | `primary-foreground`                    | Current task emphasis; not a decorative tint.                 |
| `secondary`                   | `secondary-foreground`                  | Lower-emphasis action or surface.                             |
| `muted`                       | `muted-foreground`                      | Supporting information; never the only disabled explanation.  |
| `accent`                      | `accent-foreground`                     | Selection or compact emphasis, not every surface.             |
| `destructive`                 | `destructive-foreground`                | Destructive action or error consequence only.                 |
| `border` / `input`            | `ring` or named focus role              | Non-text boundary and focus distinction.                      |
| success, warning, error, info | paired on-state text plus non-color cue | Status must include text, icon, shape, or programmatic state. |

Theme recipes:

- Paper uses the shipped Paper semantic bridge and `color-scheme: light`.
- Ink uses the shipped warm-dark role set and `color-scheme: dark`.
- OLED uses true-black page background, distinct near-black group surfaces,
  and non-color separation; it must not collapse every layer to black.
- System resolves to Paper or Ink using the existing theme-store/platform
  behavior. It is not a fourth visual recipe.
- High contrast overrides semantic foreground, border, input, ring, and focus
  roles across the app. It must not be a Settings-only preview.
- Forced colors must preserve control identity, focus, selection, and
  destructive meaning even when authored shadows and fills disappear.

#### COLOR-01 — paired semantic colors

- Applicability: Text, controls, borders, icons, charts, overlays, and status
  across Paper, Ink, OLED, System, high contrast, and forced colors.
- Local evidence: paired roles exist in `src/design-tokens/tokens.json` and
  theme bridges exist in `src/styles/themes.css`.
- Tradeoff: Composited alpha and blur can make token-level contrast differ from
  effective runtime contrast.
- Rejection criterion: Any meaning relies only on hue, a foreground lacks its
  paired background, or contrast is asserted from source values without
  checking the composited state.
- Verification path: generated contrast tests, browser computed colors,
  forced-colors inspection, and platform screenshots for applicable states.

#### COLOR-02 — restrained material

- Applicability: Utility pages, grouped lists, forms, navigation, and overlays.
- Local evidence: findings `UI-1` through `UI-4` in the canonical findings
  register identify repeated border/background/shadow/material combinations in
  Settings.
- Tradeoff: Warning, recovery, selected, drag, and transient overlay states can
  require stronger separation.
- Rejection criterion: A normal utility layer combines tinted background,
  border, rim highlight, blur, and drop shadow without a distinct semantic
  need.
- Verification path: containment/material guard, computed-style inventory, and
  before/after same-state screenshots.

## 4. Typography And Localization Fallback

Canonical type roles:

| Role      | Default family                               | Allowed use                                                               |
| --------- | -------------------------------------------- | ------------------------------------------------------------------------- |
| display   | `typography.family.display`                  | Bounded expressive or top-level identity moments, not form labels.        |
| heading   | display or body semibold                     | Page and section hierarchy; one page title.                               |
| title     | body semibold                                | Group, row, dialog, and card titles.                                      |
| body      | `typography.family.body`                     | Main UI and reading text.                                                 |
| label     | body medium/semibold                         | Controls and short metadata labels.                                       |
| caption   | body regular                                 | Supporting facts; never critical information solely at the smallest size. |
| status    | body medium                                  | Loading, saving, error, offline, sync, and recovery truth.                |
| code/data | `typography.family.mono` or tabular numerals | Technical identifiers and comparable numeric columns only.                |

The shipped self-hosted fonts cover Latin and Cyrillic through Fraunces,
Literata, Inter, and Caveat. Japanese, Arabic, and Hebrew rely on the trailing
system fallback unless a separately licensed, measured asset is approved.
Therefore a Latin/Cyrillic screenshot cannot prove fallback quality for those
scripts.

Text must wrap by default. Truncation needs a discoverable full value and must
not hide action, status, owner, date, unit, or consequence. User content uses
safe bidi isolation. Dates, durations, percentages, numbers, and plurals use
the locale formatter rather than string concatenation.

#### TYPE-01 — role and fallback integrity

- Applicability: All visible text and chart labels.
- Local evidence: `src/design-tokens/tokens.json`,
  `src/styles/fonts.css`, and the eight language modules.
- Tradeoff: System fallback metrics vary by OS and can change line breaks.
- Rejection criterion: A display face is used to decorate an ordinary form,
  text clips at 200% zoom/app font scale, or an uncovered script is declared
  visually verified without platform evidence.
- Verification path: font-load receipt, long-content preview, 200% zoom,
  largest app text, and `ja`/`ar`/`he` runtime per available platform.

## 5. Spacing, Size, Radius, Border, And Material

The current generated token file does not yet contain real spacing, radius,
shadow, motion, or z-index values: those families remain `_placeholder`
entries. Until a reviewed foundation migration closes them, existing runtime
values in `src/index.css`, `tailwind.config.ts`, and canonical primitives are
transitional evidence, not permission to add more arbitrary values.

The canonical spacing scale is the smallest set retained after the reviewed
raw-value inventory and migration. It must include semantic aliases for page
inline gutter, page block start/end, section gap, group gap, row block/inline
padding, control gap, icon-text gap, and overlay safe-area inset. No “8px
grid” claim is accepted until the inventory and reflow matrix show it fits
current content.

Named optical exceptions are allowed only for visible glyph centering,
baseline correction, or safe-area/device geometry. Each optical exception
records component, value, reason, owner, theme/locale scope, screenshot, and
recheck trigger. Optical adjustment must not change the hit target or focus
geometry.

### CONTAINMENT_BUDGET

For a normal utility flow, the maximum intended stack is:

1. page background
2. one group surface
3. one semantic nested control
4. one transient overlay

The semantic nested control is an input, selected segment, warning/recovery
panel, dependent disclosure, chart plot, or another independently stateful
entity. It is not a decorative wrapper around every row.

Rows inside one group use spacing and separators aligned to the text column.
One normal layer uses the minimum sufficient combination of background,
border, separator, elevation, opacity, and material. A nested bordered or
elevated card requires a distinct entity, dependent state, warning, recovery,
or destructive boundary.

Flattening rejection criteria:

- flattening may not weaken focus visibility;
- flattening may not weaken status comprehension;
- flattening may not weaken destructive safety;
- flattening may not weaken high-contrast separation;
- flattening may not merge separately scrollable, selectable, editable, or
  recoverable entities;
- a divider is rejected when reflow makes it appear attached to the wrong row.

#### SPACE-01 — finite geometry

- Applicability: All CSS, Tailwind classes, component variants, and native
  wrapper dimensions changed by UI remediation.
- Local evidence:
  `docs/audits/experience-quality/ui-system-inventory-2026-07-28.md` records
  the source inventory; current token placeholder families prove the scale is
  not yet generated end to end.
- Tradeoff: Consolidation can cause reflow and change optical balance.
- Rejection criterion: A new one-off value lacks an exact semantic or optical
  record, or consolidation clips content, focus, error, or safe area.
- Verification path: raw-value inventory diff, 320px/200% reflow, RTL,
  software-keyboard, and container screenshots.

## 6. Focus, Targets, Safe Areas, Containers, And Layers

- Web/PWA interactive targets have a project floor of 44 CSS px.
- Android targets have a 48dp verification target.
- iOS targets have a 44×44pt verification target.
- Desktop may use visually denser rows only when pointer and keyboard targets
  remain operable and the shared component has a documented density variant.
- Focus order follows visual/task order. Focus is never removed without a
  visible replacement and is restored after a dialog, sheet, or detail exit.
- `--safe-top`, `--safe-bottom`, `--safe-left`, and `--safe-right` are the
  existing safe-area bridge. New layout uses logical inline/block aliases.
- Compact layout is content-led single-pane navigation. Wide Settings uses
  adaptive list-detail with a readable content maximum, not a stretched mobile
  form. A breakpoint is accepted only where content behavior changes, not as a
  device-name proxy.
- Layer roles are content, navigation, floating action, dropdown/sticky,
  sheet overlay/content, modal overlay/content, lock, system, celebration,
  toast, and skip link. Components consume named roles; they do not invent a
  higher literal z-index to win a local stacking conflict.
- Every open overlay has exactly one explicit Android Back owner. A shared
  Radix wrapper does not implicitly prove native Back ownership. Double
  registration between a feature, overlay layer, and central fallback is
  forbidden.

Current migration debt, not permitted density or styling:

- `src/components/ui/input.tsx` exposes `inputSize="sm"` at 36px;
- `src/components/ui/card.tsx` can add pointer/hover affordance to a `div`
  without supplying button/link semantics;
- `src/components/ui/textarea.tsx` uses a radius that diverges from the shared
  field geometry;
- `src/components/ui/section-header.tsx` maps two variants to raw blue/rose
  utility colors instead of semantic roles;
- `src/components/ui/sheet.tsx` uses physical `right-4`, a hardcoded violet
  focus ring, literal safe-area access, and a literal bottom-sheet layer.

The Web/PWA and Tauri web-content target floor remains 44 CSS px at every
width. The remaining 36px value is open migration debt, not an approved
desktop density variant. Any exception would need the full exception process
and a non-overlapping operable target proof.

Closed foundation divergence (UI-15, 2026-07-29):

- `--touch-target-min` now remains at least 44 CSS px across the declarations
  in `src/index.css`;
- `.modal-backdrop` consumes the declared `--z-modal-overlay` role;
- one unlayered global `:focus-visible` fallback remains after Tailwind's
  layered utilities, so `outline-none` cannot silently remove the only visible
  indicator from raw interactive fields;
- the canonical source contract and the hash-bound local production-dist
  Chromium receipt cover this bounded closure. Installed PWA, Android, iOS,
  Tauri, assistive technology, and human acceptance remain `UNVERIFIED`.

#### INTERACTION-01 — visible focus and reachable target

- Applicability: Every button, link, row action, field, toggle, slider,
  disclosure, menu item, chart interaction, and dismissal.
- Local evidence: shared primitives already contain focus-visible and 44px
  patterns; `docs/audits/experience-quality/ui-state-coverage-2026-07-28.md`
  does not establish exhaustive runtime conformance.
- Tradeoff: A large invisible hit area can create accidental activation or
  overlap adjacent controls.
- Rejection criterion: Focus is clipped/obscured, target geometry overlaps a
  sibling, a whole row is clickable while containing a separate nested action,
  or native target floors are inferred from CSS pixels.
- Verification path: semantic component tests, keyboard traversal, pointer and
  touch runs, focus screenshots, and native accessibility inspection.

## 7. Motion And Transparency

`useShouldAnimate()` is the effective motion source for React feature code.
`MotionConfig` in `src/App.tsx` propagates its decision to Framer Motion.
CSS `prefers-reduced-motion` is a second defensive layer, not a parallel user
preference. Battery/runtime degradation can reduce optional motion; it must not
hide content, skip persistence, or change semantics.

Reduced motion:

- removes non-essential spatial travel, bounce, parallax, blur tween, and
  looping decoration;
- preserves immediate state, progress, focus, and screen-reader updates;
- uses a stable static fallback for the canonical orb rather than replacing
  `ValenceOrb` or `MiniValenceOrb`;
- does not delay dismissal or Android Back deduplication.

Reduced transparency/high contrast uses solid-enough semantic surfaces. A
backdrop blur requires the WebKit form and a readable no-blur fallback.

#### MOTION-01 — state before animation

- Applicability: Page transitions, disclosures, menus, dialogs, sheets,
  progress, celebration, orb, and theme changes.
- Local evidence: `src/hooks/useShouldAnimate.ts`, `src/App.tsx`,
  `src/lib/motion/**`, and `scripts/check-visual-guards.ts`.
- Tradeoff: Zero-duration exits can remove visual continuity, but delayed
  semantics are a larger accessibility and reliability failure.
- Rejection criterion: Content remains focusable after visual exit, reduced
  motion changes the committed result, or animation masks latency/error.
- Verification path: reduced-motion component tests, interruption tests,
  keyboard/focus restoration, runtime performance trace, and visual comparison.

## 8. Iconography And Expressive Assets

Utility/action icons use the existing Lucide family unless the platform
requires a system-owned glyph. The default optical box is 16px inside compact
text rows, 20px in standard actions, and 24px only where the component registry
defines that size. The interactive target remains independent of icon size.

An icon is `aria-hidden` when adjacent text supplies the name. An icon-only
control has a localized accessible name and tooltip only when the tooltip adds
needed discovery. Directional icons mirror only when direction is part of
meaning. External-link marks, chevrons, status icons, switches, and actions are
not interchangeable.

Expressive assets are limited to top-level feature identity, onboarding, empty
states, celebrations, habits/achievements, and canonical orb/leaf experiences.
They require the asset-ledger provenance fields: asset ID, path, author/owner,
license, purpose, platform/surface, viewBox/size, paint language, optical
adjustment, RTL rule, accessibility treatment, theme variants, reduced-motion
fallback, budget, evidence, and disposition.

No competitor asset, emoji substitute, handcrafted approximate SVG, generic
wellness blob, decorative sparkle, or copied visual is accepted.

#### ICON-01 — utility/expressive separation

- Applicability: Every new or changed visible icon, illustration, Lottie, logo,
  orb, splash, or store asset.
- Local evidence: Settings currently imports Lucide;
  `docs/audits/experience-quality/ui-system-inventory-2026-07-28.md` records
  207 eligible asset records; canonical orb and logo contracts remain
  protected.
- Tradeoff: Removing a decorative chip may reduce immediate color recognition;
  a label/state cue must remain sufficient.
- Rejection criterion: Provenance is missing, icon families mix without a
  platform reason, semantics rely on an unlabeled glyph, or orb/logo geometry
  changes outside its protected protocol.
- Verification path: asset ledger validator, icon a11y audit, theme/RTL
  screenshots, asset budgets, canonical-orb check, and logo protocol checks.

## 9. Canonical Component Contract

The following is the registry. A row does not claim the current source already
conforms. “Proof type” states the minimum closure evidence. Shared component
owners migrate behavior once; screens consume the result rather than cloning
local CSS.

| ID                    | Canonical source/anatomy                                                                          | Allowed variants and impossible combinations                                                       | Migration owner                         | Proof type           | Platform deviation                                         |
| --------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------- | -------------------- | ---------------------------------------------------------- |
| PAGE                  | `SettingsPageComponents` pattern pending shared extraction; title, optional back, content, status | Compact/wide; no nested page card or multiple page titles                                          | UI foundations owner                    | AUTOMATED_AND_MANUAL | Safe area and window layout vary                           |
| SECTION               | Shared semantic section; heading, optional description, content                                   | Quiet/grouped; no heading simulated by bold `div`                                                  | UI foundations owner                    | AUTOMATED_AND_MANUAL | Native heading navigation checked separately               |
| GROUP                 | Shared group surface; rows/fields, aligned separators                                             | Plain, selected, warning, recovery; no decorative card-in-card                                     | UI foundations owner                    | AUTOMATED_AND_MANUAL | High contrast may replace material with solid boundary     |
| LIST_ROW              | Shared row; optional leading, text column, trailing affordance                                    | Navigation, disclosure, status, compact action; switch plus navigation is forbidden                | Shared interaction owner                | AUTOMATED_AND_MANUAL | Android/iOS target floors differ                           |
| SETTINGS_ROW          | Settings specialization imported from the bounded Settings spec                                   | Toggle, navigation, value, external, status; chevron without navigation forbidden                  | Settings information-architecture owner | AUTOMATED_AND_MANUAL | Wide list-detail keeps selected state                      |
| BUTTON                | `src/components/ui/button.tsx`; label, optional icon, status                                      | Primary, secondary, quiet, destructive, icon-only; loading plus enabled duplicate submit forbidden | Shared interaction owner                | AUTOMATED_AND_MANUAL | Native haptic is optional and platform-owned               |
| ICON_BUTTON           | Button icon-only variant with accessible name                                                     | Default, quiet, destructive; unlabeled icon forbidden                                              | Shared interaction owner                | AUTOMATED_AND_MANUAL | Tooltip is desktop/pointer aid, not the name               |
| LINK                  | Native anchor/router link with label and destination                                              | Inline, quiet, external; button styling for non-navigation forbidden                               | Navigation owner                        | AUTOMATED_AND_MANUAL | External handoff differs by platform                       |
| FIELD                 | Existing input/textarea/time primitives; label, control, help/error                               | Default, disabled, loading, error, success; placeholder-only label forbidden                       | Forms owner                             | AUTOMATED_AND_MANUAL | Keyboard/autofill/input mode vary                          |
| SELECTION_CONTROL     | Switch, checkbox, radio, slider, segmented control                                                | Binary switch, multi checkbox, exclusive radio/segment; switch that navigates forbidden            | Forms owner                             | AUTOMATED_AND_MANUAL | Native semantics/target floor checked separately           |
| STATUS                | Live text plus optional icon/action                                                               | Loading, saving, success, warning, error, offline, pending sync                                    | Recovery and feedback owner             | AUTOMATED_AND_MANUAL | Announcement APIs vary                                     |
| DIALOG                | Radix alert/dialog primitive; title, description, body, actions, close                            | Modal/alert; non-modal background focus or unowned dismissal forbidden                             | Overlay owner                           | AUTOMATED_AND_MANUAL | Android Back and native keyboard required                  |
| SHEET                 | Radix sheet primitive; drag-independent content, title, body, close                               | Bottom/side; sheet inside dialog without owner forbidden                                           | Overlay owner                           | AUTOMATED_AND_MANUAL | Safe area and Android Back required                        |
| MENU_POPOVER_TOOLTIP  | Transient positioned surface with trigger and roving/focus contract                               | Menu, popover, tooltip; critical info available only on hover forbidden                            | Overlay owner                           | AUTOMATED_AND_MANUAL | Touch does not depend on hover                             |
| TOAST_SNACKBAR_BANNER | Non-modal feedback with live-region policy                                                        | Transient status, persistent blocking banner; critical error only in expiring toast forbidden      | Recovery and feedback owner             | AUTOMATED_AND_MANUAL | Native announcement timing differs                         |
| EMPTY_ERROR_OFFLINE   | Honest state, explanation, next action, optional original asset                                   | First use, filtered empty, unavailable, offline, retry, recovery                                   | Recovery and feedback owner             | AUTOMATED_AND_MANUAL | Installed-PWA/native recovery differs                      |
| NAVIGATION            | Existing V2 shell; destinations, selected state, back/history                                     | Bar, rail, drawer, list-detail; duplicate Back owners forbidden                                    | Navigation owner                        | AUTOMATED_AND_MANUAL | Browser history, Android Back, iOS gesture, Tauri keyboard |
| CHART_DATA_VIEW       | Chart plus period/unit/legend/summary/table alternative                                           | Trend, distribution, progress; synthetic metric or color-only series forbidden                     | Statistics owner                        | AUTOMATED_AND_MANUAL | Touch, keyboard, screen reader exploration differ          |

The bounded Settings detail specialization currently maps this registry as
follows:

- `PanelFrame` owns the external heading plus exactly one
  `data-slot="settings-group"` surface. The section shell has no decorative
  border, tint, shadow, rim, or clipping boundary.
- `ToggleRow` is a flat `data-containment="row"` with one Switch owner. It does
  not become a navigation row and does not duplicate switch activation.
- `SettingsInset` defaults to a flat row. `emphasis="callout"` creates an
  explicit neutral callout; `danger` and `success` tones always resolve to
  callout containment even if a caller omits the emphasis.
- `ActionButton` and `SettingsChoiceButton` retain border, background,
  selection/pressed semantics, target size, and focus ring without decorative
  elevation. Their callbacks and save-selection semantics remain feature-owned.
- `SettingsInsetButton` has no production consumer in the Task 9 inventory and
  is not silently promoted as a canonical action; it remains migration debt
  until a real user job selects or removes it.

These statements are a source/component contract, not native runtime proof.
Installed PWA, Android, iOS, Tauri, assistive-technology, and human-acceptance
status remain separately evidenced or `UNVERIFIED`.

#### COMPONENT-01 — one behavior owner

- Applicability: Every registry component and its feature specializations.
- Local evidence:
  `docs/audits/experience-quality/ui-system-inventory-2026-07-28.md` classifies
  439 production TSX files; migration `MIG-1` in the canonical migration
  manifest owns shared Settings presentation.
- Tradeoff: A platform adapter can wrap the shared contract when native
  behavior differs; it must not fork data semantics.
- Rejection criterion: A screen adds a local near-duplicate solely for visual
  variation, or two layers own dismissal, save, success, or navigation state.
- Verification path: component inventory diff, registry preview, focused
  behavior tests, platform matrix, and duplicate-component guard.

All registry components must cover applicable default, hover, focus-visible,
pressed, selected, checked, disabled, loading, success, warning, error,
destructive, offline, permission-blocked, pending-sync, long-content, RTL,
high-contrast, reduced-motion, and recovery states. `N/A` requires a reason;
missing proof is `UNVERIFIED`.

## 10. Canonical Pattern Contract

| ID                           | Canonical contract                                                                                | Forbidden combination                                          | Migration owner                         | Proof type           | Platform deviation                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------- | -------------------- | ---------------------------------------------- |
| GROUPED_SETTINGS_LIST        | External section label, one group, stable rows, text-aligned separators                           | Card around every row; switch plus chevron                     | Settings information-architecture owner | AUTOMATED_AND_MANUAL | Wide layout uses list-detail                   |
| FORM                         | Visible labels, preserved input, field-linked errors, explicit commit only when semantics require | Placeholder label; fake saved status; data loss on retry       | Forms owner                             | AUTOMATED_AND_MANUAL | Autofill and software keyboard vary            |
| NAVIGATION                   | Destination, selected state, history/back, focus/scroll restoration                               | Dead end; duplicate route owner; stale focusable exit          | Navigation owner                        | AUTOMATED_AND_MANUAL | Browser/native/window semantics vary           |
| DIALOG_SHEET                 | One overlay owner, trapped/restored focus, back/escape/cancel, inert background                   | Nested modal without explicit dependency; clipped focus        | Overlay owner                           | AUTOMATED_AND_MANUAL | Android Back and iOS/Tauri window behavior     |
| ASYNC_FEEDBACK               | Pending, confirmed success, error, rollback/retry, deduplication                                  | Optimistic success without rollback; expiring critical error   | Recovery and feedback owner             | AUTOMATED_AND_MANUAL | Network/lifecycle interruption varies          |
| EMPTY_ERROR_OFFLINE_RECOVERY | Honest provenance-free state, cause boundary, available next action                               | Fabricated records; infinite spinner; false preservation claim | Recovery and feedback owner             | AUTOMATED_AND_MANUAL | PWA/native recovery entry points differ        |
| DESTRUCTIVE_CONFIRMATION     | Consequence, scope, owner binding, confirmation, recovery limit                                   | Destructive action mixed with ordinary preferences             | Account and data-safety owner           | AUTOMATED_AND_MANUAL | Native auth/system confirmation may add a step |
| PERMISSION_REQUEST           | Just-in-time explanation, system request, denial recovery, system-settings handoff                | Permission at startup without user job; false success          | Platform capability owner               | AUTOMATED_AND_MANUAL | Native-only capability                         |
| LIST_DETAIL                  | One destination model, compact push, wide simultaneous context, state restoration                 | Stretched mobile form; mismatched overview/detail title        | Navigation owner                        | AUTOMATED_AND_MANUAL | Desktop/tablet only when width supports it     |
| CHART                        | Period, units, scale, missing/stale data, redundant encoding, text/table summary                  | Decorative precision; synthetic metric; color-only meaning     | Statistics owner                        | AUTOMATED_AND_MANUAL | Input/exploration model varies                 |

The Settings row anatomy, immediate-apply boundaries, and destructive/data
exceptions are imported from the bounded Settings specification. This document
does not restate or fork them.

#### PATTERN-01 — truthful state transitions

- Applicability: Forms, async save, permission, recovery, navigation,
  destructive actions, charts, ads/consent, auth, sync, and data transfer.
- Local evidence: the canonical findings register records `UI-7` and `UI-8`
  for the static offline syntax/locale defect and false preservation/sync
  wording; `UI-9` records remediated explicit Back ownership while retaining
  native runtime and assistive-technology gaps as `UNVERIFIED`.
- Tradeoff: Truthful unavailable/error states can look less “complete” than
  invented success or content.
- Rejection criterion: A UI claims saved, synced, preserved, authorized, or
  recovered before the authoritative operation confirms it.
- Verification path: negative-control tests, offline/error/retry runtime,
  lifecycle interruption, duplicate activation, and storage/auth/sync
  contract checks.

## 11. Platform Adaptation Matrix

| Contract area      | Web/PWA                                                | Android/Capacitor                                          | iOS/WKWebView                                   | Desktop/Tauri                              |
| ------------------ | ------------------------------------------------------ | ---------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------ |
| Navigation         | Browser history, keyboard, installed-PWA launch/update | System Back, appUrlOpen, process resume                    | Back gesture/scene URL, WKWebView resume        | Keyboard shortcuts, window/menu            |
| Targets            | 44 CSS px project floor                                | 48dp verification target                                   | 44×44pt verification target                     | Pointer plus keyboard; bounded density     |
| Safe area/keyboard | viewport, zoom, virtual keyboard                       | edge-to-edge, SystemBars, IME                              | notch/home indicator, Dynamic Type keyboard     | resize, min/max window, title/menu         |
| Permissions        | Capability shown only if actionable                    | Runtime permission plus settings handoff                   | Native prompt plus settings handoff             | OS-specific or `N/A` with reason           |
| Feedback           | ARIA live region and visible status                    | Web semantics plus native lifecycle/haptic where justified | VoiceOver and lifecycle; haptic where justified | Screen reader and window focus             |
| Offline/update     | Service worker cache/update/reconnect                  | Web bundle plus native network/process lifecycle           | Web bundle plus WKWebView lifecycle             | Bundled assets, updater, sleep/wake        |
| Visual proof       | Browser engine, viewport, DPR recorded                 | Emulator/device/build identity required                    | Simulator/device/build identity required        | Packaged runtime, OS, window size required |

Shared React code does not prove native contracts. Each platform result is
`PASS`, `FAIL`, `N/A` with reason, or `UNVERIFIED` with blocker.

#### PLATFORM-01 — shared semantics, native behavior

- Applicability: Any UI reachable in more than one runtime.
- Local evidence: `ARCHITECTURE.md`, `docs/CROSS_PLATFORM_RELEASE.md`, and
  `docs/audits/experience-quality/ui-baseline-manifest-2026-07-28.json`
  provenance marked `WEB_BROWSER_ONLY`.
- Tradeoff: Native proof increases setup and matrix cost.
- Rejection criterion: A Chromium screenshot, Capacitor web build, or unit test
  is presented as native permission, Back, keyboard, lifecycle, notification,
  haptic, window, or store proof.
- Verification path: exact-build browser run, installed PWA, Android
  emulator/device, iOS simulator/device if available, and packaged Tauri.

## 12. Accessibility And Localization Contract

Web/PWA targets WCAG 2.2 AA for applicable criteria. Automation is a defect
finder, not full-conformance proof.

### 12.1 WCAG_SC_AND_LEVEL

The core applicable conformance map is:

| Success criterion                   | Level | ZenFlow applicability                                                                                    |
| ----------------------------------- | ----- | -------------------------------------------------------------------------------------------------------- |
| 1.3.1 Info and Relationships        | A     | Headings, labels, groups, tables, charts, and status structure                                           |
| 1.3.2 Meaningful Sequence           | A     | DOM/focus order and responsive rearrangement                                                             |
| 1.4.1 Use of Color                  | A     | Meaning and state are not conveyed by color alone                                                        |
| 1.4.3 Contrast (Minimum)            | AA    | Text and images of text                                                                                  |
| 1.4.4 Resize Text                   | AA    | Text remains usable at 200% resize                                                                       |
| 1.4.10 Reflow                       | AA    | 320 CSS px equivalent and 400% zoom conditions                                                           |
| 1.4.11 Non-text Contrast            | AA    | Controls, boundaries, states, icons, and focus indicators                                                |
| 1.4.12 Text Spacing                 | AA    | User-overridden spacing without clipping/loss                                                            |
| 2.1.1 Keyboard                      | A     | Every Web/PWA and Tauri web-content action                                                               |
| 2.1.2 No Keyboard Trap              | A     | Overlays, editors, charts, and immersive flows                                                           |
| 2.4.3 Focus Order                   | A     | Task/visual order and restoration                                                                        |
| 2.4.7 Focus Visible                 | AA    | Every keyboard-operable element                                                                          |
| 2.4.11 Focus Not Obscured (Minimum) | AA    | Sticky navigation, sheets, dialogs, and virtual keyboard                                                 |
| 2.5.2 Pointer Cancellation          | A     | Activation timing, cancellation, and drag alternatives                                                   |
| 2.5.3 Label in Name                 | A     | Visible control label is represented in its accessible name                                              |
| 2.5.8 Target Size (Minimum)         | AA    | WCAG normative 24 CSS px minimum with its exceptions; ZenFlow keeps the stricter 44 CSS px project floor |
| 3.1.1 Language of Page              | A     | Active locale is exposed on the document                                                                 |
| 3.1.2 Language of Parts             | AA    | Foreign-language passages are identified when applicable                                                 |
| 3.3.1 Error Identification          | A     | Field and operation errors identify the affected item                                                    |
| 3.3.2 Labels or Instructions        | A     | Forms and destructive confirmations                                                                      |
| 3.3.3 Error Suggestion              | AA    | A safe correction is offered when known                                                                  |
| 4.1.2 Name, Role, Value             | A     | Custom/Radix controls and async state                                                                    |
| 4.1.3 Status Messages               | AA    | Loading, saving, success, error, offline, and sync status                                                |

Conditional criteria such as 1.4.13 Content on Hover or Focus, 2.2.2 Pause
Stop Hide, 2.3.1 Three Flashes or Below Threshold, 2.5.1 Pointer Gestures,
2.5.7 Dragging Movements, and 3.3.8 Accessible Authentication are assessed
when the affected pattern supplies that interaction. The product's stricter
reduced-motion behavior is assessed whenever a component can animate. These
criteria are not globally `N/A`.

Required coverage:

- semantic names, roles, states, values, descriptions, landmarks, and heading
  order;
- visible, unobscured focus; logical order; no trap; dialog restoration;
- text and non-text contrast using effective composited colors;
- 200% zoom, reflow, text spacing, largest app font scale, and long content;
- pointer cancellation, target size/spacing, keyboard, touch, mouse, and
  screen-reader operation;
- reduced motion, high contrast, forced colors, and no color-only meaning;
- live announcements for async status without duplicate or expiring critical
  information;
- all eight locale modules with key/placeholders parity;
- Arabic and Hebrew RTL plus mixed-direction user content;
- Japanese line breaking and platform font fallback;
- natural copy without blame, shame, pressure, fake clinical claims, or
  implementation jargon.

### 12.2 AT_DEVICE_MATRIX

| Runtime           | Input or accessibility mode     | Required proof                                                       | Current status and reason                               |
| ----------------- | ------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------- |
| Web/PWA           | Keyboard-only                   | Order, visible/unobscured focus, activation, escape, and restoration | UNVERIFIED — no retained exact-flow keyboard receipt    |
| Web/PWA           | Supported screen reader/browser | Landmarks, names, state/value, live status, and overlays             | UNVERIFIED — no retained AT session                     |
| Web/PWA           | Forced colors/high contrast     | Control identity, boundaries, state, focus, and charts               | UNVERIFIED — no retained forced-colors runtime          |
| Web/PWA           | 200% resize and 320px reflow    | No loss, overlap, clipping, or two-axis scroll                       | UNVERIFIED — source tests do not prove all surfaces     |
| Web/PWA           | Reduced motion                  | Static states, interruption, focus, semantics, and task completion   | UNVERIFIED — no retained whole-flow runtime             |
| Android/Capacitor | TalkBack                        | Order, names, state/value, live status, and dialogs                  | UNVERIFIED — emulator/device AT not run                 |
| Android/Capacitor | Switch Access                   | Reachability, grouping, scanning order, and activation               | UNVERIFIED — emulator/device AT not run                 |
| Android/Capacitor | Voice Access                    | Visible label/name alignment and discoverability                     | UNVERIFIED — emulator/device voice control not run      |
| Android/Capacitor | Font/display size               | Reflow, IME, dialogs, sheets, and 48dp targets                       | UNVERIFIED — native scaling matrix not run              |
| Android/Capacitor | System Back                     | Exactly one owner, dismissal order, deduplication, and restoration   | UNVERIFIED — emulator/device Back matrix not run        |
| iOS/WKWebView     | VoiceOver                       | Rotor/order, names, state/value, live status, and dialogs            | UNVERIFIED — simulator/device AT not run                |
| iOS/WKWebView     | Voice Control                   | Visible label/name alignment and activation                          | UNVERIFIED — simulator/device voice control not run     |
| iOS/WKWebView     | Full Keyboard Access            | Order, activation, escape/dismissal, and restoration                 | UNVERIFIED — simulator/device keyboard run not retained |
| iOS/WKWebView     | Switch Control                  | Reachability, grouping, scanning order, and activation               | UNVERIFIED — simulator/device AT not run                |
| iOS/WKWebView     | Dynamic Type                    | Reflow, keyboard, safe area, dialogs, and 44×44pt targets            | UNVERIFIED — native scaling matrix not run              |
| iOS/WKWebView     | Reduce Motion                   | Static state, interruption, focus, semantics, and completion         | UNVERIFIED — native setting/runtime not run             |
| Desktop/Tauri     | Keyboard-only                   | Window/menu focus, shortcuts, overlays, and restoration              | UNVERIFIED — packaged runtime not run                   |
| Desktop/Tauri     | Packaged-OS screen reader       | Names, order, state/value, live status, and window changes           | UNVERIFIED — packaged AT session not run                |
| Desktop/Tauri     | Zoom/text scaling               | Reflow, target floor, menus, dialogs, and resize                     | UNVERIFIED — packaged scaling matrix not run            |
| Desktop/Tauri     | Forced colors/high contrast     | Native chrome plus web-content identity, state, and focus            | UNVERIFIED — packaged runtime not run                   |
| Desktop/Tauri     | Window resize                   | Narrow/standard/wide layout, scroll, focus, and state retention      | UNVERIFIED — packaged resize matrix not run             |

`LIVED_ACCESSIBILITY: UNVERIFIED`. Component/unit/static tests prove only their
assertions; no row becomes `PASS` without the recorded runtime, build identity,
AT version, input, state, and result.

### 12.3 Locale, RTL, And Bidi Matrix

| Locale | Direction/script risk                      | Required bounded fixture                                  | Native-speaker/cultural status |
| ------ | ------------------------------------------ | --------------------------------------------------------- | ------------------------------ |
| en     | LTR Latin baseline                         | Long labels, dates, plurals, status, and destructive copy | UNVERIFIED                     |
| uk     | LTR Cyrillic                               | Long labels, inflection, dates, and font fallback         | UNVERIFIED                     |
| es     | LTR Latin expansion                        | Long labels, plurals, errors, and compact rows            | UNVERIFIED                     |
| de     | LTR Latin compound expansion               | Compound labels, wrapping, and buttons                    | UNVERIFIED                     |
| fr     | LTR Latin punctuation/spacing              | Numbers, dates, punctuation, and wrapping                 | UNVERIFIED                     |
| ja     | CJK line breaking and system font fallback | Compact/wide line breaks, dates, charts, and input        | UNVERIFIED                     |
| ar     | RTL plus embedded LTR                      | Numerals, dates, URLs, handles, punctuation, and LTR IDs  | UNVERIFIED                     |
| he     | RTL plus embedded LTR                      | Numerals, dates, URLs, handles, punctuation, and LTR IDs  | UNVERIFIED                     |

Arabic and Hebrew mixed-bidi fixtures must use non-personal isolated test
strings and cover numerals, dates, URLs, handles, punctuation, and embedded LTR
identifiers. Japanese requires runtime font and line-break evidence; key parity
alone is insufficient. `NATIVE_SPEAKER_CULTURAL_ACCEPTANCE: UNVERIFIED`.

#### A11Y-I18N-01 — evidence is input- and locale-specific

- Applicability: Every user-visible component, pattern, and state.
- Local evidence: shared reflow/RTL tests exist, but
  `docs/audits/experience-quality/ui-state-coverage-2026-07-28.md` records
  native AT, native-language, and exhaustive locale runtime coverage as
  `UNVERIFIED`.
- Tradeoff: The full matrix is sampled by risk and dependency, while all
  shipped keys still receive deterministic parity checks.
- Rejection criterion: An automated scan is called complete accessibility
  proof, English/LTR is used to infer Arabic/Hebrew/Japanese quality, or copy is
  concatenated from translated fragments.
- Verification path: i18n/translation gates, an explicitly configured and
  approved accessibility scanner, keyboard, screen reader, zoom/reflow,
  RTL/bidi, and bounded native-language review. The repository's transitive
  `axe-core` package is not by itself evidence that an axe scan is configured
  or has run.

## 13. Governance, Generation, And Drift Control

Generation path:

```text
src/design-tokens/tokens.json
  -> src/design-tokens/sd.config.mjs
  -> src/generated/tokens.css + src/generated/tokens.ts
  -> src/index.css / src/styles/themes.css bridge
  -> shared primitives
  -> feature patterns
  -> screens
```

Governance rules:

- Token values change at the source, generated outputs change through
  `npm run tokens:build`, and the diff is reviewed.
- The UI-system contract version changes when a normative rule or registry row
  changes. A copy clarification that changes no requirement does not require a
  new version.
- Shared primitives are migrated before dependent screens unless a P0/P1
  truth/safety defect requires a smaller earlier fix.
- A deprecated primitive remains only for named consumers, owner, removal
  condition, and rollback window. New consumers are forbidden.
- Static guards start report-only with fixtures, positive/negative tests,
  false-positive handling, and a reviewed baseline. Ratcheting into CI requires
  local proof and no silent waiver.
- Visual regression names include runner/platform provenance and subject/build
  identity. Pixel change is detection; human review decides meaning.
- Audit artifacts retain hashes. Generated or captured evidence never proves a
  platform other than the recorded runtime.

#### GOVERNANCE-01 — narrow, testable enforcement

- Applicability: Tokens, component variants, visual guards, previews,
  screenshots, deprecations, and exceptions.
- Local evidence: `UI-4` through `UI-6` in the canonical findings register
  identify missing guard and evidence-matrix coverage; current visual guard has
  three bounded rule families.
- Tradeoff: Report-only rollout allows review but does not yet block drift.
- Rejection criterion: A broad regex gate lacks negative controls, silently
  waives existing debt, or updates snapshots without semantic review.
- Verification path: fixture tests, repository report review, baseline/ratchet
  diff, existing `check:visual`, and CI change review.

## 14. Migration, Deprecation, Exceptions, And Ownership

Migration order is foundations, shared primitives, shared patterns,
high-impact screens, remaining surfaces, then expressive polish. The one
approved deviation is to repair `UI-7` and `UI-8` early because they are P0
truth/recovery defects with a two-file presentation-only write set.

The canonical migration ledger is
`docs/audits/experience-quality/ui-migration-manifest-2026-07-28.md`. A file
outside a migration write set is not edited until the ledger is updated,
validated, and reviewed.

Every migration records:

- finding and user job;
- exact write set and owner;
- dependency order;
- data/auth/sync/platform effect;
- RED evidence and GREEN proof;
- rollback;
- remaining native/public/human blocker.

Exception process:

1. state the failed rule and exact surface;
2. give direct local/runtime evidence and alternatives;
3. identify safety, accessibility, data, privacy, performance, and platform
   effects;
4. name the Exception owner;
5. name the Expiry or recheck trigger;
6. add an automated guard where deterministic;
7. retain rollback and no silent waiver.

#### MIGRATION-01 — behavior boundaries survive presentation work

- Applicability: Every foundation, primitive, pattern, and screen migration.
- Local evidence: the migration ledger explicitly constrains auth, sync,
  IndexedDB, deletion, import/export, and canonical orb behavior.
- Tradeoff: Presentation-only boundaries limit broad cleanup in one wave.
- Rejection criterion: A visual migration changes schema, owner binding,
  persistence, auth, sync, deletion, permission, or deep-link admission without
  its own approved contract and tests.
- Verification path: focused behavior tests, sync/data-integrity/security
  checks where applicable, diff review, runtime state matrix, and rollback
  rehearsal proportionate to risk.

## 15. Verification And Rejection Criteria

Minimum deterministic sequence for changed scope:

1. RED test or documented characterization before production code;
2. scoped implementation;
3. same proof GREEN;
4. typecheck, lint, format, i18n/translation checks where applicable;
5. token build/validation and visual guards where applicable;
6. unit/component/integration tests;
7. production build plus production-data-integrity bundle scan;
8. browser runtime and baseline/after capture for UI changes;
9. applicable Android, iOS, installed-PWA, and Tauri checks;
10. security/privacy/performance checks proportionate to the write set;
11. final diff and artifact-hash review.

Global rejection criteria:

- fake, sample, demo, placeholder, or fallback business records enter
  production runtime;
- success, sync, backup, authorization, preservation, or recovery is claimed
  without authoritative confirmation;
- a visual change weakens semantic HTML/native role, focus, target, contrast,
  state, RTL, reduced motion, or destructive separation;
- a native/public/human claim is inferred from local Chromium;
- a copied asset or unknown-provenance expressive asset is introduced;
- required tests are weakened, skipped without reason, or snapshots are
  accepted without review;
- the final diff contains unrelated user work, secrets, production-derived
  personal data, or an unexplained write-set expansion.

#### VERIFY-01 — bounded completion language

- Applicability: Every audit, implementation, platform, and release verdict.
- Local evidence: the hash-bound baseline, findings, and migration artifacts in
  `docs/audits/experience-quality/` permit bounded remediation but explicitly
  retain native, public, assistive-technology, and human closure as
  `UNVERIFIED`.
- Tradeoff: A product wave can be ready for its proven scope while the whole
  audit remains open.
- Rejection criterion: `PASS`, `fixed`, `complete`, or release readiness is
  used beyond the exact commands, states, inputs, platforms, and artifacts
  freshly verified.
- Verification path: requirement-to-evidence ledger, command receipts, runtime
  matrix, independent closure review, and final residual-risk register.

## 16. Residual Risk And UNVERIFIED Ledger

At contract creation:

- installed-PWA install/update/offline/reconnect lifecycle: `UNVERIFIED`;
- Android/Capacitor runtime, Back, permission, keyboard, notification, haptic,
  background/resume, and low-end-device behavior: `UNVERIFIED`;
- iOS/WKWebView runtime, VoiceOver, Dynamic Type, permission, keyboard,
  notification, background/termination behavior: `UNVERIFIED`;
- packaged Desktop/Tauri window, menu, keyboard, updater, sleep/wake, and
  export behavior: `UNVERIFIED`;
- non-Chromium Web engines and native assistive technology: `UNVERIFIED`;
- authenticated Account happy/error/destructive runtime without personal-data
  capture: `UNVERIFIED`;
- all-surface Paper/Ink/OLED/high-contrast/forced-colors parity: `UNVERIFIED`;
- native-speaker acceptance for all eight locales: `UNVERIFIED`;
- human usability, preference, emotional effect, craft superiority, and
  product-market acceptance: `UNVERIFIED`;
- store listings, public deployment, field performance, incident ownership,
  staged rollout, and rollback rehearsal: `UNVERIFIED`;
- final Ten-Lens closure and release readiness: `UNVERIFIED`.

These entries are blockers only for claims that depend on them. They do not
prevent reversible local remediation whose acceptance criteria and rollback
are directly proven.
