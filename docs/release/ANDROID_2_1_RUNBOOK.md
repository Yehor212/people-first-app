# Android 2.1 release runbook

Status: **STOP**. This runbook does not authorize a build upload, AdMob account action, internal-track publication, or production rollout.

forward_schema_floor: 11
legacy_v10_rollback: forbidden
rollback_artifact: v11-aware-or-newer

## Release identity

| Field | Required value | Current evidence |
|---|---|---|
| Package | `com.zenflow.app` | Local manifest/config and owner-authenticated Play/AdMob app records agree |
| Version name | `2.1.0` | Applied in `android/app/build.gradle`; exact release AAB still absent |
| Embedded app metadata | `2.1.0` / local `PASS` | `package.json`, `package-lock.json`, runtime `APP_VERSION` and the Android production-web `version.json` now agree with native `versionName`; no Web/PWA/iOS/Desktop publication or exact signed-AAB build was performed |
| Version code | Verified Play maximum plus one | Play maximum `34` verified read-only on 2026-08-09; local candidate is correctly `35` |
| Source commit | Exact clean handoff commit | `UNVERIFIED`; worktree is uncommitted |
| AAB SHA-256 and size | Exact release artifact | `UNVERIFIED`; no 2.1 AAB exists |
| Signing certificate digest | Expected Play upload identity | Play App Signing and a distinct upload certificate are present; local upload key is absent, so digest equality remains `UNVERIFIED` |
| Internal/production artifact | Byte-identical AAB | `UNVERIFIED`; no upload is authorized |

Local evidence packets are `android-2.1-runtime-evidence.json`,
`android-2.1-visual-evidence.json`, and `android-2.1-performance-evidence.json`.
They intentionally keep release status at `STOP`; emulator/debug/profile evidence
does not stand in for a signed AAB, Play processing or a representative physical device.

### Current evidence hashes

| Evidence | SHA-256 |
|---|---|
| `android-2.1-runtime-evidence.json` | `58038ef39a88ab37dad8ed72bd61d048ec5e5075e0cd455bc8a59057b2882080` |
| `android-2.1-visual-evidence.json` | `64c523db7020f692d95ad29493504d3fdfc9bf4f9c1f22ac830ecb6c93515607` |
| `android-2.1-performance-evidence.json` | `1965a8df41bce75ee48c954680f66d11cc2df84d760cb177dc5e92e96656bf63` |
| `output/android21/t122-admob-readonly-checkpoint.json` | `09423ea8a21f24803126bfc7b67f524f08ee4104634bcedc77ba6c1ac1fd582c` |
| `output/android21/t125-play-readonly-checkpoint.json` | `51b0b8959c6028c8c7714f647f6349145ab2fc876f9693be310ee81e1235dfdc` |
| `output/android21/t104-release-signing-inputs-shape.json` | `4542e318a689d55a5e4a4deddded72a00690802f509ff20579c90d92473f4b10` |
| `output/android21/t126-local-version-sync-checkpoint.json` | `8e21d7784b13425df5f124c37abc2b7474ce8bc6f3bdd42bec960fc00649761d` |

Hashes bind only the named local files in the current uncommitted worktree. They
do not bind an exact source commit, AAB, Play artifact, or production rollout.

## Non-negotiable forward compatibility

Dexie v11 adds account-bound `automationTransactions`, `automationHistoryMarkers`, and the transient encrypted `automationRemoteEvents` replay store. A v10 binary can open a database created by v11 while remaining unaware of those stores. Its account-clear path therefore cannot prove removal of connected-record history.

After any v11 artifact reaches a tester or user:

1. Never roll back, promote, or hotfix with a v10-aware binary.
2. Halt the Play rollout if needed; disable connected records and rewarded ads through their bounded-freshness kill switches.
3. Replace only with a signed 2.1.x-or-newer artifact that declares schema v11 or later and clears all three account-bound automation stores.
4. Re-run upgrade/data-retention, sign-out/account-switch, backup/import, bundletool, 16 KB, profile, signing and exact-AAB checks on the replacement.
5. Do not use uninstall/reinstall as a recovery claim; it neither proves cloud deletion nor preserves user data.

The executable compatibility proof is `scripts/__tests__/android21ForwardRollback.test.ts`; the release gate is `npm run check:android-release`.

## Pre-build gates

- Run `npm run check:android-release-signing-inputs` before every distributable build. The command emits only booleans and fixed issue codes; it must never print `storeFile`, alias, password values, or resolved paths. Current retained evidence is `STOP / KEY_PROPERTIES_MISSING`: the ignored `android/key.properties` and upload keystore are absent from this isolated lane. Obtain the existing Play upload-signing inputs through the owner-controlled secret channel; do not generate or substitute a new key merely to make the check green.
- Run `npm run check:android-release-native-services-inputs` before every distributable build. It validates only file shape, JSON shape, the `com.zenflow.app` client match and required Firebase identifiers while serializing no identifier values. Current evidence is `STOP / GOOGLE_SERVICES_MISSING`: the ignored owner-provided `android/app/google-services.json` is absent, and API-36 logcat consequently reports that the default Firebase app cannot initialize. Gradle now fails closed for distributable release tasks; never invent, reuse from another package, or commit this file.
- Connected-record rules, history, undo, purge and revocation remain unreachable until the exact migration is deployed and authenticated local/server owner, restart and cross-device checks pass. The ambiguous habit-completion → planning-write rule is not released: Planning keeps its existing read-only habit schedule projection until an event-level ownership/CAS contract is approved.
- Production AdMob IDs must come from the authenticated existing owner account. On 2026-08-09 the existing verified ZenFlow app and its standard rewarded unit were publisher-bound to the public `app-ads.txt` seller without retaining raw IDs. The ignored `.env.production` is the local owner-bound input; tracked source still falls back only to Google demo IDs for emulator/development evidence.
- Run `npm run google-play:admob:release-config-check`; the current owner-bound Android configuration passes with exact pinned SDKs, publisher-bound IDs, conservative audience treatment and no retired ad-format identifier. A clean builder/CI environment still needs the same owner-bound inputs through its secret/config channel; never copy raw IDs into evidence prose.
- UMP state must be refreshed before GMA initialization; unknown entitlement, stale flags, missing zones and missing configuration remain OFF. Android GMA requests are pinned to the current `AgeRestrictedTreatment.TEEN` API with `MAX_AD_CONTENT_RATING_G`; the patch is version-bound to `@capacitor-community/admob@8.0.0`, fails closed on an invalid value and must recompile/reverify whenever that plugin or GMA changes. The legacy booleans remain only for the iOS plugin boundary and do not replace the Android treatment.
- Deploy `rewarded-ads-gate` with JWT verification enabled before any production ID is packaged. Leave `ZENFLOW_REWARDED_ADS_ENABLED` absent or `false` until the same-AAB internal flow is approved; an ON response additionally requires a non-placeholder `ZENFLOW_REWARDED_ADS_REVISION`. `ZENFLOW_REWARDED_ADS_TTL_SECONDS` is capped at 300 seconds, client ON state is process-memory only, and any auth/network/schema/staleness failure is OFF.
- Treat the Edge deployment and its three environment values as external production mutations: record the authenticated project target and owner approval, deploy, then verify an authenticated OFF response before changing the flag. Never place those service values in the Vite bundle or use a client flag as the kill switch.
- Keep Android version code at `35`: authenticated Play evidence recorded maximum `34` on 2026-08-09. Re-query immediately before the exact build; if the maximum changes, stop and use the new maximum plus one.
- `npm run check:android-release` fails closed when Gradle `versionName`, `package.json`, both `package-lock.json` version fields or runtime `APP_VERSION` drift. The retained local Android production-web build completed with exit code 0 and generated `dist/version.json` version `2.1.0`; its checkpoint does not substitute for an upload-signed AAB.
- Run typecheck, lint, focused/full tests, sync/data-integrity/security gates and Android unit/instrumentation checks sequentially before the release build.

## Exact artifact gates

The candidate is eligible for internal testing only when one retained record binds:

- source commit and clean status;
- package, version name/code and signing-certificate digest;
- AAB path, byte size and SHA-256;
- bundletool validation and generated APK-set install on API 36;
- 16 KB native-library inspection;
- packaged Baseline/Startup Profile, R8 mapping and native-symbol inventory;
- absence of debug flags, Google demo IDs and non-rewarded ad formats;
- upgrade and account-data retention from the currently published version.

## Internal and staged rollout

Use the same signed AAB for internal testing and every production stage: `10% → 50% → 100%`. Rebuilding between stages is forbidden. Each promotion needs an explicit owner checkpoint, retained Play processing/pre-launch evidence, and a completed health window.

The same-AAB observation windows are: internal testing for at least 24 hours,
10% for at least 48 hours, 50% for at least 72 hours, then a 7-day post-100%
window. A promotion happens only after the entire preceding window is healthy;
time elapsed alone never promotes a build. Google Play does not increase a
staged rollout automatically, and a halted rollout stops additional users from
receiving that release ([Play staged rollout guidance](https://support.google.com/googleplay/android-developer/answer/6346149)).

The authenticated incident operator and alert route remain `UNVERIFIED`.
Production therefore remains **STOP** even though the local numeric gates are
now explicit. The replacement recovery target is four hours from a confirmed
halt condition to an owner-approved v11-aware internal artifact; this target is
not proven until a real operator rehearses it.

The local fail-closed kill-switch drill is `PASS`: 17/17 focused tests across
automation eligibility, service rollout control, rewarded-ad client gating and
the Edge response contract prove missing, disabled, stale, malformed and
emergency-off states remain OFF. Command:
`npx --no-install vitest run src/features/automation/__tests__/automationGate.test.ts src/features/automation/__tests__/automationServiceControl.test.ts src/lib/__tests__/rewardedAdsGate.test.ts supabase/functions/rewarded-ads-gate/gateResponse.test.ts --maxWorkers=1`.
This is not a production drill: authenticated Edge `OFF -> test ON -> OFF`,
owner alert delivery, Play halt and four-hour replacement rehearsal remain
`UNVERIFIED` and require an explicitly authorized checkpoint.

### Authenticated internal-track checkpoint — 2026-08-09

This checkpoint was read-only. No tester selection, save, review request, AAB
upload, rollout, AdMob reactivation, or ad-unit creation occurred.

| Field | Current console state | Release decision |
|---|---|---|
| Same-AAB promotion | Runbook requires one byte-identical signed AAB for internal, 10%, 50% and 100% | `STOP` until the exact AAB hash exists |
| Internal track | Inactive draft; setup is `1/3` | `STOP`; no artifact uploaded |
| Tester access | Existing `Test zen` list contains 19 users, but it is not selected for the draft; an internal opt-in link exists | Select/save only during an explicitly authorized upload checkpoint, then prove tester access |
| Pre-launch report | No report exists because the track has no candidate artifact | Require Play processing and a completed report for the exact AAB |
| App access | Console currently declares all functionality freely accessible | `STOP`: authenticated cloud, connected-record history and other signed-in paths require a reviewed declaration and, if Play needs it, valid reviewer access instructions |
| Play App Signing | Enabled; Play displays separate app-signing and upload certificates | Local upload key is missing, so certificate match and signed build remain `UNVERIFIED` |
| Target/API policy | Production versionCode 34 targets API 35; Console requires a compliant target by 2026-08-31 | Local target is API 36; only Play processing of the exact AAB closes this gate |
| App content | Eleven declarations are completed and none currently needs attention. Ads and Advertising ID are declared; Data safety lists six categories / ten selected data types and the deletion/privacy URLs | `STOP`: app access, Health Connect and exact-alarm answers do not describe the Android 2.1 candidate; reconcile all SDK/data/permission answers against the exact AAB |
| Store listing / content rating | The default listing and all eight locales are published; IARC is completed with Everyone / PEGI 3 / USK all ages / IARC 3+ and no descriptors | `STOP`: ar/he/ja copy contradicts ads/cloud/data flows, five phone screenshots show the legacy UI, no tablet assets exist, and health/alarm/yoga/fitness tags need source-backed review |
| Rollback | v10 rollback is forbidden; replacement must be v11-aware | Use halt/kill switches, then replace only with an owner-approved v11-aware artifact |

The app-access declaration is the immediate console-content mismatch. Do not
paper over it by claiming public access: either every reviewed release path is
truly usable without authentication, or the owner must provide accurate Play
reviewer instructions through the console at the authorized checkpoint.

### Owner-authenticated AdMob privacy checkpoint — 2026-08-09

The redacted receipt is
`output/android21/t124-admob-privacy-readonly-checkpoint.json` (SHA-256
`0c7a230509ae5e3b20ffca0c41e652683a916ed9d670c1891962638d19155865`).
The checkpoint used read-only navigation and inspection. It retained no
account, publisher, unit or message identifiers and performed no save,
publication, translation, reactivation or ad-unit action.

| Surface | Owner-authenticated AdMob state | Android 2.1 decision |
|---|---|---|
| Account activity | Approved with ad serving enabled; the console warns that no impressions have occurred for more than five months and that six months triggers automatic deactivation | Keep release `STOP`; do not manufacture live traffic or reactivate an account that does not expose a reactivation action |
| European regulations | One message is published for ZenFlow, configured as `en`; the console reports zero impressions and 0% consent | Assignment/publication `PASS`; add and native-review supported ZenFlow locales at an explicitly authorized checkpoint |
| US state regulations | One message is published for ZenFlow, configured as `en-US`; the console reports zero impressions and zero opt-outs | Assignment/publication `PASS`; `es` is supported by this message type but is not configured |
| Language applicability | AdMob chooses message language from device language among the languages made available for that message type. European messages support ZenFlow's `en`, `uk`, `es`, `de`, `fr` and `ja` locales but do not list `ar` or `he`; US-state messages support English and Spanish variants | Current configured coverage is `PARTIAL`; runtime fallback for an unconfigured or unsupported device language remains `UNVERIFIED` and must not be described as localized consent |
| `app-ads.txt` | Public-root content passed locally, but AdMob still has no recent request/crawl data | Generate a request only from the exact authorized release-equivalent artifact, then re-check the crawl state |
| Exact artifact binding | Existing production identifiers are owner-bound without being written to evidence | Rebuild and re-verify once with the exact signed AAB after upload-signing inputs exist |

Google's current [Privacy & messaging guidance](https://support.google.com/admob/answer/10107561?hl=en)
defines device-language selection and the supported-language sets. Console
publication alone is not runtime proof: the retained API 36 UMP tests remain
test-configuration evidence, and the exact production artifact has not made a
request. T124 therefore remains open.

### Owner-authenticated Play content checkpoint — 2026-08-09

The redacted receipt is
`output/android21/t125-play-readonly-checkpoint.json` (SHA-256
`51b0b8959c6028c8c7714f647f6349145ab2fc876f9693be310ee81e1235dfdc`).
The checkpoint used only read-only navigation and inspection. It recorded no
account identifiers, reviewer credentials, signing-certificate fingerprints or
raw production IDs, and it performed no save, submit, upload or rollout action.

| Surface | Owner-authenticated console state | Android 2.1 decision |
|---|---|---|
| Production artifact | `1.7.2`, versionCode `34`, target SDK `35`, min API `26`, 177 regions, 17,735 supported devices and Play-reported 16 KiB support | Candidate stays at versionCode `35` / target API `36`; exact signed-AAB processing remains required |
| Play App Signing | App-signing and upload certificates are both present, distinct, and the current app-signing key meets Google's minimum strength | Local upload key is absent; do not create a replacement key or claim digest equality |
| App access | “No restricted content” is selected | Incorrect for OAuth and signed-in cloud/connected paths; prepare reviewer-safe access instructions before an authorized declaration change |
| Health apps | Activity/fitness, sleep, and stress/relaxation are selected; the published artifact exposes `READ_STEPS`, `READ_SLEEP` and `WRITE_MINDFULNESS` | Current manifest contains none of those permissions and no reachable Health Connect implementation was found; remove stale claims/tags only after exact-AAB reconciliation |
| Exact alarms | `USE_EXACT_ALARM` and “alarm function” are declared for the published artifact | Current manifest explicitly excludes exact-alarm permissions; the declaration and alarm tag must be reviewed for the candidate |
| Target audience | 13–15, 16–17 and 18+ | Keep the teen-safe GMA treatment and re-check ad/content compliance against the exact candidate |
| Data safety | Collected: name, email, user ID, approximate location, health information, crash logs, diagnostics, app interactions, other user-generated content and device identifiers. Shared: approximate location, crash logs, diagnostics, app interactions and device identifiers | Reconcile each purpose, optional/required choice, current consent path and SDK transfer with the exact signed AAB; the browser checkpoint alone is not SDK/runtime proof |
| Store locales | `en-US`, `iw-IL`, `es-ES`, `ar`, `de-DE`, `uk`, `fr-FR`, `ja-JP` are present | ar/he/ja claim “no ads” and device-only/no-tracking behavior while the candidate has consented optional rewarded ads, optional cloud and declared external data flows; legacy feature claims require source proof or removal plus native-speaker review |
| Store visuals | One icon, one feature graphic and five phone screenshots are published; tablet, Chromebook and XR screenshot slots are empty | Direct visual inspection shows the phone screenshots use the legacy dark UI; replace them only after the Android 2.1 UI is frozen and retain phone/tablet visual proof |
| Store category/tags | Health & Fitness with clocks/alarms/timers, health/sport, yoga, self-improvement and fitness-tracker tags | Revalidate each tag against reachable 2.1 behavior; do not use tags to preserve permissions or declarations that the exact artifact does not need |

T125 remains open because the checkpoint identifies rather than externally
mutates these declarations. Closing it requires an explicitly authorized
console checkpoint after the exact signed AAB and reviewer-access packet exist.

### Numeric health and performance gates

All rates use the same candidate cohort/window and must also be compared with
the currently published build. Halt on the first breached candidate gate:

- user-perceived crash rate `>= 0.50%` or an increase of `>= 0.20` percentage
  points from the published build;
- user-perceived ANR rate `>= 0.20%` or an increase of `>= 0.10` percentage
  points from the published build;
- any phone model with user-perceived crash or ANR rate `>= 4%`;
- any reproducible frozen frame over `700 ms` in a canonical journey, physical
  cold-start median over `1500 ms`, cold-start coefficient of variation over
  `0.10`, or physical frame-duration/overrun P95 over `32 ms`;
- sync/automation terminal-failure rate `>= 1%` over 30 minutes, queue age P95
  over five minutes while online, or a purge/undo receipt stuck over five
  minutes;
- UMP/ad-gate failure rate `>= 1%` over 30 minutes, any duplicate/lost reward,
  or any request outside the authorized optional-reward flow.

The project gates are deliberately stricter than Play's bad-behavior ceilings.
As a backstop, current Android vitals documents `1.09%` overall user-perceived
crash, `0.47%` overall user-perceived ANR, and `8%` per-phone-model thresholds
([Android vitals](https://developer.android.com/topic/performance/vitals)).
Android also classifies cold TTID at five seconds or more as excessive and a
frame over 700 ms as frozen
([startup](https://developer.android.com/topic/performance/vitals/launch-time),
[rendering](https://developer.android.com/topic/performance/vitals/render)).
Those platform ceilings are not targets and never override the stricter gates
above.

Immediate halt conditions require no statistical threshold:

- any cross-account data visibility or failure to clear v11 stores;
- any post-revocation automatic write or purged-history resurrection;
- any partial server batch, repeated stale-epoch retry, or newer manual record overwritten;
- any ad request before current UMP permission, outside `optional_rewards`, or with duplicate/lost reward settlement;
- any rewarded request after `rewarded-ads-gate` closes, expires, becomes unauthenticated or returns a malformed response;
- signing/package/version mismatch, launch blocker, or confirmed privacy/policy violation.

## Platform impact

| Target | Release status |
|---|---|
| Web/Vite | Shared v11/backup/sync/UI regression evidence required; Android packaging N/A |
| Installed PWA | Offline/update/restart evidence required |
| Android/Capacitor | Binding target; API 36 emulator and exact-AAB evidence required |
| iOS/WKWebView | Shared data/UI regression evidence required; Android bridge/AAB N/A |
| Desktop/Tauri | Shared data/UI regression evidence required; native ads/AAB N/A |
| Store/Release | Authenticated Play/AdMob checks and explicit owner authorization required |

## External checkpoint

Authenticated Play/AdMob inspection, account reactivation, ad-unit creation, version-code selection, upload and rollout are external state changes. They require a verified target account and explicit owner authorization; local Spec Kit artifacts are not authorization.
