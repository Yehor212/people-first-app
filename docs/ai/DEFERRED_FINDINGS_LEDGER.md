# Deferred Findings Ledger

## 2026-08-20 — T222-R scoped security scan

- Evidence: `/Users/yehor/.codex/security/reports/20260820T040704Z-67939/summary.tsv`.
- Scope decision: no remediation in T222-R. The findings are outside this Ads-OFF provenance delta.
- Dependency scan: Trivy reported existing advisories in `package-lock.json` and `src-tauri/Cargo.lock`; `npm uninstall @capacitor-community/admob` did not add a dependency. `npm uninstall` had already reported four high-severity audit findings before the fresh install.
- Secret scan: Gitleaks reported only redacted matches in files outside the T222-R diff, including test sources and pre-existing generated iOS output. No secret values were read or copied.
- Scanner limitations: Snyk Code returned 23 pre-existing non-blocking findings in unrelated files; Terrascan could not parse pre-existing Playwright capture YAML. Neither is evidence of an Ads-OFF regression.
- Owner follow-up: security/dependency owners should triage the report separately; this task neither waives nor fixes those findings.
