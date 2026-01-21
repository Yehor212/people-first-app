# ZenFlow Beta - Comprehensive Fix Plan

## Executive Summary

Full codebase audit completed. Found **45+ issues** across 6 categories requiring fixes before production release.

---

## PHASE 1: CRITICAL FIXES (Must Fix)

### 1.1 Focus/Hyperfocus Mode Not Starting on Mobile

**Root Causes:**
1. Breathing animation overlay blocks touch events (no `pointer-events: none`)
2. Modal doesn't prevent body scrolling on iOS
3. Audio unlock not preserved after pause/resume
4. Z-index layering issues between components

**Files to Fix:**
- `src/components/HyperfocusMode.tsx`
- `src/components/FocusTimer.tsx`
- `src/lib/ambientSounds.ts`

**Changes:**
```tsx
// HyperfocusMode.tsx - Add pointer-events and scroll lock
<div className="fixed inset-0 bg-black z-[100] overflow-hidden touch-none">
  {showBreathingAnimation && (
    <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
```

**Estimated Effort:** 2-3 hours

---

### 1.2 Notifications Not Working on Android

**Root Causes:**
1. Missing `SCHEDULE_EXACT_ALARM` permission for Android 12+
2. `allowWhileIdle: true` missing for global reminders
3. No NotificationChannel configuration
4. Missing reminder time selection UI in HabitTracker

**Files to Fix:**
- `android/app/src/main/AndroidManifest.xml`
- `src/lib/localNotifications.ts`
- `src/components/HabitTracker.tsx`
- `capacitor.config.ts`

**Changes:**
```xml
<!-- AndroidManifest.xml - Add permission -->
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
<uses-permission android:name="android.permission.USE_EXACT_ALARM" />
```

```typescript
// localNotifications.ts - Add allowWhileIdle
schedule: {
  on: { hour, minute },
  every: 'day',
  allowWhileIdle: true
}
```

**Estimated Effort:** 4-5 hours

---

### 1.3 Missing Habit Reminder Time Selection UI

**Problem:** Users cannot set custom reminder times for habits - UI exists in state but not rendered.

**File to Fix:**
- `src/components/HabitTracker.tsx`

**Changes Required:**
- Add time picker input (`<input type="time">`)
- Add day selection checkboxes (Mon-Sun)
- Add add/remove reminder buttons
- Connect to existing `handleReminderChange()` handler

**Estimated Effort:** 3-4 hours

---

## PHASE 2: HIGH PRIORITY (Should Fix)

### 2.1 Responsive Design - My World / Stats Tables

**Problems:**
1. 4-column grids don't adapt to mobile (320px screens)
2. 7-column calendar too cramped on phones
3. Fixed tree canvas sizes (120-280px)
4. Fixed padding (p-6) on all screen sizes

**Files to Fix:**
- `src/components/StatsPage.tsx`
- `src/components/SeasonalTree.tsx`
- `src/components/WeeklyCalendar.tsx`
- `src/components/CompanionPanel.tsx`

**Changes:**
```tsx
// StatsPage.tsx - Make grids responsive
<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-5">

// Calendar - smaller text on mobile
<div className="grid grid-cols-7 gap-0.5 sm:gap-1.5">
  <button className="text-[10px] sm:text-xs">
```

**Estimated Effort:** 4-5 hours

---

### 2.2 Haptic Feedback Disabled

**Problem:** Haptic feedback commented out in FocusTimer

**File to Fix:**
- `src/components/FocusTimer.tsx`

**Changes:**
```typescript
// Uncomment haptic feedback
haptics.focusPaused();
haptics.focusStarted();
```

**Estimated Effort:** 30 minutes

---

### 2.3 Console.log Cleanup (76+ instances)

**Problem:** Production code has 76+ console.log statements

**Files to Fix:**
- `src/lib/ambientSounds.ts` (8)
- `src/storage/realtimeSync.ts` (54+)
- `src/storage/tasksCloudSync.ts` (8)
- `src/pages/Index.tsx` (12)
- Multiple other files

**Changes:**
```typescript
// Wrap with dev check or remove
if (import.meta.env.DEV) {
  console.log('Debug info');
}
```

**Estimated Effort:** 2-3 hours

---

## PHASE 3: MEDIUM PRIORITY (Nice to Fix)

### 3.1 Audio Issues

**Problems:**
1. Audio unlock lost after pause/resume
2. Large SVG circles cause performance issues on old devices

**Files to Fix:**
- `src/components/HyperfocusMode.tsx`
- `src/lib/ambientSounds.ts`

**Estimated Effort:** 2-3 hours

---

### 3.2 Localization Completeness

**Problem:** 100+ fallback strings `|| 'English text'` - translations exist but not all used

**Files to Audit:**
- `src/components/BreathingExercise.tsx`
- `src/components/ChallengesPanel.tsx`
- `src/components/CompanionPanel.tsx`
- `src/components/DopamineSettings.tsx`

**Estimated Effort:** 2-3 hours (verify keys exist in translations.ts)

---

### 3.3 Error Handling Improvements

**Problem:** 4 instances of `.catch(console.error)` that silently swallow errors

**Files to Fix:**
- `src/lib/ambientSounds.ts`
- `src/hooks/useInnerWorld.ts`
- `src/components/QuestsPanel.tsx`
- `src/components/TasksPanel.tsx`

**Changes:**
```typescript
// Add proper error handling
.catch((error) => {
  console.error('Failed to sync:', error);
  // Show user-friendly toast notification
});
```

**Estimated Effort:** 1-2 hours

---

## PHASE 4: LOW PRIORITY (Polish)

### 4.1 Small Screen Optimizations

- Breathing circle fixed at 200px (too large on <240px screens)
- Modal padding needs responsive variants
- Viewport zoom settings for modals

### 4.2 Missing Features

- Quiet hours defined but not implemented in notifications
- Custom days selection for global reminders
- Duration targets for habits (UI missing)

### 4.3 Performance Polish

- Optimize SVG progress circles for old devices
- Add loading states for async operations

---

## Implementation Order

| # | Task | Priority | Effort | Dependencies |
|---|------|----------|--------|--------------|
| 1 | Fix HyperfocusMode touch/scroll blocking | CRITICAL | 2h | None |
| 2 | Add Android notification permissions | CRITICAL | 1h | None |
| 3 | Fix notification scheduling (allowWhileIdle) | CRITICAL | 2h | #2 |
| 4 | Add habit reminder time selection UI | CRITICAL | 4h | #3 |
| 5 | Make StatsPage grids responsive | HIGH | 3h | None |
| 6 | Make calendar 7-col responsive | HIGH | 2h | None |
| 7 | Fix SeasonalTree canvas sizing | HIGH | 2h | None |
| 8 | Enable haptic feedback | HIGH | 0.5h | None |
| 9 | Remove/wrap console.logs | HIGH | 3h | None |
| 10 | Fix audio unlock on resume | MEDIUM | 2h | #1 |
| 11 | Verify all translations used | MEDIUM | 2h | None |
| 12 | Improve error handling | MEDIUM | 2h | None |
| 13 | Small screen optimizations | LOW | 3h | #5,#6 |
| 14 | Add quiet hours logic | LOW | 2h | #3 |

---

## Total Estimated Effort

- **Phase 1 (Critical):** ~12 hours
- **Phase 2 (High):** ~10 hours
- **Phase 3 (Medium):** ~7 hours
- **Phase 4 (Low):** ~5 hours

**Total:** ~34 hours of development work

---

## Testing Checklist

After fixes, verify on:
- [ ] Android phone (small screen 320px)
- [ ] Android phone (medium screen 360px)
- [ ] Android tablet
- [ ] iOS iPhone SE (320px)
- [ ] iOS iPhone 14 (390px)
- [ ] Dark mode
- [ ] Light mode
- [ ] All 6 languages (ru, en, uk, es, de, fr)
- [ ] Offline mode
- [ ] After app restart

---

## Files Summary

**High-impact files (most changes):**
1. `src/components/HyperfocusMode.tsx` - touch, scroll, audio fixes
2. `src/components/HabitTracker.tsx` - reminder UI
3. `src/lib/localNotifications.ts` - Android notifications
4. `src/components/StatsPage.tsx` - responsive grids
5. `android/app/src/main/AndroidManifest.xml` - permissions

**Medium-impact files:**
6. `src/components/FocusTimer.tsx` - haptics, audio
7. `src/components/SeasonalTree.tsx` - responsive canvas
8. `src/components/WeeklyCalendar.tsx` - responsive grid
9. `capacitor.config.ts` - notification channel

---

*Plan created: January 20, 2026*
*Version: 1.0.1 Beta*
