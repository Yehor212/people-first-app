# Cross-Artifact Analysis: Installed PWA Modernization

**Re-analyzed**: 2026-08-04 after implementation and fresh local verification
**Subject commit**: `13ca51a80d23220574deba762851fe5a32372e46` plus the isolated candidate diff
**Constitution status**: `PROPOSAL_CRITERIA_ONLY`; advisory and nonblocking
**Execution verdict**: local implementation converged; public/Store release remains `STOP`

## Artifact Inventory

| Artifact | Present | Current role | Open placeholders |
|---|---:|---|---:|
| `spec.md` | Yes | User scenarios, ER/IR/FR/SC, authority and rollback | 0 |
| `research.md` | Yes | Versioned official platform sources and local applicability | 0 |
| `data-model.md` | Yes | Transient install capability and evidence only; no product migration | 0 |
| `contracts/pwa-evidence.schema.json` | Yes | Closed status/platform/privacy vocabulary | 0 |
| `plan.md` | Yes | Bounded implementation, platform matrix, rollout and rollback | 0 |
| `quickstart.md` | Yes | Isolated local execution without external writes | 0 |
| `checklists/requirements.md` | Yes | Requirement-quality review | 0 |
| `tasks.md` | Yes | Executed tasks and explicitly retained evidence gaps | 0 |
| `convergence.md` | Yes | Final local results, role ledger and release decision | 0 |

## Requirement Traceability

| Requirement group | Evidence | Result |
|---|---|---|
| ER-001, IR-001-IR-003, SC-001-SC-002 | Full Spec Kit chain; isolated worktree; clean-base RED; manifest source/public/docs/dist parity | `PASS` local |
| ER-002, IR-004-IR-006, SC-003-SC-006 | One-shot early prompt capture; Safari warning; localized offline fallback; owned cache names; dead message removal; rollback drill | `PASS` local |
| ER-003, IR-007, IR-010, SC-007, SC-009 | Chromium/WebKit resize, RTL, focus, reduced-motion, forced-colors and mobile-orientation checks; explicit platform gaps | `PASS` automated scope; installed OS/human rows `UNVERIFIED` |
| IR-008-IR-009, SC-010 | Production-data-integrity diff/bundle, unchanged storage/schema/auth ownership, no product fixtures or user data | `PASS` local |
| IR-011-IR-012, SC-008-SC-010 | 384 focused tests, 9094 full-suite passes, production build, performance, security evidence, no deploy/push/signing | `PASS` local checks except documented inherited/partial gates |
| FR-001-FR-004 | Hook and Settings tests plus WebKit guidance runtime | `PASS` |
| FR-005-FR-007 | Manifest tests, persistent post-build validator, production runtime | `PASS` |
| FR-008-FR-013 | Static fallback tests, worker contracts, browser offline fallback, queue/sync regression | `PASS` available scope |
| FR-014-FR-015 | Automated accessibility/runtime matrix, sanitized evidence, rollback receipt | `PASS` automated scope; human AT/native-speaker acceptance `UNVERIFIED` |

No requirement depends solely on the proposed constitution. No unavailable installed-app, public, Store, human, or device fact is upgraded by inference.

## Resolved Consistency Findings

1. **Early install event**: capture now starts in `main.tsx` before lazy Settings code, remains memory-only, and is consumed once after accept, dismiss, or error.
2. **Desktop layout contract**: tracked and generated manifests no longer request portrait orientation or publish `navLayout=phone`; responsive layout still follows the actual window.
3. **Manifest drift**: production post-build validation now fails if public, docs, and dist manifests differ semantically, including shortcut icon MIME metadata.
4. **Safari storage boundary**: all eight locales state that the installed Safari app is separate, may require sign-in again, and must be verified before Safari data is removed; no automatic transfer or universal-backup claim was added.
5. **Offline recovery**: the fallback handles valid JSON locale storage, malformed storage, titles and RTL; worker navigation falls back from network to app shell to the precached offline document to an explicit error.
6. **Shared-origin cache safety**: active literal runtime caches use `zenflow-*`; unused origin-wide cache/lifecycle commands were removed. Ambiguous legacy cache deletion was rejected because ownership is not proven.
7. **Background Sync truthfulness**: comments and contracts describe only an open-client wake hint; closed-browser queue execution is not claimed.
8. **Native boundary**: Android and iOS production web builds prune the manifest, offline document, 1024 maskable icon and desktop Windows assets while retaining the required 192px icon.
9. **Icon quality**: the new 1024px maskable icon is generated from the frozen canonical leaf and passes the existing hash/shape asset gate; real OS rendering and artistic acceptance remain separate.
10. **Evidence freshness**: Playwright gained a repository-local `output/` JSON reporter path guard so a stale receipt cannot be mistaken for the current 12-pass/2-skip run.

## Open Findings and Attribution

- `ci:preflight` reaches the final ratchet after 717 files / 9094 passing tests and then fails on inherited `inlineStyles=358` versus max 323. The clean base independently reports the same 358 count; this candidate adds no inline style.
- `constitution:check` fails on the clean base at 941 source files versus 935 and 601 test files versus 592. The candidate reports 942/601; its net impact is one new source file and no counted test-file drift.
- `npm audit` reports two HIGH and one MODERATE issue in the full dependency graph and one HIGH production issue. `package.json` and the lockfile are unchanged, so dependency remediation is a separate reviewed batch rather than an unscoped PWA edit.
- Snyk Code lists 23 pre-existing findings outside changed files and then returns HTTP 403. The local suite passes Gitleaks, TruffleHog, Trivy, Checkov and KICS; Terrascan exits on unrelated Playwright YAML/node_modules input. Security-wide status therefore remains partial/`UNVERIFIED`, not `PASS`.
- Real Safari Add to Dock, Windows Edge install/Start/taskbar/update/policy behavior, installed mobile safe areas, signed Tauri/native artifacts, public deployment provenance, native-speaker review, assistive-technology user review and Role 10 isolation are `UNVERIFIED`.

## Scope and Duplication Review

- No second service worker, manifest system, app store, analytics path, data store, auth bridge, desktop wrapper, or production dependency was introduced.
- IndexedDB schema, hydration, sync semantics, account ownership, routes and canonical orb rendering are unchanged.
- The legacy `InstallBanner` was not revived or deleted; unrelated removal lacks a separately proved user failure mode.
- Generic legacy caches are retained because automatic deletion on the shared GitHub Pages origin would carry a larger ownership risk than their bounded quota residual.
- Public deployment, Store packaging, signing, auth/data migration, notification campaigns, badges, file/protocol handlers and window-controls-overlay remain outside authority.

## Test Quality Review

The retained clean-base receipt has four intended failures: portrait lock, stale shortcut layout parameter, missing early install capture and non-namespaced caches. Candidate receipts then prove 384/384 focused tests and 12 expected Playwright passes with two documented engine-specific skips. The full suite proves 9094 passes plus seven existing todos. Source assertions are paired with build/runtime evidence; isolated fixtures are test-only and no synthetic business records enter production output.

## Analysis Verdict

The source implementation, generated artifacts, focused/runtime proof and local rollback converge for the authorized PWA scope. There is no explained candidate-caused P0/P1 failure. Local implementation status is `PASS`; merge/release status is `STOP` until inherited blocking gates are owned and the required real platform, public, human and independent-sentinel evidence is available.
