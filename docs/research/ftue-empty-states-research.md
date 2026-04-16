# FTUE, Empty States & Onboarding Research — Premium Journal/Writing Apps

> Research date: 2026-04-15
> Sources: NN/g, Appcues (26 examples), Laws of UX, Day One, Bear, Daylio, Reflectly, Stoic, W3C WAI, A11Y Project, Josh Comeau, Apple HIG

---

## 1. Empty State Design Patterns

### Core Guidelines (NN/g — Kate Kaplan)

Three guidelines for empty states in complex applications:

1. **Communicate system status** — Tell users WHY the container is empty and WHAT will appear here once populated. Users should never wonder "is this broken?"
2. **Increase learnability** — Use the empty state to teach: show what this feature does, what data will look like, and how to get started
3. **Deliver direct pathways** — Always provide a clear CTA that takes the user to the next logical step

### Anatomy of a Premium Empty State

| Element | Purpose | Best Practice |
|---------|---------|---------------|
| **Illustration/Icon** | Emotional warmth, fill dead space | Soft, on-brand illustration (not generic stock). Animated = premium feel |
| **Headline** | Explain the state | 5-10 words. Warm, not clinical ("Your journal awaits" not "No entries found") |
| **Body text** | Guide next step | 1-2 sentences max. Explain what will appear here |
| **Primary CTA** | Drive action | Single, prominent button ("Write your first entry", "Start journaling") |
| **Secondary hint** | Reduce anxiety | Optional: "It only takes a minute" or "Your entries are private" |

### Best-in-Class Examples

**Day One** (journal):
- Empty journal shows a warm illustration of an open book with pen
- "Start capturing your life" headline
- Single "+" button prominently placed
- Metadata auto-populated (location, weather, date) to make first entry feel rich immediately

**Bear** (notes):
- Clean, minimal empty state matching their polished aesthetic
- Welcome note pre-loaded on first launch (not truly empty — smart!)
- Tags sidebar shows "#welcome" to demonstrate organization
- Apple Design Award winner — "polished, minimal interface stays out of your way"

**Notion**:
- Template gallery as empty state — turns emptiness into opportunity
- "Start with a template" vs "Start from scratch" — respects both exploration and creation
- Inline hints appear contextually, not all at once

**Apple Notes**:
- Ultra-minimal: just the "New Note" button
- Empty list shows subtle illustration
- Zero friction — one tap to start writing

**LinkedIn** (inbox empty state — exemplary pattern):
- 10-word explanation of why messaging matters
- Single CTA button
- On-brand illustration filling dead space
- Gets to the point without being preachy

**Gmail** (empty inbox):
- Celebratory: "You're all caught up!" (positive framing)
- Compose button as logical next step
- Turns empty = good (inverts the anxiety)

### Animated vs. Static Empty States

| Approach | When to Use | Examples |
|----------|-------------|---------|
| **Static illustration** | Default. Lower battery/CPU. Works with reduced-motion | Most journal apps |
| **Subtle animation** | Premium feel. Breathing/floating illustration | Reflectly, Headspace |
| **Lottie/micro-animation** | First-time only, then static | Celebration after first entry |
| **Interactive** | Gamified onboarding | Tap-to-reveal elements |

**Rule**: Always provide `prefers-reduced-motion` fallback. Start without animation, enable via `no-preference` media query (Josh Comeau pattern).

### Emotional Design in Empty States

- **Make user feel welcome, not lost** — warm copy, first person ("Your story starts here")
- **Reduce anxiety** — mention privacy, encryption, "just for you"
- **Show brand personality** — quirky copy is OK if brand supports it, but not after errors
- **Never blame the user** — "No results found" vs "We couldn't find anything matching that"
- **Celebrate emptiness when appropriate** — "No notifications" can mean "all caught up!"

### CTA Wording for Journal Empty States

| Context | CTA Text | Why It Works |
|---------|----------|--------------|
| First open | "Write your first entry" | Specific, achievable, personal |
| Empty day | "How was your day?" | Conversational, low pressure |
| Empty search | "Try different keywords" | Helpful, not blaming |
| Empty mood log | "Check in with yourself" | Warm, self-care framing |
| After clearing | "Start fresh" | Positive reframe |

---

## 2. Journal Onboarding Flows

### Key Principles (NN/g + Appcues Synthesis)

1. **Skip onboarding when possible** — "For most mobile apps, users should be able to learn the interface by using it" (NN/g). Journal apps are simple enough that heavy onboarding hurts more than helps
2. **Optimize for Time to Value** — Get users writing within 60 seconds of first open. Signals does onboarding in under 60 seconds. Trello does it in one second
3. **Learn-by-doing > passive tours** — Freshdesk, Grammarly, Slack all teach by doing. Interactive walkthroughs outperform video/carousel
4. **Progressive disclosure** — Show essentials first, reveal advanced features (tags, templates, mood tracking) as user explores

### Onboarding Component Types (NN/g Classification)

| Component | Description | Use in Journal App |
|-----------|-------------|-------------------|
| **Feature Promotion** | Carousel/slides showing value props | Minimal — 2-3 slides max. Show writing, mood, privacy |
| **Customization** | Questions that personalize experience | "What brings you here?" (stress relief / gratitude / memory / therapy) |
| **Instructions** | How-to tutorials | Avoid unless non-standard UI. Contextual tips > upfront tutorial |

### The "First Entry" Experience — Critical Moment

Best practices from premium apps:

1. **Pre-fill metadata**: Date, time, weather, location auto-populated (Day One pattern)
2. **Offer a prompt**: "What are you grateful for today?" reduces blank-page anxiety
3. **Show formatting later**: Don't present rich text toolbar on first entry — just a clean text field
4. **Celebrate completion**: Subtle animation, encouraging message after saving first entry
5. **Immediate feedback**: Show the entry in the journal list immediately — "look, you started!"

### Onboarding Best Practices Checklist (Appcues — 26 examples synthesis)

1. Start with a welcome screen and personalization survey
2. Segment users by persona, role, or goal
3. Use interactive walkthroughs over passive product tours
4. Keep checklists to 3-5 items
5. Celebrate user milestones with positive reinforcement (confetti, streaks, emoji)
6. Use progressive disclosure — don't front-load every feature
7. Optimize for time to value above all else
8. Provide a safe space to practice
9. Build trust when asking for sensitive information
10. Design for ongoing engagement, not just first-run
11. Make onboarding re-accessible (always available setup guide)

### Tooltip Tours vs Coach Marks vs Inline Hints

| Method | Pros | Cons | Best For |
|--------|------|------|----------|
| **Tooltip tour** | Sequential, guided | Blocks interaction, annoying if long | Complex apps with 5+ features |
| **Coach marks** | Non-blocking, contextual | Easy to dismiss/miss | Highlighting 1-2 key actions |
| **Inline hints** | Natural, non-intrusive | Can clutter UI | Journal: best approach — hint text in empty editor |
| **Pulsing dots** | Eye-catching | Can be distracting | New feature discovery |

**Recommendation for ZenFlow**: Inline hints + contextual coach marks. No tooltip tours. The app should feel intuitive, not instructional.

---

## 3. Mood Tracking UX

### App Comparison

**Daylio** (20M+ users — market leader):
- Two-tap logging: pick mood → select activities → done in <10 seconds
- 5 mood levels with customizable emoji faces
- "Year in Pixels" — entire year as color-coded grid (most copied visualization)
- Mood correlation stats: which activities improve/worsen mood
- Goals, achievements, streaks for gamification
- Zero writing required — revolutionary simplification

**Reflectly** (80K+ reviews):
- AI-guided prompts that adapt based on responses
- Emoji-based mood tracking — quick and intuitive
- Visual mood graphs: trends over days, weeks, months
- Daily challenges encourage consistency
- Colorful, modern interface — journaling as daily ritual

**Stoic** (Apple Editors' Choice):
- Sleep quality rating with real-time slider feedback
- Morning intentions + evening reflections framework
- Voice journaling when you don't feel like typing
- Guided exercises from Stoic philosophy + CBT + positive psychology
- Therapist export feature
- Trends tab: visual mood patterns, top activities, emotions

### Mood-Color Mapping Best Practices

ZenFlow's current implementation (from CSS tokens):

| Mood | HSL | Visual | Psychology |
|------|-----|--------|------------|
| Great | 158 60% 50% (teal-green) | Fresh, vibrant | Growth, vitality, harmony |
| Good | 142 50% 55% (green) | Calm, positive | Balance, health, nature |
| Okay | 45 75% 60% (warm yellow) | Neutral, warm | Caution, awareness, stability |
| Bad | 25 70% 58% (orange-amber) | Warning, restless | Tension, discomfort |
| Terrible | 0 60% 58% (soft red) | Distress | Pain, urgency, alarm |

**Best practices**:
- Use gradient transitions between adjacent moods (ZenFlow already has `--gradient-mood-*`)
- Avoid pure red (#FF0000) for negative — use softer warm tones
- Consider cultural differences: red = good luck in some cultures
- Ensure sufficient contrast for colorblind users (don't rely on color alone — pair with icons/text)
- Dark mode: same hues, adjusted lightness for OLED readability

### Mood History Visualization Patterns

| Pattern | Description | Best For |
|---------|-------------|----------|
| **Year in Pixels** (Daylio) | 365-cell grid, each cell = mood color | Annual overview, pattern spotting |
| **Weekly bar chart** | 7 bars showing mood average per day | Short-term trend analysis |
| **Mood calendar** | Calendar with mood-colored dots per day | Monthly view, habit tracking |
| **Line graph** | Continuous mood trend line | Trend direction over time |
| **Streak counter** | Consecutive days of logging | Motivation, habit formation |
| **Correlation insights** | "You feel better on days you exercise" | AI-powered self-awareness |

### Combining Mood with Journal Entries

- **Mood-first flow** (Daylio model): Pick mood → optionally add text. Low friction.
- **Writing-first flow** (Day One model): Write entry → optionally tag mood. Better for writers.
- **Unified flow** (Reflectly model): AI asks "How are you feeling?" → mood → guided prompts → free write

**Recommendation for ZenFlow**: Offer both paths. Mood dot in sidebar as quick entry point. Full editor as primary path. Never force mood selection before writing.

---

## 4. Accessibility in Writing Apps

### Key Requirements

**Touch Targets (WCAG 2.5.8)**:
- Minimum 44x44px for all interactive elements (Apple HIG + WCAG AA)
- Editing toolbar buttons especially — cramped toolbars are common a11y failure
- ZenFlow already enforces this (from CLAUDE.md: "Touch targets >= 44px")

**Font Size / Dynamic Type**:
- Support system font size preferences
- ZenFlow has 3 sizes (15px, 18px, 22px) — consider adding "system default" option
- Line height should scale proportionally (1.5-1.7x font size)
- Maximum line width: 65 characters / ~520-560px (Bringhurst typography standard)

**Reduced Motion** (Josh Comeau pattern):
```css
/* Start WITHOUT animations, enable for those who want them */
@media (prefers-reduced-motion: no-preference) {
  .animated-element {
    transition: transform 300ms;
  }
}
```
- React hook: `usePrefersReducedMotion()` — returns boolean
- Apply to: page transitions, mood orb animations, celebration effects, empty state animations
- Fallback: instant state changes, no parallax, reduced particle count

**VoiceOver/TalkBack for Rich Text**:
- `contentEditable` divs need explicit ARIA roles (`role="textbox"`, `aria-multiline="true"`)
- Announce formatting changes: "Bold on", "Bold off"
- Toolbar buttons need `aria-pressed` state for toggle buttons
- Reading order must match visual order

**High Contrast Mode**:
- All mood colors must pass WCAG AA contrast ratio (4.5:1 for text, 3:1 for UI)
- Forced colors media query: `@media (forced-colors: active)`
- Never convey meaning through color alone — pair with icons, patterns, or text

**Screen Reader for Mood Tracking**:
- Star ratings: use radio button group with hidden labels ("1 Star", "2 Stars"...) — W3C pattern
- Mood selector: each mood level needs text label, not just color/emoji
- Mood history charts: provide text summary alternative

### A11Y Project Checklist — Key Items for Journal Apps

- Use plain language, avoid idioms (8th grade reading level)
- Every image needs alt text (mood illustrations, empty state graphics)
- Content must be resizable to 200% without loss
- Focus visible on all interactive elements
- ARIA labels on all buttons, inputs
- Keyboard navigation for all features
- Color is not the only means of conveying information

---

## 5. Gamification & Engagement Patterns

### Writing Streaks — Motivate Without Pressuring

**Daylio** approach (20M users — proven):
- Streak counter on home screen
- "Current streak" + "Longest streak" — competitive with yourself
- Streak freeze: miss a day without losing streak (reduces anxiety)
- Achievements tied to streak milestones (7 days, 30 days, 100 days, 365 days)

**Stoic** approach (Apple Editors' Choice):
- Introduces streaks after FIRST completed task (instant gratification)
- Badges appear immediately — "First Step" badge after day 1
- Morning + evening structure creates 2 touchpoints per day

**Anti-patterns to avoid**:
- Never shame for breaking streaks ("You lost your 47-day streak!" = bad)
- Don't make streaks the primary metric — focus on insights and growth
- Allow retrospective entries to maintain streaks (forgot to log? add it later)
- Streak notifications should be encouraging, not guilt-inducing

### Achievement Badges for Journaling

| Badge | Trigger | Rarity |
|-------|---------|--------|
| First Entry | Write first journal entry | Common |
| Week Warrior | 7-day streak | Common |
| Month Master | 30-day streak | Rare |
| Year of Reflection | 365 entries total | Epic |
| Photo Memory | First photo in entry | Common |
| Voice Note | First audio recording | Common |
| Deep Dive | Entry over 500 words | Uncommon |
| Mood Tracker | 7 days of mood logging | Common |
| Night Owl | Entry after midnight | Uncommon |
| Early Bird | Entry before 7am | Uncommon |
| Gratitude Guru | 30 gratitude entries | Rare |

### "Year in Review" / "Memories" Features

- **Day One "On This Day"**: Surface entries from 1, 2, 5 years ago — powerful emotional hook
- **Apple Journal**: On-device ML suggests moments from photos, workouts, music
- **Daylio "Year in Pixels"**: Color-coded grid showing entire year of moods
- **Annual Summary**: Word count, entry count, most common mood, top tags, longest streak

### Gentle Reminder Notifications

- **Timing**: Evening (7-9 PM) works best for reflection journals
- **Tone**: "How was your day?" > "You haven't journaled today!"
- **Frequency**: Daily max, with option for 2-3x/week
- **Smart**: Skip if user already wrote today
- **Customizable**: Let users pick their reminder time
- **Respectful**: Easy to disable, never passive-aggressive

---

## 6. Media in Journals

### Photo Integration (Day One — Gold Standard)

- Unlimited photos and videos per entry
- Photos auto-organized by date/location
- Grid layout in entry view (1-3 columns depending on count)
- Full-screen lightbox with swipe navigation
- Photo import from camera roll with date matching
- EXIF metadata (location, date) used to auto-populate entry metadata

### Voice Memo Integration

- **Day One**: Voice transcription + raw audio storage
- **Stoic**: Voice journaling as primary input mode ("speak when you don't feel like typing")
- **ZenFlow** (current): Audio recording with `handleStartRecording`, `MAX_AUDIO_PER_ENTRY` limit
- **Best practice**: Show waveform visualization during playback, transcription as searchable text

### Drawing/Sketch Support

- **Day One**: Apple Pencil / finger drawing, stored as image layer
- **Bear**: Inline sketches anywhere in note
- **Stoic**: Drawing tool integrated with journal entries
- **Best practice**: Dedicated drawing canvas, save as inline image, preserve layer data for editing

### Location Tagging UX

- **Auto-capture**: GPS on entry creation (with permission)
- **Map view**: Show entries plotted on map (Day One's map view is iconic)
- **Privacy**: Clear opt-in/opt-out, option to strip location from exports
- **Display**: City + neighborhood level (not exact coordinates) in entry metadata

### Photo Grid Layout Patterns

| Photo Count | Layout | Description |
|-------------|--------|-------------|
| 1 | Full width | Single hero image, 16:9 or 4:3 ratio |
| 2 | Side by side | Two equal columns |
| 3 | 1 large + 2 small | Hero left, two stacked right |
| 4 | 2x2 grid | Equal quadrants |
| 5+ | 2-column masonry | Pinterest-style with "+N more" overlay |

---

## Implementation Recommendations for ZenFlow

### Priority 1 — Empty State (Diary Tab)
- Warm illustration matching theme (day/night variants)
- "Your journal awaits" headline with theme-aware colors
- "Write your first entry" primary CTA button
- "Your entries are private and encrypted" trust signal
- Subtle breathing animation (respects `prefers-reduced-motion`)

### Priority 2 — First Entry Experience
- Pre-fill: date, time of day, weather icon
- Optional prompt: "What's on your mind?" (not forced)
- Hide formatting toolbar on first entry (progressive disclosure)
- Celebrate after save: confetti/orb pulse + "First entry!" badge
- Immediately show entry in sidebar/list

### Priority 3 — Mood Integration
- Mood selector as optional step (never blocking)
- 5-level scale with both color and icon
- Mood dot visible in entry list for quick visual scanning
- Weekly mood trend in sidebar or dashboard
- Accessible: radio button pattern with text labels

### Priority 4 — Gentle Engagement
- Streak counter (with freeze option)
- "On This Day" memories after 30+ entries
- Achievement badges (already implemented in AchievementsPanel.tsx)
- Evening notification: "How was your day?" (customizable time)

### Priority 5 — Accessibility Hardening
- `prefers-reduced-motion` hook for all animations
- Dynamic Type / system font size support
- ARIA labels on mood selector, formatting toolbar
- High contrast mode testing
- VoiceOver audit of contentEditable editor

---

## Source URLs

1. https://www.nngroup.com/articles/empty-state-interface-design/ — Empty States 3 Guidelines
2. https://www.nngroup.com/articles/mobile-app-onboarding/ — Mobile App Onboarding Analysis
3. https://www.nngroup.com/articles/progressive-disclosure/ — Progressive Disclosure
4. https://www.appcues.com/blog/the-5-best-user-onboarding-experiences — 26 Onboarding Examples
5. https://www.appcues.com/blog/empty-states — Empty States Guide
6. https://dayoneapp.com/features/ — Day One Features
7. https://dayoneapp.com/blog/journaling-benefits/ — Journaling Benefits
8. https://bear.app/ — Bear App
9. https://lawsofux.com/ — Laws of UX (Aesthetic-Usability, Hick's Law, Goal-Gradient Effect)
10. https://www.joshwcomeau.com/react/prefers-reduced-motion/ — Accessible Animations in React
11. https://www.a11yproject.com/checklist/ — A11Y Project Checklist
12. https://www.w3.org/WAI/tutorials/forms/custom-controls/ — W3C Custom Controls Accessibility
