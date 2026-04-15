# EP3_US005: Entry Sharing as Image Cards

**Status:** Backlog
**Epic:** Epic 3 — Memories, Nostalgia & Living Timeline
**Labels:** user-story
**Priority:** P2
**Complexity:** Medium
**Created:** 2026-04-14

---

## 1. Story

**As a** journal user,
**I want to** select text from my entry and generate a beautiful shareable image card with custom backgrounds matching my diary theme,
**So that** I can share meaningful moments on Instagram Stories or WhatsApp.

## 2. Context

**Current Situation:** Users cannot share their journal entries visually. Copy-pasting text loses all emotional context (mood, theme, styling). Image-based sharing is the dominant format on Instagram Stories and WhatsApp Status.

**Desired Outcome:** 5%+ of entries shared as image cards. Shareable cards drive organic acquisition through social visibility.

## 3. Acceptance Criteria

- **AC1:** Given user selects text in an entry, When they tap the share-as-card action, Then a preview of the styled image card appears with the selected text, background, and font matching current diary theme
- **AC2:** Given user is previewing the image card, When they choose a background style, Then the card updates in real-time with the new style
- **AC3:** Given user confirms the card design, When they tap share, Then native share sheet opens with the generated image ready for Instagram Stories or WhatsApp
- **AC4:** Given user has not selected any text, Then the share-as-card action is not available

## 4. Implementation Tasks

Tasks created via ln-300-task-coordinator after ln-310-multi-agent-validator.

## 5. Test Strategy

Test counts to be determined by ln-520-test-planner. Risk-Based Testing approach — prioritize image generation quality, native share integration, and privacy (explicit user action only).

## 6. Technical Notes

<!-- ORCHESTRATOR_BRIEF_START -->

- **Tech:** React 18, TypeScript, Canvas API, Capacitor Share, Tailwind
- **Key Files:** `src/components/ShareCardGenerator.tsx`, `src/hooks/useShareCard.ts`, `src/utils/cardTemplates.ts`
- **Approach:** Create canvas-based card renderer with theme-matched templates, integrate Capacitor Share API for native sharing
- **Complexity:** Medium (canvas rendering + theme integration + native share)
<!-- ORCHESTRATOR_BRIEF_END -->

### Architecture

- Canvas API or html2canvas for rendering selected text + background + font
- Multiple background templates matching diary themes (day/night variants)
- Export as PNG via `canvas.toBlob()`
- `@capacitor/share` for native share sheet (`Share.share({ files: [imageUri] })`)
- `ShareCardGenerator.tsx` — card preview + style picker component
- `useShareCard.ts` — canvas rendering and share logic
- `cardTemplates.ts` — background/font template definitions

### Library Research (Standards)

- **Canvas rendering:** Canvas API for text + background composition (see RSH-003 Section 5)
- **Capacitor Share:** `@capacitor/share` for cross-platform native share sheet
- **Privacy:** Explicit user action only — no auto-sharing, user selects → previews → confirms

### Performance

- Canvas rendering should complete in < 1 second for preview updates
- PNG export target: < 2 seconds via `canvas.toBlob()`

### i18n

- Share button labels and style picker labels via `t()` across 8 languages
- Card text uses original entry language (not translated)

## 7. Definition of Done

- [ ] All AC verified on iOS, Android, and Desktop
- [ ] Image card matches current diary theme (day/night)
- [ ] Native share sheet works on iOS and Android
- [ ] Touch targets >= 44px on all card controls
- [ ] Theme tokens only (zero hardcoded colors)
- [ ] i18n keys for all 8 languages
- [ ] No auto-sharing — explicit user action required
- [ ] Android back handler exits card preview

## 8. Dependencies

- None (independent — uses existing entry text and theme system)

## 9. Assumptions

- **FEASIBILITY (HIGH):** Canvas API produces consistent text rendering across platforms
- **SCOPE (HIGH):** Background templates are static assets, not user-uploaded images
- **DEPENDENCY (MEDIUM):** `@capacitor/share` plugin supports file sharing on both platforms
