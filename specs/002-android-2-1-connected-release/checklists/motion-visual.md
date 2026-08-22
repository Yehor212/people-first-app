# Checklist 6 — Motion and Visual Integrity

## Requirement quality

- [x] MOT-001 Does the specification explicitly and testably define that canonical `ValenceOrb`/`MiniValenceOrb` is frozen and regression-only? [Completeness, Spec §FR-026–FR-030/FR-033–FR-035]
- [x] MOT-002 Does the specification explicitly and testably define that every production-reachable non-orb animation has owner, route, trigger, exit and user-purpose fields? [Completeness, Spec §FR-026–FR-030/FR-033–FR-035]
- [x] MOT-003 Does the specification explicitly and testably define that timer/RAF/canvas/audio/resource ownership, background/foreground, rapid close, unmount and restart cleanup are explicit? [Completeness, Spec §FR-026–FR-030/FR-033–FR-035]
- [x] MOT-004 Does the specification explicitly and testably define that normal and effective reduced-motion behavior preserve the same semantic completion? [Completeness, Spec §FR-026–FR-030/FR-033–FR-035]
- [x] MOT-005 Does the specification explicitly and testably define that baseline videos/screenshots precede redesign and bind route/build/locale/viewport/motion/hash? [Completeness, Spec §FR-026–FR-030/FR-033–FR-035]
- [x] MOT-006 Does the specification explicitly and testably define that a ZenFlow-specific concept board contains 4–6 directions with user failure mode, platform, constraints, tradeoff and rejection criteria? [Completeness, Spec §FR-026–FR-030/FR-033–FR-035]
- [x] MOT-007 Does the specification explicitly and testably define that gratitude Bloom receives three variants and Let Go of a Thought receives three variants? [Completeness, Spec §FR-026–FR-030/FR-033–FR-035]
- [x] MOT-008 Does the specification explicitly and testably define that work stops for owner selection before production implementation? [Completeness, Spec §FR-026–FR-030/FR-033–FR-035]
- [x] MOT-009 Does the specification explicitly and testably define that all-eight locale/RTL/reflow/focus/Back/safe-area behavior is part of the selected concept proof? [Completeness, Spec §FR-026–FR-030/FR-033–FR-035]
- [x] MOT-010 Does the specification explicitly and testably define that numeric frame/jank/startup/resource thresholds and invalid-environment handling are explicit? [Completeness, Spec §FR-026–FR-030/FR-033–FR-035]
- [x] MOT-011 Does the specification explicitly and testably define that technical, Visual Runtime, Artistic/Craft, Motion, Model and Plan are reported independently? [Completeness, Spec §FR-026–FR-030/FR-033–FR-035]
- [x] MOT-012 Does the specification explicitly and testably define that automated render/test success never implies human artistic acceptance? [Completeness, Spec §FR-026–FR-030/FR-033–FR-035]
- [x] MOT-013 Does the specification explicitly and testably define that no premium visual is replaced with a cheaper approximation merely to satisfy performance? [Completeness, Spec §FR-026–FR-030/FR-033–FR-035]

## Context-only current evidence ledger (not checklist items)

- MOT-E01 Current production-reachability inventory — `UNVERIFIED`.
- MOT-E02 Fresh normal/reduced baseline videos with manifest — `UNVERIFIED`.
- MOT-E03 4–6 concept directions — `UNVERIFIED` and intentionally not produced during this audit.
- MOT-E04 Three Gratitude Bloom variants — `UNVERIFIED`.
- MOT-E05 Three Let Go variants — `UNVERIFIED`.
- MOT-E06 Owner artistic selection — `ASK` after concept pack.
- MOT-E07 Selected implementation RED/GREEN/lifecycle/performance — `BLOCKED` by owner selection.
- MOT-E08 Exact-AAB video/runtime evidence — `UNVERIFIED`.
- MOT-E09 Independent visual integrity critique — `UNVERIFIED` until artifacts exist.
- MOT-E10 Human craft/accessibility/cultural review — `OWNER/EXTERNAL`.

## Kill conditions

- production motion begins before baseline/concepts/owner selection;
- reduced-motion path loses meaning, completion or control;
- timers/RAF/canvas/audio survive close/background/unmount;
- layout/focus/Back relies on animation timing;
- orb is redesigned or downgraded outside explicit scope;
- tests/renders are labeled `ARTISTIC_PASS` without human approval.
