# Research: Existing ZenFlow Evaluation Surface

**Feature**: [spec.md](./spec.md)  
**Date**: 2026-08-04

## Findings used by the design

| Local evidence | Observed fact | Design consequence |
| --- | --- | --- |
| `config/persistent-agent-orchestra.json` | The registry defines exactly ten canonical role IDs and routing metadata. | The harness accepts role IDs only from a supplied canonical registry snapshot. |
| `config/persistent-agent-orchestra.evals.json` and `scripts/run-persistent-agent-orchestra-evals.mjs` | The current 40-scenario catalog is a structural, synthetic fixture; its prepared packet is not execution evidence. | The A/B/C pilot does not use catalog success as a quality result. |
| `config/persistent-agent-orchestra.eval-baseline.json` | The baseline declares `NO_SEMANTIC_BASELINE`. | `PROMOTABLE` is denied when required evidence is unavailable. |
| `docs/ai/PERSISTENT_AGENT_ORCHESTRA_EVAL_PROTOCOL.md`, section 10 | A valid comparison freezes the task/runtime/tool/rubric conditions, compares three arms, and does not decide by majority. | The report has six shared identity hashes, exact arm cardinality, and hard-blocker checks. |
| `scripts/persistent-agent-orchestra/eval-core.mjs` | Repository tooling already uses SHA-256 identities, strict JSON parsing, and safe writes under the repository. | The new harness follows the same standard library and output boundary; it adds no dependency. |
| `.gitignore` | `output/**` and `.preflight-token*` are ignored. | Prepared and completed pilot receipts are local operator artifacts. |
| `docs/ai/CODEX_KIMI_WORKSPACE_PROTOCOL.md` | Governance edits require a locked actor-specific worktree and edit doctor. | All changes and pilot artifacts are created in the `codex/agent-routing-ab-eval` worktree only. |

## Rejected alternatives

| Alternative | Rejection reason |
| --- | --- |
| Treat `check:agent-orchestra` as proof that all roles are useful. | It proves configuration/generation consistency, not semantic or task outcome quality. |
| Use a fabricated benchmark or user records. | It would not answer the user's current governance question and risks prohibited fabricated/runtime data. |
| Automatically call a paid or remote model API. | No external side effect, paid service, or model credential was authorized. |
| Calculate one composite score and name a winner. | The protocol requires critical misses, conflicts, and evidence gaps to remain visible. |
| Modify hook timeouts as part of the experiment. | That would confound the comparison and changes production agent safeguards before causal evidence exists. |
