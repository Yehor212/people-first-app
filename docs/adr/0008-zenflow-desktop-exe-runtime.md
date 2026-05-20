# ADR 0008: ZenFlow Desktop EXE Runtime

## Status

Accepted.

## Context

ZenFlow users can experience lag in their personal Chrome environment even when
the same build performs better in other browsers or devices. The project also
has strict product invariants: canonical WebGL orbs cannot be visually replaced,
V1/V2 sync semantics must stay Telegram-grade, and public web/PWA/native builds
cannot regress.

Telegram Desktop demonstrates a product-level reason for a dedicated desktop
runtime: a controlled app shell can avoid user-browser variables while keeping
fast local state and ordered sync semantics. ZenFlow should adopt the principle,
not Telegram's code.

## Decision

Introduce a Windows-first desktop `.exe` path using Tauri 2 and WebView2.

The desktop shell:

- builds from the same Vite/React app;
- disables PWA service worker for the bundled desktop artifact;
- uses relative assets through `VITE_APP_BASE=./`;
- keeps the same canonical orb components and sync runtime;
- starts with least-privilege Tauri capabilities;
- requires signed updater and code-signing proof before public distribution.

## Alternatives Considered

### Keep Chrome-only web delivery

Rejected for desktop users who have lag caused by profile extensions, stale
service workers, GPU-process state, or browser memory pressure outside ZenFlow.

### Electron

Viable, but rejected for the first desktop pass because it bundles Chromium and
increases artifact size and maintenance surface. Tauri/WebView2 gives a smaller
Windows-first shell while still requiring the same performance proof.

### Rewrite visuals for performance

Rejected. The canonical orb invariant forbids replacing the product visuals with
cheaper approximations.

### Native desktop rewrite

Rejected for now. It would fork product logic, sync, localization, and visual
behavior across platforms. The first desktop release must preserve one product
codebase.

## Consequences

- Desktop is now a first-class platform in runtime and release checks.
- Web, PWA, Android, and iOS scripts remain separate and must not depend on
  Tauri.
- Desktop performance claims require WebView2/Tauri proof, not only Chrome web
  proof.
- Public release requires signing/updater infrastructure that cannot be fully
  completed inside source code alone.
- Unsigned artifacts are development proof only. `npm run desktop:release:check`
  must fail until Authenticode signatures are valid; use
  `npm run desktop:release:check:dev` only for local build evidence.
- Windows `.exe` build proof requires Visual Studio Build Tools with the
  Desktop development with C++ workload. Desktop scripts load that environment
  through `scripts/run-with-msvc.cjs`; source-only scaffold proof is not a
  packaged release.

## Verification

- `npm run check:desktop-exe-contract`
- `npm run desktop:check`
- `npm run desktop:release:check:dev` for local unsigned build evidence
- `npm run desktop:sign` and `npm run desktop:release:check` for public release
- `npm run check:canonical-orbs`
- `npm run check:sync-contract`
- `npm run smoke:chrome-performance`
- Desktop packaged/debug trace before any public `.exe` claim.
