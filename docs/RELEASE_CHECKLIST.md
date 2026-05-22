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
- `npm run cap:sync:ios`

## Web/PWA
- Verify service worker update flow.
- Verify stale service worker recovery after a new deploy.
- Run cold-start and steady-state route smoke for V1/V2 phone and desktop.
- Open the public URL with a cache-buster and confirm the deployed behavior.
- Validate manifest icons and start URL.
- Run Lighthouse PWA audit.

## iOS
- Run the GitHub Actions `ios-gate` job or locally run `npm run cap:sync:ios`
  and build `ios/App/App.xcodeproj` for an iOS simulator.
- Confirm `ios/App/CapApp-SPM/Package.swift` uses POSIX `/` paths after sync.
- Confirm iOS `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` match the
  Android/package release version before store submission.
- Build in Xcode when preparing an App Store release.
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

## Desktop EXE
- Read `docs/ai/DESKTOP_EXE_RUNTIME_CONTRACT.md`.
- If publishing through Microsoft Store, read `docs/ai/MICROSOFT_STORE_MSIX_CONTRACT.md`.
- Run `npm run check:desktop-exe-contract`.
- Run `npm run desktop:store:package` when preparing the Store `Packages` tab.
- Run `npm run desktop:store:check` for any Microsoft Store/MSIX claim.
- Run `npm run desktop:check`.
- Confirm Visual Studio Build Tools with the `Desktop development with C++`
  workload is installed and loadable through `scripts/run-with-msvc.cjs`.
- Build the Windows artifact with `npm run desktop:build` before any public `.exe` claim.
- Verify `/desktop` renders the Desktop Dock in phone and desktop layouts.
- Confirm `/desktop` keeps public download disabled until `npm run desktop:release:check` passes on signed artifacts.
- For local development evidence, run `npm run desktop:release:check:dev` and
  keep its unsigned-artifact warning in the Done Packet.
- For public desktop distribution, run `npm run desktop:sign` from a trusted
  release runner with certificate secrets provided through environment
  variables, then run `npm run desktop:release:check`.
- Verify the packaged/debug app cold-starts without a non-canonical orb flash.
- Verify V2 `/orb`, V1 home, diary, habits, and settings in phone and desktop layouts.
- Confirm the desktop build uses relative assets and does not register the web PWA service worker.
- Confirm the signed updater public key is present only when the private key is kept out of repo.
- Confirm code signing status is `Valid`; unsigned local artifacts are development proof only.
- Confirm no Supabase service-role key, signing key, GitHub token, Sentry auth token, or test-account password is bundled.

## Microsoft Store / MSIX
- Confirm Partner Center product id is `9MZK46FHZV8K`.
- Open `Apps and games > ZenFlow > Product management > Product Identity` and
  confirm exact package identity values match
  `docs/release/microsoft-store/product-identity.public.json`.
- Do not purchase, submit, publish, or change pricing without explicit approval.
- Keep `docs/release/microsoft-store/identity.template.json` as a placeholder
  template; keep `product-identity.public.json` limited to public Store package
  metadata; never commit a private certificate, PFX base64, password, Store
  credential, or service-role key.
- Use either MSIX Packaging Tool conversion, manual MakeAppx packaging, or the
  repo generator `npm run desktop:store:package`; do not claim Store-ready from
  NSIS output alone for this `MSIX or PWA app` product path.
- Upload `tmp/microsoft-store-msix/ZenFlow_1.7.3.0_x64.msixupload` only after
  `desktop:store:package` succeeds, then capture Partner Center accepted-package
  proof and package-language proof.
- For Store MSIX, Microsoft handles package signing after certification. Direct
  EXE/NSIS distribution remains separate and requires Authenticode signing.
- Run Windows App Certification Kit or record Partner Center certification proof
  before claiming certification readiness.

## Sync and Data Convergence
- Run `npm run check:sync-contract`.
- Run `npm run check:github-sync-secrets`; missing `ZENFLOW_SYNC_TEST_EMAIL` or `ZENFLOW_SYNC_TEST_PASSWORD` means same-account sync remains `UNVERIFIED`.
- If the dedicated sync test account or GitHub secrets are missing, provision
  them from a trusted admin shell with `npm run setup:sync-test-account`; never
  commit or print the password/service-role key.
- Run `npm run smoke:telegram-sync-drill`; if it is `PARTIAL`, name every missing browser, account, native, or public proof before release.
- Confirm the GitHub Actions `telegram-sync-drill` artifact exists for the release commit and was produced from the freshly built preview.
- Review `docs/ai/TELEGRAM_GRADE_SYNC_100_PERCENT_CLOSURE.md` and mark every applicable entity/platform row with evidence.
- Review `docs/ai/TELEGRAM_GRADE_20_IDEA_LEDGER.md` and include every touched product-control row in the Done Packet.
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
