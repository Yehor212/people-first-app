# ProductCoherenceAudit v1 design

## Purpose and boundary

ProductCoherenceAudit is a read-only, two-subject repository audit. `baseline`
is the fetched production subject and `candidate` is the separately recorded
dirty checkout. It records hashes, source locators, and metadata only; it does
not read, copy, or write application/runtime data. It is not a product decision,
runtime proof, platform acceptance, or `AUDIT_COMPLETE` closure claim.

## Approved records and ledgers

The input directory contains these required JSONL ledgers. Every durable row
that describes a subject carries `subjectId`.

- `manifest.jsonl`: exactly one `AuditManifest`, with `runId`, schema version,
  request/policy/tool/source hashes, redaction rules, role receipts, and both
  subject records. Each subject has repository, build, and deploy provenance.
  Candidate repository provenance additionally requires status and tracked-diff
  hashes, never copied denied content.
- `evidence.jsonl`: `EvidenceRecord` rows with class, type, time, tool and
  version, scope, result, artifact hash, privacy class, and invalidation rules.
- `capabilities.jsonl`: `CapabilityRecord` rows with reachability,
  disposition, user job and role, surfaces, platforms, locales, cohorts, trace,
  permissions, data actions, dependencies, promises, and source evidence.
- `decisions.jsonl`: `DecisionRecord` rows linked to a subject, capability, and
  evidence. A decision is explicit; no command supplies a missing disposition.
- `findingHistory.jsonl`: `FindingHistory` rows linked to a subject and
  capability. The only lifecycle is
  `START → DISCOVERED → TRIAGED → DECIDED → IMPLEMENTING → VERIFIED`, with
  explicit rejected, blocked, and rolled-back branches.

The capability reachability enum is `REACHABLE`, `UNREACHABLE`, or `UNKNOWN`.
Its disposition enum is `IN_SCOPE`, `EXCLUDED_WITH_EVIDENCE`, or
`UNRESOLVED_CANDIDATE`. A candidate row in the unresolved state is a validation
failure, never an inferred classification.

Strict Zod schemas reject duplicate IDs, missing subject provenance,
cross-subject references, missing referenced records, invalid lifecycle edges,
and invalid candidate provenance. The privacy guard rejects raw sensitive
payload field names and credential/email-like values while allowing legitimate
metadata such as `deviceScope` and cohort labels.

## Deterministic commands

All commands require `--input <ledger-directory>` and only write standard
output or standard error; they do not create or modify files.

```text
npm run audit:product-coherence:inventory -- --input <ledger-directory>
npm run audit:product-coherence:validate -- --input <ledger-directory>
npm run audit:product-coherence:report -- --input <ledger-directory>
```

`inventory` gathers the already-ledgered candidate records in sorted order and
does not enumerate the repository or invent a disposition. Repository
enumeration is Task 2 work. `validate` emits stable JSON. `report` derives
sorted Markdown from valid ledgers only; Markdown is never source of truth.
