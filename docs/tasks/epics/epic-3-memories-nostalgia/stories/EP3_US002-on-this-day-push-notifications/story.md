# EP3_US002: On This Day — Push Notifications

**Status:** Backlog
**Epic:** Epic 3 — Memories, Nostalgia & Living Timeline
**Labels:** user-story
**Priority:** P1
**Complexity:** Medium
**Created:** 2026-04-14

---

## 1. Story

**As a** journal user,
**I want to** receive a daily push notification at my journal time saying "1 year ago today, you wrote...",
**So that** I'm drawn back to the app through nostalgia.

## 2. Context

**Current Situation:** The app has no proactive engagement mechanism. Users must open the app to discover their past entries. Push notifications for memories are the highest-engagement retention lever in journaling apps (Day One reports 15%+ open rates).

**Desired Outcome:** Push notification open rate > 15% for On This Day notifications. Users who receive memory notifications show measurably higher 30-day retention.

## 3. Acceptance Criteria

- **AC1:** Given user has granted notification permissions and has entries from same date in a previous year, When journal time arrives, Then push notification appears with entry preview text
- **AC2:** Given user taps the On This Day notification, Then app opens directly to the On This Day memory card
- **AC3:** Given user has not granted notification permissions, When On This Day feature is enabled, Then app requests permission with explanation of the feature value
- **AC4:** Given user has no eligible entries for today, Then no notification is sent

## 4. Implementation Tasks

Tasks created via ln-300-task-coordinator after ln-310-multi-agent-validator.

## 5. Test Strategy

Test counts to be determined by ln-520-test-planner. Risk-Based Testing approach — prioritize permission flow edge cases and deep link navigation.

## 6. Technical Notes

<!-- ORCHESTRATOR_BRIEF_START -->

- **Tech:** React 18, TypeScript, Capacitor Local Notifications, i18n
- **Key Files:** `src/hooks/useOnThisDayNotifications.ts`, `src/services/notificationService.ts`, `capacitor.config.ts`
- **Approach:** Create notification service using Capacitor Local Notifications API with recurring daily schedule, permission handling, and deep link to memory card
- **Complexity:** Medium (Capacitor plugin + permissions + deep link)
<!-- ORCHESTRATOR_BRIEF_END -->

### Architecture

- `@capacitor/local-notifications` with `schedule.on` + `repeats: true` for daily recurring
- Android: dedicated "memories" notification channel (importance=3)
- Permission flow: `checkPermissions()` → `requestPermissions()` → `register()`
- Listener: `localNotificationActionPerformed` → navigate to On This Day card
- Listener cleanup on component unmount

### Library Research (Standards)

- **Capacitor Local Notifications:** Recurring schedule pattern with `schedule.on` (see RSH-003 Section 2)
- **Android channels:** `createChannel({ id: 'memories', importance: 3 })` for proper notification grouping
- **Permission flow:** iOS prompts user, Android auto-grants — handle both paths

### Performance

- Notification scheduling is lightweight (OS-managed)
- Entry eligibility check runs once daily, cached

### i18n

- Notification title and body text via `t()` across 8 languages
- Preview text respects entry language

## 7. Definition of Done

- [ ] All AC verified on iOS and Android
- [ ] Permission request shows value explanation before OS prompt
- [ ] Notification deep links to On This Day card correctly
- [ ] Android notification channel created on app start
- [ ] Listener cleanup verified (no memory leaks)
- [ ] i18n keys added for all 8 languages
- [ ] No notifications sent when no eligible entries exist

## 8. Dependencies

- **Depends On:** EP3_US001 (On This Day memory card must exist for notification deep link)

## 9. Assumptions

- **DEPENDENCY (HIGH):** Capacitor Local Notifications plugin is already installed or can be added without native project changes
- **SCOPE (MEDIUM):** Notification scheduling uses user's configured journal time (assumes this setting exists)
- **FEASIBILITY (HIGH):** Recurring local notifications work reliably on both iOS and Android via Capacitor
