# Best Practices Packet

**Scope:** Android 2.1 recovery, all-ages public social, non-orb motion and monetization decision  
**Evidence date:** 2026-08-11  
**Rule:** “best practice” below means a source-backed rule applied to a concrete ZenFlow failure mode. Missing runtime, human, external or exact-artifact proof remains `UNVERIFIED`.

## Explicit requirements

1. Audit and planning only; no implementation, external mutation, publication or convergence.
2. Reconcile the 349-entry dirty snapshot and every old task/evidence claim.
3. Recover the existing Spec Kit feature rather than create a competing one.
4. Target API 36 and an Android 2.1 release path through internal → 10% → 50% → 100% by explicit gates.
5. Cover Android navigation, layout, eight locales, accessibility, lifecycle, motion, performance, data/sync, security, legal/store and operations.
6. Plan Friends, Challenges, public profiles/search, global and challenge rankings, invitations, manual/link/QR flows for all ages as a high-risk sub-spec.
7. Inventory non-orb motion, capture baselines, offer 4–6 directions and three variants each for Gratitude Bloom and Let Go, then stop for artistic selection.
8. Replace “working rewarded ads” with an owner-selected, policy-safe model without fictitious rewards and fresh runtime proof.
9. Keep habit completion and journal save independent of ads; no automatic post-action fullscreen ad or sensitive-flow placement.
10. Preserve legacy reward/rewarded artifacts without activation or deletion pending proof and separate approval.

## Implied requirements added

| ID | Requirement | Local evidence / failure mode | Applicability and source | Tradeoff / rejection criterion | Verification |
|---|---|---|---|---|---|
| IR-001 | Use the console's earlier 2026-08-30 date operationally | current Play UI is earlier than the global policy date | Google Play target API policy | less schedule margin; reject relying on timezone ambiguity | current console + official policy page |
| IR-002 | Request an extension instead of bypassing release gates if needed | exact AAB and multiple owner gates are absent | Play policy allows a later extension path when offered | delays update; reject unverified emergency ship | owner-authenticated console evidence |
| IR-003 | Treat Android 16 edge-to-edge/predictive Back/adaptive behavior as candidate-wide | Android shell and overlays are heavily modified | Android 16 behavior changes | broader test matrix; reject manifest/layout opt-outs | source tests + API 36 exact splits |
| IR-004 | Keep 16 KB checks in exact-artifact gate but do not misstate it as the August deadline | inherited plan tied it to current deadline | Android page-size guidance currently states 2027 enforcement for target 35+ | still consumes artifact work; reject policy-date laundering | native-lib inventory on exact AAB |
| IR-005 | Separate source/profile presence from measured startup/frame behavior | inherited performance receipts include failed thresholds/invalid environment | Android vitals, startup and Baseline Profile guidance | longer device runs; reject universal 60fps claims | exact build/device/thermal/iterations |
| IR-006 | Use same AAB for every rollout stage and explicit stage gates | old build/evidence is not current | Play staged-rollout behavior | slower promotion; reject rebuild or automatic increase | Play release hash + checkpoint receipts |
| IR-007 | Add a neutral age-state contract before all-ages features/ads | current Play audience starts at 13; proposed scope includes under 13 | Google Play Families policy | conversion/privacy cost; reject age inference from content/profile | owner-approved design + runtime/store parity |
| IR-008 | Child/unknown defaults OFF for public social and personalized/ineligible ads | public search/ranking/contact and rewarded paths have no child proof | Families and self-certified ads guidance | limits features/revenue; reject optimistic unknown-age defaults | negative tests + test-device requests + console truth |
| IR-009 | Establish terms acceptance, report/block and ongoing moderation before UGC/public social | current desired social scope introduces public/user content and contact | Google Play UGC policy | operational staffing; reject “report later” launch | runtime flows + moderation runbook/SLA |
| IR-010 | Publish child-safety standards and point of contact before social publication | social app with all ages is proposed | Google Play child-safety standards | legal/operations burden; reject generic policy text | live public resource + console declaration + qualified review |
| IR-011 | Make QR decode inert and confirmation-bound | scanner/link input can create hidden joins/writes | local security threat model and least-authority design | extra confirmation step; reject auto-join/auto-follow | hostile payload tests + platform camera/link tests |
| IR-012 | Make ranks server-authoritative and anti-enumeration | global/challenge ranks invite scraping/forgery/IDOR | local architecture/RLS and threat model | backend/latency complexity; reject client-computed public truth | RLS/RPC/rate-limit/adversarial tests |
| IR-013 | Do not call a rewarded unit policy-safe without a genuine reward | Google rewarded format grants an in-app reward; ZenFlow has none | Google Mobile Ads rewarded guide | forfeits existing unit reuse; reject relabeling | ADR-MON-001 + exact-format review |
| IR-014 | Update UMP at launch and gate requests on current consent/age/geography state | reachable SDK path exists but runtime evidence is absent | Google UMP Android guidance | launch/network complexity; reject cached indefinite consent authorization | test geographies, offline/restart, privacy-option tests |
| IR-015 | Use Google test ads/Ad Inspector before any authorized live validation | no recent AdMob traffic and current app is operationally inactive | Google test-ad and Ad Inspector guidance | extra test-device setup; reject live traffic during debugging | retained test-device receipt, zero live IDs in tests |
| IR-016 | Add frequency as its own product/policy gate | current units/app show no frequency caps | console observation + interruption/agency requirements | fewer impressions; reject default-unbounded exposure | config/runtime clock/restart tests + console receipt |
| IR-017 | Reconcile app access, audience, ads, Data safety, deletion, health and store assets to exact candidate | current app-access claim conflicts with auth paths; audience conflicts with proposed all ages | Play Data safety/account deletion/app content policies | console/legal work; reject local-source-only declaration claims | authenticated read-only then authorized write/recheck |
| IR-018 | Meet WCAG 2.2 focus, target, reflow and motion requirements without treating automation as human acceptance | 200%/RTL/overlay/motion scope is broad | W3C WCAG 2.2 and Understanding docs | layout/motion constraints; reject screenshots-only accessibility PASS | automated + keyboard/TalkBack + named human AT review |
| IR-019 | Preserve Dexie local truth and exact save-before-publication order | app architecture and sensitive diary/habit actions | ZenFlow architecture/runtime contracts | transaction/coordinator complexity; reject UI success before commit | RED/GREEN persistence/process-death tests |
| IR-020 | Keep release evidence hash-bound, privacy-safe and candidate-specific | inherited corpus is large/stale and includes private surfaces | project evidence policies | evidence maintenance cost; reject unchecked stale receipt reuse | manifest identity/hash/size/capture-count validators |
| IR-021 | Split core release, public social, motion and monetization decisions | full bundle cannot meet deadline truthfully | Spec Kit Spec-of-Specs approach | more artifacts/owner checkpoints; reject monolithic “all green” task | roadmap dependency analysis |
| IR-022 | Keep ads/public social/new motion OFF when their sub-spec is incomplete | missing model/safety/artistic approval must not break core app | owner correction and fail-closed project policy | narrower release | flag/default/negative/runtime evidence |

## Platform and quality matrix

| Dimension | Web/Vite | Installed PWA | Android/Capacitor | iOS/WKWebView | Desktop/Tauri | Status |
|---|---|---|---|---|---|---|
| Core persistence | Dexie/source checks | update/restart | process-death/WebView | lifecycle | lifecycle/window | local static PASS; runtime incomplete |
| Public social | gated routes | link/install routing | app link/camera/Back | universal link/camera | protocol/camera decision | UNVERIFIED/OFF |
| Monetization | OFF or explicit N/A | OFF | reachable legacy SDK path, must be OFF | plugin parity unknown | N/A/OFF pending product | STOP for ON |
| Navigation | browser Back/Escape | standalone | predictive/system Back | WK navigation | keyboard/window | Android partial old evidence; current matrix UNVERIFIED |
| RTL/i18n | eight locales | eight locales | eight locales + Arabic font | eight locales | eight locales | source parity old/stale; human review UNVERIFIED |
| Accessibility | keyboard/reflow | standalone reflow | TalkBack/large text | VoiceOver | keyboard/screen reader | human gates UNVERIFIED |
| Performance | browser metrics | SW/update/start | vitals/profile/jank | WKWebView metrics | desktop resources | exact candidate UNVERIFIED |
| Security/privacy | CSP/auth/RLS | cache/update | native bridge/ad/QR | bridge/link/camera | IPC/protocol | local scans bounded; high-risk runtime UNVERIFIED |
| Release/store | web truth | manifest/SW truth | exact AAB/Play | no release in this feature | no release in this feature | Android STOP |
| Operations | web incident path | update rollback | staged Play/halt | separate follow-up | separate follow-up | operator/alerts absent |

## Evidence status at packet creation

### PASS — bounded only

- task-specific RAG ran, supplemented with exact-source inspection;
- worktree/branch/HEAD/status/conflict/task counts frozen;
- primary policy research refreshed;
- production-data-integrity diff, 409 sync invariants, npm high+ audit, doc counts, migration-prefixes and whitespace checks passed in their named scopes;
- current Play/AdMob pages were inspected read-only without exposing identifiers or credentials.

### FAIL

- edit doctor on dirty lane;
- constitution freshness;
- Supabase generated-type freshness;
- full one-worker Vitest: 23 failures across 8 files, reproduced by a focused rerun;
- current target SDK 35 against required 36;
- Play app-access truth;
- AdMob inactivity/zero-runtime evidence as a monetization-readiness signal.

### UNVERIFIED / OWNER-EXTERNAL

- exact signed AAB and all derived artifact/device evidence;
- remote migration parity and live sync;
- public-social backend, moderation, child safety, age treatment, legal approval and runtime;
- owner artistic selection and current motion craft/runtime;
- monetization option, live/test-device runtime and exact policy fit;
- human AT/cultural/legal review;
- console corrections, internal upload, incident ownership and rollout.

## Rejection rules

Reject any proposal that:

- hides an open gate behind a checked task, old screenshot, console Ready label or successful build;
- treats a reward callback/test unit as user value;
- adds fake currency or placeholder social records;
- enables child/unknown public discovery/contact/ads by default;
- auto-writes from links/QR or computes public authority in the client;
- weakens tests, thresholds, policies, scanners or declaration truth;
- claims all-platform, artistic, legal, accessibility, security, production or rollout PASS from a narrower local check;
- rebuilds between staged rollout levels or promotes without an explicit owner checkpoint.
