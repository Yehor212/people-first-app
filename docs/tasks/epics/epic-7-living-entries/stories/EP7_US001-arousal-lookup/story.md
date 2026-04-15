# EP7_US001: Arousal Lookup Table

**Epic:** 7 — Living Entries & Arousal Foundation
**Priority:** P0 (Critical — foundation for all other stories)
**Complexity:** Low
**Status:** Backlog
**Created:** 2026-04-14

---

## 1. User Story Statement

**As a** journaler who selects emotion tags for my entries,
**I want** my emotion tags to automatically determine an arousal level,
**So that** the app can visually distinguish between states like anxious (high arousal) and sad (low arousal).

---

## 2. Acceptance Criteria

- **AC1:** Given I select "anxious" as my emotion, when the orb renders, then it displays high-arousal behavior (faster movement, higher intensity)
- **AC2:** Given I select "sad" as my emotion, when the orb renders, then it displays low-arousal behavior (slower movement, subdued intensity)
- **AC3:** Given any of the ~40 existing emotion tags, when I select one, then a valid arousal value (0–1) is returned within 1ms
- **AC4:** Given I select multiple emotion tags, when arousal is computed, then the result is the weighted average of all selected tags' arousal values

---

## 3. Technical Notes

### Architecture
- Create `src/utils/arousalLookup.ts` — pure function mapping emotion tag → arousal (0–1)
- Based on Russell's Circumplex Model: valence (X-axis, existing) + arousal (Y-axis, new)
- Lookup table covers all ~40 emotion tags in StateOfMind component
- Add `arousal` field to journal entry type in `types.ts`

### Standards Research
- Russell's Circumplex Model (1980): emotions as (valence, arousal) coordinates
- Four quadrants: high-arousal/positive (excited), high-arousal/negative (anxious), low-arousal/positive (calm), low-arousal/negative (sad)
- Full research: `docs/research/rsh-004-living-entries-standards.md` §1

### Key Files
- `src/utils/arousalLookup.ts` (new)
- `src/types.ts` (modify — add arousal field)
- `src/components/state-of-mind/` (read — emotion tag list)

---

## 4. Dependencies

- **Blocked by:** None (foundational story)
- **Blocks:** EP7_US002, EP7_US003, EP7_US005, EP7_US007

---

## 5. Test Strategy

(Planned separately by test planner)

---

## 6. Out of Scope

- Changing the emotion tag UI or selection flow
- ML-based arousal detection
- Adding new emotion tags

---

## 7. Design Notes

No UI changes. Arousal is computed behind the scenes from existing tag selection.

---

## 8. Orchestrator Brief

```
orchestratorBrief: {
  tech: "TypeScript, Zustand",
  keyFiles: ["src/utils/arousalLookup.ts", "src/types.ts", "src/components/state-of-mind/"],
  approach: "Create pure lookup table mapping ~40 emotions to arousal values using Russell's Circumplex Model",
  complexity: "Low (pure data mapping, no UI changes)"
}
```

---

## 9. Story Points

**Estimate:** 2 SP
