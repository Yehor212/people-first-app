from __future__ import annotations

import argparse
import json
from pathlib import Path
import tempfile

from scripts.audio_review.verify import verify_hash_inventory

from .build_previews import OUTPUT_ROOT as RAW_PREVIEW_ROOT
from .build_runtime_masters import (
    OUTPUT_ROOT,
    POLICY_PATH,
    _decoded_qc,
    _sha256_file,
)
from .runtime_package import RuntimePackageError, validate_runtime_manifest_payload
from .verify import verify_raw_preview_package
from .verify_bundle import verify_source_audition_bundle


class RuntimeMasterVerificationError(RuntimeError):
    pass


def _read_json(path: Path) -> dict:
    def strict_object(pairs):
        output = {}
        for key, value in pairs:
            if key in output:
                raise RuntimeMasterVerificationError(
                    f"duplicate JSON key in {path.name}: {key}"
                )
            output[key] = value
        return output

    try:
        payload = json.loads(
            path.read_text(encoding="utf-8"),
            object_pairs_hook=strict_object,
        )
    except RuntimeMasterVerificationError:
        raise
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RuntimeMasterVerificationError(f"unreadable JSON: {path.name}") from exc
    if not isinstance(payload, dict):
        raise RuntimeMasterVerificationError(f"JSON root is not an object: {path.name}")
    return payload


def verify_runtime_master_package() -> dict:
    root = OUTPUT_ROOT
    inventory = verify_hash_inventory(root)
    manifest = _read_json(root / "runtime-manifest.json")
    try:
        validation = validate_runtime_manifest_payload(manifest)
    except RuntimePackageError as exc:
        raise RuntimeMasterVerificationError(str(exc)) from exc
    assignments = _read_json(root / "assignment.json")
    provenance = _read_json(root / "provenance.json")
    qc = _read_json(root / "qc.json")
    environment = _read_json(root / "build-environment.json")
    expected_audio = {
        f"audio/{row['fileName']}" for row in manifest["assets"]
    }
    expected_pcm = {
        f"pcm/{row['variantId'].replace(':', '--')}.wav"
        for row in manifest["assets"]
    }
    expected_analysis = {
        f"analysis/{row['variantId'].replace(':', '--')}.wav"
        for row in manifest["assets"]
    }
    expected_files = expected_audio | expected_pcm | expected_analysis | {
        "runtime-manifest.json",
        "assignment.json",
        "provenance.json",
        "qc.json",
        "build-environment.json",
    }
    if set(inventory) != expected_files:
        raise RuntimeMasterVerificationError("runtime package inventory mismatch")
    preview_provenance = _read_json(
        RAW_PREVIEW_ROOT / "preview-provenance.json"
    )
    preview_by_id = {
        row["candidateId"]: row for row in preview_provenance["previews"]
    }
    provenance_by_id = {
        row["variantId"]: row for row in provenance.get("assets", [])
    }
    if (
        assignments.get("schemaVersion") != 1
        or assignments.get("method")
        != "signal-intensity-ascending-candidate-id-tiebreak"
        or assignments.get("blindLabelsUsed") is not False
        or not isinstance(assignments.get("assignments"), list)
        or len(assignments["assignments"]) != 18
        or provenance.get("schemaVersion") != 2
        or provenance.get("status") != "TECHNICAL_PASS_REVIEW_PENDING"
        or provenance.get("runtimePromotionAllowed") is not False
        or provenance.get("policySha256") != _sha256_file(POLICY_PATH)
        or provenance.get("humanLoopReview") != "UNVERIFIED"
        or provenance.get("aiStatus") != "UNVERIFIED"
        or provenance.get("storeReleaseStatus") != "STOP"
        or qc.get("status") != "PASS"
        or qc.get("assetCount") != 18
        or environment.get("runtimePromotionAllowed") is not False
        or environment.get("lameExternalSourceSecurityStatus")
        != "FAIL_SCOPED_EXTERNAL_SOURCE"
    ):
        raise RuntimeMasterVerificationError("runtime evidence boundary mismatch")
    stored_qc = {
        row["variantId"]: {key: value for key, value in row.items() if key != "variantId"}
        for row in qc.get("rows", [])
    }
    if len(stored_qc) != 18 or len(provenance_by_id) != 18:
        raise RuntimeMasterVerificationError("runtime evidence coverage mismatch")
    with tempfile.TemporaryDirectory(prefix="zenflow-runtime-master-verify.") as temp:
        temp_root = Path(temp)
        for row in manifest["assets"]:
            variant_id = row["variantId"]
            candidate_id = row["candidateId"]
            preview = preview_by_id.get(candidate_id)
            evidence = provenance_by_id.get(variant_id)
            mp3_path = root / "audio" / row["fileName"]
            pcm_path = root / "pcm" / f"{variant_id.replace(':', '--')}.wav"
            if (
                preview is None
                or evidence is None
                or row["sourceSha256"] != preview["sourceSha256"]
                or row["previewSha256"] != preview["previewSha256"]
                or row["outputSha256"] != _sha256_file(mp3_path)
                or row["masterPcmSha256"] != _sha256_file(pcm_path)
                or evidence["outputSha256"] != row["outputSha256"]
                or evidence["candidateId"] != candidate_id
                or evidence.get("operations") != row["operations"]
                or evidence.get("encoder", {}).get("externalSourceSecurityStatus")
                != "FAIL_SCOPED_EXTERNAL_SOURCE"
            ):
                raise RuntimeMasterVerificationError(
                    f"runtime provenance hash chain mismatch: {variant_id}"
                )
            decoded = temp_root / f"{variant_id.replace(':', '--')}.wav"
            recomputed_qc = _decoded_qc(mp3_path, decoded)
            if row["decodedQc"] != recomputed_qc or stored_qc.get(variant_id) != recomputed_qc:
                raise RuntimeMasterVerificationError(
                    f"runtime decoded QC mismatch: {variant_id}"
                )
    verify_raw_preview_package(RAW_PREVIEW_ROOT)
    verify_source_audition_bundle()
    return {
        **validation,
        "hashInventory": "PASS",
        "sourcePreviewChain": "PASS",
        "decodedMp3Qc": "PASS",
        "aiStatus": "UNVERIFIED",
        "humanLoopReview": "UNVERIFIED",
        "storeReleaseStatus": "STOP",
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Verify the fixed Hyperfocus runtime master package."
    )
    parser.parse_args(argv)
    result = verify_runtime_master_package()
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
