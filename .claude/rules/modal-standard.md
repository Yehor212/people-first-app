# Modal Desktop Standard (MANDATORY)

ALL modals, dialogs, panels, overlays MUST follow this pattern:

## Single-div pattern (current implementation)

```
fixed inset-0 md:mx-auto md:my-6 md:max-w-lg md:rounded-2xl md:shadow-2xl z-[60] bg-background/95 overflow-y-auto
```

**How it works:** `inset-0` sets `left:0; right:0` (full viewport width). `md:max-w-lg` caps width. `md:mx-auto` centers with equal margins. NO `left-auto` or `right-auto` — those break centering on fixed elements.

## Sizes

- `md:max-w-sm` (384px) — alerts, confirmations
- `md:max-w-lg` (512px) — forms, settings (DEFAULT)
- `md:max-w-2xl` (672px) — panels, emotion wheel, scrollable lists
- `md:max-w-3xl` (768px) — changelog, reports

## Desktop backdrop (panels/modals that don't cover full viewport)

When `md:max-w-*` constrains width, the background only covers the modal area. Add a backdrop:

```
<>
  {/* Desktop backdrop */}
  <div
    className="hidden md:block fixed inset-0 z-[N-1] bg-black/40 backdrop-blur-sm [-webkit-backdrop-filter:blur(4px)]"
    onClick={onClose}
    aria-hidden="true"
  />
  <div className="fixed inset-0 md:mx-auto md:my-6 md:max-w-lg md:rounded-2xl md:shadow-2xl z-[N] bg-background/95 overflow-y-auto">
    ...
  </div>
</>
```

Where `z-[N]` is the modal's z-index (e.g., 60) and backdrop is `z-[N-1]` (e.g., 59).

## Rules

- Use `md:` breakpoint (768px), NOT `lg:` — tablets get centered modals
- Always `md:rounded-2xl md:shadow-2xl` on desktop
- Always `overflow-y-auto` — never clip content
- NEVER use `md:left-auto md:right-auto` — breaks fixed element centering
- If inside PullToRefresh or any transform ancestor → use `createPortal(jsx, document.body)`
- Desktop backdrop required for panels with `bg-background` — dashboard must not bleed through
- Exempt: breathing exercise, celebrations, splash (intentionally immersive)

## CSS gotcha: transform breaks fixed

Any ancestor with `transform`, `perspective`, `filter`, `backdrop-filter`, or `will-change: transform` creates a new containing block. `position: fixed` becomes relative to THAT ancestor, not viewport. Fix: `createPortal` to render outside the ancestor.
