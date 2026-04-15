# EP4_US007: Post-Entry Cognitive Reflection

**Epic:** [Epic 4 - AI Intelligence, Insights & Emotional Mirror](../../epic.md)
**Priority:** Medium
**Status:** Backlog
**Labels:** user-story
**Created:** 2026-04-14

---

## Story

**As a** journaler

**I want** AI to identify my thinking patterns and show counter-evidence from my own entries

**So that** I see my situation more clearly

---

## Context

### Current Situation

- Users write emotionally charged entries but have no tool to challenge cognitive distortions
- No mechanism to use a user's own historical entries as counter-evidence
- Cognitive bias detection and self-sourced counter-evidence are complementary reflection tools

### Desired Outcome

- Opt-in "Thought Check" after emotional entries: AI identifies catastrophizing, black-and-white thinking, mind-reading, fortune-telling
- Devil's Advocate uses user's OWN past entries as counter-evidence — zero external content
- "Your own words tell a different story..." — grounded in personal history
- Suggests evidence-based reframes

---

## Acceptance Criteria

### Main Scenarios

- **Given** a user saves an emotionally intense journal entry with opt-in "Thought Check" enabled
  **When** the AI detects a cognitive distortion (e.g., catastrophizing, all-or-nothing thinking)
  **Then** a card appears identifying the distortion type with a brief explanation and a suggested evidence-based reframe

- **Given** the cognitive reflection card identifies a distortion
  **When** the user taps "See what you've said before"
  **Then** the app searches the user's own past entries for counter-evidence and displays 1-3 relevant quotes with dates that contradict the current distortion

- **Given** a user views the counter-evidence from their own entries
  **When** the quotes are displayed
  **Then** every quote comes exclusively from the user's own journal history — zero external content, zero generic advice

### Edge Cases

- **Given** a user's entry has no detectable cognitive distortion
  **When** the Thought Check runs
  **Then** no card is shown — the feature only activates when a distortion pattern is detected

- **Given** there are no relevant counter-evidence entries in the user's history
  **When** the Devil's Advocate search finds no matches
  **Then** only the bias detection card is shown without the "See what you've said before" option

### Error Handling

- **Given** the LLM API is unreachable for bias detection
  **When** the Thought Check attempts to run
  **Then** the feature silently skips — no error shown to user, logged for diagnostics

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

| Aspect         | Value                                                                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tech**       | React, pattern matching, journalAI.ts full-text search, LLM API                                                                              |
| **Key Files**  | `src/components/BiasDetectionCard.tsx`, `src/services/cognitiveReflection.ts`                                                                |
| **Approach**   | Bias Detection: LLM identifies distortions post-entry. Devil's Advocate: pattern match + FTS against user's own entries for counter-evidence |
| **Complexity** | High (two reflection modes + FTS + LLM)                                                                                                      |

<!-- ORCHESTRATOR_BRIEF_END -->

### Architecture Considerations

- Layers affected: Service (cognitiveReflection.ts), UI (BiasDetectionCard + counter-evidence view)
- Patterns: Two-phase reflection: (1) LLM bias detection, (2) local FTS for counter-evidence
- Side-effect boundary: Read-only against journal entries, no mutations
- Orchestration depth: 2 levels (entry → LLM bias check → FTS counter-evidence search)
- Constraints: Devil's Advocate uses ONLY user's own entries — zero external content

### Library Research

**Primary libraries:**
| Library | Version | Purpose | Docs |
|---------|---------|---------|------|
| Supabase Edge Functions | Deno runtime | LLM API for bias detection | supabase.com/docs/guides/functions |

**Key APIs:**

- LLM prompt: detect cognitive distortions (catastrophizing, all-or-nothing, mind-reading, fortune-telling)
- `journalAI.ts` full-text search: find counter-evidence from user's own entries
- `cognitiveReflection.findCounterEvidence(distortion, entries)` — search past entries for contradicting statements

**Key constraints:**

- Opt-in only — users must enable "Thought Check" in settings
- Devil's Advocate uses ONLY the user's own entries as source material
- LLM bias detection should identify specific distortion type (not generic "negative thinking")
- PII filtering before LLM call for bias detection

**Standards compliance:**

- CBT cognitive distortion taxonomy: catastrophizing, all-or-nothing, mind-reading, fortune-telling, overgeneralization
- APA ethical guidelines: non-therapeutic framing, opt-in only
- OWASP A01:2021: PII filtering before LLM API calls

### Integration Points

- **External Systems**: LLM API for bias detection (via Edge Function)
- **Internal Services**: `journalAI.ts` (FTS for counter-evidence), Dexie journal entries
- **Database**: Existing journal entries (read-only)

### Performance & Security

- Bias detection: < 3 seconds (LLM call)
- Counter-evidence search: < 1 second (local FTS)
- PII filtering before LLM call
- All counter-evidence is local — never leaves device

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
- Existing `journalAI.ts` full-text search infrastructure

### Blocks

- None

---

## Assumptions

| ID  | Category    | Assumption                                                             | Confidence | Validated | Invalidation Impact                                           |
| --- | ----------- | ---------------------------------------------------------------------- | ---------- | --------- | ------------------------------------------------------------- |
| A1  | FEASIBILITY | LLM can reliably identify cognitive distortion types from journal text | MEDIUM     | NO        | Need curated distortion detection patterns as fallback        |
| A2  | DATA        | Users have enough journal history for meaningful counter-evidence      | MEDIUM     | NO        | Need minimum entry threshold before enabling Devil's Advocate |
| A3  | SCOPE       | Feature is opt-in only — never triggers without user consent           | HIGH       | NO        | Would need consent flow redesign                              |
| A4  | DEPENDENCY  | journalAI.ts FTS is capable of semantic counter-evidence matching      | MEDIUM     | NO        | May need to upgrade to vector similarity search               |
