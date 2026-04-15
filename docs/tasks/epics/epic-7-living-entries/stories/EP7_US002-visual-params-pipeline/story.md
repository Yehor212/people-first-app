# EP7_US002: Visual Params Pipeline

**Epic:** 7 — Living Entries & Arousal Foundation
**Priority:** P0 (Critical — drives all visual generation)
**Complexity:** Medium
**Status:** Backlog
**Created:** 2026-04-14

---

## 1. User Story Statement

**As a** journaler who creates diary entries,
**I want** each entry to generate deterministic visual parameters from its metadata,
**So that** every entry has a unique, reproducible visual identity.

---

## 2. Acceptance Criteria

- **AC1:** Given I save an entry, when visual params are generated, then the same entry always produces identical `EntryVisualParams`
- **AC2:** Given two entries with different metadata (id, date, valence, content length, arousal, time of day), when visual params are generated, then they produce different params
- **AC3:** Given an entry, when I view it on any device, then the visual params match exactly (cross-platform determinism)

---

## 3. Technical Notes

### Architecture
- Create `src/utils/entryToVisualParams.ts` — deterministic hash pipeline
- Input: `{ id, date, valence, contentLength, arousal, timeOfDay }`
- Output: `EntryVisualParams` interface `{ seed, colorOffset, shapeM, shapeN1, shapeN2, shapeN3, glowIntensity, breathPeriod }`
- Hash function: use stable numeric hash (e.g., cyrb53 or similar) — no crypto needed, just determinism + distribution
- Define `EntryVisualParams` interface in `types.ts`

### Standards Research
- Deterministic visual hashing pattern (identicons, LifeHash): same input → same visual, always
- Collision resistance through multi-field hashing
- Full research: `docs/research/rsh-004-living-entries-standards.md` §3

### Key Files
- `src/utils/entryToVisualParams.ts` (new)
- `src/types.ts` (modify — add EntryVisualParams interface)

---

## 4. Dependencies

- **Blocked by:** EP7_US001 (needs arousal value as hash input)
- **Blocks:** EP7_US004, EP7_US005

---

## 5. Test Strategy

(Planned separately by test planner)

---

## 6. Out of Scope

- Rendering glyphs (US004)
- Shader integration (US003)
- Storage of generated visuals

---

## 7. Design Notes

Pure computation — no UI. Pipeline must be side-effect-free for testability and SSR safety.

---

## 8. Orchestrator Brief

```
orchestratorBrief: {
  tech: "TypeScript",
  keyFiles: ["src/utils/entryToVisualParams.ts", "src/types.ts"],
  approach: "Deterministic hash of entry metadata → EntryVisualParams interface with shape/color/glow parameters",
  complexity: "Medium (hash distribution must be verified across 1000+ entries)"
}
```

---

## 9. Story Points

**Estimate:** 3 SP
