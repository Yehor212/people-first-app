# Checklist 5 — Data, Sync, Security and Privacy

## Requirement quality

- [x] DAT-001 Does the specification explicitly and testably define that dexie/IndexedDB remains local truth and Zustand publishes only committed state? [Completeness, Spec §FR-001–FR-007/FR-031–FR-035]
- [x] DAT-002 Does the specification explicitly and testably define that habit/journal primary commit is independent of sync, ads and derived projections? [Completeness, Spec §FR-001–FR-007/FR-031–FR-035]
- [x] DAT-003 Does the specification explicitly and testably define that stable operation IDs, idempotency, owner/account-generation fencing and atomic queue behavior are explicit? [Completeness, Spec §FR-001–FR-007/FR-031–FR-035]
- [x] DAT-004 Does the specification explicitly and testably define that remote ordering, snapshot paging, tombstones, deletion barriers, purge markers and anti-resurrection are explicit? [Completeness, Spec §FR-001–FR-007/FR-031–FR-035]
- [x] DAT-005 Does the specification explicitly and testably define that backup/import/replace and N-1/forward-only schema-v11 behavior are explicit? [Completeness, Spec §FR-001–FR-007/FR-031–FR-035]
- [x] DAT-006 Does the specification explicitly and testably define that generated Supabase types and reviewed remote migration/RLS/RPC parity are release gates? [Completeness, Spec §FR-001–FR-007/FR-031–FR-035]
- [x] DAT-007 Does the specification explicitly and testably define that missing authoritative data yields loading/empty/unavailable/error, never mock/demo/fallback records? [Completeness, Spec §FR-001–FR-007/FR-031–FR-035]
- [x] DAT-008 Does the specification explicitly and testably define that diary prose, habit content, mood notes, auth material, secrets and unnecessary PII are excluded from ads, QR, logs, telemetry and evidence? [Completeness, Spec §FR-001–FR-007/FR-031–FR-035]
- [x] DAT-009 Does the specification explicitly and testably define that diagnostics use fixed codes and bounded allowlisted metadata with owner/retention/clear controls? [Completeness, Spec §FR-001–FR-007/FR-031–FR-035]
- [x] DAT-010 Does the specification explicitly and testably define that public-social server contracts cover IDOR, enumeration, rate limits, rank authority, block/report and deletion? [Completeness, Spec §FR-001–FR-007/FR-031–FR-035]
- [x] DAT-011 Does the specification explicitly and testably define that invite/link/QR parsers treat input as untrusted and inert until explicit confirmation? [Completeness, Spec §FR-001–FR-007/FR-031–FR-035]
- [x] DAT-012 Does the specification explicitly and testably define that monetization gates fail closed on missing/stale/malformed/offline/unknown state? [Completeness, Spec §FR-001–FR-007/FR-031–FR-035]
- [x] DAT-013 Does the specification explicitly and testably define that web/PWA/Android/iOS/Desktop lifecycle and storage parity are independently declared? [Completeness, Spec §FR-001–FR-007/FR-031–FR-035]
- [x] DAT-014 Does the specification explicitly and testably define that threat findings require validation; scanner output is evidence, not a substitute for design review? [Completeness, Spec §FR-001–FR-007/FR-031–FR-035]

## Context-only current evidence ledger (not checklist items)

- DAT-E01 `check:production-data-integrity:diff` — PASS for current dirty diff only (2,220 scanned / 841 reachable / 0 errors).
- DAT-E02 `check:sync-contract` — PASS for 409 local invariants only.
- DAT-E03 npm high+ advisory snapshot — PASS (0 vulnerabilities).
- DAT-E04 Generated Supabase type freshness — `FAIL`.
- DAT-E05 Reviewed remote migration/RLS/RPC parity — `UNVERIFIED/OWNER-EXTERNAL`.
- DAT-E06 Authenticated live sync/delete/restart proof on dedicated account — `UNVERIFIED`.
- DAT-E07 Public-social/QR implementation security tests — `UNVERIFIED` because not implemented/authorized.
- DAT-E08 Exact-AAB process-death/update/sync proof — `UNVERIFIED`.
- DAT-E09 Full current security suite/Snyk result — recorded in `analysis.md`; bounded findings do not prove release.
- DAT-E10 iOS/WKWebView/Desktop/Tauri parity — `UNVERIFIED`.

## Kill conditions

- UI success precedes authoritative local commit;
- wrong-owner/generation data applies after account switch/sign-out;
- deleted/private data resurrects through queue/sync/backup/import;
- stale generated types are hand-edited or treated as authoritative;
- client or untrusted payload controls public rank/relationship truth;
- private text/identity/secret enters logs, ads, QR or retained receipts;
- production substitutes synthetic records for unavailable sources.
