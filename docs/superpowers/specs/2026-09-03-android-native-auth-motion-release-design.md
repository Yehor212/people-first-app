# Android Auth Return, Fade-Through, And Release Closure Design

**Status:** Approved for implementation on 2026-09-03

**Related feature:** `specs/003-japanese-audio-theme/`

## Goal

Make Telegram authentication started from the installed Android app return to
the same `com.zenflow.app` activity and V2 shell as native Google sign-in,
replace the remaining abrupt light/dark palette jump with a bounded Android
fade-through, and close the technical gates for the exact ten-master music
build without weakening PKCE, canonical visuals, production-data integrity, or
release provenance.

## Fresh Failure Evidence

- The source and installed APK are byte-identical at SHA-256
  `27023c8605f573119cd02583856330aaef4b2a0056bddbfa8629df264b4351cf`,
  package `com.zenflow.app`, version `2.1.2`, versionCode `39`.
- Android MCP opened Telegram in Chrome Custom Tabs. The live Telegram
  authorization request contained `redirect_to=com.zenflow.app://login-callback`
  plus the `zenflowAuthAttempt` query selector.
- Android package resolution admits that exact scheme, host, and query shape to
  `com.zenflow.app/.MainActivity`.
- A completed Telegram OIDC flow nevertheless ended at
  `https://yehor212.github.io/people-first-app/`; the native app remained on
  account entry. This localizes the defect to hosted redirect admission/return,
  not the Telegram button or Android intent filter.
- The repository allow-list bootstrap covers a native `journalReset=*` query,
  while its ordinary native OAuth check accepts only the unparameterized
  callback. It does not prove admission of `zenflowAuthAttempt=*`.
- The current theme coordinator inserts an old-palette veil at opacity `0.46`,
  commits the new palette immediately, and only fades the veil out. The first
  presented post-click frame therefore exposes a large palette delta instead of
  fading the old interface out first.

## Explicit Requirements

1. Telegram sign-in must finish inside the installed Android app, not in the
   GitHub Pages/PWA copy.
2. Telegram and Google must reach the same authenticated V2 product shell while
   retaining their provider-specific initiation mechanisms.
3. Google native, upload-signer, and Play App Signing gates must remain distinct.
4. The ten local first-party music masters must stay in the build and be
   technically verified without mock, demo, sample, or fallback runtime data.
5. Light/dark switching must feel soft and continuous and follow Android frame
   and motion guidance without changing accepted ZenFlow pixels.
6. All repository work uses the one already-authorized locked Codex lane and
   reaches `main` only through the repository's exact-tip PR handoff.

## Chosen Auth Architecture

The app keeps its existing PKCE attempt ownership. The production redirect
allow-list gains the narrow pattern:

```text
com.zenflow.app://login-callback?zenflowAuthAttempt=*
```

The unparameterized callback remains for compatibility and the separate
`journalReset=*` form remains for journal recovery. The apply script must merge
the required patterns with unrelated existing redirect URLs, never replace the
complete list, and must read the hosted configuration back after applying.

A dedicated `workflow_dispatch` workflow applies only the native OAuth redirect
contract. It runs only from `main`, requires an exact confirmation phrase, uses
the existing repository `SUPABASE_ACCESS_TOKEN` secret and
`SUPABASE_PROJECT_REF` variable, grants only `contents: read`, and prints counts
and statuses rather than redirect inventories or credentials.

The Telegram live checker must no longer equate provider discovery and an
authorization redirect with completed native return. Static/provider checks,
hosted allow-list readback, completed OIDC, native callback reception, session
exchange, account-owner admission, Custom Tab closure, and post-auth destination
are separate gates.

## Rejected Auth Alternatives

- Removing `zenflowAuthAttempt` is rejected because it would weaken the existing
  confused-deputy and concurrent-attempt boundary.
- An unrestricted `com.zenflow.app://**` allow-list is rejected because the
  login callback can be admitted with a narrower host/query contract.
- Universal/App Links are deferred. They are the preferred future transport,
  but `https://zenflow.app/.well-known/assetlinks.json` currently returns 404
  and the upload/Play certificate set is not yet completely verified.
- Detecting the GitHub Pages fallback and launching the app from the PWA is
  rejected as a symptom workaround that leaves Supabase misconfigured.

## Chosen Theme Architecture

The store remains the only theme authority and persists the requested
preference before visual mutation. All platforms use the same single CSS
fade-through veil: 96 ms into the outgoing background, one atomic palette
commit at the midpoint, and 180 ms to reveal the incoming frame. Reduced motion
commits synchronously, rapid requests remain latest-request-wins, and a
persistence failure performs no visual transition.

The tested native decor, WebView-visibility, hardware-layer, and separate-window
variants are rejected. Exact emulator traces showed that they remained coupled
to the same Activity/WebView draw or added another costly surface; none met the
frame or tile-memory gate. Their source and tests are absent from the selected
implementation.

The retained CSS path suppresses palette interpolation only on the existing
surface selectors and on `button` elements while the atomic handoff class is
active. Buttons keep `transform` and `opacity` as eligible properties, so press
feedback remains available; background, border, color, and shadow transitions
do not fan out during the root-token commit. A runtime animation probe measured
about 140 active animations after midpoint before this rule, including 124
button/theme-choice transitions. The narrow rule removed those palette
animations while leaving the steady Settings backdrop animations and canonical
Orb behavior untouched.

Perfetto reporting distinguishes actual FrameTimeline rows whose `dur` exceeds
103 ms from presentation timestamp gaps. The old timestamp-gap count included
idle spacing between actions and is not used as a substitute for slow-frame
duration. Deadline misses, duration percentiles, maximum duration, timestamp
gaps, `gfxinfo`, tile warnings, and continuous visual evidence remain separate
rows; none is allowed to launder another failed gate.

Only the veil opacity is the product theme animation. There is no page
screenshot, bitmap capture, root View Transition, geometry animation, native
overlay, extra renderer, or orb quality change.

## Motion Acceptance

- User feedback starts within 100 ms.
- The transition settles within 300 ms.
- The focused Android theme window contains no presentation gap over 103 ms.
- Android's primary frame target remains the actual refresh budget: about
  16.7 ms at 60 Hz, with FrameTimeline deadline misses and `gfxinfo` percentiles
  reported rather than hidden behind the 103 ms upper guard.
- Ten consecutive light/dark round trips show no black/blank/stale/partial frame,
  input block, lost focus, clipped control, or low-contrast intermediate state.
- Separate CDP-off Perfetto/`gfxinfo` runs report no ANR, crash, WebGL context
  loss, or `tile memory limits exceeded` signal attributable to the theme flow.
- At least three comparable runs are retained; single-run emulator noise cannot
  promote the candidate.

## Audio And Google Gates

The collection remains Cloudlight plus nine generated masters. Objective QC,
bundle reachability, single-player ownership, foreground lifecycle, comfort
gates, decoding, and emulator audio output are technical evidence only. Each
exact music hash remains `PENDING` until the owner listens and explicitly
approves it; store upload cannot infer artistic approval from this design.

Google proof is split into:

1. source/config structure;
2. current Cloud console OAuth clients;
3. debug-signed emulator login;
4. upload-key signed artifact login;
5. Play App Signing installed artifact login;
6. callback recovery and final V2 destination.

A debug success does not close upload or Play signing gates. Missing upload-key
material stops signed release assembly rather than substituting the debug key or
inventing a new identity.

## Platform Matrix

- **Web/Vite:** OAuth keeps trusted web destinations; fade-through uses the CSS
  coordinator; no native APIs are required.
- **Installed PWA:** Telegram remains in the PWA only when initiation began in
  the PWA; cache/update behavior and ten-track intent caching remain unchanged.
- **Android/Capacitor:** primary proof target; custom scheme, `singleTask`, warm
  and cold callback, Custom Tab closure, app lifecycle, System Bars, native
  CSS theme handoff, WebView rendering, and frame timing are required.
- **iOS/WKWebView:** the shared custom scheme and callback parser remain valid;
  native build/simulator evidence is required before a device PASS.
- **Desktop/Tauri:** web OAuth and the shared theme coordinator apply; no custom
  Android callback behavior is introduced.
- **Accessibility:** veil never owns input/focus, reduced motion is immediate,
  icon controls retain accessible state and 44/48-pixel targets, and RTL uses no
  physical-direction animation.
- **Security/Privacy:** PKCE stays mandatory, callback host and query are narrow,
  no secrets or auth material enter logs, and account ownership remains checked
  before session admission.

## Failure Handling And Observability

- A rejected hosted redirect remains a hard failure with a safe diagnostic code;
  the app must not claim success because a PWA session exists.
- Callback parsing continues to reject foreign origins, duplicate selectors,
  malformed UUIDs, overlong URLs, missing sessions, and owner mismatches.
- A transition timeout advances to a bounded commit/release rather than leaving
  a permanent CSS cover. Cleanup is idempotent.
- Runtime artifacts retain only route/provider/status and sanitized URL shape;
  no codes, tokens, states, email, Telegram username, profile photo, or account
  identifiers are retained.

## Release And Rollback

The code and hosted-config workflow merge through the existing Codex branch.
After merged `main` is proven, the dedicated workflow patches Supabase, then the
exact final APK is installed and Telegram/Google are repeated. A signed AAB can
be uploaded only to Google Play Internal testing after the upload key,
certificate, maximum versionCode, exact ten-hash human approval, local gates,
and remote checks are all present.

Rollback is two bounded operations: revert the source PR and restore the prior
hosted `uri_allow_list` value captured by the apply workflow. Neither operation
deletes users, sessions, music masters, or production data.

## Remaining External Gates

- Hosted Supabase `uri_allow_list` readback before/after patch: `UNVERIFIED`.
- Existing authorized Android upload key: `UNVERIFIED`.
- Current Play maximum versionCode and upload certificate: `UNVERIFIED`.
- Owner approval for all ten exact music hashes: `UNVERIFIED`.
- `memory/feedback_commit_pipeline_knowledge.md` required by repository commit
  policy is absent locally and from available Git history; commit remains
  blocked until the owner supplies it or explicitly waives that one instruction.

## 2026-09-04 Native Candidate Decision Gate

The approved native cover was implemented and validated through RED/GREEN unit
contracts, exact APK installs, continuous video, and CDP-off profiling. It
improves palette atomicity but does not satisfy the controlling performance
acceptance criteria. WebView visibility cycling, keeping WebView visible, and
removing the forced native hardware layer were tested as three separate
hypotheses. All retained large presentation gaps and hundreds of Chromium tile
memory warnings. The native candidate is therefore not approved for merge.

The next narrow architecture proposal is to remove the universal
`html.theme-transition-palette-atomic *` selector that invalidates the full DOM
and instead suppress transitions only on the existing body/container/card/nav
surface list responsible for mixed palette frames. This requires a new explicit
architecture approval before implementation and must retain the native cover
only if both the continuous frame-board and three profiler runs improve.

The owner approved that proposal, but its first exact-APK run still produced 32
presentation gaps over 100 ms and 383 tile-memory warnings. Perfetto localized
the longest frames to Activity decor traversal/draw blocking on
`WebViewFunctor::drawGl`. The child-decor overlay is therefore rejected as the
remaining coupling point.

The separate-window candidate was subsequently tested and rejected after its
first run: it increased the relevant gaps and jank while leaving tile pressure.
The selected direction is therefore the shared CSS fade-through plus narrow
button palette-transition suppression. It remains performance `FAIL` until a
new source-built exact APK passes the complete repeated runtime gate; the
current overloaded-host experiments prove direction only, not release quality.
