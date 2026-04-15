# EP4_US010: Conversational AI with Mentor Personas

**Epic:** [Epic 4 - AI Intelligence, Insights & Emotional Mirror](../../epic.md)
**Priority:** Low
**Status:** Backlog
**Labels:** user-story
**Created:** 2026-04-14

---

## Story

**As a** journaler

**I want** an AI guide to ask me contextual questions and create formatted entries

**So that** journaling feels like a meaningful conversation

---

## Context

### Current Situation

- Journaling requires self-directed writing — blank page can be intimidating for new users
- No conversational mode exists to guide users through reflection
- Lowest friction path for new journalers: AI asks, user responds

### Desired Outcome

- AI asks a question → user responds → AI asks contextual follow-up → creates formatted entry
- 5-10 "Wisdom Guide" personas: Stoic Philosopher, CBT Therapist, Mindfulness Teacher, Gratitude Coach, Creative Muse
- Each persona responds in character with distinct voice and style
- Conversation automatically creates a formatted journal entry when complete

---

## Acceptance Criteria

### Main Scenarios

- **Given** a user selects "Guided Journaling" and picks a mentor persona (e.g., Stoic Philosopher)
  **When** they start a conversation
  **Then** the AI opens with a character-appropriate question and responds in that persona's voice throughout the session

- **Given** a user is in conversation with a mentor persona
  **When** they respond to 3-5 questions
  **Then** the AI asks contextual follow-ups based on their answers, maintaining conversational coherence

- **Given** a conversational journaling session is complete
  **When** the user taps "Save as Entry"
  **Then** the conversation is formatted into a clean journal entry (not raw chat log) with the persona name noted, and saved to the diary

### Edge Cases

- **Given** a user switches personas mid-conversation
  **When** they select a different mentor
  **Then** the current conversation is offered to be saved as a draft, and a new conversation starts with the new persona

- **Given** a user has used conversational journaling 5+ times
  **When** they start a new session with the same persona
  **Then** the AI avoids repeating questions from recent sessions (last 5 conversations)

### Error Handling

- **Given** the LLM API is unreachable
  **When** the user tries to start conversational journaling
  **Then** a message explains the feature requires an internet connection, with a suggestion to use free-form journaling instead

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

| Aspect         | Value                                                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Tech**       | React, LLM API, Dexie, i18n                                                                                                                            |
| **Key Files**  | `src/components/MentorChat.tsx`, `src/services/mentorPersonas.ts`                                                                                      |
| **Approach**   | Chat UI: AI asks → user responds → AI follows up → creates entry. 5-10 personas with distinct system prompts (Stoic, CBT Therapist, Mindfulness, etc.) |
| **Complexity** | High (chat UX + persona management + entry creation)                                                                                                   |

<!-- ORCHESTRATOR_BRIEF_END -->

### Architecture Considerations

- Layers affected: Service (mentorPersonas.ts), UI (MentorChat component), Storage (conversation drafts in Dexie)
- Patterns: Chat interface with streaming LLM responses, persona system prompts, entry formatting
- Side-effect boundary: Creates journal entries from conversations, stores conversation drafts
- Orchestration depth: 2 levels (user input → LLM response → entry creation)
- Constraints: Each persona needs distinct system prompt + voice; avoid generic AI responses

### Library Research

**Primary libraries:**
| Library | Version | Purpose | Docs |
|---------|---------|---------|------|
| Supabase Edge Functions | Deno runtime | LLM API for persona conversations | supabase.com/docs/guides/functions |

**Key APIs:**

- LLM chat completion with persona system prompts (distinct per character)
- Streaming response for real-time conversational feel
- `mentorPersonas.getSystemPrompt(personaId)` — retrieve persona-specific system prompt
- `mentorPersonas.formatAsEntry(conversation)` — convert chat log to formatted journal entry

**Key constraints:**

- 5-10 personas minimum: Stoic Philosopher, CBT Therapist, Mindfulness Teacher, Gratitude Coach, Creative Muse
- Each persona has unique system prompt enforcing voice, style, and question approach
- Conversation → entry formatting must produce readable prose (not raw Q&A)
- PII filtering before LLM call
- Conversation drafts saved locally in Dexie (not synced)
- Question deduplication: track last 5 sessions per persona to avoid repetition

**Standards compliance:**

- OWASP A01:2021: PII filtering before LLM API calls
- APA ethical guidelines: CBT Therapist persona must include non-therapeutic disclaimer
- i18n: persona prompts and UI translated for all 8 languages

### Integration Points

- **External Systems**: LLM API via Edge Function (streaming)
- **Internal Services**: Journal entry creation (existing save flow), Dexie (conversation drafts)
- **Database**: Existing journal entries table (write), new conversation drafts in Dexie

### Performance & Security

- Streaming LLM response: first token < 1 second
- Conversation → entry formatting: < 2 seconds
- PII filtering before every LLM call
- Conversation drafts local-only

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

| ID  | Category    | Assumption                                                                   | Confidence | Validated | Invalidation Impact                                 |
| --- | ----------- | ---------------------------------------------------------------------------- | ---------- | --------- | --------------------------------------------------- |
| A1  | FEASIBILITY | LLM can maintain consistent persona voice across multi-turn conversations    | MEDIUM     | NO        | Need stronger system prompts or persona fine-tuning |
| A2  | DATA        | 3-5 questions per session is the right depth (not too shallow, not too long) | MEDIUM     | NO        | Need user testing to calibrate session length       |
| A3  | DEPENDENCY  | Conversation → entry formatting produces readable prose                      | MEDIUM     | NO        | Need LLM post-processing or manual formatting rules |
| A4  | SCOPE       | Conversations are local-only (not synced, not shared)                        | HIGH       | NO        | Need sync pipeline extension                        |
| A5  | SCOPE       | 5 initial personas are sufficient for launch                                 | HIGH       | NO        | Need persona creation/customization feature         |
