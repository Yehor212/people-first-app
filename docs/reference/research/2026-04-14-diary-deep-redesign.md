# Diary Deep Redesign — Research & Feature Specification

**Date:** 2026-04-14
**Scope:** Complete diary (journal) feature analysis, competitive gap analysis, and improvement roadmap
**Research:** 5 parallel agents, 200+ findings, 40+ sources, 87 competitive features mapped
**Goal:** Telegram-level polish and thoughtfulness, zero visual regression

---

## Table of Contents

1. [Current State Audit](#1-current-state-audit)
2. [Competitive Landscape](#2-competitive-landscape)
3. [Gap Analysis: What We're Missing](#3-gap-analysis-what-were-missing)
4. [Telegram-Level Polish Specifications](#4-telegram-level-polish-specifications)
5. [Feature Specifications by Priority Tier](#5-feature-specifications-by-priority-tier)
6. [Data Model Extensions](#6-data-model-extensions)
7. [Existing Feature Improvements](#7-existing-feature-improvements)
8. [Animation & Interaction Spec](#8-animation--interaction-spec)
9. [Implementation Roadmap](#9-implementation-roadmap)

---

## 1. Current State Audit

### Architecture: 27 components, 16.5K LOC, 90% mature

```
JournalModule (1,707 LOC — orchestrator)
├── JournalLockScreen (password/biometric)
├── JournalEntryList (896 LOC — list + search + filters)
│   ├── JournalCalendar (249 LOC — week strip)
│   ├── JournalCalendarFull (265 LOC — month grid)
│   ├── Search (text + AI semantic, debounced)
│   ├── Mood/Tag filter pills
│   └── Grouped entries (Today/Yesterday/This Week/Earlier)
│       └── JournalEntryCard (466 LOC — preview + gestures)
│           └── JournalEntryViewer (expanded view)
├── JournalEntryEditor (1,548 LOC — rich text + media)
│   ├── DiaryFormatToolbar (7 actions: B/I/U/S/blockquote/code/link)
│   ├── JournalPhotoPicker + JournalPhotoGallery
│   ├── JournalStickerPicker (max 10)
│   ├── JournalTemplatePicker (5 templates)
│   ├── Mood selector + tag input
│   ├── Theme/font/texture drawers (10+4+6+14 options)
│   └── Canvas particle backgrounds
├── JournalStats (681 LOC — analytics)
│   ├── Year in Pixels (Daylio-style mood grid)
│   ├── Mood Distribution (donut chart)
│   ├── Mood Over Time (line chart, 12-week)
│   ├── Writing Frequency (bar chart, 8-week)
│   ├── Most Active Day (day-of-week bars)
│   ├── Tag Cloud (top 20)
│   └── Most Used Stickers (horizontal bars)
├── BurnThoughtWidget (869 LOC — cinematic flame animation)
├── GratitudeBloomWidget (343 LOC — particle bloom)
├── DiaryBreatheWidget (breathing guide)
├── ZenFocusMode (distraction-free writing)
└── ExportPickerDialog (JSON/CSV/PDF/Markdown)
```

### Data Model (Current)

```typescript
interface JournalEntry {
  id: string;
  date: string; // "YYYY-MM-DD"
  title: string;
  content: string; // Rich HTML
  stickers: string[]; // max 10
  photoIds: string[]; // max 5
  audioIds?: string[]; // max 3
  mood?: "great" | "good" | "okay" | "bad" | "terrible";
  tags: string[];
  templateId?: string;
  habitSnapshot?: { habitId; habitName; icon; completed }[];
  // Styling
  theme?: DiaryThemeName; // 10 themes
  font?: DiaryFontName; // 4 fonts
  inkColor?: string;
  paperTexture?: PaperTexture; // 6 textures
  bgPattern?: DiaryBgPattern; // 14 patterns
  paperColor?: PaperColor; // white/dark/milky
  bgIntensity?: BackgroundIntensity;
  particleSpeed?: ParticleSpeed;
  fontSize?: "small" | "medium" | "large";
  photoLayout?: Record<string, { x; y; width }>;
  createdAt: number;
  updatedAt: number;
}
```

### Current Strengths (Keep & Protect)

| Feature                   | Quality     | Notes                                                |
| ------------------------- | ----------- | ---------------------------------------------------- |
| BurnThought animation     | Exceptional | 4-phase cinematic: ignition → spread → embers → fade |
| Theme/font/texture system | Excellent   | 10×4×6×14 combinations, paper-sheet aesthetic        |
| WYSIWYG editor            | Very good   | 7 formatting actions, DOMPurify sanitization         |
| Year in Pixels            | Good        | Daylio-style, color-coded mood grid                  |
| Gesture handling          | Polished    | Swipe-to-delete + long-press edit, RTL-aware         |
| Security lock             | Complete    | Password + biometric + panic lock + auto-timeout     |
| AI search                 | Good        | Semantic similarity + text fallback                  |
| Export                    | Complete    | 4 formats, cloud sync, import with merge/replace     |

### Current Gaps (from code analysis)

| Gap                            | Severity | Detail                                      |
| ------------------------------ | -------- | ------------------------------------------- |
| No quick entry mode            | HIGH     | Every entry requires full editor open       |
| No "On This Day" memories      | HIGH     | Zero nostalgia/retention hooks              |
| No streak system               | HIGH     | No engagement loop beyond content           |
| No AI insights/reports         | MEDIUM   | AI only used for search, not analysis       |
| No home screen widget          | MEDIUM   | No ambient reminder presence                |
| No entry types                 | MEDIUM   | All entries identical structure             |
| No gamification                | MEDIUM   | No badges, achievements, challenges         |
| No voice-to-text               | MEDIUM   | Audio exists but no transcription           |
| No weather/location context    | LOW      | No auto-metadata capture                    |
| No dream journal mode          | LOW      | No specialized entry type                   |
| Calendar lacks click-to-detail | LOW      | Can't tap a day to see entries for that day |
| No shared/social features      | LOW      | Fully private, no sharing options           |

---

## 2. Competitive Landscape

| App                     | Users       | $/year       | Unique Strength                  | What They Do Better                                           |
| ----------------------- | ----------- | ------------ | -------------------------------- | ------------------------------------------------------------- |
| **Day One**             | 15M+        | $50          | Premium multimedia + On This Day | Auto-metadata, map view, printed books, shared journals       |
| **Daylio**              | 8M+         | $36          | Micro-diary, no writing needed   | 2-tap mood+activity, correlations, lowest friction            |
| **Reflectly**           | Popular     | $60          | Conversational AI + CBT          | AI-guided sessions, sentiment analysis, adaptive prompts      |
| **Rosebud**             | Growing     | $156         | Chat-based AI journal            | Conversational interface, weekly AI summaries, $6M funding    |
| **Mindsera**            | Niche       | $70          | Mental models + bias detection   | 50+ cognitive frameworks, distortion flagging                 |
| **Finch**               | Millions    | $156         | Virtual pet self-care            | Pet grows with journaling, self-compassion-based gamification |
| **Life Note**           | Growing     | $120         | AI mentors (historical figures)  | 1000+ AI personas, $6M funding                                |
| **Stoic**               | Loyal niche | $72          | Philosophy-based prompts         | Simulated mentorship with Marcus Aurelius etc.                |
| **Diarium**             | Loyal       | $10 one-time | Auto-import social + fitness     | Facebook/Instagram/Fitbit data import                         |
| **Five Minute Journal** | Popular     | $48          | Morning+evening structure        | 3 morning + 2 evening prompts, proven format                  |

### ZenFlow's Competitive Position

**What we do BETTER than competition:**

- Visual customization (10 themes × 4 fonts × 6 textures × 14 patterns) — nobody matches this
- BurnThought widget — unique, cinematic, emotionally powerful
- GratitudeBloom — visually delightful positive reinforcement
- Paper-sheet aesthetic — feels like a real journal, not a text editor
- Security (password + biometric + panic lock) — paranoid-level privacy
- Orb integration — emotional wellness companion unique to ZenFlow

**What competition does BETTER than us:**

- Daylio: frictionless entry (2 taps vs our full editor)
- Day One: "On This Day" memories, auto-metadata, map view
- Rosebud/Reflectly: AI conversation mode, weekly AI reports
- Finch: gamification that drives daily return
- Five Minute Journal: structured morning/evening ritual
- All top apps: streak system with freeze/recovery

---

## 3. Gap Analysis: What We're Missing

### TIER 1 — Critical Missing Features (Highest Impact)

#### 1.1 Quick Check-in Mode

**What:** Daylio-style 2-tap entry — pick mood + tap activity icons. No writing required.
**Why critical:** 8M+ Daylio users prove demand. Captures the enormous audience that will NOT write paragraphs. Current diary requires opening full editor — too much friction for daily use.
**User flow:**

```
[Mood emoji row: 😄 🙂 😐 😟 😢]
              ↓ (tap one)
[Activity grid: 🏃 🧘 📚 💼 🎵 🍷 😴 👥 ...]
              ↓ (tap 0-5)
[Optional: one-line note field]
              ↓
[Save ✓] — total time: 10-15 seconds
```

**Where it lives:** New "Quick Check-in" button on diary home + home screen widget
**Data captured:** mood + activities + optional note + auto-timestamp + auto-weather
**Analytics unlock:** "Activities that improve your mood" correlation charts

#### 1.2 "On This Day" Memories

**What:** Daily resurfacing of old entries from the same date in previous years.
**Why critical:** Day One users report this as the #1 reason they keep journaling long-term. Creates emotional connection to past self. Nostalgia is the strongest retention mechanism in journaling apps.
**User flow:**

```
[Diary home screen — top card]
╭─────────────────────────────────╮
│ 📅 On This Day — 1 year ago    │
│                                 │
│ "Today I realized that..."      │
│ 😄 Great · 📷 2 photos          │
│                                 │
│ [View Entry →]  [← →] (swipe)  │
╰─────────────────────────────────╯
```

**Notification:** Push notification at user's preferred journal time: "1 year ago today, you wrote..."
**Multiple years:** If entries exist from 2024, 2025, 2026 — show as swipeable carousel
**Fallback:** If no entries on this date — show "Start today's memory" CTA

#### 1.3 Streak System with Freeze & Recovery

**What:** Visual streak counter with loss aversion psychology + safety nets.
**Why critical:** Duolingo's proven model. Streaks increase daily retention by 2-3x. Loss aversion (not wanting to break streak) is the strongest behavioral driver.
**Mechanics:**

- Current streak counter visible on diary home + profile
- Streak freeze: 1 free freeze per week (can earn more). Skip 1 day without breaking
- Recovery window: 48 hours to "repair" a broken streak (costs 1 freeze)
- Milestone celebrations: animated reward at 7, 14, 30, 60, 100, 365 days
- Visual: flame icon 🔥 that grows with streak length, animated with spring physics
  **Integration:** Streak milestones trigger achievement badges + orb evolution stages

#### 1.4 Weekly AI Emotional Report

**What:** Every Sunday, AI generates a beautiful summary card of the past week.
**Why critical:** Most-requested AI feature across all journal apps. Transforms raw entries into actionable self-knowledge. Makes users feel their journaling effort is "paying off."
**Content:**

```
╭─────────────────────────────────╮
│ 📊 Your Week — Apr 7-13        │
│                                 │
│ Mood: ████████░░ 4.1/5 (+0.3)  │
│ Entries: 5 of 7 days            │
│ Words: 1,247 total              │
│                                 │
│ 🔑 Top emotions: hopeful, tired │
│ 📈 Mood improved after exercise │
│ 💡 Recurring theme: work stress │
│                                 │
│ 🌟 Suggestion: Try a gratitude  │
│    entry on stressful evenings  │
│                                 │
│ [See Full Report →]             │
╰─────────────────────────────────╯
```

**Delivery:** In-app card on diary home + optional push notification

#### 1.5 Structured Morning & Evening Prompts

**What:** Time-of-day-aware guided journal entries (5-Minute Journal format).
**Why critical:** Solves blank page anxiety. Research-backed (Seligman: 25% happiness boost from gratitude practice). Creates ritual habit ("journal as bookend to my day").
**Morning prompts (before 12:00):**

1. I am grateful for... (3 items)
2. What would make today great?
3. Daily affirmation: I am...
   **Evening prompts (after 18:00):**
4. 3 amazing things that happened today
5. How could I have made today better?
6. What did I learn today?
   **Auto-detection:** App detects time of day and suggests appropriate template
   **Customizable:** Users can edit/add/remove prompt questions after first use

#### 1.6 Smart Reminders

**What:** Personalized push notifications timed to user's journaling pattern.
**Why critical:** +180% retention (industry data). Notifications at the RIGHT time (not random) feel helpful, not spammy.
**Logic:**

- Learn user's natural journaling time (e.g., most entries at 21:30)
- Send gentle nudge 15 min before habitual time
- Rotate prompt content: quote, prompt question, streak reminder, "On This Day" preview
- Respect Do Not Disturb + frequency caps (max 1/day)
- Streak-aware: more urgent near streak midnight deadline

#### 1.7 Home Screen Widget (Capacitor)

**What:** Native widget for iOS/Android home screen.
**Why critical:** Ambient presence = constant reminder. Day One, Daylio, Clearful all offer widgets. Widget users have 40% higher retention.
**Widget variants:**

- **Mini (2×1):** Mood picker — 5 emoji faces, tap to quick check-in
- **Small (2×2):** Today's mood + streak count + "Write" button
- **Medium (4×2):** Daily prompt + mood + streak + "Write" button
- **Lock screen:** Rotating prompt of the day (iOS 16+)

---

### TIER 2 — High Impact Features

#### 2.1 Voice-to-Text Enhancement

**Current:** Audio recording exists (3 files, 5 min max).
**Upgrade:** After recording, show AI transcript + extracted mood + key themes. Edit transcript. Option to use as entry text.
**Tech:** Web Speech API / Capacitor speech-to-text plugin + AI post-processing.

#### 2.2 CBT Thought Record (Entry Type)

**What:** Structured 5-column worksheet: Situation → Automatic Thought → Emotion (rate 0-100%) → Evidence For/Against → Balanced Thought → Re-rate Emotion.
**Why:** Research validates 25-50% anxiety reduction in 4 weeks. Clinical tool accessible without therapist.
**UI:** Step-by-step guided flow, not overwhelming form. One column at a time.

#### 2.3 Habit Tracker with Mood Correlation

**What:** Define 5-8 daily habits. Toggle completion in entry. Analytics show which habits correlate with better mood.
**Current state:** `habitSnapshot` field exists but is passive (snapshot only, no active tracking).
**Upgrade:** Active toggle grid in quick check-in + correlation analytics chart.

#### 2.4 Achievement Badges (30-50 badges)

**Categories:**

- **Consistency:** 7-day streak, 30-day, 100-day, 365-day
- **Depth:** 500+ word entry, 1000+ word entry, first photo, first audio
- **Features:** 10 photo entries, first voice entry, first template used, all themes tried
- **Emotional Growth:** Improved mood trend (4 weeks), emotion vocabulary expansion
- **Social:** First shared entry (future)
  **Unlock rewards:** New themes, special stickers, orb evolution stages

#### 2.5 Challenges & Quests

**What:** Time-limited curated journaling programs.
**Examples:**

- "21-Day Gratitude Sprint" — daily gratitude prompt, unique each day
- "Shadow Work Week" — 7 days of deep self-inquiry prompts
- "Dream Diary 7-Day" — track dreams for patterns
- "Mindfulness Month" — daily present-moment prompts
  **Completion:** Exclusive badge + theme unlock. Creates content calendar keeping app fresh.

#### 2.6 Time Capsule Entries

**What:** Write a letter to your future self. Entry locked until specified date.
**UI:** Lock icon, countdown timer visible, notification on unlock day.
**Research:** Dominican University: people who write goals are 42% more likely to achieve them.

#### 2.7 Year in Review / "Journal Wrapped"

**What:** Annual summary in December — Spotify-Wrapped-style swipeable story format.
**Content:** Mood graph, word cloud, entry count, streak stats, top themes, AI-generated summary, shareable image cards.
**Timing:** Available from December 15, sharable on social media.

---

### TIER 3 — Strategic Differentiators

#### 3.1 Conversational AI Journaling (Chat Mode)

Instead of blank page, AI asks a question → user responds → AI asks contextual follow-up → creates formatted entry. Lowest friction entry for new journalers. Rosebud ($6M funding) proves demand.

#### 3.2 AI Mentor Personas

5-10 "Wisdom Guides": Stoic Philosopher, CBT Therapist, Mindfulness Teacher, Gratitude Coach, Creative Muse. AI responds in character to journal entries. Life Note ($6M funding) proves demand.

#### 3.3 Cognitive Bias Detection

Opt-in "Thought Check" after emotional entries. AI identifies: catastrophizing, black-and-white thinking, mind-reading, fortune-telling. Suggests evidence-based reframes.

#### 3.4 Dream Journal Mode

Quick capture from lock screen. Voice recording (eyes-closed-friendly). Pre-set tags: vivid, lucid, nightmare, recurring. Optional sketch pad. AI dream insight connecting themes to waking life entries.

#### 3.5 Shared Journal (Couples/Family)

E2E encrypted shared space. Daily questions + "Challenges" (Waffle model). Invite-only. Separate from private journal.

#### 3.6 Map View

Entries plotted on interactive map with pins. Location-tagged entries (opt-in). Travel timeline visualization.

#### 3.7 "Ask Your Journal" Conversational Q&A

Upgrade AI search to natural language: "Summarize my March", "What patterns do you see in my anxiety?", "How has my mood changed since I started meditating?"

#### 3.8 Therapist Export

Formatted PDF report for therapy sessions: mood trends, key themes, selected entries. Clinical-grade output.

#### 3.9 Entry Sharing as Beautiful Cards

Select text → generate shareable image card with custom backgrounds/fonts matching diary themes. Direct share to Instagram Stories, WhatsApp.

#### 3.10 Emotion Granularity Training

Beyond 5-point mood scale. Guide from broad emotions to specific: "Negative → Sad → Lonely → Isolated vs Abandoned." Research: higher granularity = better emotional regulation.

---

## 4. Telegram-Level Polish Specifications

### Design Philosophy (Telegram Pillars Applied to Journal)

| Telegram Principle     | Journal Application                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------- |
| Speed as identity      | Every action responds <100ms. Optimistic saves. No spinners for local data            |
| Layered animation      | T1 micro-feedback (0-100ms) → T2 component (100-300ms) → T3 celebration (300-800ms)   |
| Progressive complexity | Simple surface, depth when explored. Quick check-in by default, full editor on demand |
| Immediate feedback     | Every tap/swipe/input has instant visual + haptic response                            |
| Liquid Glass           | `backdrop-filter: blur()` with gradient overlays, already partially implemented       |

### Spring Physics Reference

| Feel                 | Stiffness | Damping | Duration | Use Case                                          |
| -------------------- | --------- | ------- | -------- | ------------------------------------------------- |
| Snappy, no bounce    | 500+      | 30-40   | ~150ms   | Button press, toggle, formatting toolbar          |
| Quick with overshoot | 400       | 25-28   | ~200ms   | Dropdown, mood selection popup                    |
| Smooth, confident    | 300-350   | 28-32   | ~300ms   | Modal open, sidebar slide, page transition        |
| Loose, playful       | 150-200   | 15-22   | ~400ms   | Drag-and-drop, pull-to-refresh                    |
| Explosive, bouncy    | 600+      | 10-18   | ~500ms   | Streak milestone, achievement unlock, celebration |

**CSS cubic-bezier equivalents:**

- Responsive enter: `cubic-bezier(0.16, 1, 0.3, 1)`
- Overshoot: `cubic-bezier(0.34, 1.56, 0.64, 1)`
- Aggressive decel: `cubic-bezier(0.19, 1, 0.22, 1)`

### NNGroup Duration Guidelines

| Type                 | Duration  | Easing      | Example                           |
| -------------------- | --------- | ----------- | --------------------------------- |
| Micro-feedback       | 100ms     | ease-out    | Save checkmark, formatting toggle |
| Component transition | 200-300ms | ease-out    | Panel slide, modal open           |
| Layout change        | 300-500ms | ease-in-out | View mode switch, calendar expand |
| Emphasis/celebration | 500-800ms | spring      | Streak increment, badge unlock    |
| Page transition      | 200-350ms | ease-out    | Entry list → entry detail         |

**Critical rule:** ease-out for entering elements (responsive). ease-in for exiting (gets out of the way). Never linear for UI motion.

### Haptic Feedback Map (Capacitor)

| Interaction                     | Haptic Type          | Timing             |
| ------------------------------- | -------------------- | ------------------ |
| Mood emoji selection            | Light impact         | On tap             |
| Formatting toggle (bold/italic) | Light impact         | On tap             |
| Entry save                      | Medium impact        | On success         |
| Streak milestone                | Success notification | After animation    |
| Delete confirmation             | Warning notification | On swipe threshold |
| Date picker scroll              | Selection tick       | Each position      |
| Photo attachment                | Light impact         | On insert          |
| Achievement unlock              | Success notification | After animation    |
| Long press (context menu)       | Medium impact        | At 500ms threshold |
| Pull to refresh                 | Light impact         | At threshold       |

### Micro-Interaction Specifications

#### Save Indicator

```
Trigger: User pauses typing for 1.5s
Animation: Checkmark icon fades in (opacity 0→1, scale 0.8→1, 200ms ease-out)
Position: Top-right of editor, next to title
States: Saving (spinning dot) → Saved (checkmark) → Synced (cloud checkmark)
Duration: Visible for 2s, then fades out
```

#### Mood Selection

```
Trigger: Tap on mood emoji
Animation: Selected emoji scales 1→1.3→1.1 (spring: stiffness 600, damping 15)
           Color radiates outward as ring/glow (300ms)
           Unselected emoji scale to 0.85 opacity 0.5 (200ms)
Haptic: Light impact
Sound: Optional subtle "pop" (100ms)
```

#### Word Count Milestone

```
Trigger: Word count crosses 100, 250, 500, 1000
Animation: Counter pulses (box-shadow glow, 600ms)
           Optional: confetti burst at 1000 words (BurnThought-style particles)
Haptic: Medium impact at 500+, success at 1000
```

#### Streak Increment

```
Trigger: First entry of the day saved
Animation: Number counter rolls up with spring bounce (stiffness 400, damping 20)
           Flame icon grows briefly (scale 1→1.2→1, 300ms)
           If milestone: full-screen celebration (confetti + badge reveal)
Haptic: Success notification
```

#### Entry Card Stagger

```
Trigger: Entry list loads or view changes
Animation: Each card enters with +40ms delay (cap at 5 items)
           Per card: translateY 20px→0, opacity 0→1, 200ms ease-out
           Cards below fold: animate on scroll into view (IntersectionObserver)
```

#### Swipe to Delete

```
Animation: Card follows finger with rubber-band physics
           At 80px threshold: red background revealed, trash icon scales in
           Past threshold: haptic warning
           Release past threshold: card slides out + height collapses (300ms)
           Undo toast appears from bottom (spring: stiffness 500, damping 30)
```

### Context-Aware UI

#### Time-of-Day Awareness

```
Morning (6:00-12:00):
  - Greeting: "Good morning, [name]"
  - Suggested template: Morning Ritual
  - Color accent: warm amber
  - Prompt: energized/calm/grateful themes

Afternoon (12:00-18:00):
  - Greeting: "Good afternoon"
  - Suggested template: Quick Check-in
  - Color accent: natural daylight
  - Prompt: productivity/energy themes

Evening (18:00-22:00):
  - Greeting: "Good evening"
  - Suggested template: Evening Reflection
  - Color accent: golden hour warm
  - Prompt: relaxed/accomplished/grateful themes

Night (22:00-6:00):
  - Greeting: "Quiet night"
  - Suggested template: Free Write / Dream
  - Color accent: deep indigo/blue
  - Prompt: reflective/peaceful/dream themes
```

#### Behavioral Adaptation

```
0-3 entries:  Show guided onboarding prompts, explain features contextually
4-10 entries: Suggest templates, show "Getting Started" progress
11-30 entries: Enable AI search, show first insights, suggest quick check-in
30+ entries:  Full feature access, keyboard shortcuts, markdown mode
100+ entries: Power user features, "Ask Your Journal" Q&A, yearly reports
```

### Empty States

#### First-Time (Zero Entries)

```
Visual: Warm illustration of open journal + pen (theme-aware, animated subtle float)
Text: "Your story starts here"
Subtext: "Every journey begins with a single word"
CTA: ONE primary button → "Write First Entry" (prominent)
     Secondary text link → "Quick mood check-in" (subtle)
Animation: Illustration has gentle breathing animation (scale 1→1.02, 3s loop)
Reduced motion: static illustration
```

#### Empty Search

```
Visual: Magnifying glass illustration with question marks
Text: No results for "[query]"
Actions: [Clear Search] button + "Try different keywords" suggestion
If AI available: "Try AI search for semantic matching" toggle
```

#### Empty Day (Calendar selected, no entry)

```
Visual: Time-of-day gradient background
Text: Based on time — "Start your morning reflection" / "Capture today's moments"
CTA: "Write" button + "Quick check-in" option
Smart: If previous day has entry, show "Continue from yesterday?"
```

### Performance Perception

#### Optimistic Saves

```
1. User taps Save
2. IMMEDIATELY: Update Zustand store + show green checkmark
3. BACKGROUND: Write to IndexedDB → sync to Supabase
4. ON SUCCESS: Checkmark → Cloud checkmark (subtle transition)
5. ON FAILURE: Show orange warning icon + retry button (rare)
Never: Show "Saving..." spinner or block interaction
```

#### Skeleton Loading

```
Entry list skeleton: Matches exact card layout
  - Mood dot placeholder (circle shimmer)
  - Title line (80% width shimmer)
  - Content lines (2 lines, 100% and 60% width)
  - Bottom: date placeholder + tag placeholders
Shimmer: left-to-right gradient, 1.5s cycle
Transition: Skeleton fades to real content (opacity crossfade, 200ms)
```

#### Staggered Content Loading

```
Priority order:
1. Text content + mood (instant from IndexedDB)
2. Tags + metadata (instant)
3. Photo thumbnails (lazy load on scroll)
4. Audio waveforms (lazy load)
5. Stats charts (lazy load, skeleton until ready)
```

---

## 5. Feature Specifications by Priority Tier

### Tier 1 Implementation Details

#### 1.1 Quick Check-in — Full Spec

**Entry point:** Floating "+" button on diary home (bottom-right), OR swipe up from bottom edge, OR home screen widget.

**Screen layout:**

```
╭─────────────────────────────────╮
│         How are you?            │
│                                 │
│   😄    🙂    😐    😟    😢    │
│  Great  Good  Okay  Bad  Awful  │
│                                 │
│  ─────── Activities ──────────  │
│  🏃 🧘 📚 💼 🎵 🍷 😴 👥 🎮 🍽  │
│  Run Yoga Read Work Music...    │
│                                 │
│  ─── Quick note (optional) ──  │
│  ┌─────────────────────────┐   │
│  │ How's your day going?   │   │
│  └─────────────────────────┘   │
│                                 │
│  [Save ✓]    [Expand to full →] │
╰─────────────────────────────────╯
```

**Activities (default set, customizable):**

```
🏃 Exercise    🧘 Meditation   📚 Reading     💼 Work
🎵 Music       🍷 Alcohol      😴 Good sleep  👥 Social
🎮 Gaming      🍽 Healthy food  🚶 Walk       💊 Medicine
📱 Screens     ☕ Coffee       🛒 Shopping    🎨 Creative
```

**Custom activities:** User can add/remove/reorder via settings.

**Data stored:** Creates a JournalEntry with `entryType: 'quick-checkin'`, mood, activities array, optional note. Timestamp auto-captured.

**Transition to full entry:** "Expand" button opens JournalEntryEditor pre-filled with mood + activities as starting content.

#### 1.2 "On This Day" — Full Spec

**Data source:** Query IndexedDB for entries where `date` matches today's month-day in any previous year.

**Home screen card:**

```typescript
// Pseudocode
const onThisDay = entries
  .filter((e) => {
    const entryDate = parseDate(e.date);
    const today = new Date();
    return (
      entryDate.getMonth() === today.getMonth() &&
      entryDate.getDate() === today.getDate() &&
      entryDate.getFullYear() < today.getFullYear()
    );
  })
  .sort((a, b) => b.createdAt - a.createdAt);
```

**UI behavior:**

- If 1 entry: show single card with preview text (140 chars) + mood + photo thumbnail
- If multiple years: swipeable horizontal carousel with year labels
- If 0 entries: don't show the card (no empty "On This Day")
- Card position: top of diary home, above entry list
- Animation: gentle slide-in from right on page load

**Push notification:**

- Trigger: Daily at user's preferred journal time (or 10:00 default)
- Content: "1 year ago: [first 80 chars of entry]..."
- Deep link: opens diary → scrolls to "On This Day" card
- Opt-in via diary settings

#### 1.3 Streak System — Full Spec

**Data model:**

```typescript
interface JournalStreak {
  currentStreak: number;
  longestStreak: number;
  lastEntryDate: string; // YYYY-MM-DD
  freezesAvailable: number; // default 1, max 3
  freezesUsed: number; // resets weekly (Monday)
  milestoneHistory: number[]; // [7, 14, 30, ...]
  streakStartDate: string;
}
```

**Rules:**

- Entry = any JournalEntry (quick check-in counts)
- Day boundary = midnight local time
- Streak increments on first entry of each new day
- Miss 1 day: freeze auto-applied if available, streak preserved
- Miss 2+ days without freeze: streak resets
- Recovery: within 48h of break, spend 1 freeze to "repair"
- Freeze regeneration: 1 free freeze per week, can earn extras via challenges

**Milestones:** 3, 7, 14, 21, 30, 60, 90, 100, 180, 365, 500, 1000

**Visual:**

```
╭──────────────────╮
│ 🔥 14 day streak │
│ ████████████████  │ (progress bar to next milestone: 21)
│ Longest: 42 days │
│ 1 freeze ready ❄ │
╰──────────────────╯
```

**Celebration animation (milestone reached):**

- Full-screen overlay (1.5s)
- Badge reveal with explosive spring (stiffness 600, damping 12)
- Confetti particles (BurnThought-style canvas, 60 particles, gravity + float)
- Haptic: success notification
- Sound: optional ascending 2-note chime (200ms)

---

## 6. Data Model Extensions

### New Fields on JournalEntry

```typescript
interface JournalEntry {
  // ... existing fields ...

  // NEW: Entry type system
  entryType?:
    | "standard"
    | "quick-checkin"
    | "morning-ritual"
    | "evening-reflection"
    | "thought-record"
    | "dream"
    | "time-capsule"
    | "freewrite-sprint"
    | "gratitude";

  // NEW: Quick check-in data
  activities?: string[]; // ['exercise', 'meditation', 'social', ...]

  // NEW: Emotion granularity (beyond 5-point mood)
  emotions?: string[]; // ['hopeful', 'tired', 'grateful', 'anxious']

  // NEW: Auto-captured context
  weatherContext?: {
    condition: string; // 'sunny', 'cloudy', 'rainy', etc.
    temperature: number; // Celsius
    humidity?: number;
  };
  locationContext?: {
    lat: number;
    lng: number;
    name: string; // "Kyiv, Ukraine"
  };

  // NEW: Time capsule
  isTimeCapsule?: boolean;
  unlockDate?: string; // YYYY-MM-DD

  // NEW: CBT thought record (entryType === 'thought-record')
  thoughtRecord?: {
    situation: string;
    automaticThought: string;
    emotion: string;
    emotionIntensityBefore: number; // 0-100
    evidenceFor: string;
    evidenceAgainst: string;
    balancedThought: string;
    emotionIntensityAfter: number; // 0-100
  };

  // NEW: Dream journal (entryType === 'dream')
  dreamTags?: string[]; // 'vivid', 'lucid', 'nightmare', 'recurring'
  sleepQuality?: 1 | 2 | 3 | 4 | 5;

  // NEW: Prompt/template tracking
  promptUsed?: string; // which prompt triggered this entry
  challengeId?: string; // if part of a challenge

  // NEW: Word count (cached for analytics)
  wordCount?: number;
}
```

### New Tables (Dexie)

```typescript
// Streak tracking
interface JournalStreak {
  id: string; // 'primary' (singleton)
  currentStreak: number;
  longestStreak: number;
  lastEntryDate: string;
  freezesAvailable: number;
  freezesUsed: number;
  milestoneHistory: number[];
  streakStartDate: string;
  updatedAt: number;
}

// Achievement badges
interface JournalBadge {
  id: string; // 'streak-7', 'depth-500-words', etc.
  name: string;
  description: string;
  icon: string; // emoji or icon reference
  category: "consistency" | "depth" | "features" | "growth" | "social";
  unlockedAt?: number; // timestamp when earned
  progress?: number; // 0-100 for progressive badges
}

// Challenges
interface JournalChallenge {
  id: string;
  name: string;
  description: string;
  durationDays: number;
  prompts: string[]; // one per day
  startedAt?: number;
  completedAt?: number;
  progress: number; // days completed
  badgeReward: string; // badge ID to unlock on completion
}

// Activity definitions (for quick check-in)
interface JournalActivity {
  id: string;
  icon: string; // emoji
  name: string; // i18n key
  order: number; // display order
  isDefault: boolean;
  isActive: boolean; // user can hide activities
}

// Habit-mood correlation cache
interface HabitMoodCorrelation {
  habitId: string;
  habitName: string;
  avgMoodWith: number; // average mood on days habit completed
  avgMoodWithout: number; // average mood on days habit not completed
  sampleSizeWith: number;
  sampleSizeWithout: number;
  lastCalculated: number;
}

// Weekly AI report cache
interface WeeklyInsight {
  id: string; // 'week-2026-15' (year-weeknumber)
  weekStart: string; // YYYY-MM-DD
  weekEnd: string;
  avgMood: number;
  entryCount: number;
  totalWords: number;
  topEmotions: string[];
  recurringThemes: string[];
  moodTriggers: string[];
  suggestion: string; // AI-generated suggestion
  generatedAt: number;
}
```

### Dexie Schema Migration

```typescript
// New version increment
db.version(N).stores({
  // Existing
  journalEntries: "++id, date, mood, createdAt, updatedAt, entryType",
  journalPhotos: "++id, entryId",
  journalAudio: "++id, entryId",
  // NEW tables
  journalStreak: "id",
  journalBadges: "id, category, unlockedAt",
  journalChallenges: "id, startedAt, completedAt",
  journalActivities: "id, order, isActive",
  habitMoodCorrelations: "habitId, lastCalculated",
  weeklyInsights: "id, weekStart",
});
```

---

## 7. Existing Feature Improvements

### 7.1 Entry Card (JournalEntryCard.tsx) — Polish

**Current:** Good gestures, mood accent bar, photo badge.

**Improvements:**

- Add activity icons row (when quick check-in type): show 3-4 activity emoji inline
- Add streak fire icon if entry contributed to streak
- Staggered animation on list load (+40ms per card, cap at 5)
- Hero image mode: if entry has photo, show as card background with text overlay (like Instagram stories)
- Entry type badge: small pill showing "Quick Check-in" / "Morning Ritual" / "Dream" etc.
- Shared element transition: card expands into full entry view (CSS View Transitions API)

### 7.2 Entry List (JournalEntryList.tsx) — Polish

**Current:** Grouped by date, search + mood/tag filters.

**Improvements:**

- Add "On This Day" card at top (when entries exist)
- Add "Quick Check-in" floating button (bottom-right)
- Skeleton loading for initial load (match card layout)
- Pull-to-refresh with custom animation (not generic spinner)
- Search: add filter by entry type (standard/check-in/dream/etc.)
- Empty day: time-of-day-aware CTA
- Infinite scroll with IntersectionObserver (if not already virtual)

### 7.3 Calendar (JournalCalendar.tsx) — Polish

**Current:** Week strip + month grid with mood dots.

**Improvements:**

- Tap on day → filter entry list to that day (if not already connected)
- Mood intensity coloring (more saturated = stronger mood)
- Entry count indicator: 1 dot = 1 entry, 2 dots = 2+, ring = 3+
- Streak visualization: connected line between consecutive days
- "On This Day" indicator: small star on dates with previous-year entries
- Smooth month transition animation (slide left/right)

### 7.4 Stats (JournalStats.tsx) — Polish

**Current:** Year in Pixels, mood distribution, mood over time, writing frequency, most active day, tag cloud, sticker usage.

**New additions:**

- Streak stats section: current, longest, milestone timeline
- Activity-mood correlation chart (bar chart: activity → avg mood)
- Emotion frequency radar chart (if granular emotions tracked)
- Weekly insight history (scrollable past reports)
- Writing milestones: "10K words = novella!", "50K words = novel!"
- Mood chart: animated path drawing on first reveal (stroke-dasharray technique, 1.2s ease-out)
- Animated counters: numbers count up with cubic ease-out (800ms)

### 7.5 Editor (JournalEntryEditor.tsx) — Polish

**Current:** Rich text, 10 themes, 4 fonts, media insertion.

**Improvements:**

- Auto-save indicator: checkmark appears after 1.5s typing pause
- Word count milestone celebration (100, 250, 500, 1000 words)
- Time-of-day-aware template suggestion (morning/evening)
- "Freewrite Sprint" mode: timer + word goal + optional no-delete
- Entry type selector at top (before starting): Quick / Standard / Morning / Evening / Dream / Thought Record
- Floating formatting toolbar on text selection (Telegram-style, instead of always-visible)
- Link insertion: auto-detect URLs and make clickable
- Markdown shortcuts: typing `**text**` auto-converts to bold (inline preview)

### 7.6 Templates (journalTemplates.ts) — Expansion

**Current 5:** Daily Reflection, Gratitude, Goal Setting, Free Write, Weekly Review.

**Add 10 more:**

```
6.  Morning Ritual — 3 gratitudes + goals + affirmation (5-Minute Journal morning)
7.  Evening Reflection — 3 amazing things + improvement + learning (5-Minute Journal evening)
8.  CBT Thought Record — guided 5-column worksheet
9.  Dream Journal — description + symbols + emotions + interpretation
10. Decision Journal — situation + options + reasoning + expected outcome
11. Habit Check-in — habit grid + mood + energy level
12. Shadow Work — trigger + feeling + childhood connection + reframe
13. Travel — location + experience + highlight + photo prompt
14. Freewrite Sprint — timed stream-of-consciousness (750 words)
15. Letter to Future Self — date-locked capsule template
```

### 7.7 BurnThought & GratitudeBloom — Enhancement

**BurnThought (already exceptional):** Add haptic feedback at each phase transition. Optional subtle sound (crackling fire, 200ms samples).

**GratitudeBloom:** Add more petal variety (5 shapes instead of 1). Color-code petals by gratitude category. Add haptic on bloom completion.

**New Widget Idea — "Calm Rain":** For anxious entries. Animated rain drops on screen, gradually slowing as user writes. Ambient rain sound option. Represents processing and cleansing.

---

## 8. Animation & Interaction Spec

### Global Animation Config

```typescript
// src/config/animations.ts
export const ANIMATION = {
  // Spring presets
  spring: {
    snappy: { stiffness: 500, damping: 35 },
    quick: { stiffness: 400, damping: 28 },
    smooth: { stiffness: 320, damping: 30 },
    playful: { stiffness: 180, damping: 18 },
    explosive: { stiffness: 600, damping: 12 },
  },
  // Duration presets (ms)
  duration: {
    micro: 100, // button press, toggle
    fast: 200, // panel slide, fade
    medium: 300, // modal, page transition
    slow: 500, // layout change
    celebration: 800, // achievement, milestone
  },
  // Easing presets
  easing: {
    enter: "cubic-bezier(0.16, 1, 0.3, 1)",
    exit: "cubic-bezier(0.4, 0, 1, 1)",
    overshoot: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    smooth: "cubic-bezier(0.25, 0.1, 0.25, 1)",
  },
  // Stagger
  stagger: {
    list: 40, // ms between list items
    maxItems: 5, // cap stagger at this many
  },
} as const;
```

### Page Transitions

| From → To              | Animation                           | Duration               |
| ---------------------- | ----------------------------------- | ---------------------- |
| List → Entry Detail    | Shared element expand (card → full) | 300ms smooth spring    |
| List → Editor (new)    | Slide up from bottom                | 300ms enter easing     |
| Detail → Editor        | Crossfade                           | 200ms ease-out         |
| Any → Stats            | Slide from right                    | 300ms enter easing     |
| Any → Calendar Full    | Slide from top                      | 300ms enter easing     |
| Entry → Quick Check-in | Scale up from FAB position          | 250ms overshoot easing |

### Reduced Motion Support

```css
/* Already exists in project — ensure all new animations respect this */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

body.reduce-motion .diary-animated {
  animation: none !important;
}
```

---

## 9. Implementation Roadmap

### Phase 1: Foundation (Highest Impact, Least Risk)

**Goal:** Add the features that drive daily return and reduce friction.

| #   | Feature                  | Effort | Impact   | Files Affected                                                                                     |
| --- | ------------------------ | ------ | -------- | -------------------------------------------------------------------------------------------------- |
| 1   | Quick Check-in Mode      | Medium | Critical | New: QuickCheckinSheet.tsx, journalActivities.ts; Edit: JournalModule.tsx, types.ts, db.ts         |
| 2   | Streak System            | Medium | Critical | New: useJournalStreak.ts, StreakDisplay.tsx, StreakCelebration.tsx; Edit: JournalModule.tsx, db.ts |
| 3   | "On This Day" Card       | Low    | High     | New: OnThisDayCard.tsx; Edit: JournalModule.tsx, journalStorage.ts                                 |
| 4   | Entry Type System        | Low    | High     | Edit: types.ts, JournalEntryCard.tsx, JournalEntryList.tsx                                         |
| 5   | Animation Config         | Low    | Medium   | New: src/config/animations.ts; Edit: multiple components                                           |
| 6   | Staggered List Animation | Low    | Medium   | Edit: JournalEntryList.tsx, JournalEntryCard.tsx                                                   |
| 7   | Save Indicator           | Low    | Medium   | Edit: JournalEntryEditor.tsx                                                                       |

### Phase 2: Engagement (Gamification + Ritual)

**Goal:** Build the habit loop that keeps users returning daily.

| #   | Feature                 | Effort | Impact | Files Affected                                                          |
| --- | ----------------------- | ------ | ------ | ----------------------------------------------------------------------- |
| 8   | Morning/Evening Prompts | Medium | High   | New: TimeAwarePrompts.tsx; Edit: journalTemplates.ts, JournalModule.tsx |
| 9   | Achievement Badges      | Medium | High   | New: JournalBadges.tsx, badgeDefinitions.ts, useBadges.ts; Edit: db.ts  |
| 10  | Smart Reminders         | Medium | High   | New: useJournalReminders.ts; Edit: settings, Capacitor notifications    |
| 11  | 10 New Templates        | Low    | Medium | Edit: journalTemplates.ts                                               |
| 12  | Context-Aware Greetings | Low    | Medium | Edit: JournalModule.tsx                                                 |
| 13  | Empty State Polish      | Low    | Medium | Edit: JournalEntryList.tsx, JournalModule.tsx                           |
| 14  | Haptic Feedback         | Low    | Medium | New: useHaptics.ts; Edit: mood selector, save, delete, streak           |

### Phase 3: AI Intelligence

**Goal:** Transform raw entries into self-knowledge.

| #   | Feature                | Effort | Impact | Files Affected                                                            |
| --- | ---------------------- | ------ | ------ | ------------------------------------------------------------------------- |
| 15  | Weekly AI Report       | High   | High   | New: WeeklyInsight.tsx, generateInsight.ts; Edit: db.ts, JournalStats.tsx |
| 16  | Voice-to-Text          | High   | Medium | Edit: audio recording flow, JournalEntryEditor.tsx                        |
| 17  | CBT Thought Record     | Medium | Medium | New: ThoughtRecordEditor.tsx; Edit: types.ts, journalTemplates.ts         |
| 18  | Habit-Mood Correlation | Medium | Medium | New: HabitCorrelationChart.tsx; Edit: JournalStats.tsx, db.ts             |
| 19  | "Ask Your Journal" Q&A | High   | Medium | Edit: journalAI.ts, search UI                                             |

### Phase 4: Premium & Delight

**Goal:** Differentiating features that justify premium.

| #   | Feature                  | Effort    | Impact | Files Affected                                      |
| --- | ------------------------ | --------- | ------ | --------------------------------------------------- |
| 20  | Challenges & Quests      | Medium    | Medium | New: JournalChallenges.tsx, challengeDefinitions.ts |
| 21  | Time Capsule             | Low       | Medium | Edit: types.ts, JournalEntryEditor.tsx              |
| 22  | Year in Review / Wrapped | High      | High   | New: YearInReview.tsx (story-format component)      |
| 23  | Dream Journal Mode       | Medium    | Low    | New: DreamEntryEditor.tsx; Edit: types.ts           |
| 24  | Sharing as Cards         | Medium    | Low    | New: ShareCardGenerator.tsx                         |
| 25  | Home Screen Widget       | High      | Medium | New: Capacitor plugin, widget layouts               |
| 26  | AI Mentor Personas       | Very High | Medium | New: MentorChat.tsx, mentor definitions             |
| 27  | Shared Journal           | Very High | Medium | New: SharedJournal module, Supabase tables          |
| 28  | Map View                 | High      | Low    | New: JournalMapView.tsx                             |

---

## Summary

### By the Numbers

- **Current:** 27 components, 16.5K LOC, 90% mature, strong visual identity
- **Missing:** 28 features identified across 3 priority tiers
- **Competitive gap:** Quick capture + engagement loops + AI intelligence
- **Polish gap:** Micro-interactions + haptics + context-awareness + animation timing

### Key Insight

ZenFlow's diary is a **beautiful writer's tool** (themes, fonts, textures, BurnThought) but lacks the **behavioral hooks** (streaks, gamification, quick entry) and **AI intelligence** (weekly reports, bias detection, conversational journaling) that top apps use to drive daily return. The visual foundation is exceptional — we need to add the engagement layer on top without sacrificing the aesthetic.

### Zero Regression Guarantee

All improvements are **additive**. No existing component is removed or restructured. New features plug into existing architecture via:

- New entry types extending JournalEntry interface
- New Dexie tables (no schema breaking changes)
- New components rendered conditionally in JournalModule
- Animation config applied via existing framer-motion/CSS infrastructure
- Haptics via new useHaptics hook wrapping Capacitor Haptics API

### Sources (40+)

Day One, Daylio, Reflectly, Rosebud ($6M), Life Note ($6M), Mindsera, Finch, Stoic, Diarium, Five Minute Journal, Grid Diary, Apple Journal, Clarity, Waffle, AudioDiary, Audionotes, DreamLog, TypeSlate, NNGroup (7 articles), Josh Comeau (spring physics, reduced motion), web.dev, CSS-Tricks, MDN, Laws of UX, Telegram Blog, Apple HIG, Yu-kai Chou (gamification), Dominican University (goal writing research), Seligman (gratitude research), industry retention data.
