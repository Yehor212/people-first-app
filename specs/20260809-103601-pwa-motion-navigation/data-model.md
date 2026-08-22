# Data Model and State Boundaries

## No persistent-model change

This feature adds no schema, migration, IndexedDB table, remote field, sync payload, deletion-tracker ID, analytics event, production fixture, or native configuration. Existing habit entries and journal entries remain authoritative through the current local-truth path. Therefore no migration, backfill, remote write, retention change, or new data consent is planned.

## Derived view state

| State | Source | Allowed transition | Privacy / recovery rule |
| --- | --- | --- | --- |
| `effectiveReduceMotion` | Existing motion preference hook and any verified existing system-preference integration | User/system preference change → re-render presentation | Does not change user data or suppress functional status. Failed preference write retains prior authoritative preference and existing feedback behavior. |
| `activeDetailTab` | Existing `HabitDetailSheet` local state | Keyboard/pointer activation → one declared tab | Reset only under existing habit-sheet lifecycle; no persistence or sync. |
| `historySummary` | Existing habit and computed entries | Input habit/date change → recompute display-only summary | No per-day mutation, tooltip state, or private data export. |
| `calendarA11yStatus` | Existing local civil date, entry presence, permitted mood, language, private-mode flag | Input change → localized label | Private mode omits mood/entry facts that existing UI hides; source remains in-process only. |
| `journalRenderWindow` | Existing ordered filtered local entries and local continuation index | Search/filter/order change → reset window; explicit continuation → grow/advance bounded window | Never queries another source, fabricates records, or exposes private-search results beyond current rules. Focus/scroll recovery follows the contract. |
| `pwaIconRevision` | Existing `config/brand-logo-assets.json` via generator | Explicit generator-owned asset update only | No remote generation, no hand-edited final raster, and no native edit in scope. |

## Invariants

1. Derived presentation state cannot become a new persistence or sync authority.
2. A journal render window preserves the original filtered order and each item’s identity; it never changes item content or action ownership.
3. Calendar semantics are derived from the same state displayed visually, except private mode intentionally removes protected facts.
4. Reduced motion changes optional presentation only; essential controls, feedback, and canonical-orb craft remain available.
5. Icon work preserves `LEAF_BODY`, `LEAF_STEM`, PWA `id`, `scope`, `start_url`, and the generator/check ownership chain.
