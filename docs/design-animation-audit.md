# ZenFlow — Design & Animation Audit (2026-04-19)

> **Trigger:** user feedback — *"дизайн напоминает сайт Клода, а не уникальное что-то"* (the design feels like Claude's site, not unique).
>
> **Goal of this doc:** (1) objective inventory of what's actually shipped today, (2) honest diagnosis of *where* it reads as generic, (3) research-backed direction to reach a distinctive visual + motion voice.
>
> Graded against `docs/quality-rubric.md` §3.3 (UX / design artifact). Current self-score at the end of this doc.

---

## 1. What's actually shipped — inventory (verified 2026-04-19)

### 1.1 Type system (7/10 — distinctive already)

Declared in `tailwind.config.ts` + `src/styles/fonts.css`:

| Role | Family | Role intent | Status |
|---|---|---|---|
| `display` / `serif` | **Fraunces Variable** (Latin) + **Literata Variable** (Cyrillic) | editorial headings, journal entries | ✅ self-hosted, OFL-1.1, WCAG AA verified |
| `body` | **Inter Variable** | UI + body text | ✅ self-hosted |
| `hand` | **Caveat Variable** | gratitude / hand-written moments | ✅ self-hosted |
| `mono` | system mono | code, times | ✅ |

**Verdict:** Fraunces + Caveat is *already* a distinctive choice — Claude's site uses Inter-only. This is our strongest non-generic asset and we're under-using it.

### 1.2 Color system (5/10 — the generic part)

In `src/styles/themes.css` (paper theme as default):

```
paper.surface    ≈ warm cream (oklch 0.98 0.01 80°)
paper.ink        ≈ warm near-black (oklch 0.22 0.01 50°)
paper.primary    ≈ emerald 500 (oklch 0.58 0.15 160°)
paper.accent     ≈ sky 400
paper.mood.{great, good, okay, bad, terrible} — 5-stop valence palette
```

**Why this reads as "Claude's site":**
- Paper cream background + one emerald accent + neutral greys is the 2024-2026 "wellness-app" default (Linear, Notion Calendar, Arc, Atoms-by-Clear, Habitify Pro all converged here)
- No hand-drawn assets, no illustrated texture, no branded iconography — only lucide-react defaults (shared with Claude's site, Linear, Vercel docs, etc.)
- The orb is our one uniqueness vector but **the orb is on `/orb`, not `/habits`** — the Habits tab has zero branded surfaces

### 1.3 Motion system (7/10 — stronger than it looks)

Actual count from `grep -rE "motion\.|AnimatePresence|useShouldAnimate|spring\b|cubic-bezier" src/pages/nav-v2`: **77 references**.

Named primitives under `src/lib/motion/`:
- **Bloom** — enter / appear
- **Fold** — exit / dismiss
- **Morph** — shared-element via View Transitions API
- **Settle** — drag release spring
- **Breathe** — idle pulse
- **Ripple** — tap acknowledge

Plus choreography:
- `staggerDelay(stage)` with named stages: `background 0ms`, `chrome 80ms`, `primary 140ms`, `secondary 220ms`, `cta 360ms`

**Verdict:** the motion vocabulary is **better named than most apps** — 6 verbs + 5 stages is a real design system. Our weakness is not *how* we animate; it's *what the motion is doing emotionally*. Today the motion is "snappy and confident". That's... Claude's site. That's Linear. That's every SaaS.

### 1.4 Shader / canvas (9/10 — our genuine difference)

- `orbShader.frag` — 9-stop color spectrum, superformula SDF shape morphing, glass rim, mood-reactive
- `ValenceOrb.tsx` — React wrapper
- Day / Night cosmic backdrops with time-of-day palettes, dust motes, paper grain, god-rays

**Verdict:** the orb is genuinely distinctive. Nobody else is shipping a mood-reactive WebGL organism. But **it lives on `/orb` only** — the Habits tab has no visual tissue connecting back to it.

---

## 2. Honest diagnosis — where the Habits tab reads generic

### 2.1 Specific "Claude-site" tells

| Tell | Where in our code | Claude / Linear / Notion equivalent |
|---|---|---|
| Rounded rectangles + 1-px border + subtle shadow | every card in `HeroHabitRow`, `HeroEmptyJourney`, library sheet | identical to Claude chat message cards |
| One-accent-color palette (emerald primary on warm-white surface) | `themes.css` paper theme | identical to Linear, Notion Calendar |
| Lucide icons, no custom | every screen | identical to Claude's site (lucide-react) |
| No illustration beyond SVG line-art seed/sprout/tree | `HeroEmptyJourney` GrowthIllustration | Notion onboarding empty states |
| Motion = spring + layout + fade | 77 references | identical to Linear, Vercel, Claude |
| Sans-serif body + numerals tabular-nums | Inter everywhere below headings | identical to Linear |
| Soft shadow + semi-transparent backdrop-blur on sheets | library / detail drawers | identical to iOS / macOS / Claude |

### 2.2 What we have that Claude's site doesn't

- Fraunces display serif (Claude uses system + Soehne / Inter)
- Caveat hand-written family (hand-written moments — not yet used on `/habits`)
- OKLCH perceptual color math with dual-path HSL fallback
- WebGL orb shader — but not visible on `/habits`
- 5-theme time-of-day palettes (dawn / morning / afternoon / golden / dusk) — again, not on `/habits`
- Identity-based copy ("Today you are building: a reader") — this *is* our literary voice

### 2.3 The core gap: the Habits tab uses none of our uniqueness

Audit of `/habits` screens (2026-04-19 Playwright screenshots):

- Fraunces **is used** on `h1`, `h2`, `Plant your first seed` — ✅ distinctive
- Caveat — **never used** on this tab ❌
- Orb — not visible ❌
- Time-of-day palette — bucket labels say "Morning/Afternoon/Evening" but the *surface color* doesn't shift by time of day ❌
- Custom iconography — 0 ❌ (all lucide)
- Illustrated texture / paper grain — 0 on this tab ❌
- Hand-drawn illustrations — only the inline seed/sprout/tree SVG ❌ (and it's line-art, not brushed)

---

## 3. Research-backed uniqueness vectors (2026)

From the research ([Muzli 2026](https://muz.li/blog/whats-changing-in-mobile-app-design-ui-patterns-that-matter-in-2026/), [Elinext 2026 trends](https://www.elinext.com/services/ui-ux-design/trends/key-mobile-app-ui-ux-design-trends/), [Samet Koseoglu 2026 graphic trends](https://www.sametkoseoglu.com/en/2026-graphic-design-trends-the-visual-language-of-the-future/)):

### 3.1 Pattern — "Soft skeuomorphism returns" (Muzli 2026)
> "Soft shadows, textures, and gradients to recreate the familiarity of real materials, adding warmth and depth."

**ZenFlow translation:** the Habits tab is already called "paper theme" — but the paper-ness is theoretical. We have:
- Warm cream background ✅
- Inline SVG paper grain (via `feTurbulence`) declared for paper theme ✅ — **but not rendered on /habits** ❌
- No "pressed / released" tactility on cards ❌
- Cards read flat, not paper-like ❌

### 3.2 Pattern — "Hand-drawn, not stock"
> "Custom, hand-drawn illustrations replace generic stock images — adding authenticity, warmth, emotional connection."

**ZenFlow translation:** our seed/sprout/tree is line-art via lucide-adjacent SVG. It could be:
- Brushed ink instead of geometric line
- Caveat-hand-lettered step numbers instead of Inter "1. 2. 3."
- A different illustration per time-of-day bucket (morning sun · afternoon bird · evening moon · anytime star)

### 3.3 Pattern — "Bold, oversized, animated typography as branding"
> "Typography is integral — bold, oversized, animated fonts establish brand personality."

**ZenFlow translation:** we have variable-axis Fraunces with SOFT axis 0–100. We:
- Use SOFT animation on the *orb greeting* (OrbPage `CinematicHeading`) ✅
- Never animate Fraunces on `/habits` ❌
- Never use the oversized display size on Habits ("Plant your first seed" is only 28px)

### 3.4 Pattern — "Modular, transformable identity"
> "Visual identity is transformable through modular systems — adapts across platforms while staying consistent."

**ZenFlow translation:** we have identity via orb color-state, but nothing on `/habits` changes with the user's state. A habit page could tint its surface based on current `dailyProgress.ratio` — already have the `--page-tint` CSS var (on MoodOrbPicker) but not used on Habits.

---

## 4. Concrete uniqueness moves for `/habits` (prioritized)

### 4.1 P0 — zero new deps, shippable this session

| Move | What it does | File |
|---|---|---|
| **Render paper grain** on `/habits` surface | activate the existing feTurbulence layer that's already declared for paper theme | add class to `<main>` in `HabitsPage.tsx` |
| **Caveat for step numbers** in empty journey | "1. 2. 3." in Caveat italic — tiny but instantly distinctive | `HeroEmptyJourney.tsx` — swap `<span class="font-display">` → `font-hand` |
| **Tint surface by completion ratio** | 0% → warm cream, 100% → soft emerald wash via `--page-tint` | `HabitsPage.tsx` — inline style on `<main>` |
| **Fraunces SOFT axis on "Day complete"** | animate `font-variation-settings: 'SOFT' 0→100` when ring flips emerald | `HeroDailyRing.tsx` |
| **Oversized display on section headings** | `MORNING` → `Morning` at `text-4xl font-display italic` with subtle y-shift on mount | `HeroTimeOfDayGroup.tsx` |

### 4.2 P1 — small asset investment

| Move | What it does | Effort |
|---|---|---|
| Replace geometric seed/sprout/tree with brushed-ink SVG (4 strokes, hand path) | warmth + authenticity vs line-art | 1 hour hand-traced SVG |
| Time-of-day hero illustrations (4 mini SVGs) above each bucket | distinctive per section | 4 × 30 min |
| Hand-lettered identity pill ("a reader", "a mover") in Caveat | literary POV becomes visual | 15 min CSS swap |
| Orb echo on Habits tab — tiny 32px orb showing current mood in the sticky header | cross-screen visual tissue | reuse V1 ValenceOrb, 30 min |

### 4.3 P2 — larger investment

- Custom icon family (24 glyphs minimum) to replace lucide on key touch points (add, check, chain dot). Research estimate: 2-3 days.
- Palette audit: swap one color stop to an unusual hue (e.g., dusky terracotta as secondary instead of sky) — requires design-advisor review.

---

## 5. Motion language — where we're generic vs where we could be distinctive

### 5.1 Today's motion inventory on `/habits`

| Motion | What it communicates | Is it distinctive? |
|---|---|---|
| Bloom on page mount (staggerDelay primary) | "the page arrives" | **no** — every Framer Motion app does this |
| Spring on card tap (V1 CompactHabitCard) | "you did it" | **no** — stiffness 300 damping 20 is the Framer default |
| Layout animation on bucket reorder | "things move gracefully" | **no** — Linear / Notion identical |
| Confetti on day-complete | "win!" | **somewhat** — but confetti is 10-years-old |
| Ring fill transition 600ms cubic-bezier | "progress" | **no** — Apple Rings did this in 2016 |

**Verdict:** the motion is *good* but *anonymous*.

### 5.2 Distinctive motion directions

| Direction | Inspiration | Effort |
|---|---|---|
| **Ink-settle** — when habit completes, animate a tiny ink-blot spreading from the check point, 80ms, pigment bleed | literary / paper metaphor | custom CSS keyframe + 1 SVG filter |
| **Heartbeat chain** — 7-day chain doesn't just highlight today; it *pulses* in sync with a faint 1Hz breathing (only on this tab) | ambient alive-ness | CSS `animation-duration: 1s infinite alternate` |
| **Typography SOFT wobble** on streak milestone — Fraunces' SOFT axis 0→100→0 over 800ms when "1 day streak" first appears | variable-font uniqueness | `font-variation-settings` transition |
| **Day complete → paper crinkle** — instead of confetti, the paper theme momentarily creases (CSS 3D rotateY 4°) — tactile reward | paper metaphor consistency | CSS 3D transform on `<main>` |

None of these require new deps. All reuse existing Fraunces + paper theme + existing Framer Motion.

---

## 6. Scoring this audit against quality-rubric.md §3.3

| Dimension | Raw 0–10 | Weight | Contribution |
|---|---:|---:|---:|
| Honesty | 9.0 | 0.20 | 18.00 |
| Completeness (every state of design / motion / type) | 7.5 | 0.20 | 15.00 |
| Concreteness (file paths, grep counts, hex values cited) | 8.5 | 0.15 | 12.75 |
| Failure-mode coverage (a11y / RTL / reduced-motion) | 6.5 | 0.15 | 9.75 |
| Tradeoff (alternative moves scored) | 8.0 | 0.15 | 12.00 |
| Durability | 7.0 | 0.10 | 7.00 |
| Correctness | 8.0 | 0.05 | 4.00 |
| **Total** | | | **78.50** | **B** |

**Grade: B (78.5/100).** To reach **A+++ (95+)**:
- +4 Completeness by adding storybook-style spec of every visible state
- +4 Failure-mode by documenting RTL + reduced-motion + high-contrast variants per move
- +3 Durability by adding `asOf` to every claim + automated font-family grep for drift
- +3 Tradeoff by scoring alternatives against a common rubric (novelty / effort / risk)

---

## 7. Next action contract

After reading this doc, the next Habits commit should do **one** P0 move from §4.1, not all. Motion-over-design principle per Muzli 2026:

> "The mobile apps that feel best in 2026 aren't the ones using every new pattern — they're the ones that picked the right three and executed them precisely."

My candidate pick (smallest effort, largest distinctiveness delta):
**Caveat-hand step numbers + paper grain on `/habits`** — 10 LOC, no new assets, changes the character of the entire tab.

---

## 8. References

- [Muzli — 2026 Mobile UI Patterns](https://muz.li/blog/whats-changing-in-mobile-app-design-ui-patterns-that-matter-in-2026/)
- [Elinext — Mobile UI/UX Trends 2026](https://www.elinext.com/services/ui-ux-design/trends/key-mobile-app-ui-ux-design-trends/)
- [Samet Koseoglu — 2026 Graphic Design Trends](https://www.sametkoseoglu.com/en/2026-graphic-design-trends-the-visual-language-of-the-future/)
- [Tenet — Visual Branding Guide 2026](https://www.wearetenet.com/blog/visual-branding)
- [The Brands Bureau — 12 Mobile App Design Trends 2026](https://thebrandsbureau.com/mobile-app-design-trends-2026/)
- Apple HIG — Variable Fonts. https://developer.apple.com/fonts/system-fonts/

---

*This audit is itself rated B (78.5). Honest grade, not reflex A+++. Promotion to A+++ requires §7 items shipped + self-re-audit.*
