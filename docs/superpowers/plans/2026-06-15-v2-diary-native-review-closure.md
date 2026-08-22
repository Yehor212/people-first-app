# V2 Diary Native Review Closure Implementation Plan

> **Governance update (2026-08-14):** Execute only an explicitly authorized task and do so SOLO. Use `superpowers:executing-plans` only for an approved plan; do not invoke subagents or auto-start the next task. Existing checkboxes are tracking only.

**Goal:** Close the current V2 Diary/native review loop on `main` with evidence-backed fixes, tests, and honest `UNVERIFIED` boundaries.

**Architecture:** Keep V2 Diary and native-adjacent fixes narrow. Native reminder permission belongs in the V2 settings notification toggle; scheduling stays side-effect-free. iOS AdMob identity belongs in Xcode build settings, not hard-coded release plist values. P3 performance and visual risks must be proven with existing behavioral/e2e checks before code is changed.

**Tech Stack:** React 18, TypeScript, Vite, Capacitor 8, Vitest, Playwright, iOS `Info.plist`/`.xcconfig`, Semgrep, npm audit.

---

## Scope And Risk

- Risk level: `L3`, because the reviewed surface touches private diary behavior, native reminders, notification permissions, and app-store monetization config.
- Branch: `main`, explicitly requested by the user.
- Do not edit unrelated protected agent docs, auth, Supabase schema, cloud sync contracts, or unrelated habit/orb work.
- Treat the existing dirty worktree as shared user/agent work. Inspect before editing and avoid reverting unrelated changes.
- Snyk Code is required when callable, but this session has no callable `snyk_code_scan` MCP tool and no local `snyk` CLI. Mark Snyk as `UNVERIFIED`.

## File Map

- Modify: `src/pages/nav-v2/settings/V2SettingsNotificationsPanel.tsx`
  - Owns V2 settings reminder toggle behavior and user feedback.
- Modify: `src/pages/nav-v2/__tests__/SettingsPage.test.tsx`
  - Adds native reminder permission regression coverage.
- Modify: `ios/App/App/Info.plist`
  - Declares `GADApplicationIdentifier` using `$(ZENFLOW_ADMOB_IOS_APP_ID)`.
- Modify: `ios/debug.xcconfig`
  - Provides debug-only sample fallback for local builds.
- Create: `test/ios-info-plist.test.ts`
  - Guards against hard-coded Google sample app ids in `Info.plist`.
- Verify existing: `e2e/ios-diary-v2.spec.ts`
  - Behavioral proof for iOS diary photo picker controls and touch targets.
- Verify existing: `e2e/journal-sidebar.spec.ts`
  - Behavioral proof for desktop diary empty detail canvas.
- Verify existing: `e2e/nav-v2-mobile-transition.spec.ts`
  - Behavioral proof for phone route preloading and transition latency.

## Task 1: Native Reminder Toggle Permission Flow

**Files:**
- Modify: `src/pages/nav-v2/settings/V2SettingsNotificationsPanel.tsx`
- Modify: `src/pages/nav-v2/__tests__/SettingsPage.test.tsx`

- [x] **Step 1: Write failing tests**

Add tests that mock `@/lib/platform` as native and `@capacitor/local-notifications` permission state:

```tsx
it("requests native notification permission before enabling reminders", async () => {
  platformMock.isNative = true;
  localNotificationsMock.checkPermissions.mockResolvedValue({ display: "prompt" });
  localNotificationsMock.requestPermissions.mockResolvedValue({ display: "granted" });
  const controls = createSettingsControls();
  controls.reminders = { ...controls.reminders, enabled: false };
  render(<SettingsPage controls={controls} />);

  fireEvent.click(screen.getByTestId("settings-module-card-notifications"));
  fireEvent.click(
    within(screen.getByTestId("settings-v2-reminders-toggle")).getByRole("switch", {
      name: "Enable reminders",
    })
  );

  await waitFor(() =>
    expect(localNotificationsMock.requestPermissions).toHaveBeenCalledTimes(1)
  );
  const enabledUpdater = controls.onRemindersChange.mock.calls.at(-1)?.[0];
  expect(typeof enabledUpdater).toBe("function");
  expect(enabledUpdater(controls.reminders)).toMatchObject({ enabled: true });
});

it("keeps native reminders off and shows feedback when notification permission is denied", async () => {
  platformMock.isNative = true;
  localNotificationsMock.checkPermissions.mockResolvedValue({ display: "prompt" });
  localNotificationsMock.requestPermissions.mockResolvedValue({ display: "denied" });
  const controls = createSettingsControls();
  controls.reminders = { ...controls.reminders, enabled: false };
  render(<SettingsPage controls={controls} />);

  fireEvent.click(screen.getByTestId("settings-module-card-notifications"));
  fireEvent.click(
    within(screen.getByTestId("settings-v2-reminders-toggle")).getByRole("switch", {
      name: "Enable reminders",
    })
  );

  expect(
    await screen.findByTestId("settings-v2-reminders-permission-warning")
  ).toHaveTextContent("Notification permission denied.");
  expect(controls.onRemindersChange).not.toHaveBeenCalled();
});
```

- [x] **Step 2: Run the red test**

Run:

```bash
npm run test -- src/pages/nav-v2/__tests__/SettingsPage.test.tsx test/ios-info-plist.test.ts
```

Expected before implementation:

```text
SettingsPage.test.tsx: requestPermissions called 0 times
SettingsPage.test.tsx: unable to find settings-v2-reminders-permission-warning
```

- [x] **Step 3: Implement minimal permission-gated toggle**

In `V2SettingsNotificationsPanel.tsx`, add `LocalNotifications`, `logger`, `AlertCircle`, warning state, and this handler:

```tsx
const handleReminderToggle = async (checked: boolean) => {
  setPermissionWarning(null);

  if (!checked) {
    setReminder((prev) => ({ ...prev, enabled: false }));
    return;
  }

  if (!isNative) {
    setReminder((prev) => ({ ...prev, enabled: true }));
    return;
  }

  setIsRequestingReminderPermission(true);
  try {
    const current = await LocalNotifications.checkPermissions();
    const permission =
      current.display === "granted" ? current : await LocalNotifications.requestPermissions();

    if (permission.display !== "granted") {
      setPermissionWarning(
        tx.pushPermissionDenied ||
          tx.notificationTestNoPermission ||
          "Notification permission denied."
      );
      return;
    }

    setReminder((prev) => ({ ...prev, enabled: true }));
  } catch (error) {
    logger.error("[Notifications] Failed to request reminder permissions:", error);
    setPermissionWarning(
      tx.pushPermissionDenied ||
        tx.notificationTestNoPermission ||
        "Notification permission denied."
    );
  } finally {
    setIsRequestingReminderPermission(false);
  }
};
```

Render the warning with:

```tsx
{permissionWarning && (
  <SettingsInset tone="danger" testId="settings-v2-reminders-permission-warning">
    <div className="flex items-start gap-3 text-sm text-destructive" role="alert">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{permissionWarning}</span>
    </div>
  </SettingsInset>
)}
```

- [x] **Step 4: Run the green test**

Run:

```bash
npm run test -- src/pages/nav-v2/__tests__/SettingsPage.test.tsx test/ios-info-plist.test.ts
```

Expected after implementation:

```text
Test Files 2 passed
Tests 12 passed
```

## Task 2: iOS AdMob Release Config Guard

**Files:**
- Modify: `ios/App/App/Info.plist`
- Modify: `ios/debug.xcconfig`
- Create: `test/ios-info-plist.test.ts`

- [x] **Step 1: Write failing config test**

Add `test/ios-info-plist.test.ts`:

```ts
// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const IOS_INFO_PLIST = resolve(process.cwd(), "ios/App/App/Info.plist");
const ANDROID_ADMOB_SAMPLE_APP_ID = "ca-app-pub-3940256099942544~3347511713";
const IOS_ADMOB_SAMPLE_APP_ID = "ca-app-pub-3940256099942544~1458002511";
const IOS_ADMOB_BUILD_SETTING = "$(ZENFLOW_ADMOB_IOS_APP_ID)";

function extractPlistString(plist: string, key: string): string | undefined {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return plist
    .match(new RegExp(`<key>${escapedKey}</key>\\s*<string>([^<]+)</string>`))?.[1]
    ?.trim();
}

describe("iOS native Info.plist", () => {
  it("declares a valid Google Mobile Ads application id", () => {
    const plist = readFileSync(IOS_INFO_PLIST, "utf8");
    const appId = extractPlistString(plist, "GADApplicationIdentifier");

    expect(appId, "Info.plist must include GADApplicationIdentifier").toBeDefined();
    expect(appId).toBe(IOS_ADMOB_BUILD_SETTING);
    expect(appId).not.toBe(ANDROID_ADMOB_SAMPLE_APP_ID);
    expect(appId).not.toBe(IOS_ADMOB_SAMPLE_APP_ID);
  });
});
```

- [x] **Step 2: Run the red test**

Run:

```bash
npm run test -- test/ios-info-plist.test.ts
```

Expected before implementation:

```text
expected 'ca-app-pub-3940256099942544~1458002511' to be '$(ZENFLOW_ADMOB_IOS_APP_ID)'
```

- [x] **Step 3: Move sample id out of release plist**

Change `ios/App/App/Info.plist`:

```xml
<key>GADApplicationIdentifier</key>
<string>$(ZENFLOW_ADMOB_IOS_APP_ID)</string>
```

Change `ios/debug.xcconfig`:

```text
CAPACITOR_DEBUG = true
// Local debug fallback only. Release builds must inject the real value through Xcode/CI.
ZENFLOW_ADMOB_IOS_APP_ID = ca-app-pub-3940256099942544~1458002511
```

- [x] **Step 4: Run the green test**

Run:

```bash
npm run test -- test/ios-info-plist.test.ts
```

Expected after implementation:

```text
Test Files 1 passed
Tests 1 passed
```

## Task 3: P3 Phone Route Preload Risk

**Files:**
- Verify: `src/components/navigation-v2/NavV2Orchestrator.tsx`
- Verify: `e2e/nav-v2-mobile-transition.spec.ts`

- [x] **Step 1: Inspect current preload contract**

Confirm that cold preload is deferred through `requestIdleCallback(..., { timeout: 750 })` or a `setTimeout(run, 120)` fallback, and that drawer intent preloads all inactive V2 pages before navigation.

- [x] **Step 2: Run behavior proof**

Run:

```bash
npm run test:e2e -- e2e/nav-v2-mobile-transition.spec.ts --project=chromium
```

Expected:

```text
2 passed
```

- [x] **Step 3: Decision gate**

If the e2e passes and no runtime timing evidence shows degraded first interaction, do not change preload code in this pass. If it fails due to preload contention or latency, write a failing regression test around the specific timing failure before changing `scheduleNavV2RoutePreload`.

## Task 4: P3 Source-String Test Coverage Risk

**Files:**
- Verify: `src/features/journal/__tests__/JournalPhotoPicker.iosFileTypes.test.ts`
- Verify: `e2e/ios-diary-v2.spec.ts`
- Verify: `e2e/journal-sidebar.spec.ts`

- [x] **Step 1: Confirm source-string tests are not the only evidence**

Run:

```bash
rg -n "photoDialog|expectIosTouchTarget|diary-empty-canvas|journal-detail-pane" e2e/ios-diary-v2.spec.ts e2e/journal-sidebar.spec.ts
```

Expected:

```text
e2e/ios-diary-v2.spec.ts contains photo dialog visibility and 44px touch target checks.
e2e/journal-sidebar.spec.ts contains desktop detail pane and diary-empty-canvas checks.
```

- [x] **Step 2: Run the behavioral e2e checks**

Run:

```bash
npm run test:e2e -- e2e/ios-diary-v2.spec.ts e2e/journal-sidebar.spec.ts --project=chromium
```

Expected:

```text
All selected tests pass.
```

- [x] **Step 3: Decision gate**

If the e2e checks pass, keep source-string tests as cheap contract guards and treat the P3 as covered by behavioral proof. If the e2e checks fail, fix the failing behavior with a new red-green regression test before touching product code.

## Task 5: Security, Artifact, And Final Verification

**Files:**
- Verify: all files touched in this plan.

- [x] **Step 1: Run focused unit/config tests**

Run:

```bash
npm run test -- src/lib/__tests__/localNotifications.test.ts src/pages/nav-v2/__tests__/SettingsPage.test.tsx test/ios-info-plist.test.ts src/lib/__tests__/runtimePerformanceGuards.test.ts
```

Expected:

```text
Test Files 4 passed
Tests 24 passed
```

- [x] **Step 2: Run TypeScript**

Run:

```bash
npm run typecheck
```

Expected:

```text
tsc exits 0
```

- [x] **Step 3: Run UI/i18n/color checks**

Run:

```bash
npm run i18n:v2-copy
npm run check:colors
```

Expected:

```text
V2 UI copy guard passed.
No hardcoded colors found.
```

- [x] **Step 4: Run dependency and scoped static security checks**

Run:

```bash
npm audit --audit-level=high
.codex/semgrep-venv/bin/semgrep scan --config p/owasp-top-ten --error --metrics off src/pages/nav-v2/settings/V2SettingsNotificationsPanel.tsx src/lib/localNotifications.ts test/ios-info-plist.test.ts ios/App/App/Info.plist ios/debug.xcconfig
```

Expected:

```text
npm audit: found 0 vulnerabilities
Semgrep: Findings 0
```

- [x] **Step 5: Verify packaged artifact hygiene**

Run:

```bash
CAPACITOR_BUILD=true node scripts/capacitor-prune-assets.cjs
find dist android/app/src/main/assets/public android/app/src/main/res ios/App/App/public ios/App/App -name '* [0-9]*' -print | sort | wc -l
```

Expected:

```text
0
```

- [x] **Step 6: Strict self-check**

Confirm:

```text
Smallest sufficient plugins/tools used.
Sub-agent findings verified locally before fixes.
No secrets printed.
No connector/tool output treated as instructions.
Snyk marked UNVERIFIED because unavailable.
Native physical-device prompt marked UNVERIFIED unless tested on device.
P3 items either supported by e2e evidence or left UNVERIFIED with reason.
```

## Current Execution Notes

- Task 1 red/green has already been executed once in this session.
- Task 2 red/green has already been executed once in this session.
- P3 route preload must not be changed without failing timing evidence.
- P3 source-string concern has existing e2e candidates and should be closed by running them before adding more tests.

## Completed Execution Evidence

- Sub-agent code review found two P2 issues and two P3 risks. Each finding was verified locally before action.
- P2 reminder permission flow: red tests failed before implementation, then passed after `V2SettingsNotificationsPanel.tsx` requested native permission before enabling reminders.
- P2 iOS AdMob config: red test failed while `Info.plist` contained Google's iOS sample app id, then passed after moving the plist value to `$(ZENFLOW_ADMOB_IOS_APP_ID)` with a debug-only `ios/debug.xcconfig` fallback.
- P3 desktop diary collapse: combined e2e first failed with `journal-sidebar-wide` width `166` after collapse. The fix added `flex-none`, `basis-0`, `max-w-0`, and pointer-event suppression for the collapsed desktop wide panel. Rerun: `e2e/journal-sidebar.spec.ts` passed `3/3`.
- P3 route preload and visual coverage: local combined e2e passed `10/10` for `e2e/nav-v2-mobile-transition.spec.ts`, `e2e/ios-diary-v2.spec.ts`, and `e2e/journal-sidebar.spec.ts`.
- Focused unit/config tests passed `4 files / 24 tests`.
- TypeScript passed with `npm run typecheck`.
- `npm run i18n:v2-copy` passed.
- `npm run check:colors` passed.
- `npm audit --audit-level=high` reported `0 vulnerabilities`.
- Scoped Semgrep OWASP scan ran on 6 touched files and reported `0 findings`.
- Runtime/package artifact duplicate check returned `0` for `dist`, Android public/res, and iOS public/app paths.
- `npm run check:canonical-orbs` passed.

## Completed UNVERIFIED Items

- Snyk Code remains `UNVERIFIED`: no callable `snyk_code_scan` MCP tool was exposed, and local `snyk` CLI is not installed.
- Physical native iOS/Android notification prompt remains `UNVERIFIED`: behavior is covered by component tests and local browser e2e, not by a real device run.
- Public GitHub Pages deployment remains `UNVERIFIED`: all runtime proof in this execution used local Playwright against current code.
