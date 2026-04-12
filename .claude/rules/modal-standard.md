# Modal Desktop Standard (MANDATORY)

ALL modals, dialogs, panels, overlays MUST follow this pattern:

## Classes

```
Outer:  fixed inset-0 z-[60] flex items-center justify-center
Inner:  w-full h-full md:h-auto md:mx-auto md:my-6 md:max-w-lg md:rounded-2xl md:shadow-2xl overflow-y-auto
```

## Sizes

- `md:max-w-sm` (384px) — alerts, confirmations
- `md:max-w-lg` (512px) — forms, settings (DEFAULT)
- `md:max-w-2xl` (672px) — panels, emotion wheel
- `md:max-w-3xl` (768px) — changelog, reports

## Rules

- Use `md:` breakpoint (768px), NOT `lg:` — tablets get centered modals
- Always `md:rounded-2xl md:shadow-2xl` on desktop
- Always `overflow-y-auto` — never clip content
- If inside PullToRefresh or transform ancestor → `createPortal(jsx, document.body)`
- Exempt: breathing exercise, celebrations, splash (intentionally immersive)
