from __future__ import annotations

import json
from pathlib import Path, PurePosixPath
import sys
from typing import Any

from .backends.common import private_evidence_root
from .evidence import SHA256_LINE, file_sha256


FORBIDDEN_AUTHORITY_FIELDS = frozenset(
    (
        "humanSemanticPass",
        "promotionAllowed",
        "ownerApproval",
        "rightsApproval",
        "releaseStatus",
        "storeStatus",
        "published",
    )
)


class AuditVerificationError(RuntimeError):
    pass


def _strict_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise AuditVerificationError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def verify_hash_inventory(root: Path) -> dict[str, str]:
    if root.is_symlink() or not root.is_dir():
        raise AuditVerificationError(f"audit report root must be a regular directory: {root}")
    inventory = root / "SHA256SUMS"
    if inventory.is_symlink() or not inventory.is_file():
        raise AuditVerificationError("SHA256SUMS is missing")
    expected: dict[str, str] = {}
    for number, line in enumerate(inventory.read_text(encoding="utf-8").splitlines(), start=1):
        match = SHA256_LINE.fullmatch(line)
        if not match:
            raise AuditVerificationError(f"invalid SHA256SUMS line {number}")
        digest, name = match.groups()
        relative = PurePosixPath(name)
        if relative.is_absolute() or ".." in relative.parts or "." in relative.parts or name in expected:
            raise AuditVerificationError(f"unsafe or duplicate SHA256SUMS path: {name}")
        expected[name] = digest
    actual = {
        path.relative_to(root).as_posix(): path
        for path in root.rglob("*")
        if path.name != "SHA256SUMS" and (path.is_file() or path.is_symlink())
    }
    if set(actual) != set(expected):
        raise AuditVerificationError("audit report inventory mismatch")
    for name, path in actual.items():
        if path.is_symlink() or not path.is_file():
            raise AuditVerificationError(f"audit report entry must be regular: {name}")
        if file_sha256(path) != expected[name]:
            raise AuditVerificationError(f"hash mismatch: {name}")
    return expected


def _reject_authority_fields(value: Any, location: str = "$") -> None:
    if isinstance(value, dict):
        for key, nested in value.items():
            if key in FORBIDDEN_AUTHORITY_FIELDS:
                raise AuditVerificationError(f"forbidden authority field at {location}.{key}")
            _reject_authority_fields(nested, f"{location}.{key}")
    elif isinstance(value, list):
        for index, nested in enumerate(value):
            _reject_authority_fields(nested, f"{location}[{index}]")


def verify_audit_report(root: str | Path) -> dict[str, Any]:
    package = Path(root)
    hashes = verify_hash_inventory(package)
    report_path = package / "ai-audit-report.json"
    if "ai-audit-report.json" not in hashes:
        raise AuditVerificationError("ai-audit-report.json is not hash-bound")
    try:
        report = json.loads(report_path.read_text(encoding="utf-8"), object_pairs_hook=_strict_object)
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise AuditVerificationError(f"unable to parse audit report: {exc}") from exc
    if not isinstance(report, dict):
        raise AuditVerificationError("audit report root must be an object")
    _reject_authority_fields(report)
    if report.get("schemaVersion") != 1:
        raise AuditVerificationError("audit report schemaVersion must be 1")
    if report.get("status") != "TRIAL_ONLY_NOT_ADMITTED":
        raise AuditVerificationError("audit report status must remain TRIAL_ONLY_NOT_ADMITTED")
    if report.get("verdict") not in ("FAIL", "ABSTAIN"):
        raise AuditVerificationError("unadmitted audit verdict must be FAIL or ABSTAIN")
    assets = report.get("assets")
    if not isinstance(assets, list):
        raise AuditVerificationError("audit report assets must be a list")
    if any(row.get("verdict") == "FAIL" for row in assets if isinstance(row, dict)):
        if report.get("verdict") != "FAIL":
            raise AuditVerificationError("asset FAIL must force report FAIL")
    return {
        "status": "AUDIT_REPORT_STRUCTURE_VALID",
        "verdict": report["verdict"],
        "assetCount": len(assets),
        "hashCount": len(hashes),
    }


def main(argv=None) -> int:
    arguments = sys.argv[1:] if argv is None else list(argv)
    if arguments:
        raise AuditVerificationError("visible regression verifier CLI does not accept path arguments")
    report = private_evidence_root() / "audio-ai-audit/visible-regression-e74a6b93/run-current"
    result = verify_audit_report(report)
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
