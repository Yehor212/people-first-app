# Owner and External Gates

**Rule:** no row below is delegated to an agent by implication. `ASK` requires an explicit owner decision; `OWNER/EXTERNAL` requires the named external authority or input; `UNVERIFIED` cannot be promoted to PASS by local tests.

| Gate | Required decision/evidence | Why it cannot be assumed | Current status | Unblocks |
|---|---|---|---|---|
| G-001 Monetization | select ADR-MON-001 A, B or C | product value, policy posture and business intent | ASK | monetization sub-spec only |
| G-002 Option A scope | approve genuine reward discovery/economy as a new feature | no production reward system exists | ASK if A | reward product research |
| G-003 Option B format | name the exact voluntary non-reward format and placements | a rewarded unit cannot be relabeled honestly | ASK if B | policy/UX feasibility research |
| G-004 Option C policy | approve durable ads-OFF product policy | changes monetization expectation, not core function | ASK if C | fail-closed implementation/checks |
| G-005 Public social | approve public profiles/search, global ranking, challenge ranking, invitation surfaces and eligible cohorts | high-risk public/child product definition | ASK | public-social sub-spec |
| G-006 Age scope | confirm whether under-13 users are intended and the owner-approved neutral age experience | current Play declaration begins at 13 | ASK | Families/declarations/runtime design |
| G-007 Moderation | name moderation owner, coverage, response SLA, appeals, evidence retention and escalation | operations cannot be invented | OWNER/EXTERNAL | public/UGC enablement |
| G-008 Child safety | provide child-safety point of contact and qualified CSAE/CSAM process approval | legal/policy responsibility | OWNER/EXTERNAL | social publication |
| G-009 Legal facts | provide operator identity/address, jurisdiction, retention, lawful bases, transfer terms and authoritative translations | qualified facts/approval required | OWNER/EXTERNAL | legal/store truth |
| G-010 QR dependency | approve exact open-source scanner/generator package, source, version, license and destination | new dependency and camera/security surface | ASK | QR implementation |
| G-011 Social backend | approve exact RPC/migration/index/rate-limit plan and target | production data/auth change | ASK | backend implementation |
| G-012 Artistic selection | choose a concept direction and one variant each for Gratitude Bloom and Let Go | technical checks are not artistic approval | ASK after concept pack | motion implementation |
| G-013 Migration target | authorize reviewed automation migration against the exact Supabase project or an approved local replay environment | remote schema write/input | OWNER/EXTERNAL | fresh generated types |
| G-014 Upload signing | provide owner-controlled signing inputs through the approved secret route and verify certificate binding | secret and release identity | OWNER/EXTERNAL | exact release AAB |
| G-015 Firebase config | provide/verify the intended Android Firebase configuration without exposing values | owner-controlled production config | OWNER/EXTERNAL | exact AAB/push parity |
| G-016 App access | approve correct Play review-access declaration and credentials/process if required | authenticated console truth | OWNER/EXTERNAL | Play review readiness |
| G-017 Play declarations | authorize edits to audience, Data safety, Ads, health, permissions, content rating, store copy/assets | external publication/legal truth | OWNER/EXTERNAL | store readiness |
| G-018 AdMob declarations | authorize any message, app-ads.txt, cap, unit, test-device or account change | external monetization state | OWNER/EXTERNAL after G-001 | monetization runtime gate |
| G-019 Internal upload | approve exact hash-bound AAB upload to internal testing | external write/publication | OWNER/EXTERNAL | internal validation |
| G-020 Tester/human gates | identify testers and qualified accessibility, child-safety, legal and artistic reviewers | human acceptance cannot be simulated | OWNER/EXTERNAL | acceptance evidence |
| G-021 Incident operations | name operator, alert route, escalation backup, stage windows and recovery owner | release safety ownership | OWNER/EXTERNAL | production rollout |
| G-022 Rollout 10% | explicit checkpoint on exact AAB, health and rollback readiness | production external side effect | OWNER/EXTERNAL | 10% |
| G-023 Rollout 50% | explicit new checkpoint after retained 10% window | must not auto-increase | OWNER/EXTERNAL | 50% |
| G-024 Rollout 100% | explicit new checkpoint after retained 50% window | full exposure | OWNER/EXTERNAL | 100% |
| G-025 Git publication | authorize commit/push/PR through protected route | shared/protected external state | OWNER/EXTERNAL | review handoff |

## Safe defaults while gates are open

- ads and legacy reward paths: OFF;
- public discovery/global ranking/child-or-unknown contact/QR actions: OFF;
- core habit, diary, mood, planning and settings behavior: available without ads;
- decoding any invite/link/QR: validate only, zero writes until explicit confirmation;
- missing/stale policy, gate, age, consent, auth, entitlement or network state: deny/degrade safely;
- no console, backend, Git, package, store or rollout mutation;
- no owner identity, legal fact, human approval or production proof inferred from agent output.

## Minimum owner response packet before implementation begins

1. name the first implementation slice, not the whole roadmap;
2. select or explicitly defer ADR-MON-001;
3. accept the all-ages/public-social boundary for that slice;
4. provide the relevant G-xxx approvals/inputs only through approved channels;
5. confirm whether the dirty recovery lane will be isolated/rebased by the protected workspace workflow;
6. authorize implementation, but not automatically deployment or publication.
