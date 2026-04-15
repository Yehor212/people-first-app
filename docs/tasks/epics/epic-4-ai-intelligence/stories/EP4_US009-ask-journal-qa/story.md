# EP4_US009: Ask Your Journal Q&A

**Epic:** [Epic 4 - AI Intelligence, Insights & Emotional Mirror](../../epic.md)
**Priority:** Low
**Status:** Backlog
**Labels:** user-story
**Created:** 2026-04-14

---

## Story

**As a** journaler

**I want** to ask natural language questions about my journal history

**So that** I can find insights without scrolling through hundreds of entries

---

## Context

### Current Situation

- Existing `journalAI.ts` provides semantic search but requires keyword-style queries
- Users cannot ask natural language questions like "How has my mood changed since I started meditating?"
- Finding patterns requires manually reading through entries

### Desired Outcome

- Natural language Q&A: "Summarize my March", "What patterns do you see in my anxiety?"
- LLM synthesizes answer from matched journal entries
- Returns relevant results for 80%+ of natural language queries
- Works with existing journalAI.ts infrastructure (upgrade, not replace)

---

## Acceptance Criteria

### Main Scenarios

- **Given** a user opens the "Ask Your Journal" chat interface
  **When** they type a natural language question (e.g., "How was my mood last month?")
  **Then** the app searches journal entries, sends relevant matches to the LLM, and displays a synthesized answer referencing specific entries with dates

- **Given** the LLM generates an answer to a journal question
  **When** the answer references specific entries
  **Then** each reference is tappable, linking to the original journal entry for full context

- **Given** a user asks a follow-up question in the same conversation
  **When** the follow-up relates to the previous answer
  **Then** the LLM maintains conversation context and provides a relevant follow-up answer

### Edge Cases

- **Given** the user asks a question with no matching journal entries
  **When** the semantic search returns zero results
  **Then** the app responds: "I couldn't find entries related to that topic. Try rephrasing or asking about something you've written about"

### Error Handling

- **Given** the user is offline
  **When** they ask a question
  **Then** the app falls back to local keyword search results (without LLM synthesis) with a note: "Showing basic search results — AI answers available when online"

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

| Aspect         | Value                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Tech**       | React, journalAI.ts, LLM API, Dexie                                                                              |
| **Key Files**  | `src/components/AskJournalChat.tsx`, `src/services/journalAI.ts`                                                 |
| **Approach**   | Upgrade existing semantic search to accept natural language queries, LLM synthesizes answer from matched entries |
| **Complexity** | Medium (extends existing journalAI.ts)                                                                           |

<!-- ORCHESTRATOR_BRIEF_END -->

### Architecture Considerations

- Layers affected: Service (journalAI.ts upgrade), UI (new AskJournalChat component)
- Patterns: RAG (Retrieval-Augmented Generation) — search first, then synthesize
- Side-effect boundary: Read-only against journal entries, conversation state in component
- Orchestration depth: 2 levels (query → semantic search → LLM synthesis)
- Constraints: Build on existing journalAI.ts, not replace it

### Library Research

**Primary libraries:**
| Library | Version | Purpose | Docs |
|---------|---------|---------|------|
| Supabase Edge Functions | Deno runtime | LLM API for answer synthesis | supabase.com/docs/guides/functions |

**Key APIs:**

- `journalAI.semanticSearch(query)` — existing search, upgraded for natural language
- LLM chat completion with entry context: synthesize answer from matched entries
- Conversation context management: maintain chat history for follow-ups

**Key constraints:**

- RAG pattern: search first (local), then send only matched entries to LLM (not entire journal)
- PII filtering before LLM call — only send entry text, not metadata with names/emails
- Conversation context: keep last 5 Q&A pairs for follow-ups (token budget management)
- Offline fallback: local keyword search without LLM synthesis

**Standards compliance:**

- OWASP A01:2021: PII filtering before LLM API calls
- RAG best practices: retrieve relevant entries first, then generate answer with citations

### Integration Points

- **External Systems**: LLM API via Edge Function
- **Internal Services**: `journalAI.ts` (upgrade semantic search), Dexie journal entries
- **Database**: Existing journal entries (read-only)

### Performance & Security

- Search + synthesis: < 5 seconds total
- Offline: local keyword search < 1 second
- PII filtering mandatory before LLM call
- Token budget: limit context to top 5-10 matched entries

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

- **EP4_US001**: Weekly AI Emotional Report (establishes LLM API pattern)
- Existing `journalAI.ts` semantic search infrastructure

### Blocks

- None

---

## Assumptions

| ID  | Category    | Assumption                                                                               | Confidence | Validated | Invalidation Impact                            |
| --- | ----------- | ---------------------------------------------------------------------------------------- | ---------- | --------- | ---------------------------------------------- |
| A1  | FEASIBILITY | Existing journalAI.ts semantic search can be upgraded for natural language queries       | HIGH       | NO        | Need to rebuild search infrastructure          |
| A2  | DATA        | Top 5-10 matched entries provide enough context for LLM to synthesize meaningful answers | MEDIUM     | NO        | Need better retrieval or larger context window |
| A3  | DEPENDENCY  | LLM can generate accurate answers with entry citations from provided context             | HIGH       | NO        | Need prompt engineering for citation accuracy  |
| A4  | SCOPE       | Conversation context limited to last 5 Q&A pairs (not full chat history)                 | HIGH       | NO        | Need token budget expansion or summarization   |
