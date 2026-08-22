# Motion and Navigation Contract

## Motion classes

| Surface | Class | Enabled behavior | Effective reduced-motion behavior | Must never change |
| --- | --- | --- | --- | --- |
| Habit-detail background pulse | Decorative | Bounded visual pulse only while sheet is visible | No pulse and no optional animation work | Habit status, controls, sheet close/back behavior |
| Detail section entry/exit | Event | Short bounded transition between already-selected panels | Immediate static panel replacement; no lost focus or delayed semantic content | Selected tab, labelled panel, data availability |
| Heatmap hover/tooltip | Decorative interaction | Pointer-only explanatory affordance only if summary remains noninteractive | No animated tooltip; summary text/legend remains available | 182-day values and non-color meaning |
| Habit pictogram loop | Optional asset | May load/play only when declared nonessential | Use the supplied reduced/static asset without loading optional loop | Stored habit identity and functional label |
| Valence orb family | Canonical | Existing frozen craft | Existing contract governs; this feature must not downgrade or replace it | Visual identity and orb behavior |

The checked registry is the inventory authority for the 34 baseline JavaScript infinite-loop waiver files. The 79 baseline indefinite SMIL nodes in the two emotion SVG modules are one declared decorative surface family: the reactive effective-motion owner pauses them before paint and resets them to a deterministic static frame. Counts are regression baselines, not permission to add more loops.

`effective reduced motion` means the value actually consumed by the surface after verifying current user/system preference composition. A stored preference alone is not evidence that an OS preference has been honored.

## Tabs

- Owners: every production custom `role=tablist` found by the inventory, including Habit Detail, Habit Creation, Legal, and Leaderboard; no new route, sheet, modal, or overlay.
- Four declared tabs remain overview, calendar, trends, history. Each trigger has a stable `id`, `role=tab`, `aria-selected`, `aria-controls`, visible focus, and minimum 44px target. Each panel has `role=tabpanel`, `aria-labelledby`, and is mounted/announced only when selected according to the chosen existing-pattern-safe implementation.
- Keyboard: Tab enters/leaves the tablist once. Left/Right or directionally appropriate equivalents move focus among triggers; Home/End reach first/last; Enter/Space activates the focused trigger. Final behavior must be tested in `dir=ltr` and `dir=rtl` rather than assumed.
- Recovery: closing/Android back continues through the existing `useBackHandler`; if the selected tab disappears because the sheet closes, focus returns through the pre-existing sheet trigger contract. This return target is `UNVERIFIED` until rendered testing.

## Heatmap summary and history action

- The 182 days remain visible as a read-only calendar-density summary. No day cell has `role=button`, click/keyboard mutation, tab stop, or transient tooltip ownership.
- A concise localized, non-color legend describes done, auto, skipped, missed/unknown states.
- Exactly one `History` control meets the 44px minimum and selects the existing history panel. It does not open a new sheet/route and does not mutate an entry.
- Pointer hover may not reintroduce a hidden interaction requirement. Any visible extra text must be represented in the accessible summary/legend.

## Calendar and emotion semantics

- Calendar day accessible name order: localized full civil date; entry status if permitted; localized mood/status if permitted; selected/today state comes from native ARIA semantics rather than a duplicate private string.
- An emotion visual is `aria-hidden=true` only when adjacent localized text supplies the same meaning. If the visual is the only carrier, it requires a localized accessible name. Color alone is never the only status cue.
- In private mode, do not include mood, entry count, release trace, or any other fact the existing private surface suppresses. Do not infer a status from retained data.
- `AnimatedCalendar` names include the localized civil date and every applicable visible mood/status/metric fact. Internal tokens such as `yes_manual`, `yes_auto`, or persistence enum names are never spoken.

## Bounded journal list

- Applies to text-search result rendering in `JournalEntryList`; existing private-search, active-space, selected-date, and empty paths retain their current contracts unless a test proves they use the same source safely.
- Bound: at most 96 mounted `JournalEntryCard` instances from this result path at once.
- Order: the window is a contiguous prefix/next segment of the existing `visibleFilteredEntries` order. No sorting, identity, content, or card action changes.
- Continuation: only rendered when more real local matches exist; it reports that more matching entries are available without inventing a count. Activation cannot duplicate items. Focus moves to the first newly shown item or remains on an updated continuation, chosen once and covered by a test; scroll remains stable enough that the activating control/result is not lost.
- Empty, unavailable, error, and private-mode states remain honest; no placeholder journal records or synthetic summary is permitted.

## PWA icon boundary

- Canonical source remains `scripts/generate-icons.cjs` with `LEAF_BODY` and `LEAF_STEM`; output remains generated public/docs assets plus existing manifests.
- The existing `id`, `start_url`, `scope`, and install icon revision are compatibility invariants. Any icon quality change must regenerate and check assets, inspect the proof sheet, and retain anti-blob/safe-zone behavior.
- Native Android/iOS/Tauri assets are out of this feature’s write scope. Generator coupling is documented; release needs native-owner compatibility receipts if shared outputs or shared module behavior changes.

## Failure, lifecycle, observability, and rollback

- Disabled motion or a missing optional motion asset yields the static semantic state, never blank content. Rapid tab reactivation, background/resume, and sheet close must not queue stale animated work.
- List continuation failure leaves the current 96-or-fewer rendered window intact and exposes no false success. No new telemetry is authorized; existing privacy rules prohibit journal content, IDs, raw URLs, or secrets in diagnostics.
- Rollback order: revert the scoped source and test changes as one coherent change; regenerate icons only if generator inputs changed; rerun focused tests, `assets:logos:check`, and proof. Do not hand-patch generated images or erase user data.
