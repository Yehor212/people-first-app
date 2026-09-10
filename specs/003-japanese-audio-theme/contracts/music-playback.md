# Music Playback Contract

## Collection

- Exactly ten immutable master descriptors are exported in sequence order.
- All ten descriptors map to the retained R7 originals under `sounds/music/r7-*.mp3` in original review order, starting with Shoji Rain.
- An independent receipt-bound regression checks the runtime catalog and integrity-cache catalog against all ten original sizes and hashes.
- Retired collection cursors normalize to Shoji Rain without changing the existing enabled preference or master volume.
- The original recordings retain their duration and encoded bytes. Playback uses the existing natural-end/next-track fade, not a synthesized circular loop.
- Selected master volume is used directly; no second fixed `0.18` attenuation is applied. Existing mute, zero, comfort, ownership, and lifecycle gates remain authoritative.

## Controller

The shared control exposes:

```text
enabled: boolean
state: off | blocked | loading | playing | fading | paused | recovering | error
activeMasterId: string
sourceMasterId: string
toggle(): void
retry(): void
previous(): void
next(): void
handleMediaError(): void
handleMediaEnded(): void
```

Behavioral guarantees:

- One provider and one media element exist across account entry and authenticated navigation.
- First-ever state is off.
- `toggle()` persists before starting or stopping playback.
- Explicit enable requests integrity caching for the active master and, after admission, the next master.
- Track advancement is sequential and stores only the next valid cursor identifier.
- A failing master is skipped at most once per collection cycle; ten failures end in `error`.
- Disabling, backgrounding, master mute, comfort disable, or ownership loss invalidates stale play and fade work.
- No music event contains account or user-content data.

## Icon Control

- Auth renders one sound-state button. Navigation renders previous, sound-state and next buttons; collapsed navigation stacks them inside its existing width.
- No visible text node, badge sentence, track title, or `title` tooltip.
- Preserve localized accessible action/state naming, `aria-pressed`, `aria-busy`, focus ring, keyboard activation, and 44/48-pixel bounds.
- Loading and error states remain distinguishable without colour alone.

## Manual Transport Amendment

- Previous/next wrap between exact R7 IDs. Cursor persistence succeeds before source changes.
- `activeMasterId` is the latest selected cursor; `sourceMasterId` is the single media element's committed source. A playing transition fades out for 80 ms before committing the source, then fades in for 120 ms. Both elapsed-time endpoints use the animation-frame clock. Revisions preserve full-cycle rapid input even when the final ID equals the starting ID.
- Off/paused/blocked selection changes the cursor silently; it cannot enable, unblock, override mute/comfort or claim another owner's audio. Explicit play remains deliberate.
- Playing selection cancels old fades/requests, switches one element and resumes only if intent and gates still permit. Rapid input accumulates from the latest cursor, including a full cycle to the same ID.
- Stale play completion cannot pause a newer successful play on the same element; off/background/unmount cancel pending work.
- Optional system previous/next callbacks are cleared for non-music ownership and degrade safely if unsupported.
