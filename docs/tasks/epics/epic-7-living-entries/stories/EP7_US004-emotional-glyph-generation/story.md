# EP7_US004: Emotional Glyph Generation

**Epic:** 7 — Living Entries & Arousal Foundation
**Priority:** P0 (Critical — core visual artifact)
**Complexity:** High
**Status:** Backlog
**Created:** 2026-04-14

---

## 1. User Story Statement

**As a** journaler who saves diary entries,
**I want** each entry to produce a unique visual glyph,
**So that** my diary feels personally meaningful and each entry has its own visual identity.

---

## 2. Acceptance Criteria

- **AC1:** Given I save a new entry, when the glyph generates, then a unique 128×128 image appears within 200ms
- **AC2:** Given I view a previously saved entry, when the glyph loads, then it matches exactly what was generated at save time
- **AC3:** Given I view an entry on a different device, when the glyph regenerates from metadata, then it looks identical

---

## 3. Technical Notes

### Architecture

- Create `src/hooks/useGlyphGenerator.ts` — offscreen canvas rendering hook
- Create `src/components/diary/EmotionalGlyph.tsx` — display component
- Pipeline: `EntryVisualParams.seed` → offset superformula params (m, n1, n2, n3) → render on 128×128 offscreen canvas → encode as base64 WebP → store in IndexedDB `journalEntries` table
- Offscreen canvas (Canvas 2D, not WebGL) for glyph thumbnail — simpler, more compatible
- Lazy generation: generate on first view, cache in IndexedDB
- Storage budget: < 5KB per entry (WebP at 128×128)

### Standards Research

- Superformula SDF: `superformula(theta, m, n1, n2, n3)` with seed-offset params creates unique shapes
- Deterministic visual hashing: hash → visual params → consistent output
- Full research: `docs/research/rsh-004-living-entries-standards.md` §2, §3

### Key Files

- `src/hooks/useGlyphGenerator.ts` (new)
- `src/components/diary/EmotionalGlyph.tsx` (new)
- `src/storage/` (modify — add glyph field to journal entry schema)

---

## 4. Dependencies

- **Blocked by:** EP7_US002 (needs EntryVisualParams for seed/shape params)
- **Blocks:** EP7_US005, EP7_US008

---

## 5. Test Strategy

(Planned separately by test planner)

---

## 6. Out of Scope

- Crystallization animation (US005)
- Fullscreen glyph view (US008)
- Real-time glyph rendering (only on save / first view)

---

## 7. Design Notes

Glyphs should feel organic and emotional — not geometric icons. The superformula naturally produces organic shapes (flowers, stars, blobs) which match the diary's emotional context.

---

## 8. Orchestrator Brief

```
orchestratorBrief: {
  tech: "TypeScript, Canvas 2D, WebP, IndexedDB/Dexie",
  keyFiles: ["src/hooks/useGlyphGenerator.ts", "src/components/diary/EmotionalGlyph.tsx", "src/storage/"],
  approach: "Offscreen canvas renders superformula shape from EntryVisualParams, encodes to base64 WebP, caches in IndexedDB",
  complexity: "High (canvas rendering, WebP encoding, storage integration, <200ms budget)"
}
```

---

## 9. Story Points

**Estimate:** 8 SP
