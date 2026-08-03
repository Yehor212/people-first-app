# Data Model: Safe Delivery of the Preserved Pending Batch

This feature does not add a production data model. It defines a repository-delivery evidence model whose records contain Git metadata and verification results only.

## Entities and invariants

### OwnerCheckoutBaseline

| Field | Meaning | Invariant |
|---|---|---|
| `head` | Original owner-checkout commit | Remains `00fdb2ea0e5205f4bee76bbec3109bf98865627f` during isolated work |
| `branch` | Original owner branch | Remains `main` |
| `status_record_count` | Porcelain-v2 records | Exactly 898 at the captured boundary |
| `status_sha256` | Digest of the exact NUL-delimited status stream | Must return to `c27da64f8305c01fe29c2081dbc33c8486f784abfdb269db54f8f76cb46cb56a` at handoff |
| `guard_file_receipts` | Hash, byte count, and mode of ignored guard files | Restored byte-for-byte before completion |

### SafetySnapshot

| Field | Meaning | Invariant |
|---|---|---|
| `commit` | Immutable Git commit | `c902b612050dd891e5aa86958ebf8bb7f2e9f5ba` remains reachable from merged history |
| `parent` | Baseline commit | Matches owner baseline HEAD |
| `tree` | Snapshot tree identity | Immutable Git object |
| `path_count` | Legitimate changed paths | Exactly 893 |
| `path_sha256` | Sorted NUL-delimited path-set digest | Matches specification |

### ExcludedArtifact

An exact generated `.dccache` path excluded from the legitimate snapshot and final tree. The set contains five unique paths. Exclusion is allowed because these are generated compiler/cache artifacts rather than source, user data, or authored evidence.

### ReconciliationRecord

One record per snapshot path with exactly one disposition:

- `already_in_main`: snapshot, integrated, and main tree entries are identical.
- `preserved_net_change`: snapshot equals integrated tree and differs from main.
- `superseded_by_main`: integrated tree equals main and differs from snapshot.
- `integrated_resolution`: integrated tree differs from both snapshot and main, including explicit conflict unions or evidence-based replacements.

The 893 records form a total, disjoint partition. Renames are evaluated by final path/tree identity rather than inferred similarity.

### VerificationReceipt

| Field | Meaning | Invariant |
|---|---|---|
| `id` | Stable check identifier | Unique in the packet |
| `command` | Exact invoked command or probe | Contains no secret values |
| `scope` | Files/platform/domain actually checked | Cannot exceed tool coverage |
| `started_at` / `completed_at` | UTC timestamps | Current run only |
| `exit_code` | Process result | Integer when a process ran |
| `counts` | Tests/findings/files where emitted | Must match retained output |
| `status` | `VERIFIED`, `FAIL`, `UNVERIFIED`, or `SKIP` | Missing evidence cannot be `VERIFIED` |
| `limitations` | Unchecked claims | Required when evidence is partial |

### GitHubDelivery

Tracks branch name, pushed SHA, pull-request number/URL, required checks bound to SHA, merge method, merge SHA, post-merge checks, and snapshot ancestry proof. It may reach `merged_verified` only after required pull-request and post-merge checks satisfy the repository policy.

## State transitions

```text
owner_captured
  -> snapshot_verified
  -> main_integrated
  -> spec_analyzed
  -> local_checks_green
  -> branch_pushed
  -> pull_request_checks_green
  -> merged
  -> main_checks_green
  -> owner_restored
  -> converged
```

Any failed required check moves the delivery to `blocked` until corrected and rerun. It never skips directly from `FAIL` or `UNVERIFIED` to `converged`.

## Data lifecycle and privacy

- Creation: records derive from Git object IDs, local command outputs, and GitHub check metadata.
- Storage: tracked JSON/Markdown inside this feature directory; transient full logs remain local or in GitHub Actions.
- Validation: JSON Schema plus exact recomputation from Git and check APIs.
- Publication: repository metadata only; no production payloads, user content, tokens, or environment values.
- Retention: retained with the merge for audit and rollback lineage.
- Deletion: ordinary future repository change through review; never needed to roll back product data.
