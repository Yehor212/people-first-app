# Data Model: Agent Governance Evidence

## 1. Local Observation Receipt

| Field | Type / allowed value | Purpose | Privacy / evidence rule |
|---|---|---|---|
| `schema_version` | exact integer `1` | Version the bounded receipt | Required |
| `evidence_class` | `LOCAL_PROCESS_OBSERVED` | Names the only fact class created locally | Never equals host-runtime proof |
| `observed_at` | exact ISO timestamp | Bounded timing context | Current local clock only |
| `repository` | hook path SHA-256 and root-relative hook path | Binds observation to source | No absolute path |
| `observation` | hook event name, exit class, primary decision class | Controlled child-process result | No raw input/output/transcript |
| `host_runtime` | exact `UNVERIFIED` fields | Declares non-observed profile loading / permissions / scheduling | Cannot be caller-upgraded by this CLI |
| `limitations` | non-empty string array | Names remaining gaps | Required |

The receipt intentionally excludes user prompt text, tool commands, patches,
message bodies, filenames outside the allowlist, session identifiers, tokens,
credentials, and raw process stderr/stdout.

## 2. Optional Receipt Storage

| Property | Rule |
|---|---|
| Parent | `output/agent-orchestra/` only, inside resolved real repository root |
| Name | Lowercase bounded `.json` filename selected by CLI-safe grammar |
| Creation | create-only; duplicate, symlink, nonregular target, or escape fails |
| Mode | `0600` |
| Default | no file; JSON receipt goes to stdout |
| Retention | operator-controlled ignored artifact; not committed or deleted by this feature |

## 3. Routing A/B Promotion Prerequisite Ledger

| Prerequisite | Local evaluator state | Why it cannot promote locally |
|---|---|---|
| Task-slice identity | recomputed SHA-256 | Detects drift but does not prove execution quality |
| Output actor identity | exact declared execution set | Binds artifacts but does not prove profile load |
| Runtime profile loading | `UNVERIFIED` without launcher receipt | Config/source is declarative |
| Effective permissions | `UNVERIFIED` without effective inventory + synthetic denial | Declared sandbox is not proof |
| Owner-controlled holdout | `UNAVAILABLE` without owner evidence | Must not be self-authored |
| Qualified review | `UNVERIFIED` without qualified receipt | Must not be self-authored |
| Usage ledger | `UNAVAILABLE` without trusted source | Numeric local claims are not ledger evidence |
| Decision | `PILOT_NONPROMOTABLE` only locally | External authenticated path is out of scope |

## 4. PDI Checker Failure Category

| Category | Origin | Hook outcome | Exposed content |
|---|---|---|---|
| `CHECKER_TIMEOUT` | child process timed out | blocking | bounded timeout + manual checker command |
| `CHECKER_ERROR` | child spawn/config/JSON failure | blocking | stable category; no raw path/error text |
| `FINDING` | checker returns active finding | blocking | bounded rule/path summary already governed by checker |
| `CLEAN` | checker returns valid PASS | normal continuation | no success claim beyond local result |

## 5. Interrupted A/B Receipt

| Field | Rule |
|---|---|
| Report status | `PILOT_INTERRUPTED` is a terminal local state, not a completed comparison. |
| Interrupted arm | At least one arm is `INTERRUPTED`; it has `interruption_count >= 1`, no outputs, and no final review. |
| Other arms | May be `PREPARED` or fully `COMPLETED` under their normal validation rules. |
| Decision | Always `PILOT_NONPROMOTABLE`, with `PILOT_INTERRUPTED` and `ARM_INTERRUPTED` reason codes. |
| Evidence boundary | Partial work is not presented as completed output; actor provenance and host behavior remain `UNVERIFIED`. |
