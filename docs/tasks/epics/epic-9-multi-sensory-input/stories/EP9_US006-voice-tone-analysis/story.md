# EP9_US006: Voice Tone Analysis

**Epic:** Epic 9 — Multi-Sensory Input
**Priority:** P1 (Medium)
**Complexity:** High
**Status:** Backlog
**Created:** 2026-04-14

---

## User Story

As a journal user, I want to record a short voice clip and see my emotional tone analyzed from acoustic properties alone so that I can understand my emotional state through my voice without any of my words being stored or transcribed.

---

## Acceptance Criteria

1. **Given** I select the Voice mode, **When** I tap record, **Then** I can record 10-30 seconds of my voice with a visual timer and level indicator
2. **Given** I finish recording, **When** analysis completes, **Then** I see an acoustic analysis result showing my vocal tone characteristics (pitch level, energy, pace, breathiness) — without any transcription of my words
3. **Given** analysis is complete, **When** I choose to save, **Then** only the acoustic feature vector is stored with the entry — the audio recording is discarded
4. **Given** I am offline, **When** I record and analyze, **Then** all processing runs fully on-device with zero cloud dependency

---

## Test Strategy

(Planned separately by test planner)

---

## Technical Notes

- Component: `src/components/diary/VoiceToneAnalyzer.tsx`
- Hook: `src/hooks/useVoiceTone.ts` — Web Audio setup, feature extraction
- Util: `src/utils/voiceFeatureExtraction.ts` — acoustic property calculation
- Web Audio API: `AudioContext` → `MediaStreamSource` → `AnalyserNode` (FFT size 2048)
- Feature extraction (all on-device):
  - F0 (fundamental frequency): autocorrelation or YIN algorithm
  - Spectral centroid: FFT frequency weighting for "brightness"
  - RMS energy: root mean square of sample buffer
  - ZCR (zero crossing rate): sign changes for breathiness
  - Speech rate: envelope peak detection
  - Pause frequency: silence gap detection
- W3C Web Audio API 1.1 specification compliance
- Privacy: zero transcription, zero cloud, zero word storage. Audio buffer released after extraction
- Storage: feature vector `{ f0Mean, f0Var, spectralCentroid, rms, zcr, speechRate, pauseFreq }` — < 1KB
- Microphone permission: Capacitor Permissions API, graceful handling of denial
- i18n: feature labels, instructions, permission prompts in all 8 languages
- Standards research: `docs/research/rsh-003-multi-sensory-input-standards.md` §5

---

## Dependencies

- **Blocked by:** EP9_US001 (mode selector must exist)

---

## orchestratorBrief

```
tech: "React 18, TypeScript, Web Audio API, AnalyserNode, Capacitor Permissions"
keyFiles: "src/components/diary/VoiceToneAnalyzer.tsx, src/hooks/useVoiceTone.ts, src/utils/voiceFeatureExtraction.ts"
approach: "MediaStream → AnalyserNode pipeline, real-time FFT feature extraction, discard audio after analysis"
complexity: "High (Web Audio pipeline + multiple feature algorithms + permission handling + privacy guarantees)"
```
