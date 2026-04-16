# RSH-003: Memories, Nostalgia & Living Timeline — Standards Research

**Epic:** 3 — Memories, Nostalgia & Living Timeline
**Date:** 2026-04-14
**Domain:** Memory resurfacing, time capsules, annual retrospectives, data visualization, push notifications

---

## 1. On This Day — Memory Resurfacing

| Pattern | Standard / Source | Notes |
|---------|-------------------|-------|
| Date-based querying | Dexie compound index `[month+day]` | Use `between()` with compound key for same month-day across years. Cache daily results. |
| Carousel UX | Day One, Google Photos, Facebook Memories | Swipeable horizontal carousel, one card per year. Show preview text (140 chars) + mood indicator + photo thumb. |
| Empty state | Industry best practice | Don't show card when no eligible entries. Show motivational CTA instead ("Start today's memory"). |

### Dexie Query Pattern

```typescript
// Compound index on [month, day] for O(1) lookups
db.version(N).stores({
  entries: '++id, date, [month+day]'
});

// Query same month-day across all years
const today = new Date();
const memories = await db.entries
  .where('[month+day]')
  .equals([today.getMonth() + 1, today.getDate()])
  .toArray();
```

---

## 2. Push Notifications (Capacitor)

| Pattern | Standard / Source | Notes |
|---------|-------------------|-------|
| Local recurring | `@capacitor/local-notifications` | `schedule.on` with `repeats: true` for daily On This Day. |
| Permission flow | Capacitor Permissions API | `checkPermissions()` → `requestPermissions()` → `register()`. iOS prompts, Android auto-grants. |
| Action handling | `localNotificationActionPerformed` listener | Navigate to memory card on tap. Cleanup listener on unmount. |
| Channel (Android) | `createChannel()` | Dedicated "Memories" channel with importance=3 (default). |
| Time capsule unlock | One-time scheduled `LocalNotifications.schedule()` | Schedule at `unlockDate` with unique ID. Fallback: in-app banner on next open. |

### Notification Pattern

```typescript
import { LocalNotifications } from '@capacitor/local-notifications';

// Daily recurring "On This Day" notification
await LocalNotifications.schedule({
  notifications: [{
    id: MEMORY_NOTIFICATION_ID,
    title: t('memories.notification.title'),
    body: t('memories.notification.body', { preview }),
    schedule: { on: { hour: userJournalHour, minute: 0 }, repeats: true },
    channelId: 'memories'
  }]
});
```

---

## 3. Time Capsule

| Pattern | Standard / Source | Notes |
|---------|-------------------|-------|
| Lock/unlock | FutureMe.org, time capsule apps | Entry fields: `isTimeCapsule: boolean`, `unlockDate: Date`. Content invisible until unlock. |
| Security | Zero content leak principle | Filter time-locked entries from all queries. Unlock check: `Date.now() >= unlockDate`. |
| Countdown | UX standard | Show lock icon + days remaining. On unlock day: celebration animation + notification. |

---

## 4. Year in Review (Journal Wrapped)

| Pattern | Standard / Source | Notes |
|---------|-------------------|-------|
| Story format | Spotify Wrapped, Instagram Stories | Swipeable vertical cards. Auto-advance with progress bar. Tap to pause. |
| Data aggregation | Stats-only MVP (no AI dependency) | Mood distribution graph, entry count, streak stats, top themes (word frequency), word cloud. |
| Availability | Spotify Wrapped pattern | Available from December 15. Shareable as image cards. |
| Performance | Pre-compute aggregation | Cache annual stats. Don't compute on every view. |

---

## 5. Entry Sharing as Image Cards

| Pattern | Standard / Source | Notes |
|---------|-------------------|-------|
| Canvas rendering | `html2canvas` or native Canvas API | Render selected text + background + font into canvas → export as PNG. |
| Share API | Capacitor `@capacitor/share` or Web Share API | `Share.share({ files: [imageUri] })` for native share sheet. |
| Privacy | Explicit user action only | No auto-sharing. User selects text → previews card → confirms share. |

---

## 6. Data Visualizations (Revolution)

| Pattern | Standard / Source | Notes |
|---------|-------------------|-------|
| Constellation (star field) | WebGL / Canvas 2D | X=valence, Y=arousal, brightness=word count, color=emotion. K-means clustering for auto-naming. Target: 500+ entries at 60 FPS. |
| Emotion Sediment | Canvas 2D + Perlin noise | Horizontal color bands (geological strata). Export as print-ready PNG via `canvas.toBlob()`. |
| Growth Rings | SVG | Monthly rings in tree cross-section. Thickness=entry count, color=avg mood, texture=volatility. |
| Emotional River | Canvas 2D + gesture | Flowing river with width=intensity, color=mood. Pinch-to-zoom year→day. 60 FPS mandatory. |
| Temporal layers | CSS opacity + z-index | Ghost layers from same date in other years. Semi-transparent overlapping strata. |

### Performance Standards

- All visualizations: 60 FPS mandatory (Law 8)
- Canvas operations: use `requestAnimationFrame`, avoid layout thrashing
- Large datasets (500+ entries): use spatial indexing or LOD (level of detail)
- Export: `canvas.toBlob('image/png')` for print-ready output
- `prefers-reduced-motion`: disable animations, show static fallback

---

## Summary

| Area | Key Standard | Impact on Stories |
|------|-------------|-------------------|
| Date querying | Dexie `[month+day]` compound index | Technical Notes for On This Day story |
| Notifications | Capacitor Local Notifications (recurring + one-shot) | Technical Notes for notifications + time capsule stories |
| Story format UX | Spotify Wrapped swipeable cards | Technical Notes for Year in Review story |
| Canvas rendering | html2canvas + Canvas API + Share API | Technical Notes for sharing + visualization stories |
| WebGL performance | 60 FPS, requestAnimationFrame, spatial indexing | Technical Notes for constellation + river stories |
| Privacy | Explicit user action, zero content leak | AC constraint for time capsule + sharing stories |
