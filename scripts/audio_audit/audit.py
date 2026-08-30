from __future__ import annotations

import json
from pathlib import Path, PurePosixPath
import re
import shutil
import sys
import tempfile
from typing import Any

from .backend_protocol import run_backend
from .backends.common import private_evidence_root, repo_root
from .evidence import file_sha256, write_json_exclusive, write_sha256sums
from .model import AuditPolicy, load_audit_policy, load_model_manifest
from .preprocess import write_analysis_views


VALID_GATE_STATUSES = frozenset(("PASS", "FAIL", "ABSTAIN", "UNVERIFIED"))


class AuditError(RuntimeError):
    pass


def _prompt_id(prefix: str, index: int, value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")[:48]
    return f"{prefix}-{index + 1}-{slug}"


def build_clap_prompts(policy: AuditPolicy, family: str) -> list[dict[str, str]]:
    if family not in policy.families:
        raise AuditError(f"unknown family: {family}")
    selected = policy.families[family]
    rows: list[dict[str, str]] = []
    for index, text in enumerate(selected.positive_prompts):
        rows.append({"id": _prompt_id(f"{family}-positive", index, text), "group": "positive", "text": text})
    for index, sibling in enumerate(selected.sibling_negatives):
        text = policy.families[sibling].positive_prompts[0]
        rows.append({"id": _prompt_id(f"{sibling}-sibling", index, text), "group": "sibling", "text": text})
    negatives = selected.hard_negatives + policy.universal_hard_negative_events
    for index, text in enumerate(negatives):
        rows.append({"id": _prompt_id(f"{family}-negative", index, text), "group": "hard-negative", "text": text})
    ids = [row["id"] for row in rows]
    if len(ids) != len(set(ids)):
        raise AuditError("constructed prompt ids are not unique")
    return rows


def summarize_semantic(results: dict[str, Any]) -> dict[str, Any]:
    rows = results.get("rows")
    if not isinstance(rows, list) or not rows:
        raise AuditError("CLAP results require prompt rows")
    grouped: dict[str, list[dict[str, Any]]] = {
        "positive": [],
        "sibling": [],
        "hard-negative": [],
    }
    for row in rows:
        if not isinstance(row, dict) or row.get("group") not in grouped:
            raise AuditError("CLAP result row has an invalid group")
        probability = row.get("probability")
        if not isinstance(probability, (int, float)) or not 0.0 <= float(probability) <= 1.0:
            raise AuditError("CLAP result probability is invalid")
        grouped[row["group"]].append(row)
    if any(not rows_for_group for rows_for_group in grouped.values()):
        raise AuditError("CLAP results must cover positive, sibling, and hard-negative groups")
    positive = max(float(row["probability"]) for row in grouped["positive"])
    sibling = max(float(row["probability"]) for row in grouped["sibling"])
    hard_negative = max(float(row["probability"]) for row in grouped["hard-negative"])
    return {
        "status": "ABSTAIN",
        "reasons": ["UNCALIBRATED_SEMANTIC_THRESHOLDS"],
        "targetMax": positive,
        "siblingMax": sibling,
        "hardNegativeMax": hard_negative,
        "targetMargin": positive - sibling,
        "hardNegativeMargin": positive - hard_negative,
        "rows": rows,
    }


def summarize_events(results: dict[str, Any]) -> dict[str, Any]:
    rows = results.get("rows")
    if not isinstance(rows, list) or len(rows) != 521:
        raise AuditError("YAMNet results must contain 521 class rows")
    ordered = sorted(rows, key=lambda row: float(row.get("max", -1.0)), reverse=True)
    patterns = (
        "speech",
        "music",
        "instrument",
        "alarm",
        "siren",
        "vehicle",
        "engine",
        "tool",
        "machinery",
        "thunder",
        "explosion",
        "footstep",
        "crowd",
        "bird",
        "animal",
        "impact",
    )
    diagnostic_hits = [
        row
        for row in ordered
        if float(row.get("max", 0.0)) >= 0.1
        and any(pattern in str(row.get("className", "")).lower() for pattern in patterns)
    ]
    return {
        "status": "ABSTAIN",
        "reasons": ["UNCALIBRATED_EVENT_THRESHOLDS"],
        "scoreFrames": int(results.get("scoreFrames", 0)),
        "topClasses": ordered[:20],
        "diagnosticHardEventHits": diagnostic_hits,
    }


def combine_results(
    *,
    provenance: dict[str, Any],
    semantic: dict[str, Any],
    events: dict[str, Any],
    auditor_admitted: bool,
) -> dict[str, Any]:
    gates = {"provenance": provenance, "semantic": semantic, "events": events}
    reasons: list[str] = []
    statuses: list[str] = []
    for name, gate in gates.items():
        status = gate.get("status")
        if status not in VALID_GATE_STATUSES:
            raise AuditError(f"{name} gate has invalid status: {status}")
        statuses.append(status)
        gate_reasons = gate.get("reasons", [])
        if not isinstance(gate_reasons, list) or any(not isinstance(row, str) for row in gate_reasons):
            raise AuditError(f"{name} gate reasons must be a string list")
        reasons.extend(gate_reasons)

    if "FAIL" in statuses:
        verdict = "FAIL"
    elif "ABSTAIN" in statuses or "UNVERIFIED" in statuses or not auditor_admitted:
        verdict = "ABSTAIN"
        if not auditor_admitted:
            reasons.append("AUDITOR_NOT_ADMITTED")
    else:
        verdict = "PASS"

    return {
        "status": "ADMITTED" if auditor_admitted else "TRIAL_ONLY_NOT_ADMITTED",
        "verdict": verdict,
        "reasons": list(dict.fromkeys(reasons)),
        "gates": gates,
    }


def classify_provenance(package_id: str, asset: dict[str, Any]) -> dict[str, Any]:
    if package_id == "zenflow-cc0-kimi-audio-reconstruction-v1":
        return {
            "status": "FAIL",
            "reasons": [
                "LEGACY_LEVEL_SPECIFIC_OFFSET_AND_TEXTURE",
                "NO_SHARED_SOURCE_WINDOW_OR_BASE_PCM_PROOF",
            ],
        }
    required = ("sourceSha256", "sourceWindow", "basePcmSha256", "operations")
    missing = [field for field in required if field not in asset]
    if missing:
        return {
            "status": "ABSTAIN",
            "reasons": [f"MISSING_PROVENANCE_FIELD:{field}" for field in missing],
        }
    allowed_operations = {
        "gain",
        "broad-eq",
        "compression",
        "transient-control",
        "safety-limit",
        "encode",
    }
    operations = asset.get("operations")
    if not isinstance(operations, list) or any(operation not in allowed_operations for operation in operations):
        return {"status": "FAIL", "reasons": ["PROHIBITED_MASTERING_OPERATION"]}
    return {"status": "PASS", "reasons": []}


def _strict_json(path: Path) -> dict[str, Any]:
    def strict_object(pairs):
        output = {}
        for key, value in pairs:
            if key in output:
                raise AuditError(f"duplicate JSON key in {path}: {key}")
            output[key] = value
        return output

    try:
        payload = json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=strict_object)
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise AuditError(f"unable to parse {path}: {exc}") from exc
    if not isinstance(payload, dict):
        raise AuditError(f"JSON root must be an object: {path}")
    return payload


def validate_package_root(path: Path) -> Path:
    if path.is_symlink() or not path.is_dir():
        raise AuditError(f"package root must be a regular directory: {path}")
    resolved = path.resolve(strict=True)
    try:
        resolved.relative_to(private_evidence_root())
    except ValueError as exc:
        raise AuditError("package root must stay inside private evidence") from exc
    return resolved


def validate_output_root(path: Path) -> Path:
    if path.exists() or path.is_symlink() or not path.is_absolute():
        raise AuditError(f"audit output must be a new absolute path: {path}")
    private = private_evidence_root()
    lexical = Path(str(path))
    try:
        lexical.relative_to(private)
    except ValueError as exc:
        raise AuditError("audit output must stay inside private evidence") from exc
    if ".." in PurePosixPath(lexical.as_posix()).parts:
        raise AuditError("audit output path cannot contain parent traversal")
    return lexical


def _package_assets(package_root: Path) -> tuple[str, list[dict[str, Any]]]:
    provenance = _strict_json(package_root / "provenance.json")
    package_id = provenance.get("packageId")
    if not isinstance(package_id, str) or not package_id:
        raise AuditError("provenance packageId is missing")
    rows = provenance.get("assets")
    if not isinstance(rows, list):
        raise AuditError("provenance assets must be a list")
    assets = [row for row in rows if isinstance(row, dict) and row.get("kind") == "hyperfocus"]
    expected_ids = {
        f"{family}:{level}"
        for family in ("forest", "rain", "ocean", "fireplace", "river", "wind")
        for level in ("soft", "deep", "intense")
    }
    if {row.get("id") for row in assets} != expected_ids or len(assets) != 18:
        raise AuditError("package must expose the exact 18 Hyperfocus assets")
    return package_id, sorted(assets, key=lambda row: row["id"])


def _asset_path(package_root: Path, asset: dict[str, Any]) -> Path:
    relative_value = asset.get("relativePath")
    if not isinstance(relative_value, str):
        raise AuditError("asset relativePath is missing")
    relative = PurePosixPath(relative_value)
    if relative.is_absolute() or ".." in relative.parts or "." in relative.parts:
        raise AuditError(f"unsafe asset path: {relative_value}")
    path = package_root.joinpath(*relative.parts)
    if path.is_symlink() or not path.is_file() or path.stat().st_nlink != 1:
        raise AuditError(f"asset path must be one regular file: {relative_value}")
    expected_sha = asset.get("sha256")
    if not isinstance(expected_sha, str) or file_sha256(path) != expected_sha:
        raise AuditError(f"asset hash mismatch: {relative_value}")
    return path


def _model_executables() -> tuple[Path, Path]:
    private = private_evidence_root() / "audio-ai-audit" / "envs"
    clap = private / "clap/bin/python"
    yamnet = private / "yamnet/bin/python"
    if not clap.exists() or not yamnet.exists():
        raise AuditError("private model environments are unavailable")
    return clap, yamnet


def _overall_verdict(assets: list[dict[str, Any]]) -> str:
    verdicts = [row.get("verdict") for row in assets]
    if "FAIL" in verdicts:
        return "FAIL"
    return "ABSTAIN"


def audit_package(
    package_root: Path,
    output_root: Path,
    policy: AuditPolicy,
) -> dict[str, Any]:
    package = validate_package_root(package_root)
    output = validate_output_root(output_root)
    package_id, assets = _package_assets(package)
    clap_python, yamnet_python = _model_executables()
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(dir=output.parent, prefix=f".{output.name}."))
    reports: list[dict[str, Any]] = []
    try:
        for index, asset in enumerate(assets, start=1):
            asset_id = asset["id"]
            family = asset_id.split(":", 1)[0]
            safe_id = asset_id.replace(":", "--")
            print(f"[audio-ai-audit] {index}/18 {asset_id}", file=sys.stderr, flush=True)
            input_path = _asset_path(package, asset)
            analysis_root = temporary / "assets" / safe_id / "analysis"
            preprocess_receipt = write_analysis_views(input_path, analysis_root, policy)
            normalized_path = analysis_root / preprocess_receipt.normalized_path
            prompts = build_clap_prompts(policy, family)
            clap_response = run_backend(
                clap_python,
                "scripts.audio_audit.backends.clap_runner",
                {
                    "schemaVersion": 1,
                    "requestId": f"{safe_id}-clap",
                    "backend": "clap",
                    "audioPath": str(normalized_path),
                    "family": family,
                    "prompts": prompts,
                },
                timeout_seconds=300,
            )
            yamnet_response = run_backend(
                yamnet_python,
                "scripts.audio_audit.backends.yamnet_runner",
                {
                    "schemaVersion": 1,
                    "requestId": f"{safe_id}-yamnet",
                    "backend": "yamnet",
                    "audioPath": str(normalized_path),
                },
                timeout_seconds=300,
            )
            provenance = classify_provenance(package_id, asset)
            semantic = summarize_semantic(clap_response.results)
            events = summarize_events(yamnet_response.results)
            combined = combine_results(
                provenance=provenance,
                semantic=semantic,
                events=events,
                auditor_admitted=False,
            )
            reports.append(
                {
                    "id": asset_id,
                    "family": family,
                    "inputPath": asset["relativePath"],
                    "inputSha256": asset["sha256"],
                    "preprocess": preprocess_receipt.to_dict(),
                    **combined,
                }
            )
        repo = repo_root()
        model_manifest_path = repo / "config/audio/hyperfocus-ai-models-v2.json"
        policy_path = repo / "config/audio/hyperfocus-semantic-audit-v2.json"
        models = load_model_manifest(model_manifest_path)
        report = {
            "schemaVersion": 1,
            "status": "TRIAL_ONLY_NOT_ADMITTED",
            "verdict": _overall_verdict(reports),
            "packageId": package_id,
            "packageRoot": str(package),
            "policySha256": file_sha256(policy_path),
            "modelManifestSha256": file_sha256(model_manifest_path),
            "models": {
                model_id: {
                    "revision": spec.revision,
                    "fileSha256": spec.file_sha256,
                    "status": spec.status,
                }
                for model_id, spec in models.models.items()
            },
            "assets": reports,
            "limitations": [
                "NO_OWNER_CONTROLLED_HIDDEN_HOLDOUT",
                "SEMANTIC_THRESHOLDS_UNCALIBRATED",
                "EVENT_THRESHOLDS_UNCALIBRATED",
                "AI_PASS_CANNOT_CREATE_HUMAN_OR_RELEASE_PASS",
            ],
        }
        write_json_exclusive(temporary / "ai-audit-report.json", report)
        write_sha256sums(temporary)
        temporary.replace(output)
    except Exception:
        shutil.rmtree(temporary, ignore_errors=True)
        raise
    return report


def main(argv=None) -> int:
    arguments = sys.argv[1:] if argv is None else list(argv)
    if arguments:
        raise AuditError("visible regression CLI does not accept path arguments")
    repo = repo_root()
    policy = load_audit_policy(repo / "config/audio/hyperfocus-semantic-audit-v2.json")
    private = private_evidence_root()
    package = private / "cc0-audio/e74a6b93-run-32816404725/package"
    output = private / "audio-ai-audit/visible-regression-e74a6b93/run-current"
    report = audit_package(package, output, policy)
    print(json.dumps({"status": report["status"], "verdict": report["verdict"], "assetCount": len(report["assets"])}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


__all__ = [
    "AuditError",
    "build_clap_prompts",
    "audit_package",
    "classify_provenance",
    "combine_results",
    "summarize_events",
    "summarize_semantic",
]
