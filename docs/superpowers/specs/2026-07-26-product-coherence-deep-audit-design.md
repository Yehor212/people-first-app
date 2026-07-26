# ProductCoherenceAudit v1 design

## Boundary

ProductCoherenceAudit is a deterministic, read-only comparison between
`production-baseline` and `candidate`. It reads repository files and bounded
audit ledgers; it never reads or writes ZenFlow runtime stores, IndexedDB,
Supabase, user history, or production state. The candidate provenance stores
only status, diff, sanitized-untracked-manifest, privacy-scan-receipt, and
snapshot SHA-256 digests. Denied file contents are not copied.

This contract proves local audit-ledger structure. It does not prove product
acceptance, deployed behavior, native parity, or `AUDIT_COMPLETE`.

## Audit manifest and provenance

`manifest.jsonl` contains exactly one strict `AuditManifest`:

- `runId`, schema version, request/policy/tool/source SHA-256 digests,
  redaction rules, and role receipts;
- exactly one `production-baseline` and one `candidate` subject;
- repository provenance with an explicit Git OID algorithm. SHA-1 repositories
  use 40-hex commit/tree OIDs; SHA-256 repositories use 64-hex OIDs. Git OIDs
  are never stored in fields named SHA-256;
- discriminated build/deploy stages using only `PASS`, `FAIL`, `N/A`, or
  `UNVERIFIED`. `N/A` and `UNVERIFIED` carry a reason and reject fabricated
  artifact hashes;
- successful public deployment provenance includes the public URL, artifact
  SHA-256, and deployed Git revision. The deployed revision may legitimately
  differ from the fetched production commit.

## Ledgers

- `evidence.jsonl` contains `EvidenceRecord` rows with `subjectId`, exact
  evidence class/type, a discriminated locator, observation time, tool/version,
  scope, `PASS|FAIL|N/A|UNVERIFIED` result, artifact digest, privacy class, and
  invalidation triggers. Local artifact locators are relative to the ledger
  root and their SHA-256 is recomputed during validate/report. External or
  unverifiable evidence uses an explicit non-local locator kind.
- `capabilities.jsonl` contains `CapabilityRecord` rows with exact reachability,
  capability-role and product-disposition enums; user job/role; surfaces,
  platforms, locales and cohorts; full trace nodes; permissions, data actions,
  dependencies, promises, and same-subject evidence IDs.
- `decisions.jsonl` separates observation from hypothesis and records options,
  the selected option, rejected alternatives, `P0`–`P3`, confidence, hard
  gates, owner, affected cohorts, acceptance/kill/rollback criteria, metrics,
  trade-offs, and evidence. Its selected disposition must match its capability.
- `findingHistory.jsonl` is append-only. Sequence starts at zero, timestamps
  never move backward, and the exact state path is
  `DISCOVERED → TRIAGED → DECIDED → IMPLEMENTING → VERIFIED|REJECTED|BLOCKED|ROLLED_BACK`.
  Each history references its decision and evidence. Reports render every
  event, not only the terminal state.

`BLOCKED_UNVERIFIED` is the approved unresolved disposition. It requires a
named blocker and owner on both the capability and selected decision; no
replacement unresolved enum is introduced.

## Privacy and filesystem integrity

The privacy guard rejects raw journal, mood, habit, device identifier, phone,
account identifier, token, credential, password, secret, email, and contact-ID
keys. It also rejects credential-, email-, and phone-like strings under
otherwise harmless keys. It permits non-sensitive audit metadata including
`deviceScope` and `accountCohort`.

Ledger files must be strict UTF-8 regular files inside the resolved input
directory. Symlinks and realpath escapes fail closed. Each JSONL file is bounded
to 4 MiB, 256 KiB per line, 10,000 lines, and 5,000 records. Local artifacts
are likewise regular in-root files and are hashed with before/after identity
checks.

## Commands

```text
npm run audit:product-coherence:inventory -- --root <repository> --subject production-baseline|candidate
npm run audit:product-coherence:validate -- --input <ledger-directory>
npm run audit:product-coherence:report -- --input <ledger-directory>
```

`inventory` walks reviewable source/config/docs/public-surface files in stable
path order, skips dependency/build/private control directories and secret file
names, and emits only path/type/content-hash candidates. It emits no
reachability, product disposition, or decision. Task 2 may extend the candidate
families without weakening that neutral boundary.

`validate` emits stable JSON and recomputes local artifact hashes. `report`
requires the same validation and derives Markdown from ledgers. Markdown is
never source of truth.
