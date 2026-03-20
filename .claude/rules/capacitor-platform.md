---
description: Capacitor & platform rules — applies to androidBackHandler, deepLinks, notifications, capacitor.config
---

# Capacitor & Platform Rules (Law 10: Cross-Platform)

- iOS/Android/Desktop must render and behave equivalently
- Android back handler required on ALL modals, drawers, and overlays
- Use Capacitor Plugins API — never call native APIs directly
- Platform branching: `Capacitor.getPlatform()` for runtime checks, not user-agent sniffing
- Safe area insets: always use `env(safe-area-inset-*)` for iOS notch/home indicator
- Notification lifecycle: register → listen → cleanup in useEffect return
- Deep links: validate URL scheme before navigation, never trust external URLs blindly
- Push notification tokens: refresh on app resume, handle token rotation
- Haptic feedback: wrap in try/catch (not available on all platforms)
- Test on real devices — emulators miss permission edge cases
