# Adaptive UI Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix broken display across all modules — password lockout, modal stacking, overflow, z-index, responsive modals, hardcoded sizes.

**Architecture:** Surgical fixes to existing code. No new components, no redesign. Fix the specific lines that cause display bugs. Preserve all animations, effects, and visual DNA.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Zustand, Dexie (IndexedDB), Capacitor 8

**Spec:** `docs/superpowers/specs/2026-04-10-journal-fixes-and-adaptive-ui-design.md`

---

### Task 1: Fix PBKDF2 Password Lockout (CRITICAL)

**Files:**

- Modify: `src/features/journal/useJournalSecurity.ts`
- Test: `src/features/journal/useJournalSecurity.test.ts`

- [ ] **Step 1: Write failing test for legacy iteration support**

```typescript
// src/features/journal/useJournalSecurity.test.ts
import { describe, it, expect } from "vitest";

// Test the deriveKey function directly
// We need to export it or test through the hook

describe("deriveKey", () => {
  it("should produce different hashes for different iteration counts", async () => {
    const password = "test";
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );

    const bits100k = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
      keyMaterial,
      256
    );
    const bits600k = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: 600_000, hash: "SHA-256" },
      keyMaterial,
      256
    );

    const hash100k = btoa(String.fromCharCode(...new Uint8Array(bits100k)));
    const hash600k = btoa(String.fromCharCode(...new Uint8Array(bits600k)));

    expect(hash100k).not.toBe(hash600k);
  });
});
```

- [ ] **Step 2: Run test to verify it passes (proves the problem exists)**

Run: `npx vitest run src/features/journal/useJournalSecurity.test.ts`
Expected: PASS — confirms 100K and 600K produce different hashes for same password

- [ ] **Step 3: Fix `deriveKey` to accept iterations parameter**

In `src/features/journal/useJournalSecurity.ts`, change line 32:

```typescript
// BEFORE (line 32):
async function deriveKey(password: string, salt: ArrayBuffer): Promise<string> {

// AFTER:
async function deriveKey(password: string, salt: ArrayBuffer, iterations = PBKDF2_ITERATIONS): Promise<string> {
```

And line 38:

```typescript
// BEFORE (line 38):
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },

// AFTER:
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
```

- [ ] **Step 4: Fix `unlock` to use stored iterations + transparent migration**

In `src/features/journal/useJournalSecurity.ts`, replace the unlock function (lines 145-178):

```typescript
const unlock = useCallback(
  async (password: string): Promise<boolean> => {
    if (Date.now() < cooldownUntil) return false;

    const entry = await db.settings.get(JOURNAL_PASSWORD_KEY);
    if (!entry?.value) return false;
    const stored = entry.value as JournalPassword;
    const salt = base64ToArrayBuffer(stored.salt);

    // Use stored iteration count (supports legacy 100K + current 600K)
    const storedIterations = stored.iterations || _LEGACY_PBKDF2_ITERATIONS;
    const hash = await deriveKey(password, salt, storedIterations);

    if (hash === stored.hash) {
      // Transparent migration: re-hash with current iterations if needed
      if (storedIterations < PBKDF2_ITERATIONS) {
        const newSalt = crypto.getRandomValues(new Uint8Array(16));
        const newHash = await deriveKey(password, newSalt.buffer, PBKDF2_ITERATIONS);
        const migrated: JournalPassword = {
          hash: newHash,
          salt: arrayBufferToBase64(newSalt.buffer),
          iterations: PBKDF2_ITERATIONS,
          createdAt: stored.createdAt,
        };
        await db.settings.put({ key: JOURNAL_PASSWORD_KEY, value: migrated });
        logger.info("[Journal]", "Password hash migrated to current iterations");
      }
      setIsUnlocked(true);
      setFailedAttempts(0);
      setCooldownUntil(0);
      unlockedAtRef.current = Date.now();
      resetAutoLock();
      return true;
    }

    const newAttempts = failedAttempts + 1;
    setFailedAttempts(newAttempts);
    for (const step of COOLDOWN_STEPS) {
      if (newAttempts >= step.after) {
        setCooldownUntil(Date.now() + step.seconds * 1000);
      }
    }
    return false;
  },
  [failedAttempts, cooldownUntil, resetAutoLock]
);
```

- [ ] **Step 5: Fix `changePassword` to also use stored iterations for verification**

In `src/features/journal/useJournalSecurity.ts`, line 187:

```typescript
// BEFORE (line 187):
const oldHash = await deriveKey(oldPw, oldSalt);

// AFTER:
const storedIterations = stored.iterations || _LEGACY_PBKDF2_ITERATIONS;
const oldHash = await deriveKey(oldPw, oldSalt, storedIterations);
```

- [ ] **Step 6: Remove minimum password length on setup/change**

In `src/features/journal/JournalLockScreen.tsx`:

Line 103 — change mode:

```typescript
// BEFORE (line 103):
        if (password.length < 6) {
          setError(ts.journalPasswordTooShort || "Minimum 6 characters");

// AFTER:
        if (password.length < 1) {
          setError(ts.journalPasswordRequired || "Enter a password");
```

Line 132 — setup mode:

```typescript
// BEFORE (line 132):
        if (password.length < 6) {
          setError(ts.journalPasswordTooShort || "Minimum 6 characters");

// AFTER:
        if (password.length < 1) {
          setError(ts.journalPasswordRequired || "Enter a password");
```

- [ ] **Step 7: Run all tests**

Run: `npx vitest run`
Expected: All existing tests pass + new test passes

- [ ] **Step 8: Commit**

```bash
git add src/features/journal/useJournalSecurity.ts src/features/journal/JournalLockScreen.tsx src/features/journal/useJournalSecurity.test.ts
git commit -m 'fix(journal): PBKDF2 iteration migration + remove password min length'
```

---

### Task 2: Fix Modal/Sheet Stacking (windows behind windows)

**Files:**

- Modify: `src/components/habit-hub/HabitHubList.tsx`
- Audit: `src/components/ModalLayer.tsx`, `src/components/OverlayLayer.tsx`

- [ ] **Step 1: Read HabitHubList.tsx to find the dual-sheet pattern**

Read lines 260-300 of `src/components/habit-hub/HabitHubList.tsx`. Find where both `HabitDetailSheet` and `AddHabitSheet` are rendered.

- [ ] **Step 2: Add mutual exclusion — close one when opening the other**

Find the handler that opens AddHabitSheet (sets `showAddForm=true`) and add `setSelectedHabit(null)`:

```typescript
// Where showAddForm is set to true, also close detail sheet:
const handleOpenAddForm = () => {
  setSelectedHabit(null); // close detail sheet
  setShowAddForm(true);
};
```

Find the handler that opens HabitDetailSheet (sets `selectedHabit`) and add `setShowAddForm(false)`:

```typescript
// Where selectedHabit is set, also close add form:
const handleSelectHabit = (habit: Habit) => {
  setShowAddForm(false); // close add sheet
  setSelectedHabit(habit);
};
```

- [ ] **Step 3: Grep for same dual-sheet pattern in other modules**

Run: `grep -rn "Sheet.*open=" src/components/ src/features/ --include="*.tsx" | grep -c "Sheet"`

Check if any other component renders 2+ Sheet components. Fix with same mutual exclusion pattern.

- [ ] **Step 4: Run tests + manual verify**

Run: `npx vitest run`
Manual: Open habits → click a habit → detail sheet opens → click "+" → detail closes, add sheet opens

- [ ] **Step 5: Commit**

```bash
git add src/components/habit-hub/HabitHubList.tsx
git commit -m 'fix(habits): prevent dual sheet stacking with mutual exclusion'
```

---

### Task 3: Fix Overflow/Scroll (clipped content)

**Files:**

- Modify: `src/components/ai-coach/AICoachChat.tsx`
- Modify: `src/features/goals-panel/AddGoalSheet.tsx`
- Modify: `src/components/schedule/AddEventModal.tsx`
- Modify: All files with `max-h-[85dvh] overflow-hidden` pattern

- [ ] **Step 1: Fix AICoachChat overflow-clip**

In `src/components/ai-coach/AICoachChat.tsx`, find `overflow-clip` (around line 83):

```typescript
// BEFORE:
overflow-clip

// AFTER:
overflow-y-auto overscroll-contain
```

- [ ] **Step 2: Fix AddGoalSheet overflow-hidden**

In `src/features/goals-panel/AddGoalSheet.tsx`, find `overflow-hidden` on the `max-h-[85dvh]` container (around line 106):

```typescript
// BEFORE:
max-h-[85dvh] overflow-hidden

// AFTER:
max-h-[85dvh] overflow-y-auto overscroll-contain
```

- [ ] **Step 3: Fix AddEventModal conflicting overflow**

In `src/components/schedule/AddEventModal.tsx`, find conflicting overflow classes (around line 116):

```typescript
// BEFORE:
overflow-hidden ... overflow-y-auto

// AFTER (remove overflow-hidden, keep overflow-y-auto):
overflow-y-auto overscroll-contain
```

- [ ] **Step 4: Batch fix all remaining overflow-hidden + max-h-dvh patterns**

Run grep to find all instances:

```bash
grep -rn "max-h-\[8[0-9]dvh\].*overflow-hidden" src/ --include="*.tsx"
```

For each result, replace `overflow-hidden` with `overflow-y-auto overscroll-contain`.

Expected files: `Leaderboard.tsx`, `HabitDetailSheet.tsx`, `AddHabitSheet.tsx`, `FriendsPanel.tsx`

- [ ] **Step 5: Run tests**

Run: `npx vitest run`
Run: `npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m 'fix(ui): replace overflow-hidden/clip with overflow-y-auto on modal containers'
```

---

### Task 4: Z-Index Normalization

**Files:**

- Modify: `src/index.css` (define CSS vars)
- Modify: All files with z-index values that conflict

- [ ] **Step 1: Define z-index CSS variables in index.css**

Add to `:root` block in `src/index.css`:

```css
:root {
  /* Z-index system — single source of truth */
  --z-nav: 40;
  --z-fab: 45;
  --z-dropdown: 50;
  --z-sheet-overlay: 55;
  --z-sheet: 60;
  --z-modal-overlay: 65;
  --z-modal: 70;
  --z-lock: 75;
  --z-system: 80;
  --z-celebration: 85;
  --z-toast: 90;
}
```

- [ ] **Step 2: Fix critical z-index conflicts**

Fix z-[300] on celebrations — these are intentionally highest UI. Reduce to z-[85]:

Search: `grep -rn "z-\[300\]" src/ --include="*.tsx" --include="*.css"`

For each result:

```
// BEFORE: z-[300]
// AFTER: z-[85]
```

Fix z-[250] on offline banner:

```
// BEFORE: z-[250]
// AFTER: z-[80]
```

- [ ] **Step 3: Fix sheet.tsx z-index to use CSS vars**

In `src/components/ui/sheet.tsx`, update SheetOverlay (line 23) and SheetContent z-index:

```typescript
// SheetOverlay BEFORE: z-[60]
// SheetOverlay AFTER: z-[55]

// SheetContent BEFORE: z-[80]
// SheetContent AFTER: z-[60]
```

- [ ] **Step 4: Fix ExportPickerDialog z-index**

In `src/features/journal/ExportPickerDialog.tsx`:

```
// BEFORE: z-[66] (overlay) z-[67] (content)
// AFTER: z-[55] (overlay) z-[60] (content) — matches sheet system
```

- [ ] **Step 5: Fix HabitHubList sort menu + FAB z-index**

In `src/components/habit-hub/HabitHubList.tsx`:

```
// Sort backdrop BEFORE: z-[60] → AFTER: z-[50]
// Sort menu BEFORE: z-[61] → AFTER: z-[50] (inside the dropdown stacking context)
// FAB BEFORE: z-[60] → AFTER: z-[45]
```

- [ ] **Step 6: Fix JournalEntryEditor z-[70] instances**

In `src/features/journal/JournalEntryEditor.tsx`, find all z-[70] (3 instances):

```
// Modal overlays: z-[70] → z-[65]
// Modal content: z-[70] → z-[70] (keep for modals, they're correct in new system)
```

- [ ] **Step 7: Run tests + verify no visual regressions**

Run: `npx vitest run`
Run: `npx tsc --noEmit`

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m 'fix(ui): normalize z-index hierarchy — 33 values to unified system'
```

---

### Task 5: Desktop-Responsive Modals (25+ files)

**Files:**

- Modify: All files using `fixed inset-0` for modals without responsive

- [ ] **Step 1: Create grep list of all affected files**

```bash
grep -rln "fixed inset-0" src/ --include="*.tsx" | head -30
```

- [ ] **Step 2: Apply responsive wrapper pattern to each file**

For each file, find the outermost `fixed inset-0` container and add desktop centering:

```typescript
// BEFORE:
<div className="fixed inset-0 ...">
  <div className="... h-full">

// AFTER:
<div className="fixed inset-0 lg:flex lg:items-center lg:justify-center ...">
  <div className="... h-full lg:h-auto lg:max-w-2xl lg:max-h-[85vh] lg:rounded-2xl lg:shadow-2xl">
```

**Important:** Not all `fixed inset-0` should change. Skip:

- Confetti overlays (decorative, should stay full-screen)
- Breathing exercise (intentionally immersive)
- Splash screen
- Lock screen (should stay full-screen)

Apply to: `AICoachChat.tsx`, `AICoachOnboarding.tsx`, `AddGoalSheet.tsx`, `UnifiedShareModal.tsx`, `Leaderboard.tsx`, `FriendsPanel.tsx`, `FocusReflectionModal.tsx`, `FeedbackForm.tsx`, `ChallengesPanel.tsx`, `DailyRewards.tsx`, `DopamineSettings.tsx`, `FeatureUnlock.tsx`, `ChangelogPanel.tsx`

- [ ] **Step 3: Fix CommandPalette hardcoded padding**

In `src/components/CommandPalette.tsx` (line 128):

```typescript
// BEFORE: pt-[20vh]
// AFTER: pt-[min(20vh,120px)]
```

- [ ] **Step 4: Run tests + tsc**

Run: `npx vitest run`
Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m 'fix(ui): responsive modals — centered dialog on desktop, full-screen on phone'
```

---

### Task 6: Hardcoded Sizes → Fluid (Journal)

**Files:**

- Modify: `src/features/journal/JournalEntryList.tsx`
- Modify: `src/features/journal/JournalLockScreen.tsx`
- Modify: `src/features/journal/JournalModule.tsx`

- [ ] **Step 1: Fix JournalEntryList hardcoded widths**

Read `src/features/journal/JournalEntryList.tsx`. Find `max-w-[260px]` and `max-w-[220px]`.

```typescript
// BEFORE: max-w-[260px]
// AFTER: max-w-[16rem]  (same visual at standard font, but scales with root font size)
// OR if inside a card: just remove the max-w and let the card container handle width
```

- [ ] **Step 2: Fix JournalLockScreen hardcoded width**

In `src/features/journal/JournalLockScreen.tsx` (line 188):

```typescript
// BEFORE: max-w-[340px]
// AFTER: max-w-sm w-full
```

- [ ] **Step 3: Fix JournalModule hardcoded width**

In `src/features/journal/JournalModule.tsx` (line 599):

```typescript
// BEFORE: max-w-[320px]
// AFTER: max-w-sm w-full
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/features/journal/
git commit -m 'fix(journal): replace hardcoded pixel widths with fluid Tailwind classes'
```

---

### Task 7: Fix Editor Layout (padding hacks → flexbox)

**Files:**

- Modify: `src/features/journal/JournalEntryEditor.tsx`

- [ ] **Step 1: Read the editor layout structure**

Read `src/features/journal/JournalEntryEditor.tsx` around lines 391, 870, 899. Understand the current layout: fixed toolbar + padding hack + fixed mood bar.

- [ ] **Step 2: Replace h-dvh with 100svh + fallback**

```typescript
// BEFORE (line 391):
h-dvh

// AFTER:
h-screen supports-[height:100svh]:h-[100svh]
```

- [ ] **Step 3: Replace padding hacks with flexbox layout**

Find the content area with `pt-[140px] pb-[160px]` (line 899):

```typescript
// BEFORE:
pt-[140px] pb-[160px]

// AFTER:
pt-0 pb-0 flex-1 overflow-y-auto
```

Make the toolbar sticky instead of fixed:

```typescript
// BEFORE: fixed top-0 ... z-[60]
// AFTER: sticky top-0 z-10
```

Make the mood bar sticky at bottom:

```typescript
// BEFORE: fixed bottom-0 ... z-[60]
// AFTER: sticky bottom-0 z-10
```

The parent container should be: `flex flex-col h-screen supports-[height:100svh]:h-[100svh]`

- [ ] **Step 4: Run tests + manual verify**

Run: `npx vitest run`
Run: `npx tsc --noEmit`
Manual: Open journal editor on phone-width browser. Verify toolbar sticks to top, content scrolls, mood bar sticks to bottom.

- [ ] **Step 5: Commit**

```bash
git add src/features/journal/JournalEntryEditor.tsx
git commit -m 'fix(journal): replace padding hacks with flexbox layout in editor'
```

---

### Task 8: Add Missing sm: Breakpoints + Safe Area Consistency

**Files:**

- Modify: `src/features/journal/JournalModule.tsx`
- Modify: `src/components/navigation/BottomTabs.tsx`
- Modify: Files with jarring phone→tablet layout jumps

- [ ] **Step 1: Fix JournalModule breakpoint jump**

In `src/features/journal/JournalModule.tsx` (lines 559-560), add intermediate breakpoint:

```typescript
// BEFORE: full-width → md:max-w-2xl → lg:max-w-none
// AFTER: full-width → sm:max-w-xl → md:max-w-2xl → lg:max-w-none
```

- [ ] **Step 2: Standardize safe-area padding on bottom-positioned elements**

In `src/components/navigation/BottomTabs.tsx`, verify safe area handling:

```typescript
// Should have:
pb-[max(0.5rem,env(safe-area-inset-bottom))]
```

Search all bottom sheets and bottom-fixed elements:

```bash
grep -rn "fixed bottom-0\|sticky bottom-0" src/ --include="*.tsx" | head -20
```

For each, ensure they have safe-area padding:

```typescript
// Add to every bottom-fixed element that doesn't have it:
pb-[env(safe-area-inset-bottom,0px)]
```

- [ ] **Step 3: Run full CI preflight**

Run: `npx vitest run`
Run: `npx tsc --noEmit`
Run: `npx eslint src/ --max-warnings=0`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m 'fix(ui): add sm: breakpoints + standardize safe-area padding'
```

---

## Execution Checklist

After all 8 tasks:

- [ ] `npx vitest run` — zero failures
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm run build` — builds successfully
- [ ] Manual: journal password unlock with short password
- [ ] Manual: resize browser phone → tablet → desktop
- [ ] Manual: open/close multiple sheets — no stacking
- [ ] Manual: AI Coach chat scrollable
- [ ] Manual: modals centered on desktop
