# Data Model: Agent Routing A/B/C Receipt

**Feature**: [spec.md](./spec.md)

## `RoutingAbReport`

| Field | Meaning | Integrity rule |
| --- | --- | --- |
| `run_id` | Operator-assigned run identity. | Bounded non-empty identifier. |
| `status` | `PREPARED`, `PILOT_COMPLETED`, or `PILOT_INTERRUPTED`. | Prepared reports contain no completed/interrupted arm; completed pilots contain three completed arms; interrupted pilots contain at least one interrupted arm and are permanently non-promotable. |
| `task_slice` | Privacy-safe prompt, source locators, privacy boundary, and SHA-256 identity. | Every arm must echo the exact `task_slice_sha256`. |
| `shared_conditions` | Artifact, runtime, tool-surface, budget, and rubric identities plus randomized arm order. | Every arm must match all five hashes; arm order is an exact permutation. |
| `arms` | One record for each required routing strategy. | Exact cardinality and unique IDs: `ROOT_ONLY`, `TARGETED`, `FIXED_FULL_TEN`. |
| `decision` | `PILOT_NONPROMOTABLE` or `PROMOTABLE` with exact reasons. | Promotion requires complete counters, verified holdout/review/runtime, and no critical miss. |

## `ArmRecord`

| Field | Meaning | Integrity rule |
| --- | --- | --- |
| `arm_id` | Routing strategy. | Must be one of the exact three canonical arm IDs. |
| `status` | `PREPARED`, `COMPLETED`, or `INTERRUPTED`. | Completed arms require output identities, measurements, a positive invocation count, and review ledger. Interrupted arms retain only measurements with a positive interruption count; they cannot contain partial output or a final review. |
| `routing` | Executed roles plus targeted selection ledger. | Targeted arm records a selected/excluded disposition and evidence locator for all ten roles; fixed full ten executes each canonical role exactly once. |
| `outputs` | Privacy-safe raw-output SHA-256 identities and actor IDs. | Non-empty only for a completed arm; no hash can occur in more than one arm. |
| `measurements` | Elapsed time, invocation count, retries, interruptions, and usage ledger. | Counts are non-negative integers or the literal `UNAVAILABLE` only where allowed. |
| `review` | Critical misses, forbidden outcomes, evidence coverage, reviewer/holdout status, and conflicts. | Missing review evidence remains explicit; it never becomes a zero score. |

## Usage Ledger

The required keys are `request_count`, `input_tokens`, `cached_input_tokens`,
`cache_write_tokens`, `output_tokens`, and `reasoning_tokens`. A numeric value is a
local observation, not billed-token proof unless its provider receipt is separately
retained. `UNAVAILABLE` is valid for a pilot but prevents `PROMOTABLE`.

## State transition

```text
PREPARED
  -> exactly three same-condition arm records
  -> PILOT_COMPLETED + PILOT_NONPROMOTABLE
  -> (new owner-controlled holdout and required trusted receipts)
  -> separately eligible PROMOTABLE comparison
```

No report state writes into the ZenFlow application, IndexedDB, Supabase, analytics,
backup/export, GitHub, or deployment pipelines.
