# EP4_US008: Hidden Pattern Intelligence

**Epic:** [Epic 4 - AI Intelligence, Insights & Emotional Mirror](../../epic.md)
**Priority:** Medium
**Status:** Backlog
**Labels:** user-story
**Created:** 2026-04-14

---

## Story

**As a** journaler

**I want** to discover what I've stopped writing about and read a literary narrative of my emotional journey

**So that** I understand my deeper patterns

---

## Context

### Current Situation

- Users write regularly but have no visibility into topics that have disappeared from their writing
- No tool surfaces "what's absent" — only what's present
- No narrative synthesis of emotional journey over time

### Desired Outcome

- The Unsaid: after 7+ consecutive daily entries, surface topics that disappeared from writing
- "Your emotional landscape focused on [work, stress]. Sometimes what we don't write about matters too."
- Pattern Narrator: after 30+ entries, generate a monthly literary narrative — not a clinical report
- "There was a stretch in early March where every entry carried the weight of change..."

---

## Acceptance Criteria

### Main Scenarios

- **Given** a user has written 7+ consecutive daily journal entries
  **When** the topic absence detection runs
  **Then** a card appears highlighting 1-2 topics that were previously frequent but have disappeared from recent writing, with the framing: "Sometimes what we don't write about matters too"

- **Given** a user has written 30+ journal entries over at least 4 weeks
  **When** the monthly narrative generation triggers
  **Then** a literary-style narrative appears describing the user's emotional journey — written in evocative language, not clinical bullet points

- **Given** the user taps on a "topic absent" card
  **When** the detail view opens
  **Then** the user sees when they last wrote about that topic, how frequently it appeared before, and their mood during that period

### Edge Cases

- **Given** a user has written 7+ daily entries but no topics have disappeared
  **When** the topic absence detection runs
  **Then** no card is shown — the feature only activates when a meaningful absence is detected

### Error Handling

- **Given** the LLM API is unreachable for narrative generation
  **When** the Pattern Narrator triggers
  **Then** a simpler locally-generated summary replaces the literary narrative (topic frequencies + mood averages), with a note: "Full narrative available when online"

---

## Implementation Tasks

Tasks created via ln-300-task-coordinator after ln-310-multi-agent-validator.

---

## Test Strategy

> [!NOTE]
> This section is intentionally **empty** at Story creation.
> Tests are planned later by **test planner** after manual testing passes (quality gate Pass 1).

_Test planning deferred to execution phase._

---

## Technical Notes

### Orchestrator Brief

<!-- ORCHESTRATOR_BRIEF_START -->

| Aspect         | Value                                                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Tech**       | React, topic modeling, LLM API, Dexie                                                                                                  |
| **Key Files**  | `src/services/topicAbsenceDetector.ts`, `src/components/TheUnsaid.tsx`, `src/components/PatternNarrator.tsx`                           |
| **Approach**   | The Unsaid: compare 7-day topic vectors to detect absence. Pattern Narrator: LLM generates monthly literary narrative from 30+ entries |
| **Complexity** | High (topic modeling + literary LLM generation)                                                                                        |

<!-- ORCHESTRATOR_BRIEF_END -->

### Architecture Considerations

- Layers affected: Service (topicAbsenceDetector.ts), UI (TheUnsaid card + PatternNarrator view)
- Patterns: Topic frequency tracking over sliding windows, LLM for narrative generation
- Side-effect boundary: Read-only against journal entries; narrative cached in Dexie
- Orchestration depth: 2 levels (entry analysis → topic tracking → absence/narrative detection)
- Constraints: The Unsaid is fully on-device; Pattern Narrator requires LLM API

### Library Research

**Primary libraries:**
| Library | Version | Purpose | Docs |
|---------|---------|---------|------|
| Custom topic detector | N/A | Track topic frequencies across sliding windows | Standard NLP keyword extraction |
| Supabase Edge Functions | Deno runtime | LLM API for narrative generation | supabase.com/docs/guides/functions |

**Key APIs:**

- `topicAbsenceDetector.detectAbsence(recentEntries, historicalEntries)` — compare topic vectors
- LLM prompt: generate literary narrative from entry summaries (30+ entries compressed)

**Key constraints:**

- The Unsaid requires 7+ consecutive daily entries — fewer disables the feature
- Pattern Narrator requires 30+ entries over 4+ weeks minimum
- Literary narrative must be evocative, not clinical — system prompt critical
- PII filtering before sending entry summaries to LLM for narrative generation
- Narrative cached in Dexie to avoid repeated LLM calls for same period

**Standards compliance:**

- OWASP A01:2021: PII filtering before LLM API calls for narrative generation
- Privacy: topic absence detection is fully on-device, no cloud dependency

### Integration Points

- **External Systems**: LLM API for Pattern Narrator (via Edge Function)
- **Internal Services**: Dexie journal entries (read-only), existing topic/keyword extraction
- **Database**: Existing journal entries, new narrative cache in Dexie

### Performance & Security

- Topic absence detection: < 500ms (on-device)
- Narrative generation: < 10 seconds (LLM, background processing)
- Cache narratives in Dexie — regenerate only when new entries added
- PII filtering for narrative generation

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

- **EP4_US001**: Weekly AI Emotional Report (establishes LLM API pattern for narrative generation)

### Blocks

- None

---

## Assumptions

| ID  | Category    | Assumption                                                                         | Confidence | Validated | Invalidation Impact                                  |
| --- | ----------- | ---------------------------------------------------------------------------------- | ---------- | --------- | ---------------------------------------------------- |
| A1  | DATA        | 7 consecutive daily entries contain enough topic diversity for absence detection   | MEDIUM     | NO        | Need to increase minimum or use broader time windows |
| A2  | FEASIBILITY | Simple keyword/topic extraction is sufficient for absence detection (no ML needed) | HIGH       | NO        | Need more sophisticated NLP pipeline                 |
| A3  | DEPENDENCY  | LLM can generate literary-quality narrative from compressed entry summaries        | MEDIUM     | NO        | Need extensive prompt engineering or fine-tuning     |
| A4  | SCOPE       | Narratives are monthly, not weekly — too frequent would feel repetitive            | HIGH       | NO        | Need user-configurable frequency                     |
