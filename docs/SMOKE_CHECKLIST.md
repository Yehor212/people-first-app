# Smoke Checklist

Run this before publishing a release.

## Setup
- `npm install`
- `npm run build`
- `npx cap sync`

## Core flows
- Onboarding completes and sets reminders when enabled.
- Home tab loads with no errors on first run.
- Stats tab renders charts for empty and populated data.
- Settings: name change persists after refresh.

## Reminders
- Enable reminders and verify local notification permission prompt on device.
- Confirm reminders do not schedule inside quiet hours.
- Confirm reminder cards appear in-app at the right time.

## Data safety
- Export data and re-import in merge mode (no crash).
- Import in replace mode (data resets as expected).
- Reset all data clears moods/habits/focus/gratitude.

## Offline/PWA
- PWA install prompt appears (where supported).
- App starts offline and core screens render.
- Service worker update does not break startup.

## Account/Sync (if configured)
- Magic link sign-in works and sync completes.
- Sign out clears session without errors.
