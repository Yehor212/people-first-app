# EP3_US003: Time Capsule — Write to Future Self

**Status:** Backlog
**Epic:** Epic 3 — Memories, Nostalgia & Living Timeline
**Labels:** user-story
**Priority:** P1
**Complexity:** High
**Created:** 2026-04-14

---

## 1. Story

**As a** journal user,
**I want to** write a letter to my future self that locks until a specified date,
**So that** I can experience the surprise and emotion of rediscovering my own words.

## 2. Context

**Current Situation:** All journal entries are immediately readable. There is no mechanism for deferred self-discovery. Time capsule features in apps like FutureMe.org show high emotional engagement — users who create capsules have significantly higher long-term retention.

**Desired Outcome:** 10%+ of active users create at least 1 time capsule in first 90 days. Zero content leak — capsule entries must be invisible until unlock date.

## 3. Acceptance Criteria

- **AC1:** Given user is writing a journal entry, When they enable time capsule mode and set an unlock date, Then entry is saved with lock icon and countdown timer visible
- **AC2:** Given a time capsule entry exists and unlock date has not arrived, When user views their entry list, Then the entry shows as locked with days remaining and content is not readable
- **AC3:** Given unlock date arrives, When user opens the app, Then notification appears and entry is unlocked for reading with celebration animation
- **AC4:** Given unlock notification was missed, When user next opens the app, Then in-app banner announces the unlocked capsule

## 4. Implementation Tasks

Tasks created via ln-300-task-coordinator after ln-310-multi-agent-validator.

## 5. Test Strategy

Test counts to be determined by ln-520-test-planner. Risk-Based Testing approach — prioritize security (zero content leak), unlock timing correctness, and notification reliability.

## 6. Technical Notes

<!-- ORCHESTRATOR_BRIEF_START -->

- **Tech:** React 18, TypeScript, Dexie.js, Capacitor Local Notifications, Zustand
- **Key Files:** `src/components/TimeCapsuleEditor.tsx`, `src/components/TimeCapsuleLock.tsx`, `src/hooks/useTimeCapsule.ts`, `src/storage/journalRepository.ts`, `src/types.ts`
- **Approach:** Add isTimeCapsule + unlockDate fields to entry type, create editor/lock components, schedule one-shot notification at unlock date, filter locked entries from queries
- **Complexity:** High (security filtering + notification scheduling + celebration UI)
<!-- ORCHESTRATOR_BRIEF_END -->

### Architecture

- Entry type extension: `isTimeCapsule: boolean`, `unlockDate: Date`
- **Security:** Filter locked entries from ALL read queries — content field returns null/redacted until `Date.now() >= unlockDate`
- One-shot notification: `LocalNotifications.schedule()` at `unlockDate`
- Fallback: in-app banner check on app resume (AppState change listener)
- `TimeCapsuleEditor.tsx` — date picker + capsule creation UI
- `TimeCapsuleLock.tsx` — lock icon + countdown display
- `useTimeCapsule.ts` — hook for capsule state management

### Library Research (Standards)

- **Time capsule pattern:** Lock/unlock with `isTimeCapsule` + `unlockDate` fields (see RSH-003 Section 3)
- **Zero content leak:** Filter at query level, not UI level — locked entries never return content to JavaScript
- **Notification:** One-shot `LocalNotifications.schedule({ at: unlockDate })` (see RSH-003 Section 2)

### Performance

- Capsule filtering adds WHERE clause to Dexie queries — negligible cost
- Countdown timer uses `requestAnimationFrame` for smooth display without layout thrashing

### i18n

- Countdown text ("X days remaining"), notification body, and celebration text via `t()`
- Date picker locale support for all 8 languages

## 7. Definition of Done

- [ ] All AC verified on iOS, Android, and Desktop
- [ ] Zero content leak: locked capsules show no content in any view (list, search, export)
- [ ] Unlock notification fires on correct date
- [ ] In-app fallback banner works when notification missed
- [ ] Celebration animation plays on unlock
- [ ] Touch targets >= 44px on date picker and controls
- [ ] Theme tokens only, safe area insets respected
- [ ] i18n keys for all 8 languages
- [ ] Android back handler on capsule editor

## 8. Dependencies

- None (independent of On This Day — uses separate entry fields)
- **Uses:** Capacitor Local Notifications (shared with EP3_US002)

## 9. Assumptions

- **DATA (HIGH):** Adding `isTimeCapsule` + `unlockDate` fields to entry type is backward-compatible (existing entries default to `false`/`null`)
- **SCOPE (HIGH):** Capsule lock is per-entry, not per-section — entire entry is locked
- **FEASIBILITY (MEDIUM):** One-shot notifications scheduled far in future (months/years) survive app updates and device restarts on both platforms
