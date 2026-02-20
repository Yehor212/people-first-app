# IA_STRATEGY_BLUEPRINT.md — ZenFlow Information Architecture Redesign

## Context

ZenFlow has a solid technical foundation (Capacitor 8, React, TypeScript, 52 shadcn/ui components, 3 themes, 8-emotion Plutchik, comprehensive haptics) and completed 4 waves of visual polish (motion standardization, CLS guards, validation haptics). But the **information architecture** has grown organically — features exist as isolated modules rather than an interconnected wellness ecosystem. The Journal has zero connections to mood/habits/garden. Breathing exercises earn no garden representation. Schedule events don't influence insights. Achievements are display-only trophies with no gameplay impact.

**Mission**: Transform ZenFlow from a collection of wellness tools into a unified identity-reinforcing ecosystem where every feature connects to at least 2 others, habits become identity markers ("I am a meditator"), and the app never makes the user feel guilty.

**Scope**: Strategy document only. No React code. Defines the architectural direction for 3-6 months of product development.

---

## Phase 1: Global Navigation & Ergonomics

### 1.1 Current Tab Architecture (Evidence)

4 bottom tabs at 44px touch targets (Navigation.tsx:57):

| Tab | Content Sections | Primary Actions | Feature-Gated |
|-----|-----------------|-----------------|---------------|
| Home (🏠) | Header, TodayFocusCard, EmotionWheel, HabitTracker, GratitudeJournal, RestMode/Celebration | Log mood, toggle habits, add gratitude | gratitudeJournal |
| MyWorld (✨) | Header, ScheduleTimeline, JournalModule, BreathingExercise, FocusTimer, MoodInsights | Add events, write journal, breathe, focus | focusTimer, breathingExercise |
| Stats (📊) | DataMountains, HabitCalendar, WeeklyReview, StatsOverview | View trends | moodCorrelation |
| Settings (⚙️) | Account, Appearance, Notifications, Features, About | Configure app | — |

**Hidden 5th tab**: AchievementsTab exists in code but isn't in Navigation — accessed through Stats or modal only.

### 1.2 Thumb Zone Analysis (6.1" Android One-Handed)

```
┌────────────────────────────┐
│   STRETCH (top 20%)        │  Header: name + 4 buttons (challenges,
│                            │  tasks, quests, friends) — 4 buttons
│   REACH (20-50%)           │  TodayFocusCard, streak info
│                            │
│   NATURAL (50-85%)  ←───── │  Primary actions should live HERE
│   Mood + Habits + Gratitude│  Currently: EmotionWheel, HabitTracker
│                            │
│   SAFE (bottom 15%)        │  Navigation bar (44px targets)
│   [🏠] [✨] [📊] [⚙️]     │
└────────────────────────────┘
```

**Problem**: Header has 4 small icon buttons (challenges, tasks, quests, friends) in the STRETCH zone. These are secondary features competing for prime real estate.

**Recommendation**:
- Collapse Header buttons into a single overflow/hub icon (⋯ or 🎯) that opens a "Hub" bottom sheet
- Keep streak display in greeting line (already done in Wave 2)
- Increase nav tab targets from 44px to 48px (M3 standard)
- All primary actions (mood tap, habit toggle) already in NATURAL zone — ✓

### 1.3 Tab Content Audit: What Belongs Where

**Current problem**: MyWorld/Garden tab is overloaded — it contains Schedule, Journal, Breathing, Focus Timer, AND Insights. These are unrelated features grouped by "everything else."

**Proposed restructure** — rename and refocus:

| Tab | Name | Purpose | Contains |
|-----|------|---------|----------|
| 🏠 | **Today** | Daily actions & check-ins | TodayFocusCard, EmotionWheel, HabitTracker, GratitudeJournal, ScheduleTimeline |
| ✨ | **Garden** | Inner world & reflection | Garden visualization, Companion, JournalModule, BreathingExercise, MoodInsights |
| 📊 | **Growth** | Progress & achievements | Stats, Achievements, WeeklyReview, HabitCalendar, Goals |
| ⚙️ | **Settings** | Configuration | (unchanged) |

**Key change**: Move Schedule from Garden→Today (it's a daily action), move FocusTimer to a floating FAB/overlay (it's a tool, not a destination). Keep Journal in Garden (reflection = inner world). Merge Achievements into Stats tab as "Growth" — no more hidden 5th tab.

### 1.4 Modal vs Inline vs Tab Decisions

Current modal inventory (ModalLayer.tsx — 9 modals, OverlayLayer.tsx — 8 overlays):

| Feature | Current | Recommendation | Rationale |
|---------|---------|----------------|-----------|
| Challenges | Modal | Bottom sheet from Hub | Secondary feature, not worth a modal |
| Tasks | Modal | Inline in Today tab | Daily tasks belong with daily actions |
| Quests | Modal | Bottom sheet from Hub | Gamification is secondary |
| Friends | Modal | Keep modal | Full-screen social feature |
| HabitEditor | Modal | Keep modal | Complex form needs focus |
| AddScheduleEvent | Modal | Keep modal | Form input |
| HyperfocusMode | Overlay | Keep overlay | Full-screen immersive |
| ShareModal | Modal | Keep modal | External action |
| FocusTimer | Inline in GardenTab | **Floating overlay/mini-player** | Timer should persist across tab switches |

**Focus Timer as Mini-Player**: When a focus session is active, show a persistent mini-bar above the navigation (like Spotify's mini-player). Tapping expands to full timer. This lets users check habits/schedule while timing.

### 1.5 Android vs Web PWA Differences

| Aspect | Android (Capacitor) | Web PWA |
|--------|---------------------|---------|
| Navigation | Bottom tabs + swipe (35px edge zone) | Bottom tabs + swipe |
| Focus Timer | DND integration via DndPlugin.java | No DND — show "silence notifications" hint |
| Haptics | Native Haptics plugin (8 patterns) | `navigator.vibrate()` fallback |
| Quick Actions | Android shortcuts (3 defined) | PWA shortcuts in manifest |
| Keyboard | `adjustResize` in AndroidManifest | `visualViewport` resize |
| Push | Firebase FCM | Web Push API (limited) |
| Widgets | Future: Android Glance widget | Not available |

**No IA changes needed** — same information architecture for both platforms. Difference is in capability, not structure.

---

## Phase 2: The "Identity & Mind-Mapping" Ecosystem

### 2.1 Problem: Habits as Todo Items

**Current state** (types/index.ts:84-120):
- Habits have: `name`, `icon`, `color`, `type`, `category`, `completedDates`
- Category is a flat enum: health, mindfulness, productivity, social, creativity, finance, self-care, other
- UX language: "Track your habits", "Complete habit", checkboxes ✓/✗
- Completion celebration: XP popup + confetti (dopamine hit, but no meaning)

**This is a todo-list paradigm.** The user checks boxes. There's no narrative about who they're becoming.

### 2.2 Identity Cluster Model

Transform flat categories into **Identity Clusters** — aspirational self-concepts:

```
┌─────────────────────────────────────────────┐
│              WHO I'M BECOMING               │
├──────────────┬──────────────┬───────────────┤
│ 🧘 The       │ 💪 The       │ 🎨 The        │
│   Mindful Me │   Active Me  │   Creative Me │
│              │              │               │
│ • Meditate   │ • Morning run│ • Practice    │
│   15min ✓    │   ✓          │   guitar      │
│ • Journal    │ • Yoga ✓     │ • Write 500   │
│   entry      │ • 8 glasses  │   words       │
│ • Breathe    │   water (6/8)│ • Sketch      │
│   4-7-8      │              │               │
├──────────────┴──────────────┴───────────────┤
│ Identity Score: 78% aligned with who I      │
│ want to be today                            │
└─────────────────────────────────────────────┘
```

**Data model extension** (add to Habit interface):
- `identityCluster?: string` — user-defined cluster name ("The Mindful Me")
- `identityVerb?: string` — "I am a meditator" / "I am a runner" / "I am a writer"
- `identityIcon?: string` — emoji representing this identity

**UX language shift**:
| Current | Proposed |
|---------|----------|
| "Complete 3 habits today" | "3 steps closer to who you want to be" |
| "You missed 2 habits" | (never say this) |
| "Streak: 7 days" | "7 days of being The Mindful Me" |
| "Habit completed!" | "Another moment as a meditator 🧘" |
| "Add new habit" | "Add to your identity" |

### 2.3 Identity Reinforcement vs Streak Anxiety

**Current**: Streaks are the primary motivator. Breaking a streak = visible failure (counter resets to 0).

**Problem**: Streak anxiety is the #1 reason users abandon wellness apps. "I missed Day 42, why bother continuing?"

**Proposed: "Growth Rings" model** (inspired by tree rings):

```
Current streak display:        Proposed "Growth Ring":

🔥 42-day streak               🌳 42 rings of growth
                               ┌──────────────────┐
(breaks to 0 = devastation)    │  ╭──╮            │
                               │ ╭╯  ╰╮  Each ring│
                               │╭╯ ●● ╰╮ = 1 day │
                               │╰╮ ●● ╭╯ of being│
                               │ ╰╮  ╭╯  YOU     │
                               │  ╰──╯            │
                               └──────────────────┘

                               Missed days = thinner rings
                               (still visible, never erased)
```

**Key insight**: A tree doesn't lose its rings when it has a dry season. The rings just get thinner. **Growth is permanent.**

Implementation:
- Keep `currentActiveStreak` for internal gamification math
- UI shows "Growth Rings" — total active days (never resets), with visual density showing consistency
- Rest Mode contributes a "rest ring" (different color, still counts as growth)
- Companion says "Every ring makes you stronger" instead of "Don't break your streak!"

### 2.4 Visual Identity Map

A new section in the Growth/Stats tab — "Who I Am":

```
┌─────────────────────────────────────┐
│          🌟 My Identity Map          │
│                                     │
│    🧘 Mindful    ████████░░  80%    │
│    💪 Active     ██████░░░░  60%    │
│    🎨 Creative   ████░░░░░░  40%    │
│    📚 Learner    ██░░░░░░░░  20%    │
│                                     │
│  "You're most aligned with          │
│   The Mindful Me this week"         │
│                                     │
│  Weekly shift: Mindful ↑12%         │
│               Active ↓5%            │
└─────────────────────────────────────┘
```

Data source: aggregate habit completion rates by cluster. No new data storage needed — computed from existing `completedDates` grouped by `identityCluster`.

---

## Phase 3: The Contextual Reflection Engine

### 3.1 Problem: Journal in Isolation

**Current state** (features/journal/JournalModule.tsx — 1061 lines):
- Journal is a standalone module in GardenTab
- Rich feature set: stickers, photos, audio, tags, habit snapshots, 5 templates, calendar, stats, export/import, password protection
- **Zero connections** to: mood data, habit patterns, garden, companion, weekly insights, breathing
- Journal entries don't earn XP or treats
- Journal has no contextual prompts based on user's actual day

**This is the biggest silo in the app.**

### 3.2 Contextual Micro-Reflection Prompts

Instead of "Open journal and write something", the app surfaces **micro-reflection moments** at natural transition points:

| Trigger | Prompt | Location | Type |
|---------|--------|----------|------|
| After logging mood=joy + 3 habits done | "What made today click? Quick thought:" | Toast/bottom sheet | Micro (1-2 sentences) |
| After focus session reflection | "You rated productivity 4/5. What helped you focus?" | FocusReflectionModal extension | Micro |
| After completing all habits | "All done! One word for how you feel:" | AllCompleteCelebration | Nano (1 word) |
| Evening (7pm+, mood not logged) | "How was your day? Even one word helps." | Gentle notification | Micro |
| After 3 days of joy mood | "You've felt joyful 3 days running. What's different?" | MoodInsights card | Short reflection |
| After breaking a habit streak | "Rest is growth. What does tomorrow look like?" | Companion dialog | Micro |
| Weekly (Sunday) | "This week in 3 words:" | Weekly Review prompt | Nano |

**Implementation approach**:
- New hook: `useReflectionPrompts(moods, habits, focusSessions)` — computes which prompt to show based on current context
- Prompts are NOT journal entries by default — they're lightweight inputs
- User can choose to "Expand to full journal entry" → opens JournalEntryEditor with context pre-filled
- Micro-reflections stored as a new lightweight type (not full JournalEntry — no stickers/photos)

### 3.3 Journal ↔ Everything Connections

| Connection | Direction | Implementation |
|-----------|-----------|----------------|
| Journal → Garden | Journal entry → plants a "story flower" (new plant type: `story`) | `plantSeed('journal')` in useInnerWorld |
| Journal → XP/Treats | Entry earns 20 XP + treats (same as other activities) | Wire `awardXp`/`earnTreats` in JournalModule |
| Journal → Companion | Companion "collects stories" — react to journal count | Companion mood state: `storytelling` |
| Mood → Journal | Pre-fill journal prompt with current mood context | Pass mood data to JournalEntryEditor |
| Habits → Journal | "Habit snapshot" already exists — enhance visibility | Show in journal entry metadata |
| Focus → Journal | Post-focus reflection can expand to journal entry | Link FocusReflectionModal → JournalEntryEditor |
| Weekly Insights → Journal | Weekly review includes "Journal highlights" section | Pull journal entries into weeklyInsights.ts |

### 3.4 Reflection Depth Levels

Not every reflection needs to be a 500-word essay. Define 3 levels:

| Level | Name | Input | Stored As | Earns |
|-------|------|-------|-----------|-------|
| 🔵 Nano | Word/Emoji | 1 word or emoji | Tag on existing data | 5 XP |
| 🟢 Micro | Quick thought | 1-2 sentences | Lightweight reflection record | 10 XP |
| 🟣 Deep | Journal entry | Full rich editor | JournalEntry (existing) | 20 XP |

Users naturally graduate from Nano → Micro → Deep as they build the reflection habit. The app never forces depth.

---

## Phase 4: Systemic Interconnectivity & The Garden Loop

### 4.1 Current Feature Connection Map

```
                    ┌─────────┐
           XP ←─────┤  Mood   ├─────→ Garden Weather
                    └────┬────┘       (mood→weather mapping)
                         │
                    mood-habit
                    correlation
                         │
           XP ←─────┌───┴────┐
         Treats ←───┤ Habits ├────→ Garden Plants (tree)
                    └───┬────┘       Challenges (streak req)
                        │
                   ┌────┴─────┐
          XP ←─────┤  Focus   ├────→ Garden Plants (crystal)
        Treats ←───┤  Timer   │       Reflection → mood check
                   └──────────┘

           XP ←─────┌──────────┐
         Treats ←───┤Gratitude ├───→ Garden Plants (mushroom)
                    └──────────┘

                    ┌──────────┐
                    │ Journal  │     ← ISOLATED (no connections)
                    └──────────┘

                    ┌──────────┐
                    │Breathing │     ← ISOLATED (only XP on complete)
                    └──────────┘

                    ┌──────────┐
                    │ Schedule │     ← ISOLATED (no connections)
                    └──────────┘

                    ┌──────────┐
                    │Achievemts│     ← DISPLAY-ONLY (no gameplay impact)
                    └──────────┘

         Treats ──→ Companion ──→ mood/hunger/energy states
         Plants ──→ Garden    ──→ creatures (unlock by plant count)
```

**4 major silos**: Journal, Breathing, Schedule, Achievements

### 4.2 Proposed Connection Map (Target State)

```
                         ┌──────────────────┐
                         │   GARDEN WORLD   │
                         │  (central hub)   │
                         └──┬──┬──┬──┬──┬───┘
                            │  │  │  │  │
              ┌─────────────┘  │  │  │  └──────────────┐
              │                │  │  │                  │
         ┌────┴────┐     ┌────┴──┴──┴────┐       ┌─────┴──────┐
         │  Mood   │←───→│   Companion   │←─────→│  Journal   │
         │ (flower)│     │  (reactions,  │       │ (story     │
         └────┬────┘     │   stories)   │       │  flower)   │
              │          └──────┬───────┘       └─────┬──────┘
              │                 │                      │
         mood-habit        feed with              context from
         correlation       treats                 mood+habits
              │                 │                      │
         ┌────┴────┐     ┌─────┴──────┐         ┌─────┴──────┐
         │ Habits  │←───→│   Treats   │←────────│ Breathing  │
         │ (tree)  │     │  (currency)│         │ (wind in   │
         └────┬────┘     └─────┬──────┘         │  garden)   │
              │                │                └────────────┘
              │          ┌─────┴──────┐
         challenges      │    XP &    │
              │          │   Levels   │
         ┌────┴────┐     └─────┬──────┘
         │ Focus   │           │
         │(crystal)│     ┌─────┴──────┐
         └────┬────┘     │Achievements│──→ Garden decorations
              │          └────────────┘    unlock areas
         reflection                        companion outfits
              │
         ┌────┴────┐     ┌────────────┐
         │Schedule │←───→│  Insights  │←── aggregates ALL
         │(garden  │     │ (weekly +  │    data sources
         │ time)   │     │  identity) │
         └─────────┘     └────────────┘
```

### 4.3 New Connections (Detailed)

#### Breathing → Garden: "Wind"
- Completing a breathing session adds a "wind effect" to the garden for 2 hours
- Visual: leaves rustle, flowers sway, companion looks peaceful
- Plants in the garden grow 10% faster during wind effect
- New plant type: `air_plant` — grown specifically from breathing sessions
- Implementation: `plantSeed('breathing')` + `world.activeEffects.wind: { until: timestamp }`

#### Journal → Garden: "Story Flower"
- Each journal entry plants a "story flower" — a unique plant type that displays a snippet of the entry
- Deep entries (>100 words) grow into "story trees" with visible pages
- Companion "collects stories" — shows reading animation after journal entry
- Implementation: `plantSeed('journal')` call + new PlantType `'story'`

#### Schedule → Garden: "Time of Day"
- Garden atmosphere changes based on current schedule:
  - During "Focus" events: garden becomes quiet, muted colors, companion sits still
  - During "Social" events: butterflies appear, garden is lively
  - During "Rest" events: nighttime ambiance, stars visible
  - No events: default seasonal atmosphere
- Implementation: Pass `todayAllEvents` to garden renderer, derive `gardenMood` from current time slot

#### Achievements → Garden: Decorations
- Unlocking achievements adds permanent decorations to the garden:
  - `first_mood` → Garden bench appears
  - `week_warrior` → Stone path grows
  - `zen_master` → Zen garden area unlocks
  - `habit_champion` → Training area with companion
  - Legendary badges → Unique garden biomes (crystal cave, cherry blossom grove)
- Companion gains outfits/accessories from achievements
- Implementation: New `gardenDecorations: string[]` in InnerWorld type, mapped from earned achievements

#### Companion as Interconnection Agent
Current companion states (useInnerWorld.ts): happy, supportive, neutral, etc.

**Expand companion behaviors** to react to ALL features:
| Event | Companion Reaction |
|-------|--------------------|
| Journal entry written | Sits and reads (animation) |
| Breathing completed | Deep breath animation, looks calm |
| Focus session done | Stretches and celebrates |
| Mood logged as sad | Moves closer, sits beside user |
| All habits complete | Does a dance |
| Friend added | Waves excitedly |
| Schedule event starting | Taps user (notification tie-in) |
| Rest Mode activated | Curls up and sleeps |
| 7-day streak | Wears a cape for the day |

### 4.4 The "Everything Feeds the Garden" Principle

**Rule**: Every user action that takes >5 seconds of intentional effort should visibly change the garden within 2 seconds.

| Action | Garden Effect | Immediacy |
|--------|--------------|-----------|
| Log mood | Flower planted + weather shift | Instant |
| Complete habit | Tree grows a ring | Instant |
| Focus session complete | Crystal planted | On completion |
| Gratitude entry | Mushroom planted | Instant |
| Journal entry | Story flower planted | On save |
| Breathing exercise | Wind effect + air plant | On completion |
| Complete challenge | Decoration unlocked | On completion |
| Achievement earned | Decoration + companion outfit | On earn |

---

## Phase 5: Progressive Disclosure & Onboarding

### 5.1 Current State

onboardingFlow.ts: Calendar-day gating (Day 1-4):
- Day 1: Mood + Habits (always)
- Day 2: Focus Timer (after 1 habit)
- Day 3: XP + Quests + Companion (after 2 focus sessions)
- Day 4: Tasks + Challenges

**Problem**: Default state has ALL features unlocked (lines 107-123). The progressive system exists in code but is bypassed. Even when active, it's calendar-based, not behavioral.

### 5.2 Proposed: Narrative-Driven Disclosure

Replace calendar days with **Garden Growth Stages** as unlock mechanism:

| Garden Stage | Unlocks | Trigger | Companion Says |
|-------------|---------|---------|----------------|
| 🌱 **Seed** (Day 1) | Mood, Habits | App install | "Welcome! Let's plant our first seed together." |
| 🌿 **Sprout** | Focus Timer, Schedule | First 3 habits completed | "Your garden is sprouting! Time to focus on growth." |
| 🌳 **Growing** | Journal, Breathing, Gratitude | First focus session + 5 habits | "Our garden is growing! I want to hear your stories." |
| 🌸 **Blooming** | Challenges, Quests, Friends | 3 journal entries + 7-day activity | "We're blooming! Ready for some challenges?" |
| 🏡 **Flourishing** | Tasks, Advanced Stats, AI Coach | 14-day veteran | "Our garden is a world now. Every detail is yours to shape." |

**Key differences from current**:
1. **Behavioral, not calendar-based** — fast users unlock faster
2. **Tied to garden narrative** — unlocks feel like natural growth, not arbitrary gates
3. **Companion narrates** — each unlock is a story moment, not a system notification
4. **No default-all-unlocked** — new users start at Seed stage genuinely

### 5.3 Feature Discovery Moments

Instead of tutorial tooltips, use **companion discovery**:

```
┌─────────────────────────────────────────┐
│  🦊 Luna noticed something!              │
│                                          │
│  "You've completed 3 habits in a row!   │
│   I found something new in the garden..." │
│                                          │
│  [Show me!]          [Maybe later]       │
│                                          │
│  ← Leads to Focus Timer with            │
│    contextual "first time" tutorial      │
└─────────────────────────────────────────┘
```

### 5.4 Re-engagement for Returning Users

**Current**: Companion enters `supportive` mood when user returns after absence (useInnerWorld.ts:73-87).

**Enhance**:
- Garden shows "what grew while you were away" (plants don't die — they pause)
- Companion says "I kept the garden safe. Want to see what bloomed?"
- Show a "Welcome Back" card with: days away, garden health (still good!), gentle suggestion
- **Never show**: "You missed X days", broken streak counter, wilted plants

### 5.5 Re-discovery for Veteran Users

Users who've been active 30+ days may have forgotten features. Companion periodically suggests:
- "I noticed you haven't breathed with me in a while. Want to try?" (if breathing unused 7+ days)
- "Your journal has 20 stories! Want to look back?" (milestone)
- "There's a new challenge that matches your habits." (when challenge fits identity cluster)

---

## Phase 6: Guilt-Free UX & OS-Level Integration

### 6.1 The Anti-Guilt Manifesto

**Core principle**: The app exists to support, never to judge. Every UI element, notification, and metric must pass the "guilt test":

> "If the user hasn't opened the app in 5 days, would this element make them feel bad?"

If yes, redesign it.

### 6.2 Guilt Audit of Current Features

| Feature | Guilt Risk | Current | Fix |
|---------|-----------|---------|-----|
| Streak counter | 🔴 HIGH | Resets to 0 on miss | Growth Rings (Phase 2.3) — never resets |
| Habit checkboxes | 🟡 MEDIUM | Unchecked = visible failure | Show completed only, collapse uncompleted |
| "You missed X habits" | 🔴 HIGH | Not implemented (good!) | Never implement this |
| Empty garden | 🟡 MEDIUM | Possible if new user | Garden always has life (companion, ambient creatures) |
| Companion hunger | 🟡 MEDIUM | Hunger drops without treats | Companion never starves — auto-forages if unfed for 2 days |
| Streak break notification | 🔴 HIGH | Not implemented (good!) | Never implement this |
| Weekly review negatives | 🟡 MEDIUM | Shows "decreased" trends | Reframe: "This week you focused on X" (what was done, not what wasn't) |
| Rest Mode limit (1/7 days) | 🟢 LOW | Already positive framing | Keep — enhance with "Rest Ring" in Growth Rings |

### 6.3 "Rest as Growth" Design

**Current Rest Mode** (useRestMode hook): 1 activation per 7 days, preserves streak.

**Enhance**:
- Rest Mode plants a special "rest flower" in the garden (calming blue/lavender)
- Companion meditates alongside user during rest mode
- Rest days counted in Growth Rings as "rest rings" (lighter color, same importance)
- Weekly review: "You grew for 6 days and rested for 1. Perfect balance."
- Never frame rest as "skipping" — it's an intentional action with its own reward

### 6.4 Notification Philosophy

**Rule**: Notifications are invitations, never guilt trips.

| Type | Tone | Example | Anti-Example |
|------|------|---------|-------------|
| Morning reminder | Warm invitation | "Your garden is waiting. Ready for a new day?" | "You haven't logged your mood!" |
| Evening check-in | Gentle reflection | "How was today? Even one word is enough." | "You missed 3 habits today" |
| Streak at risk | NOT SENT | (no notification) | "Your 42-day streak will break tomorrow!" |
| Return after absence | Welcome back | "Luna missed you! Your garden grew while you rested." | "You've been away for 5 days" |
| Weekly digest | Celebration | "This week: 14 moments of growth." | "You only completed 60% of your goals" |
| Challenge expiring | Gentle info | "Your challenge wraps up tomorrow." | "You're about to fail your challenge!" |

**DND Respect** (DndPlugin.java):
- App already has DND check capability
- During focus sessions: automatically enable DND (existing)
- During rest mode: suppress all app notifications
- Quiet hours: respect system DND, never override

### 6.5 OS-Level Integration Strategy

#### Android Widgets (Future — not in scope of this blueprint, but architect for it)
- **Quick Mood Widget** (2×1): 5 emoji buttons → 1-tap mood logging without opening app
- **Daily Progress Widget** (2×2): Garden preview + completed/total habits + companion
- **Focus Timer Widget** (2×1): Start/stop timer directly from homescreen

Data requirement: Widget reads from SharedPreferences (Capacitor Storage bridge). Already possible with `@capacitor/preferences`.

#### Quick Actions (useQuickActions.ts)
- Already has 3 actions defined
- Enhance: "Log Mood", "Start Focus", "Quick Gratitude" — all single-tap entries
- Add: "Rest Mode" quick action for intentional rest

#### Notification Channels (Android O+)
Define distinct channels so users can granularly control:
- `zen_morning` — Morning check-in (default ON)
- `zen_evening` — Evening reflection (default ON)
- `zen_weekly` — Weekly review (default ON)
- `zen_social` — Friend activity (default OFF)
- `zen_achievements` — Achievement unlocks (default ON)
- `zen_companion` — Companion messages (default ON)

---

## Feature Interconnection Matrix

Every feature must connect to 2+ others. Current vs Target:

| Feature | Current Connections | Target Connections | New Links |
|---------|-------------------|--------------------|-----------|
| Mood | 3 (XP, Garden weather, Insights) | 5 | + Journal context, + Companion reaction |
| Habits | 4 (XP, Treats, Garden plant, Challenges) | 6 | + Identity clusters, + Journal snapshot |
| Focus | 3 (XP, Treats, Garden plant) | 5 | + Schedule awareness, + Companion reaction |
| Gratitude | 2 (XP, Garden plant) | 4 | + Journal integration, + Companion reaction |
| **Journal** | **0** | **5** | Garden story plant, XP/Treats, Companion, Mood context, Insights |
| **Breathing** | **1** (XP only) | **4** | Garden wind+plant, Treats, Companion, Mood influence |
| **Schedule** | **0** | **3** | Garden atmosphere, Insights, Focus timer link |
| **Achievements** | **0** (display only) | **3** | Garden decorations, Companion outfits, Identity reinforcement |
| Companion | 2 (Treats, Garden) | **7** | + reacts to ALL features |
| Garden | 3 (Plants, Creatures, Weather) | **8** | + wind, stories, decorations, atmosphere, rest flowers |

**Result**: 0 features with <2 connections (was 3 silos). Garden becomes the universal connection hub.

---

## Implementation Waves

### Wave A: Identity Foundation (types + data model)
- Add `identityCluster`, `identityVerb` to Habit type
- Add `'story'` and `'air_plant'` to PlantType
- Add `gardenDecorations`, `activeEffects` to InnerWorld type
- Add `ReflectionPrompt` and `MicroReflection` types
- Wire Journal → XP/Treats (the lowest-hanging fruit)

### Wave B: Journal Integration
- JournalModule: call `plantSeed('journal')` on entry save
- JournalModule: call `awardXp`/`earnTreats` on entry save
- Contextual prompts: `useReflectionPrompts` hook
- Focus reflection → Journal expansion option
- Companion "reading" animation state

### Wave C: Breathing & Schedule Integration
- Breathing → `plantSeed('breathing')` + wind effect
- Schedule → garden atmosphere based on current event type
- Breathing → treats + companion reaction
- Schedule → focus timer link (start timer from schedule event)

### Wave D: Identity & Growth Rings
- Identity cluster UI in HabitTracker
- Growth Rings visualization replacing streak counter
- Identity Map in Stats/Growth tab
- Habit completion language shift (identity affirmations)

### Wave E: Garden Enrichment
- Achievement → garden decoration mapping
- Companion expanded behavior states
- Rest Mode → rest flower + companion meditation
- Companion auto-forage (guilt-free hunger)

### Wave F: Progressive Disclosure Rework
- Replace Day 1-4 with Garden Stage gating
- Companion-narrated feature discovery
- Welcome-back flow enhancement
- Re-discovery suggestions for veterans

---

## Verification Criteria

For each wave:
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npx eslint . --max-warnings=0` — 0 warnings
- [ ] `npx vitest --run` — all tests pass (2460+ baseline)
- [ ] `npm run build` — success
- [ ] Every new feature has 2+ connections to existing features (matrix check)
- [ ] Zero guilt-test violations (audit every new string/notification)
- [ ] i18n: all new strings added to all 8 languages
- [ ] Accessibility: screen reader labels, reduced motion, color contrast
- [ ] Android device test: thumb zone, haptics, keyboard
- [ ] Growth Rings never show "0" or "reset" language

---

## Critical Files

| File | Role | Changes |
|------|------|---------|
| src/types/index.ts | Type definitions | Add IdentityCluster, ReflectionPrompt, extended PlantType, garden decorations |
| src/hooks/useInnerWorld.ts | Garden state hub | New plantSeed sources, wind effects, decorations, companion behaviors |
| src/features/journal/JournalModule.tsx | Journal module | Wire XP/Treats/plantSeed, accept context prompts |
| src/components/habit-tracker/HabitTracker.tsx | Habit UI | Identity cluster grouping, language shift |
| src/lib/onboardingFlow.ts | Progressive disclosure | Garden Stage gating replacing Day gating |
| src/lib/gamification.ts | XP/achievements | Wire journal/breathing XP, achievement→decoration mapping |
| src/components/tabs/HomeTab.tsx | Today tab | Schedule moved here, micro-reflection prompts |
| src/components/tabs/GardenTab.tsx | Garden tab | FocusTimer moved out, garden visualization enhanced |
| src/i18n/translations.ts | All strings | Identity language, companion dialogs, reflection prompts (×8 languages) |
| src/lib/moodInsights.ts | Insights engine | Add journal/breathing/schedule to correlation data |
