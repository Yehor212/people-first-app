# EP4_US003: Emotional Echo Detection

**Epic:** [Epic 4 - AI Intelligence, Insights & Emotional Mirror](../../epic.md)
**Priority:** High
**Status:** Backlog
**Labels:** user-story
**Created:** 2026-04-14

---

## Story

**As a** journaler

**I want** to see when I've felt this way before and how it resolved

**So that** I gain evidence-based hope from my own history

---

## Context

### Current Situation
- Users write about recurring emotional experiences but have no way to see past parallels
- No mechanism to show "you've been here before, and here's how it went"
- Existing journalAI.ts has semantic search but not emotional similarity matching

### Desired Outcome
- On-device TF-IDF compares current entry's topic + sentiment against entry history
- When cosine similarity exceeds threshold, surfaces matching past episode
- Shows 7-day mood trajectory after those past episodes — evidence-based hope
- All processing on-device — no cloud dependency, <500ms latency

---

## Acceptance Criteria

### Main Scenarios

- **Given** a user saves a journal entry with emotional content
  **When** the entry's topic+sentiment vector has cosine similarity > threshold against a past entry
  **Then** a card appears: "This reminds me of something..." showing the matched past entry date and a 7-day mood trajectory after that past episode

- **Given** the echo detection finds a matching past entry
  **When** the mood trajectory after that past episode showed improvement
  **Then** the card highlights the positive outcome: "You've been here before — and within a week, things shifted"

- **Given** the user taps on the echo detection card
  **When** the detail view opens
  **Then** the user sees the full matched past entry text alongside their current entry for comparison

### Edge Cases

- **Given** a user has fewer than 10 journal entries
  **When** the echo detection runs
  **Then** no echo is surfaced (insufficient history for meaningful matching)

### Error Handling

- **Given** the TF-IDF computation encounters corrupted entry data
  **When** vector generation fails for an entry
  **Then** that entry is skipped silently, and echo detection continues with remaining entries

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
| **Tech** | TF-IDF, cosine similarity, Dexie, React |
| **Key Files** | `src/services/emotionalEcho.ts`, `src/components/EchoDetection.tsx` |
| **Approach** | On-device TF-IDF vectors for entries, cosine similarity matching, 7-day mood trajectory after past episodes |
| **Complexity** | High (NLP engine + trajectory visualization) |
<!-- ORCHESTRATOR_BRIEF_END -->

### Architecture Considerations
- Layers affected: Service (new emotionalEcho.ts NLP engine), UI (EchoDetection card + trajectory chart)
- Patterns: On-device NLP, no cloud dependency, lazy TF-IDF index rebuild
- Side-effect boundary: Read-only against journal entries, no mutations
- Orchestration depth: 1 level (entry save → TF-IDF match → render card)
- Constraints: Must complete within 500ms on mid-range mobile devices

### Library Research

**Primary libraries:**
| Library | Version | Purpose | Docs |
|---------|---------|---------|------|
| Custom TF-IDF | N/A | On-device term frequency-inverse document frequency vectorization | Standard NLP algorithm |

**Key APIs:**
- `buildTFIDFVector(entryText)` — generate term frequency vector for an entry
- `cosineSimilarity(vectorA, vectorB)` — compare two TF-IDF vectors (0-1 range)
- `getMoodTrajectory(entryDate, days)` — fetch mood values for N days after a date

**Key constraints:**
- On-device only — no cloud calls, must work offline
- Latency < 500ms including vector comparison against full entry history
- TF-IDF index must be incrementally updateable (not full rebuild on each entry)
- Minimum 10 entries before echo detection activates (statistical significance)

**Standards compliance:**
- Standard NLP: TF-IDF + cosine similarity is well-established for document similarity
- Privacy: all processing local, zero data leaves device

### Integration Points
- **External Systems**: None (fully on-device)
- **Internal Services**: Dexie journal entries (read-only), mood data for trajectory
- **Database**: Existing journal entries + mood records in Dexie

### Performance & Security
- Processing latency < 500ms on mid-range devices
- Incremental TF-IDF index update on each new entry
- No data leaves the device — fully private

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
- None (fully on-device, uses existing Dexie journal data)

### Blocks
- None

---

## Assumptions

| ID | Category | Assumption | Confidence | Validated | Invalidation Impact |
|----|----------|------------|------------|-----------|---------------------|
| A1 | FEASIBILITY | TF-IDF + cosine similarity can run within 500ms on mobile for 1000+ entries | MEDIUM | NO | Need optimized index or Web Worker offloading |
| A2 | DATA | Journal entries contain enough textual content for meaningful TF-IDF matching | HIGH | NO | Need to lower similarity threshold or supplement with mood data |
| A3 | SCOPE | Echo detection is read-only — does not modify any entries or mood data | HIGH | NO | Would need additional storage permissions |
