# Storage Incident and Reflow Contract

## Scope

This contract covers ZenFlow's shared `StorageErrorBanner`/`StorageIncidentBanner`, the public `AuthGate` entry flow, and the inventory of reachable production fixed notifications, overlays, schedules, calendars, reports, tables, and two-dimensional data grids. It does not authorize a visual-system rewrite or treating a single public screenshot as proof for private routes.

## Incident input

The runtime accepts only the `StorageIncidentSignal` fields defined in `data-model.md`.

- Free-form `message`, raw `Error`, stack, database/table/key, entity ID, owner identity, journal/mood/habit/planning content, and arbitrary context are rejected at the boundary.
- `recoveryState: cached` is valid only after the affected domain read returns a validated recovery snapshot. An empty/default value, unresolved promise, or stale in-memory value is not proof of cached data.
- Repeated signals with the same stable key replace the active/pending copy. They do not create a vertical stack or repeatedly interrupt assistive technology.
- A retry action is exposed only when it is idempotent, owner-fenced where applicable, and safe after process restart. Dismissal never reports the storage failure as repaired.

## Presentation invariants

1. A low-priority timeout/degradation signal uses status semantics, does not move focus, and does not trap Escape or Android Back.
2. A critical save, cleanup, or sign-out incident may use assertive alert semantics, but must preserve the active workflow and expose a 48dp retry/dismiss path.
3. On the public entry flow, the incident participates in the scroll/layout flow or reserves its measured block size. The Google/Telegram sign-in actions, privacy disclosure, language/theme/mute controls, and current keyboard focus remain reachable.
4. A fixed presentation outside entry is allowed only when assertions prove that neither the focused element nor the current primary action is fully obscured in the active viewport.
5. Inline start/end and block offsets use ZenFlow safe-area variables and logical direction. The component has zero page-level horizontal overflow in `en`, `uk`, `es`, `de`, `fr`, `ja`, `ar`, and `he`.
6. Text wraps at 320 CSS pixels and 200% text size. The incident may scroll internally only after its dismiss/retry controls remain visible; the document must not require horizontal and vertical scrolling together.
7. Motion uses the shared effective-motion gate. Reduced motion has an immediate static state and no layout-affecting entrance transition.
8. Every user-visible string is localized. Technical phrases such as IndexedDB, database queue, renderer, cache internals, or timeout milliseconds stay out of user copy; fixed diagnostic codes remain internal.

## Root-cause evidence boundary

The warning is a recovery surface, not evidence that the underlying fault is fixed. Before production code changes the operation deadline or retry policy, retained evidence must identify which boundary failed:

- database open or schema upgrade blocked by an older connection;
- a queued/long Dexie ready handler or transaction;
- one named operation class (`read`, `write`, `transaction`) exceeding its budget;
- WebView renderer/process interruption or device resource pressure;
- an external lifecycle interruption such as process death or background suspension.

Only fixed codes, phase, bounded duration, recovery-state enum, app version, Android API/WebView version, and coarse device/performance class may enter diagnostic evidence. User data and owner identifiers are prohibited.

## Reflow inventory contract

- Inventory source scope is production-reachable `src/**`, not development previews or tests.
- Each fixed notification/overlay and each user-facing table/data grid records owner component, route, layer type, scroll owner, safe-area owner, close/retry control, Back ownership, RTL risk, and current evidence status.
- Intrinsically two-dimensional information may use a labelled, keyboard-focusable internal horizontal scroll region. Page-level two-dimensional scrolling, silent clipping, hidden headers/actions, or inaccessible off-screen controls fail.
- A finding becomes a production edit only after a focused RED reproduces it. No bulk class replacement or global overflow hiding is accepted as remediation.

## Required matrix

| Dimension | Required states |
|---|---|
| Viewport | 320 CSS-pixel width, 412 x 915 phone, short-height portrait, landscape, split/freeform, tablet/foldable window |
| Insets | status/navigation bars, display cutout, IME closed/open, changing safe-area values |
| Text/input | default and 200% text, keyboard, TalkBack semantics, switch/voice-sized targets |
| Locale/theme | all eight locales; direct visual proof for `en`, `ar`, and `he`; light and dark |
| Motion | normal and reduced motion |
| Platform | Web/Vite, installed PWA, Android/Capacitor, iOS/WKWebView, Desktop/Tauri each `PASS`, reasoned `N/A`, or `UNVERIFIED` |

## Acceptance and rejection

Accept only when SC-019 and SC-020 have retained RED/GREEN, browser and API-36 evidence and the incident diagnostic contains no prohibited data. Reject the change if it merely increases the 30-second deadline, hides or auto-dismisses the warning, claims cached data without a validated snapshot, uses `overflow: hidden` to conceal clipping, shrinks essential text/targets, or weakens the canonical entry visual identity.
