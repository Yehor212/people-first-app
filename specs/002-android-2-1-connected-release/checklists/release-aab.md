# Checklist 1 — Release and Exact AAB

**Meaning:** `[x]` means the requirement is explicit and testable in the recovery specification. It does not mean the product or artifact passed. Evidence status is recorded separately.

## Requirement quality

- [x] REL-001 Does the specification explicitly and testably define that the candidate base, branch, commit, dirty manifest and intended write set are uniquely identifiable? [Completeness, Spec §FR-008–FR-013/FR-033–FR-035]
- [x] REL-002 Does the specification explicitly and testably define that aPI 36 target/compile/min SDK, Android 16 behavior and prohibited opt-outs are explicit? [Completeness, Spec §FR-008–FR-013/FR-033–FR-035]
- [x] REL-003 Does the specification explicitly and testably define that versionCode is derived from a fresh Play maximum and versionName/platform metadata truth is explicit? [Completeness, Spec §FR-008–FR-013/FR-033–FR-035]
- [x] REL-004 Does the specification explicitly and testably define that signing/Firebase inputs are owner-controlled and evidence must not expose values? [Completeness, Spec §FR-008–FR-013/FR-033–FR-035]
- [x] REL-005 Does the specification explicitly and testably define that one build order and one candidate hash bind web build, Capacitor sync and release AAB? [Completeness, Spec §FR-008–FR-013/FR-033–FR-035]
- [x] REL-006 Does the specification explicitly and testably define that bundletool splits, manifest, package, size, certificate digest, R8 mapping, symbols, profiles and native libraries have named checks? [Completeness, Spec §FR-008–FR-013/FR-033–FR-035]
- [x] REL-007 Does the specification explicitly and testably define that generated splits must install on API 36 and cover launch, upgrade, data retention, Back, lifecycle and critical flows? [Completeness, Spec §FR-008–FR-013/FR-033–FR-035]
- [x] REL-008 Does the specification explicitly and testably define that debug/test/demo-ad config and non-production identifiers are exact-artifact rejection conditions? [Completeness, Spec §FR-008–FR-013/FR-033–FR-035]
- [x] REL-009 Does the specification explicitly and testably define that any post-build fix creates a new candidate and invalidates old artifact evidence? [Completeness, Spec §FR-008–FR-013/FR-033–FR-035]
- [x] REL-010 Does the specification explicitly and testably define that internal, 10%, 50% and 100% use the same AAB hash and explicit owner checkpoints? [Completeness, Spec §FR-008–FR-013/FR-033–FR-035]
- [x] REL-011 Does the specification explicitly and testably define that forward-only schema-v11 replacement/rollback behavior is explicit? [Completeness, Spec §FR-008–FR-013/FR-033–FR-035]
- [x] REL-012 Does the specification explicitly and testably define that release success is separate from local build/test success? [Completeness, Spec §FR-008–FR-013/FR-033–FR-035]

## Context-only current evidence ledger (not checklist items)

- REL-E01 Clean authorized implementation lane — `FAIL` (current edit doctor is STOP).
- REL-E02 Constitution/document freshness — `FAIL`.
- REL-E03 Generated Supabase type freshness — `FAIL`.
- REL-E04 Exact owner-bound signing/Firebase inputs — `OWNER/EXTERNAL`.
- REL-E05 Exact signed AAB and hash/certificate/size receipt — `UNVERIFIED`.
- REL-E06 Bundletool split/install/upgrade/data-retention receipt — `UNVERIFIED`.
- REL-E07 Profile/R8/symbol/native-library candidate receipt — `UNVERIFIED`.
- REL-E08 API 36 exact-artifact route/lifecycle/performance matrix — `UNVERIFIED`.
- REL-E09 Internal upload/processing/pre-launch/tester proof — `OWNER/EXTERNAL`.
- REL-E10 Same-hash staged rollout/health proof — `OWNER/EXTERNAL`.

## Kill conditions

- candidate base or file attribution is ambiguous;
- target/API/signing/package/version/hash differs from the evidence packet;
- a secret or private configuration value enters logs/evidence/Git;
- build artifacts mutate concurrently with integrity checks;
- generated splits cannot upgrade without data loss;
- mapping/symbol/profile/native configuration is missing;
- a rebuild is substituted between rollout stages;
- any required gate is `FAIL` or material `UNVERIFIED`.
