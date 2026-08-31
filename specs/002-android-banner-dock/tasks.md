# Tasks: Android Habits Banner Dock

## Phase 1 — RED evidence

- [x] T001 Add build-contract tests reproducing empty debug manifest ID and enforcing QA/release isolation.
- [x] T002 Add local-day mood and visible-today-Habits eligibility RED cases.
- [x] T003 Add entitlement unknown/premium/free and account-generation RED cases.
- [x] T004 Add native timeout/late-resolution/no-retry-storm RED cases.
- [x] T005 Add IME/native lifecycle/overlay ordering RED cases.
- [x] T006 Add pre-reserved exact dock and native hidden-until-reserved patch RED cases.

## Phase 2 — Minimal implementation

- [x] T007 Make every Android variant startup-safe and add explicit QA test-ad configuration with publishable fail-closed guards.
- [x] T008 Implement pure eligibility state and wire current local day/today-visible rows.
- [x] T009 Replace hardcoded premium false with fail-closed authoritative entitlement contract.
- [x] T010 Add account/lifecycle generations, IME gate, and bounded native operations.
- [x] T011 Reserve native adaptive height before revealing the view; clear geometry on all deny/failure paths.
- [x] T012 Repair the inherited ad-journey wording contract without changing product behavior.

## Phase 3 — Verification

- [x] T013 Rerun focused GREEN tests and blast-radius component/controller/native-patch tests.
- [x] T014 Run typecheck, `check:all`, i18n/RTL, canonical visuals, production-data-integrity diff/full/bundle, best-practices, Snyk fallback, and security checks applicable to the diff.
- [x] T015 Build, hash, install, and cold-start the exact QA APK on API 36.
- [ ] T016 Complete the emulator visual/lifecycle/accessibility matrix and run the visual-integrity critic.
- [ ] T017 Review final diff/status, produce Role 10 hash-bound Pass B and Role 8 closure, and report five-platform/release evidence classes honestly.

T016 remains open after the exact-v10 pass. The exact-v10 artifact rendered the
correct portrait banner, hid it before protected sheets, restored it afterward,
rebuilt to a measured `862 × 62 dp` landscape banner, and kept Create habit
reachable above the native dock. However, the first emulator instance produced
an input-dispatch ANR; the cold-reboot software renderer then produced severe
frame skips and a canonical-orb worker timeout. The settled landscape create
sheet also wrapped several labels at nearly character-level breaks. Exact-v9
large-font/Arabic/background evidence is historical only. Complete v10 IME,
large-font, Arabic/Hebrew, split-screen, three-button navigation, TalkBack, and
physical-device checks remain `UNVERIFIED`. The visual-integrity verdict is
therefore `STOP` for no-regression/release claims even though the banner-specific
technical contract is green.

## Dependencies

T001–T006 precede production edits. T007–T011 may proceed only after the matching RED evidence and fresh preflight token. T015 depends on all local gates; T016 depends on exact installed-artifact identity. No commit, merge, push, PR, deploy, or publication is part of these tasks.
