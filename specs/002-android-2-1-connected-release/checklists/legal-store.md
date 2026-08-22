# Checklist 7 — Legal, Privacy and Store Truth

## Requirement quality

- [x] LGL-001 Does the specification explicitly and testably define that candidate source/AAB behavior maps to Privacy, Terms, deletion and store declarations? [Completeness, Spec §US8/FR-014–FR-025/FR-031–FR-035]
- [x] LGL-002 Does the specification explicitly and testably define that app access describes authenticated/OAuth paths and an authorized reviewer route where required? [Completeness, Spec §US8/FR-014–FR-025/FR-031–FR-035]
- [x] LGL-003 Does the specification explicitly and testably define that target audience distinguishes current 13+ declaration from proposed all-ages/under-13 behavior? [Completeness, Spec §US8/FR-014–FR-025/FR-031–FR-035]
- [x] LGL-004 Does the specification explicitly and testably define that data safety covers exact SDKs, collection/sharing, encryption, deletion, diagnostics, ads and public-social data? [Completeness, Spec §US8/FR-014–FR-025/FR-031–FR-035]
- [x] LGL-005 Does the specification explicitly and testably define that ads declaration and consent/message/app-ads truth match actual enabled behavior, including OFF? [Completeness, Spec §US8/FR-014–FR-025/FR-031–FR-035]
- [x] LGL-006 Does the specification explicitly and testably define that health/exact-alarm/permission declarations and metadata are candidate-bound, not inherited assumptions? [Completeness, Spec §US8/FR-014–FR-025/FR-031–FR-035]
- [x] LGL-007 Does the specification explicitly and testably define that uGC terms, report/block/moderation and child-safety standards/contact are live before public social? [Completeness, Spec §US8/FR-014–FR-025/FR-031–FR-035]
- [x] LGL-008 Does the specification explicitly and testably define that account deletion path covers local/cloud/social/rank/invite/moderation retention truth? [Completeness, Spec §US8/FR-014–FR-025/FR-031–FR-035]
- [x] LGL-009 Does the specification explicitly and testably define that store copy/screenshots/tablet assets show current behavior without legacy or fictitious claims? [Completeness, Spec §US8/FR-014–FR-025/FR-031–FR-035]
- [x] LGL-010 Does the specification explicitly and testably define that all eight locales use reviewed copy or an explicit owner-approved English fallback where policy allows? [Completeness, Spec §US8/FR-014–FR-025/FR-031–FR-035]
- [x] LGL-011 Does the specification explicitly and testably define that operator identity/address, governing law, retention, lawful bases, transfer mechanisms and authoritative translations are owner/qualified facts? [Completeness, Spec §US8/FR-014–FR-025/FR-031–FR-035]
- [x] LGL-012 Does the specification explicitly and testably define that agent/source checks prove reachability/consistency only, never legal sufficiency? [Completeness, Spec §US8/FR-014–FR-025/FR-031–FR-035]
- [x] LGL-013 Does the specification explicitly and testably define that every external console edit requires before/after evidence and separate owner authorization? [Completeness, Spec §US8/FR-014–FR-025/FR-031–FR-035]

## Context-only current evidence ledger (not checklist items)

- LGL-E01 Current Play production/version/target/audience/app-content inventory observed read-only — bounded PASS.
- LGL-E02 App-access truth — `FAIL` against authenticated product paths.
- LGL-E03 API 36 exact-candidate declaration — `FAIL/UNVERIFIED`.
- LGL-E04 All-ages/Families/UGC/child-safety declaration and runtime parity — `UNVERIFIED`.
- LGL-E05 Exact ads/consent/SDK/app-ads truth after ADR-MON-001 — `UNVERIFIED`.
- LGL-E06 Candidate-bound Data safety/account-deletion/health/permission matrix — `UNVERIFIED`.
- LGL-E07 Current store copy/screenshots/tablet/all-locale review — inherited issues; `UNVERIFIED/FAIL`.
- LGL-E08 Owner legal/operator facts — `OWNER/EXTERNAL`.
- LGL-E09 Qualified legal/child-safety review — `OWNER/EXTERNAL`.
- LGL-E10 Authorized console correction and read-back — `OWNER/EXTERNAL`.

## Kill conditions

- declaration says all content is public while authentication is required;
- target audience/ads/social/data behavior differs across source, AAB, Play, AdMob and policies;
- store assets/copy advertise unavailable, legacy or fake reward/social behavior;
- an agent invents legal/operator/retention/jurisdiction facts or authoritative translations;
- child-safety/UGC/public-social requirements are deferred until after enablement;
- external changes occur without verified target, approval and read-back receipt.
