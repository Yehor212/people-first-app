# Epic 9: Multi-Sensory Input

**Status:** Backlog
**Created:** 2026-04-14
**Source:** [Diary Revolution Research](../../reference/research/2026-04-14-diary-revolution.md)
**Priority:** Medium

---

## Goal

Expand diary input beyond text with 5 new multi-sensory capture modes that each reveal different dimensions of emotion through body, color, gesture, rhythm, and voice. Each mode creates a unique entry artifact that goes beyond what words can express — your body tension map, your finger-painted mood, your anxiety scribble, your tapping rhythm, your voice energy. No journaling app offers this range of emotional capture.

---

## Scope

### In Scope

- **Body Map Touch** (High): Full-body SVG silhouette. Tap where you feel emotion physically. Heat map via canvas overlay with Gaussian blur. Based on Nummenmaa et al., "Bodily maps of emotions," PNAS 2014. Regions: head (overthinking), throat (unspoken), chest (love/anxiety), stomach (nervousness), shoulders (stress), hands (reaching/creating), legs (grounded/restless). Store as `{ region, intensity }[]`. Cumulative "Your Body Over Time" chronic tension view
- **Emotion Palette** (High): Finger-paint on full-screen canvas. Emotion-mapped colors: red/orange = anger/energy, blue/purple = sadness/calm, yellow/green = joy/growth. Stroke data (position, pressure, velocity, color) stored compressed. Replay as animation when viewing. Color histogram → mood score. Thumbnails in journal list
- **Scribble Express** (Medium): Single continuous line, abstract drawing. Speed, pressure, direction changes, loops, sharp angles analyzed. Tight loops = anxiety, wide curves = expansiveness, zigzags = frustration. 5-15 seconds. Research: PeerJ 2024, Nature Scientific Reports 2024
- **Rhythm Tapping** (Medium): Tap screen → water ripples. Fast frantic = anxious, slow deliberate = contemplative, rhythmic = grounded. Composite ripple pattern becomes entry visual. 10-30 taps
- **Voice Tone Analysis** (Medium): Record 10-30 seconds. Analyze ONLY acoustic properties: pitch, pitch variation, speech rate, pause frequency, energy, breathiness. Ignores words entirely. Privacy-preserving — audio discardable after analysis. Web Audio API AnalyserNode, no cloud, no transcription. Store feature vector only
- **Input Mode Selector**: 6 modes on diary home: `[Write] [Paint] [Body] [Scribble] [Tap] [Voice]`. Default: Write. Others unlock after 5 entries (progressive disclosure)
- **Mode Combination**: Any mode attachable to text entries (write + body map, write + paint overlay)

### Out of Scope

- AI analysis of drawings/scribbles (deferred — future enhancement)
- Voice transcription to text (Epic 4 — Voice-to-Text feature)
- Generative art from scribble data (deferred)
- Social sharing of painted entries (Epic 3 — Share Cards)
- Pressure sensitivity calibration UI (use system defaults)

---

## Success Criteria

- Body Map touch response < 16ms (60 FPS canvas)
- Painting canvas supports pressure sensitivity on supported devices (graceful fallback to tap intensity)
- Scribble analysis completed within 500ms of drawing end
- Voice tone analysis runs fully on-device (zero cloud, zero transcription, zero word storage)
- Rhythm tapping ripple animation at 60 FPS for 30 simultaneous ripples
- All 5 modes store compact data (< 10KB per entry addon)
- Progressive disclosure: modes appear after 5 entries (configurable threshold)
- All 8 languages: mode names, instructions, body region labels translated
- Body Map silhouette is gender-neutral and culturally sensitive
- Each mode usable independently or combined with text entry

---

## Dependencies

### Technical Dependencies

- **Canvas 2D API**: Painting, scribble, body map heat overlay, ripple animation
- **Web Audio API AnalyserNode**: Voice tone feature extraction
- **Touch Events API**: Pressure sensitivity, multi-touch for body map
- **IndexedDB**: Compressed stroke/tap/voice feature data storage
- **SVG**: Body silhouette outline

### Epic Dependencies

- **Blocked by**: Epic 7 (entryToVisualParams integration — input mode data feeds visual params)
- **Blocks**: None

---

## Risks and Mitigations

| Risk                                        | Impact | Probability | Mitigation Strategy                                                                                 |
| ------------------------------------------- | ------ | ----------- | --------------------------------------------------------------------------------------------------- |
| Touch pressure not available on all devices | Medium | High        | Fallback to tap count/duration for intensity estimation                                             |
| Voice analysis privacy concerns             | High   | Medium      | No transcription, no cloud, feature vector only, audio explicitly discardable, clear privacy notice |
| Body map cultural sensitivity               | Medium | Low         | Abstract gender-neutral silhouette, no detailed features, optional skip                             |
| Canvas memory for painting sessions         | Medium | Medium      | Compress stroke data, limit canvas to 512x512, clear on save                                        |
| 6 input modes overwhelm new users           | Medium | Medium      | Progressive disclosure (unlock after 5 entries), Write is default, others optional                  |
| Scribble/rhythm analysis accuracy           | Low    | Medium      | Pattern matching heuristics, not ML — transparent, debuggable                                       |

---

## Metrics

- **Mode Adoption Rate**: Target: 20%+ users try non-text mode within 30 days, Measurement: analytics events
- **Body Map Usage**: Target: 10%+ entries include body data, Measurement: entries with bodyMap field
- **Voice Analysis Latency**: Target: < 1s for 30s recording, Measurement: performance.mark
- **Storage Efficiency**: Target: < 10KB per sensory addon, Measurement: IndexedDB field size audit

---

## Architecture Impact

### New Components

- `src/components/diary/BodyMapTouch.tsx` — SVG silhouette + canvas heat overlay + region mapping
- `src/components/diary/EmotionPalette.tsx` — full-screen finger-paint canvas with emotion colors
- `src/components/diary/ScribbleExpress.tsx` — single-line drawing canvas + feature analysis
- `src/components/diary/RhythmTapping.tsx` — tap → ripple canvas + composite pattern
- `src/components/diary/VoiceToneAnalyzer.tsx` — Web Audio recording + acoustic feature extraction
- `src/components/diary/InputModeSelector.tsx` — 6-mode picker with progressive disclosure

### New Hooks & Utils

- `src/hooks/useBodyMap.ts` — touch region detection, heat accumulation, chronic pattern tracking
- `src/hooks/useEmotionPalette.ts` — stroke capture, pressure handling, color mapping
- `src/hooks/useScribbleAnalysis.ts` — direction changes, loops, speed → emotion features
- `src/hooks/useRhythmTapping.ts` — tap timing, ripple spawning, rhythm analysis
- `src/hooks/useVoiceTone.ts` — Web Audio setup, feature extraction (F0, spectral centroid, RMS, ZCR)
- `src/utils/scribbleFeatureExtraction.ts` — geometric analysis of stroke path
- `src/utils/voiceFeatureExtraction.ts` — acoustic property calculation from AnalyserNode

### Components Modified

- `JournalModule.tsx` — input mode selector placement
- `JournalEntryEditor.tsx` — mode combination (attach sensory data to text entry)
- `JournalEntryCard.tsx` — sensory mode indicator icons
- `types.ts` — multi-sensory data fields on JournalEntry (bodyMap, palette, scribble, rhythm, voiceTone)
- `db.ts` — schema migration for sensory data columns

### Technical Decisions

- On-device only for all modes — no cloud dependencies, full offline support
- Canvas 2D for all visual modes — simpler than WebGL, sufficient for 2D interactions
- Compressed storage — stroke arrays, not full canvas bitmaps
- Progressive disclosure — prevent overwhelm, reward engagement

---

## User Stories

User Stories created separately via story-creator skill.

---

## Phases

1. Input mode selector component (6 modes, progressive disclosure logic)
2. Body Map Touch (SVG silhouette + canvas heat overlay + region mapping)
3. Emotion Palette (finger-paint canvas + emotion colors + stroke storage)
4. Scribble Express (single-line canvas + speed/direction/loop analysis)
5. Rhythm Tapping (ripple canvas + timing analysis + composite pattern)
6. Voice Tone Analyzer (Web Audio setup + acoustic feature extraction)
7. Mode combination (attach sensory data to text entries)
8. Sensory thumbnails in journal list (body map/palette/scribble previews)
9. "Your Body Over Time" cumulative somatic pattern view
10. i18n for mode names, instructions, body region labels (all 8 languages)
