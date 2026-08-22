# Primary-Source Research — Android 2.1 Recovery

**Refreshed:** 2026-08-11  
**Method:** official Google/Android/W3C/GitHub sources only for changing technical/policy behavior. Local applicability is recorded separately; source text does not prove ZenFlow runtime or console state.

## Freshness receipt

The linked primary pages were reopened on 2026-08-11. The current text confirms: Play submissions move to API 36 on 2026-08-31 with the documented extension path; Android 16 changes edge-to-edge, predictive Back, adaptive-window and Arabic-font assumptions; staged rollout does not increase automatically; mixed child/older audiences require neutral age handling and child/unknown ad restrictions; UGC requires terms, report and blocking controls; current Child Safety Standards require published CSAE standards, in-app feedback, CSAM handling, legal compliance and a named contact; rewarded ads explicitly exchange interaction for in-app items/reward callbacks; UMP calls for a consent-information update at each launch and gates requests through current `canRequestAds()`; WCAG 2.2 includes Focus Not Obscured and Target Size criteria. These are source requirements only, not ZenFlow compliance proof.

## Android and Play release

### Target API

- Source: [Meet Google Play's target API level requirement](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en-GB_ALL)
- Current rule used by this plan: applicable new apps and updates must target Android 16 / API 36 from 2026-08-31. The page also describes the available extension path where offered.
- ZenFlow applicability: authenticated Play UI currently shows an operational 2026-08-30 deadline and production target SDK 35. Use the earlier console date operationally.
- Evidence gap: no exact target-36 signed AAB exists in this audit.

### Android 16 behavior changes

- Source: [Android 16 behavior changes for apps targeting Android 16](https://developer.android.com/about/versions/16/behavior-changes-16)
- Relevant areas: edge-to-edge enforcement/opt-out changes, predictive Back behavior, adaptive large-screen restrictions and Arabic font/elegant text-height changes.
- ZenFlow applicability: native shell, every overlay/Back owner, five destinations, safe areas, adaptive layouts and `ar` are in scope.
- Evidence gap: inherited emulator evidence is stale; exact-artifact matrix is absent.

### 16 KB page size

- Source: [Support 16 KB page sizes](https://developer.android.com/guide/practices/page-sizes)
- Current page states a 2027 enforcement milestone for relevant target-35+ submissions. It is not the August 2026 API-36 deadline.
- ZenFlow applicability: exact-AAB native libraries still require inspection so compatibility is known and future-safe.
- Rejection: do not use 16 KB as a false current-deadline claim or omit the exact-artifact check.

### Performance, startup and profiles

- Sources: [Android vitals](https://developer.android.com/topic/performance/vitals/index.html), [App startup time](https://developer.android.com/topic/performance/vitals/launch-time), [Baseline Profiles overview](https://developer.android.com/topic/performance/baselineprofiles/overview)
- ZenFlow applicability: define numeric thresholds before measurement; bind device/API/thermal/compilation/iterations; prove the profile is packaged in the exact AAB.
- Rejection: source/profile presence, emulator screenshots or invalid-environment runs do not prove startup/frame health or a universal frame rate.

### Staged rollout and managed publishing

- Sources: [Release app updates with staged rollouts](https://support.google.com/googleplay/android-developer/answer/6346149?hl=en), [Use managed publishing](https://support.google.com/googleplay/android-developer/answer/9859654?hl=en)
- Relevant behavior: staged rollout applies to updates, reaches an eligible cohort, can be halted/resumed, and does not automatically increase percentage. Managed publishing requires review lead time and does not hold every type of change.
- ZenFlow applicability: one AAB hash, explicit 10%/50%/100% approvals, retained observation windows and at least one-week review buffer where possible.
- Evidence gap: no internal upload, processing, pre-launch or production-stage authorization.

## Families, all ages, UGC and child safety

### Families and mixed audience

- Sources: [Families policy requirements](https://support.google.com/googleplay/android-developer/answer/9893335?hl=en), [Families self-certified ads SDK program](https://support.google.com/googleplay/android-developer/answer/9900633?hl=en), [Current self-certified ads SDK list](https://support.google.com/googleplay/android-developer/answer/12955712?hl=en)
- Relevant behavior: mixed audiences require a neutral age-screen approach; child/unknown cohorts change identifier, data, ad personalization/format and SDK requirements.
- ZenFlow applicability: current Play audience starts at 13 while requested scope includes all ages. Owner/qualified review must resolve under-13 intent, age-state design, declarations and exact SDK/format eligibility.
- Default: child/unknown public social and ad requests remain OFF.

### UGC

- Source: [User-generated content policy](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en-IN)
- Relevant behavior: ongoing moderation, terms/policy acceptance, in-app report/block and action against objectionable content are required according to the interaction type.
- ZenFlow applicability: public profiles/search, Friends, Challenges, ranks, invites and any public content/contact require controls and staffed operations before enablement.
- Evidence gap: no accepted terms, moderation operator/SLA, appeals or live report/block proof.

### Child safety standards

- Source: [Child safety standards policy](https://support.google.com/googleplay/android-developer/answer/9878809?hl=en)
- Relevant behavior: social/dating scope requires published CSAE standards, in-app feedback/reporting, action on CSAM under applicable law and a child-safety point of contact.
- ZenFlow applicability: all-ages public social cannot launch before qualified policy/legal/operational ownership and runtime proof.
- Rejection: generic generated policy text is not compliance.

## Store and privacy truth

- Sources: [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en), [Account deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en), [Health apps policy](https://support.google.com/googleplay/android-developer/answer/16679511?hl=en), [Health apps declaration](https://support.google.com/googleplay/android-developer/answer/14738291?hl=en), [Ads policy](https://support.google.com/googleplay/android-developer/answer/9857753?hl=en)
- ZenFlow applicability: the exact candidate must match app access, target audience, ads, data collection/sharing/deletion, health/permissions, content rating, Privacy/Terms/deletion resources and store copy/assets.
- Fresh local/console conflict: Play currently declares all functionality freely available, but ZenFlow has authenticated/OAuth paths. This is a release `FAIL` until owner-authorized correction/read-back.
- Evidence gap: qualified legal facts/review and exact-candidate console parity.

## AdMob, consent and monetization

### App readiness, app-ads.txt and serving limits

- Sources: [AdMob app readiness](https://support.google.com/admob/answer/10564477?hl=en), [Set up app-ads.txt](https://support.google.com/admob/answer/14538460?hl=en), [Ad serving limits](https://support.google.com/admob/answer/9493252?hl=en)
- Fresh console observation: ZenFlow is Play-linked/verified/Ready and the policy center shows no violations, but the account warns about inactivity, recent traffic/revenue is zero and app-ads.txt has no request/crawl data.
- Interpretation: readiness metadata is not policy-safe UX, model legitimacy, request, impression, revenue or runtime proof.

### Rewarded format

- Source: [Google Mobile Ads rewarded ads](https://developers.google.com/admob/android/rewarded)
- Relevant behavior: this format grants an in-app reward through the reward callback and official testing uses test units.
- ZenFlow applicability: ZenFlow has no developed/confirmed production reward system. Existing treats/XP constants, callbacks, prompt, ledger and rewarded units are `LEGACY / UNVERIFIED` and must remain OFF.
- Decision: an exact non-reward option B cannot be created by renaming a rewarded unit. The owner must select ADR-MON-001 first.

### UMP and test tooling

- Sources: [UMP privacy guidance](https://developers.google.com/admob/android/privacy), [Enable test ads](https://developers.google.com/admob/android/test-ads), [Ad Inspector](https://developers.google.com/admob/android/ad-inspector)
- Relevant behavior: update consent information at launch, gate requests on current `canRequestAds`, expose required privacy options and use test devices/test ads during development.
- ZenFlow applicability: age, consent, geography, frequency, network/no-fill, dismiss, duplicate callback, process death and restart are separate tasks. No live traffic is authorized during debugging.
- Evidence gap: exact-candidate test-device/Ad Inspector evidence and honest selected format.

### Next-Gen SDK

- Source: [Next-Gen SDK migration](https://developers.google.com/admob/android/next-gen/migration)
- The current official page documents a distinct artifact/API and versioned migration path.
- ZenFlow decision: do not add or migrate SDK dependencies during this audit or before ADR-MON-001/compatibility review. A newer SDK is not a monetization model.

## Accessibility and motion

- Sources: [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum), [Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum), [Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide), [Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions)
- ZenFlow applicability: 200% text/reflow, focus visibility, targets, controllable moving content and effective reduced motion across overlays/routes/locales/platforms.
- Local enhancement: repository convention uses 44 CSS px minimum and aims for 48dp controls.
- Evidence boundary: automated tests and screenshots do not prove human TalkBack, cultural or artistic acceptance.

## Spec Kit method

- Sources: [Spec Kit](https://github.github.com/spec-kit/), [Spec of Specs](https://github.github.com/spec-kit/concepts/spec-of-specs.html), [Agentic SDD reference](https://github.com/github/spec-kit/blob/main/docs/reference/agentic-sdd.md)
- Applied flow: update existing specify → clarify owner decisions/gaps → plan → one specification-quality plus eight domain checklists → canonical tasks → read-only analyze.
- `speckit-implement` is not authorized. `speckit-converge` follows implementation and is therefore intentionally not run.
- The umbrella feature is decomposed in `roadmap.md`; sub-specs are future owner-authorized work, not automatic implementation scope.

## Research limits

- Policy pages may change after 2026-08-11 and must be refreshed at implementation/release checkpoints.
- Current console observations are recorded separately in `recovery-audit.md`; official public pages do not prove account/app state.
- No legal interpretation or approval is claimed.
- No runtime, device, human, production, serving, revenue, rollout or exact-AAB outcome is inferred from research.
