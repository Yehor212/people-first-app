# UI Lifecycle Contract: PWA Shell Lifecycle

## Ownership

`src/main.tsx` initializes the Web/PWA shell owner before React mounts. `src/lib/pwaShellRuntime.ts` exposes `AppRuntimeSurface = "browser" | "installed-pwa" | "capacitor" | "tauri"`. `src/lib/pwaInstallOwner.ts` owns deferred-install events and exposes the exact `PwaInstallState` union. `src/lib/pwaUpdateLifecycle.ts` exposes the exact `PwaUpdatePhase` union and owns waiting update state, writer barrier, and reload deduplication. Settings and overlay surfaces are consumers only; `ModalLayer`/`OverlayLayer` remain the only modal owners when an update prompt requires a blocking presentation.

## Install contract

| Event/state | Required visible result | Prohibited result |
| --- | --- | --- |
| app start on eligible Chromium Web/PWA | Owner listens before Settings and can later expose `promptable`. | A banner that appears without user navigation or a lost prompt because Settings was absent. |
| `beforeinstallprompt` | Prevent browser default, retain opaque event in memory, publish `promptable`. | Persist event, log event internals, or mark installed. |
| Settings opens after capture | A user-initiated Settings action can prompt once. | New independent listeners or duplicate prompts. |
| accepted action outcome | Consume the opaque event, return the action outcome, and await `appinstalled` for confirmed `installed`; until then expose no invented installed state. | Treat `accepted` as a `PwaInstallState` or durable installation proof. |
| dismissed/error | Publish a distinguishable outcome and retain/release only according to browser event validity. | Claim installation or show success haptic/copy. |
| Safari-like Web runtime without prompt | Present localized manual instruction only on explicit Settings entry. | `canInstall=true`, automatic banner, or Chromium wording. |
| standalone | Publish `installed`; hide install action. | Manual-install or prompt affordance. |

## Update contract

```text
idle -> waiting -> (user chooses update) -> preparing
preparing -> blocked (writer rejects, cancels, or times out)
preparing -> activating (all registered writers settle successfully)
activating -> [controller confirmation] -> [one guarded reload]
waiting -> idle (user defers noncritical update)
any state -> error (untrusted message, missing worker, worker disappears, or activation error)
```

- Enter `waiting` only from a trusted same-origin worker/registration observation.
- `preparing` closes registration for this attempt, coordinates open tabs, and uses a documented finite timeout across journal, habit, mood, settings, offline queue, and future registered writers.
- Only `activating` may send the explicit `SKIP_WAITING`-replacement command to a verified waiting worker.
- Only a matching controller-change may produce the single guarded reload; duplicate update messages, button presses, or chunk errors are ignored/deduplicated while an attempt is active.
- Stale-chunk recovery calls this same transition machine. It cannot call `location.reload`, cache cleanup, or activation directly.
- Writer callbacks report completion category only; neither their values nor user content are logged or diagnosed. Rejection/timeout leaves a readable recovery draft/status and zero reloads.

## Cache and diagnostics contract

- Worker cleanup can delete a key only if the fixed ZenFlow ownership predicate accepts it. The contract test must create an unrelated same-origin key and prove it survives.
- Cache cleanup errors do not broaden selection; they transition recovery to a visible failure/retry state.
- `sanitizeLifecycleRoute(location)` returns a base-path-validated pathname token. Query, hash, username, password, OAuth parameters, opaque IDs, and raw URL strings are excluded.
- Trusted service-worker messages retain the existing origin and `scriptURL` checks. Unknown types have no state effect.

## Accessibility, localization, and layout contract

- Install/update actions and offline retry controls have accessible names, visible focus, keyboard activation, and at least 44px target size.
- The offline page has one main landmark, language identifier, `dir="rtl"` for Arabic/Hebrew, and a motion-free presentation under reduced motion.
- Manual Safari help and update/blocked copy must use parity keys across `en`, `uk`, `es`, `de`, `fr`, `ja`, `ar`, and `he`; text is not concatenated from fragments.
- Phone layout honors safe areas; desktop does not introduce a mobile-only full-screen overlay; Android back applies if the existing overlay path is used.

## Platform boundary

| Runtime | Contract result |
| --- | --- |
| Web/Vite | Resolves `browser`; may expose browser capability, but no installed claim without browser evidence. Firefox receives Web/offline fallback with no synthetic install prompt. |
| Installed PWA | Resolves `installed-pwa`; may own update/cache lifecycle and is the primary runtime test target. |
| Android/Capacitor | Resolves `capacitor`; no service-worker install/update/cache owner action. |
| iOS/WKWebView | Resolves `capacitor`; no web service-worker action. Safari Home Screen separately resolves `installed-pwa`. |
| Desktop/Tauri | Resolves `tauri`; no service-worker action. |
