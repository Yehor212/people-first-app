# ZenFlow Adaptive UI Fixes — Complete Design Spec

**Date:** 2026-04-10
**Scope:** Fix broken display across ALL modules, normalize z-index, fix password lockout, fix modal stacking. No redesign — preserve all existing effects and animations.
**Principle:** Подправить, не переделывать. Все 40+ анимаций, WebGL orb, glass morphism, particles, springs остаются как есть.

---

## 1. Password Lockout Fix (CRITICAL — user locked out)

**Root cause (verified via git history):**

- Commit `5f13a40`: `PBKDF2_ITERATIONS = 100_000`
- Commit `62f2456`: changed to `600_000`
- `_LEGACY_PBKDF2_ITERATIONS = 100_000` declared but NEVER used
- `unlock()` reads `stored.iterations` from DB but IGNORES it — always uses 600K
- `JournalPassword` type already has `iterations: number` field

**Fix:**

- `useJournalSecurity.ts` `deriveKey()`: accept iterations parameter instead of hardcoded constant
- `unlock()`: use `stored.iterations` value from DB for hash verification
- On success with legacy iterations: silently re-hash with 600K, save updated entry
- `JournalLockScreen.tsx`: remove `password.length < 6` check on setup/change (user's choice)

**Recovery system (new feature):**

- Recovery phrase: 6 words via BIP39-style wordlist, shown once at password creation
- Stored as PBKDF2 hash in IndexedDB alongside password hash
- Fallback: verify via Google/Phone OTP → remove journal password
- Biometric: keep existing, suggest as default

**Files:** `useJournalSecurity.ts`, `JournalLockScreen.tsx`, `JournalModule.tsx`

---

## 2. Z-Index Normalization (33 values → unified system)

**Current state (audit found 33 unique values, 13 undocumented):**

Confirmed values:

- z-[-1]: mood-background-overlay
- z-0 to z-10: content
- z-20: canvas pills (AuxPills)
- z-30: canvas toolbar (FloatingMediaLayer)
- z-50: navigation (BottomTabs, Sidebar)
- z-[55]: Habit Hub FAB
- z-[56]-[57]: Sort dropdown
- z-[60]: Sheet overlay + FAB (CONFLICT!)
- z-[61]: Sort menu content
- z-[64]-[65]: undocumented
- z-[66]-[67]: ExportPickerDialog
- z-[70]: Journal modals (3 instances)
- z-[71], z-[75]: undocumented
- z-[80]: Sheet content + AICoachOnboarding
- z-[90], z-[100]: undocumented / heatmap tooltip
- z-[110]-[220]: undocumented
- z-[250]: Offline banner
- z-[300]-[301]: XP Popup + Celebrations
- z-[9999]: Skip-to-content accessibility link

**Critical conflicts:**

- FAB at z-[60] = same as sheet overlay → hidden when sheet opens but stacking unclear
- Multiple sheets at z-[60]/z-[80] simultaneously → fight for click capture
- `--z-modal` and `--z-overlay` CSS vars USED but NEVER DEFINED → undefined behavior

**Fix — define system in tailwind.config.ts + index.css:**

| Layer         | Z-Index | What goes here                        |
| ------------- | ------- | ------------------------------------- |
| Background    | -1, 0   | Mood overlay, base content            |
| Content       | 1-10    | Cards, buttons, relative elements     |
| Canvas        | 20-30   | Mind map tools, floating media        |
| Navigation    | 40      | Bottom tabs, sidebar                  |
| FAB           | 45      | Floating action buttons (all modules) |
| Dropdown      | 50      | Sort menus, tooltips, popovers        |
| Sheet overlay | 55      | Sheet/drawer backdrop                 |
| Sheet content | 60      | Sheet/drawer panel                    |
| Modal overlay | 65      | Modal/dialog backdrop                 |
| Modal content | 70      | Modal/dialog panel                    |
| Lock screen   | 75      | Journal lock overlay                  |
| System alerts | 80      | Offline banner                        |
| Celebrations  | 85      | XP popup, confetti, achievements      |
| Toast         | 90      | Snackbar notifications                |
| A11y          | 9999    | Skip-to-content (keep)                |

**Define CSS vars:**

```css
:root {
  --z-overlay: 55;
  --z-modal: 65;
  --z-sheet: 60;
  --z-lock: 75;
}
```

**Files:** `index.css`, `tailwind.config.ts`, all files using z-[N] where N doesn't match new system

---

## 3. Modal/Sheet Stacking Fix (windows behind windows)

**Root cause:** No modal coordinator. Multiple Sheet components render simultaneously in the same parent. Each creates its own portal with SheetOverlay + SheetContent at identical z-index.

**Specific bugs found:**

- `HabitHubList.tsx` lines 268-290: both `HabitDetailSheet` and `AddHabitSheet` rendered unconditionally — can open simultaneously, two overlays fight at z-[60]
- Sort menu (z-[60]) also rendered in same component → three stacking contexts fighting
- Same pattern likely exists in other modules with multiple sheets

**Fix — modal coordination:**

- Option A (minimal): add mutual exclusion — when one sheet opens, close the other
  ```tsx
  // In HabitHubList: close detail when adding, close add when viewing detail
  const openAddSheet = () => {
    setSelectedHabit(null);
    setShowAddForm(true);
  };
  const openDetailSheet = (h) => {
    setShowAddForm(false);
    setSelectedHabit(h);
  };
  ```
- Option B (robust): create `useSheetCoordinator()` hook — only one sheet open per context
- **Recommendation: Option A** — minimal change, solves the actual bug

**Files:** `HabitHubList.tsx`, check same pattern in: `JournalModule.tsx`, `ModalLayer.tsx`, `OverlayLayer.tsx`

---

## 4. Overflow & Scroll Fixes (content clipped without scroll)

**Critical bugs:**

- `AICoachChat.tsx:83` — `overflow-clip` blocks message scrolling entirely
- `AddGoalSheet.tsx:106` — `overflow-hidden` prevents scroll in max-h-[85dvh] container
- `AddEventModal.tsx:116` — conflicting `overflow-hidden` + `overflow-y-auto`
- `Leaderboard.tsx:93` — `max-h-[85dvh]` without inner scroll
- `HabitDetailSheet.tsx`, `AddHabitSheet.tsx` — same max-h without scroll pattern

**Fix pattern for all:**

```
Before: max-h-[85dvh] overflow-hidden
After:  max-h-[85dvh] overflow-y-auto overscroll-contain
```

Replace `overflow-clip` with `overflow-y-auto` on containers that have content taller than viewport.

**Files:** AICoachChat.tsx, AddGoalSheet.tsx, AddEventModal.tsx, Leaderboard.tsx, HabitDetailSheet.tsx, AddHabitSheet.tsx

---

## 5. Full-screen Modals → Responsive on Desktop

**Problem:** 25+ files use `fixed inset-0` for modals — correct on phone, but on desktop the modal covers the ENTIRE screen instead of being a centered dialog.

**Affected files (partial list):**

- AICoachChat.tsx, AICoachOnboarding.tsx
- AddGoalSheet.tsx, AddHabitSheet.tsx, HabitDetailSheet.tsx
- UnifiedShareModal.tsx, Leaderboard.tsx, FriendsPanel.tsx
- FocusReflectionModal.tsx, FeedbackForm.tsx, FeedbackButton.tsx
- ChallengesPanel.tsx, DailyRewards.tsx, DopamineSettings.tsx
- FeatureUnlock.tsx, BreathingExercise.tsx
- ChangelogPanel.tsx, CommandPalette.tsx

**Fix pattern:**

```
Before: fixed inset-0
After:  fixed inset-0 lg:inset-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:max-w-2xl lg:max-h-[80vh] lg:rounded-2xl lg:shadow-2xl
```

Or simpler: wrap in a container that centers on desktop:

```
Before: <div className="fixed inset-0">
After:  <div className="fixed inset-0 lg:flex lg:items-center lg:justify-center">
          <div className="h-full lg:h-auto lg:max-w-2xl lg:max-h-[80vh] lg:rounded-2xl">
```

**Files:** All 25+ files listed above

---

## 6. Hardcoded Sizes → Fluid

**Journal-specific:**

- `JournalEntryList.tsx`: `max-w-[260px]`, `max-w-[220px]` → `max-w-xs` or container query
- `JournalLockScreen.tsx:188`: `max-w-[340px]` → `max-w-sm w-full`
- `JournalModule.tsx:599`: `max-w-[320px]` → `max-w-sm w-full`
- `JournalEntryEditor.tsx:899`: `pt-[140px] pb-[160px]` → flexbox layout (toolbar sticky, content flex-1)

**Cross-module:**

- `CommandPalette.tsx:128`: `pt-[20vh]` → `pt-[min(20vh,120px)]` (landscape-safe)
- `HabitHeatmapGrid.tsx`: `gap-[3px]` → keep (heatmap pixel density is intentional)

**Editor height fix:**

- `JournalEntryEditor.tsx:391`: `h-dvh` → `h-[100svh]` with `h-screen` fallback
- Structure: toolbar sticky-top → content flex-1 overflow-y-auto → mood-bar sticky-bottom

**Files:** Listed above per item

---

## 7. Missing sm: Breakpoints

**Problem:** 40+ files jump from base (phone) to md: (768px) with no intermediate. Layout changes are jarring on small tablets / large phones (640-768px).

**Fix strategy:** Don't add sm: everywhere — only where layout jump is visible:

- Modals: add `sm:max-h-[75dvh]` to ease max-height transition
- Grids: add `sm:grid-cols-2` where cards switch from 1→3 columns abruptly
- Padding: add `sm:p-5` between `p-4` and `md:p-6`
- Only in files where the phone→tablet transition is visually jarring

**Files:** Prioritize: `JournalModule.tsx`, `HomeTab.tsx`, stats components, habit grids

---

## 8. Safe Area Consistency

**Problem:** Some files use `pb-[env(safe-area-inset-bottom)]`, others use `pb-safe`, others use `pb-[calc(...)]`. Inconsistent handling of iPhone notch/home indicator.

**Fix:** Standardize on one pattern across all bottom-positioned elements:

```
pb-[max(1rem,env(safe-area-inset-bottom))]
```

Apply to: BottomTabs, all bottom sheets, FABs, bottom toolbars.

**Files:** BottomTabs.tsx, sheet.tsx, all bottom-fixed elements

---

## What NOT to change

- All 40+ @keyframes animations
- ValenceOrb WebGL renderer (1696 lines)
- Framer Motion spring physics
- Zen particles system (day motes / night stars)
- Glass morphism levels (5 levels of backdrop-blur)
- Mood gradient overlays
- Haptic feedback system
- Confetti/celebration effects
- SVG ring/checkmark animations
- Theme system (dark/light)
- i18n (8 languages)
- Any animation timing, easing, or physics values
- Color palette / design tokens

---

## Priority Order

1. **Password fix** — unblocks user immediately
2. **Modal stacking** — fixes "windows behind windows"
3. **Overflow/scroll** — fixes clipped content
4. **Z-index normalization** — fixes stacking chaos
5. **Full-screen → responsive modals** — fixes desktop experience
6. **Hardcoded sizes → fluid** — fixes different screen sizes
7. **Missing breakpoints** — smooths transitions
8. **Safe area consistency** — fixes notched devices

## Testing

- `vitest run` — zero regressions after each fix
- `tsc --noEmit` — zero type errors
- Manual: resize browser through phone/tablet/desktop widths
- Verify: journal password unlock with 4-char password
- Verify: open sheet → try to open second sheet → first closes
- Verify: AI Coach messages scrollable
- Verify: modals centered on desktop, full-screen on phone
