# Visible-Pilot Summary: Agent Routing A/B/C

**Run ID**: `agent-routing-ab-2026-08-04T06-43-33-280Z-8bcf482610b6`  
**Receipt**: ignored local `output/agent-orchestra/agent-routing-ab-2026-08-04T06-43-33-280Z-8bcf482610b6-completed.json`  
**Decision**: `PILOT_NONPROMOTABLE`

## What was actually held constant

The receipt validator confirmed one task-slice SHA-256, one artifact snapshot,
runtime identity declaration, tool-surface declaration, budget declaration, rubric
declaration, and retained randomized order: `TARGETED → FIXED_FULL_TEN → ROOT_ONLY`.
It also verified the SHA-256 bytes of every retained raw output and rejected duplicate
output identities.

| Arm | Actual collaboration invocations | Elapsed / usage telemetry | Raw-output integrity | Evaluation status |
| --- | ---: | --- | --- | --- |
| `ROOT_ONLY` | 1 | `UNAVAILABLE` / all usage counters `UNAVAILABLE` | 1 hash-bound local raw receipt | Structure valid, non-promotable |
| `TARGETED` | 6 | `UNAVAILABLE` / all usage counters `UNAVAILABLE` | 6 hash-bound local raw receipts | Structure valid, non-promotable |
| `FIXED_FULL_TEN` | 10 | `UNAVAILABLE` / all usage counters `UNAVAILABLE` | 10 hash-bound local raw receipts | Structure valid, non-promotable |

The counts are observations of dispatched collaboration runs, not billed-token data.
The full-ten control used four more invocations than the targeted route. No elapsed-time
or cost comparison is valid because the host did not expose trusted counters.

## Observations from this exact task slice

Every arm identified the same source-level separation: role routing assigns review
ownership, hooks guard supported lifecycle events, and rules constrain evidence and
authority. This is current-source evidence, not proof of runtime loading or semantic
effectiveness.

The following appeared in retained raw receipts but were not independently adjudicated as
critical misses in another arm; they are task-specific candidates for a later holdout:

| Observation | Raw-receipt arm(s) | Boundary |
| --- | --- | --- |
| Hook files do not mechanically verify `SELECTED`/`EXCLUDED` role routing. | Targeted logic; targeted blind Pass A | Static coupling gap only; no hook-delivery receipt. |
| `skill-router-gate` appends a local ignored audit log and suppresses write errors. | Targeted reliability; full logic; full blind Pass A | Source code confirms `appendFileSync`; attribution of any pre-existing legacy-root log change to this pilot was not established. |
| Role 2, Role 4, and Role 9 declare their own task-specific trigger boundaries and found no direct product/emotion/UI/product-acceptance input in this governance slice. | Full ten only | Strong evidence that full-ten includes irrelevant lenses for this slice; not evidence that they are useless for their own triggers. |
| Hook timeouts exist, but a runtime retry/recovery/SLO receipt is absent. | Full reliability | Static configuration observation; host timeout behavior remains untested. |

## What this pilot does and does not establish

`VERIFIED`:

- The local harness rejects malformed/mismatched/duplicate reports and checks output-byte hashes.
- The three requested routes were actually dispatched in the retained randomized order.
- The exact invocation count was 1 / 6 / 10 for this visible task.
- Current sources define different structural responsibilities for routing, hooks, and rules.

`UNVERIFIED`:

- Effective custom-profile loading, sandbox permissions, hook delivery/order/timeout behavior, semantic correctness, independent human review, real-user impact, platform runtime behavior, elapsed-time/cost, and token usage.
- Whether an observation from one arm is a material miss by another arm; this requires owner-controlled holdout criteria and qualified adjudication.
- Whether any role should be removed, whether a hook should be weakened/removed, or whether a routing policy should be promoted.

## Read-only containment note

A report from one full-ten reviewer claimed fresh audit-log entries during its read-only
session. The coordinator checked only metadata: the legacy root contained an ignored
`.codex-audit.log`, while the isolated evaluation worktree did not. There was no pre-run
metadata baseline for the legacy root, so attribution is `UNVERIFIED`. Its content was not
read and no file was deleted. This is a governance/privacy follow-up, not proof of a
pilot-created write.

## Cross-platform status

Web/Vite, installed PWA, Android/Capacitor, iOS/WKWebView, and Desktop/Tauri are `N/A`
for product behavior: the pilot changes only local governance tooling and did not run any
app/runtime/native/device/release flow. Any indirect future-delivery effect is `UNVERIFIED`.
