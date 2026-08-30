from __future__ import annotations

import math
import re

from .mastering import ALLOWED_OPERATIONS
from .model import EXACT_FAMILIES


LEVELS = ("soft", "deep", "intense")
ROOT_KEYS = {
    "schemaVersion",
    "status",
    "runtimePromotionAllowed",
    "assetCount",
    "minAdjacentRmsDeltaDb",
    "assets",
}
ASSET_KEYS = {
    "variantId",
    "family",
    "level",
    "candidateId",
    "sourceSha256",
    "previewSha256",
    "basePcmSha256",
    "masterPcmSha256",
    "fileName",
    "outputSha256",
    "outputBytes",
    "operations",
    "assignmentMetrics",
    "decodedQc",
}
METRIC_KEYS = {
    "rmsDbfs",
    "motionDbfs",
    "zeroCrossingsPerSecond",
    "crestFactorDb",
    "intensityScore",
    "deliveryIntensityScore",
}
QC_KEYS = {
    "sampleRate",
    "channels",
    "frameCount",
    "durationSeconds",
    "bitrateBps",
    "rmsDbfs",
    "peakDbfs",
    "clippedSamples",
    "boundaryJump",
}
SHA256_PATTERN = re.compile(r"[0-9a-f]{64}")


class RuntimePackageError(RuntimeError):
    pass


def _finite_number(value: object) -> bool:
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(float(value))
    )


def _sha256(value: object) -> bool:
    return isinstance(value, str) and SHA256_PATTERN.fullmatch(value) is not None


def validate_runtime_manifest_payload(payload: object) -> dict:
    if not isinstance(payload, dict) or set(payload) != ROOT_KEYS:
        raise RuntimePackageError("runtime manifest root keys mismatch")
    if (
        payload["schemaVersion"] != 2
        or payload["status"] != "RUNTIME_MASTERS_TECHNICAL_PASS_REVIEW_PENDING"
        or payload["runtimePromotionAllowed"] is not False
        or payload["assetCount"] != 18
        or payload["minAdjacentRmsDeltaDb"] != 3.0
        or not isinstance(payload["assets"], list)
        or len(payload["assets"]) != 18
    ):
        raise RuntimePackageError("exact 18-asset inventory is required")
    expected_variants = [
        f"{family}:{level}" for family in EXACT_FAMILIES for level in LEVELS
    ]
    expected_candidates = {
        f"{family}-c{position}"
        for family in EXACT_FAMILIES
        for position in (1, 2, 3)
    }
    seen_candidates = set()
    source_hashes = set()
    preview_hashes = set()
    output_hashes = set()
    rows_by_variant = {}
    for expected_variant, row in zip(expected_variants, payload["assets"]):
        if not isinstance(row, dict) or set(row) != ASSET_KEYS:
            raise RuntimePackageError("asset keys mismatch")
        variant_id = row["variantId"]
        family, level = expected_variant.split(":", 1)
        if (
            variant_id != expected_variant
            or row["family"] != family
            or row["level"] != level
            or row["fileName"] != f"hyperfocus-{family}-{level}.mp3"
            or row["candidateId"] not in expected_candidates
            or not row["candidateId"].startswith(f"{family}-c")
            or row["candidateId"] in seen_candidates
        ):
            raise RuntimePackageError("exact 18-asset inventory is required")
        hashes = (
            row["sourceSha256"],
            row["previewSha256"],
            row["basePcmSha256"],
            row["masterPcmSha256"],
            row["outputSha256"],
        )
        if any(not _sha256(value) for value in hashes):
            raise RuntimePackageError(f"asset hash mismatch: {variant_id}")
        if (
            row["sourceSha256"] in source_hashes
            or row["previewSha256"] in preview_hashes
            or row["outputSha256"] in output_hashes
        ):
            raise RuntimePackageError("exact 18-asset inventory is required")
        if (
            not isinstance(row["outputBytes"], int)
            or isinstance(row["outputBytes"], bool)
            or not 250000 <= row["outputBytes"] <= 2000000
        ):
            raise RuntimePackageError(f"output byte contract mismatch: {variant_id}")
        operations = row["operations"]
        if operations != list(ALLOWED_OPERATIONS):
            unexpected = next(
                (
                    operation
                    for operation in operations
                    if operation not in ALLOWED_OPERATIONS
                ),
                None,
            ) if isinstance(operations, list) else None
            if unexpected is not None:
                raise RuntimePackageError(
                    f"prohibited mastering operation: {unexpected}"
                )
            raise RuntimePackageError(f"mastering operation order mismatch: {variant_id}")
        metrics = row["assignmentMetrics"]
        if (
            not isinstance(metrics, dict)
            or set(metrics) != METRIC_KEYS
            or any(not _finite_number(value) for value in metrics.values())
        ):
            raise RuntimePackageError(f"assignment metrics mismatch: {variant_id}")
        qc = row["decodedQc"]
        if not isinstance(qc, dict) or set(qc) != QC_KEYS:
            raise RuntimePackageError(f"decoded QC keys mismatch: {variant_id}")
        if (
            qc["sampleRate"] != 48000
            or qc["channels"] != 2
            or qc["frameCount"] != 1440000
            or qc["durationSeconds"] != 30.0
            or qc["bitrateBps"] != 128000
            or qc["clippedSamples"] != 0
            or not _finite_number(qc["rmsDbfs"])
            or not _finite_number(qc["peakDbfs"])
            or not _finite_number(qc["boundaryJump"])
            or float(qc["peakDbfs"]) > -1.0
            or float(qc["boundaryJump"]) > 0.05
        ):
            raise RuntimePackageError(f"decoded QC contract mismatch: {variant_id}")
        seen_candidates.add(row["candidateId"])
        source_hashes.add(row["sourceSha256"])
        preview_hashes.add(row["previewSha256"])
        output_hashes.add(row["outputSha256"])
        rows_by_variant[variant_id] = row
    if seen_candidates != expected_candidates:
        raise RuntimePackageError("exact 18-asset inventory is required")
    for family in EXACT_FAMILIES:
        rms_values = [
            float(rows_by_variant[f"{family}:{level}"]["decodedQc"]["rmsDbfs"])
            for level in LEVELS
        ]
        score_values = [
            float(
                rows_by_variant[f"{family}:{level}"]["assignmentMetrics"][
                    "deliveryIntensityScore"
                ]
            )
            for level in LEVELS
        ]
        if score_values != sorted(score_values):
            raise RuntimePackageError(
                f"assignment intensity order mismatch: {family}"
            )
        if (
            rms_values[1] - rms_values[0] < 3.0
            or rms_values[2] - rms_values[1] < 3.0
        ):
            raise RuntimePackageError(f"adjacent RMS progression mismatch: {family}")
    return {
        "status": "PASS",
        "assetCount": 18,
        "runtimePromotionAllowed": False,
    }
