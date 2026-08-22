# Checklist 3 — All Ages, Families, Public Social and UGC

## Requirement quality

- [x] SOC-001 Does the specification explicitly and testably define that desired surfaces are explicit: Friends, Challenges, public profiles/search, global ranking, challenge ranking, codes, links, QR display and scan? [Completeness, Spec §FR-014–FR-019/FR-031–FR-035]
- [x] SOC-002 Does the specification explicitly and testably define that current Play audience (`13–15`, `16–17`, `18+`) is distinguished from the proposed under-13/all-ages scope? [Completeness, Spec §FR-014–FR-019/FR-031–FR-035]
- [x] SOC-003 Does the specification explicitly and testably define that a neutral, owner-approved age-state contract is required before age-sensitive behavior? [Completeness, Spec §FR-014–FR-019/FR-031–FR-035]
- [x] SOC-004 Does the specification explicitly and testably define that child/unknown defaults OFF for public discovery, global ranking, contact/invites and age-ineligible ad behavior? [Completeness, Spec §FR-014–FR-019/FR-031–FR-035]
- [x] SOC-005 Does the specification explicitly and testably define that server/RLS/RPC authority, IDOR prevention, anti-enumeration, scraping/rate limits and rank integrity are explicit? [Completeness, Spec §FR-014–FR-019/FR-031–FR-035]
- [x] SOC-006 Does the specification explicitly and testably define that profiles/search/ranks use bounded disclosure, block visibility and deletion/retention semantics? [Completeness, Spec §FR-014–FR-019/FR-031–FR-035]
- [x] SOC-007 Does the specification explicitly and testably define that uGC terms acceptance, report, block, moderation, appeals and objectionable-content handling are required before enablement? [Completeness, Spec §FR-014–FR-019/FR-031–FR-035]
- [x] SOC-008 Does the specification explicitly and testably define that published child-safety standards, in-app reporting, escalation and point of contact are explicit owner/external gates? [Completeness, Spec §FR-014–FR-019/FR-031–FR-035]
- [x] SOC-009 Does the specification explicitly and testably define that invite/link/QR decode validates type/version/origin/size/expiry/revocation/audience and performs zero writes before confirmation? [Completeness, Spec §FR-014–FR-019/FR-031–FR-035]
- [x] SOC-010 Does the specification explicitly and testably define that self/duplicate/blocked/expired/revoked/offline/error states are specified without fabricated records? [Completeness, Spec §FR-014–FR-019/FR-031–FR-035]
- [x] SOC-011 Does the specification explicitly and testably define that qR dependency, camera permission, deep/app/universal-link routing and platform fallbacks require separate approval/proof? [Completeness, Spec §FR-014–FR-019/FR-031–FR-035]
- [x] SOC-012 Does the specification explicitly and testably define that play Families, ads SDK, Data safety, app access, privacy, Terms, content rating and store copy must match runtime? [Completeness, Spec §FR-014–FR-019/FR-031–FR-035]
- [x] SOC-013 Does the specification explicitly and testably define that moderation operator, coverage/SLA, audit/evidence privacy, incident escalation and kill switch are release gates? [Completeness, Spec §FR-014–FR-019/FR-031–FR-035]
- [x] SOC-014 Does the specification explicitly and testably define that feature gating is cohort-aware, stale/missing state is OFF, and rollout can be halted without disabling core app? [Completeness, Spec §FR-014–FR-019/FR-031–FR-035]

## Context-only current evidence ledger (not checklist items)

- SOC-E01 Owner approves public-social scope/cohorts — `ASK`.
- SOC-E02 Owner confirms under-13 intent and neutral age design — `ASK`.
- SOC-E03 Qualified Families/UGC/child-safety/legal review — `OWNER/EXTERNAL`.
- SOC-E04 Named moderation/appeals/child-safety operators and SLA — `OWNER/EXTERNAL`.
- SOC-E05 Reviewed server data/RLS/RPC/rate-limit design — `UNVERIFIED`.
- SOC-E06 Adversarial tests for IDOR/enumeration/scraping/rank/invite/QR — `UNVERIFIED`.
- SOC-E07 Exact QR dependency/license/provenance approval — `ASK`.
- SOC-E08 Eight-locale/RTL/a11y/platform runtime matrix — `UNVERIFIED`.
- SOC-E09 Play/store/legal/runtime truth matrix — `OWNER/EXTERNAL`.
- SOC-E10 Production moderation/incident/kill-switch drill — `OWNER/EXTERNAL`.

## Kill conditions

- child/unknown is treated as adult or public by default;
- public search/ranking/contact launches without report/block/moderation/child-safety operations;
- client controls authoritative rank/relationship truth;
- scan/decode performs an automatic join/follow/friend/write;
- missing backend data is replaced with a named person, challenge, rank or success record;
- blocked/deleted users remain discoverable or contactable;
- policy/store declarations differ from enabled runtime.
