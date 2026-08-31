# Contract: Build Capability Receipt

## Purpose

Bind release-sensitive capabilities to the exact source commit and target build without collecting runtime or user data. The first capability is the existing journal save ceremony. This contract prepares consistent evidence but does not admit the ceremony while artistic/craft and explicit user visual approval are missing.

## Schema

```json
{
  "schemaVersion": 1,
  "sourceCommit": "40-hex-git-commit",
  "platform": "web-pages | android | ios | tauri",
  "capabilities": { "journalSaveCeremony": false },
  "killSwitches": { "journalSaveCeremony": false },
  "admission": {
    "technical": "pass | fail | unverified",
    "accessibility": "pass | fail | unverified",
    "performance": "pass | fail | unverified",
    "visualRuntime": "pass | fail | unverified",
    "artisticCraft": "pass | fail | unverified",
    "userApproval": "pass | fail | unverified"
  }
}
```

## Generation rules

- `sourceCommit` is supplied from the checked-out Git commit and validated as exactly 40 lowercase hexadecimal characters.
- `platform` is an explicit build target, never inferred from the host OS.
- The shared release input is parsed strictly; missing, malformed, or conflicting values fail closed to disabled and fail receipt validation.
- The kill switch always wins.
- Schema v1 is deliberately non-enabling: `journalSaveCeremony` is always false even if every tracked admission string is changed to `pass`. Those strings are review metadata, not authenticated evidence.
- A later schema may permit true only after it verifies evidence hashes for the same commit/artifact set, an explicit owner approval authority, all six admission outcomes, and an inactive kill switch in a separately reviewed release change.
- The production value remains false in this epic until exact-candidate artistic/craft review and explicit user approval exist.
- Technical admission requires an actual saved-entry anchor and separate local-saved, cloud-pending, and cloud-failed semantics; a host-only overlay without these remains unadmitted.
- The receipt is deterministic JSON with stable key order. It contains no nondeterministic timestamp.

## Forbidden fields

No account, user, or device identifier; journal content or count; activity history; credential; token; environment secret; rollout bucket; production record; hostname; absolute path; or free-form error text.

## Release parity

Pages, Android, iOS, and Tauri build entry points consume the same named release decision and produce a target-specific receipt. A release set is consistent only when all four receipts carry the same source commit, capability value, kill-switch value, and admission decisions.

This is build-configuration parity, not physical-device or runtime proof. Android/iOS device behavior and Windows/Tauri runtime remain `UNVERIFIED` until fresh exact-build checks.

## Validation and rollback

- A validator rejects schema drift, forbidden fields, unknown platforms, source-commit mismatch, target disagreement, or any enabled schema-v1 receipt.
- Rollback sets the shared release decision false or the kill switch true and rebuilds. No user-data migration is required.
- CI retains the receipt with build artifacts; public Pages exposes only the safe receipt needed to bind the deployed bundle to its source commit.

## Tests

- Deterministic generation for each target.
- Missing, malformed, or conflicting input fails closed.
- Kill-switch precedence.
- Literal all-`pass` schema-v1 admission is a negative control and remains disabled.
- Any `fail` or `unverified` admission row also remains disabled.
- Exact-commit and four-target parity validation.
- Forbidden-field negative controls.
- Production default remains disabled.
