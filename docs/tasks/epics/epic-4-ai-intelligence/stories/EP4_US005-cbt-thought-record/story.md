# EP4_US005: CBT Thought Record

**Epic:** [Epic 4 - AI Intelligence, Insights & Emotional Mirror](../../epic.md)
**Priority:** Medium
**Status:** Backlog
**Labels:** user-story
**Created:** 2026-04-14

---

## Story

**As a** journaler

**I want** a guided step-by-step thought record

**So that** I can challenge anxious thinking with evidence

---

## Context

### Current Situation
- Users journal about anxious or distressing thoughts but have no structured tool to work through them
- No CBT-based features exist in the app
- Research shows 25-50% anxiety reduction in 4 weeks with regular CBT thought records

### Desired Outcome
- Structured 5-column worksheet: Situation → Automatic Thought → Emotion (rate 0-100%) → Evidence For/Against → Balanced Thought → Re-rate Emotion
- Step-by-step guided flow, one column at a time (not overwhelming)
- Completion rate > 60% for started records
- Clear disclaimer: not a replacement for professional therapy

---

## Acceptance Criteria

### Main Scenarios

- **Given** a user opens the CBT Thought Record tool
  **When** they start a new record
  **Then** a step-by-step wizard guides them through 5 columns one at a time: Situation → Automatic Thought → Emotion (0-100% slider) → Evidence For/Against → Balanced Thought

- **Given** a user completes the Evidence For/Against column
  **When** they write a Balanced Thought in the final step
  **Then** they re-rate their emotion (0-100% slider) and see a before/after comparison of their emotional intensity

- **Given** a user starts but does not finish a thought record
  **When** they leave the tool and return later
  **Then** their in-progress record is saved and they can resume from where they left off

### Edge Cases

- **Given** a user has completed multiple thought records over 4+ weeks
  **When** they view their thought record history
  **Then** they see a list of past records with date, situation summary, and before/after emotion ratings

- **Given** a first-time user opens the CBT tool
  **When** they see the introduction screen
  **Then** a brief explanation of CBT thought records is shown with a disclaimer linking to professional resources

### Error Handling

- **Given** the app crashes or closes unexpectedly during a thought record
  **When** the user reopens the app
  **Then** the in-progress record is recovered from Dexie with all entered data intact

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
| **Tech** | React, Zustand, Dexie, i18n |
| **Key Files** | `src/components/ThoughtRecordEditor.tsx`, `src/storage/thoughtRecords.ts` |
| **Approach** | Step-by-step 5-column wizard (Situation → Auto Thought → Emotion → Evidence → Balanced Thought), stored in Dexie |
| **Complexity** | Medium (multi-step form + clinical accuracy) |
<!-- ORCHESTRATOR_BRIEF_END -->

### Architecture Considerations
- Layers affected: UI (ThoughtRecordEditor wizard), Storage (new thoughtRecords Dexie table), i18n (all 8 languages)
- Patterns: Multi-step form wizard with step persistence, Dexie for auto-save
- Side-effect boundary: Creates new `thoughtRecords` table in Dexie
- Orchestration depth: 1 level (wizard steps → Dexie save)
- Constraints: Clinical accuracy in terminology, disclaimer required

### Library Research

**Primary libraries:**
| Library | Version | Purpose | Docs |
|---------|---------|---------|------|
| Dexie.js | v4.x | Persist thought records with auto-save | dexie.org |

**Key APIs:**
- `db.thoughtRecords.put(record)` — save/update thought record
- `db.thoughtRecords.where('status').equals('in-progress')` — find resumable records

**Key constraints:**
- 5-column structure follows Beck's CBT model — do not deviate from clinical standard
- Emotion rating must be 0-100% slider (not free text) — enables before/after comparison
- Disclaimer on first use: "This tool is for self-reflection. It is not a substitute for professional therapy."
- All 8 languages must have accurate CBT terminology translations

**Standards compliance:**
- Beck's CBT model: 5-column thought record is the evidence-based standard
- APA ethical guidelines: non-therapeutic framing, professional referral links
- WCAG 2.1 AA: Slider accessible via keyboard, step indicators readable

### Integration Points
- **External Systems**: None (fully offline)
- **Internal Services**: Dexie (new thoughtRecords table), i18n translations
- **Database**: New `thoughtRecords` table in Dexie schema

### Performance & Security
- Auto-save on each step completion (no data loss on crash)
- Thought records are sensitive personal data — local-only, not synced initially
- Schema migration: add `thoughtRecords` table via Dexie version upgrade

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
| A1 | FEASIBILITY | Multi-step wizard with auto-save provides good UX for 5-column CBT flow | HIGH | NO | May need single-page layout alternative |
| A2 | DATA | Users will engage with all 5 columns (not abandon after situation) | MEDIUM | NO | Need to simplify to 3-column quick mode |
| A3 | SCOPE | Thought records are local-only, not synced to cloud | HIGH | NO | Need sync pipeline extension |
| A4 | DEPENDENCY | CBT terminology has accurate translations in all 8 languages | MEDIUM | NO | Need professional translation review |
