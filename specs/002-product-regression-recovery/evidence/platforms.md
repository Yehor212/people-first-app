# Platform Evidence: Epic 002 Candidate

**Captured**: 2026-08-04T04:26:03Z
**Candidate**: current working tree on `codex/002-product-regression-recovery`; final staged identity is pending

| Platform / surface | Fresh evidence | Status | Boundary and next proof |
| --- | --- | --- | --- |
| Web/Vite | Production build, manifest/hash validation, PDI bundle, duplicate check, bundle budgets | `PASS` for local build | Authenticated recovery UI and real incompatible encrypted rows remain `UNVERIFIED` |
| Web phone/desktop | Strict local Chrome smoke over 14 route/profile rows; no console/network/response diagnostics | `PASS` for unauthenticated production-equivalent routes | See `browser.md`; this is not the public branch deployment |
| Installed PWA/offline | Chromium service-worker offline boot and WebKit route/install-metadata row executed | `2 PASS`, `2 SKIP` | User-installed update activation, background resume, and real removal replay remain `UNVERIFIED` |
| Android shared layer | `npm run build:android` exit `0`; capability disabled; duplicate verification passed | `PASS` for shared web layer only | APK/Gradle, emulator/device, biometric cleanup, process death, Back, TalkBack, display/font scale, and 48dp measurement remain `UNVERIFIED` |
| iOS shared layer | `npm run build:ios` exit `0`; capability disabled; duplicate verification passed | `PASS` for shared web layer only | Xcode/simulator/device, WKWebView lifecycle, Keychain/biometric, VoiceOver, and Dynamic Type remain `UNVERIFIED` |
| Desktop/Tauri web layer | `npm run build:tauri` exit `0`; capability disabled; duplicate verification passed | `PASS` for shared web layer only | No packaged application or Windows runtime proof |
| Desktop/Tauri toolchain | `desktop:check` completed source contract `115/115`, then exited `1` because Windows `link.exe`/MSVC is unavailable on macOS | `FAIL` for requested Windows toolchain | Packaged Windows/Tauri smoke remains `UNVERIFIED` |
| Supabase/PostgreSQL | One forward-only password-removal migration, hand-reconciled generated types, static ordering/isolation/parser/sync tests | Source/static `PASS` only | Canonical type regeneration plus authorized non-production migration, RLS, Storage, locking, old/new-client, and recovery exercise are required before rollout |
| Accessibility | Shared modal stack, inert background, one live-region owner, connected focus fallback, idle Escape/topmost Android Back, RTL copy, 48px targets covered by tests/source | Automated local scope only | Native AT, physical Back, zoom/reflow/forced colors, and qualified human review remain `UNVERIFIED` |
| Store/release | No merge, signed binary, store upload, or branch deployment | `UNVERIFIED` | Requires exact-head CI and separately authorized release |

The successful target builds prove only shared web packaging. The macOS-hosted Windows toolchain failure remains a recorded FAIL even though it is not caused by Epic 002. No row uses mock production records or fabricated user history.
