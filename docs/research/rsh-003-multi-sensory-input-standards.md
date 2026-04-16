# RSH-003: Multi-Sensory Input Standards Research

**Epic:** Epic 9 — Multi-Sensory Input
**Date:** 2026-04-14
**Domain:** Somatic body mapping, emotion-color psychology, gesture/scribble analysis, rhythm perception, voice acoustic analysis

---

## 1. Body Map Touch — Somatic Emotion Mapping

### Research Foundation

| Source | Key Finding |
|--------|-------------|
| Nummenmaa et al., PNAS 2014 | 701 participants colored body silhouettes → statistically separable emotion maps. Culturally universal (West European + East Asian). emBODY tool: two silhouettes, increasing/decreasing activation |
| Body regions → emotions | Head = overthinking, chest = love/anxiety, stomach = nervousness, shoulders = stress, hands = reaching/creating, legs = grounded/restless |

### Technical Standards

- **SVG silhouette**: Gender-neutral, abstract, no detailed features (cultural sensitivity)
- **Canvas 2D overlay**: Gaussian blur heat map, touch response < 16ms (60 FPS)
- **Touch Events API**: `touchstart`/`touchmove` with pressure sensitivity (`touch.force` on supported devices)
- **Fallback**: Tap count/duration for intensity when pressure unavailable
- **Storage**: `{ region: string, intensity: number }[]` — compact, < 2KB per entry

---

## 2. Emotion Palette — Color-Emotion Canvas

### Research Foundation

| Color | Emotion Mapping | Source |
|-------|----------------|--------|
| Red/Orange | Anger, energy, urgency | Kaya & Epps (2004) color-emotion associations |
| Blue/Purple | Sadness, calm, introspection | Cross-cultural color studies |
| Yellow/Green | Joy, growth, optimism | Positive valence colors |

### Technical Standards

- **Canvas 2D**: Full-screen finger-paint, `PointerEvent` for cross-device compatibility
- **Stroke data**: `{ x, y, pressure, velocity, color, timestamp }[]` — compressed
- **Pressure sensitivity**: `pointerEvent.pressure` (0.0-1.0), fallback to 0.5 fixed
- **Canvas size**: Cap at 512x512 to manage memory
- **Replay**: Store strokes, not bitmap — render as animation on view
- **Color histogram**: Count pixels per color bucket → mood score derivation

---

## 3. Scribble Express — Gesture Analysis

### Research Foundation

| Pattern | Emotion Signal | Source |
|---------|---------------|--------|
| Tight loops | Anxiety, rumination | PeerJ 2024, Nature Scientific Reports 2024 |
| Wide curves | Expansiveness, openness | Gesture psychology literature |
| Zigzags | Frustration, agitation | Drawing analysis research |
| Speed variations | Arousal level | Psychomotor studies |

### Technical Standards

- **Single continuous stroke**: `touchstart` → `touchmove` → `touchend` (5-15 seconds)
- **Feature extraction**: Direction changes, loop detection (path self-intersection), velocity, pressure
- **Analysis latency**: < 500ms after drawing end
- **Algorithm**: Geometric analysis — curvature, angular velocity, path length ratio
- **No ML required**: Pattern matching heuristics, transparent and debuggable

---

## 4. Rhythm Tapping — Temporal Pattern Analysis

### Research Foundation

| Tap Pattern | Emotional State | Interpretation |
|-------------|----------------|----------------|
| Fast, frantic | Anxious, agitated | High arousal, negative valence |
| Slow, deliberate | Contemplative, calm | Low arousal, neutral/positive |
| Rhythmic, steady | Grounded, focused | Regulated emotional state |

### Technical Standards

- **Tap capture**: `pointerdown` events, record `{ timestamp, x, y, pressure }[]`
- **Ripple animation**: Canvas 2D, 60 FPS for 30 simultaneous ripples
- **Analysis**: Inter-tap intervals, regularity (coefficient of variation), acceleration
- **Duration**: 10-30 taps (auto-stop or manual)
- **Composite visual**: Overlay all ripple rings → entry artifact

---

## 5. Voice Tone Analysis — Acoustic Feature Extraction

### Research Foundation

| Feature | What It Measures | Extraction Method |
|---------|-----------------|-------------------|
| F0 (Fundamental Frequency) | Pitch — stress, excitement | Autocorrelation / YIN algorithm |
| Spectral Centroid | Brightness — energy level | FFT frequency weighting |
| RMS Energy | Volume — arousal | Root mean square of samples |
| ZCR (Zero Crossing Rate) | Noise/breathiness | Count sign changes in waveform |
| Speech Rate | Pace — anxiety vs calm | Envelope peak detection |
| Pause Frequency | Hesitation — uncertainty | Silence gap detection |

### Technical Standards

- **Web Audio API**: `AudioContext` → `MediaStreamSource` → `AnalyserNode`
- **FFT size**: 2048 (default), sufficient for voice range
- **Privacy**: Zero transcription, zero cloud, audio discardable after analysis
- **Storage**: Feature vector only `{ f0Mean, f0Var, spectralCentroid, rms, zcr, speechRate, pauseFreq }` — < 1KB
- **Duration**: 10-30 seconds recording
- **Meyda.js**: Lightweight audio feature extraction library (optional, or custom implementation)
- **W3C Web Audio API 1.1**: Current specification standard

---

## 6. Progressive Disclosure & Mode Selection

### UX Standards

- **Default mode**: Write (text) — familiar, zero learning curve
- **Unlock threshold**: 5 entries (configurable) — reward engagement
- **6 modes**: `[Write] [Paint] [Body] [Scribble] [Tap] [Voice]`
- **Mode combination**: Any sensory mode attachable to text entries
- **Discoverability**: Subtle animation/badge on unlock, not modal interrupt

---

## 7. Cross-Cutting Standards

| Concern | Standard |
|---------|----------|
| Storage | All modes < 10KB per addon, compressed arrays not bitmaps |
| i18n | 8 languages, mode names + instructions + body region labels |
| Accessibility | ARIA labels, keyboard nav for mode selector, `prefers-reduced-motion` |
| Platform | iOS/Android/Desktop equivalent via Capacitor, touch + mouse support |
| Offline | All analysis on-device, full offline capability |
| Performance | 60 FPS canvas operations, < 16ms touch response |
