# Tech Debt Remediation Plan — 2026-04-19

**Constraint:** Zero visual regression. Every change guarded by Playwright baselines (`e2e/design-system.spec.ts-snapshots`, `e2e/nav-v2.spec.ts-snapshots`) + characterization tests before refactor.

**Predecessor:** `docs/tech-debt-audit-2026-04-18.md` (full audit). This plan is the execution layer.

---

## 1. Current State Snapshot (verified 2026-04-19)

| Metric | 2026-04-18 | 2026-04-19 | Δ |
|---|---|---|---|
| TS errors | 0 | **0** | — |
| ESLint warnings | 0 | **7** | **🔴 regression** |
| Hardcoded colors | 1283 | **1274** | −9 (still > 900 floor) |
| TODO/FIXME/HACK | 21 | **1** | ✅ −20 |
| `as any` (prod) | ~15 | ~15 | — |
| `public/sounds/` MB | 63 | **64.5** | +1.5 |
| V2 legacy files | 21 | **23** | +2 |
| `fixed inset-0 md:` bypasses | 16 | (needs re-scan) | ? |
| Tests | 3680 | **3710** | +30 |
| Playwright baselines | present | present | ✓ (both `design-system` + `nav-v2`) |

**New since 2026-04-18 (completed, good):**
- motion-safe on 238 files (94% a11y coverage, Law 9)
- touch-target 44px on 5 modals (Law 9)
- `.toFixed()` → locale-aware (Law 17)
- Bundle perf Phase 2A-F: terser, lucide chunk, Sentry replay split, dev console strip (−140+ KB)
- Icon/APK asset pruning (−438 KB)
- ADR-0005 (bootstrap error handling) + ADR-0006 (Permissions-Policy)
- Web Vitals + Long Animation Frame dev observers
- `errorBuffer.ts` + `chunkErrorDetection.ts` extracted with tests
- Sentry config hardening (denyUrls, ignoreErrors, PII hash)
- Habits §15 metrics + E2E Playwright smoke (habit_created → window.gtag)

**Packages stale (upgrade cliff unchanged):**
- React 18.3.1 → 19.x
- Vite 6.4.1 → 7.x (Node 22.12+)
- Tailwind 3.4.17 → 4.x (CSS-first @theme)
- Supabase-js 2.45.6 → 2.103.3 (18 months stale)
- recharts 2.15.4 → 3.x (React 19 needs `react-is` override)
- day-picker 8.10.1 → 9.x (ref prop semantics changed in 19)

---

## 2. Priority Matrix

Ordered by `impact × (1 / visual_regression_risk)` — high impact + low risk first.

### Tier S — Blocker regressions (do FIRST)

| ID | Task | Visual risk | Effort |
|---|---|---|---|
| S-1 | **ESLint 7 warnings → 0** — regression from 0. Root-cause before adding more code. | None (no markup change) | 1-2h |
| S-2 | Re-scan `fixed inset-0 md:` bypasses (was 16). Confirm count. If stable, park; if grew, add lint rule. | None (audit only) | 15 min |
| S-3 | Verify `vitest run` + `tsc --noEmit` + `npm run ci:preflight` all pass on current HEAD. | None | 10 min |

### Tier A — Zero-visual-risk cleanups

| ID | Task | Risk | Effort |
|---|---|---|---|
| A-1 | **`TODO` final cleanup** — 21→1, finish to 0 with commit evidence. | None | 30 min |
| A-2 | **V2 legacy audit** — 21→23 means things are being ADDED. Freeze V2 file creation; produce sunset list with owner. | None (plan only) | 1h |
| A-3 | **`as any` prod** — ~15 prod sites. Type each site; prefer narrow interfaces over `unknown` casts. Pattern in `feedback_type_debt_protocol.md`. | None (type-only) | 4-6h |
| A-4 | **`console.*` leaks** — 9 non-test non-logger sites → `logger.info/warn/error`. | None | 1h |
| A-5 | **it.todo triage (73 → ~10)** — convert top-30 useAuthSession tests; delete the rest. Rot risk per Google 2024. | None (test-only) | 8-10h |
| A-6 | **knip unused files** — 103 reported, ~40 safe (top-level dupes, `lib/noop.ts`). Start with confirmed dupes. | None | 4h |
| A-7 | **Ratchet floor snapshot** — after each A-task, tighten `quality-ledger.json`. Lock in gains. | None | inline |

### Tier B — Architectural (characterization tests FIRST, then refactor)

| ID | Task | Visual risk | Mitigation | Effort |
|---|---|---|---|---|
| B-1 | **`useJournalEditorState.ts` 1208 LOC** → split `useJournalDraft` / `useJournalAutosave` / `useJournalMedia` / `useJournalPrompts`. | Med-High | Golden-master `renderHook` tests in `useJournalEditorState.test.ts` (732 LOC exist). `react-scan` before/after re-render check. Same API surface. | 16-20h |
| B-2 | **`JournalModule.tsx` 1884** → extract view-state machine + subtab router. | High | Playwright flow: `e2e/journal-flow.spec.ts` BEFORE refactor. DOM snapshot baseline. | 12h |
| B-3 | **`JournalEntryEditor.tsx` 1758** → split toolbar / attachments / block-renderers. | High | Same as B-2. Block-level snapshot per renderer. | 12h |
| B-4 | **`orbRenderer.ts` 1696** → decompose by GL pass (uniforms / geometry / shading / post). | Medium (visual-critical) | WebGL pixel-diff tolerance ±2. 60 FPS benchmark on mid-tier Android before/after. `docs/orb-design-philosophy.md` preserved. | 16h |
| B-5 | **`Index.tsx` 606 → ≤450** — extract `useIndexHandlers()` + `<TabRouter>`. | High (orchestrator) | ModalLayer consumer inventory first. Smoke Playwright on all 6 TabTypes. | 8h |
| B-6 | **`<StandardModal size>` primitive** — consolidate 65 inline `fixed inset-0 md:max-w-` sites + 16 bypasses per `.claude/rules/modal-standard.md`. | Pixel-critical | Playwright baseline for EVERY modal first. Pixel identity required. ESLint rule banning raw pattern after. | 12-16h |
| B-7 | **`ambientSounds.ts` 1275** — split by concern (registry / playback / ducking). Paired with P0-2. | Low (audio-only) | Existing tests + manual playback parity on iOS/Android. | 8h |

### Tier C — Infrastructure / upgrades (each in isolated branch)

**NEVER BATCH.** Each is its own branch + ratchet snapshot + full Playwright run.

| ID | Task | Risk | Effort |
|---|---|---|---|
| C-1 | **`public/sounds/` WAV → Opus 96 kbps** (64.5 MB → ~4-6 MB). Capacitor Filesystem lazy-load on ambient activation. | Audio regression — A/B listen on 3 devices | 4h |
| C-2 | **Supabase-js 2.45.6 → 2.103.3** + `@capacitor/preferences` native-Keychain adapter + `App.addListener('appStateChange')` → `startAutoRefresh()`. | Auth flow regression | 8h + 2d soak |
| C-3 | **Vite 6 → 7** (requires Node 22.12+, already pinned via `.nvmrc`). Sass legacy API dropped. | Build/HMR | 1 week + ratchet |
| C-4 | **Tailwind 3 → 4** (`@tailwindcss/upgrade` codemod, `bg-linear-to-*`, `@theme` CSS config, PostCSS plugin replaced with `@tailwindcss/postcss`). | **Visual** — codemod covers ~90%, 10% manual. Full Playwright baseline re-gen in same PR. | 1 week |
| C-5 | **React 18 → 19** + recharts 2→3 (`react-is` override required) + day-picker 8→9 (ref prop changes). | High visual + behavior | 3-4 days + 2 days testing |
| C-6 | **Service Worker `autoUpdate` → `'prompt'` + Toast UI** — unsaved-journal-draft race fix (4-step coordinated change from `docs/tech-debt-audit-2026-04-18.md` §15). | Low (UI additive) | 4h |
| C-7 | **Android 16 KB page size compliance** (mandatory Nov 2025 for Play). Audit Capacitor plugins for ELF alignment. | Native | 2-4h audit |
| C-8 | **iOS Dynamic Island detection** + banner offset (iPhone 14 Pro+). | Device-specific visual | 4h + device |

### Tier D — Feature-slice migration (post-v2.0)

| ID | Task | Effort |
|---|---|---|
| D-1 | Migrate 6 top-level `src/components/` dirs → `src/features/` (stats, state-of-mind, stories, share, challenges, mindmap). | 24h |
| D-2 | V2 cleanup — 23 files purge after v2.0 ships + monitoring window. | 6h |
| D-3 | `noUncheckedIndexedAccess` TS flag (100+ new errors expected, mostly Dexie). One flag per PR. | 16h |

---

## 3. Visual-Regression Safety Protocol

Per research (BrowserStack, bug0.com, 2026 Playwright best practices) + CLAUDE.md Law 1 (Zero Regression):

1. **Baseline generation in CI** — never local (font/renderer drift). Use Playwright Docker image.
2. **Before EVERY visual-touching change:**
   - Run `npx playwright test --grep @visual` on current HEAD → green baseline.
   - Make change on branch.
   - Run again. If diff intentional: `--update-snapshots --grep @visual` in SAME commit.
3. **Commit baselines with code** — reviewer sees both diffs.
4. **Tier B/C changes:** characterization tests (`renderHook` + `act`, NOT deprecated `@testing-library/react-hooks`) BEFORE any refactor line. Golden-master I/O captures current behavior.
5. **Binary conflict protocol:** coordinate baseline regen — never parallel refactors of same visual surface.
6. **Ratchet lock:** after each merged tier item, tighten `quality-ledger.json` floor. Law 27 prevents backslide.
7. **Fail fast:** `visual-regression.yml` must block on diff > 0.1% per page unless PR has `visual-change-approved` label.

---

## 4. Self-Reflection (honest)

**What I got right this session:**
- Didn't duplicate 2026-04-18 audit — built on it.
- Caught ESLint regression (0→7) before user mentioned it.
- Web-researched current state (React 19 + recharts compat, Tailwind 4 codemod, Capacitor 16 KB page size).

**What could go wrong:**
- The `ratchet_current` ctx command returned empty — `quality-ledger.json` IS at project root, but I haven't confirmed the ratchet script reads from there vs. `scripts/quality-ledger.json`. **Verify before tightening floors.**
- `fixed inset-0 md:` bypass count not re-scanned cleanly (need `--include` glob that excludes test files).
- `as any` prod sites: audit claims ~15; I saw 8 via raw grep but didn't filter tests. Re-verify.
- ESLint 7 warnings: I don't know which files yet. Root-cause FIRST, don't batch-silence with `// eslint-disable`.

**What I'm NOT doing in this plan:**
- Speculating about user's v2.0 timeline — that's a decision for product, not me.
- Recommending LICENSE choice (MIT vs proprietary) — user decision per prior memory.
- Canvas-in-Replay Sentry decision — privacy vs. debugging tradeoff needs user input.

**Pattern I'm consciously avoiding:**
- Convenience bias (`feedback_convenience_bias.md`): I checked git activity (28 commits last ~5 days) and didn't assume stable state from static audit. ESLint regression proves it.
- Visual-regression shortcuts: no "pixel-identity" without baselines. Every B-tier item gates on Playwright first.

---

## 5. Recommended Execution Order (if user says GO)

**Day 1 (4-6h, zero visual risk):**
1. S-1 ESLint → 0 (root cause, not suppress)
2. S-3 CI preflight green
3. A-1 TODO final zero
4. A-4 console.* → logger (9 sites)
5. A-7 ratchet snapshot

**Day 2-3 (10-12h):**
6. A-5 it.todo triage (73 → 10)
7. A-3 `as any` prod → typed (15 sites)
8. A-6 knip safe deletes (40 files)

**Day 4 — Audio payload (C-1):**
9. WAV → Opus offline via ffmpeg
10. Capacitor Filesystem lazy-load
11. iOS + Android parity listen

**Week 2 — Journal decomposition (B-1 only, characterization-first):**
12. Harden `useJournalEditorState.test.ts` as golden-master
13. Split into 4 hooks behind same API
14. `react-scan` re-render parity check

**Everything else:** separate branches, isolated PRs, own baseline regen cycles.

---

## 6. Sources (web research, 2026-04-19)

- [Playwright Visual Regression Testing 2026 Guide (bug0.com)](https://bug0.com/knowledge-base/playwright-visual-regression-testing)
- [15 Best Practices for Playwright testing in 2026 (BrowserStack)](https://www.browserstack.com/guide/playwright-best-practices)
- [Characterization testing — refactoring legacy code with confidence (Cloudamite)](https://cloudamite.com/characterization-testing/)
- [Tailwind CSS v4 Migration Guide (dev.to, 2026)](https://dev.to/pockit_tools/tailwind-css-v4-migration-guide-everything-that-changed-and-how-to-upgrade-2026-5d4)
- [React 18 to 19 Migration (Codemod.com)](https://docs.codemod.com/guides/migrations/react-18-19)
- [Recharts 3.0 Migration Guide (GitHub wiki)](https://github.com/recharts/recharts/wiki/3.0-migration-guide)
- [Recharts + React 19 issue #6857](https://github.com/recharts/recharts/issues/6857)
- [React DayPicker Changelog](https://daypicker.dev/changelog)
- [Android 16 KB Page Size + Capacitor (Capgo)](https://capgo.app/blog/android-16kb-page-size-capacitor-plugins/)
- [Capacitor 8 Update Guide](https://capacitorjs.com/docs/updating/8-0)
- [How to Manage Technical Debt 2025 Blueprint (Netguru)](https://www.netguru.com/blog/managing-technical-debt)
- [Technical Debt Examples — Prioritizing in React (CodeScene)](https://codescene.com/blog/technical-debt-examples-prioritizing-tech-debt-in-react)

---

**Status:** Plan ready. Next step per user: invoke `/teamlead` to begin execution starting with Tier S.
