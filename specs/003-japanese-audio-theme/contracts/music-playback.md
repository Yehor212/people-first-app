# Music Playback Contract

## Collection

- Exactly ten immutable master descriptors are exported in sequence order.
- The first descriptor maps to the existing Cloudlight master; the remaining nine map to new `sounds/music/*.mp3` files.
- The runtime catalog and integrity-cache catalog are derived from the same descriptors so path, size, and hash cannot drift independently.

## Controller

The shared control exposes:

```text
enabled: boolean
state: off | blocked | loading | playing | fading | paused | recovering | error
activeMasterId: string
toggle(): void
retry(): void
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

- Render one button and one sound-state icon.
- No visible text node, badge sentence, track title, or `title` tooltip.
- Preserve localized accessible action/state naming, `aria-pressed`, `aria-busy`, focus ring, keyboard activation, and 44/48-pixel bounds.
- Loading and error states remain distinguishable without colour alone.
