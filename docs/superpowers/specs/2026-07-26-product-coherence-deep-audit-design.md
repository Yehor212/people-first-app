# ProductCoherenceAudit v1 design

## Boundary

ProductCoherenceAudit is a deterministic, read-only comparison between
`production-baseline` and `candidate`. It reads repository files and bounded
audit ledgers; it never reads or writes ZenFlow runtime stores, IndexedDB,
Supabase, user history, or production state. Candidate provenance stores
status/diff digests plus artifact-root-relative locators and SHA-256 digests
for a sanitized untracked manifest, privacy scan receipt, and candidate
snapshot. Denied file contents are not copied into ledgers.

This contract proves local audit-ledger structure and artifact identity. It does
not by itself prove product acceptance, deployed behavior, native parity, or
the truth of an inventory mapping. `AUDIT_COMPLETE` is accepted only when both
subject reconciliation artifacts are present and rehashed, their count
identities balance, both have zero unclassified candidates, all 17 canonical
phase receipts are `GO`, and the separate coordinator integration receipt is
`GO`. Task 2 supplies the candidate-to-capability/exclusion reconciliation
ledger behind those counts; Task 6 owns the terminal run and may set
`AUDIT_COMPLETE` only after the whole bundle has fresh evidence. The
remediation-release state remains a separate closure outcome.

## Audit manifest and provenance

`manifest.jsonl` contains exactly one strict `AuditManifest`:

- `runId`, schema version, request/policy/tool/source SHA-256 digests, a bounded
  observation window, redaction rules, and a registry-version/digest binding;
- canonical role receipts are a subset of the exact 17-phase adaptive
  `DEEP_AUDIT` topology emitted by
  `node scripts/run-ten-lens-assurance.mjs --classify --trigger DEEP_AUDIT`.
  Role 1's coordinator integration is modeled separately rather than renamed
  as a specialist phase. Every receipt covers both subjects and has a unique
  artifact path/digest. Validate/report rehash the privacy-safe receipt JSON
  and reconcile its role, phase, subjects, and verdict with the manifest row;
- optional per-subject inventory reconciliation rows carry candidate,
  capability-mapped, evidence-backed exclusion, and unclassified counts plus a
  canonical artifact locator/digest. The total must equal the three outcome
  counts. Terminal audit closure requires exactly one row for each subject and
  zero unclassified candidates;
- exactly one `production-baseline` and one `candidate` subject;
- repository provenance with an explicit Git OID algorithm. SHA-1 repositories
  use 40-hex commit/tree OIDs; SHA-256 repositories use 64-hex OIDs. Git OIDs
  are never stored in fields named SHA-256;
- discriminated build/deploy stages using only `PASS`, `FAIL`, `N/A`, or
  `UNVERIFIED`. `N/A` and `UNVERIFIED` carry a reason and reject fabricated
  artifact hashes. `PASS` build/deploy stages require same-subject direct
  evidence references whose artifact digest exactly matches the stage digest;
- successful public deployment provenance includes the public URL, artifact
  SHA-256, and deployed Git revision. The deployed revision may legitimately
  differ from the fetched production commit.

## Ledgers

- `evidence.jsonl` contains `EvidenceRecord` rows with `subjectId`, exact
  evidence class/type, a discriminated locator, observation time, tool/version,
  scope, `PASS|FAIL|N/A|UNVERIFIED` result, artifact digest, privacy class, and
  invalidation triggers. Local artifact locators are relative to an explicit
  real artifact root and their SHA-256 is recomputed during validate/report.
  The artifact root defaults to the ledger root for compatibility, but the
  canonical audit layout supplies `--artifact-root artifacts/product-coherence/...`
  so privacy-safe screenshots and traces do not need to be copied under
  `docs/audits/...`. Absolute roots are process arguments, never ledger data.
  Repository
  source locators use a normalized repository-relative path plus the exact
  subject revision. Validate/report always require both `--subject-root`
  arguments and verify each Git top-level, commit, and tree even if the current
  ledger happens to cite only local artifacts. The production baseline must be
  clean, and production source evidence is read from the named commit's Git
  blob rather than mutable worktree bytes. For `candidate`, the validator also
  recomputes the canonical
  newline-delimited `git status --porcelain=v1 --untracked-files=all` hash and
  `git diff --binary HEAD --` hash before accepting repository-source
  evidence. It regenerates the sanitized untracked manifest from NUL-delimited
  Git paths and current file bytes. The manifest exposes only each path's
  SHA-256 and content SHA-256, so a same-path content change invalidates the
  snapshot without publishing the path. Its clean privacy receipt and canonical
  composite snapshot JSON are independently rehashed and reconciled with one
  another and the manifest. External or unverifiable evidence uses an explicit non-local
  locator kind. Evidence class, type and locator combinations are closed enums;
  every row covers exactly one platform and its observation time must fall
  inside the declared run window. Both subjects require direct evidence and
  evidence/capability/decision/finding-history coverage.
- `capabilities.jsonl` contains `CapabilityRecord` rows with exact reachability,
  capability-role and product-disposition enums; user job/role; surfaces,
  platforms, locales and cohorts; full trace nodes; permissions, data actions,
  dependencies, promises, and same-subject evidence IDs. Platforms use the
  audit platform matrix and locales use ZenFlow's exact eight-locale set,
  including the `ar`/`he` RTL surfaces.
- `decisions.jsonl` separates observation from hypothesis and records options,
  the selected option, rejected alternatives, `P0`–`P3`, confidence, hard
  gates, owner, affected cohorts, acceptance/kill/rollback criteria, metrics,
  trade-offs, and evidence. Its selected disposition must match its capability.
  Every option ID is unique and every non-selected option is rejected exactly
  once. `HIGH` confidence requires at least one `PASS` result from direct local
  or direct runtime evidence. Failed, `N/A`,
  `UNVERIFIED`, authoritative-external, inferred, unknown, or agent-opinion
  evidence is insufficient. A human-research result can support `HIGH` only
  when it is `PASS`, uses the closed `HUMAN_RECEIPT` locator, and its bounded
  canonical `schemaVersion`/`receiptId`/`studyStatus: COMPLETE` artifact is
  present, rehashed, and identity-matched during local validation; the receipt
  still cannot generalize beyond its declared study scope.
- `findingHistory.jsonl` is append-only. Sequence starts at zero, timestamps
  never move backward, and the exact state path is
  `DISCOVERED → TRIAGED → DECIDED → IMPLEMENTING → VERIFIED|REJECTED|BLOCKED|ROLLED_BACK`.
  Each history references its decision and evidence. Every capability has
  exactly one same-subject decision and history. Reports render every event,
  not only the terminal state.

`BLOCKED_UNVERIFIED` is the approved unresolved disposition. It requires a
named blocker and owner on both the capability and selected decision; no
replacement unresolved enum is introduced.
Its history must end in `BLOCKED`, never `VERIFIED`; a non-blocked decision
cannot hide a terminal `BLOCKED` history.

## Privacy and filesystem integrity

The privacy guard rejects raw journal, mood, habit, device identifier, phone,
account identifier, token, credential, password, secret, email, and contact-ID
keys. It also rejects credential-, email-, compact-phone-, IMEI-, UUID-, and
JWT-like strings under otherwise harmless keys. `deviceScope` and
`accountCohort` are bounded enums rather than identifier-bearing free text.

Ledger files must be strict UTF-8 regular files inside the resolved input
directory. Symlinks, replacement races, and realpath escapes fail closed.
Each JSONL file is opened no-follow and checked against descriptor identity,
current path identity, and resolved-root confinement before its bounded bytes
are parsed. Each file is bounded to 4 MiB, 256 KiB per line, 10,000 lines, and
5,000 records. Local artifacts and repository sources are likewise regular
in-root files and are hashed through a no-follow descriptor with before/after
descriptor identity, current path identity, and realpath confinement checks.
Inventory uses the same identity discipline, rejects replacement during
hashing, and orders names by UTF-8 bytes for host-independent output.

## Commands

```text
npm run audit:product-coherence:inventory -- --root <repository> --subject production-baseline|candidate
npm run audit:product-coherence:validate -- --input <ledger-directory> --artifact-root <artifact-directory> --subject-root production-baseline=<git-root> --subject-root candidate=<git-root>
npm run audit:product-coherence:report -- --input <ledger-directory> --artifact-root <artifact-directory> --subject-root production-baseline=<git-root> --subject-root candidate=<git-root>
```

`inventory` walks reviewable source/config/docs/public-surface files in stable
path order, skips dependency/build/private control directories and secret file
names, and emits only path/type/content-hash candidates. It emits no
reachability, product disposition, or decision. Task 2 may extend the candidate
families without weakening that neutral boundary.

`validate` emits stable JSON and recomputes local artifact, human-research
receipt, manifest-owned provenance/role/inventory-reconciliation, and
repository-source hashes. `--artifact-root` defaults to the ledger input
directory. Both subject-root flags are always required.
`report` requires the same validation and derives Markdown with separate
production/candidate sections, status, build/deploy provenance, role verdicts,
inventory counts, evidence result/platform, capabilities, decisions,
confidence, trade-offs, acceptance/kill/rollback criteria, and complete finding
histories. Markdown is never source of truth.
