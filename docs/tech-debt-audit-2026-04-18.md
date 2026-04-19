# Technical Debt Audit — ZenFlow (2026-04-18)

**Scope:** Whole-project tech debt. Complement, not replacement, for `docs/audit/backlog-2026-04-18.md` (Phase-3 re-triage).
**Method:** 1 web research pass (2024-2026 sources) + 4 parallel analyses (code / architecture / perf / security).
**Baseline commit:** `86f57e6` (HEAD, 2026-04-18).
**Mode:** READ-ONLY audit. No code modified.

---

## 1. Executive Summary

ZenFlow is **structurally healthy** (0 TS errors, 0 lint warnings, 0 circular deps, 0 npm CVEs, 0 silent catches in prod, manualChunks TDZ-safe, full-store subscribers eliminated). The ratchet system is **real** enforcement — not theatre — and Law 27 is doing work.

But there are **five real pressure points** that will block v2.0 if left untouched:

1. **Doc drift is the single biggest Reality-Anchor failure** (Law 6). `CLAUDE.md` and `ARCHITECTURE.md` have understated hooks by 39% (54→75) and stores by 175% (4→11) for weeks. Every downstream reasoning chain is seeded from lies.
2. **Journal feature is a god-module.** `JournalModule.tsx` 1885 LOC, `JournalEntryEditor.tsx` 1759, `useJournalEditorState.ts` 1209 with 46 useState + 15 useEffect. A single bug in `useJournalEditorState` can silently corrupt drafts — test coverage can't shield from complexity this dense.
3. **63 MB of WAV files in `public/sounds/`** — 32 MB single file. Ships in the bundle. Law 8 (60 FPS) isn't violated; Law 5 (Loud Failure) silently is: app cold-start on cellular gets punished.
4. **Upgrade cliff approaching.** Tailwind 4 (Jan 2025), Vite 7 (Jun 2025, needs Node 22.12+), React 19 are all released. Staying on Vite 6 / Tailwind 3 / React 18 is accruing compound interest; mobile-specific packages (recharts 2→3, vaul 0, fake-indexeddb 5→6) will eventually force a chain upgrade under time pressure.
5. **Legacy V2 coexistence.** 21 V2 files (`navigation-v2/`, `MoodSliderV2`, `ThemeToggleV2`, `IndexV1Impl`) with no sunset date. Every bug report now requires "which version?" triage overhead.

**SQALE-style Maintainability Rating: B** (SonarQube 2025.3 grid).
Reasoning: overall debt ratio is moderate (~60-80 eng hours over a ~~large codebase → <0.10), but journal module alone would score D in isolation.

**Fowler Quadrant:** Majority **Prudent / Inadvertent** (structural growth faster than refactoring). Journal god-components are **Prudent / Deliberate** (shipped to hit v1.7.2 window). Doc drift is **Reckless / Inadvertent** — no one's fault but no one owns the fix either.

---

## 2. Evidence Snapshot (2026-04-18, HEAD=86f57e6)

| Metric | Value | Source |
|---|---|---|
| TS errors | **0** | `tsc --noEmit` |
| ESLint warnings | **0** | `eslint .` |
| Circular deps | **0** | `madge --circular` |
| `as any` (total) | **143** | grep |
| &nbsp;&nbsp;└ in tests | **128** (Dexie mocks) | grouped grep |
| &nbsp;&nbsp;└ in production | **~15** | delta |
| TODO/FIXME/HACK | **21** | grep |
| `it.todo(` | **73** | grep (useAuthSession alone ~45) |
| `.skip()` tests | **1** | grep |
| Files >500 LOC (non-i18n, non-types) | **≈20** | wc -l |
| Knip unused files | **103** | `knip --no-progress` |
| `fixed inset-0.*md:max-w-` instances | **65** (16 bypass ModalLayer) | grep |
| V2 coexistence files | **21** | find |
| npm outdated | **29** | `npm outdated` |
| npm audit CVEs | **0** all severities | `npm audit` |
| Snyk code scan | 2 real (1 High XSS / 1 Medium) + 9 FPs (i18n) | Snyk |
| Bundle budget | **1560 KB gzip / 5300 KB raw** | `.size-limit.json` |
| Public sounds bloat | **63 MB** of uncompressed WAV | ls |
| Hooks count | **75** (CLAUDE.md claims 56) | ls |
| Stores count | **11** files, 8 runtime + 2 bridges + index (CLAUDE.md claims 4) | ls |
| `Index.tsx` LOC | **606** (ARCHITECTURE.md claims 452) | wc -l |
| Top-level `src/components/` dirs | **43** (features masquerading as components) | ls |
| `src/features/` modules | **1** (journal only) | ls |
| Dexie schema versions | **8** | db.ts |
| Tailwind / React / Vite | **3.4.17 / 18.3.1 / 6.4.1** | package.json |
| Node engines pinned | **NO** (empty `engines`, no `.nvmrc`) | package.json |
| Android targetSdk | **35** ✓ (Google Play mandate met) | AndroidManifest.xml |

---

## 3. Findings by Severity

### P0 — Must fix before v2.0

| # | Finding | Evidence | Fix |
|---|---|---|---|
| P0-1 | **Doc drift in CLAUDE.md + ARCHITECTURE.md** — "4 stores / 56 hooks / Index.tsx 452 LOC" | Actual: 11 / 75 / 606 | Rewrite Codebase Metrics table; add CI check `scripts/check-doc-drift.ts` that fails PR if counts drift >5% |
| P0-2 | **`public/sounds/` = 63 MB WAV** — 32 MB + 20 MB + 8.6 MB | `ls public/sounds/` | Transcode WAV→Opus 96 kbps (10-20× reduction); lazy-load via Capacitor Filesystem on ambient activation |
| P0-3 | **`useJournalEditorState.ts`: 1209 LOC, 46 useState, 15 useEffect** | wc -l + grep | Split into `useJournalDraft` / `useJournalAutosave` / `useJournalMedia` / `useJournalPrompts` |
| P0-4 | **Ratchet hardcoded-colors FAIL** — 1283 > 900 floor | `npm run check:colors` per backlog-2026-04-18 | Not in this audit's scope but blocks commit-gate; already tracked in backlog |
| P0-5 | **Memory file `project_owasp_remaining_fixes.md` is stale** — all 6 "remaining" are actually fixed | Agent verified M3/L16/L17/L18/L19 in-code | Update memory to "0 remaining, verified 2026-04-18"; stop citing as outstanding |

### P1 — Blocks v2.0 quality goal (OKR 7.6→9.0)

| # | Finding | Evidence | Fix |
|---|---|---|---|
| P1-1 | **`JournalModule.tsx` 1885 LOC, 18 useState, 14 useEffect** | wc -l | Extract view-state machine + subtab router |
| P1-2 | **`JournalEntryEditor.tsx` 1759 LOC, 56 local fns** | wc -l + grep | Split toolbar / attachments / block-renderers |
| P1-3 | **`orbRenderer.ts` 1697 LOC, 272 fns** (but pure module, no RAF allocations) | wc -l + grep + RAF scan | Decompose by GL pass (uniforms / geometry / shading / post). Hotspot per CodeScene definition |
| P1-4 | **Index.tsx 606 LOC** (doc target 452, +34% growth in 2 months) | wc -l | Extract `useIndexHandlers()` umbrella + `<TabRouter>`; add ratchet `IndexTsxLOC <= 450` |
| P1-5 | **65 inline modal plumbing sites, 16 bypass ModalLayer** | grep `fixed inset-0.*z-\[` | Extract `<StandardModal size>` primitive per `.claude/rules/modal-standard.md`; ESLint rule banning raw pattern |
| P1-6 | **Bundle gzipped 1560 KB budget** (3× Core Web Vitals best practice 500 KB) | `.size-limit.json` | Tighten ratchet to 1200 KB next sprint; lazy-load `StateOfMindModal` (eager today) |
| P1-7 | **Snyk High XSS — ErrorBoundary blob export** at `src/components/ErrorBoundary.tsx:43,69` | Snyk scan | Wrap report JSON in `DOMPurify.sanitize` before Blob construction, or strip `error.stack` more aggressively |
| P1-8 | **Node version NOT pinned** — `.nvmrc` missing, `package.json engines` empty | cat check | Add `.nvmrc` with `22.12.0`, set `"engines": { "node": ">=22.12 <23" }` — required for Vite 7 upgrade anyway |
| P1-9 | **73 `it.todo(`** (useAuthSession dominates) — tests that haven't been written in months | grep | Convert 30 most valuable to real tests; delete the rest (todo rots per Google 2024 research) |
| P1-10 | **Feature-slice drift** — 43 component top-level dirs vs 1 feature module | ls | Migrate 6 highest-coupling to `src/features/` (stats, state-of-mind, stories, share, challenges, mindmap); establish policy |

### P2 — Accumulating interest (address opportunistically)

| # | Finding | Evidence | Fix |
|---|---|---|---|
| P2-1 | **21 V2 coexistence files** with no V1 sunset | find | Set sunset date post-v2.0 ship; delete `IndexV1Impl` + `navigation-v2/` V1 siblings; rename V2 → canonical |
| P2-2 | **103 knip unused files** — ~40 true duplicates (e.g. top-level `AICoachChat.tsx` + `ai-coach-onboarding/` dir) | knip | Purge top-level duplicates + `lib/noop.ts` + stale `claudeAgent.ts`; **verify before delete** — 3 are false positives (`ReviewPlugin*` is Capacitor-registered) |
| P2-3 | **11 stores, up from 4** — coupling smell: 6 files consume 3+ stores | grep | Store-coupling ratchet `MaxStoresPerConsumer <= 3` |
| P2-4 | **`ambientSounds.ts` 1275 LOC, 60 fns** — singleton audio engine | wc -l + knip graph | Split into `AudioGraph` + `SoundRegistry`; validate single-consumer claim before decomposition |
| P2-5 | **28 npm outdated** — all 3 major-upgrade families pending (Vite 6→8 via 7, Tailwind 3→4, React 18→19) | `npm outdated` | Staged upgrade: Vite 7 → Tailwind 4 → React 19, each on feature branch with ratchet snapshot (see §5) |
| P2-6 | **1 Medium Snyk XSS** — AuthScreen debugInfo OAuth URL leaks to DOM | Snyk trace | Gate `setDebugInfo` behind `import.meta.env.DEV` |
| P2-7 | **Dexie schema at v8** — no v1→v8 round-trip migration test | storage/db.ts | Add migration property-test in `__tests__/db.migrations.test.ts` |
| P2-8 | **245 animations without `motion-safe:`** per backlog | grep | A11y debt; `prefers-reduced-motion` ignored |
| P2-9 | **79 `backdrop-blur` sites missing `-webkit-backdrop-filter`** per backlog | grep | iOS Safari rendering debt (Law 10 cross-platform) |
| P2-10 | **`framer-motion` stays in main chunk** (TDZ-safe, correct) — ~60 KB always loaded | vite config | Migrate low-criticality animations to CSS transitions; no chunking change |

### P3 — Cosmetic

| # | Finding | Evidence | Fix |
|---|---|---|---|
| P3-1 | 5 dead comment blocks (onboardingFlow.ts:393, sw.ts:113, useIndexedDB.ts:176, main.tsx:178, cloudSync.ts:34) | grep | Delete or document |
| P3-2 | **214 docs MD files** (33 top-level + 9 subdirs); law files split 16/17-20/21-28 inconsistently | ls | Consolidate into `docs/laws/`; archive `research-*` >60 days old |
| P3-3 | i18n Snyk "password" findings (9 FPs) | Snyk | Add to `.snyk` ignore with justification OR rename keys `journalPasscode*` |
| P3-4 | Missing `"engines"` field — not a blocker until Vite 7 but good hygiene | package.json | Set `">=22.12"` now |

---

## 4. Ratchet Gap Analysis

The ratchet system (Law 27) enforces 185 → 206 files, 3626 → 3786 tests, 46 → 28 npmOutdated — good cadence. **Metrics the ratchet does not yet lock:**

- `IndexTsxLOC` (currently 606, target ≤450)
- `HookCount` (currently 75)
- `StoreCount` (currently 11)
- `ComponentsTopLevelDirs` (currently 43)
- `ModalInsetBypass` (currently 16)
- `V2CleanupDebt` (currently 21)
- `PublicAssetsMB` (currently 63 MB sounds)
- `ItTodoCount` (currently 73)
- `GodFileCount` (files >1000 LOC non-exempt, currently 6)
- `BundleBudgetKB` (currently 1560 gzip, tighten toward 1200)

Add all 10 in one ratchet bump PR after this audit lands.

---

## 5. Upgrade Roadmap (P1 Dependency Debt)

Research consensus (Perficient Dec 2025 / Vite blog / Tailwind 4 docs): stage dependent-family upgrades in a specific order to isolate breakage.

**Stage 1 (week 1, branch `upgrade/vite-7`):**
- Add `.nvmrc` = `22.12.0`
- Update Node engines to `">=22.12 <23"`
- `vite 6 → 7` (Node 20.19+/22.12+ required; Sass legacy API + `splitVendorChunkPlugin` dropped; target = `baseline-widely-available`)
- `@vitejs/plugin-react 5 → 6`
- `vitest 3 → 4` + `@vitest/coverage-v8`
- `jsdom 24 → 29`, `fake-indexeddb 5 → 6`
- Ratchet snapshot; if any ratchet regresses → abandon branch

**Stage 2 (week 2, branch `upgrade/tailwind-4`):**
- Run `@tailwindcss/upgrade` codemod (handles ~90% mechanically)
- Manual: `bg-gradient-to-*` → `bg-linear-to-*`, default border color change to `--color-gray-200`, CSS-first `@theme` config
- Check `vaul` + `recharts` Tailwind-dependent classes
- `style-dictionary 4 → 5` (tokens pipeline)
- Verify visual-regression Playwright baselines (current golden-path E2E)

**Stage 3 (week 3, branch `upgrade/react-19`):**
- `react 18 → 19`, `react-dom 18 → 19`, `@types/react 18 → 19`
- `react-day-picker 8 → 9`, `recharts 2 → 3`
- `eslint-plugin-react-hooks 5 → 7` (stricter exhaustive-deps)
- Budget 3-4 days testing per Perficient empirics; keep IndexV1Impl as rollback escape hatch
- **Ship v2.0 after this stage passes**

Stage 4 (post-v2.0):
- `zod 3 → 4`, `eslint 9 → 10`, `lucide-react 0 → 1`, `@tanstack/react-query` patch
- `vaul 0 → 1` (bottom sheet library — UI-visible)

---

## 6. Remediation Economics

Per Google 2024 research (arXiv 2403.06484), developers lose **23-36%** of time to debt; ZenFlow's pain concentrates in journal module and orb renderer.

| Category | Eng hours | Notes |
|---|---|---|
| Doc drift fix | 1h | CLAUDE.md + ARCHITECTURE.md metrics refresh |
| WAV transcoding | 4h | Batch script + lazy-load plumbing |
| Journal decomposition | 40h | 4 god-files, highest value-at-risk |
| Modal `<StandardModal>` extraction | 8h | 65→1 primitive; ESLint rule |
| Knip dead-file purge | 6h | ~40 safe, ~60 needs verification |
| `it.todo` triage | 10h | 30 promoted, 43 deleted |
| V2 coexistence cleanup (post-v2.0) | 6h | Delete after confirmation |
| Feature-slice migration (6 modules) | 24h | Stats + state-of-mind + stories + share + challenges + mindmap |
| Upgrade Vite/Tailwind/React (3 stages) | 32h | Includes regression testing |
| Hardcoded colors 1283 → 900 | 20h | Per existing backlog |
| Snyk XSS fixes (2 real) | 3h | DOMPurify wrap + env gate |
| **Total P0+P1+P2** | **~154h** | ~4 dev-weeks focused |

Advanced Boy Scout Rule (Qafoo / CodeScene) + 1 weekly hotspot sprint is the empirically recommended hybrid — pure refactoring sprints stall delivery, pure opportunistic cleanup can take "189 years" for large codebases (Nijhof-Verhees Medium, 2024).

---

## 7. Recommended Sprint Plan

**Sprint A (v2.0 blockers, 1 week):** P0-1 + P0-2 + P0-5 + P1-8. Low risk, high signal.
**Sprint B (journal decomposition, 2 weeks):** P0-3 + P1-1 + P1-2. Isolated to one feature.
**Sprint C (upgrade path, 3 weeks):** Stage 1-3 from §5.
**Sprint D (architecture debt, parallel):** P1-4 (Index.tsx) + P1-5 (ModalLayer extraction) + P1-10 (feature-slice migration).
**Continuous (Advanced Boy Scout):** P2-1..P2-10 as touched, one hotspot sprint every 2 weeks driven by CodeScene if adopted.

Ratchet additions land in Sprint A as a single PR.

---

## 8. Honest Self-Reflection

A brief moral audit of my own (previous sessions') claims and habits.

### 8.1 What I got wrong in prior sessions

- **"4 Zustand stores" and "56 hooks"** have been in `CLAUDE.md` for weeks. I repeated them without verifying. Reality: 11 / 75. Law 6 (Reality Anchor) violation, multiple sessions. Downstream reasoning chains were seeded with false premises, which is worse than ignorance.
- **"OWASP 6 remaining fixes"** — I cited this memory file as outstanding work as recently as my prior planning. The security agent verified all 6 are already fixed in-code. I was technically truthful ("the memory file says...") but functionally misleading. Memory without re-verification = stale fact cosplaying as current state.
- **"`as any` = 143, type debt is severe."** Closer look: 128/143 are in test files (mostly Dexie `Table` typing shims). Production `as any` is ~15. My previous framing inflated severity by ~10×. A Dexie-mock helper collapses this class entirely — it's a 2-hour fix, not a ratchet crisis.
- **"Index.tsx is a 452-line orchestrator, justified by ARCHITECTURE.md."** True on 2026-02-15. As of today: 606 LOC. I never re-measured.

### 8.2 What I cannot verify today

- **`ratchet.json` location** — could not find on filesystem via `find`. `scripts/check-ratchet.ts` references it via `path.join(ROOT, ...)` but the actual ratchet ledger file was not located in this pass. May live under a different name (`.quality-ledger.json` or embedded in the script). **Action:** trace `check-ratchet.ts` imports more carefully next session.
- **Whether the 28 laws actually prevent what they claim.** I have not systematically traced a forbidden action (e.g., commit with 46 `as any`) through the hook chain to confirm it's blocked. The hook configuration is real; the enforcement power is asserted, not measured.
- **Bundle size real number** — I did not run `vite build` in this audit. `.size-limit.json` is the *budget*, not the *current size*. Current could be 800 KB or 1550 KB.
- **CodeScene / SonarCloud integration** — not installed. My "SQALE B" rating is a directional estimate, not a measured score.
- **Knip's 103 unused files** — 3+ are confirmed false positives (`ReviewPlugin*` are Capacitor native-registered). The true count is probably 70-90. Don't mass-delete without per-file verification.

### 8.3 Patterns I should stop repeating

- **Citing memory files as facts without a re-verification step.** Memory is frozen snapshots; code is the ground truth. Every load-bearing claim from memory should be re-greppped before it drives a decision.
- **Treating doc counts as authoritative.** `CLAUDE.md` said 56 hooks; reality is 75. The fix is structural: every count in `CLAUDE.md` needs a `<!-- generated: scripts/doc-counts.cjs -->` marker and a CI check that regenerates it.
- **Confusing "laws exist" with "laws work."** The 28-law corpus is prescriptive. Its hook-enforcement is real. But there's a gap between "hook fires" and "hook blocks the offending behavior" — I've been treating them as identical.

### 8.4 What surprised me (positive)

- **Silent catches eliminated.** Zero `catch(() => {})` in production code. Law 5 is genuinely enforced.
- **Orb renderer is NOT a god-component despite 1697 LOC.** It's a pure functional module with no RAF-internal allocations. The animation loop in `ValenceOrb.tsx` has exactly one allocation (`new Uint8Array(4)` outside the loop). Either good engineering or excellent restraint.
- **Full-store subscribers eliminated.** All 48 `useUserDataStore()` consumers use selector pattern. Zero re-render risk from this source.
- **Android targetSdk = 35.** Google Play Aug 2025 mandate met without fanfare.

### 8.5 Open question I am flagging now, not answering

If the Ratchet Law (Law 27) is doing its job *and* we still accumulated ~60-80 hours of new debt in 30 days (per `backlog-2026-04-18.md` 5 new findings post-2026-03-19), then the ratchet coverage is **too narrow**. The metrics it locks (hardcoded colors, file count, test count, npm outdated) miss LOC per file, stores count, hook count, modal bypass count. Recommendation §4 widens this. But a deeper question: **what is the theoretical minimum metric set that would have prevented `useJournalEditorState.ts` from reaching 1209 LOC with 46 useState?** I do not have an empirical answer and am unwilling to guess.

---

## 9. Sources

- SonarQube Server 2025.3 metrics definition
- Google 2023 "Defining, Measuring, and Managing Technical Debt" (arXiv 2403.06484)
- "Measuring Debt's Development Effort" (arXiv 2502.16277, Feb 2025)
- Martin Fowler — TechnicalDebtQuadrant.html
- PromptDebt (arXiv 2509.20497, Sep 2025)
- Tailwind v4 upgrade guide (tailwindcss.com, Jan 2025)
- Vite 7 announcement (vite.dev, Jun 2025)
- React 19 migration (Perficient, Dec 2025)
- Capacitor 8 upgrade + Android target SDK (capacitorjs.com)
- CodeScene hotspot research (Tornhill, 2024)
- Advanced Boy Scout Rule (Qafoo, 2024)
- Nijhof-Verhees "Boy Scout can take 189 years" (Medium, 2024)
- Internal: `docs/law26-techdebt.md`, `docs/audit/backlog-2026-04-18.md`, `ARCHITECTURE.md`, memory/* files

---

*End of original audit. Section 10 below was appended in the deep-scan extension pass on 2026-04-18.*

---

## 10. Deep-Scan Extension — 10 Categories the First Pass Missed

The original audit (§1-9) focused on code-level, architectural, perf, and security debt. This extension covers **10 categories that a mobile mental-wellness app heading to v2.0 should audit but the first pass did not**: accessibility depth, observability, privacy/GDPR, test pyramid, bundle composition, error recovery patterns, mobile lifecycle edge cases, TypeScript type depth, API contract drift, and OSS licensing/attribution.

Research citations are 2024-2026 only. Every finding has a file:line / command / measurement.

### 10.1 Accessibility depth (WCAG 2.2) — **P1**

**Research consensus (2024-2026):** WCAG 2.2 (W3C Recommendation, Oct 2023) adds 9 criteria. Three are touch-critical: **Target Size Minimum 2.5.8** (24×24 CSS px Level AA), **Dragging Movements 2.5.7**, **Focus Appearance 2.4.13** (AAA). `@axe-core/playwright` is the canonical CI integration.
Source: [W3C Understanding 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

**ZenFlow measurement:**
- Touch-target rule already 44px (exceeds 24px AA requirement). GREEN.
- **aria-label coverage: 39.8%** (168/422 `<button>` openings with labels within 5 lines). **254 buttons missing labels.** Top offenders: `src/components/settings/AboutSection.tsx` (7), `src/features/journal/JournalStickerPicker.tsx` (6), `src/components/TimeHelper.tsx` (6), `src/components/habit-hub/HabitDetailSheet.tsx` (6), `src/components/habit-hub/AddHabitFrequencySection.tsx` (6), `src/components/ErrorBoundary.tsx` (5).
- `prefers-reduced-motion` per prior backlog: **245 animations** without `motion-safe:` — documented, unfixed.

**Fix (deferred, separate session):** Ratchet `ariaLabelCoverage >= 80%`; install `@axe-core/playwright`; add e2e-a11y step that scans each TabType route; migrate the 7 top offenders first.

### 10.2 Observability / SLO — **P2**

**Research consensus:** OpenTelemetry JS has GA Traces + Metrics, browser instrumentation is **experimental**; Sentry React 19 guidance wires `reactErrorHandler` + `onUncaughtError` + `onCaughtError` on `createRoot`; replay must be disabled on iOS pre-ATT-consent.
Source: [OpenTelemetry JS Status](https://opentelemetry.io/docs/languages/js/); Sentry docs 2025.

**ZenFlow measurement:** Sentry init is **complete** — `src/lib/sentry.ts` has environment=MODE, release=`zenflow@${__APP_VERSION__}`, tracesSampleRate (0.05 native / 0.10 web), replaysSessionSampleRate=0.1, replaysOnErrorSampleRate=1.0, beforeSend filters AbortError + chunk errors, DJB2-hashed userId, replay masks text/inputs/media. All 6 criteria met. **GREEN.**

**Gap:** no `reactErrorHandler` wiring on `createRoot` (relevant when React 19 ships). No OpenTelemetry. Consider when upgrading to React 19 in Stage 3.

### 10.3 Privacy / GDPR / store declarations — **P2**

**Research consensus:** GDPR Art. 15(3) = right to a copy in electronic form. Google Play Data Safety must declare data transmitted by **third-party SDKs and WebView**, not just first-party code.
Source: [GDPR Art. 15](https://gdpr-info.eu/art-15-gdpr/); [Play Data Safety guide](https://support.google.com/googleplay/android-developer/answer/10787469).

**ZenFlow measurement:**
- DSAR: `src/features/journal/journalImport.ts` + export exists. Zod-validated. ✓
- SDK drift: `npm ls --prod` needs to be diffed against Play Console Data Safety declaration on every dep bump. **No automation today.**
- ATT (iOS App Tracking Transparency): not surfaced — iOS build pending; track for v2.0 iOS ship.

**Fix:** Add `scripts/check-data-safety-drift.ts` comparing `npm ls --prod --json` hash vs last-declared hash; fail PR on drift.

### 10.4 Test pyramid — **P2**

**Research consensus:** Fowler's "Practical Test Pyramid" canonical; healthy ratio unit:integration:e2e ≈ 20:5:1; E2E flaky rate **<1%**.
Source: [martinfowler.com/articles/practical-test-pyramid](https://martinfowler.com/articles/practical-test-pyramid.html).

**ZenFlow measurement:**
- Unit+integration: **3786 test-ratchet floor.** Healthy volume.
- E2E: Playwright present; visual-regression `visual-regression.yml` workflow (see memory `feedback_local_vs_pushed_state.md` — prior session found it **inert** until merged). Verify status before v2.0.
- **`it.todo` = 73** (mostly `useAuthSession.test.ts`) — test debt not flaky but eroding.

**Fix (deferred):** triage 73 todos per §7 original audit. Track E2E flaky rate in CI.

### 10.5 Bundle composition — **P2**

**Research consensus:** `rollup-plugin-visualizer` (2.4k★) is Vite-native; `treemap/sunburst/flamegraph` + gzip/brotli sizes. 3G median TTI budget ≈ 200 kB gzip JS.
Source: [rollup-plugin-visualizer](https://github.com/btd/rollup-plugin-visualizer).

**ZenFlow measurement:**
- `.size-limit.json`: **1560 kB gzip budget** — 3× mobile 3G budget. manualChunks TDZ-safe.
- Not currently visualized per commit.

**Fix:** Add `vite-plugin-visualizer` in dev-only config + a CI artifact step publishing `dist/stats.html`. Tighten budget in sprints.

### 10.6 Error recovery patterns — **P2**

**Research consensus:** Capped exponential backoff **with jitter** (AWS Builders' Library); classify network→retry, 4xx→no, 5xx→retry.
Source: [AWS Backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/).

**ZenFlow measurement (updated 2026-04-18 Stage 5 + honest calibration):**
- `src/lib/retry.ts` **LANDED** with `retryWithBackoff` + `CircuitBreaker` + `delaysMs` option + 28 tests.
- **2 sites migrated:** `appUpdateManager.ts` (`withRetry`) and `lazyWithRetry.ts` (chunk retry). 9+8=17 existing behavior tests pass unchanged — migration is byte-identical via `delaysMs` + `classifyError` + `onRetry` hooks.
- **Honest reclassification of the "112 matches":** most are NOT migratable N-attempt-backoff loops. Breakdown after manual review:
  - Done (2): `appUpdateManager.withRetry`, `lazyWithRetry`
  - State machines, not loops (skip): `syncOrchestrator.ts` (14 hits), `syncStateMachine.ts` (13 hits)
  - Single-retry flows, different semantics: `apiClient.ts` (6 hits — 401-after-refresh), `nativeGoogleAuth.ts` (6 hits — nonce-mismatch once)
  - Delegation log references: `tasksCloudSync.ts` (4 hits — "will retry via orchestrator")
  - Candidates remaining: `ambientSounds.ts` (17 hits — needs per-site check), `useDeltaSyncEffects.ts`, `PullToRefresh.tsx`, `ModalLayer.tsx`, `leaderboard/useLeaderboardData.ts` (10 hits)
  - Realistic remaining migratable loops: **~3-8**, not 110.

**Migration pattern proven:** use `delaysMs` array to preserve fixed schedule; wrap classifier logic in `classifyError`; log via `onRetry` callback; keep per-attempt timeout wrapper in caller (util intentionally does not own fn timeout).

### 10.7 Mobile lifecycle edge cases — **P1**

**Research consensus:**
- **Android 15 (API 35) edge-to-edge default** — apps draw behind system bars; must apply `WindowInsets`. ZenFlow targetSdk=35 ✓ (already met mandate).
- **Predictive back** requires `android:enableOnBackInvokedCallback="true"` + migration off legacy back handling.
- **iOS Dynamic Island** (iPhone 14 Pro+, iOS 16.1+) — use `env(safe-area-inset-top)` (baseline).
Source: [Android 15 behavior changes](https://developer.android.com/about/versions/15/behavior-changes-15); [Predictive Back](https://developer.android.com/guide/navigation/predictive-back-gesture).

**ZenFlow measurement:**
- `android/app/src/main/AndroidManifest.xml`: **no `enableOnBackInvokedCallback` attribute** → merged manifest injects default `false`. 188 `BackHandler`/`backButton`/`App.addListener` usages in `src/` — app relies entirely on legacy onBackPressed.
- `capacitor.config.ts`: `ios.contentInset: "automatic"` — baseline OK.
- **Zero Dynamic Island-aware markers** (`dynamic-island|DynamicIsland|data-has-dynamic`).

**Fix (deferred, device-test required):**
- Add `android:enableOnBackInvokedCallback="true"` to `<application>` in AndroidManifest. Migrate Capacitor `App.addListener('backButton', …)` handlers to `OnBackInvokedCallback` equivalents (Capacitor 8 API).
- Runtime Dynamic Island detection: `screen.height === 852 || 932` + `env(safe-area-inset-top) > 54px` → set `data-has-dynamic-island` on `<html>`, adjust `.capacitor-safe-area-top` banner positioning.

### 10.8 TypeScript type depth — **P2**

**Research consensus:** 2025 "strict-beyond-strict" = `strict:true` **+** `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `noImplicitOverride` + `useUnknownInCatchVariables`.
Source: [tsconfig/noUncheckedIndexedAccess](https://www.typescriptlang.org/tsconfig/#noUncheckedIndexedAccess).

**ZenFlow measurement:** `tsconfig.app.json` + `tsconfig.node.json`: `strict: true` ✓, `noFallthroughCasesInSwitch: true` ✓. **OFF: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`.**

Dexie row reads (`db.table.get(id)`) return `T | undefined`; without `noUncheckedIndexedAccess` the `undefined` slips through at runtime — potential `useEffect` crash source.

**Fix (deferred, HIGH scope — will introduce 100+ errors):** enable flags one-at-a-time behind a ratchet; start with `noUncheckedIndexedAccess` (biggest safety win for a Dexie-heavy codebase). Each flag is its own PR with type-migration work.

### 10.9 API contract drift (Supabase) — **P2**

**Research consensus:** Nightly GitHub Action `supabase gen types typescript --project-id $REF > database.types.ts` + auto-commit on diff; Pact for consumer-driven contract tests.
Source: [Supabase generating types](https://supabase.com/docs/guides/api/rest/generating-types).

**ZenFlow measurement:** `src/types/supabase.ts` mtime 2026-04-16 20:41 vs latest migration `20260417_nav_v2_flag.sql` mtime 2026-04-16 23:34. **Types are ~3 hours older than the latest migration. DRIFT DETECTED.**

**Fix (deferred, needs Supabase auth):** run `npx supabase gen types typescript --project-id <id> > src/types/supabase.ts` + commit. Add nightly GitHub Action.

### 10.10 OSS licensing / attribution — **P1 (partially fixed)**

**Research consensus:** Private apps still carry MIT/Apache-2.0/OFL attribution obligations. `license-checker` CI gate; iOS App Store review expects Acknowledgements screen.
Source: [license-checker](https://github.com/davglass/license-checker).

**ZenFlow measurement:**
- `LICENSE` file at root: **MISSING** (pending user decision on MIT vs proprietary).
- `THIRD_PARTY_NOTICES.md`: **CREATED THIS SESSION** (see repo root) — documents MixKit WAV attribution, SIL OFL fonts, Lucide ISC, runtime deps.
- `SECURITY.md`: **CREATED THIS SESSION** — responsible disclosure policy.
- `docs/adr/`: **CREATED THIS SESSION** with README + 0000-template + 0001 first ADR.
- `public/sounds/*.wav` = 4 MixKit files requiring attribution — now documented, but **not yet surfaced in-app** (iOS App Store requirement for v2.0).

**Fix (remaining):**
- Add `LICENSE` file — **user decision needed** (MIT for OSS release, proprietary for private).
- Build in-app Acknowledgements screen (Settings → About → Acknowledgements) rendering `THIRD_PARTY_NOTICES.md` — required for iOS App Store approval. Deferred to frontend sprint.

---

## 11. Deep-Scan Ratchet Additions (already landed)

`scripts/doc-counts.cjs` now tracks in ARCHITECTURE.md (auto-generated):
- `consoleLeaksInProd` (current: post-fix value)
- `adrFiles` count
- `SECURITY.md` / `CONTRIBUTING.md` / `LICENSE` / `THIRD_PARTY_NOTICES` / `CODEOWNERS` presence

CI fails on drift via `npm run doc-counts`.

---

## 12. Updated Remediation Economics (with Deep-Scan items)

| Category | Original estimate | Deep-scan additions | Revised total |
|---|---:|---:|---:|
| P0 (blockers) | 50h | +4h (LICENSE decision + in-app Ack screen) | 54h |
| P1 (v2.0 quality) | 60h | +20h (254 aria-labels, predictive-back native, Dynamic Island detection) | 80h |
| P2 (interest) | 44h | +26h (retry util migration, strict-flag enables, Supabase CI gate) | 70h |
| **Total** | **154h** | **+50h** | **~204h** (~5 dev-weeks focused) |

Adjusted remediation philosophy: Advanced Boy Scout Rule + 1 weekly hotspot sprint remains the empirically recommended hybrid (Qafoo 2024; Nijhof-Verhees Medium 2024). The extension categories mostly stack into hot-spot sprints naturally (a11y sprint, mobile-lifecycle sprint, strict-flag sprint).

---

*End of deep-scan extension. Stage 1 and Stage 2 fixes have landed. Stages 3-4 (journal decomposition, upgrades, Android native, iOS Dynamic Island, in-app Acknowledgements, aria-label sweep, strict-flag migration) are roadmapped in `memory/project_tech_debt_roadmap_2026-04-18.md`.*

---

## 13. Sentry config gaps — Stage 5 fixes landed 2026-04-19

Deep audit of `src/lib/sentry.ts` against 2024-2026 Sentry React v10 consensus revealed 8 correctly-implemented criteria + 6 tuning gaps. **4 safe gaps applied (zero visual/behavioral regression):**

| # | Fix | Rationale | Citation |
|---|---|---|---|
| 1 | **`denyUrls`** — 5 browser-extension patterns + webkit-masked-url | Quota save: Grammarly/password-managers inject errors burning 5k/mo free-tier | docs.sentry.io/.../filtering/ (2025) |
| 2 | **`ignoreErrors`** — ResizeObserver loops + Non-Error promise rejection | Early-exit in pipeline; cheaper than beforeSend | Community consensus 2024-2025 |
| 3 | **`sendDefaultPii: false`** explicit | v10.4.0 made this the default; explicit = future-proof against SDK flip | v9-to-v10 migration notes (2025) |
| 4 | **Firebase/Google-API domains** in `shouldCreateSpanForRequest` skip | Transaction quota save on Firebase Analytics/Crashlytics/Remote Config | Deep-audit §6 2026-04-19 |

**2 deferred (require decision):**
- **Canvas in Replay** (`blockAllMedia: true` blocks orb debugging): privacy-vs-debuggability tradeoff
- **`__SENTRY_EXCLUDE_REPLAY_WORKER__: true`** in vite.config.ts: ~30 KB bundle win if worker compression unused

**Future (React 19 upgrade):**
- Wire `Sentry.reactErrorHandler()` into `createRoot({ onUncaughtError, onCaughtError, onRecoverableError })` per React 19 docs

---

## 14. Supabase client — 18 months stale, P1 autoRefresh gap

Deep audit of `src/lib/supabaseClient.ts` (144 LOC) + `useAuthSession.ts` against 2024-2026 supabase-js state:

### Dependency staleness
- **Current:** `@supabase/supabase-js: ^2.45.6` (Jul 2024)
- **Latest:** `2.103.3` (2026-04-16) — **58 minor versions, 18 months stale**
- Includes: `startAutoRefresh`/`stopAutoRefresh` helpers (fix iOS background timer), PKCE hardening, navigator-lock timeout fix (#1594 closed 2026-01-07), `userStorage` option, realtime v2.15 line

### Gaps (sorted P0 → P3)

**P0-SUPA-1: OWASP M9 — localStorage JWT exposure (tracked, unfixed).**
`supabaseClient.ts:91` uses `window.localStorage` for auth session storage. XSS reads JWT + PKCE verifier. Comment L86-89 documents CSP mitigation + TODO. **Blocker:** `@capacitor/preferences` NOT installed (verified via package.json). Required for native Keychain/EncryptedSharedPreferences migration.

**P1-SUPA-1: iOS background token expiration — `startAutoRefresh` NOT wired.**
`useAuthSession.ts:172` has `App.addListener('appStateChange')` but only checks session during OAuth flow (`if (isActive && loadingProvider)`). No call to `supabase.auth.startAutoRefresh()/stopAutoRefresh()`. iOS pauses `setInterval` when backgrounded → token refresh timer silently dies → user returns to expired session. Canonical Supabase React-Native pattern since 2024.
**Blocker:** helpers may not exist in 2.45.6 — verify after dep bump to 2.103.3.

**P1-SUPA-2: Supabase-js 58-minor dep bump.**
Test soak required. Includes security + race-condition fixes (#1594, #2111 both closed upstream). Sentry "lock stolen" filter should remain — #2013 still open.

**P2-SUPA-1: `global.fetch` override missing.**
No universal retry/circuit-breaker wrap around Supabase requests. Sentry `tracePropagationTargets` adds tracing headers but no retry. Could wire `retryWithBackoff` at this layer for network-blip resilience.

**P2-SUPA-2: Zod user schema loose.**
`app_metadata: z.record(z.unknown())` and `user_metadata: z.record(z.unknown())` allow any object shape. Defensive but not tight. Tighten if any downstream code trusts metadata fields.

**P3-SUPA-1: No `global.headers` for app version.**
`X-App-Version`/`X-Platform` tags on Supabase requests would aid backend debugging. Minor.

**P3-SUPA-2: No custom `storageKey`.**
Default `sb-<project-ref>-auth-token`. Only matters if multi-project (not ZenFlow case).

### Non-issues (research confirmed)
- **`debug: false` default** — verified, no PII leak risk
- **Multi-tab sync** — BroadcastChannel works in WebView but moot on mobile (single-tab)
- **`detectSessionInUrl: !isNative`** — correct; #1697 cosmetic for non-Supabase OAuth (Facebook)

### v3 readiness (future)
- supabase-js v3 NOT released; still v2. Planned breaks tagged: #1959 (drop `access_token` URL fragment fallback), #1838 (storage `exists()` no longer errors on 404).
- Monorepo consolidation: `@supabase/auth-js` archived, moved into supabase-js. If any code imports `@supabase/auth-js` directly — update.

**Sources:** github.com/supabase/supabase-js/releases (v2.103.3 2026-04-16), issues #1594 (closed 2026-01-07), #2013 (open), #2111 (closed 2026-02-19), #1697 (open), @capacitor/preferences@8.0.1.

---

## 15. Service Worker deep audit — unsaved-state race + iOS Background Sync gap

Deep audit of `src/sw.ts` (197 LOC) + `vite.config.ts` VitePWA config + `main.tsx` SW wiring vs 2024-2026 Workbox / vite-plugin-pwa / web.dev service-worker-lifecycle consensus.

### ✓ Correctly implemented (8 criteria)
1. **`injectManifest` justified** — ZenFlow has Web Push + custom version-check (research §2: injectManifest correct when these exist)
2. **POST bypass** — sw.ts:113-118 comment block. Research §3: POST caching would double-insert mood entries (not precaution — correctness fix)
3. **Navigation NetworkOnly** — sw.ts:124 prevents stale-SPA deadlock
4. **`version.json` + `version-check.js` precache exemption** — vite.config.ts globIgnores per research §6 chicken-and-egg deploy-recovery pattern
5. **`maximumFileSizeToCacheInBytes: 3 MB`** — safer than Workbox 2 MiB default (research §7)
6. **Origin-check on `message` event** — sw.ts:146 CWE-20/345 defense
7. **Cache namespacing** — `setCacheNameDetails({prefix: "zenflow", suffix: "v1"})` good rolling-migration hygiene
8. **Zero Workbox CVEs 2024-2026** — Snyk confirmed `security.snyk.io/package/npm/workbox-build`

### Real gaps (research-revealed)

**P1-SW-1: `registerType: 'autoUpdate'` + explicit `skipWaiting()` = unsaved-state race.**
`vite.config.ts:69` has `registerType: "autoUpdate"` (forces skipWaiting + clientsClaim per vite-pwa docs). `sw.ts:179` additionally calls `void self.skipWaiting()` on install — double-force. Jake Archibald ([web.dev/articles/service-worker-lifecycle](https://web.dev/articles/service-worker-lifecycle)) warns: mid-session SW swap = two asset-hash versions per page = `Loading chunk failed` errors. ZenFlow has journal entries = unsaved-state. **Real P1 impact:** user mid-typing in journal → deploy → silent auto-update → chunk error → draft lost even with `lazyWithRetry` + `forceHardReload`.

**Fix requires coordinated 4-step change** (NOT autonomous):
1. Remove `self.skipWaiting()` from sw.ts:179 install handler
2. Change `registerType: 'autoUpdate'` → `'prompt'` in vite.config.ts
3. Add toast UI in main.tsx ("New version — save and reload") wiring `Workbox.messageSkipWaiting()` on user confirm
4. Test deploy-during-active-session scenario in Playwright

Source: [vite-pwa-org.netlify.app/guide/auto-update](https://vite-pwa-org.netlify.app/guide/auto-update) (accessed 2026).

**P2-SW-1: iOS Background Sync NO SUPPORT** — caniuse.com/background-sync confirms Safari 3.1-26.5 unsupported. `self.registration.sync?.register('zenflow-sync')` (sw.ts:170) returns undefined on iOS WKWebView. Optional-chain prevents crash (✓), но iOS users don't get background-sync benefit. Offline queue relies purely on `appStateChange` triggers instead. Alternative: `@capacitor/background-runner` official plugin.

**P2-SW-2: workbox 7.1.0 → 7.4.0 safe bump** (research §1: zero breaking changes, dep updates only). Requires `npm install`.

**P3-SW-1: Supabase Storage CacheFirst with 7-day TTL** (sw.ts:60-69) — mutated-at-same-URL assets stale до expiration. Consider `StaleWhileRevalidate` для mutable stickers/images.

**P3-SW-2: No `fetchDidFail` plugin** on CacheFirst routes — network-fail + empty-cache = Workbox throws. Could degrade gracefully with placeholder.

**P3-SW-3: `CLEAR_CACHES` not atomic** (sw.ts:157-165) — deletes ALL caches including in-flight. Edge case if triggered mid-sync.

### Non-issues (research-confirmed)
- **Safari ITP 7-day cap** — не применяется к Capacitor WKWebView/WebView (research §5)
- **CSP для SW** — same-origin on HTTPS/localhost, no additional directive needed (research §9)
- **`networkTimeoutSeconds` missing** — only applies to `NetworkFirst`; ZenFlow uses CacheFirst + NetworkOnly only (research §12)
- **iOS 17.4 Cache Storage regression** — fixed 17.5, concerned SW-registration not caches.delete

### Sources
- Workbox releases: github.com/GoogleChrome/workbox/releases/tag/v7.4.0 (2025-11-19)
- vite-plugin-pwa autoUpdate: vite-pwa-org.netlify.app/guide/auto-update (2026)
- Jake Archibald lifecycle: web.dev/articles/service-worker-lifecycle (canonical, unchanged 2020→2026)
- caniuse background-sync: caniuse.com/background-sync
- WebKit ITP 7-day: webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/ (2020, still authoritative 2026)
- Snyk workbox: security.snyk.io/package/npm/workbox-build

