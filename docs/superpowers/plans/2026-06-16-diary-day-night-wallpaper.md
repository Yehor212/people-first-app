# Diary Day Night Wallpaper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a premium, cross-platform day/night wallpaper system for V2 Diary that improves the existing beautiful background without changing diary data, sync, auth, or native platform code.

**Architecture:** Add a small reusable `DiaryWallpaper` scene inside `src/features/journal` and mount it once in the page shell so Web, PWA, iOS WKWebView, Android WebView, and Tauri share the same rendering path. Keep surfaces readable with token-based CSS, safe-area-aware layout, reduced-motion support, and zero hardcoded color literals.

**Tech Stack:** React 18, TypeScript, Tailwind token classes, CSS theme selectors, Vitest static/component tests, Playwright WebKit visual/runtime proof.

---

### Task 1: Contract Test

**Files:**
- Create: `src/features/journal/__tests__/DiaryWallpaper.static.test.tsx`
- Read: `src/features/journal/JournalModule.tsx`

- [ ] **Step 1: Write the failing static contract test**

```tsx
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../../../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Diary wallpaper contract", () => {
  it("mounts one unified day/night wallpaper layer in the V2 diary page shell", () => {
    const source = read("src/features/journal/JournalModule.tsx");

    expect(source).toContain("<DiaryWallpaper");
    expect(source).toContain('data-testid="journal-wallpaper"');
    expect(source).toContain('data-wallpaper-surface="page"');
  });

  it("uses tokenized CSS with day, night, reduced-motion, and forced-colors support", () => {
    const source = read("src/features/journal/DiaryWallpaper.tsx");
    const css = read("src/index.css");

    expect(source).toContain("journal-wallpaper--day");
    expect(source).toContain("journal-wallpaper--night");
    expect(source).toContain("prefers-reduced-motion");
    expect(css).toContain(".journal-wallpaper");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("@media (forced-colors: active)");
  });
});
```

- [ ] **Step 2: Run red test**

Run: `npm run test -- src/features/journal/__tests__/DiaryWallpaper.static.test.tsx`
Expected: FAIL because `DiaryWallpaper.tsx` and shell mount do not exist yet.

### Task 2: Wallpaper Component

**Files:**
- Create: `src/features/journal/DiaryWallpaper.tsx`
- Modify: `src/features/journal/JournalModule.tsx`

- [ ] **Step 1: Implement `DiaryWallpaper`**

Create a memoized component that derives day/night from current hour and theme, renders only decorative spans with `aria-hidden`, exposes `data-testid="journal-wallpaper"`, supports `surface="page" | "panel" | "empty"`, and avoids localStorage or user data.

- [ ] **Step 2: Mount it in `JournalModule` page shell**

Import `DiaryWallpaper` and render it before `moduleContent` in the `isPagePresentation` section. Keep existing `journal-light-atmosphere` for paper theme as an additional light-material layer.

### Task 3: Token CSS Polish

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add `.journal-wallpaper` CSS**

Use `hsl(var(--...))` tokens only. Include day, night, paper, OLED, reduced-motion, forced-colors, and safe mobile behavior. Do not add decorative cards or orbs.

- [ ] **Step 2: Make diary panels readable above wallpaper**

Use existing `journal-light-panel` and `journal-light-detail-pane` patterns; add only necessary transparent panel styling so text remains readable on phone and desktop.

### Task 4: Runtime Proof

**Files:**
- Existing tests only unless runtime proof exposes a bug.

- [ ] **Step 1: Run focused tests**

Run: `npm run test -- src/features/journal/__tests__/DiaryWallpaper.static.test.tsx src/pages/nav-v2/__tests__/DiaryRouteLoader.test.ts src/pages/nav-v2/__tests__/integration.orbToDiaryHandoff.test.tsx`
Expected: PASS.

- [ ] **Step 2: Run quality guards**

Run: `npm run typecheck`, `npm run i18n:v2-copy`, `npm run check:colors`, `npm run check:canonical-orbs`.
Expected: PASS.

- [ ] **Step 3: Run browser proof**

Run the V2 diary route at phone and desktop sizes with Playwright. Verify wallpaper element exists, day/night classes can be forced in test mode, no console errors, no visible overlap, and touch targets remain at least 44px.
