# Gitleaks Triage - 2026-07-02

This ledger records redacted triage for Gitleaks findings discovered during release-artifact hardening. It intentionally contains no secret values, matches, raw environment content, or user data.

## Scope

- Source report: `/Users/yehor/.codex/security/reports/20260702T034135Z-4814/gitleaks.json`.
- Verification command before triage: `gitleaks git . --redact=100 --report-format json --report-path output/security/gitleaks-git-before-ignore-redacted-20260702.json --no-banner`.
- Result before triage: 36 findings across git history.
- `.gitleaksignore` contains 35 unique fingerprints because one generated-asset fingerprint appeared twice in the source report.
- Current broad directory scans include ignored local/generated paths such as `.env.*`, `.playwright-mcp/`, `dist/`, `output/`, native build outputs, and `tmp/`; those paths are not repository release evidence.
- Current tracked source review found no new secret committed by the release-artifact changes.

## Triage

| Area | Findings | Current status | Decision |
| --- | ---: | --- | --- |
| Historical journal/source/doc false positives | 31 | Files either no longer match in the current tree or match historical code/copy tokens, not current credentials. | Fingerprints recorded in `.gitleaksignore`; future findings still fail. |
| Removed generated docs assets | 3 | Files are not present in the current working tree and are historical generated assets. | Fingerprints recorded; generated assets must not be treated as source proof. |
| Historical Android `google-services.json` | 1 | File is not tracked now and is ignored by `.gitignore`; the historical Firebase/GCP API key exposure cannot be fully closed from this workspace. | Fingerprint recorded only to unblock future delta scanning. Owner must confirm key restriction or rotation. |

## Operating Rule

`.gitleaksignore` may contain only specific fingerprints that have a matching ledger entry. Do not add broad path or rule allowlists for source code. Do not commit redacted or raw Gitleaks reports from `output/security/`.

For local proof, prefer the git-history scan with redaction. Do not use a full directory scan over the live workspace as release evidence unless ignored local secrets, generated outputs, dependency folders, and native build products are excluded first.

## UNVERIFIED

- Google Cloud/Firebase key restriction or rotation for the historical `android/app/google-services.json` finding must be confirmed by the project owner in Google/Firebase Console.
- Public GitHub history rewrite is not attempted here; it requires explicit owner approval and a coordinated force-push/clone-cleanup plan.
