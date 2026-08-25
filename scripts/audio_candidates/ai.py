from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path
import shutil
import sys
import tempfile

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
from scripts.audio_review.verify import verify_hash_inventory

from .build_previews import OUTPUT_ROOT as RAW_PREVIEW_ROOT
from .model import EXACT_FAMILIES
from .verify import verify_raw_preview_package


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
PRIVATE_ROOT = Path(
    "/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2"
)
OUTPUT_ROOT = PRIVATE_ROOT / "source-ai-audit-v1"
POLICY_PATH = REPOSITORY_ROOT / "config/audio/hyperfocus-semantic-audit-v2.json"
MODEL_MANIFEST_PATH = REPOSITORY_ROOT / "config/audio/hyperfocus-ai-models-v2.json"
CLAP_PYTHON = Path(
    "/Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/envs/clap/bin/python"
)
YAMNET_PYTHON = Path(
    "/Users/yehor/Projects/ZenFlow/private-evidence/audio-ai-audit/envs/yamnet/bin/python"
)
DIAGNOSTIC_DISPOSITIONS = {
    "LIKELY_SEMANTIC_MISMATCH",
    "LIKELY_HARD_NEGATIVE",
    "RISK_FLAGGED",
    "NO_TRIAL_FLAG",
}


class CandidateAiError(RuntimeError):
    pass


def _load_preview_rows() -> list[dict]:
    verify_raw_preview_package(RAW_PREVIEW_ROOT)
    payload = json.loads(
        (RAW_PREVIEW_ROOT / "preview-provenance.json").read_text(
            encoding="utf-8"
        )
    )
    rows = payload["previews"]
    expected_ids = [
        f"{family}-c{position}"
        for family in EXACT_FAMILIES
        for position in (1, 2, 3)
    ]
    if [row.get("candidateId") for row in rows] != expected_ids:
        raise CandidateAiError("preview evidence order mismatch")
    return rows


def diagnostic_disposition(
    semantic: dict,
    events: dict,
) -> dict:
    critical_hits = [
        row
        for row in events.get("diagnosticHardEventHits", [])
        if float(row.get("max", 0.0)) >= 0.3
    ]
    if float(semantic.get("targetMargin", -1.0)) <= 0:
        disposition = "LIKELY_SEMANTIC_MISMATCH"
        reasons = ["CLAP_TARGET_DID_NOT_BEAT_SIBLINGS"]
    elif float(semantic.get("hardNegativeMargin", -1.0)) <= 0:
        disposition = "LIKELY_HARD_NEGATIVE"
        reasons = ["CLAP_TARGET_DID_NOT_BEAT_HARD_NEGATIVES"]
    elif critical_hits:
        disposition = "RISK_FLAGGED"
        reasons = ["YAMNET_CRITICAL_EVENT_AT_OR_ABOVE_0_3"]
    else:
        disposition = "NO_TRIAL_FLAG"
        reasons = []
    return {
        "disposition": disposition,
        "reasons": reasons,
        "criticalEventHits": critical_hits,
        "authority": "DIAGNOSTIC_ONLY_NOT_ADMITTED",
    }


def audit_source_previews() -> Path:
    if OUTPUT_ROOT.exists() or OUTPUT_ROOT.is_symlink():
        raise CandidateAiError("source AI audit output already exists")
    if not CLAP_PYTHON.is_file() or not YAMNET_PYTHON.is_file():
        raise CandidateAiError("fixed private model environments are unavailable")
    policy = load_audit_policy(POLICY_PATH)
    models = load_model_manifest(MODEL_MANIFEST_PATH)
    preview_rows = _load_preview_rows()
    OUTPUT_ROOT.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(
        tempfile.mkdtemp(
            dir=OUTPUT_ROOT.parent,
            prefix=f".{OUTPUT_ROOT.name}.",
        )
    )
    reports = []
    try:
        for index, row in enumerate(preview_rows, start=1):
            candidate_id = row["candidateId"]
            family = candidate_id.split("-", 1)[0]
            relative = row["previewPath"]
            input_path = RAW_PREVIEW_ROOT / relative
            if (
                relative != f"audio/{candidate_id}.wav"
                or input_path.is_symlink()
                or not input_path.is_file()
                or file_sha256(input_path) != row["previewSha256"]
            ):
                raise CandidateAiError("AI input path or hash mismatch")
            print(
                f"[source-ai-audit] {index}/18 {candidate_id}",
                file=sys.stderr,
                flush=True,
            )
            analysis_root = temporary / "assets" / candidate_id / "analysis"
            preprocess = write_analysis_views(input_path, analysis_root, policy)
            normalized_path = analysis_root / preprocess.normalized_path
            prompts = build_clap_prompts(policy, family)
            clap = run_backend(
                CLAP_PYTHON,
                "scripts.audio_audit.backends.clap_runner",
                {
                    "schemaVersion": 1,
                    "requestId": f"{candidate_id}-clap",
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
                    "requestId": f"{candidate_id}-yamnet",
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
                    "scope": "source-preview",
                    "sourceFrameBytesEqual": True,
                    "operations": ["decode-pcm", "contiguous-extract"],
                },
                semantic=semantic,
                events=events,
                auditor_admitted=False,
            )
            reports.append(
                {
                    "id": candidate_id,
                    "family": family,
                    "inputPath": relative,
                    "inputSha256": row["previewSha256"],
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
            "scope": "SOURCE_CANDIDATE_PREVIEWS",
            "runtimePromotionAllowed": False,
            "rawPreviewInventorySha256": file_sha256(
                RAW_PREVIEW_ROOT / "SHA256SUMS"
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
            "assetCount": 18,
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
                "DIAGNOSTIC_CANNOT_SELECT_SOURCE",
                "AI_PASS_CANNOT_CREATE_HUMAN_OR_RELEASE_PASS",
            ],
        }
        write_json_exclusive(temporary / "ai-audit-report.json", report)
        write_sha256sums(temporary)
        temporary.replace(OUTPUT_ROOT)
    except Exception:
        shutil.rmtree(temporary, ignore_errors=True)
        raise
    return OUTPUT_ROOT


def _contains_forbidden_authority(value: object) -> bool:
    forbidden = {
        "humanSemanticPass",
        "ownerDecision",
        "selectedCandidate",
        "promotionAllowed",
    }
    if isinstance(value, dict):
        return bool(forbidden.intersection(value)) or any(
            _contains_forbidden_authority(item) for item in value.values()
        )
    if isinstance(value, list):
        return any(_contains_forbidden_authority(item) for item in value)
    return False


def verify_source_ai_audit() -> dict:
    inventory = verify_hash_inventory(OUTPUT_ROOT)
    report_path = OUTPUT_ROOT / "ai-audit-report.json"
    if "ai-audit-report.json" not in inventory:
        raise CandidateAiError("AI report is missing from hash inventory")
    report = json.loads(report_path.read_text(encoding="utf-8"))
    preview_rows = _load_preview_rows()
    preview_by_id = {row["candidateId"]: row for row in preview_rows}
    expected_ids = tuple(preview_by_id)
    if (
        report.get("schemaVersion") != 1
        or report.get("status") != "TRIAL_ONLY_NOT_ADMITTED"
        or report.get("verdict") != "ABSTAIN"
        or report.get("scope") != "SOURCE_CANDIDATE_PREVIEWS"
        or report.get("runtimePromotionAllowed") is not False
        or report.get("assetCount") != 18
        or report.get("policySha256") != file_sha256(POLICY_PATH)
        or report.get("modelManifestSha256") != file_sha256(MODEL_MANIFEST_PATH)
        or report.get("rawPreviewInventorySha256")
        != file_sha256(RAW_PREVIEW_ROOT / "SHA256SUMS")
        or not isinstance(report.get("assets"), list)
    ):
        raise CandidateAiError("AI report boundary mismatch")
    if _contains_forbidden_authority(report):
        raise CandidateAiError("AI report contains forbidden authority fields")
    if tuple(row.get("id") for row in report["assets"]) != expected_ids:
        raise CandidateAiError("AI report candidate order mismatch")
    counts = Counter()
    for row in report["assets"]:
        candidate_id = row["id"]
        preview = preview_by_id[candidate_id]
        diagnostic = row.get("diagnostic")
        disposition = (
            diagnostic.get("disposition") if isinstance(diagnostic, dict) else None
        )
        gates = row.get("gates")
        if (
            row.get("family") != candidate_id.split("-", 1)[0]
            or row.get("inputPath") != preview["previewPath"]
            or row.get("inputSha256") != preview["previewSha256"]
            or row.get("status") != "TRIAL_ONLY_NOT_ADMITTED"
            or row.get("verdict") != "ABSTAIN"
            or disposition not in DIAGNOSTIC_DISPOSITIONS
            or diagnostic.get("authority") != "DIAGNOSTIC_ONLY_NOT_ADMITTED"
            or not isinstance(gates, dict)
            or gates.get("provenance", {}).get("status") != "PASS"
            or gates.get("semantic", {}).get("status") != "ABSTAIN"
            or gates.get("events", {}).get("status") != "ABSTAIN"
        ):
            raise CandidateAiError(f"AI asset boundary mismatch: {candidate_id}")
        preprocess = row.get("preprocess")
        analysis = OUTPUT_ROOT / "assets" / candidate_id / "analysis"
        normalized = analysis / "normalized-mono-48000.wav"
        receipt = analysis / "preprocess-receipt.json"
        if (
            not isinstance(preprocess, dict)
            or preprocess.get("normalizedPath") != "normalized-mono-48000.wav"
            or preprocess.get("normalizedSha256") != file_sha256(normalized)
            or f"assets/{candidate_id}/analysis/normalized-mono-48000.wav"
            not in inventory
            or f"assets/{candidate_id}/analysis/preprocess-receipt.json"
            not in inventory
            or not receipt.is_file()
        ):
            raise CandidateAiError(f"AI preprocess evidence mismatch: {candidate_id}")
        counts[disposition] += 1
    expected_counts = {
        disposition: counts.get(disposition, 0)
        for disposition in sorted(DIAGNOSTIC_DISPOSITIONS)
    }
    if report.get("diagnosticCounts") != expected_counts:
        raise CandidateAiError("AI diagnostic counts mismatch")
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
        description="Run the fixed CLAP and YAMNet trial audit over source previews."
    )
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="verify existing fixed private evidence without running models",
    )
    args = parser.parse_args(argv)
    if args.verify_only:
        result = verify_source_ai_audit()
        print(json.dumps(result, sort_keys=True))
        return 0
    output = audit_source_previews()
    print(f"PASS: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
