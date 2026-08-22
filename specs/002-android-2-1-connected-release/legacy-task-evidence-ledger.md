# Legacy Task Evidence Ledger — T001–T160

**Recovery snapshot:** 2026-08-11  
**Input:** the pre-recovery `tasks.md` at SHA-256 `c15cf840d62796ae0d315a3c3a9c4a39b08a7482f86a83ab0e44df0311975d20`  
**Count:** 134 checked + 26 open = 160 tasks

This ledger classifies evidence, not source-code value. A task marked `STALE_EVIDENCE` may still have useful code or retained artifacts; it simply has not been rerun against the frozen recovery snapshot. A current failure overrides an old green narrative.

## Classification rules

| Class | Meaning |
|---|---|
| `FRESH_VERIFIED` | The bounded task claim was rerun or re-observed on 2026-08-11. It proves only the stated scope. |
| `STALE_EVIDENCE` | A source/receipt/test narrative exists, but it predates the recovery snapshot or exact candidate. |
| `CLAIM_WITHOUT_RECEIPT` | The checked statement has no fresh or sufficiently bound retained receipt in this audit. |
| `SUPERSEDED` | Current owner direction makes the old requirement or completion conclusion non-canonical. |
| `OWNER/EXTERNAL` | Completion requires owner choice, secret/signing input, qualified approval, authenticated mutation, publication, device/human evidence, or rollout authority. |
| `UNVERIFIED` | Required evidence was not available or not executed. |

## Previously checked tasks — exhaustive disposition

Every one of the 134 previously checked task IDs appears exactly once below.

### `FRESH_VERIFIED` — 6

`T001`, `T003`, `T004`, `T005`, `T006`, `T122`

Boundaries:

- `T001`: branch/HEAD/worktree identity was rechecked; the dirty edit doctor still fails.
- `T003`: required local policies were reread and task-specific RAG reran; RAG missed several domains, so direct source inspection supplemented it.
- `T004`: baselines were recaptured; this verifies capture, not success. Constitution and type freshness are currently `FAIL`.
- `T005`/`T006`: primary Android/Google policy research was refreshed; applicability to the exact candidate remains a later proof task.
- `T122`: current AdMob account/app/policy/message inventory was observed read-only. Private payout/tax/phone state and runtime serving remain `UNVERIFIED`; no identifier is reproduced here.

### `SUPERSEDED` — 14

`T007`, `T009`, `T010`, `T094`, `T095`, `T096`, `T097`, `T098`, `T099`, `T100`, `T102`, `T112`, `T123`, `T131`

Reasons:

- `T007`, `T010`, and `T131`: the old specification/analysis/convergence conclusion is replaced by this recovery packet. `convergence.md` remains historical and was not rerun.
- `T009`: the current owner explicitly prohibited subagents; independent ten-role/Role 10 execution cannot be carried forward as fresh proof.
- `T094`–`T100`, `T102`, `T112`, and `T123`: a technically usable rewarded unit, test, identifier, gate, callback, or console state is not a legitimate monetization model. All reward/rewarded paths are now `LEGACY / UNVERIFIED` pending ADR-MON-001.

### `CLAIM_WITHOUT_RECEIPT` — 2

`T002`, `T008`

- `T002`: no fresh dependency-install/edit-doctor receipt supports the old checked state; the current edit doctor is `STOP` because the lane is dirty.
- `T008`: prior specialist counterexamples are not independently reproducible under the owner's no-subagent constraint and cannot serve as current proof.

### `STALE_EVIDENCE` — 112

`T011`, `T012`, `T013`, `T014`, `T015`, `T016`, `T017`, `T018`, `T019`, `T020`, `T021`, `T022`, `T023`, `T024`, `T025`, `T026`, `T027`, `T028`, `T029`, `T030`, `T031`, `T032`, `T033`, `T035`, `T036`, `T037`, `T038`, `T039`, `T040`, `T041`, `T042`, `T043`, `T044`, `T045`, `T046`, `T047`, `T048`, `T049`, `T050`, `T051`, `T052`, `T053`, `T054`, `T055`, `T056`, `T057`, `T058`, `T059`, `T060`, `T061`, `T062`, `T063`, `T064`, `T065`, `T066`, `T067`, `T068`, `T069`, `T070`, `T071`, `T072`, `T073`, `T074`, `T075`, `T076`, `T077`, `T078`, `T079`, `T080`, `T081`, `T082`, `T084`, `T085`, `T086`, `T087`, `T088`, `T089`, `T090`, `T091`, `T092`, `T093`, `T103`, `T109`, `T110`, `T111`, `T113`, `T114`, `T115`, `T116`, `T117`, `T118`, `T119`, `T120`, `T121`, `T136`, `T137`, `T138`, `T139`, `T140`, `T141`, `T142`, `T143`, `T144`, `T145`, `T146`, `T147`, `T133`, `T134`, `T149`, `T150`, `T152`, `T160`

Important boundaries for this group:

- Old unit, component, suite, emulator, screenshot, video, PWA, performance, security, and handoff results are not exact-current or exact-signed-AAB evidence.
- Existing automation/storage/sync code has material local evidence, but fresh generated types and remote migration parity are absent.
- Existing Android UX/runtime evidence is not a substitute for the requested all-routes, all-locales, exact-AAB, physical-device and human-AT matrix.
- Motion screenshots and technical tests never imply owner artistic approval.
- Old reward-publication references inside otherwise useful persistence tasks remain legacy reachability to audit, not an approved reward system.

## Previously open tasks — exhaustive disposition

Every one of the 26 previously open task IDs appears exactly once below.

### `OWNER/EXTERNAL` — 16

`T034`, `T104`, `T105`, `T106`, `T107`, `T108`, `T124`, `T125`, `T126`, `T127`, `T128`, `T129`, `T130`, `T135`, `T148`, `T158`

These depend on one or more of: reviewed remote migration, generated types source, upload signing/Firebase inputs, exact signed AAB, authenticated Play/AdMob changes, internal testers, legal/operator facts, qualified review, publication, incident ownership, or rollout authority. None is authorized by this audit.

### `UNVERIFIED` — 7

`T083`, `T101`, `T132`, `T151`, `T153`, `T156`, `T157`

The missing evidence includes authenticated OAuth return, human predictive gesture, genuinely dismissed/no-fill ad behavior, isolated Role 10 closure, root-cause storage trigger, app-wide reflow/navigation matrices, and current non-orb motion/runtime/craft proof.

### `SUPERSEDED` — 3

`T154`, `T155`, `T159`

- `T154`/`T155`: challenge-only ranking and the prior invitation scope are replaced by an explicit high-risk public-social sub-spec covering public profiles/search, global and challenge rankings, invitations, manual codes, links, QR display/scanning, age state and abuse controls. No implementation is authorized.
- `T159`: “working rewarded ads” is replaced by the owner-selected, policy-safe, no-fictitious-reward monetization target. Existing diagnostics may later be reused only after ADR-MON-001.

## Recovery arithmetic

| Population | Fresh | Stale | Claim only | Superseded | Owner/external | Unverified | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| Previously checked | 6 | 112 | 2 | 14 | 0 | 0 | 134 |
| Previously open | 0 | 0 | 0 | 3 | 16 | 7 | 26 |
| Combined | 6 | 112 | 2 | 17 | 16 | 7 | 160 |

The six fresh rows do not make the feature release-ready. They are bounded snapshot/research/console observations only.
