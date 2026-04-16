# Diary Revolution — Vision Document

**Date:** 2026-04-14
**Research:** 10 parallel agents, 300+ findings, 60+ sources, 35 revolutionary concepts, 27 generative art concepts, 8 paradigm shifts
**Prerequisite:** Read `2026-04-14-diary-deep-redesign.md` for competitive baseline (87 features, NNGroup timing, spring physics)
**Principle:** The diary is not a text editor with mood picker. It is a **living emotional world** where writing is a multi-sensory experience and each entry becomes a unique visual artifact.

---

## The Problem With Every Diary App

Every journal app (Daylio, Day One, Reflectly, Rosebud, Mindsera) follows the same formula:

```
Pick mood (5 emoji faces) → Write text → Save → See list of entries
```

The difference between apps is just the wrapper: Daylio adds activities, Day One adds photos, Reflectly adds AI chat, Mindsera adds mental models. But the EXPERIENCE is identical: **static text storage with a mood label**.

ZenFlow already broke this pattern with BurnThought (cinematic fire that transforms negative thoughts into ash) and ValenceOrb (a living GLSL glass sculpture that morphs shape with emotion). The diary should extend this DNA, not regress to "5 emoji faces."

**The revolution:** Every component of the diary becomes alive, responsive, unique, and therapeutic. Not just what you write — HOW the space responds to you while you write.

---

## 7 Pillars of Revolution

### Pillar 1: ENTRY AS LIVING ARTIFACT

**Current:** Text in a card with mood dot.
**Revolution:** Each entry generates a unique visual entity that lives and breathes.

#### 1A. Emotional Glyph (Entry Soul)

Each saved entry produces a unique crystallized shape by freezing the orb's superformula SDF parameters. The glyph IS the entry's emotional fingerprint — no two entries can produce the same shape.

**How it works:**

```
Entry data → deterministic hash (id + date + valence + content.length)
  → seed offsets superformula params (m, n1, n2, n3)
  → unique Gielis shape frozen from the living orb
  → rendered to offscreen canvas → stored as thumbnail
```

**Technical:** Add one `uniform float uSeed` to `orbShader.frag`. Hash entry metadata into a seed that offsets all noise functions. Same entry always produces same visual, but no two entries look alike. Render 128x128 offscreen, store as base64 in IndexedDB alongside entry.

**UX:** After saving, the orb performs a "crystallization" animation (2s) — breathing slows, shape locks, glow intensifies, then shrinks to a glyph that flies into the entry card. Journal list shows glyphs instead of mood dots. Tap glyph → fullscreen with slow rotation.

**Why revolutionary:** No app generates a unique visual per entry. These become collectible — your journal is a gallery of emotional artifacts, not a list of text.

#### 1B. Entry Aging & Patina

Old entries visually age like physical journals. Recent = crisp. Week-old = slight warmth. Month-old = yellowing + subtle fold marks. Year-old = vintage letter (foxing spots, faded ink, deckled edges).

**Technical:** Pure CSS — zero performance cost:

```css
/* Age = days since entry */
.entry-age-week {
  filter: sepia(0.03);
}
.entry-age-month {
  filter: sepia(0.08) brightness(0.98);
}
.entry-age-quarter {
  filter: sepia(0.15) brightness(0.95);
}
.entry-age-year {
  filter: sepia(0.25) brightness(0.92);
}
/* Plus overlay pseudo-elements: coffee rings, fold lines, foxing */
```

**Why revolutionary:** Every app renders all entries identically. Physical journals age naturally and that aging is part of their emotional value. No digital journal simulates this.

#### 1C. Deterministic Uniqueness

Every visual parameter is derived from entry data via deterministic hash:

```typescript
interface EntryVisualParams {
  seed: number; // hash(id + date)
  valence: number; // -1 to +1
  arousal: number; // 0 to 1 (NEW — see Pillar 7)
  complexity: number; // word count normalized
  dominantEmotion: string;
  timeOfDay: number; // 0-24 hours
  hasPhotos: boolean;
  hasAudio: boolean;
  habitCompletionRate: number;
}
```

Same entry → same visual. Always. But no two entries share visuals. This makes each entry feel like a unique object in the world, not a row in a database.

---

### Pillar 2: THE EMOTIONAL CANVAS

**Current:** Static background pattern (sakura/aurora/stardust/etc.) chosen once.
**Revolution:** The writing space responds to your words and behavior in real time.

#### 2A. Living Ink Diffusion

As you type, each word triggers a tiny ink drop that diffuses outward on the paper in real time. Positive words → warm colors (from the orb's orange/yellow spectrum). Negative words → cool colors (purple/blue spectrum). Drops interact — overlapping diffusions blend. By entry's end, the paper is stained with a unique watercolor imprint of your emotional stream.

**Technical:** Canvas overlay on the paper card. Word-boundary detection (debounced). Pre-built emotional valence lexicon (~1500 words, 2KB). Each word spawns a radial gradient circle with color from valence + diffusion rate from arousal. Composited via `mix-blend-mode: multiply` over existing paper texture. Falls back gracefully to static paper.

**UX:** Toggle in diary settings: "Emotion Ink." The experience is ambient — users notice the paper warming or cooling as they write. When re-reading old entries, the ink pattern is preserved. Optional: animate the ink forming when opening an old entry (1.5s replay).

**Why revolutionary:** No journaling app has text that visually bleeds emotion onto the page. The paper becomes a unique painting by the time you finish writing.

#### 2B. Emotional Weather System

The paper background becomes a living sky that responds to your writing content AND behavior simultaneously.

**Weather states and triggers:**
| Weather | Content Trigger | Behavior Trigger |
|---------|----------------|------------------|
| Sunshine (golden rays from top) | Positive words, gratitude | Steady typing rhythm |
| Gathering clouds | Increasing negativity | — |
| Gentle rain (particles fall) | Sadness, loss words | Long pauses between sentences |
| Storm (distant lightning + flash) | Anger, frustration words | Rapid typing, many backspaces |
| Fog (soft blur overlay) | Confusion, uncertainty | Long pauses mid-sentence |
| Aurora (teal/purple curtains) | Wonder, creativity words | Flow state (sustained speed) |
| Wind (particles accelerate) | Energy, excitement words | Accelerating typing speed |
| Clearing (sun breaks through) | Transition from negative to positive | — |

**Technical:** Extend existing DiaryCanvas particle system. Weather state machine with rolling sentiment average (last 5 words) + typing velocity (keystrokes/sec) + pause duration. Cloud sprites via canvas radial gradients. Rain via particle downward emission. Lightning via brief flash + haptic. All within existing rAF loop.

**After saving:** Entry card shows a "weather report" badge: "Partly cloudy with moments of sunshine."

#### 2C. Breath-Synced Paper

The paper card itself breathes with the orb's 4-phase physiological cycle (inhale → hold → exhale → pause). Barely perceptible scale pulse: `1.0 → 1.005 → 1.0` on a 5-16s cycle (faster when arousal is high, slower when calm).

**Technical:** CSS animation on paper card:

```css
.diary-paper-breathing {
  animation: paper-breathe var(--breath-period) ease-in-out infinite;
}
@keyframes paper-breathe {
  0%,
  100% {
    transform: scale(1);
  }
  25% {
    transform: scale(1.005);
  } /* inhale peak */
  50% {
    transform: scale(1.003);
  } /* hold */
  75% {
    transform: scale(0.998);
  } /* exhale trough */
}
```

**Why therapeutic:** Research shows ambient breathing cues synchronize the viewer's breathing unconsciously. The paper breathes FOR you, encouraging calm without requiring you to stop writing. If typing becomes frantic (detected via keystroke interval), the breathing gradually slows — the paper actively regulates.

#### 2D. Typing Dynamics Mirror

A tiny orb (24px) in the corner of the editor reflects your writing energy in real time. Not a mood you selected — your actual typing behavior analyzed live.

**Signals analyzed:**

- Speed (WPM) → orb brightness
- Rhythm regularity → orb shape smoothness
- Pause frequency → breathing rate
- Backspace rate → shape spikiness (uncertainty)

**Technical:** Keystroke event listener, 30-second rolling window. Map features to mini-orb params. Reuse ValenceOrb component at 24px canvas with simplified shader (no caustics/god rays, just shape + color + breathing).

**After saving:** "Your Writing Energy" card: "You started hesitant and ended confident."

---

### Pillar 3: THE RITUAL ENGINE

**Current:** Tap "new entry" → editor opens → type → save.
**Revolution:** Journaling as a three-act ceremony with designed pauses and sensory transitions.

**Research basis:** Cowry Consulting's Ritual Design Toolkit identifies 4 behavioral patterns: pausing, sensory experience, sequencing, scripting. Japanese concept of Ma — the beauty of what is left unsaid, the power of intentional empty space.

#### The Three Acts

**Act I — Opening (15-30s)**

1. Screen dims subtly, ambient light warmth increases
2. Paper card rises from bottom with gentle spring (stiffness 260, damping 25)
3. Breath sync begins — the paper starts breathing
4. Time-of-day greeting fades in:
   - Morning (6-12): "Good morning. What matters today?" — warm amber accent
   - Afternoon (12-18): "Pause. How is the day unfolding?" — natural light
   - Evening (18-22): "The day is settling. What will you carry forward?" — golden hour
   - Night (22-6): "Quiet night. Let the thoughts come." — deep indigo
5. **Ma moment:** 3-second pause. The screen is almost empty. Just the greeting and the breathing paper. No input fields visible yet. This is intentional emptiness.
6. Tap or wait → writing space gently fades in

**Act II — Writing (user-paced)**

- Living canvas active (ink diffusion + weather + breath sync)
- Typing dynamics mirror in corner
- All existing features available (formatting, photos, audio, stickers, themes)
- No interruptions. No badges. No popups. The writing space is sacred.

**Act III — Closing (10-20s)**

1. Save triggers orb "reading" animation — orb absorbs entry's emotion
2. Glyph crystallizes and flies to journal
3. Based on entry content, ONE of:
   - Positive entry → GratitudeBloom animation (existing)
   - Heavy entry → gentle option: "Would you like to let something go?" → BurnThought (existing)
   - Neutral entry → simple sealing animation (wax seal drops onto paper)
4. Brief reflection card: word count, writing duration, weather report, emotional glyph
5. Paper descends, screen returns to normal

**Customizable:** User can shorten/skip any act. Power users can go straight to editor. The ritual is opt-in but default-on for new users.

#### The Ma Principle (Designed Emptiness)

Specific moments of intentional silence in the UI:

- **Before writing:** 3s empty space after greeting
- **After saving:** 2s pause before any response card
- **Between entries:** When scrolling, gaps between date groups have subtle atmospheric gradient (not white space — emotional breathing room)
- **Monthly review:** The report starts with 5s of your constellation slowly rotating before any text appears

---

### Pillar 4: MULTI-SENSORY INPUT

**Current:** Text + mood picker (5 levels) + photos + audio recording.
**Revolution:** 6 input modes, each capturing different dimensions of emotion.

#### 4A. Body Map Touch (Somatic Input)

Full-body silhouette on screen. Tap where you feel emotion physically. Based on Nummenmaa et al., "Bodily maps of emotions," PNAS 2014 — emotions have consistent physical locations across cultures.

**Body regions:** head (overthinking), throat (unspoken), chest (love/anxiety), stomach (nervousness/gut), shoulders (stress/burden), hands (reaching/creating), legs (grounded/restless)

**Technical:** SVG body outline. Touch events map to regions. Heat map via canvas overlay with Gaussian blur. Store as `{ region: string, intensity: number }[]`. Accumulate over time for "Your Body Over Time" chronic tension view.

**UX:** "Where do you feel it?" mode. Clean silhouette, dark background. Tap to add warmth (blue→yellow→red by intensity). "Done" shows interpretation: "You're carrying a lot in your chest and shoulders today." Monthly overlay shows cumulative somatic patterns.

#### 4B. Emotion Palette (Paint Your Mood)

Finger-paint on canvas with emotion-mapped colors. Red/orange = anger/energy. Blue/purple = sadness/calm. Yellow/green = joy/growth. The painting IS the entry's header art. AI analyzes color distribution + stroke dynamics for mood derivation.

**Technical:** Canvas 2D touch drawing. Stroke data (position, pressure, velocity, color). Stored as compressed stroke array. Replay as animation when viewing. Color histogram → mood score.

**UX:** "Paint your day" — full-screen canvas, 30s-2min session. The painting thumbnails appear in journal list alongside glyphs.

#### 4C. Scribble Express

Single continuous line, abstract drawing. Speed, pressure, direction changes, loops, sharp angles — all analyzed. Tight loops = anxiety. Wide curves = expansiveness. Zigzags = frustration. The scribble IS the entry. 5-15 seconds.

**Research basis:** Emotion detection from handwriting/drawing — Transformer model (PeerJ 2024). Drawing as window to emotion (Nature Scientific Reports 2024).

#### 4D. Rhythm Tapping

Tap the screen to express mood. Each tap = ripple on water. Fast frantic = anxious. Slow deliberate = contemplative. Rhythmic = grounded. The composite ripple pattern becomes the entry's visual signature. 10-30 taps.

#### 4E. Voice Tone (Not Transcription)

Record 10-30 seconds. App analyzes ONLY acoustic properties: pitch, pitch variation, speech rate, pause frequency, energy, breathiness. Ignores words entirely. Privacy-preserving — audio can be discarded after analysis.

**Technical:** Web Audio API AnalyserNode. Extract fundamental frequency, spectral centroid, RMS energy, zero-crossing rate. No cloud, no transcription. Store feature vector only.

#### Input Mode Selection

Not forced. Diary home shows:

```
[Write ✍️]  [Paint 🎨]  [Body 🫂]  [Scribble 〰️]  [Tap 💧]  [Voice 🎤]
```

Default: Write. Others unlock after 5 entries (progressive disclosure). Any mode combinable — write text then add body map or paint overlay.

---

### Pillar 5: THE LIVING TIMELINE

**Current:** Chronological list grouped by date.
**Revolution:** Multiple views revealing different patterns in your emotional history.

#### 5A. Constellation Journal

Each entry = a star. Position: X = valence, Y = arousal. Brightness = word count. Color = dominant emotion (orb's 9-stop spectrum). Over time, entries cluster into constellations. System auto-names clusters by recurring theme.

**Technical:** Extend existing EmotionGalaxy star field. K-means clustering. SVG polylines for constellation connections. Name generation from most frequent nouns in cluster.

**UX:** "My Sky" tab. Parallax field, slow rotation. Tap star = entry preview. New entry = shooting star. Constellation names: "Work Storms," "Weekend Light," "Late Night Reflections."

#### 5B. Emotion Sediment

Each day's entry adds a thin horizontal color band to a growing vertical painting — geological strata of your emotional history. Color = mood. Thickness = word count. Texture = emotional volatility (Perlin noise).

**UX:** "Emotional Core" in stats. Scrollable. Long-press band → date + mood. Export as print-ready PNG. Art you would frame.

#### 5C. Growth Rings (Tree Cross-Section)

Each month = ring. Thickness = entry count. Color = avg mood. Texture = volatility (smooth = consistent, cracked = volatile). Dendrochronology of your emotional year.

#### 5D. Emotional River

Timeline as a flowing river. Width = intensity. Color = mood. Turbulence = volatility. Branches = topic threads. Zoom year → day by pinching.

#### 5E. "On This Day" with Temporal Layers

Old entries show ghost-layers from the same date in other years. Semi-transparent overlapping strata. Like geological time visible through the present. Tap ghost to read that year's entry.

---

### Pillar 6: AI AS EMOTIONAL MIRROR

**Current:** AI search only.
**Revolution:** AI doesn't chat. It mirrors. It reflects what you can't see yourself.

#### 6A. The Compassionate Stranger

Single warm human response after writing — not therapy, not advice, just acknowledgment.

**System prompt:** "You are a kind stranger who overheard this person's thoughts. Respond in 2-3 sentences with genuine warmth. No advice. No therapy. Just human acknowledgment."

**UX:** Handwriting font. Sepia card, slightly rotated. Like finding a note in a returned library book.

#### 6B. Emotional Echo Detection

Detects when you're writing about something you've written about before. Shows what happened AFTER those past episodes. Evidence-based hope.

**Technical:** On-device TF-IDF. Compare topic + sentiment vector against history. If cosine similarity > threshold, surface match with 7-day mood trajectory.

**UX:** "This reminds me of something... You've been here before, and here's how it went."

#### 6C. The Unsaid

After a week of entries, surfaces what's ABSENT. "Your emotional landscape focused on [work, stress]. Sometimes what we don't write about matters too."

#### 6D. Devil's Advocate (Self-Sourced)

Detects cognitive distortions and uses the user's OWN past entries as counter-evidence. No LLM needed — pattern matching + full-text search. "Your own words tell a different story..."

#### 6E. Emotional Pattern Narrator

After 30+ entries: monthly literary narrative, not clinical report. "There was a stretch in early March where every entry carried the weight of change..."

#### 6F. Temporal Perspective Shift

Three perspectives: past-you (amplifies problem), present-you (actual words), future-you (acceptance, growth). Based on MIT "Future You" project.

**UX:** Three cards: yellowed paper (past), current theme (now), luminous clean (future). Swipe between.

---

### Pillar 7: THE AROUSAL AXIS

**Critical discovery:** The orb has only valence. "Anxious" and "sad" are both negative valence but look IDENTICAL. They are completely different states.

**Solution:** Russell's Circumplex Model — two axes:

```
                ACTIVATED (arousal = 1.0)
                       │
    Anxious  ──────────┼────────── Excited
    Angry              │           Elated
                       │
  UNPLEASANT ──────────┼────────── PLEASANT
  (valence = -1)       │           (valence = +1)
                       │
    Depressed          │           Content
    Sad                │           Calm
                       │
              DEACTIVATED (arousal = 0.0)
```

**Arousal from existing emotion tags (sample):**
| Tag | Valence | Arousal |
|-----|---------|---------|
| anxious | -0.7 | 0.8 |
| sad | -0.6 | 0.2 |
| angry | -0.8 | 0.9 |
| depressed | -0.8 | 0.1 |
| excited | +0.7 | 0.9 |
| calm | +0.4 | 0.1 |
| grateful | +0.7 | 0.4 |
| peaceful | +0.6 | 0.1 |

**How arousal changes EVERYTHING:**
| Parameter | Low Arousal (calm) | High Arousal (energized) |
|-----------|-------------------|--------------------------|
| Orb breathing | 16s period | 8s period |
| Orb rotation | 0.015 rad/s | 0.055 rad/s |
| Shape complexity | Smooth, few lobes | Complex, many lobes |
| Particle density | Sparse | Dense |
| Noise amplitude | 0.003 (still) | 0.01 (vibrating) |
| Ink diffusion | Slow, gentle spread | Fast, splattery drops |
| Weather | Fog (neg) / Clear (pos) | Storm (neg) / Aurora (pos) |
| Glyph | Smooth curves | Complex edges |
| Constellation Y-axis | Bottom | Top |
| Sediment texture | Smooth band | Rough/noisy band |
| Breath-sync paper | Slow cycle | Fast cycle |

**Technical:** Add `uniform float uArousal` to shader. Compute from emotion tags via lookup table. **No new UI needed** — existing StateOfMind tag selection already captures this.

---

## The Convergent Experience

**Morning, 7:30 AM. User opens diary.**

1. **Ritual Opening:** Screen warms to amber. Paper rises with spring animation. "Good morning. What matters today?" 3 seconds of Ma — breathing paper, nothing else. Then input modes appear.

2. **Input Choice:** User taps Write (or Paint, Body Map, Scribble, Tap, Voice).

3. **Writing:** Paper breathes at 12s cycle. User types about stressful meeting. Living Ink diffuses cool purple-blue drops. Weather shifts: clouds gather. Mini-orb shows spikiness.

4. User writes about a good conversation. Ink turns warm amber. Clouds clear. Sunshine breaks through.

5. **Saving:** Orb absorbs emotion — morphs to mixed valence, then crystallizes into unique glyph (spiky but warm). Glyph flies to journal.

6. **Reflection:** Weather badge: "Cloudy, clearing by afternoon." Echo: "You wrote about work stress on March 3rd. That week ended with a breakthrough." Writing energy: "Started hesitant, ended confident."

7. **Browsing later:** Cards show unique glyphs. Week-old entries warmly tinted. Month-old yellowed. Constellation view: today's star bright in the "mixed but resolving" quadrant.

8. **Sunday:** Weekly card with sediment growth, mood arc, Pattern Narrator: "April began with tension, but something is shifting..."

---

## Zero Visual Regression

| Existing Component                             | Status                 | Enhancement                                   |
| ---------------------------------------------- | ---------------------- | --------------------------------------------- |
| BurnThought (869 LOC cinematic fire)           | **KEEP — don't touch** | Add haptic at phase transitions               |
| GratitudeBloom (343 LOC particles)             | **KEEP**               | Color petals by glyph palette                 |
| 10 themes (light→cherry, exact hex preserved)  | **KEEP all 10**        | Weather as optional overlay                   |
| 4 fonts (caveat/cormorant/outfit/dancing)      | **KEEP all 4**         | —                                             |
| 6 paper textures (clean→craft)                 | **KEEP all 6**         | Ink diffusion composites ON TOP               |
| 14 bg patterns (sakura→snowfall CSS gradients) | **KEEP all 14**        | Weather as OPTIONAL overlay                   |
| Paper aesthetic (rounded-2xl, backdrop-blur)   | **KEEP**               | Add breathing CSS keyframe                    |
| Security lock (password+biometric+panic)       | **KEEP — don't touch** | —                                             |
| WYSIWYG editor (7 format actions)              | **KEEP all**           | Add canvas overlay layer                      |
| Export (JSON/CSV/PDF/MD)                       | **KEEP all**           | Add art export (glyph/sediment/constellation) |
| Swipe-to-delete + long-press gestures          | **KEEP**               | —                                             |
| AI semantic search                             | **KEEP**               | Upgrade to echo detection                     |
| Year in Pixels                                 | **KEEP**               | Add alongside new views                       |
| Calendar strip + full                          | **KEEP**               | Add weather badges per day                    |

**Rule:** Every new feature is OVERLAY or ADDITION. No existing CSS changed. New canvas layers composite over existing backgrounds.

---

## Competitive Position After Revolution

| Dimension         | Daylio            | Day One       | Reflectly   | Rosebud     | **ZenFlow**                                            |
| ----------------- | ----------------- | ------------- | ----------- | ----------- | ------------------------------------------------------ |
| Mood input        | 5 emoji           | 5 emoji       | AI chat     | AI chat     | **6 modes: write/paint/body/scribble/tap/voice**       |
| Entry visual      | Color dot         | Photo thumb   | Plain text  | Chat bubble | **Unique living glyph per entry**                      |
| Writing space     | None              | Static editor | Chat        | Chat        | **Living canvas: ink + weather + breath sync**         |
| Timeline          | Calendar grid     | Timeline+Map  | List        | List        | **Constellation + Sediment + Rings + River**           |
| AI role           | Stats only        | None          | Guided chat | Chat bot    | **Mirror: stranger, echo, unsaid, narrator, advocate** |
| Emotional model   | 5 discrete levels | 5 discrete    | AI-derived  | AI-derived  | **Continuous valence x arousal (Russell Circumplex)**  |
| Therapeutic tools | None              | None          | CBT prompts | None        | **BurnThought + Bloom + Breathe + BodyMap + Ritual**   |
| Visual identity   | Pixel grid        | Photo grid    | Minimal     | Chat UI     | **GLSL orb + 14 atmospheres + generative art**         |
| Entry uniqueness  | Identical cards   | Identical     | Identical   | Identical   | **Aging patina + deterministic glyph + ink painting**  |

---

## Implementation Phases

### Phase 1: Foundation — "Each entry is alive"

| Item                                  | Effort | Impact   |
| ------------------------------------- | ------ | -------- |
| Arousal computation from emotion tags | Low    | Critical |
| `entryToVisualParams()` pipeline      | Low    | Critical |
| Emotional Glyph (uSeed in shader)     | Medium | Critical |
| Breath-synced paper (CSS keyframe)    | Low    | High     |
| Entry aging / patina (CSS filters)    | Low    | Medium   |

### Phase 2: Canvas — "The space responds to you"

| Item                                | Effort | Impact   |
| ----------------------------------- | ------ | -------- |
| Living Ink Diffusion canvas overlay | High   | Critical |
| Emotional Weather system            | High   | High     |
| Typing Dynamics Mirror (mini-orb)   | Medium | Medium   |
| Weather report badge on card        | Low    | Medium   |

### Phase 3: Input — "Beyond text"

| Item                           | Effort | Impact |
| ------------------------------ | ------ | ------ |
| Body Map Touch (SVG + heatmap) | Medium | High   |
| Emotion Palette (finger paint) | Medium | High   |
| Scribble Express               | Medium | Medium |
| Rhythm Tapping                 | Low    | Medium |
| Voice Tone Analysis            | High   | Medium |

### Phase 4: Timeline — "Your history is alive"

| Item                       | Effort | Impact   |
| -------------------------- | ------ | -------- |
| Constellation Journal view | High   | Critical |
| Emotion Sediment painting  | Medium | High     |
| Growth Rings visualization | Medium | Medium   |

### Phase 5: AI Mirror

| Item                            | Effort | Impact |
| ------------------------------- | ------ | ------ |
| Compassionate Stranger          | Medium | High   |
| Emotional Echo Detection        | High   | High   |
| Devil's Advocate (self-sourced) | Medium | High   |
| Pattern Narrator                | High   | Medium |

### Phase 6: Ritual Engine

| Item                                | Effort | Impact |
| ----------------------------------- | ------ | ------ |
| Three-Act structure + state machine | Medium | High   |
| Time-of-day greetings + Ma pauses   | Low    | Medium |
| Closing ceremony (seal animation)   | Medium | Medium |

### Retention (Competitive Table Stakes, Reimagined)

| Item           | Our Version                                            |
| -------------- | ------------------------------------------------------ |
| Streak         | Fire glyph grows with streak, not just a counter       |
| "On This Day"  | Ghost-layer of old glyph + temporal overlay            |
| Weekly Report  | Sediment band + constellation snapshot, not pie charts |
| Quick check-in | Body Map or Scribble, NOT 5 emoji faces                |

---

## Sources

**Academic:** Nummenmaa et al. "Bodily maps of emotions" PNAS 2014 | Russell's Circumplex Model | MIT "Future You" Project | PeerJ 2024 emotion from handwriting | Nature 2024 drawing as emotion window | arXiv 2025 Kintsugi-Inspired Design | JMIR 2025 Soma Design review

**Design:** NNGroup (microinteractions, animation timing, progressive disclosure) | Cowry Consulting Ritual Design Toolkit | Japanese Ma concept | Debord's Psychogeography

**Technical:** Gielis Superformula SDF | GLSL simplex noise | Tone.js | Web Audio API AnalyserNode | Canvas 2D particles | CSS View Transitions

**Competitive (87 features across 10 apps):** Day One 15M users | Daylio 8M | Reflectly | Rosebud $6M | Life Note $6M | Mindsera | Finch | Stoic | Diarium | Five Minute Journal

**Total:** 10 agents, 300+ findings, 60+ sources
