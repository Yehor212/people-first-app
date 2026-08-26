from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path
import shutil
import sys
import tempfile

from scripts.audio_review.verify import verify_hash_inventory

from .model import EXACT_FAMILIES


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
PRIVATE_ROOT = Path(
    "/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2"
)
MASTER_ROOT = PRIVATE_ROOT / "runtime-masters-v2"
OUTPUT_ROOT = PRIVATE_ROOT / "runtime-ai-audit-v2"
POLICY_PATH = REPOSITORY_ROOT / "config/audio/hyperfocus-semantic-audit-v2.json"
MODEL_MANIFEST_PATH = REPOSITORY_ROOT / "config/audio/hyperfocus-ai-models-v2.json"
CLAP_PYTHON = Path(
    "/Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/envs/clap/bin/python"
)
YAMNET_PYTHON = Path(
    "/Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/envs/yamnet/bin/python"
)
FORBIDDEN_AUTHORITY_FIELDS = {
    "humanSemanticPass",
    "ownerDecision",
    "promotionAllowed",
    "selectedCandidate",
    "sourceRank",
}


class RuntimeAiError(RuntimeError):
    pass


def _contains_forbidden_authority(value: object) -> bool:
    if isinstance(value, dict):
        return bool(FORBIDDEN_AUTHORITY_FIELDS.intersection(value)) or any(
            _contains_forbidden_authority(item) for item in value.values()
        )
    if isinstance(value, list):
        return any(_contains_forbidden_authority(item) for item in value)
    return False


def validate_runtime_ai_report_authority(payload: object) -> dict:
    expected_ids = [
        f"{family}:{level}"
        for family in EXACT_FAMILIES
        for level in ("soft", "deep", "intense")
    ]
    if (
        not isinstance(payload, dict)
        or payload.get("schemaVersion") != 1
        or payload.get("status") != "TRIAL_ONLY_NOT_ADMITTED"
        or payload.get("verdict") != "ABSTAIN"
        or payload.get("scope") != "RUNTIME_MASTER_MP3"
        or payload.get("runtimePromotionAllowed") is not False
        or payload.get("assetCount") != 18
        or not isinstance(payload.get("assets"), list)
        or len(payload["assets"]) != 18
        or [row.get("id") for row in payload["assets"]] != expected_ids
        or any(
            row.get("status") != "TRIAL_ONLY_NOT_ADMITTED"
            or row.get("verdict") != "ABSTAIN"
            for row in payload["assets"]
        )
    ):
        raise RuntimeAiError("runtime AI report boundary mismatch")
    if _contains_forbidden_authority(payload):
        raise RuntimeAiError("runtime AI report contains forbidden authority")
    return {"status": "PASS", "assetCount": 18}


def audit_runtime_masters() -> Path:
    from scripts.audio_audit.audit import (
        build_clap_prompts,
        combine_results,
        summarize_events,
        summarize_semantic,
    )
    from scripts.audio_audit.backend_protocol import run_backend
    from scripts.audio_audit.evidence import (
        file_sha256,
        write_json_exclusive,
        write_sha256sums,
    )
    from scripts.audio_audit.model import load_audit_policy, load_model_manifest
    from scripts.audio_audit.preprocess import write_analysis_views
    from .ai import DIAGNOSTIC_DISPOSITIONS, diagnostic_disposition
    from .verify_runtime_masters import verify_runtime_master_package

    if OUTPUT_ROOT.exists() or OUTPUT_ROOT.is_symlink():
        raise RuntimeAiError("runtime AI audit output already exists")
    if not CLAP_PYTHON.is_file() or not YAMNET_PYTHON.is_file():
        raise RuntimeAiError("fixed private model environments are unavailable")
    verify_runtime_master_package()
    master_manifest = json.loads(
        (MASTER_ROOT / "runtime-manifest.json").read_text(encoding="utf-8")
    )
    policy = load_audit_policy(POLICY_PATH)
    models = load_model_manifest(MODEL_MANIFEST_PATH)
    OUTPUT_ROOT.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(
        tempfile.mkdtemp(
            dir=OUTPUT_ROOT.parent,
            prefix=f".{OUTPUT_ROOT.name}.",
        )
    )
    reports = []
    try:
        for index, row in enumerate(master_manifest["assets"], start=1):
            variant_id = row["variantId"]
            family = row["family"]
            safe_id = variant_id.replace(":", "--")
            input_path = MASTER_ROOT / "audio" / row["fileName"]
            if (
                input_path.is_symlink()
                or not input_path.is_file()
                or file_sha256(input_path) != row["outputSha256"]
            ):
                raise RuntimeAiError(f"runtime AI input mismatch: {variant_id}")
            print(
                f"[runtime-ai-audit] {index}/18 {variant_id}",
                file=sys.stderr,
                flush=True,
            )
            analysis_root = temporary / "assets" / safe_id / "analysis"
            preprocess = write_analysis_views(input_path, analysis_root, policy)
            normalized_path = analysis_root / preprocess.normalized_path
            prompts = build_clap_prompts(policy, family)
            clap = run_backend(
                CLAP_PYTHON,
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
            yamnet = run_backend(
                YAMNET_PYTHON,
                "scripts.audio_audit.backends.yamnet_runner",
                {
                    "schemaVersion": 1,
                    "requestId": f"{safe_id}-yamnet",
                    "backend": "yamnet",
                    "audioPath": str(normalized_path),
                },
                timeout_seconds=300,
            )
            semantic = summarize_semantic(clap.results)
            events = summarize_events(yamnet.results)
            combined = combine_results(
                provenance={
                    "status": "PASS",
                    "reasons": [],
                    "scope": "runtime-master",
                    "operations": row["operations"],
                    "sourceSha256": row["sourceSha256"],
                    "previewSha256": row["previewSha256"],
                },
                semantic=semantic,
                events=events,
                auditor_admitted=False,
            )
            reports.append(
                {
                    "id": variant_id,
                    "family": family,
                    "inputPath": f"audio/{row['fileName']}",
                    "inputSha256": row["outputSha256"],
                    "preprocess": preprocess.to_dict(),
                    "diagnostic": diagnostic_disposition(semantic, events),
                    **combined,
                }
            )
        counts = Counter(row["diagnostic"]["disposition"] for row in reports)
        report = {
            "schemaVersion": 1,
            "status": "TRIAL_ONLY_NOT_ADMITTED",
            "verdict": "ABSTAIN",
            "scope": "RUNTIME_MASTER_MP3",
            "runtimePromotionAllowed": False,
            "assetCount": 18,
            "runtimeMasterInventorySha256": file_sha256(
                MASTER_ROOT / "SHA256SUMS"
            ),
            "policySha256": file_sha256(POLICY_PATH),
            "modelManifestSha256": file_sha256(MODEL_MANIFEST_PATH),
            "models": {
                model_id: {
                    "revision": spec.revision,
                    "fileSha256": spec.file_sha256,
                    "status": spec.status,
                }
                for model_id, spec in models.models.items()
            },
            "diagnosticCounts": {
                disposition: counts.get(disposition, 0)
                for disposition in sorted(DIAGNOSTIC_DISPOSITIONS)
            },
            "assets": reports,
            "limitations": [
                "NO_OWNER_CONTROLLED_HIDDEN_HOLDOUT",
                "SEMANTIC_THRESHOLDS_UNCALIBRATED",
                "EVENT_THRESHOLDS_UNCALIBRATED",
                "VISIBLE_REGRESSION_CURRENTLY_FAILS",
                "DIAGNOSTIC_CANNOT_SELECT_OR_REORDER_SOURCE",
                "AI_PASS_CANNOT_CREATE_HUMAN_OR_RELEASE_PASS",
            ],
        }
        validate_runtime_ai_report_authority(report)
        write_json_exclusive(temporary / "ai-audit-report.json", report)
        write_sha256sums(temporary)
        temporary.replace(OUTPUT_ROOT)
    except Exception:
        shutil.rmtree(temporary, ignore_errors=True)
        raise
    return OUTPUT_ROOT


def verify_runtime_ai_audit() -> dict:
    from scripts.audio_audit.evidence import file_sha256
    from .ai import DIAGNOSTIC_DISPOSITIONS

    inventory = verify_hash_inventory(OUTPUT_ROOT)
    report = json.loads(
        (OUTPUT_ROOT / "ai-audit-report.json").read_text(encoding="utf-8")
    )
    validate_runtime_ai_report_authority(report)
    master_manifest = json.loads(
        (MASTER_ROOT / "runtime-manifest.json").read_text(encoding="utf-8")
    )
    master_by_id = {row["variantId"]: row for row in master_manifest["assets"]}
    if (
        report.get("runtimeMasterInventorySha256")
        != file_sha256(MASTER_ROOT / "SHA256SUMS")
        or report.get("policySha256") != file_sha256(POLICY_PATH)
        or report.get("modelManifestSha256") != file_sha256(MODEL_MANIFEST_PATH)
    ):
        raise RuntimeAiError("runtime AI report hash boundary mismatch")
    counts = Counter()
    for row in report["assets"]:
        variant_id = row["id"]
        master = master_by_id.get(variant_id)
        gates = row.get("gates")
        diagnostic = row.get("diagnostic")
        safe_id = variant_id.replace(":", "--")
        normalized = (
            OUTPUT_ROOT
            / "assets"
            / safe_id
            / "analysis/normalized-mono-48000.wav"
        )
        receipt = (
            OUTPUT_ROOT / "assets" / safe_id / "analysis/preprocess-receipt.json"
        )
        if (
            master is None
            or row.get("family") != master["family"]
            or row.get("inputPath") != f"audio/{master['fileName']}"
            or row.get("inputSha256") != master["outputSha256"]
            or not isinstance(gates, dict)
            or gates.get("provenance", {}).get("status") != "PASS"
            or gates.get("semantic", {}).get("status") != "ABSTAIN"
            or gates.get("events", {}).get("status") != "ABSTAIN"
            or not isinstance(diagnostic, dict)
            or diagnostic.get("authority") != "DIAGNOSTIC_ONLY_NOT_ADMITTED"
            or diagnostic.get("disposition") not in DIAGNOSTIC_DISPOSITIONS
            or not normalized.is_file()
            or not receipt.is_file()
            or row.get("preprocess", {}).get("normalizedSha256")
            != file_sha256(normalized)
            or f"assets/{safe_id}/analysis/normalized-mono-48000.wav"
            not in inventory
            or f"assets/{safe_id}/analysis/preprocess-receipt.json"
            not in inventory
        ):
            raise RuntimeAiError(f"runtime AI asset evidence mismatch: {variant_id}")
        counts[diagnostic["disposition"]] += 1
    expected_counts = {
        disposition: counts.get(disposition, 0)
        for disposition in sorted(DIAGNOSTIC_DISPOSITIONS)
    }
    if report.get("diagnosticCounts") != expected_counts:
        raise RuntimeAiError("runtime AI diagnostic count mismatch")
    return {
        "status": "PASS",
        "evidenceStatus": "TRIAL_ONLY_NOT_ADMITTED",
        "verdict": "ABSTAIN",
        "assetCount": 18,
        "diagnosticCounts": expected_counts,
        "runtimePromotionAllowed": False,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Run or verify the fixed AI diagnostic audit over runtime masters."
    )
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args(argv)
    if args.verify_only:
        print(json.dumps(verify_runtime_ai_audit(), sort_keys=True))
        return 0
    output = audit_runtime_masters()
    print(f"PASS: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
