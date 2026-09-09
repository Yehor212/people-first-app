# Native Keyboard Requirements Checklist

Purpose: author/reviewer assessment of the concrete SafeArea defect requirements, not implementation proof. Created 2026-09-08. Feature: [spec.md](../spec.md#us2-native-keyboard-defect-clarification--2026-09-08).

## Scope and Geometry

- [x] CHK001 Is visible-but-nonoverlapping IME distinguished from docked geometry? [Clarity, Spec FR-015/FR-016]
- [x] CHK002 Are bottom, top and side clearance and minimum targets explicit? [Completeness, Spec FR-015]
- [x] CHK003 Are hidden, floating, docked, dismissal and compatibility branches covered without claiming simulated versions are real-provider proof? [Coverage, Spec FR-016]
- [x] CHK004 Is the write boundary restricted to the existing native owner, excluding CSS, data, visual and dependency-version changes? [Consistency, Spec FR-017]

## Evidence and Recovery

- [x] CHK005 Are pre-fix RED, post-fix GREEN and actual native geometry/action evidence distinguished? [Measurability, Spec Acceptance]
- [x] CHK006 Are source/APK identity, state preservation, rollback and all platform/domain statuses defined? [Completeness, Spec FR-017; Plan Native Floating-Keyboard Repair]
- [x] CHK007 Are the older compositor and 103 ms failures explicitly excluded from this narrow success claim? [Consistency, Spec Acceptance]

Review result: 7/7 requirements-writing items satisfied. This checklist certifies no runtime, performance, security or artistic outcome.

## Stable-root requirements review — 2026-09-09

- [x] CHK008 Is the new native/CSS authorization distinguished from the previous Java-only floating-keyboard scope? [Consistency, Spec Stable Native Surface Clarification]
- [x] CHK009 Are full-height painting, single overlap ownership and hidden/floating/system-bar behavior explicit without hardcoded device dimensions? [Clarity, Spec FR-019]
- [x] CHK010 Are cancellation, direction changes, rotation, resume, teardown and missing-platform outcomes specified? [Coverage, Spec State boundary; Plan Stable-root native characterization]
- [x] CHK011 Are successful fixture observations distinguished from real-app regression and final visual/presentation acceptance? [Measurability, Spec FR-020]
- [x] CHK012 Are privacy, preserved visual quality, same-build identity, rollback and regression-before-production requirements defined? [Completeness, Spec FR-004/FR-006/FR-019/FR-020; Plan Stable-root native characterization]

All five appended items assess the written requirements only. They do not establish that the candidate works.
