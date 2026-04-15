# EP4_US002: Compassionate Stranger

**Epic:** [Epic 4 - AI Intelligence, Insights & Emotional Mirror](../../epic.md)
**Priority:** High
**Status:** Backlog
**Labels:** user-story
**Created:** 2026-04-14

---

## Story

**As a** journaler

**I want** a warm acknowledgment after writing

**So that** I feel heard without judgment

---

## Context

### Current Situation
- After saving a journal entry, the app gives no emotional feedback — just a save confirmation
- Journaling about difficult emotions can feel isolating without any response
- Revolution research: "not therapy, not advice, just acknowledgment"

### Desired Outcome
- After saving an entry, a sepia-toned card appears with a warm 2-3 sentence response
- Response is from a "kind stranger who overheard your thoughts" — no advice, no therapy
- Handwriting font, card slightly rotated — like finding a note in a returned library book
- Response appears within 3 seconds of entry save

---

## Acceptance Criteria

### Main Scenarios

- **Given** a user saves a journal entry
  **When** the entry is saved successfully
  **Then** within 3 seconds, a sepia-toned card appears with a warm 2-3 sentence AI-generated acknowledgment in handwriting font, slightly rotated

- **Given** the compassionate stranger card is displayed
  **When** the user reads it
  **Then** the response contains only warmth and acknowledgment — no advice, no therapeutic language, no suggestions for action

- **Given** the user has the feature enabled in settings
  **When** they save an entry with strong emotional content
  **Then** the response acknowledges the specific emotion without minimizing or amplifying it

### Edge Cases

- **Given** the user is offline when saving an entry
  **When** the compassionate stranger feature triggers
  **Then** no card is shown (feature requires LLM API), and the entry saves normally without error

### Error Handling

- **Given** the LLM API returns an error or times out (>5 seconds)
  **When** the compassionate stranger response fails
  **Then** no card is shown, no error is displayed to the user, and the failure is logged silently

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
| **Tech** | React, LLM API, CSS (sepia card, handwriting font) |
| **Key Files** | `src/components/CompassionateStranger.tsx`, `src/services/journalAI.ts` |
| **Approach** | After entry save, call LLM with compassionate-stranger system prompt, render sepia card with handwriting font |
| **Complexity** | Medium (LLM call + styled card) |
<!-- ORCHESTRATOR_BRIEF_END -->

### Architecture Considerations
- Layers affected: Service (journalAI.ts extension), UI (new CompassionateStranger component)
- Patterns: Post-save hook, fire-and-forget LLM call with timeout
- Side-effect boundary: No persistent storage — response is ephemeral (shown once after save)
- Orchestration depth: 1 level (save → LLM call → render card)
- Constraints: System prompt must enforce "no advice, no therapy" boundary

### Library Research

**Primary libraries:**
| Library | Version | Purpose | Docs |
|---------|---------|---------|------|
| Supabase Edge Functions | Deno runtime | Proxy LLM API call with PII filtering | supabase.com/docs/guides/functions |

**Key APIs:**
- LLM chat completion with system prompt enforcing 2-3 sentence warmth, no advice
- Streaming response for <3 second perceived latency

**Key constraints:**
- Response must be 2-3 sentences maximum — system prompt enforces brevity
- PII filtering required before LLM API calls (OWASP A01:2021)
- Feature must be toggle-able in settings (opt-in/opt-out)
- Offline: feature silently disabled, no error shown

**Standards compliance:**
- OWASP A01:2021: PII filtering before LLM API calls
- APA ethical guidelines: clear non-therapeutic framing

### Integration Points
- **External Systems**: LLM API via Edge Function (reuse pattern from US001)
- **Internal Services**: `journalAI.ts` (extend with compassionate-stranger prompt)
- **Database**: None (ephemeral response)

### Performance & Security
- Response latency < 3 seconds (use streaming if needed)
- PII filtering mandatory before LLM call
- System prompt injection prevention: sanitize entry text

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
- **EP4_US001**: Weekly AI Emotional Report (establishes LLM API integration pattern)

### Blocks
- None

---

## Assumptions

| ID | Category | Assumption | Confidence | Validated | Invalidation Impact |
|----|----------|------------|------------|-----------|---------------------|
| A1 | FEASIBILITY | LLM can reliably produce warm, non-therapeutic responses with proper system prompt | HIGH | NO | Need prompt engineering iteration or response filtering |
| A2 | DEPENDENCY | LLM API responds within 3 seconds for short prompts | MEDIUM | NO | Use streaming or increase timeout threshold |
| A3 | SCOPE | Compassionate stranger is ephemeral (not stored, not synced) | HIGH | NO | Need storage + sync pipeline |
