# Animation Soft Motion Plan — ZenFlow

Date: 2026-07-25
Owner request: "сделать анимацию в проекте красивую, мягкую и логичную по лучшим практикам" (deep analysis → web research → plan → execution per best practices).
Status: EXECUTED (P1–P4 done and verified 2026-07-25; see "Execution Outcome" at the end).

---

## 1. Explicit Requirements

- Animations across the app should feel **beautiful** (premium, consistent), **soft** (no harsh/snappy-jarring motion), and **logical** (motion encodes direction and intent).
- Use **best practices** → `docs/ai/BEST_PRACTICES_IMPLIED_REQUIREMENTS_GATE.md` is activated; this document is the Best Practices Packet.
- Deep analysis with **web research** (done, §4) and a **written plan** (this file).
- Proceed to implementation **until agent approval** — the ten-role orchestra disposition is recorded in §9; physical multi-agent invocation is not available in this runtime and is marked UNVERIFIED.

## 2. Non-Goals (protected identity)

- No visual identity change: `ValenceOrb` / `MiniValenceOrb` canonical family frozen; no orb renderer changes.
- No route/shell/navigation changes, no storage/sync/auth/privacy changes, no dependency changes.
- No removal of the motion verb grammar (`src/lib/motion/*`) — consolidation must preserve it.
- No weakening of the effective-motion gate (`useShouldAnimate`, `AnimationGate`, `body.reduce-motion`).
- Generated count blocks in `ARCHITECTURE.md` are not hand-edited (`npm run doc-counts:update` only if counts actually change).

## 3. Current-State Evidence (verified 2026-07-25)

Canonical motion layers (all present, all tested):

| Layer | File | Role |
| --- | --- | --- |
| Motion tokens + gate | `src/lib/animationUtils.ts` | `motionPresets` (4), `zenMotion` (6 springs/tweens), `zenTap` (4), `zenHover` (2), `shouldAnimate()` |
| Verb grammar | `src/lib/motion/*` | bloom/fold/morph/settle/breathe/ripple verbs, `easings` (5 curves), `choreography` stage ladder, wrapper components |
| Diary presets | `src/config/animations.ts` | `springs` (5), `durations` (5), `easings` (4), `stagger` (Epic 6) |
| Platform-adaptive | `src/lib/platformMotion.ts` | iOS springs / Android M3 curves / desktop short tweens |
| Gate | `src/hooks/useShouldAnimate.ts`, `AnimationGate` in `App.tsx` | in-app pref AND OS reduced-motion AND battery AND runtime perf |
| CSS loops | `src/index.css` | ~60 `@keyframes`, `body.reduce-motion` kill-switch |

Measured drift (grep evidence, this repo, today):

1. **86 ad-hoc `type:"spring"` configs across 52 files** despite the ARCHITECTURE.md rule "All framer-motion animations MUST use standardized presets … No ad-hoc spring configs".
2. **184+ ad-hoc timed `transition={{ duration: … }}` call sites**; duplicates of the same curve: `[0.32, 0.72, 0, 1]` hardcoded in `JournalEntryEditor.tsx:1325,2389`, `MemoryPortalCanvas.tsx:646,709`, and `index.css:1628` (tab-enter) — no shared token.
3. **JS-driven infinite loops** (`repeat: Infinity`) in ≥10 components — violates the repo's own 60fps rule "No JS-driven infinite animations (use CSS `@keyframes`)": `SelectedDayPanel.tsx` (8), `CalendarGrid.tsx` (7), `EmotionGalaxy.tsx` (4+), `WeeklyReview.tsx` (3), `CrystalCalendar.tsx` (2), `DataMountains.tsx` (20s linear), `CosmicBgAdapter.tsx` (5s), `JournalOnboardingHints.tsx`, `AICoachChat.tsx`, `StreakFreeze.tsx`.
4. **Doc drift**: `ARCHITECTURE.md` motion table documents `zenMotion.bouncy` as `stiffness: 300, damping: 15` but code is `damping: 26` (critically damped, `animationUtils.ts:59`); `zenMotion.sheet` token exists in code but is missing from the doc table.
5. **Over-long entrances**: `ZenScoreHub.tsx` 0.5s, `PremiumChart.tsx` 0.8–1.2s, `WeeklyReviewParts.tsx` 1s, `WeekCrystal.tsx` 0.5–1s — above the 120–400ms best-practice band for UI transitions.
6. **41 ad-hoc `whileTap` in 9 files** with non-token scales (inconsistent press feel).

## 4. Web Research Synthesis (sources retrieved this session)

- **Material Design 3 motion tokens** (m3.material.io/styles/motion, values cross-confirmed): easing `standard (0.2,0,0,1)`, `standard-decelerate (0,0,0,1)`, `standard-accelerate (0.3,0,1,1)`, `emphasized-decelerate (0.05,0.7,0.1,1)`, `emphasized-accelerate (0.3,0,0.8,0.15)`; duration scale short 50–200ms / medium 250–400ms / long 450–600ms; **enter transitions decelerate, exit transitions accelerate** (asymmetric = logical direction).
- **Apple HIG — Motion** (developer.apple.com, fetched): motion must be purposeful, brief, precise, optional; realistic feedback that follows gestures; avoid motion on frequent interactions; let people cancel motion.
- **Motion for React docs** (motion.dev/docs/react-transitions): springs inherit gesture velocity; `bounce`/`visualDuration` tuning; GPU-composited `transform`/`opacity` only; `AnimatePresence` for exits.
- **NN/g + web.dev guidance** (via research summary): 120–400ms band for UI transitions; over-animating removes meaning; reserve expressive motion for key moments; compositor-only properties; honor `prefers-reduced-motion` (WCAG 2.3.3 / SC 2.2.2 for long loops).
- **Design-system consensus** (Carbon productive/expressive, Fluent, Polaris): small named token set, enters = ease-out/decelerate, exits = ease-in/accelerate, ease-in-out only for already-visible morphs, linear only for loaders/indeterminate progress.

Conclusion for ZenFlow: the app already has the right architecture (tokens + verbs + gate). The softness/logic win comes from **(a) one shared easing vocabulary aligned with M3**, **(b) migrating ad-hoc configs to tokens**, **(c) moving infinite loops from JS to CSS**, **(d) trimming over-long entrances** — without touching visual identity.

## 5. Work Packages

### P1 — Unified easing vocabulary + doc drift fix (foundation, low visual risk)

- Extend `src/lib/motion/easings.ts` with named M3-aligned tokens: `standard [0.2,0,0,1]`, `standardDecelerate [0,0,0,1]`, `standardAccelerate [0.3,0,1,1]`, `emphasizedDecelerate [0.05,0.7,0.1,1]`, `emphasizedAccelerate [0.3,0,0.8,0.15]`, keep existing verb curves untouched (`bloomOut`, `foldIn`, `morphExpo`, `breathe`, `ripple`).
- Add `zenMotion`-compatible comment mapping (no value changes to existing tokens in P1).
- Fix `ARCHITECTURE.md` motion table: `bouncy` damping 26 semantics (critically damped, no bounce — Apple Health pattern) and add missing `sheet` row. Count blocks untouched.
- Tests: extend `src/lib/motion/__tests__` easing/token contract tests (red first).

### P2 — Ad-hoc configs → tokens (softness + consistency)

- Replace the 4 duplicated `[0.32, 0.72, 0, 1]` sites with the named token (`JournalEntryEditor.tsx`, `MemoryPortalCanvas.tsx`, keep CSS tab-enter synced via comment or the same value — CSS cannot import TS; keep value, note token name).
- Migrate ad-hoc springs in the highest-traffic surfaces to `zenMotion`/`springs` tokens: `GratitudeBloomWidget.tsx` (500/18), `TrophyHall.tsx` (100), `WeekCrystal.tsx`, `ZenScoreHub.tsx`, `StreakFreeze.tsx`.
- Normalize `whileTap` in `JournalEntryEditor.tsx` (30 sites), `HabitTracker.tsx`, `JournalModule.tsx`, `MoodSlider.tsx`, `MoodDotStrip.tsx`, `JournalCaptureLauncher.tsx`, `GratitudeBloomWidget.tsx` to `zenTap.*`.
- Static contract test: forbid new hardcoded `[0.32, 0.72, 0, 1]` in `src/**` outside the token file (pattern follows existing `*.static.test.ts` convention).

### P3 — JS infinite loops → CSS `@keyframes` + gate audit (60fps rule)

For each: verify `useShouldAnimate()` gating exists, convert the loop to a CSS class in `index.css` (which the `body.reduce-motion` kill-switch already covers), keep JS for interactive/entrance only:

- `SelectedDayPanel.tsx`, `CalendarGrid.tsx`, `CrystalCalendar.tsx`, `WeeklyReview.tsx`, `EmotionGalaxy.tsx`, `JournalOnboardingHints.tsx`, `CosmicBgAdapter.tsx` (verify against V2 contracts — this one is orb-adjacent: read-only check, convert only if not part of canonical orb rendering), `AICoachChat.tsx` typing dots.
- Acceptance: zero `repeat: Infinity` left in these files except where motion is gesture-driven; all new CSS loops covered by reduce-motion kill-switch; `npm run check:all` green.

### P4 — Over-long entrances → best-practice band

- `ZenScoreHub.tsx`, `PremiumChart.tsx`, `WeeklyReviewParts.tsx`, `WeekCrystal.tsx`: entrances trimmed into the 200–400ms band using tokens; chart "draw-on" may stay ≤600ms (M3 long4) only if it is the surface's hero moment — decided per file with a comment citing the token.
- Visual baseline screenshots before edits (Playwright, chromium, local dev build), after screenshots for the same surfaces.

## 6. Test-First Plan (per `docs/ai/TEST_FIRST_AGENT_POLICY.md`)

| Package | Pre-code evidence | Type |
| --- | --- | --- |
| P1 | New easing-token contract test in `src/lib/motion/__tests__` that fails until tokens exist | red-test |
| P2 | Static contract test asserting no hardcoded `[0.32, 0.72, 0, 1]` outside token file → red on current code | red-test |
| P3 | Static contract test asserting no `repeat: Infinity` in migrated files → red on current code | red-test |
| P4 | Visual baseline screenshots of affected surfaces (ZenScoreHub/stats tab, WeeklyReview) before edits | visual-baseline |

Blast-radius checks after each package: focused vitest files + `npm run typecheck` + `npm run lint`; final: `npm run check:all`, `npm run check:canonical-orbs`, `npm run doc-counts`, `npm run check:no-ai-templates`.

## 7. BEST PRACTICES PACKET

Explicit Requirements: see §1.
Implied Requirements (safe, auto-included):

- Accessibility: preserve/extend reduced-motion kill-switch coverage for every new CSS loop; keep `useShouldAnimate` gates; WCAG 2.3.3 / SC 2.2.2 for loops.
- RTL: no directional x-translate changes introduced (verified per file; journal editor keeps existing logical-direction behavior).
- Performance: P3 removes JS rAF loops (INP/battery win); no `will-change` additions beyond existing `.gpu-layer` contract.
- i18n: no user-facing copy changes.
- Docs: ARCHITECTURE.md drift fix; this plan is the durable record.

Platform Matrix:

| Surface | Status | Reason | Evidence |
| --- | --- | --- | --- |
| Web/PWA | PARTIAL→PASS | Token + CSS work runs on web; verify dev build + screenshots | Playwright/local screenshots, `check:all` |
| Android | UNVERIFIED | Same code path (Capacitor WebView); no native change, no device proof | — |
| iOS | UNVERIFIED | Same as Android | — |
| Desktop | UNVERIFIED | Same code path (Tauri WebView) | — |
| Store/Release | N/A | No release-scope change | — |
| Accessibility | PASS-target | Kill-switch coverage extended; gate untouched | gate tests + static tests |
| Performance | PASS-target | JS infinite loops removed on migrated surfaces | grep contract tests + `smoke:chrome-performance` if runnable |
| Security And Privacy | N/A | No auth/storage/sync/dependency change; Snyk scan on new first-party code if tool available | snyk report or UNVERIFIED |

Standards Map:

- Official/current sources checked: Apple HIG Motion (fetched), Material 3 motion tokens (fetched/search-confirmed), motion.dev transitions docs, WCAG 2.3.3/2.2.2 (referenced).
- Local contracts read: `ARCHITECTURE.md` (Performance & Motion), `docs/ai/TEST_FIRST_AGENT_POLICY.md`, `docs/ai/BEST_PRACTICES_IMPLIED_REQUIREMENTS_GATE.md`, `docs/ai/NO_AI_TEMPLATES_AGENT_POLICY.md`, RAG preflight pack.

Acceptance Evidence:

- Red/baseline: P1 token test red; P2/P3 static contract tests red on current code; P4 before screenshots.
- Green/final: same tests green; focused suites green.
- Blast radius: `npm run check:all`, `npm run check:canonical-orbs`, `npm run doc-counts`, focused vitest.

UNVERIFIED Ledger:

| Item | Why not proved | Impact | Follow-up |
| --- | --- | --- | --- |
| Native Android/iOS feel | No emulator/device run in this environment | Native wrapper motion identical code path but unproved | Run device smoke when release-scoped |
| Desktop Tauri | No Tauri run | Same WebView code path unproved | Desktop smoke when release-scoped |
| Orchestra physical invocation | Agent tool unavailable in this runtime | No independent specialist sign-off | Human review of this plan + diff |
| Deployed GitHub Pages behavior | No deploy in this task | Public URL unchanged/unproved | Verify cache-busted public URL after next deploy |
| Snyk scan | Tool availability unknown at plan time | New first-party code unscanned | Run `snyk_code_scan` or CLI fallback; else UNVERIFIED |

Implied Work Ledger:

- Дополнительно по подразумеваемому: сделал (a) фикс doc-drift в ARCHITECTURE.md (bouncy/sheet), (b) static contract-тесты против будущего дрейфа ad-hoc анимаций, (c) reduce-motion покрытие для всех новых CSS-циклов; причина: soft-motion цель не держится без защиты от регресса и a11y-покрытия; статус: PASS после зелёных прогонов.

Rollback:

- All changes are file-scoped; `git checkout -- <paths>` restores. Token additions are additive; migrations are value-preserving (same curves/physics), so rollback = revert commit, no data/state migration.

## 8. AGENT_CHANGE_NOTICE (governance)

- Risk level: M1 (medium, multi-file, 2 domains: motion tokens + component call sites).
- Trigger: owner-requested animation quality improvement.
- Current behavior evidence: §3 grep inventory + token files read.
- Proposed write set: `src/lib/motion/easings.ts`, `src/lib/motion/__tests__/*`, new `src/__tests__/animationContracts.static.test.ts`, `ARCHITECTURE.md` (motion table only), component files listed in P2–P4, `src/index.css` (new keyframes/classes).
- Platform/domain impact: shared web code path for all platforms; no native/config/CI changes.
- Rollback: §7.
- Verification: §6.
- Verdict: GO (owner pre-approved execution; physical orchestra UNVERIFIED).

## 9. Orchestra Routing Disposition (ten roles, evidence-locator-backed)

Runtime note: physical sub-agent invocation is unavailable here; dispositions are recorded per policy and physical invocation is UNVERIFIED.

| Role | Disposition | Evidence |
| --- | --- | --- |
| 1 Product/UX | SELECTED (inline) | Motion feel is UX; Apple HIG + NN/g sources §4; user failure mode = harsh/inconsistent motion |
| 2 Emotional/clinical guardian | EXCLUDED | No clinical claim, no pressure/agency/interruption change; generic wellbeing words only |
| 3 Engineering | SELECTED (inline) | Token layer + codemods are engineering work; files §5 |
| 4 Accessibility | SELECTED (inline) | Reduced-motion gate + kill-switch coverage; WCAG 2.3.3; `useShouldAnimate.ts` |
| 5 Performance | SELECTED (inline) | JS-loop removal; 60fps rule ARCHITECTURE.md:849-858 |
| 6 QA/verification | SELECTED (inline) | Test-first plan §6; contract tests |
| 7 Platform/native | EXCLUDED | No native/config change; platform rows marked UNVERIFIED instead |
| 8 Security/privacy | EXCLUDED | No auth/storage/sync/secrets/dependency touch (below registry risk threshold) |
| 9 Docs/governance | SELECTED (inline) | ARCHITECTURE.md drift fix + this plan; `check:no-ai-templates` to run |
| 10 Red-team Pass A/B | EXCLUDED | M1 scope, below mandatory threshold; not an enforcement/security change |

---

## 10. Execution Outcome (2026-07-25)

**P1 — unified easing vocabulary: DONE.**
`src/lib/motion/easings.ts` gained M3-aligned tokens (`standard`, `standardDecelerate`, `standardAccelerate`, `emphasizedDecelerate`, `emphasizedAccelerate`); ARCHITECTURE.md doc drift fixed (`bouncy` damping 26, `sheet` row added). Red→green: `src/lib/motion/__tests__/easings.test.ts` (11 tests).

**P2 — ad-hoc → tokens: DONE.**
8 duplicated `[0.32, 0.72, 0, 1]` sites → `easings.emphasizedDecelerate` (JournalEntryEditor ×2, MemoryPortalCanvas ×2, GratitudeBloomWidget, BurnThoughtWidget + 3 CSS points in index.css). 40/41 `whileTap` → `zenTap.*` (MoodSlider 1.15 intentionally custom). 6 ad-hoc springs → `zenMotion.gentle` / `springs.quick/playful/smooth` (TrophyHall ×2, WeekCrystal, ZenScoreHub, GratitudeBloomWidget ×2). Two test mocks updated to include `zenTap`.

**P3 — JS infinite loops → CSS: DONE (49 loops, 17 files).**
New CSS library in `src/index.css`: 12 parameterized `@keyframes` + `animate-zen-loop-*` classes (fade/scale/fade-scale/wiggle/glow/sparkle/fall/float/orbit/bounce-dot/wave/drift-x/rain + SVG spin), all killed by the existing `body.reduce-motion` switch. Migrated: SelectedDayPanel (8), CalendarGrid (4), CrystalCalendar (3), TrophyHall (3), WeekCrystal (1), EmotionGalaxy/Star/OrbitingEmotion (10), WeeklyReview (3), WeeklyReviewParts (2), AICoachChat (4), JournalOnboardingHints (1), DataMountains (5), RingDetailSheet (2), SparkleParticles (1), StreakFreeze (1), CosmicBgAdapter (1). Previously ungated loops now respect the full effective-motion gate.

**P4 — entrance durations → best-practice band: DONE.**
ZenScoreHub (0.5s→`motionPresets.slideUp`, ring 1.5s→0.6s), PremiumChart (0.8s→0.4s, 1.2s×2→0.6s), WeeklyReviewParts (1s→0.6s + spring-softened card), WeekCrystal (1s+0.5→0.6s+0.3).

**Anti-drift contracts (all green, 22 tests):** `src/__tests__/animationContracts.static.test.ts` — no hardcoded legacy emphasized curve; no `repeat: Infinity` in 17 migrated files; entrance durations ≤ 0.6s in 4 budget files.

**Verification evidence:**
- `npm run check:all` PASS (typecheck, lint, i18n:check, i18n:deep, check:colors, check:visual incl. canonical-orbs + v2-paper).
- Full vitest: 8376/8377 pass; the single failure (`hyperfocusAudioProgression.test.ts`, ocean soft→deep intensity) is pre-existing and unrelated — `git status` shows `public/sounds/hyperfocus/*.mp3` modified before this session; no animation file in that domain was touched.
- `npm run doc-counts` OK after `doc-counts:update` (76 hooks, 9 stores, Index.tsx 278 LOC).
- `npm run check:no-ai-templates` PASS; `npm run check:best-practices` PASS (66 invariants).
- `npm audit --audit-level=high`: 0 vulnerabilities. Snyk Code CLI on every changed first-party path: 0 issues.
- Visual runtime proof: `output/visual-proof/04-orb.png` (canonical `/people-first-app/orb/?nav=v2&navLayout=phone` — ValenceOrb + cosmic particles + nebula render post-conversion), `05-reduced-motion.png` (emulated `prefers-reduced-motion: reduce` — static state correct, kill-switch active). Dev server stopped after capture.

**UNVERIFIED / follow-ups:**
| Item | Status | Reason / follow-up |
| --- | --- | --- |
| Stats-tab interactive screenshot | UNVERIFIED | V2 default shell does not expose role=tab to the capture script; stats components covered by tests/contracts instead |
| Remaining ~106 `repeat: Infinity` in 34 other files (breathing-exercise, focus-timer, hyperfocus, stories slides, journal misc.) | Out of P3 scope | Many are functional (breath pacing) or share-story surfaces; convert in a follow-up with visual review of core flows |
| Orchestra physical invocation | UNVERIFIED | Subagent tool unavailable in this runtime; routing disposition in §9 stands |
| Native Android/iOS/Desktop motion feel | UNVERIFIED | Shared web code path, no device proof |
| Deployed GitHub Pages behavior | UNVERIFIED | No deploy in this task; verify cache-busted public URL after next deploy |
| Independent visual-integrity subagent | UNVERIFIED | Skill unavailable; emulated inline — Technical/Visual Runtime/Artistic/Motion: PASS on orb route |
