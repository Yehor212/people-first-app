# Feature Specification: PWA Motion, Navigation, and Icon Quality

**Feature directory**: `specs/20260809-103601-pwa-motion-navigation`
**Created**: 2026-08-09
**Status**: Ready for implementation under the user's explicit authorization
**Request hash**: `2c486678a7be4e33871689d420d95cefc78ef717cd013aef9a9d1684d00b312e`

## User failure and scope

On the installed PWA, a person who has asked for less motion can still encounter optional looping or entrance motion; a keyboard user can stop on every one of the 182 history cells; a long journal result renders every matching card; and calendar/status meaning is not consistently available as a compact, localized accessible label. These are concrete usability and performance risks in the current local surfaces, not evidence of a production incident.

The change covers reduced-motion behavior, current lightweight tabs, the habit-history heatmap, journal calendar and emotion semantics, a bounded journal list, and existing PWA install icons. It does not change the canonical `ValenceOrb` / `MiniValenceOrb`, native projects, persistent schemas, sync contracts, install identity, or the disabled `002-habit-model-library` feature.

## User scenarios and testing

### User story 1 — Use the app without optional motion (P1)

A person who enables reduced motion receives the same state, controls, and status information without optional loops, staged entrances, or optional motion-asset loads.

**Independent test**: Set effective reduced motion before rendering each scoped surface; verify the static semantic state is present, no optional motion asset is requested, and no decorative visual value changes across a six-second observation.

**Acceptance scenarios**:

1. **Given** effective reduced motion is enabled, **when** the habit detail opens, **then** the optional decorative pulse and optional entrances do not animate while the habit status and tab content remain usable.
2. **Given** effective reduced motion is enabled, **when** an optional habit pictogram would otherwise load a looping asset, **then** the reduced/static representation is used without fetching that optional loop.
3. **Given** motion is enabled, **when** a scoped surface opens, **then** motion remains bounded to its declared event or decorative purpose and does not alter data or control availability.

### User story 2 — Navigate habits with keyboard, touch, and RTL layout (P1)

A person can move through habit-detail tabs predictably and review the last 26 weeks without tabbing through every history day.

**Independent test**: Exercise Arrow/Home/End and activation keys in LTR and RTL; verify one selected tab and its labelled panel. Tab through history and verify only the one explicit History action is focusable, with the summary remaining noninteractive.

**Acceptance scenarios**:

1. **Given** a habit detail is open, **when** a person uses tab keys and the supported arrow keys, **then** the tab list exposes one selected tab, an associated panel, and no invisible/duplicate focus stop.
2. **Given** the interface direction is RTL, **when** a person moves horizontally through tabs, **then** visual direction and keyboard movement follow the chosen local tab contract and labels do not concatenate fragments.
3. **Given** the history summary contains 182 days, **when** a keyboard user reaches it, **then** it contributes zero day-cell focus stops and exactly one minimum-44px History action opens the existing detail context.

### User story 3 — Understand calendar and emotion status without color alone (P1)

A person using a screen reader can identify the date, entry state, and localized mood/status of a calendar day, even when visual color or icon meaning is unavailable.

**Independent test**: Render calendar days with and without an entry/mood under each locale fixture; assert a single localized accessible name with date and status, and assert emotion visuals are either hidden from assistive technology or have a localized label.

**Acceptance scenarios**:

1. **Given** a day has an entry and mood, **when** it receives focus, **then** its accessible name includes its localized full date, entry state, and localized mood/status.
2. **Given** a day has no mood or is in private mode, **when** it receives focus, **then** it does not disclose a mood that is absent or intentionally hidden.
3. **Given** an emotion icon is rendered, **when** it conveys no distinct information, **then** it is decorative; otherwise it has a localized accessible name.

### User story 4 — Search a large journal without mounting every match (P2)

A person can keep their current search, order, focus, and scroll position while at most 96 journal cards are mounted at once; more results are reached through an explicit continuation without inventing entries.

**Independent test**: Supply more than 96 local entries to the existing list path, preserve sort/search selection, and verify 96 or fewer cards exist in the DOM until the explicit continuation is activated. Check keyboard focus and scroll recovery after continuation.

**Acceptance scenarios**:

1. **Given** a text search has 97 or more locally available matching entries, **when** results render, **then** the first bounded ordered window is mounted and the continuation truthfully states that further locally matched entries are available.
2. **Given** a person activates continuation, **when** the next window renders, **then** no entry is duplicated, search/filter order is preserved, and focus stays on a predictable continuation or first newly revealed result according to the contract.
3. **Given** private mode or no matching entry, **when** the list renders, **then** existing privacy and empty states remain authoritative; no synthetic result or count is shown.

### User story 5 — Keep the installed-app identity recognizable (P3)

A person installing or reopening the PWA sees the existing ZenFlow leaf identity at supported browser/PWA icon surfaces, without a rebrand or cache-bypass claim beyond verified generated assets.

**Independent test**: Run the generator-owned icon checks and inspect its proof sheet; verify manifest/icon references retain the canonical leaf tokens, maskable asset, revision, and install identity.

**Acceptance scenarios**:

1. **Given** PWA icons are regenerated by the approved generator, **when** structural checks run, **then** required public/docs icon families and manifest references pass without editing PNGs by hand.
2. **Given** a small PWA icon is inspected, **when** the technical guard and proof sheet run, **then** it retains internal leaf structure rather than becoming a white blob.

## Functional requirements

- **FR-001**: The scoped surfaces MUST classify each affected motion as essential, event, decorative, or canonical, and must not start optional loop/asset work while effective reduced motion is enabled.
- **FR-002**: Reduced motion MUST preserve the same functional state, textual status, controls, focus path, and canonical orb quality; it MUST not become an empty or misleading substitute.
- **FR-003**: Habit-detail tabs MUST expose a single tablist, one selected tab, associated labelled tabpanels, keyboard activation/navigation, visible focus, 44px minimum targets, and an RTL-reviewed directional contract.
- **FR-004**: The 182-day heatmap MUST become a noninteractive visual summary with non-color legend/status meaning and one minimum-44px History action that reaches existing detailed history; it MUST not create a new overlay owner or day-level focus interaction.
- **FR-005**: Calendar day controls MUST expose localized date, entry state, and mood/status semantics where present; mood/emotion visuals MUST be explicitly decorative or localized and labelled, and private mode MUST not disclose hidden mood data.
- **FR-006**: The journal text-result path MUST mount no more than 96 result cards at a time while preserving existing local order, search/filter semantics, card actions, keyboard focus, scroll recovery, private-mode behavior, and honest empty/unavailable states.
- **FR-007**: PWA icon work MUST stay generator-owned, preserve `LEAF_BODY`, `LEAF_STEM`, install identity, manifest revisioning, maskable/small-icon guards, and must not hand-edit generated raster assets or alter native icon files.
- **FR-008**: All user-facing additions MUST provide key parity for en, uk, es, de, fr, ja, ar, and he; ar/he layout and bidi safety must be reviewed without string concatenation.
- **FR-009**: The implementation MUST add focused red-first or characterization tests before source changes and retain command, artifact, hash, platform, rollback, and `UNVERIFIED` evidence; no production data, schema, sync, native, dependency, deploy, issue creation, or feature-002 mutation is allowed. `speckit-taskstoissues` MUST NOT run.
- **FR-010**: All 79 current indefinite SMIL nodes in `src/components/animated-emotion-emoji/warmEmojis.tsx` and `coolEmojis.tsx` MUST be governed by the reactive effective-motion gate before paint; reduced mode MUST expose a stable static frame, and every SVG MUST be removed from the accessibility tree when its parent supplies semantics.
- **FR-011**: The 34 current JavaScript infinite-loop waiver files MUST be represented in one checked motion-surface registry as `essential`, `event`, `decorative`, or `canonical`; a new unregistered loop MUST fail validation, and every decorative registered loop MUST name its effective-motion stop contract.
- **FR-012**: Every production custom `role=tablist` owner, not only Habit Detail, MUST use one shared keyboard/focus contract or be migrated to an existing fully conforming primitive. Partial ARIA without roving `tabIndex`, stable tab/panel IDs, Arrow/Home/End behavior, focus preservation, and RTL visual-order tests is forbidden.
- **FR-013**: `src/components/animated-stats/AnimatedCalendar.tsx` and the journal calendar owners MUST expose localized date plus visible mood/status/metric facts in accessible names; raw storage tokens such as `yes_manual` MUST never reach user or assistive-technology copy.

## Key entities and state boundaries

- **Effective motion preference**: Existing user/system-derived preference consumed by scoped UI; it changes presentation only and does not persist new business data in this feature.
- **Motion classification**: A documented per-surface declaration used to decide whether presentation can animate or load optional assets.
- **History summary**: Read-only aggregation of existing habit entries over 182 civil days; it is not an editor and does not own a tooltip, mutation, or navigation state.
- **Journal render window**: A derived ordered slice of existing filtered local entries plus continuation state; it is not a new store, query authority, or synchronization mechanism.
- **Calendar accessible status**: Derived localized label from existing selected date, entry presence, allowed mood/status, and private-mode boundary.
- **PWA install icon set**: Generator-produced public/docs files and manifest references derived from existing canonical leaf tokens and shared revision config.

## Success criteria

- **SC-001**: With effective reduced motion, scoped optional loops/assets make zero network requests and no decorative visual value changes during a six-second controlled observation, while functional text and controls remain available.
- **SC-002**: Every scoped tab can be reached and activated with keyboard; each exposes one selected state, a labelled panel, visible focus, and a target no smaller than 44 CSS pixels.
- **SC-003**: The 182-day summary contributes zero actionable day cells and exactly one reachable History action, while preserving a non-color explanation of its states.
- **SC-004**: Each rendered calendar day has one localized accessible name containing its date plus applicable entry and mood/status facts; private-mode days omit private mood facts.
- **SC-005**: For every local text search result set, no more than 96 journal cards are mounted concurrently; continuation preserves the full existing order with no duplicate or invented item.
- **SC-006**: Generator checks prove the existing PWA icon family retains canonical tokens, required manifest/icon references, and small-icon technical readability guards; device launcher, store, and public-cache observations remain separately `UNVERIFIED` until observed.
- **SC-007**: Static and rendered checks account for exactly the 79 baseline indefinite emotion-SMIL nodes, prove each is behind the effective-motion owner, and observe no property/pixel change for six seconds with reduced motion enabled.
- **SC-008**: A machine check binds all 34 baseline JavaScript-loop waiver files to the motion registry and rejects an added unregistered loop or decorative entry without a stop contract.
- **SC-009**: All production custom tablists pass the same LTR/RTL Arrow/Home/End, roving focus, activation, stable association, 44px target, and focus-preservation contract.

## Settled decisions and non-goals

The supplied PWA quality plan settles the primary target (installed PWA with Web/Vite fallback), the 96-card bound, the 182-day noninteractive summary plus one history action, the six-second reduced-motion observation, and the no-native/no-orb-downgrade/no-feature-002 boundaries. No user question remains for this planning stage.

Non-goals: virtualizing every journal surface; changing entry data, IndexedDB, sync, deletion, or migrations; adding a new history route, sheet, modal, store, package, or paid service; rebranding/replacing the leaf; editing Android/iOS/Tauri; treating static checks as proof of devices, artistic acceptance, or public deployment.

## Assumptions and unresolved-evidence ledger

- The existing Habit Detail Sheet remains the owner of its tab content and existing bottom-sheet dismissal/back behavior. This is grounded by `src/components/habit-hub/HabitDetailSheet.tsx`; rendered native behavior is `UNVERIFIED`.
- A continuation control can use the current journal list owner without an additional data source. Its final copy/key names are `UNVERIFIED` until the i18n catalog is inspected and implementation begins.
- System-level `prefers-reduced-motion` composition with the stored motion preference is `UNVERIFIED`; implementation must inspect the effective preference owner before asserting it.
- Artistry, device/browser installed-PWA behavior, store treatment, public cache refresh, real assistive-technology experience, and all native compatibility receipts are `UNVERIFIED`. They are release gates, not open critical planning contradictions.
