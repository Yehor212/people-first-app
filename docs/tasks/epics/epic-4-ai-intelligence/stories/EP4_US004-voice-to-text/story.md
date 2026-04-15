# EP4_US004: Voice-to-Text Enhancement

**Epic:** [Epic 4 - AI Intelligence, Insights & Emotional Mirror](../../epic.md)
**Priority:** Medium
**Status:** Backlog
**Labels:** user-story
**Created:** 2026-04-14

---

## Story

**As a** journaler

**I want** to speak my entry and see AI-extracted mood and themes

**So that** journaling is effortless even when I don't feel like typing

---

## Context

### Current Situation
- Users can only create journal entries by typing text
- Audio recording exists but produces no transcript or analysis
- Voice input would lower the barrier for daily journaling

### Desired Outcome
- After audio recording, user sees AI transcript + extracted mood + key themes
- User can edit transcript before using as entry text
- Works cross-platform: Web Speech API on web, Capacitor plugin on native
- Voice transcription accuracy > 90% for English, > 80% for other languages

---

## Acceptance Criteria

### Main Scenarios

- **Given** a user taps the voice input button in the journal editor
  **When** they speak for up to 2 minutes and stop recording
  **Then** a transcript appears with extracted mood indicator and 1-3 key themes highlighted

- **Given** the transcript is displayed after voice recording
  **When** the user edits the transcript text
  **Then** the mood and themes update to reflect the edited content, and the user can tap "Use as Entry" to populate the journal editor

- **Given** the user is on a native mobile device (iOS/Android)
  **When** they use voice input
  **Then** the Capacitor speech-to-text plugin is used, providing equivalent quality to the web implementation

### Edge Cases

- **Given** the user's browser does not support Web Speech API (e.g., Firefox)
  **When** they attempt voice input on web
  **Then** a message explains voice input is available on Chrome/Edge or native app, with a link to download

### Error Handling

- **Given** the user denies microphone permission
  **When** voice input is attempted
  **Then** a clear message explains how to enable microphone access in their browser/device settings

---

## Implementation Tasks

Tasks created via ln-300-task-coordinator after ln-310-multi-agent-validator.

---

## Test Strategy

> [!NOTE]
> This section is intentionally **empty** at Story creation.
> Tests are planned later by **test planner** after manual testing passes (quality gate Pass 1).

*Test planning deferred to execution phase.*

---

## Technical Notes

### Orchestrator Brief
<!-- ORCHESTRATOR_BRIEF_START -->
| Aspect | Value |
|--------|-------|
| **Tech** | Web Speech API, Capacitor Speech Recognition, React |
| **Key Files** | `src/services/transcriptionService.ts`, `src/hooks/useVoiceTranscription.ts`, `src/components/JournalEntryEditor.tsx` |
| **Approach** | Web Speech API on web, Capacitor plugin on native, AI post-processing for mood/themes extraction |
| **Complexity** | Medium (platform branching + AI post-processing) |
<!-- ORCHESTRATOR_BRIEF_END -->

### Architecture Considerations
- Layers affected: Service (transcriptionService.ts), Hook (useVoiceTranscription.ts), UI (editor voice button + transcript view)
- Patterns: Platform branching via `Capacitor.getPlatform()`, adapter pattern for speech APIs
- Side-effect boundary: Microphone access permission, transcript text flows into editor
- Orchestration depth: 2 levels (voice capture → transcription → AI mood/theme extraction)
- Constraints: Web Speech API Chrome/Edge only; Capacitor plugin required for native

### Library Research

**Primary libraries:**
| Library | Version | Purpose | Docs |
|---------|---------|---------|------|
| Web Speech API | Browser-native | Voice-to-text on web (Chrome/Edge) | developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API |
| @capacitor-community/speech-recognition | v6.x | Native speech-to-text on iOS/Android | github.com/capacitor-community/speech-recognition |

**Key APIs:**
- `new SpeechRecognition({ continuous: true, lang, interimResults: true })` — browser voice capture
- `recognition.onresult(event)` — extract transcript from results
- `SpeechRecognition.start()` / `.stop()` — Capacitor plugin equivalents

**Key constraints:**
- Web Speech API: Chrome/Edge only on desktop, requires HTTPS
- Capacitor plugin: requires native permissions (microphone)
- Language support varies by platform — test all 8 supported languages
- Max recording duration: 2 minutes (prevent excessive API calls for mood extraction)

**Standards compliance:**
- WCAG 2.1 AA: Visual recording indicator, transcript is readable, keyboard accessible
- Platform parity (Law 10): Web and native must provide equivalent voice experience

### Integration Points
- **External Systems**: Browser/OS speech recognition engines
- **Internal Services**: `JournalEntryEditor.tsx` (inject transcript), AI mood/theme extraction
- **Database**: None directly (transcript flows through editor → normal entry save)

### Performance & Security
- Transcription latency: real-time (interim results displayed as user speaks)
- Mood/theme extraction: < 2 seconds after recording stops
- Microphone permission: request only when user taps voice button (not on app start)

---

## Definition of Done

### Functionality
- [ ] All acceptance criteria met (main + edge cases + errors)
- [ ] Logging added appropriately

### Testing
- [ ] All implementation tasks completed
- [ ] Test task created and completed (by test planner)
- [ ] All tests passing

### Code Quality
- [ ] Code reviewed and approved
- [ ] Follows project patterns
- [ ] Performance meets requirements
- [ ] Documentation updated
- [ ] All affected existing code refactored
- [ ] All existing tests updated and passing

---

## Dependencies

### Depends On
- None

### Blocks
- None

---

## Assumptions

| ID | Category | Assumption | Confidence | Validated | Invalidation Impact |
|----|----------|------------|------------|-----------|---------------------|
| A1 | FEASIBILITY | Web Speech API provides >90% accuracy for English on Chrome/Edge | HIGH | NO | Need server-side speech-to-text fallback |
| A2 | DEPENDENCY | Capacitor speech-recognition plugin v6.x is compatible with Capacitor 8 | MEDIUM | NO | Need to find alternative plugin or build native bridge |
| A3 | DATA | Users will speak coherent sentences (not just keywords) for mood extraction | MEDIUM | NO | Mood extraction needs to handle fragmented speech |
| A4 | SCOPE | No real-time sentiment analysis during recording — only after completion | HIGH | NO | Would need streaming NLP pipeline |
