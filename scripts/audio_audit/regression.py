from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import tempfile
from typing import Any

from .backends.common import private_evidence_root, repo_root
from .evidence import file_sha256, write_json_exclusive, write_sha256sums


EXPECTED_IDS = frozenset(
    f"{family}:{level}"
    for family in ("forest", "rain", "ocean", "fireplace", "river", "wind")
    for level in ("soft", "deep", "intense")
)


class RegressionError(RuntimeError):
    pass


@dataclass(frozen=True)
class VisibleRegression:
    schema_version: int
    evidence_class: str
    package_id: str
    archive_sha256: str
    semantic_positive_ids: tuple[str, ...]
    semantic_negative_ids: tuple[str, ...]


def _strict_object(pairs):
    output = {}
    for key, value in pairs:
        if key in output:
            raise RegressionError(f"duplicate regression key: {key}")
        output[key] = value
    return output


def load_visible_regression(path: str | Path) -> VisibleRegression:
    source = Path(path)
    try:
        data = json.loads(source.read_text(encoding="utf-8"), object_pairs_hook=_strict_object)
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise RegressionError(f"unable to read visible regression: {exc}") from exc
    errors: list[str] = []
    if not isinstance(data, dict):
        raise RegressionError("visible regression root must be an object")
    if data.get("schemaVersion") != 1:
        errors.append("schemaVersion must be 1")
    if data.get("evidenceClass") != "VISIBLE_REGRESSION":
        errors.append("evidenceClass must be VISIBLE_REGRESSION")
    package_id = data.get("packageId")
    archive_sha = data.get("archiveSha256")
    positives_value = data.get("semanticPositiveIds")
    negatives_value = data.get("semanticNegativeIds")
    if not isinstance(package_id, str) or not package_id:
        errors.append("packageId must be a non-empty string")
        package_id = ""
    if not isinstance(archive_sha, str) or len(archive_sha) != 64:
        errors.append("archiveSha256 must be a SHA-256 string")
        archive_sha = ""
    if not isinstance(positives_value, list) or any(not isinstance(row, str) for row in positives_value):
        errors.append("semanticPositiveIds must be a string list")
        positives_value = []
    if not isinstance(negatives_value, list) or any(not isinstance(row, str) for row in negatives_value):
        errors.append("semanticNegativeIds must be a string list")
        negatives_value = []
    positives = tuple(positives_value)
    negatives = tuple(negatives_value)
    if positives != ("fireplace:deep",):
        errors.append("semanticPositiveIds must contain fireplace:deep only")
    if len(negatives) != 17 or set(positives).intersection(negatives) or set(positives + negatives) != EXPECTED_IDS:
        errors.append("visible regression must bind one positive and the other 17 exact negatives")
    if errors:
        raise RegressionError("; ".join(errors))
    return VisibleRegression(1, "VISIBLE_REGRESSION", package_id, archive_sha, positives, negatives)


def evaluate_visible_regression(
    report: dict[str, Any],
    fixture: VisibleRegression,
) -> dict[str, Any]:
    if report.get("status") != "TRIAL_ONLY_NOT_ADMITTED" or report.get("verdict") not in ("FAIL", "ABSTAIN"):
        raise RegressionError("visible regression requires an unadmitted FAIL/ABSTAIN audit report")
    rows = report.get("assets")
    if not isinstance(rows, list) or {row.get("id") for row in rows if isinstance(row, dict)} != set(
        fixture.semantic_positive_ids + fixture.semantic_negative_ids
    ):
        raise RegressionError("audit report assets do not match visible regression ids")
    expected_positive = set(fixture.semantic_positive_ids)
    true_positive: list[str] = []
    false_positive: list[str] = []
    true_negative: list[str] = []
    false_negative: list[str] = []
    diagnostics: list[dict[str, Any]] = []
    for row in sorted(rows, key=lambda value: value["id"]):
        asset_id = row["id"]
        try:
            margin = float(row["gates"]["semantic"]["targetMargin"])
        except (KeyError, TypeError, ValueError) as exc:
            raise RegressionError(f"asset target margin is missing: {asset_id}") from exc
        predicted_positive = margin > 0.0
        actual_positive = asset_id in expected_positive
        if predicted_positive and actual_positive:
            true_positive.append(asset_id)
        elif predicted_positive:
            false_positive.append(asset_id)
        elif actual_positive:
            false_negative.append(asset_id)
        else:
            true_negative.append(asset_id)
        diagnostics.append(
            {
                "id": asset_id,
                "ownerSemanticLabel": "PASS" if actual_positive else "FAIL",
                "diagnosticTargetWins": predicted_positive,
                "targetMargin": margin,
            }
        )
    status = "PASS_VISIBLE_REGRESSION_ONLY" if not false_positive and not false_negative else "FAIL_VISIBLE_REGRESSION"
    return {
        "schemaVersion": 1,
        "status": status,
        "evidenceClass": "VISIBLE_REGRESSION",
        "generalizationStatus": "UNVERIFIED_VISIBLE_FIXTURE_ONLY",
        "truePositive": len(true_positive),
        "falsePositive": len(false_positive),
        "trueNegative": len(true_negative),
        "falseNegative": len(false_negative),
        "criticalFalseAcceptIds": false_positive,
        "falseRejectIds": false_negative,
        "diagnostics": diagnostics,
    }


def main(argv=None) -> int:
    import sys

    arguments = sys.argv[1:] if argv is None else list(argv)
    if arguments:
        raise RegressionError("visible regression evaluator CLI does not accept path arguments")
    repo = repo_root()
    private = private_evidence_root()
    fixture_path = repo / "config/audio/hyperfocus-visible-regression-v1.json"
    audit_root = private / "audio-ai-audit/visible-regression-e74a6b93/run-current"
    output = private / "audio-ai-audit/visible-regression-e74a6b93/evaluation-current"
    if output.exists() or output.is_symlink():
        raise RegressionError(f"refusing to overwrite visible regression evaluation: {output}")
    fixture = load_visible_regression(fixture_path)
    report_path = audit_root / "ai-audit-report.json"
    report = json.loads(report_path.read_text(encoding="utf-8"), object_pairs_hook=_strict_object)
    result = evaluate_visible_regression(report, fixture)
    result["fixtureSha256"] = file_sha256(fixture_path)
    result["auditReportSha256"] = file_sha256(report_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(dir=output.parent, prefix=f".{output.name}."))
    try:
        write_json_exclusive(temporary / "visible-regression-evaluation.json", result)
        write_sha256sums(temporary)
        temporary.replace(output)
    except Exception:
        for path in sorted(temporary.rglob("*"), reverse=True):
            if path.is_file():
                path.unlink()
            elif path.is_dir():
                path.rmdir()
        temporary.rmdir()
        raise
    print(json.dumps({key: result[key] for key in ("status", "truePositive", "falsePositive", "trueNegative", "falseNegative")}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
