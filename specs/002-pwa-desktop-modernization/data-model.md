# Data Model: Installed PWA Modernization

This feature adds no production database table, IndexedDB store, migration, analytics event, or user-data field. The model below defines transient runtime state and private verification evidence only.

## Install Capability

```ts
type PwaInstallKind =
  | "installed"
  | "prompt"
  | "macos-safari-manual"
  | "unavailable";

interface PwaInstallCapability {
  kind: PwaInstallKind;
}
```

Invariants:

- `installed` wins over every install offer.
- `prompt` exists only while a validated, unconsumed browser event is held in memory.
- Page-lifetime capture owns the prompt; opening or closing a lazy Settings consumer does not discard it.
- `macos-safari-manual` is allowed only outside standalone mode on macOS Safari.
- Capacitor and Tauri desktop runtimes always resolve to `unavailable`; browser-install events are neither captured nor consumed there.
- `unavailable` never exposes a fake install action.
- No account, journal, habit, mood, device ID, token, or contact value is part of the object.

Transitions:

```text
unavailable -> prompt                  browser emits beforeinstallprompt
prompt -> unavailable                  user accepts; the one-shot prompt is consumed
prompt -> unavailable                  user dismisses or prompt throws
macos-safari-manual -> installed       occurs only in the separately launched web app
any -> installed                       appinstalled fires or runtime reports standalone
```

## Manifest Install Contract

```ts
interface PwaManifestContract {
  id: string;
  startUrl: string;
  scope: string;
  display: "standalone";
  orientation?: never;
  shortcuts: Array<{
    name: string;
    url: string;
    icon: string;
  }>;
  maskableIcons: Array<{
    size: "512x512" | "1024x1024";
    src: string;
  }>;
}
```

Invariants:

- `id`, `startUrl`, `scope`, and every shortcut URL remain under `/people-first-app/`.
- Shortcut URLs contain `nav=v2` and do not contain `navLayout`, auth callback values, development flags, or token fragments.
- Source/build/public/docs manifest representations remain behaviorally equivalent.
- The description states bounded offline support and does not claim that every feature works offline.
- Icon URLs carry the reviewed install-icon revision.

## Offline Recovery State

```ts
type OfflineRecoveryState =
  | { kind: "app-shell" }
  | { kind: "offline-document"; locale: SupportedLocale; direction: "ltr" | "rtl" }
  | { kind: "unrecoverable"; reason: "missing-precache" | "worker-unavailable" };
```

Invariants:

- The app shell is preferred when available.
- The standalone document is a degraded state, not proof that a user action is stored or syncable.
- Locale accepts only `en`, `uk`, `es`, `de`, `fr`, `ja`, `ar`, or `he`; malformed or non-string stored values fall back to `en`, while absent storage may use a supported browser locale before falling back to `en`.
- Arabic and Hebrew set `dir=rtl`; all other supported locales set `dir=ltr`.

## Verification Evidence

The private evidence record is validated by `contracts/pwa-evidence.schema.json` and may be stored under ignored `output/` or `artifacts/` paths. It is not production runtime data.

Invariants:

- Result is exactly `PASS`, `FAIL`, `N/A`, or `UNVERIFIED`.
- Base subject commit, deterministic candidate-state SHA-256, and environment are required so an uncommitted isolated worktree is not misrepresented as the clean base commit.
- Candidate-state hashing uses the exact byte-level algorithm in `quickstart.md`; ignored evidence output is excluded.
- A `PASS` requires a command or runtime artifact locator and SHA-256.
- Screenshots use empty/local synthetic test state and contain no real user data.
- `UNVERIFIED` includes the missing environment or authority, never a blank reason.
