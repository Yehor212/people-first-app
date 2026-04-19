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

## 2. Target Personas (primary → secondary)

1. **The Returning Intender** (primary) — has tried 3+ trackers, each time
   churned after 9-14 days because the app became a chore. Needs:
   friction-free tap, clear "why I'm doing this", immediate visible signal.
2. **The Fresh Starter** — never used a tracker. Needs guided onboarding,
   not a blank form. Their first habit must land within 30 seconds.
3. **The Power User** — 6-12 active habits, wants cross-habit stats.
   Needs long-press detail + insights + archive.

Non-personas: data hoarders, quantified-self quantifiers, team/workplace
habit coaches.

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

```
                     ┌─────────┐
     templateToHabit │ DRAFT   │ ─── setHabits([...prev, h]) ─────────┐
         or form     └────┬────┘                                       │
                          │ persisted (Dexie)                          │
                          ▼                                            │
                     ┌─────────┐                                       │
      tap toggle ◄── │ ACTIVE  │ ──► entries[date] = {value: 1}        │
                     └────┬────┘                                       │
                          │                                            │
       long-press ────────┤                                            │
                          │ open Detail                                │
                          │                                            │
                  ┌───────┴───────┐                                    │
                  │               │                                    │
              archive          skip                                    │
                  │               │ entries[date] = {value: -1}        │
                  ▼               ▼                                    │
            ┌─────────┐     ┌─────────┐                               │
            │ARCHIVED │     │ SKIPPED │                               │
            └─────────┘     └─────────┘                               │
                                                                       │
                          delete ──────────► removed from store ◄─────┘
```

---

## 9. i18n Matrix

Key namespace: `navV2Habits*` (47 keys as of 2026-04-19).

| Category | Keys | Example |
|---|---:|---|
| Nav + placeholders | 4 | `navV2Habits` = "Habits" |
| Hero copy | 8 | `navV2HabitsHero` = "Today's habits" |
| Time buckets | 4 | `navV2HabitsMorning` = "Morning" |
| Identity | 2 | `navV2HabitsIdentityToday` = "Today you are building:" |
| Onboarding | 5 | `navV2HabitsOnboardingStep1` = "Pick your identity" |
| Status | 6 | `navV2HabitsAllDone` = "Day complete — rest earned" |
| Library | 8 | `navV2HabitsLibraryTitle` = "Habit library" |
| Categories | 5 | `navV2HabitsCategoryBody` = "Body" |
| Misc | 5 | `navV2HabitsRecovery` = "One missed day doesn't reset progress" |

**All 8 languages** (en, uk, es, de, fr, ja, ar, he) must have every key.
RTL correctness verified for ar/he (`[dir="rtl"]` + logical properties).

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

- [ ] Every interactive target ≥44×44 CSS px
- [ ] `aria-labelledby` wires `<main>` to heading
- [ ] Ring has `role="img"` + `aria-live="polite"` + `aria-label="Today's habits: 1 / 3"`
- [ ] Every chip has `aria-label` (not just emoji)
- [ ] Long-press has keyboard fallback (Enter/Space)
- [ ] Swipe actions have hover/click fallback on desktop (V1 already has)
- [ ] Template library category tabs are `<button aria-pressed>`
- [ ] Confetti is `aria-hidden` (decorative)
- [ ] Android back handler closes sheets
- [ ] Focus returns to invoking element on sheet close

---

## 12. Performance Budget

| Metric | Target | Notes |
|---|---:|---|
| FCP | < 1.5s | Mobile 4G |
| LCP | < 2.5s | Hero region |
| INP | < 200ms | Tap-to-complete |
| CLS | < 0.05 | Sticky ring must not shift |
| JS bundle (chunk shared with Nav-V2) | < 120 KB gz | V1 HabitDetailSheet is its own lazy chunk |
| 60 FPS | required | Sticky ring scroll; chain dot reflow |

Instrumented via `src/observability/reportWebVitals.ts` (dev only).

---

## 13. Offline-first Behavior (Law 10, Capacitor)

- All writes via `setHabits` → Zustand → Dexie (always available offline)
- Cloud sync (Supabase) uses `src/lib/offlineQueue.ts` — operations enqueue when offline, replay on reconnect
- Pull-before-push rule (Law 25 — Race Law) applies
- Android back: closes sheet, not navigates away (`useBackHandler`)
- Safe-area insets honored on iOS (`pb-[calc(env(safe-area-inset-bottom)+1.25rem)]` in library sheet)
- `-webkit-backdrop-filter` paired with `backdrop-filter`

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
