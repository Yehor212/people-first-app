# Production banner activation — 2026-09-10

## Authority and failure

The owner explicitly requested connecting banner ads now. Work continues SOLO in
the existing locked `codex/android-103ms-20260904` lane, from main
`4957c9ff827308e751d253076e209c280aed585e`. No unrelated legacy-clone repair,
new worktree, paid dependency, visual replacement or new ad format is included.

The current non-QA `deriveCurrentProductAdEntitlement` always returns `unknown`;
`AdContext` consequently never initializes ad requests. T009 implemented the
deny contract, not a working production authority. Fresh baseline: 38/38
eligibility/controller/context tests pass; the added current-free/premium
regressions fail twice with `unknown` before production edits.

## FR-003 completion

Use the existing server-owned `public.app_config` key `android_banner_policy`
with exactly `{ "version": 1, "enabled": true, "model": "free_with_banner" }`.
This is an explicit configuration of the currently free Android product, not
a fabricated purchase, subscription or per-user database record. Before
activation the exact key is absent; only `app_version` exists. Live RLS permits
public reads and limits insert/update to the service role. No schema, RLS,
role, auth hook or user record change is needed.

The client first resolves its session owner, verifies that same user through
Supabase Auth, reads and strictly validates the policy, and rechecks the session
owner before accepting it. A server-owned `app_metadata.ad_entitlement` of
`premium` takes precedence over the free product default. A missing override
uses the explicit product policy; an unrecognized override denies ads.
`user_metadata` is never an entitlement authority. No account identifiers or
raw error payloads enter advertising diagnostics.

The hook runs only in a supported Android build after explicit adult ad consent.
It retains the result only in memory, cancels at account boundaries, sign-out,
background/hidden/offline state and cleanup, and rechecks after resume or an
auth update. An eight-second deadline denies a hung request; a five-minute
maximum lease triggers a fresh read. Late or superseded results cannot restore
ads. Failed reads do not loop. The app shell and local user data remain usable.

Invalidation revokes the native controller epoch synchronously, before React
can batch state updates. A new entitlement revision must finish its own SDK
initialization before the provider can restore a banner. Consecutive free
accounts cannot reuse the previous account's placement handshake.

All other FR-001–FR-014 gates remain unchanged: UMP, age, consent, grace,
same-day emotional protection, non-empty-today Habits, overlays, IME,
visibility, exact native reservation and banner-only format.

## Verification and release boundaries

- Source: positive current-free path, server premium, untrusted metadata,
  missing/disabled/malformed policy, mismatched account, failures and cancellation.
- Hook: non-Android no-op, consent deny, timeout, bounded refresh, account-switch
  late response, background/resume, offline/online and cleanup.
- Existing context/controller tests plus typecheck, lint, release tests,
  production-data-integrity source/diff/bundle and applicable security scans.
- Production-configured Android artifact: exact source/APK identity, labelled
  emulator test banner, protected-surface removal, rotation, safe areas and RTL.
  Do not click the banner. Emulator test inventory is not live-impression proof.
- Google Play artifact/review and AdMob live serving remain distinct from
  source, local tests and emulator observations. Version 39 is already consumed;
  a replacement requires a higher version code and the unchanged upload key.

| Surface | Impact and proof boundary |
| --- | --- |
| Web/Vite | No entitlement request, ad initialization or dock; regression checks required. |
| Installed PWA | Same ad-free source; installed-runtime proof separate. |
| Android/Capacitor | Only monetized platform; exact artifact/runtime checks required. |
| iOS/WKWebView | No Android entitlement request or banner; native runtime separate. |
| Desktop/Tauri | No entitlement request or banner; packaged runtime separate. |
| Accessibility | Existing geometry/RTL/44px and protected-surface gates retained; device evidence required. |
| Performance | Async after render, bounded requests and listeners; no startup wait or visual reduction. |
| Security/privacy | Read-only client, existing RLS, validated account scope; no private-content export or consent changes. |
| Operations | One server-controlled kill switch; source and store status reported separately. |

## Rollback

Set only `android_banner_policy.enabled` to false to deny future reads; active
foreground leases expire within five minutes. Background/resume revalidates.
Then revert the isolated activation patch if necessary. Do not alter the
`app_version` entry, user records, permissions, audio, visuals or signing key.

## Open evidence

The source, hook and provider changes have fresh 83/83 focused GREEN evidence in
`output/android-banner-activation-20260910/native-epoch-green.json`, following
the retained source, lifecycle, synchronous-invalidation and revision RED cases.
The five changed production TypeScript files pass scoped Snyk Code, Gitleaks,
TruffleHog, Trivy and oxlint checks. The first full preflight ran 10,538 tests:
10,507 passed, 23 skipped, seven declared todos, and one failure for stale motion
inventory hashes and the new entitlement timer owner. The inventory was
regenerated with its existing source-owned tool, without changing its validator
or exclusions. The 19 inventory/AdMob release checks then passed. The complete
test rerun passed 10,508 tests in 875 files, with 23 skipped tests and seven
declared todos; no tests failed. Coverage was 65.99% statements, 55.41% branches,
63.71% functions and 68.2% lines. The production web build, bundle integrity,
artifact, CSS, size, canonical-orb, best-practices and no-template checks passed.
`check:all` also completed with its existing ten out-of-scope color warnings;
none are introduced by this patch. The final preflight tail was rerun separately
and exited zero: app/Hyperfocus audio, RAG (323 files / 3,418 chunks), completion
(144 invariants), sync (417 invariants), forward-only schema and ratchet.
Ratchet retained its 70 existing missing-measurement/advisory warnings.

The separate private build/sign/DOM-inspection tooling scan has one Snyk note
for `InsufficientPostmessageValidation` in a Node WebSocket listener. That helper
accepts only the current ADB-forwarded loopback endpoint and checks its exact
origin before parsing. This is not a browser `window.postMessage` handler and
is not part of the application, commit or bundle. The note is retained without
suppression; the tooling scan is not reported as an unqualified PASS.

The previously absent policy key was inserted at 2026-09-10 05:55:43 UTC and
independently reread with the exact reviewed value. No other row, schema, role
or RLS change was made. The owner subsequently confirmed adult eligibility and
authorized enabling the banner in the existing emulator account. Its normal
age-check UI completed, and a read-only DOM check confirms consent is true.
No birth date is included in code or evidence files.

Fresh Android banner visual/lifecycle checks, the new signed artifact and
Play/live-serving proof remain open. Google Play now reports 39
as available in a full production rollout; this correction uses code 40.
Historical T016/T017 failures and missing physical-device evidence remain open
until directly superseded by new scoped proof.

## Exact-artifact identity correction

The first production-configured code-40 candidate was installed with all 239
assets matching its AAB. The actual new entry script loaded without a service
worker. Native props confirmed adult consent and completed grace, and Auth
requests returned HTTP 200, but no policy request occurred. A redacted diagnostic
isolated the failure to the shared session/user validator: it requires a
non-empty email even when Auth has verified a non-anonymous identity.

The ad source now validates the current session UUID and a fresh `auth.getUser`
response directly, without reading or requiring an email. It accepts only the
same server-verified UUID, validates server metadata, rejects anonymous users,
and rechecks the active owner after the policy read. Shared auth, sync and
session-validation helpers remain unchanged. This follows the documented
[server verification contract](https://supabase.com/docs/reference/javascript/auth-getuser);
the local session alone never authorizes advertising.

The real-helper regression with only the external SDK transport replaced had
four passing cases and three expected failures before this correction:
email-less free/premium identities and anonymous denial. The identical cases
now pass. The final source/hook/provider/controller/identity/shared-session
suite passed 97 tests, and the regenerated inventory passed all ten unchanged
checks. Snyk Code, Gitleaks, TruffleHog and Trivy passed on all ten changed
production/test TypeScript files. Scanner notes on hardcoded isolated test
credentials were resolved with ephemeral test-only values; assertions and
test isolation were not weakened. The complete fresh preflight on `538fd055`
exited zero: 10,515 tests passed in 876 files, with 23 skipped and seven declared
todos. The production build and all preflight tail checks also completed.

## Native packaging correction

The `538fd055` candidate reached verified `free` entitlement on the installed
Android app, with adult consent, completed grace and a real today-Habits entry.
However, `Capacitor.isPluginAvailable('AdMob')` returned false, and the native
consent request returned `UNIMPLEMENTED`. Independent AAB inspection confirmed
that its plugin registry and generated Gradle project omitted AdMob. The old
`OFF` packaging policy had remained in `capacitor.config.ts` even though the
JavaScript controller and entitlement path were ready.

The source-owned packaging mode now explicitly selects `ANDROID_BANNER`.
Android sync includes the already-installed, pinned and patched AdMob plugin;
other platform runtime eligibility remains false. No dependency version or
consent/placement condition changes. The UMP checker now evaluates every
Android consent gate and reports iOS as intentionally outside this Android-only
activation. Its historical all-platform checks remain covered using explicit
isolated `ON` inputs, and the `OFF` test remains intact with an explicit input.

The artifact checker additionally requires exactly one correctly classed native
AdMob registration and the native implementation in the AAB DEX payload. Valid
ad-unit identifiers alone are no longer sufficient. The new regression run had
12 passing tests and 11 expected failures before production edits; all 23
identical cases now pass. The broader packaging/identity/controller/inventory
suite passed 105 tests. The generated Gradle diff adds only the AdMob project
and dependency. `npm audit --audit-level=high` found zero vulnerabilities.

The replacement native artifact, its presented banner and protected-surface
lifecycle, final remote checks, main integration and Play submission remain
required. Previous source-only green results are not proof of ad serving.
