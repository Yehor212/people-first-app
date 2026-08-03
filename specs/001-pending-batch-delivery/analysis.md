# Cross-Artifact Analysis: Safe Delivery of the Preserved Pending Batch

**Analyzed**: 2026-08-02
**Constitution status**: `PROPOSAL_CRITERIA_ONLY`; advisory and nonblocking
**Execution verdict**: `STOP` until the open gates below are completed

## Artifact inventory

| Artifact | Present | Grounded | Open placeholders |
|---|---:|---:|---:|
| `spec.md` | Yes | Exact commits, counts, policy boundaries, platforms | 0 |
| `plan.md` | Yes | Current stack, worktree, phases, rollback | 0 |
| `research.md` | Yes | Local Git/policy/manifest evidence and explicit alternatives | 0 |
| `data-model.md` | Yes | Delivery evidence only; no production schema invented | 0 |
| `contracts/delivery-evidence.schema.json` | Yes | Fixed evidence labels and delivery states | 0 |
| `quickstart.md` | Yes | Exact worktree and commands | 0 |
| `checklists/requirements.md` | Yes | 24 requirement-quality checks | 0 |
| `tasks.md` | Yes | 45 dependency-ordered tasks | 0 |

## Requirement traceability

| Requirement group | Acceptance/success evidence | Tasks | Coverage |
|---|---|---|---|
| ER-001, IR-001-IR-003, IR-011 | SC-001, SC-002, SC-003 | T001-T004, T012, T044 | Complete definition; final restoration open |
| ER-002, ER-003, IR-012 | SC-006 | T013-T019, T030 | CLI, manifests, Codex integration registry, and fresh runtime discovery verified |
| ER-004, IR-009-IR-010 | SC-007, SC-008, SC-009 | T037-T043 | Branch and ready PR #64 exist; the initial exact head exposed one Linux size failure and the limit-preserving repair still requires fresh CI |
| ER-005, IR-005-IR-006 | SC-004, SC-005, SC-009 | T020-T036 | Full unit/coverage, build, bundle, browser-motion, PWA-offline, security, tracked-diff secret scan, and final diff evidence exists; exact preflight retained its inherited ratchet FAIL |
| IR-004 | SC-002 | T006-T012 | Complete at named checkpoint |
| IR-007-IR-008 | SC-005, platform matrix | T029, T033-T035 | Chromium/Firefox/WebKit motion and Chromium PWA-offline paths verified; native-device and human craft evidence remain limited |

Every explicit and implied requirement maps to at least one measurable criterion and executable task. No requirement depends solely on the proposed constitution.

## Consistency findings

### Resolved

1. **898 versus 893**: 898 is the original Git-status record count; 893 is the legitimate snapshot path count after exactly five generated caches are excluded.
2. **Spec feature name versus Git branch**: `001-pending-batch-delivery` is the Spec Kit feature directory; the pre-existing protected delivery branch remains `codex/pending-898-speckit-batch` to preserve snapshot lineage and required Codex prefix.
3. **143 net paths versus later feature files**: 143 is explicitly bound to integration checkpoint `d0fa0cc3a`; the final net path count will increase as this evidence packet is added.
4. **Constitution language versus authority**: the plan cites active repository policy for binding gates and treats the unratified constitution as advisory only.
5. **Test-first versus inherited batch**: immutable tree/status characterization is the baseline for the broad imported batch; any newly edited behavior or fixture retains focused regression assertions.
6. **CI-green request versus live journal proof**: repository CI may validate source without fabricating an authenticated live receipt; current live readiness remains `UNVERIFIED` unless an exact authorized proof is obtained.

### Open execution gates

| ID | Gate | Severity | Required closure |
|---|---|---|---|
| A-004 | Human artistic and native-device evidence is incomplete | HIGH only for human/native claims | Keep human craft and physical Android/iOS/Desktop acceptance `UNVERIFIED`; browser runtime evidence is complete for the scoped motion feature |
| A-005 | PR #64 exists, but its initial head failed the required Linux raw-JS size gate by 2,175 bytes; repaired exact-head CI, merge, and post-merge checks remain open | CRITICAL | T041-T043 |
| A-006 | Owner ignored guard files are temporarily task-specific | CRITICAL at handoff | Byte/mode restoration and digest verification in T044 |

The prior runtime-discovery gate is closed: a fresh Codex app-server `skills/list` probe with `forceReload=true` discovered exactly ten enabled repo-scoped Spec Kit skills from `.agents/skills/speckit-*`, with no missing, unexpected, disabled, wrong-root, or load-error records. Snyk's two HIGH findings in the E2E static server were remediated with a pre-indexed trusted build catalog and negative traversal/symlink tests; the rerun reports zero HIGH findings. Checkov reports 733 passed, zero failed, and three documented skips. The exact final added content produced zero Gitleaks findings and zero verified or unverified TruffleHog findings. A separate history scan retains 23 pre-existing generic candidates, including the two removed scanner-shaped fixtures in the immutable snapshot; those deleted strings are absent from the final added content. PR #64 then established a live negative control: all other completed checks passed, while the Linux build measured 5,302,175 raw JavaScript bytes against the unchanged 5,300,000-byte limit. The repair makes the already default-disabled save ceremony a true compile-time boundary, producing a default local bundle of 5,085,325 bytes with 214,675 bytes of headroom while preserving the feature-enabled Chromium/Firefox/WebKit and PWA-offline paths. The exact local preflight now retains only the independently reproduced inline-style ratchet failure; its bundle ratchet passes at 4,967 KB against 5,062 KB. Fresh exact-head GitHub CI is still required. Remaining severities derive from active `AGENTS.md` and user acceptance criteria, not from the proposed constitution.

## Ambiguity and duplication review

- No unresolved template marker, placeholder, or invented user metric remains.
- The feature packet does not duplicate a product model or delivery framework; it references existing scripts and architecture.
- Spec Kit CLI integration and Codex runtime discovery are deliberately separate requirements, preventing a file-presence false positive.
- Local preflight, pull-request CI, post-merge CI, native-device evidence, and human artistic acceptance remain distinct scopes.

## Analysis conclusion

The specification, plan, research, data model, contract, checklist, and tasks are internally consistent and sufficiently concrete to continue implementation. Browser runtime, PWA offline, unit/coverage, build/bundle, size, governance, localization, production-data, Snyk, Checkov, dependency, exact tracked-diff secret, final diff, and exact local-preflight checks have current evidence. Convergence cannot be declared while repaired exact-head CI, merge/post-merge checks, and A-006 remain open; A-004 remains an explicit scope limit rather than a blocker for repository delivery. Verdict: `STOP` for merge, `GO` for committing and pushing the scoped CI repair.
