# Dependency Convergence Plan — 2026-08-31

**Goal:** Resolve the remaining open dependency work with current registry evidence, compatible lockfile updates, zero known audit vulnerabilities, and full web/native release verification.

**Base:** Stacked on PR #28 replacement tip `9c6ebd3eed37f919bdc485d9ffefd2e8489cd15c`.

## Scope

- Upgrade existing `vaul` from 0.9.9 to 1.1.2.
- Upgrade existing `@radix-ui/react-tooltip` from locked 1.2.8 to 1.2.16.
- Evaluate the current Capacitor 8.5.0 line as one CLI/Core/Android/iOS set; do not ship it if the update introduces audit findings.
- Add no new production dependency or service.

## Tasks

- [x] Capture current installed, wanted, latest, peer, baseline tests, typecheck, audit, and Capacitor doctor evidence.
- [x] Update the candidate dependency set and inspect package/lock changes.
- [x] Reject Capacitor 8.5.0 after it introduces a direct moderate audit chain through `xcode@3.0.1 -> uuid@7.0.3`.
- [x] Restore the verified Capacitor 8.3.3/8.3.4 installed set and original declared ranges.
- [x] Add focused Tooltip accessibility coverage and rerun Vaul Drawer/native tests.
- [x] Run full tests, build, PDI, license, audit, security, Android, and iOS gates.
- [ ] Commit, push, open a replacement PR for #9, and wait for required CI.
- [ ] Merge and verify main release before closing PR #9.
