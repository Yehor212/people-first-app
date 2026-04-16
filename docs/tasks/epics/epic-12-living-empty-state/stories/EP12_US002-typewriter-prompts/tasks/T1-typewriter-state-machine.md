# T1: TypewriterText State Machine

**Story:** [EP12_US002](../story.md) | **Type:** Implementation | **Status:** Todo | **Priority:** P0 | **Estimate:** 4h | **Parallel Group:** 1

## Goal
Create the TypewriterText component with a state machine (typing→holding→erasing→pausing) that types out prompts character by character.

## Acceptance Criteria
- [ ] Types characters at 40ms per char — `verify: inspect (typing delay value)`
- [ ] Holds completed text for 5 seconds — `verify: inspect (hold duration)`
- [ ] Erases backwards at 20ms per char — `verify: inspect (erase delay)`
- [ ] 1 second pause between erase and next prompt — `verify: inspect (pause duration)`
- [ ] Blinking cursor (|) visible during type/hold/erase — `verify: inspect (cursor element)`
- [ ] State machine: `typing | holding | erasing | pausing` — `verify: command (grep 'typing\|holding\|erasing\|pausing' src/features/journal/TypewriterText.tsx)`

### Affected Components
- `src/features/journal/TypewriterText.tsx` — NEW
