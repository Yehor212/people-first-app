# Release Checklist

Use this list before publishing on stores or web.

## Versioning
- Update `package.json` version.
- Update in-app version label if shown.
- Update Android `versionName` and `versionCode`.
- Tag release in git.

## Build
- `npm install`
- `npm run build`
- `npx cap sync`

## Web/PWA
- Verify service worker update flow.
- Validate manifest icons and start URL.
- Run Lighthouse PWA audit.

## iOS
- Build in Xcode.
- Verify notifications permission prompt.
- Check background launch and deep links.
- Archive and upload to App Store Connect.

## Android
- Build signed AAB.
- Verify notifications permission prompt (Android 13+).
- Test on at least one physical device.
- Upload to Play Console.

## Store listing
- App name, subtitle, description.
- Screenshots for all required sizes.
- Privacy policy URL.
- Support email and contact URL.

## Final QA
- Run `docs/SMOKE_CHECKLIST.md`.
- Fresh install test (no cached data).
- Upgrade test from previous build.
