# Checklist 4 — AdMob, UMP and Honest Monetization

## Requirement quality

- [x] MON-001 Does the specification explicitly and testably define that the target is an owner-selected policy-safe monetization model without fictitious rewards and with fresh runtime evidence? [Completeness, Spec §FR-001–FR-004/FR-020–FR-025/FR-031–FR-035]
- [x] MON-002 Does the specification explicitly and testably define that aDR-MON-001 A/B/C remains undecided; no option is implemented by implication? [Completeness, Spec §FR-001–FR-004/FR-020–FR-025/FR-031–FR-035]
- [x] MON-003 Does the specification explicitly and testably define that option A is a new genuine-reward product scope, not a rewarded-ad plumbing task? [Completeness, Spec §FR-001–FR-004/FR-020–FR-025/FR-031–FR-035]
- [x] MON-004 Does the specification explicitly and testably define that option B names an exact voluntary non-reward format; a rewarded unit cannot simply be relabeled? [Completeness, Spec §FR-001–FR-004/FR-020–FR-025/FR-031–FR-035]
- [x] MON-005 Does the specification explicitly and testably define that option C/undecided keeps initialization, request, prompt and callback behavior fail-closed/OFF? [Completeness, Spec §FR-001–FR-004/FR-020–FR-025/FR-031–FR-035]
- [x] MON-006 Does the specification explicitly and testably define that treats, XP, badges, unlocks, pseudo rewards and “watch and earn” copy are prohibited? [Completeness, Spec §FR-001–FR-004/FR-020–FR-025/FR-031–FR-035]
- [x] MON-007 Does the specification explicitly and testably define that existing constants/callbacks/UI/ledger/units are `LEGACY / UNVERIFIED` and cannot be activated or deleted without proof and approval? [Completeness, Spec §FR-001–FR-004/FR-020–FR-025/FR-031–FR-035]
- [x] MON-008 Does the specification explicitly and testably define that habit completion and journal save commit and finish independently of ads; no automatic post-action fullscreen ad? [Completeness, Spec §FR-001–FR-004/FR-020–FR-025/FR-031–FR-035]
- [x] MON-009 Does the specification explicitly and testably define that no ad/CTA appears inside diary text, editor, emotional/sensitive, recovery or error flows? [Completeness, Spec §FR-001–FR-004/FR-020–FR-025/FR-031–FR-035]
- [x] MON-010 Does the specification explicitly and testably define that any future opt-in concept is outside private content and never conditions core function? [Completeness, Spec §FR-001–FR-004/FR-020–FR-025/FR-031–FR-035]
- [x] MON-011 Does the specification explicitly and testably define that frequency, age, consent, geography, network/no-fill, dismiss, duplicate callback, process death and restart are separate gates? [Completeness, Spec §FR-001–FR-004/FR-020–FR-025/FR-031–FR-035]
- [x] MON-012 Does the specification explicitly and testably define that uMP updates at launch, current `canRequestAds` gates requests, privacy options are reachable, and stale/error state denies? [Completeness, Spec §FR-001–FR-004/FR-020–FR-025/FR-031–FR-035]
- [x] MON-013 Does the specification explicitly and testably define that child/unknown and mixed-audience requests satisfy exact Families/ad-SDK/identifier restrictions before enablement? [Completeness, Spec §FR-001–FR-004/FR-020–FR-025/FR-031–FR-035]
- [x] MON-014 Does the specification explicitly and testably define that google test ads and Ad Inspector precede any authorized live validation; demo IDs are rejected from release artifacts? [Completeness, Spec §FR-001–FR-004/FR-020–FR-025/FR-031–FR-035]
- [x] MON-015 Does the specification explicitly and testably define that console Ready/unit existence/policy-center state is metadata, not product or runtime proof? [Completeness, Spec §FR-001–FR-004/FR-020–FR-025/FR-031–FR-035]
- [x] MON-016 Does the specification explicitly and testably define that app-ads.txt, messages/locales, account inactivity, serving limits, app/store link and declarations are separate external evidence? [Completeness, Spec §FR-001–FR-004/FR-020–FR-025/FR-031–FR-035]
- [x] MON-017 Does the specification explicitly and testably define that monetization failure/absence never blocks core app? [Completeness, Spec §FR-001–FR-004/FR-020–FR-025/FR-031–FR-035]

## Context-only current evidence ledger (not checklist items)

- MON-E01 Owner selects A/B/C — `ASK`.
- MON-E02 Genuine reward value/system (A) — absent, `UNVERIFIED`.
- MON-E03 Exact honest non-reward format and placement (B) — absent, `UNVERIFIED`.
- MON-E04 Current production reachability/runtime inventory — source partial; runtime `UNVERIFIED`.
- MON-E05 Proof all ads are OFF for undecided/child/unknown/stale/denied/offline states — `UNVERIFIED`.
- MON-E06 Frequency cap decision and restart behavior — `UNVERIFIED`; current console shows none.
- MON-E07 UMP age/geography/consent/privacy-options matrix — inherited evidence stale.
- MON-E08 Test-device/test-ad/Ad Inspector exact-candidate receipt — `UNVERIFIED`.
- MON-E09 App-ads.txt request/crawl and policy-safe serving — `UNVERIFIED`.
- MON-E10 Exact all-ages/Play/AdMob/legal/UX approval — `OWNER/EXTERNAL`.

## Kill conditions

- any fake reward or reward-oriented copy is introduced;
- an ad appears before save confirmation, immediately after completion, or inside a private/emotional flow;
- missing/stale age/consent/gate/entitlement state permits a request;
- network/ad failure changes primary action success;
- live traffic is used for debugging or production IDs enter test fixtures/evidence;
- console Ready or callback delivery is called monetization readiness;
- ads ON is proposed before ADR-MON-001 and all selected-option gates pass.
