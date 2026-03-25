---
description: UI component rules — applies to src/components/**/*.{ts,tsx}
---

# UI Component Rules

## Accessibility (Law 9)

- ARIA labels on all interactive elements, keyboard navigation, screen reader support
- Touch targets >= 44px on all clickable elements
- `prefers-reduced-motion` respected for all animations

## Theme & Visual

- ALL colors via theme tokens — zero hardcoded colors (`hardcodedColors=0` ratchet)
- Z-index layering: modals >= z-[60], nav = z-50, overlays = z-[70]
- `-webkit-backdrop-filter` alongside `backdrop-filter` for Safari/iOS
- Visual aesthetic checklist: `docs/visual-aesthetic.md` Part 5 + Chameleon Rule

## Platform

- Android back handler required on all modals/drawers
- Safe area insets respected (`env(safe-area-inset-*)`)
- iOS/Android/Desktop must render equivalently (Law 10)
- Component isolation (Law 15): access stores through props/hooks only — keep cross-store coupling indirect
