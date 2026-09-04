# Theme Transition Contract

## Request

Every explicit entry, navigation, or Settings theme change uses one coordinator:

```text
requestThemeChange(targetPreference, persistAndCommit) -> ThemeWriteResult
```

- Persistence failure returns the existing failure result and creates no active transition.
- Reduced motion calls the commit directly.
- Normal motion cancels any prior session, records the actual pre-change background token, commits the requested theme, and releases one overlay.
- The overlay is pointer-transparent, contains no content, and never owns focus.
- The veil is a dedicated body child; it never mutates a transition attribute on `<html>`.
- Android releases blur only on the two live drawer nodes through local classes.
- Cleanup removes every temporary element, local class, inline token, frame, and timeout.

## Visual And Performance Rules

- Duration: 260-300 ms.
- Easing: calm deceleration equivalent to `(0.2, 0, 0, 1)`.
- Animated property: opacity only.
- Forbidden: blur, filter, backdrop-filter, DOM screenshot, root View Transition snapshot, layout/geometry animation, simultaneous element-by-element colour transitions, and canonical-orb changes.
- Android drawer atomic-transition suppression remains scoped to the live drawer during the commit.
- Accepted Android run: feedback <=100 ms, no presentation gap >103 ms in the action window, no tile warning/context loss, and no missing/partial frame through ten round trips.
