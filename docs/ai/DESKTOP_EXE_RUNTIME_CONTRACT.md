# ZenFlow Desktop EXE Runtime Contract

Purpose: define the finished desktop `.exe` path for ZenFlow without changing
the web, PWA, Android, iOS, or canonical orb product experience.

This document must be read before desktop runtime, startup performance,
WebView2, packaging, installer, updater, telemetry, sync, storage, or security
work. It extends `docs/ai/TELEGRAM_GRADE_RUNTIME_CONTRACT.md`,
`docs/ai/CANONICAL_ORB_INVARIANT.md`, and
`docs/ai/TASK_COMPLETION_PROTOCOL.md`.

## Decision

ZenFlow desktop uses a dedicated Tauri 2 shell on Windows first, with Microsoft
Edge WebView2 as the renderer. The desktop app loads the same React/Vite
application and the same sync/orb contracts as the public web app, but it runs
inside a controlled desktop runtime instead of the user's open Chrome profile.

Desktop is not a visual fork. It is a runtime shell.

The public web route `/desktop` is the **Desktop Dock**: a safe user-facing
download page for the Windows build. It may describe the desktop runtime and
link to the web app or GitHub Releases, but it must not expose an unsigned EXE
or installer. Its primary download action stays locked until
`npm run desktop:release:check` passes on signed artifacts.

## Why This Exists

The browser can lag for reasons ZenFlow does not control: extensions, old
profiles, too many tabs, throttled GPU process, stale service workers, browser
flags, and background memory pressure. A desktop shell reduces those variables
and lets release QA target a stable WebView2 runtime.

This does not remove the need for performance proof. WebView2 is still a browser
engine, so every desktop performance claim needs cold-start, steady-state, and
interaction evidence.

## Non-Negotiables

1. **Canonical visuals stay frozen.**
   - Full orbs remain `ValenceOrb`.
   - Mini orbs remain `MiniValenceOrb`.
   - No CSS-only, SVG, Lottie, icon, static, or alternate canvas orb systems.
   - `npm run check:canonical-orbs` is required for desktop releases.

2. **Desktop is a separate build path.**
   - `npm run build`, GitHub Pages, PWA, Android, and iOS scripts must keep
     their current behavior.
   - Desktop build uses `VITE_APP_BASE=./` and `VITE_DISABLE_PWA=true` so the
     bundled app uses relative assets and does not install a web service worker.

3. **No secrets in the executable.**
   - Supabase service-role keys, GitHub tokens, Sentry auth tokens, signing
     keys, and updater private keys are never bundled.
   - Public anon keys may be present only when already safe for the web client.

4. **Same sync semantics as web.**
   - `sync_events.seq` remains the ordering authority.
   - Tombstones beat stale payloads.
   - Offline queue, gap recovery, account boundaries, and device sessions use
     the same contracts as V1/V2 web.

5. **Performance fixes cannot change product canon.**
   - If a desktop machine is slow, optimize startup order, workerization,
     scheduling, asset loading, route chunking, and diagnostics.
   - Do not downgrade canonical orbs or remove the night background to pass a
     metric.

6. **Desktop permissions are least-privilege.**
   - Start with `core:default` only.
   - File system, shell, process, updater, notifications, deep links, and global
     shortcuts require separate product/security review before being enabled.

7. **Signed updater is required before public desktop release.**
   - Unsigned local `.exe` proof may validate runtime, but public distribution
     requires code signing and signed updater artifacts.
   - `npm run desktop:release:check:dev` is a local-development waiver only.
   - `npm run desktop:release:check` must pass before telling users to install
     a Windows artifact.

## Runtime Model

Desktop boot order:

1. WebView2 opens the local bundled `dist` shell.
2. Theme, language, safe areas, route shell, and error boundary paint first.
3. Visible route data hydrates.
4. Canonical WebGL orbs initialize through the existing renderer lifecycle.
5. Sync runtime wakes after first paint and uses the same leader/gap/outbox
   rules as web.
6. Non-critical diagnostics, cache warming, exports, charts, and optional
   reports stay deferred.

Desktop should not run the public PWA service worker. A stale service worker can
hide desktop runtime bugs and mix old web assets with a new executable shell.

## Performance Proof

A desktop performance claim is `PASS` only with fresh evidence from the final
tree or release artifact:

- `npm run check:desktop-exe-contract`
- `npm run check:canonical-orbs`
- `npm run check:sync-contract`
- `npm run smoke:chrome-performance` for web parity
- desktop smoke trace on the packaged/debug Tauri app:
  - cold start;
  - first visible route;
  - V2 `/orb` phone and desktop layout;
  - V1 home with portal;
  - diary route;
  - at least one interaction with the mood slider;
  - no visible non-canonical orb during boot.

If desktop trace tooling is unavailable, mark desktop performance `UNVERIFIED`.

## Security Proof

Desktop security is `PASS` only when the final artifact proves:

- no server-only secrets are present in source, bundle, or logs;
- CSP is defined and does not allow arbitrary script execution;
- Tauri capabilities stay least-privilege;
- updater private key is not committed;
- diagnostics do not record journal text, habit names, payloads, entity IDs, raw
  browser fingerprints, IP addresses, or account tokens;
- Supabase RLS remains the account boundary.

## Release Proof

Public desktop release is not complete until all rows are true or explicitly
marked `WAIVED`:

| Requirement | Required evidence |
| --- | --- |
| Windows EXE builds | `npm run desktop:build` or CI artifact |
| Code signing | certificate-backed signed installer proof |
| Updater signing | Tauri updater public key in config and private key kept out of repo |
| Canonical visuals | desktop screenshots plus `npm run check:canonical-orbs` |
| Sync parity | `npm run smoke:telegram-sync-drill` and account proof |
| Runtime parity | web/PWA/Android/iOS unchanged or marked `UNVERIFIED` |
| Security | Snyk/repo security scan for touched code and no committed secrets |
| Desktop Dock | `/desktop` screenshot, disabled unsigned download state, and signed-release link only after `npm run desktop:release:check` |

## Release Commands

Use these commands in order for Windows desktop evidence:

1. `npm run desktop:check`
   - Confirms the desktop contract, Rust/Cargo, WebView2/Tauri visibility, and
     MSVC linker availability through `scripts/run-with-msvc.cjs`.
2. `npm run desktop:build`
   - Produces the local Windows `.exe` and NSIS installer artifacts.
3. `npm run desktop:release:check:dev`
   - Development-only proof. It records artifact size, SHA-256 hashes,
     Authenticode status, secret-scan status, least-privilege permissions, and
     confirms desktop builds with `VITE_DISABLE_PWA=true`.
   - This command may pass unsigned artifacts only because it uses
     `--allow-unsigned-dev`; it is not public release proof.
4. `npm run desktop:sign`
   - Signs built artifacts from environment-provided secrets only:
     `ZENFLOW_WINDOWS_CERT_PFX_BASE64`, `ZENFLOW_WINDOWS_CERT_PASSWORD`, and
     optional `ZENFLOW_WINDOWS_TIMESTAMP_URL`.
   - The signing certificate must be a trusted release certificate. Do not
     commit PFX files, private keys, passwords, or generated signing material.
5. `npm run desktop:release:check`
   - Public release proof. It must report Valid Authenticode signatures for the
     app executable and installer. If it fails with `NotSigned`, the artifact is
     not ready for users.

If updater support is added, its private key stays outside the repository and
the updater public key/config must be verified by this same release gate before
the app is described as auto-updating.

## Required Windows Toolchain

Desktop source work can be reviewed without a compiler, but `.exe` build proof
requires:

- Microsoft Edge WebView2 runtime;
- Rust stable MSVC toolchain;
- Visual Studio Build Tools with the `Desktop development with C++` workload;
- `scripts/run-with-msvc.cjs` able to load `VsDevCmd.bat` through `vswhere.exe`
  or a known Build Tools path;
- `npm run desktop:check` green before `npm run desktop:build`.

If any row is missing, desktop packaging stays `UNVERIFIED`. Do not describe the
Windows `.exe` as shipped or complete from source-only proof.

## Sources

- Tauri 2 getting started and app model: https://v2.tauri.app/start/
- Tauri 2 configuration reference: https://v2.tauri.app/reference/config/
- Tauri 2 capabilities and permissions: https://v2.tauri.app/security/capabilities/
- Tauri updater signing: https://v2.tauri.app/plugin/updater/
- Microsoft WebView2 performance guidance:
  https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/performance
- Telegram Desktop source reference:
  https://github.com/telegramdesktop/tdesktop
