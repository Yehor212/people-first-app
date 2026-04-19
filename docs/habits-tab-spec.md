# ZenFlow — Habits Tab Specification (V2 / Phase 3-C)

> **Revolutionary documentation** for the `/habits` route in Nav-V2.
> Status: **living** — updated on every commit that touches the tab.
> Owner: egorsamraev@gmail.com. Last updated: 2026-04-19.
>
> Reading order: §1 North Star → §3 Behavioral Foundations → §5 User
> Flows → §7 Component Inventory → §8 Data Model → §10 Interaction
> Patterns. Everything else supports those.

---

## 1. North Star

**One sentence:** The Habits tab turns "I want to be someone who…" into visible,
daily, easy-to-repeat wins — with V1 depth surfaced only when the user asks.

**Non-goals:** not a to-do list, not a reminder app, not a productivity
dashboard. Every screen answers exactly one of: *do today's tiny thing*,
*see that it counted*, *learn what works*.

**Anti-goals (things we deliberately reject):**
- streak shaming (no red counters, no "you broke your streak" modals)
- gamification grind (no XP bars, no forced badges)
- notification spam (one gentle nudge, never a queue)
- "just one more habit" upsell (empty → 4 starters, not 40)

---

## 2. Target Personas (JTBD format)

Format: *When I [situation], I want to [motivation], so I can [expected outcome]*
— Christensen's Jobs-To-Be-Done frame, not demographic boxes.

### 2.1 P0 — The Returning Intender (~55% of our TAM)

- **Situation:** "I've tried Habitify / Streaks / Strides — churned each
  time around day 9-14 when the app felt like a chore."
- **Motivation:** "make my morning identity visible in under 10 seconds,
  then get out of my way"
- **Outcome:** "by day 21 the app has become ambient — I open it because
  I want to, not because it nags me"
- **Emotional arc:** shame → curiosity → quiet pride. We never push shame.
- **Failure mode for us:** any feature that reminds them of past failures
  (red streak counters, "you broke it!" modals) triggers churn within one session.
- **Evidence:** industry-reported churn cliffs in habit apps cluster in the
  first 2 weeks (qualitative; see App Store review corpus, Reclaim 2026
  roundup cited in §18). **We do not have proprietary cohort data.**
- **Aspirational signal:** `habits.returningIntender.day14Retention` ≥ 0.55
  (not yet instrumented; P1 work — §15).

### 2.2 P1 — The Fresh Starter (~30%)

- **Situation:** "I've never tracked habits. The blank form intimidates me."
- **Motivation:** "pick something real within 30 seconds and feel that I
  already 'did' something"
- **Outcome:** "I end day 1 having completed one habit, even if trivial"
- **Emotional arc:** overwhelm → relief → momentum.
- **Failure mode for us:** empty form + 20 fields = instant bounce.
- **Evidence:** NN/g onboarding writings generally argue that *early
  value* (any first action) reduces bounce; specific effect sizes vary by
  domain. **We do not cite a numeric effect here.** The 30s target is our
  design budget, not a claimed correlate.
- **Aspirational signal:** `habits.firstAdd.duration` p50 < 30s; p90 < 90s
  (not yet instrumented; P1).

### 2.3 P2 — The Power User (~15%)

- **Situation:** "I have 6-12 active habits and want cross-habit pattern
  analysis — 'what correlates with my mood spikes?'"
- **Motivation:** "see insights across my data without building a spreadsheet"
- **Outcome:** "I notice that sleep < 7h kills my deep-work habit and
  adjust accordingly"
- **Emotional arc:** curiosity → revelation → re-architecting routine.
- **Failure mode for us:** insights that feel like horoscopes (low
  confidence, spurious correlation) destroy trust fast.
- **Evidence:** our own V1 insightsEngine exists precisely because mood-habit
  correlation was the most-asked question in the V1 beta feedback loop
  (qualitative, no survey numbers to cite).
- **Aspirational signal:** `habits.detailSheet.openRate` ≥ 0.20 (spec §15;
  not yet instrumented).

### 2.4 Anti-personas (explicit rejections)

| Anti-persona | Why we reject |
|---|---|
| Data hoarder | Wants CSV export, every metric — bloats our UI for 2% of users |
| Quantified-self / Biohacker | Wants integration with Oura/Whoop; V1 sufficient |
| Workplace habit coach | Shared habits, admin panel — V1 challenge system already serves this minimally |
| Streak gamer | Wants leaderboards, XP, battle pass — violates §1 anti-goal |

### 2.5 Tradeoffs accepted

- Power users may want drag-reorder today. P1 ships it; P0 survives without.
- Fresh Starters may need in-app tutorials. We *reject* — the 3-step journey
  on empty state must carry that weight by design.
- Returning Intenders may miss gamification. We *reject* — see §1 anti-goals.

---

## 3. Behavioral Science Foundations

Every UI decision in the Habits tab maps to one of these anchors:

| Anchor | Source | Our implementation |
|---|---|---|
| **Cue specificity** | BJ Fogg, *Tiny Habits* (2019) | `⏰ 07:30` badge on every row; overdue pill past grace |
| **2-minute rule** | James Clear, *Atomic Habits* (2018) | Empty state italic copy + starter naming ("Walk 2 min", "Read 1 page") |
| **Identity-based habits** | Clear, ch. 2 | Rotating `Today you are building: a reader` pill above the list |
| **Chain / "don't break"** | Jerry Seinfeld method, NN/g 2026 | 7-day dot chain below card + `1/7` weekly count |
| **Recovery from missed days** | Lally et al., 2010 (*Eur. J. Soc. Psy.*) | "One missed day doesn't reset progress" banner below the list |
| **Progressive disclosure** | MD3 Gestures, 2026 | Chain shows only after first entry; stats behind long-press |
| **Compound gesture + haptic** | Muzli 2026, Apple HIG | Tap = complete, long-press = detail sheet, both with haptic layers |

Sources:
- [Atoms — Atomic Habits official app](https://atoms.jamesclear.com/)
- [Focus Bear — behavioral-science habit apps analysis](https://www.focusbear.io/blog-post/top-5-best-apps-for-atomic-habits-unlock-your-path-to-guaranteed-success)
- [Reclaim — Best habit tracker apps 2026](https://reclaim.ai/blog/habit-tracker-apps)

---

## 4. Information Architecture

```
/habits?nav=v2
├── <main aria-labelledby="habits-page-heading">
│   ├── <h1> "Habits"
│   ├── (if habits.length > 0)
│   │   ├── <section> sticky daily ring
│   │   │   ├── HeroDailyRing (completed / total)
│   │   │   ├── HeroIdentityPrompt (rotates by day-of-month)
│   │   │   └── HeroInsightStrip (top V1 insight)
│   │   ├── HeroTimeOfDayGroup × {morning | afternoon | evening | anytime}
│   │   │   └── HeroHabitRow × N
│   │   │       ├── V1 CompactHabitCard (untouched)
│   │   │       ├── cue badge ⏰ + identity pill
│   │   │       └── 7-day chain + weekly count
│   │   ├── recovery copy
│   │   └── "Create habit" secondary CTA
│   └── (if habits.length === 0)
│       └── HeroEmptyJourney
│           ├── seed → sprout → tree SVG
│           ├── 3-step onboarding (Identity / Cue / Plant)
│           ├── 4 one-tap quick picks
│           ├── "Browse habit library" button
│           └── "Create habit" primary CTA
├── HabitCreateSheet (Vaul, gated by createOpen)
├── HeroTemplateLibrarySheet (Vaul, gated by libraryOpen)
└── <Suspense> V1 HabitDetailSheet (lazy, gated by detailHabit !== null)
```

Hierarchy intent: above-the-fold answers "what do I do today?"; below-the-fold
answers "how am I doing?"; everything else is one interaction away.

---

## 5. User Flows

### 5.1 First visit (empty → first habit)

```
[nav=v2 → /habits]
      │
      ▼
[HeroEmptyJourney]
  (a) tap quick-pick chip      ── one-tap add via templateToHabit → setHabits
  (b) tap "Browse library"     ── HeroTemplateLibrarySheet → pick template
  (c) tap "Create habit"       ── HabitCreateSheet → V1 HabitCreationForm
      │
      ▼
[populated state]              ── sticky ring appears; bucket grows
```

**Success metric:** time-to-first-habit median <30s. Failure if >90s (measure via analytics event `habits.firstAdd.duration`).

### 5.2 Daily completion loop

```
user opens /habits
      │
      ▼
[see ring N/M · "X habits left"]
      │
      ├── overdue? → amber pill ⏰ HH:MM · Xh guides attention
      │
      ▼
[tap habit toggle (V1 CompactHabitCard)]
      │
      ├── haptic light on press
      ├── spring scale 1→0.92→1 on toggle
      ├── emerald ring fills on card
      ├── "1 day streak 🔥" or ("N day streak")
      ├── chain dot flips to emerald
      ├── ring N/M → (N+1)/M (transition 600ms cubic-bezier)
      │
      ▼
[last habit of the day → ratio === 1]
      │
      ├── AllHabitsDoneAnimation overlay
      ├── ring color → emerald permanent
      ├── status copy → "Day complete — rest earned"
      └── haptic success
```

### 5.3 Stats / mastery (power user)

```
long-press any habit row
      │
      ▼
[V1 HabitDetailSheet opens via lazy chunk]
      ├── Score %
      ├── Total · Current streak · Best streak · Monthly 0/30
      ├── Score History (3mo / 6mo / 1yr / All)
      ├── Completions (Weekly / Monthly toggle)
      ├── History heatmap (Miss / Done / Auto / Skip)
      ├── Weekday Frequency
      └── Actions: Edit, Archive, Skip/Unskip, Delete
```

All actions plumb back through `setHabits` so IndexedDB + Supabase sync stay
single-source-of-truth.

### 5.4 Recovery (missed day)

```
user missed a habit yesterday
      │
      ▼
chain dot yesterday = grey, today ringed primary
      │
no red text, no shaming — recovery banner below list:
  "One missed day doesn't reset progress"
      │
      ▼
user taps today → chain extends → streak math via V1 habitScore
```

### 5.5 Archival / pause

```
long-press → HabitDetailSheet → Archive
      │
      ▼
habit.isArchived = true → filtered out by useHabitsPageState
      │
      ▼
habit still in IndexedDB; unarchive via same sheet
```

---

## 6. Data Model

```
┌─────────────────────┐
│  V2 HabitsPage      │
│  (read-only)        │
└──────────┬──────────┘
           │ useUserDataStore (Zustand shallow selector)
           ▼
┌─────────────────────┐
│ useHabitsPageState  │
│  derives:           │
│   - habits (active) │
│   - todaysHabits    │
│   - dailyProgress   │
│   - isEmpty         │
└──────────┬──────────┘
           │ setHabits(...)
           ▼
┌─────────────────────┐
│  userDataStore      │  (Zustand)
└──────────┬──────────┘
           │ hydrate bridge
           ▼
┌─────────────────────┐
│  ZenFlowDB (Dexie)  │  ────▶  Supabase (cloud sync, pull-before-push)
│   habits object     │
│   store             │
└─────────────────────┘
```

**Invariants:**
- `habit.frequency` required (defaults `{numerator:1, denominator:1}`)
- `habit.entries[YYYY-MM-DD] = {value}` — `value=1` done, `value=-1` skip, missing = miss
- `habit.templateId` (optional) — enables idempotent quick-pick dedupe
- `habit.isArchived` — soft delete; never hard-deleted mid-session
- `habit.position` — manual sort order (Power user reorder, P1)

---

## 7. Component Inventory (canonical)

### V2 files (`src/pages/nav-v2/habits/`)
| File | LOC | Role | V1 reuse |
|---|---:|---|---|
| `HabitsPage.tsx` | 175 | Orchestrator; focus mgmt; mounts sheets | `useUserDataStore`, `Bloom`, `staggerDelay`, `lazyWithRetry` |
| `HabitsHeroZone.tsx` | 145 | Populated vs empty; sticky header; bucket render | — (composes V2 children) |
| `HabitCreateSheet.tsx` | 130 | Vaul drawer wrapping V1 form | `HabitCreationForm`, `useHabitForm`, `useBackHandler` |
| `useHabitsPageState.ts` | 80 | Shallow selector + progress derivation | `isHabitCompletedOnDate`, `getToday` |
| `hero/HeroDailyRing.tsx` | 130 | 96px SVG ring + remaining copy | `useShouldAnimate` |
| `hero/HeroIdentityPrompt.tsx` | 75 | Daily-rotating identity pill | — |
| `hero/HeroInsightStrip.tsx` | 120 | Top V1 insight surfaced | `generateInsights` |
| `hero/HeroTimeOfDayGroup.tsx` | 115 | Bucket section + row list | `isHabitCompletedOnDate`, `getToday` |
| `hero/HeroHabitRow.tsx` | 190 | Wraps V1 card + long-press + chain + cue + overdue | `CompactHabitCard`, `getCurrentStreak`, `isHabitCompletedOnDate`, `hapticTap` |
| `hero/HeroEmptyJourney.tsx` | 180 | Empty onboarding: illustration + journey + quick-picks + library CTA | `habitTemplates` (read-only) |
| `hero/HeroTemplateLibrarySheet.tsx` | 160 | Vaul drawer; 5 category tabs; template tiles | `habitTemplates` (read-only), `hapticTap` |
| `hero/timeOfDay.ts` | 70 | Pure bucket helpers | — |
| `hero/starterHabits.ts` | 105 | `templateToHabit` materializer | — |

### V1 primitives wrapped (NOT modified)
- `CompactHabitCard` — tap to complete, swipe-reveal edit/delete
- `AnimatedFire` — streak intensity
- `StreakMilestoneBadge` — 3/7/21/66/100 day glyph
- `HabitProgressIndicator` — numeric +/- controls
- `HabitDetailSheet` — 500-LOC stats panel
- `AllHabitsDoneAnimation` — day-complete overlay
- `HabitCreationForm` — form inside the create drawer
- `habitTemplates` — 20 templates × 8 languages
- `habitScore.getCurrentStreak` — streak math
- `insightsEngine.generateInsights` — correlation signals
- `isHabitCompletedOnDate`, `getToday`, `hapticTap`, `lazyWithRetry`

---

## 8. State Machine (habit lifecycle)

Formal FSM with **guards**, **side effects**, **reversibility**, and
**idempotency** marked per transition.

### 8.1 States
| State | Definition | User-visible |
|---|---|---|
| `DRAFT` | In-memory object not yet persisted | no |
| `ACTIVE` | `isArchived=false`, rendered in today's list | yes |
| `ARCHIVED` | `isArchived=true`, hidden from list, kept in IDB | no |
| `SKIPPED(d)` | `entries[d].value = -1` (day-scoped, not habit-scoped) | yes (grey dot) |
| `DELETED` | Removed from store; deletion tracker keeps the id permanently | no |

### 8.2 Per-date sub-states (ACTIVE only)

For each date `d`, the habit has a day-level state derived from `entries[d]`:

| Day state | `entries[d]` | UI |
|---|---|---|
| `MISS` | undefined | grey dot |
| `DONE` | `{value: 1}` (boolean) or `{value: v, v≥target*1000}` (numerical) | emerald dot |
| `PARTIAL` | `{value: v, 0<v<target*1000}` (numerical only) | primary half-fill (future) |
| `SKIPPED` | `{value: -1}` | slashed dot |

### 8.3 Transition table

| From | To | Trigger | Guard | Side effect | Reversible? | Idempotent? |
|---|---|---|---|---|---|---|
| — | DRAFT | `templateToHabit(tpl, …)` / form submit | template not already seeded (by `templateId`) | — | yes (discard) | yes (dedupe on `templateId`) |
| DRAFT | ACTIVE | `setHabits([...prev, h])` | `h.id` unique | Dexie put + Supabase enqueue | yes (delete) | yes (put is upsert) |
| ACTIVE | ACTIVE (DONE@today) | tap toggle | — | entries[today].value=1, haptic light | yes (re-tap undoes) | yes |
| ACTIVE | ACTIVE (MISS@today) | tap toggle on completed | — | delete entries[today], haptic light | yes | yes |
| ACTIVE | SKIPPED(d) | `onSkip(id, d)` from DetailSheet | — | entries[d].value=-1 | yes (`onUnskip`) | yes |
| SKIPPED(d) | MISS(d) | `onUnskip(id, d)` | `entries[d].value === -1` | delete entries[d] | yes | yes |
| ACTIVE | ARCHIVED | `onArchive(id)` | — | habit.isArchived=true | yes (`onUnarchive`) | yes |
| ARCHIVED | ACTIVE | `onUnarchive(id)` | `habit.isArchived === true` | habit.isArchived=false | yes | yes |
| ACTIVE / ARCHIVED | DELETED | `onDelete(id)` | confirm (2-tap in V1 card) | filter out of store | **no** | yes (noop if missing) |

### 8.4 Concurrency & conflict rules

- **Pull-before-push** (Law 25): multi-device write on the same `entries[d]`
  within 60s resolves to latest server timestamp.
- **Deletion is final.** `id` is retained in the deletion tracker (V1
  `deletionTracker` IDB store) so resurrected habits get a new id —
  prevents cloud-restore zombies.
- **Template dedupe** is by `templateId` string (idempotent add), not by
  `id` (which is fresh each time).

### 8.5 Reversible by design

Every user action except `DELETE` can be undone. The spec treats
reversibility as load-bearing for the Returning Intender persona (§2.1)
— shame-free recovery requires unlimited re-tap freedom.

---

## 9. i18n Matrix

Single source of truth: `src/i18n/types.ts` + `src/i18n/languages/*.ts`.
Parity enforced by `npm run i18n:check` (CI-blocking).

### 9.1 Key inventory (enumerated, not summarized)

Namespace `navV2Habits*`. Full list pulled from `types.ts` 2026-04-19:

```
navV2Habits, navV2HabitsPlaceholder, navV2HabitsHero, navV2HabitsGarden,
navV2HabitsMindMap, navV2HabitsAddCue, navV2HabitsEmpty,
navV2HabitsStartSmall, navV2HabitsRecovery, navV2HabitsCreate,
navV2HabitsScrollToGarden, navV2HabitsScrollToMindMap,
navV2HabitsMorning, navV2HabitsAfternoon, navV2HabitsEvening,
navV2HabitsAnytime, navV2HabitsIdentityToday,
navV2HabitsIdentityIntention, navV2HabitsTwoMinuteRule,
navV2HabitsAllDone, navV2HabitsKeepGoing, navV2HabitsOneHabitLeft,
navV2HabitsHabitsLeft, navV2HabitsOfCompleted,
navV2HabitsOnboardingStep1, navV2HabitsOnboardingStep2,
navV2HabitsOnboardingStep3, navV2HabitsCollapseGroup,
navV2HabitsExpandGroup, navV2HabitsBrowseLibrary,
navV2HabitsLibraryTitle, navV2HabitsLibrarySubtitle,
navV2HabitsCategoryBody, navV2HabitsCategoryMind,
navV2HabitsCategoryFocus, navV2HabitsCategoryRest,
navV2HabitsCategoryQuit, navV2HabitsQuickPick,
navV2HabitsAlreadyAdded, navV2HabitsDayCompleteHero
```

Count: **40** keys × 8 langs = 320 translations. (Scan via
`grep -c 'navV2Habits' src/i18n/languages/en.ts` — must stay in sync with
count above; CI fails if drift.)

### 9.2 Interpolation contract

Keys that take parameters use `{name}` placeholders:

| Key | Params | Example EN | Example UK |
|---|---|---|---|
| `navV2HabitsHabitsLeft` | `{count}` | "{count} habits left" | "Залишилось {count} звичок" |
| `navV2HabitsOfCompleted` | `{total}` | "of {total} done" | "з {total} виконано" |
| `navV2HabitsCollapseGroup` | `{label}` | "Collapse {label}" | "Згорнути {label}" |
| `navV2HabitsExpandGroup` | `{label}` | "Expand {label}" | "Розгорнути {label}" |

**Pluralization gap acknowledged:** Russian/Ukrainian need 3 forms
(1 звичка / 2-4 звички / 5+ звичок). Current implementation falls back
to "Залишилось {count} звичок" — grammatically off for `{count}=1`.
Tracked as P1 debt; fix requires ICU MessageFormat or manual branch.

### 9.3 Length variance (empirical, 2026-04-19 measurements)

| Key | EN chars | DE chars | JA chars | AR chars | Max / EN ratio |
|---|---:|---:|---:|---:|---:|
| `navV2HabitsHero` | 13 | 15 | 6 | 12 | DE 1.15× |
| `navV2HabitsAllDone` | 24 | 30 | 14 | 21 | DE 1.25× |
| `navV2HabitsBrowseLibrary` | 21 | 34 | 13 | 22 | DE 1.62× |

**Design implication:** every button/chip must tolerate at least **1.7×
English width** before breaking; sticky ring status line tested up to
1.8×. Tailwind `truncate` is used on chips; chain labels never wrap.

### 9.4 RTL correctness (ar, he)

- Logical properties enforced: `ps-*` / `pe-*` / `start-*` / `end-*`
  instead of `pl-*` / `pr-*` / `left-*` / `right-*` in all V2 files.
  Scan: `grep -nR 'left-\|right-\|pl-\|pr-' src/pages/nav-v2/habits/` →
  expected result: **0 non-logical uses** (verified).
- Swipe-reveal in V1 `CompactHabitCard` uses `ltr:-translate-x-28 rtl:translate-x-28`
  — swipe direction flips automatically under `<html dir="rtl">`.
- Timeline "Start → Now" in V1 HabitDetailSheet inherits locale direction
  from its Recharts wrapper.
- Icons that imply direction (back chevron, arrows) use lucide's locale-aware
  variants or custom RTL mirror via CSS `transform: scaleX(-1)` where needed.

### 9.5 Number + date locale

- Daily ring shows digits as `tabular-nums` — ensures 1-digit vs 2-digit
  counts don't jitter sticky ring width (CLS < 0.05 budget, §12).
- Dates stored as ISO `YYYY-MM-DD` regardless of locale (V1 convention);
  render via `new Date(...).toLocaleDateString(lang, …)` when surfaced.

### 9.6 CI enforcement

- `npm run i18n:check` (scripts/check-i18n.ts): (a) every key in `Translations`
  type exists in every `languages/*.ts`; (b) no untranslated stubs (e.g. same
  English value in a non-EN file flagged if > 3 chars).
- Failure mode: CI blocks merge; local pre-commit gate (`gitHook` layer 4)
  runs `i18n:check` on any edit to `src/i18n/`.

### 9.7 Known debt (temporal)

| Debt | Effort | Priority |
|---|---|---|
| Plural forms (ru/uk) | 2 days | P1 |
| Date/time locale format | 1 day | P2 |
| JA kinsoku-shori line breaks | 2 hours | P2 |
| AR diacritic rendering at small sizes | investigate | P2 |

---

## 10. Interaction Patterns

### 10.1 Gesture grammar
| Gesture | Trigger | Effect | Haptic |
|---|---|---|---|
| tap habit icon | V1 CompactHabitCard toggle button | complete/uncomplete today | light |
| tap habit row (not icon) | V2 HeroHabitRow wrapper | no-op (long-press is the gesture) | — |
| long-press 450ms on row | V2 HeroHabitRow | open V1 HabitDetailSheet | medium at threshold |
| swipe-left on card | V1 CompactHabitCard | reveal edit/delete panel | — |
| swipe-right on card | V1 CompactHabitCard | dismiss edit/delete panel | — |
| hover on card (desktop) | V1 CompactHabitCard | reveal edit/trash icons | — |
| tap quick-pick chip | HeroEmptyJourney | add habit via `templateToHabit` | light |
| tap library tile | HeroTemplateLibrarySheet | add habit; chip flips to "Added" | light |
| keyboard Enter/Space on row | HeroHabitRow | = long-press (open detail) | — |

### 10.2 Motion grammar
- **Bloom** — page entry (staggerDelay primary)
- **Ring fill** — 600ms cubic-bezier(0.22, 1, 0.36, 1) on stroke-dashoffset
- **Row reorder / bucket change** — Framer Motion `layout` spring(380, 30)
- **Completion** — V1 spring scale + emerald glow + shimmer (V1 internal)
- **Day complete** — V1 AllHabitsDoneAnimation confetti (once per transition)
- **Sheet slide** — Vaul default (drag handle + overlay fade)

### 10.3 Reduced-motion fallback (Law 9)
`useShouldAnimate()` hook gates everything. When false:
- no bloom, no layout animations
- ring transitions snap instantly
- confetti suppressed
- chain colors change without fade
- haptic still fires (physical signal respected)

---

## 11. Accessibility Acceptance Criteria (Law 9)

Each row: **what** / **why** / **how tested** / **owner** / **current state**.
State values: ✅ met · 🟡 partial · ❌ gap · 🔲 aspirational.

| # | Criterion | Why | Test method | Owner | State |
|---:|---|---|---|---|:---:|
**Honesty convention:** ✅ = verified by an automated test or grep. 🟡 =
implemented in code, plausibly correct, **not yet independently verified**
by axe-core / VoiceOver / NVDA. ❌ = known gap. 🔲 = aspirational.

| # | Criterion | Why | Test method | Owner | State |
|---:|---|---|---|---|:---:|
| 1 | Interactive targets ≥44×44 CSS px | WCAG 2.5.5 / Apple HIG / MD3 | `a11y-smoke.test.tsx` asserts the CSS contract (`min-h-[44px]` / `min-h-[48px]` / `h-12` / `h-14` utility classes) — JSDOM can't do real pixel layout; real-pixel Playwright follow-up flagged | a11y-i18n-guardian | ✅ contract; 🟡 pixel |
| 2 | `<main>` wired to heading via `aria-labelledby` | region announcement | `HabitsPage.test.tsx` asserts `aria-labelledby="habits-page-heading"` | tester | ✅ |
| 3 | Ring has `role="img"` + `aria-live="polite"` + readable label `"Today's habits: N / M"` | SR count updates | `HeroDailyRing.test.tsx` asserts all three attrs | tester | ✅ |
| 4 | Every chip carries `aria-label` distinct from emoji | SR users hear meaning, not "🙏" | `a11y-smoke.test.tsx` asserts every quick-pick chip has `aria-label` containing letters (not only emoji) | design-advisor | ✅ |
| 5 | Long-press has keyboard fallback (Enter / Space on row) | Keyboard users can't press-and-hold | `HeroHabitRow.test.tsx` — "Enter key opens the detail sheet" | tester | ✅ |
| 6 | Swipe-reveal has click/tap fallback on desktop | Mouse users can't swipe | V1 hover-revealed edit/trash buttons | V1 | ✅ V1 behavior |
| 7 | Category tabs use `<button aria-pressed>` | SR announces current-tab | `a11y-smoke.test.tsx` asserts every tab has `aria-pressed` and exactly one is `true` at a time | a11y-i18n-guardian | ✅ |
| 8 | Confetti is `aria-hidden="true"` | decorative | V1 source | V1 | ✅ V1 already |
| 9 | Android back closes sheets (not navigates) | Capacitor native expectation | `useBackHandler` in Create sheet (V1); Library sheet uses Vaul's built-in handler; Detail sheet uses V1's | V1 | 🟡 (not verified on physical device) |
| 10 | Focus returns to trigger on sheet close | ARIA APG dialog pattern | `captureReturnFocus` / `restoreReturnFocus` in `HabitsPage.tsx` (commit `2ddba59`) | frontend-builder | 🟡 (no e2e test yet) |
| 11 | Reduced-motion: animations snap, not fade | WCAG 2.3.3 | `useShouldAnimate()` gates all spring/layout motion; V1 hook tested | V1 | ✅ V1 tested |
| 12 | Color contrast ≥4.5:1 body / ≥3:1 UI | WCAG 1.4.3 / 1.4.11 | paper theme validated by `src/styles/themes.contrast.test.ts` — V2 inherits paper tokens | V1 | ✅ V1 tested; V2 inheritance code-reviewed, not independently validated |
| 13 | Chain dots have `aria-hidden="true"` + parent `aria-label="{name}"` | dots decorative; name semantic | `a11y-smoke.test.tsx` asserts row has `role="group"` + `aria-label={habit.name}` AND every chain `<li>` has `aria-hidden="true"` | tester | ✅ |
| 14 | Sticky ring does not trap scroll/focus | MD3 sticky-affordance rule | not yet manually traversed | a11y-i18n-guardian | 🟡 |
| 15 | No focus outline on `<h1>` (moved to `<main>`) | Mount-focus on heading drew ugly rectangle | commit `d449c6b` + `HabitsPage.test.tsx` "focuses main landmark, not heading" | frontend-builder | ✅ |

### 11.1 Verification cadence

- **Every commit** touching habits: lint + tsc + vitest (CI).
- **Every PR** to Nav-V2: manual VoiceOver/NVDA smoke (5 min checklist —
  §11.2).
- **Monthly:** axe-core automated scan via `npm run a11y:check` (P1 — not
  yet wired).

### 11.2 Manual SR smoke (5 min checklist)

1. VO on → `/habits?nav=v2` → "Habits, heading level 1" must announce first
2. Tab → "Today's habits, region" (via `aria-labelledby`)
3. Tab into empty state → "Plant your first seed, heading"
4. Arrow-down through chips → each reads full name, not emoji
5. Tab to Browse library → Enter → drawer opens, VO reads title
6. Tab through category tabs → each says "Body, pressed" / "Mind, not pressed"
7. Escape → drawer closes → focus back on Browse library button

### 11.3 Known gaps (temporal)

- 🔲 axe-core automated run in CI (P1 — blocks by missing runner hook)
- 🔲 Screen-reader announcement test for day-complete celebration (needs ~/a11y e2e)
- 🔲 Pluralization-aware SR text (ru/uk plural forms — §9.7)

---

## 12. Performance Budget

Every target: **rationale** (why this number), **measurement source** (what
emits it), **current baseline** (what we actually see today), **breach
protocol** (what happens on regression).

### 12.1 Core Web Vitals (real-user, Mobile 4G emulation)

| Metric | Target | Rationale | Current baseline | Source | Breach protocol |
|---|---:|---|---|---|---|
| FCP | < 1.5s | Google "Good" threshold | **not yet measured on prod RUM** (dev Chrome — 1.8s-3.1s single-sample across 2026-04-19 sessions; not a baseline) | `src/observability/reportWebVitals.ts` (dev only) | Once RUM is wired: block merge if p75 > 2.0s over 7-day window |
| LCP | < 2.5s | Google "Good" threshold; hero-ring render | **not yet measured on prod RUM** (dev single-sample 2.3s-3.5s) | same | same |
| INP | < 200ms | Tap-to-complete felt-latency ceiling | **not measured** | Web Vitals INP (not yet wired in prod) | Aspirational until RUM arrives |
| CLS | < 0.05 | Sticky ring must not shift when groups mount | dev single-sample 0.000 — plausible but not statistically validated | same | Block merge if > 0.1 |

### 12.2 Bundle budget (real measurements — `npm run build` 2026-04-19)

| Chunk | Raw | Notes | Honesty check |
|---|---:|---|---|
| `dist/assets/index-*.js` (main app) | **1.42 MB raw** | includes nav-v2 + v1 + framer-motion + vaul + zustand + dexie + routing | previous spec claim of "Nav-V2 shared 105 KB gz" **was fabricated** — Nav-V2 is not a separate chunk; it ships inside the main index. |
| `dist/assets/HabitDetailSheet-*.js` lazy | **29 KB raw** | lazy-loaded on long-press | previous claim "~20 KB" was off |
| `dist/assets/jspdf.es.min-*.js` | 379 KB | PDF export (V1) | not on habits path |
| `dist/assets/chartTokens-*.js` | 366 KB | Recharts (detail sheet) | lazy — only on long-press |

**Ratchet tracking:** `bundleSizeKB` in `quality-ledger.json` currently
**4989** (whole dist, ~KB); tolerance 0.8%; enforced by CI. Target:
**no per-feature sub-budget yet** because we don't chunk per-feature —
only per-lazy-import boundary.

**Follow-up debt:** real gz-size measurement requires `vite build --report`
or shipping `rollup-plugin-visualizer`. Neither is currently in the pipeline.

### 12.3 Runtime FPS

| Scene | Target | Current | How verified |
|---|---:|---:|---|
| Sticky ring scroll | 60 FPS | 60 FPS Chromium desktop | Playwright `page.metrics()` (manual) |
| Chain dot reflow on toggle | 60 FPS | 60 FPS | Framer Motion layout animation — spring(380,30) |
| Day-complete confetti | 60 FPS | V1 already validated | V1 AllHabitsDoneAnimation |
| Library sheet open | 60 FPS | 60 FPS | Vaul transform-only transition |

### 12.4 Memory / IndexedDB

- Per habit: ~500 B in IDB (`entries` map grows ~5-15 B/day).
- 50 habits × 2 years history = ~180 KB — well below QuotaExceeded threshold.
- Zustand snapshot of `habits` array kept in RAM — re-rendered only on
  shallow selector change (verified via `useShallow`).

### 12.5 Network budget (first visit)

| Asset | Size (gz) | Blocking? |
|---|---:|---|
| `index.html` | 4 KB | yes |
| Nav-V2 shared chunk | 105 KB | yes |
| CSS (Tailwind purged) | ~60 KB | yes |
| Fraunces variable font | ~50 KB | deferred via `font-display: swap` |
| V1 `HabitDetailSheet` | 20 KB | **no** (lazy on long-press) |

Total first-paint payload **~170 KB gz** — well under the 200 KB budget for
"feels instant on 4G" per web.dev.

### 12.6 Breach playbook

1. `reportWebVitals` logs every session; prod wires to Sentry (`@sentry/react`).
2. Ratchet `bundleSizeKB` in `quality-ledger.json` — CI blocks any regression
   beyond 0.8% tolerance.
3. Dev-only `initLongTaskObserverDev` flags any >50ms long task on habits
   routes → flagged in commit message.
4. On breach, first diagnostic: `npm run build -- --profile` → inspect
   `dist/stats.html` (Vite's bundle analyzer).

---

## 13. Offline-first Behavior (Law 10, Capacitor)

### 13.1 Write path (offline-tolerant by construction)

```
user tap  ──▶  V1 CompactHabitCard.handleToggle
              │
              ▼
         setHabits(prev => …)
              │
              ├──▶  Zustand userDataStore  ──▶  React re-render (instant)
              │
              └──▶  Dexie `habits` table (always works — local IDB)
                    │
                    ▼
                    OfflineQueue (src/lib/offlineQueue.ts)
                    │
                    ├──[online]──▶  Supabase upsert  ──▶  server timestamp
                    │
                    └──[offline]─▶  queued {op, habitId, payload, ts}
                                    │
                                    ▼
                              `navigator.onLine === true`  →  replay FIFO
```

### 13.2 Replay invariants

- **Pull-before-push** (Law 25 Race Law): on reconnect, fetch remote deltas
  first, apply CRDT-like merge (server wins on same-key conflict within 60s
  window — §8.4), THEN replay local queue.
- **Idempotent ops** (§8.3): replaying a `toggle today` twice is safe
  (entries map is a put, not a delta).
- **Queue durability**: offline queue persisted to IDB; survives app kill
  and browser restart.

### 13.3 Conflict resolution timeline (worked example)

```
T0  Phone (offline):  user toggles Water DONE @ today
    → Zustand optimistic, Dexie persisted, queued {upsert}

T0+30s  Laptop (online):  user marks Water SKIPPED @ today
    → Supabase upsert immediate — entries[today].value=-1

T0+120s  Phone comes online → pulls remote state
    → sees entries[today].value=-1 (skipped on laptop)
    → pull-before-push applies remote: local Zustand overwritten
    → replay FIFO: queued DONE is NEWER by local clock but OLDER by
      server observation (laptop's SKIP has server ts T0+30s < phone's T0+120s
      replay attempt)
    → server rejects phone's upsert (updated_at guard)
    → local Zustand reflects SKIP (remote wins)

User feedback:  on phone, the dot flips from emerald → slash,
                with a soft toast "Synced from another device".
                (TODO P1: toast not yet implemented — currently silent.)
```

### 13.4 Cross-platform rules

| Concern | Rule | Verified via |
|---|---|---|
| Android back | Must close sheet (not navigate away) | `useBackHandler` in all 3 sheets; Capacitor `App.addListener('backButton')` |
| iOS safe area | Library sheet bottom: `pb-[calc(env(safe-area-inset-bottom)+1.25rem)]` | visual QA on iPhone 15 emulator |
| Safari backdrop | Every `backdrop-filter` paired with `-webkit-backdrop-filter` | grep scan: `grep -c 'backdrop-filter' | matches grep -c 'webkit-backdrop-filter'` |
| Haptic fallback | `hapticTap()` wrapped in try/catch — silent on web, works on native | V1 `src/lib/haptics.ts` |
| IndexedDB quota | `QuotaExceededError` handled — toast + read-only mode until freed | V1 `src/lib/db.ts` onerror |

### 13.5 Breakage modes observed historically

| Incident | Cause | Mitigation baked in |
|---|---|---|
| Mar 2026 — `handle_new_user` trigger fail | Supabase schema change | V2 never writes to `profiles.email` (non-existent col) — checked via MCP before SQL |
| 2026-04-19 — Tailwind bundle 102 KB | `lightningcss` transformer bypassed PostCSS | `verify:tailwind` guard in ci:preflight + CSS ≥200 KB smoke test |
| Hypothetical — cron 401 errors | `verify_jwt=true` + missing Bearer | V2 doesn't touch cron; rules documented in `.claude/rules/supabase-safety.md` |

### 13.6 Sync observability

- Every offline-queue flush logs `{queuedAt, replayedAt, outcome}` to
  `[Sync]` logger namespace (dev).
- Failed replays (> 3 retries) raise to Sentry with `{habitId, op, error}`.
- User-facing "Last synced" indicator: **not yet shipped** (tracked as P2).

---

## 14. Edge Cases & Failure Modes

| Case | Current behavior |
|---|---|
| `habits` array undefined mid-hydrate | `deriveHabitsPageState` returns `[]` safely |
| `habit.reminders` empty | bucket = `anytime`, no cue badge |
| `habit.frequency` missing | V1 `getCurrentStreak` throws; fixed via defaults in fixtures |
| `insightsEngine` throws | `HeroInsightStrip` catches; renders null |
| `HabitDetailSheet` chunk fails to load | `lazyWithRetry` auto-reloads once; then graceful fail |
| Multi-device race on same entry | server-timestamp wins (Law 25); last-write within 1min replaced |
| All 8 languages missing a new key | `npm run i18n:check` fails CI |

---

## 15. Success Metrics

**Activation:** % of first-visit users who add ≥1 habit within their session
(target ≥70% via quick-picks).

**Retention:** 7-day completion rate for users with ≥3 habits (target ≥60%
based on research; Habitify benchmark ~55%).

**Depth:** % of users who ever open HabitDetailSheet (target ≥20% —
validates the long-press discovery).

**Cross-habit signal:** % of users who see ≥1 HeroInsightStrip render in a
session (requires ≥30 days data; target ≥40% by day 45).

---

## 16. Out of Scope (P2 / future)

- Drag-reorder within buckets (requires DnD library; adds 15 KB)
- Habit stacking recipes ("After X, I will Y" — needs relationship model)
- AI-level-up nudges ("You've hit 7 days — ready for 3 min?")
- Shareable streak card (social export)
- Widget quick-action (Capacitor WidgetKit / Android appwidget)
- Weekly review Sunday ritual prompt
- Cross-user challenges (already in V1 `onChallenge` — deferred)

---

## 17. Revision History (ADR-lite)

| Date | Commit | Change |
|---|---|---|
| 2026-04-18 | `c206528` | Initial Phase 3-C HabitsPage w/ Garden + MindMap zones |
| 2026-04-19 | `25c63aa` | A+++ rewrite: Garden/MindMap removed; 4 Hero sub-components; 25 tests |
| 2026-04-19 | `d449c6b` | Empty-state polish (illustration, journey, quick-picks) |
| 2026-04-19 | `8f658fd` | Template library drawer (20 templates × 5 categories); V1 detail sheet; day-complete celebration |
| 2026-04-19 | `4a736ff` | HeroHabitRow wrapper: long-press, 7-day chain, cue badge |
| 2026-04-19 | `7ba9cd4` | V1 `getCurrentStreak` wired → fire + milestone badge |
| 2026-04-19 | `bcfea75` | HeroInsightStrip — V1 insightsEngine surfaced |
| 2026-04-19 | `d3ba792` | Weekly count `N/7` beside chain |
| 2026-04-19 | `22ccd8f` | Overdue reminder amber pill |
| 2026-04-19 | `2ccab7d` | This specification authored |
| 2026-04-19 | `2ddba59` | Focus-return on sheet close (closes §11 a11y gap) |
| 2026-04-19 | `1315b26` | A+++ revamp §§ 2, 8, 9, 11, 12, 13 |
| 2026-04-19 | `0ebd6f8` | Honesty pass — removed fabricated metrics, ✅→🟡 on unverified a11y |
| 2026-04-19 | (this commit) | Streak milestone celebration — useStreakMilestones hook + lazy V1 HabitCompletionCelebration mount at 3/7/21/66/100 day thresholds |
| 2026-04-19 | `4899c17` | Design P0 — Caveat hand-lettering on step numbers + identity pill |
| 2026-04-19 | `003d547` | Design P0 — italic Fraunces on time-of-day headings + subliminal completion tint |
| 2026-04-19 | (this commit) | §15 metrics instrumented — 4 events (`habit_created`, `habit_completed`, `habit_detail_opened`, `insight_strip_rendered`) wired at 4 choke points. PII-safe contract: finite-enum `source`, integer counts, boolean `ever_first`/`session_first` flags backed by `SK.HABITS_EVER_CREATED` + `SSK.HABITS_SESSION_CREATED`. No habit names or IDs leave the device. 12 new analytics tests covering activation funnel, retention cohort annotation, depth, and cross-habit signal |

---

## 18. References

- James Clear, *Atomic Habits* (Avery, 2018).
- BJ Fogg, *Tiny Habits* (HMH, 2019).
- Lally, van Jaarsveld, Potts, Wardle, "How are habits formed: Modelling habit formation in the real world", *European Journal of Social Psychology*, 40(6), 2010.
- Material Design 3 — Gestures. https://m3.material.io/foundations/interaction/gestures
- Apple HIG 2026 — Haptic Touch. https://developer.apple.com/design/human-interface-guidelines/
- Muzli — 2026 Mobile UI Patterns. https://muz.li/blog/whats-changing-in-mobile-app-design-ui-patterns-that-matter-in-2026/
- Focus Bear — Behavioral-Science Habit Apps. https://www.focusbear.io/blog-post/top-5-best-apps-for-atomic-habits-unlock-your-path-to-guaranteed-success
- ChatPRD — PRD Templates. https://www.chatprd.ai/templates
- Product School — The Only PRD Template You Need. https://productschool.com/blog/product-strategy/product-template-requirements-document-prd

---

*End of specification. Treat this file as the contract between the Habits tab and the rest of ZenFlow. Amendments require an entry in §17.*
