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
- Verify stale service worker recovery after a new deploy.
- Run cold-start and steady-state route smoke for V1/V2 phone and desktop.
- Open the public URL with a cache-buster and confirm the deployed behavior.
- Validate manifest icons and start URL.
- Run Lighthouse PWA audit.

## iOS
- Build in Xcode.
- Verify first render in WKWebView with no visual downgrade.
- Verify app background -> foreground sync does not duplicate or lose actions.
- Verify notifications permission prompt.
- Check background launch and deep links.
- Archive and upload to App Store Connect.

## Android
- Build signed AAB.
- Verify first render in Android WebView with no visual downgrade.
- Verify pause -> resume sync and Android back behavior on V2 routes.
- Verify notifications permission prompt (Android 13+).
- Test on at least one physical device.
- Upload to Play Console.

## Desktop and Phone Runtime
- Verify phone layout and desktop layout for touched V1/V2 routes.
- Confirm sidebar, drawer, and bottom navigation preserve the same destination behavior.
- Confirm canonical full orbs use `ValenceOrb` and mini-orbs use `MiniValenceOrb`.
- Confirm no route exceeds the agreed Chrome long-task budget.
- Confirm scrollability, safe areas, focus, and reduced-motion behavior for touched screens.

## Sync and Data Convergence
- Run `npm run check:sync-contract`.
- Run `npm run smoke:telegram-sync-drill`; if it is `PARTIAL`, name every missing browser, account, native, or public proof before release.
- Confirm the GitHub Actions `telegram-sync-drill` artifact exists for the release commit and was produced from the freshly built preview.
- Review `docs/ai/TELEGRAM_GRADE_SYNC_100_PERCENT_CLOSURE.md` and mark every applicable entity/platform row with evidence.
- For deployed sync investigations, run `npm run smoke:sync-health` with `ZENFLOW_SYNC_HEALTH_URL` set to the public cache-busted route, or enable `?syncHealth=1` and inspect `window.__zenflowSyncHealth.snapshot()`; confirm it exposes only route/auth/online/queue/cursor/receipt metadata.
- Verify latest user action wins after V1 -> V2 -> V1 navigation for changed entities.
- Verify two active tabs converge after a remote or local change.
- Verify offline action queues and applies after reconnect.
- Verify delete tombstones prevent stale backup, stale IndexedDB, or delayed pull resurrection.
- Verify public-user sync claims against the deployed URL, not only local preview.
- Verify logout/account switch cannot replay previous-account queued actions into the next account.

## Store listing
- App name, subtitle, description.
- Screenshots for all required sizes.
- Privacy policy URL.
- Support email and contact URL.

## Final QA
- Run `docs/SMOKE_CHECKLIST.md`.
- Fresh install test (no cached data).
- Upgrade test from previous build.
- Attach a Done Packet from `docs/ai/TASK_COMPLETION_PROTOCOL.md` with all
  release-critical rows marked `PASS` or explicitly `WAIVED`; anything blocked
  stays `UNVERIFIED` and must not be described as shipped confidence.
