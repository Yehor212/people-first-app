# Checklist 8 — Operations and Staged Rollout

## Requirement quality

- [x] OPS-001 Does the specification explicitly and testably define that a named incident operator, backup/escalation and alert route are mandatory? [Completeness, Spec §FR-010–FR-013/FR-032–FR-035]
- [x] OPS-002 Does the specification explicitly and testably define that numeric crash, ANR, startup, rendering, sync/data, consent/ad and policy thresholds are explicit before rollout? [Completeness, Spec §FR-010–FR-013/FR-032–FR-035]
- [x] OPS-003 Does the specification explicitly and testably define that internal, 10%, 50% and 100% stage windows and a post-release window are explicit? [Completeness, Spec §FR-010–FR-013/FR-032–FR-035]
- [x] OPS-004 Does the specification explicitly and testably define that every stage requires current same-AAB hash, health evidence, rollback readiness and explicit owner approval? [Completeness, Spec §FR-010–FR-013/FR-032–FR-035]
- [x] OPS-005 Does the specification explicitly and testably define that no rollout percentage increases automatically and no candidate is rebuilt between stages? [Completeness, Spec §FR-010–FR-013/FR-032–FR-035]
- [x] OPS-006 Does the specification explicitly and testably define that halt, resume and replacement actions have verified targets and retained receipts? [Completeness, Spec §FR-010–FR-013/FR-032–FR-035]
- [x] OPS-007 Does the specification explicitly and testably define that schema-v11 rollback is a forward-compatible replacement, not an older incompatible binary? [Completeness, Spec §FR-010–FR-013/FR-032–FR-035]
- [x] OPS-008 Does the specification explicitly and testably define that public-social, monetization and cohort feature gates default OFF and have kill-switch precedence? [Completeness, Spec §FR-010–FR-013/FR-032–FR-035]
- [x] OPS-009 Does the specification explicitly and testably define that missing/stale gate, telemetry or operator state yields STOP rather than optimistic promotion? [Completeness, Spec §FR-010–FR-013/FR-032–FR-035]
- [x] OPS-010 Does the specification explicitly and testably define that app/AdMob/Play inactivity, policy, serving limits and declaration changes are monitored where applicable? [Completeness, Spec §FR-010–FR-013/FR-032–FR-035]
- [x] OPS-011 Does the specification explicitly and testably define that evidence includes timestamp, candidate/artifact identity, cohort, metric source, counts, limitations and approver? [Completeness, Spec §FR-010–FR-013/FR-032–FR-035]
- [x] OPS-012 Does the specification explicitly and testably define that user data/secrets/private diary content never enter operational evidence? [Completeness, Spec §FR-010–FR-013/FR-032–FR-035]
- [x] OPS-013 Does the specification explicitly and testably define that incident/recovery drills distinguish local simulation from authorized production proof? [Completeness, Spec §FR-010–FR-013/FR-032–FR-035]
- [x] OPS-014 Does the specification explicitly and testably define that core app can continue with ads/public social OFF when those optional tracks halt? [Completeness, Spec §FR-010–FR-013/FR-032–FR-035]

## Context-only current evidence ledger (not checklist items)

- OPS-E01 Named operator and alert route — `OWNER/EXTERNAL`.
- OPS-E02 Exact-candidate thresholds/dashboard queries validated — `UNVERIFIED`.
- OPS-E03 Authorized OFF → test ON → OFF gate drill — `OWNER/EXTERNAL`; monetization remains OFF.
- OPS-E04 Public-social safety/moderation kill-switch drill — `UNVERIFIED`.
- OPS-E05 v11-aware replacement recovery-time drill — `OWNER/EXTERNAL`.
- OPS-E06 Exact AAB internal stage/processing/pre-launch/tester proof — `OWNER/EXTERNAL`.
- OPS-E07 10% retained health window and approval — `OWNER/EXTERNAL`.
- OPS-E08 50% retained health window and approval — `OWNER/EXTERNAL`.
- OPS-E09 100% retained health window and approval — `OWNER/EXTERNAL`.
- OPS-E10 Seven-day or owner-approved post-release monitoring closure — `OWNER/EXTERNAL`.

## Kill conditions

- no reachable operator/alert/rollback owner;
- exact hash, metric source or cohort is ambiguous;
- any halt threshold, policy/declaration gate or critical test fails;
- a stage is promoted automatically or before its observation window;
- a rebuild is promoted as the same candidate;
- optional ad/social failure blocks core app instead of failing closed;
- monitoring contains private user content or unbounded identifiers.
