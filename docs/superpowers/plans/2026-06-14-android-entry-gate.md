# Android Entry Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Android as the next complete entry-gate platform by verifying and documenting the language and auth screens on Android phone and tablet form factors.

**Architecture:** `AuthGate` owns the entry sequence and renders `LanguageSelector` before `AuthScreen`. The Android pass must preserve the shared entry components while proving they behave correctly under Android-like viewport, touch, DPR, theme, auth-provider, and RTL conditions. Native proof is limited to Capacitor Android sync and debug build unless a running emulator is available.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind, Zustand, Capacitor 8, Playwright, Gradle/Android.

---

### Task 1: Scope And Current-State Audit

**Files:**
- Read: `AGENTS.md`
- Read: `ARCHITECTURE.md`
- Read: `docs/ENTRY_GATE_IOS_CONTRACT.md`
- Read: `src/components/AuthGate.tsx`
- Read: `src/components/LanguageSelector.tsx`
- Read: `src/components/auth-screen/AuthScreen.tsx`
- Read: `src/components/EntryGate.css`
- Read: `src/components/EntryGateBackdrop.tsx`
- Read: `src/components/auth/AuthProviderButton.tsx`
- Read: `src/lib/authProviders.ts`

- [ ] **Step 1: Confirm only Android is in scope**

Run: `git status -sb`

Expected: The worktree may contain unrelated existing changes. Do not revert them. Restrict new work to Android entry evidence/docs unless a blocking Android entry bug is found.

- [ ] **Step 2: Inspect entry-gate source files**

Run: `rg -n "entry-gate|LanguageSelector|AuthScreen|AuthProviderButton|AUTH_SCREEN_PROVIDER_IDS|viewport-fit|safe-area|rtl:scale" src/components src/lib/authProviders.ts index.html`

Expected: The shared entry files and viewport/safe-area contracts are discoverable.

### Task 2: Android Visual Evidence

**Files:**
- Create: `output/playwright/android-entry-20260614/facts.json`
- Create: `output/playwright/android-entry-20260614/android-phone-language-light.png`
- Create: `output/playwright/android-entry-20260614/android-phone-language-dark.png`
- Create: `output/playwright/android-entry-20260614/android-phone-language-ar-rtl.png`
- Create: `output/playwright/android-entry-20260614/android-phone-auth-light.png`
- Create: `output/playwright/android-entry-20260614/android-phone-auth-dark.png`
- Create: `output/playwright/android-entry-20260614/android-tablet-language-system.png`
- Create: `output/playwright/android-entry-20260614/android-tablet-auth-dark.png`

- [ ] **Step 1: Start a local Vite server**

Run: `npm run dev -- --host 127.0.0.1 --port 4192`

Expected: Vite prints a local URL at `http://127.0.0.1:4192/people-first-app/`.

- [ ] **Step 2: Capture Android phone and tablet screenshots**

Run a Playwright script with Android-like viewports:

```text
phone: width 412, height 915, deviceScaleFactor 2.625, isMobile true, hasTouch true
tablet: width 800, height 1280, deviceScaleFactor 2, isMobile true, hasTouch true
```

Expected JSON facts per scenario:

```text
documentHorizontalOverflow: false
screenHorizontalOverflow: false
outOfBoundsCount: 0
logo natural size: at least 256 by 256
backdrop stars: 0
backdrop flowMarks: 0
backdrop ripples: 2
backdrop orbs: 3
themeSwitcher: true
languageOptions: 8 on language scenarios
providers: google, facebook, telegram on auth scenarios
telegram viewBox: 0 0 128 128 on auth scenarios
rtl arrow mirrored on Arabic language scenario
```

- [ ] **Step 3: Visually inspect screenshots**

Open the generated PNGs and confirm no overlapping UI, missing logo, cut-off text, or malformed provider icon.

### Task 3: Web And Android Native Verification

**Files:**
- May update generated Android web assets through Capacitor sync.

- [ ] **Step 1: Run focused entry tests**

Run:

```bash
npm run test -- src/components/__tests__/EntryGate.safeArea.test.ts src/components/__tests__/LanguageSelector.test.tsx src/components/auth-screen/__tests__/AuthScreen.providers.test.tsx src/components/__tests__/AuthGate.test.tsx
```

Expected: All focused tests pass.

- [ ] **Step 2: Run type, lint, color, and web build checks**

Run:

```bash
npm run typecheck
npm run lint
npm run check:colors
npm run build
```

Expected: All commands exit 0.

- [ ] **Step 3: Run Android Capacitor sync**

Run: `npm run cap:sync:android`

Expected: Android sync completes without errors.

- [ ] **Step 4: Run Android native debug build**

Run: `cd android && ./gradlew assembleDebug`

Expected: Gradle reports `BUILD SUCCESSFUL`.

- [ ] **Step 5: Check emulator availability**

Run: `adb devices`

Expected: If no device is attached, mark real-device/emulator runtime as `UNVERIFIED`; do not block the platform pass if web evidence plus native build are green.

### Task 4: Android Entry Contract Documentation

**Files:**
- Create: `docs/ENTRY_GATE_ANDROID_CONTRACT.md`

- [ ] **Step 1: Document Android scope and source files**

Include Android phone/tablet scope, entry flow, file ownership, element inventory, viewport/touch constraints, provider icon rules, RTL risks, and exact verification commands.

- [ ] **Step 2: Document evidence**

Include generated screenshot paths, facts path, and SHA-256 hashes from Task 2.

- [ ] **Step 3: Document unknowns**

If no Android emulator or physical device is attached, include `UNVERIFIED: real Android runtime interaction on device`.

### Task 5: Strict Self-Check

**Files:**
- Read: `docs/ENTRY_GATE_ANDROID_CONTRACT.md`

- [ ] **Step 1: Verify documentation file quality**

Run:

```bash
test -s docs/ENTRY_GATE_ANDROID_CONTRACT.md
rg -n "TODO|TBD|FIXME|stub text|implement later|fill in" docs/ENTRY_GATE_ANDROID_CONTRACT.md || true
```

Expected: File exists and the stub-text scan prints no matches.

- [ ] **Step 2: Verify local evidence links**

Run: `shasum -a 256 docs/ENTRY_GATE_ANDROID_CONTRACT.md output/playwright/android-entry-20260614/facts.json output/playwright/android-entry-20260614/*.png`

Expected: Hashes print for all files.

- [ ] **Step 3: Report only evidence-backed PASS**

Final report must separate PASS evidence from `UNVERIFIED` real-device runtime if no Android device was attached.
