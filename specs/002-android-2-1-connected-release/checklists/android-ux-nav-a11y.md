# Checklist 2 — Android UX, Navigation and Accessibility

**Meaning:** checked rows validate requirement coverage only; runtime and human evidence remain separate.

## Requirement quality

- [x] AND-001 Does the specification explicitly and testably define that orb, Habits, Diary, Planning and Settings each define entry, visible exit and root behavior? [Completeness, Spec §FR-008–FR-009/FR-026–FR-030]
- [x] AND-002 Does the specification explicitly and testably define that every sheet/modal/overlay/takeover defines LIFO owner, Android Back, Escape/keyboard applicability, focus trap/restore and action safety? [Completeness, Spec §FR-008–FR-009/FR-026–FR-030]
- [x] AND-003 Does the specification explicitly and testably define that predictive Back commit/cancel and three-button/gesture navigation are distinguished? [Completeness, Spec §FR-008–FR-009/FR-026–FR-030]
- [x] AND-004 Does the specification explicitly and testably define that process death, activity recreation, WebView reload, external settings/OAuth return and IME open/close have explicit cases? [Completeness, Spec §FR-008–FR-009/FR-026–FR-030]
- [x] AND-005 Does the specification explicitly and testably define that phone portrait/landscape, tablet, split/freeform/foldable and adaptive-window cases are explicit? [Completeness, Spec §FR-008–FR-009/FR-026–FR-030]
- [x] AND-006 Does the specification explicitly and testably define that edge-to-edge, safe areas, cutouts, system bars, keyboard insets and dynamic viewport are explicit? [Completeness, Spec §FR-008–FR-009/FR-026–FR-030]
- [x] AND-007 Does the specification explicitly and testably define that all eight locales, direct `en`/`ar`/`he`, RTL/bidi, Arabic font behavior and no fragment concatenation are explicit? [Completeness, Spec §FR-008–FR-009/FR-026–FR-030]
- [x] AND-008 Does the specification explicitly and testably define that 200% text/reflow, no horizontal page scroll, focus-not-obscured and reachable critical action are explicit? [Completeness, Spec §FR-008–FR-009/FR-026–FR-030]
- [x] AND-009 Does the specification explicitly and testably define that 44px minimum/repository 48dp intent, keyboard/switch semantics and announcement behavior are explicit? [Completeness, Spec §FR-008–FR-009/FR-026–FR-030]
- [x] AND-010 Does the specification explicitly and testably define that reduced motion preserves semantic completion and cannot hide controls or state? [Completeness, Spec §FR-008–FR-009/FR-026–FR-030]
- [x] AND-011 Does the specification explicitly and testably define that automated accessibility and named human TalkBack/AT acceptance are separate gates? [Completeness, Spec §FR-008–FR-009/FR-026–FR-030]
- [x] AND-012 Does the specification explicitly and testably define that committed user state is retained through navigation/lifecycle; accidental Back must not invoke destructive actions? [Completeness, Spec §FR-008–FR-009/FR-026–FR-030]

## Context-only current evidence ledger (not checklist items)

- AND-E01 Source-owned full overlay/table/five-destination inventory — inherited partial evidence, `UNVERIFIED` current.
- AND-E02 API 36 exact-candidate predictive/system Back matrix — `UNVERIFIED`.
- AND-E03 exact-candidate process-death/recreation/reload/OAuth/settings/IME matrix — `UNVERIFIED`.
- AND-E04 all-eight-locale and `en`/`ar`/`he` direct capture matrix — `UNVERIFIED`.
- AND-E05 200%/short-height/landscape/split/tablet/foldable matrix — `UNVERIFIED`.
- AND-E06 automated a11y/keyboard/switch/target/focus checks — `UNVERIFIED` current.
- AND-E07 named human TalkBack/AT review — `OWNER/EXTERNAL`.
- AND-E08 installed-PWA, iOS/WKWebView and Desktop/Tauri parity — `UNVERIFIED`.
- AND-E09 human visual/cultural review — `OWNER/EXTERNAL`.

## Kill conditions

- Back triggers an action instead of closing/delegating;
- critical content/action is clipped, obscured, unreachable or depends on motion;
- RTL changes order/meaning, leaks LTR identifiers or breaks focus/navigation;
- committed data is lost or duplicated during lifecycle/navigation;
- browser screenshots or unit tests are reported as all-device/human PASS.
