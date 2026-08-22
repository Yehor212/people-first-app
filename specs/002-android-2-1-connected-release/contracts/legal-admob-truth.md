# Legal, Store, and AdMob Truth Contract

> **PRE-RECOVERY CONTRACT:** any rewarded/reward claims below are superseded by ADR-MON-001. Existing reward artifacts remain OFF and `LEGACY / UNVERIFIED`; the current legal/store checklist and exact owner gates control future work.

## Candidate-bound disclosure matrix

One row is required for every material Android 2.1 behavior and SDK: account/auth, local IndexedDB, optional Supabase sync/storage, encrypted journal/connected-record history, microphone/audio/dictation, notifications, diagnostics/Sentry/Firebase, feedback/Resend, Journal Search/Coach, account deletion, friends/challenges/invitations/QR/camera, AdMob/GMA/UMP and any advertising identifier declaration.

Each row binds:

```text
behavior + exact source/artifact locator
  -> data category and provenance
  -> purpose and external recipient
  -> optional/required and consent/permission gate
  -> storage, retention/criteria and deletion path
  -> public Privacy/Terms/deletion section
  -> Play Data safety/App content/Ads/Target audience field
  -> AdMob Privacy & messaging/app readiness field when applicable
  -> owner/legal input and PASS/FAIL/UNVERIFIED status
```

The matrix contains no raw user data, credential, AdMob identifier or private console content. Public document URL, effective/updated date and content hash are retained; console evidence is redacted and owner-authenticated.

## Public document and locale behavior

Privacy, Terms and account-deletion resources use stable HTTPS, require no authentication, remain readable at 320 CSS pixels/200% text and identify ZenFlow plus a valid contact/deletion route. Settings and the entry flow must reach them in every supported locale.

`en`, `uk`, `es`, `de`, `fr`, `ja`, `ar`, `he` receive either a qualified reviewed document for that locale or a localized, truthful notice that the reviewed English document is authoritative. An automated/model translation is never labelled legally approved. RTL document chrome and language selection use logical direction and preserve Latin URLs/identifiers with bidi isolation.

Source work may add verified facts and fix reachability/contradictions. It may not invent developer/controller legal name or address, jurisdiction/venue, lawful basis, retention duration, international-transfer mechanism, age/audience conclusion or human translation approval. Missing facts remain named owner/legal inputs and block compliance claims.

## AdMob availability layers

Rewarded serving is open only when every preceding layer is current:

1. authenticated AdMob account, app, existing rewarded unit and policy/readiness state;
2. published required UMP messages and `app-ads.txt`/store link state;
3. exact candidate app/unit identifiers and rewarded-only release guard;
4. current UMP consent information and `canRequestAds()` eligibility;
5. authenticated deployed `rewarded-ads-gate` response with enabled non-placeholder revision and bounded freshness;
6. controller zone/premium/mood/cap/cooldown eligibility;
7. SDK prepare/show callback and earned settlement;
8. actual test/live inventory result.

Missing, malformed, expired or disabled state fails closed and records only a fixed category. A later `PASS` cannot override an earlier `FAIL`. `no_fill`, network, consent, gate, policy/readiness and configuration are distinct categories. No layer logs raw SDK response, account/unit ID, advertising ID, user ID, mood/journal content or credential.

The current 2026-08-11 authenticated read-only production inventory does not include the locally referenced `rewarded-ads-gate`; that layer is `FAIL`. Deploying the function, setting `ZENFLOW_REWARDED_ADS_*`, changing UMP/AdMob/Play or creating/rotating a unit is an external mutation requiring explicit target/action authorization.

## Verification and rejection criteria

Local API/config/UMP/controller tests prove source compatibility only. After external authorization, test in this order: deploy/verify gate revision and OFF→test ON→OFF behavior; use Google's rewarded demo inventory or an explicitly registered test device on API 36; inspect in-context request/privacy/waterfall state with Ad Inspector; refresh redacted authenticated console and `app-ads.txt` evidence; then perform only a policy-safe live observation. Development never clicks or intentionally generates live-ad traffic.

Reject release if public documents contradict source or store forms, deletion routes fail, a locale silently claims an unreviewed legal translation, the service gate is absent/stale, any request occurs before UMP/gate/zone eligibility, a reward can duplicate/disappear, or a new unit is proposed without proof the existing one is unusable. Qualified legal approval, live serving, payments/tax/holds, signed AAB/store parity and production observation remain `UNVERIFIED` until directly evidenced.
