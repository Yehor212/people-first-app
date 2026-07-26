# ProductCoherenceAudit v1 design

## Purpose and boundary

ProductCoherenceAudit compares two repository subjects without reading, copying,
or writing application/runtime data. `baseline` is the fetched production
subject; `candidate` is the separately recorded dirty checkout. The audit
stores only source locators and SHA-256 values. It never accepts raw journal,
mood, habit, account, credential, token, device, contact, or ignored-env data.

## Source ledgers

The input directory contains exactly these JSONL ledgers:

- `manifests.jsonl`: one `baseline` and one `candidate` manifest. Each has a
  `subjectId` and snapshot hash. The candidate additionally requires status and
  tracked-diff hashes; it carries no denied file content.
- `evidence.jsonl`: source locator records. Every row has `evidenceId` and
  `subjectId`.
- `capabilities.jsonl`: inventory classification records. Every row has
  `capabilityId`, `subjectId`, `evidenceId`, and an explicit disposition.
- `findings.jsonl`: findings tied to the same subject and capability. Every
  row has `findingId`, `subjectId`, `capabilityId`, and an append-only state
  transition list.

All rows are validated with strict Zod schemas. Duplicate identifiers,
cross-subject references, missing references, a candidate `UNRESOLVED`
capability, a missing candidate provenance record, forbidden sensitive field
names, and invalid finding transitions fail validation. Allowed transitions are
`OPEN → VERIFIED|BLOCKED_UNVERIFIED`, `VERIFIED → RESOLVED|REJECTED|BLOCKED_UNVERIFIED`,
and `BLOCKED_UNVERIFIED → VERIFIED`.

## Deterministic commands

All commands require `--input <ledger-directory>` and write their result only
to standard output or standard error. They do not create or modify files.

```text
npm run audit:product-coherence:inventory -- --input <ledger-directory>
npm run audit:product-coherence:validate -- --input <ledger-directory>
npm run audit:product-coherence:report -- --input <ledger-directory>
```

`inventory` outputs the sorted manifests, `validate` outputs a stable JSON
result, and `report` derives sorted Markdown from the validated ledgers. The
Markdown contains no authoritative disposition absent from the ledger, and an
invalid ledger cannot be rendered.

## Closure limit

This contract validates audit provenance and ledger coherence only. It does not
establish a product decision, user acceptance, runtime/platform proof, or an
`AUDIT_COMPLETE` closure state.
