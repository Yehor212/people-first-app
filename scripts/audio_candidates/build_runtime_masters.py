from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
import tempfile

import numpy as np

from scripts.audio_review.evidence import write_sha256sums

from .build_previews import OUTPUT_ROOT as RAW_PREVIEW_ROOT
from .evidence import _write_json
from .mastering import (
    ALLOWED_OPERATIONS,
    RuntimeCandidateMeasurement,
    RuntimeAssignment,
    LEVELS,
    apply_linked_mastering,
    assign_family_levels,
    build_circular_base,
    build_delivery_pcm,
    encode_mp3,
    load_mastering_policy,
    measure_intensity,
    read_pcm_wav,
    rotate_to_quiet_boundary,
    select_delivery_assignment,
    write_pcm24_wav,
)
from .runtime_package import validate_runtime_manifest_payload
from .verify import _record_from_json, verify_raw_preview_package
from .verify_bundle import verify_source_audition_bundle


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
PRIVATE_ROOT = Path(
    "/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2"
)
SOURCE_AUDITION_ROOT = PRIVATE_ROOT / "source-audition-v1"
OUTPUT_ROOT = PRIVATE_ROOT / "runtime-masters-v2"
POLICY_PATH = REPOSITORY_ROOT / "config/audio/hyperfocus-runtime-mastering-v2.json"
AFCONVERT = Path("/usr/bin/afconvert")
AFINFO = Path("/usr/bin/afinfo")
BIT_RATE_PATTERN = re.compile(r"bit rate:\s*(\d+) bits per second")


class RuntimeMasterBuildError(RuntimeError):
    pass


def _utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _sha256_pcm(samples: np.ndarray) -> str:
    payload = np.ascontiguousarray(samples, dtype="<f8").tobytes()
    return hashlib.sha256(payload).hexdigest()


def _decode_mp3(mp3_path: Path, wav_path: Path) -> None:
    if not AFCONVERT.is_file():
        raise RuntimeMasterBuildError("fixed afconvert decoder is unavailable")
    if mp3_path.is_symlink() or not mp3_path.is_file():
        raise RuntimeMasterBuildError("MP3 decode input must be a regular file")
    if wav_path.exists() or wav_path.is_symlink():
        raise RuntimeMasterBuildError("decoded WAV output must be a new path")
    wav_path.parent.mkdir(parents=True, exist_ok=True)
    command = [
        str(AFCONVERT),
        str(mp3_path),
        str(wav_path),
        "-f",
        "WAVE",
        "-d",
        "LEI16@48000",
    ]
    result = subprocess.run(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=120,
        check=False,
        env={"PATH": "/usr/bin:/bin"},
    )
    if result.returncode != 0 or not wav_path.is_file():
        wav_path.unlink(missing_ok=True)
        detail = result.stderr[-2000:].replace("\x00", "")
        raise RuntimeMasterBuildError(
            f"afconvert decoder returned {result.returncode}: {detail}"
        )


def _mp3_bitrate(mp3_path: Path) -> int:
    if not AFINFO.is_file():
        raise RuntimeMasterBuildError("fixed afinfo probe is unavailable")
    result = subprocess.run(
        [str(AFINFO), str(mp3_path)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=30,
        check=False,
        env={"PATH": "/usr/bin:/bin"},
    )
    match = BIT_RATE_PATTERN.search(result.stdout)
    if result.returncode != 0 or match is None:
        raise RuntimeMasterBuildError("unable to verify MP3 bit rate")
    return int(match.group(1))


def _decoded_qc(mp3_path: Path, decoded_wav: Path) -> dict:
    _decode_mp3(mp3_path, decoded_wav)
    samples, sample_rate = read_pcm_wav(decoded_wav)
    metrics = measure_intensity(samples, sample_rate)
    peak = float(np.max(np.abs(samples)))
    peak_dbfs = 20.0 * math.log10(max(peak, 1e-12))
    clipped = int(np.count_nonzero(np.abs(samples) >= 0.999))
    boundary_jump = float(np.max(np.abs(samples[0] - samples[-1])))
    return {
        "sampleRate": sample_rate,
        "channels": int(samples.shape[1]),
        "frameCount": int(samples.shape[0]),
        "durationSeconds": round(samples.shape[0] / sample_rate, 6),
        "bitrateBps": _mp3_bitrate(mp3_path),
        "rmsDbfs": metrics.rms_dbfs,
        "peakDbfs": round(peak_dbfs, 6),
        "clippedSamples": clipped,
        "boundaryJump": round(boundary_jump, 9),
    }


def _load_inputs():
    verify_source_audition_bundle()
    verify_raw_preview_package(RAW_PREVIEW_ROOT)
    provenance = json.loads(
        (RAW_PREVIEW_ROOT / "preview-provenance.json").read_text(
            encoding="utf-8"
        )
    )
    rights = json.loads(
        (SOURCE_AUDITION_ROOT / "rights-ledger.json").read_text(encoding="utf-8")
    )
    preview_records = tuple(
        _record_from_json(row, RAW_PREVIEW_ROOT) for row in provenance["previews"]
    )
    rights_by_id = {row["candidateId"]: row for row in rights["candidates"]}
    measurements = []
    samples_by_id = {}
    for record in preview_records:
        samples, sample_rate = read_pcm_wav(Path(record.preview_path))
        if record.preview_sha256 != _sha256_file(Path(record.preview_path)):
            raise RuntimeMasterBuildError("preview hash changed before mastering")
        samples_by_id[record.candidate_id] = samples
        measurements.append(
            RuntimeCandidateMeasurement(
                candidate_id=record.candidate_id,
                family=record.candidate_id.split("-", 1)[0],
                source_sha256=record.source_sha256,
                preview_sha256=record.preview_sha256,
                metrics=measure_intensity(samples, sample_rate),
            )
        )
    assignments = assign_family_levels(tuple(measurements))
    if set(rights_by_id) != {assignment.candidate_id for assignment in assignments}:
        raise RuntimeMasterBuildError("rights ledger does not cover runtime assignments")
    return assignments, samples_by_id, rights_by_id


def _refine_assignments_for_delivery(
    raw_assignments: tuple[RuntimeAssignment, ...],
    samples_by_id: dict[str, np.ndarray],
    policy,
) -> tuple[tuple[RuntimeAssignment, ...], dict[tuple[str, str], dict]]:
    raw_by_candidate = {row.candidate_id: row for row in raw_assignments}
    rendered: dict[tuple[str, str], dict] = {}
    final_assignments = []
    for family in ("forest", "rain", "ocean", "fireplace", "river", "wind"):
        family_raw = tuple(row for row in raw_assignments if row.family == family)
        raw_order = tuple(row.candidate_id for row in family_raw)
        score_matrix = {}
        for candidate_id in raw_order:
            unrotated_base = build_circular_base(
                samples_by_id[candidate_id],
                policy.sample_rate,
                policy.crossfade_seconds,
            )
            base, rotation_frames = rotate_to_quiet_boundary(
                unrotated_base,
                policy.sample_rate,
            )
            delivery = build_delivery_pcm(
                base,
                policy.sample_rate,
                policy.delivery_seconds,
            )
            for level in LEVELS:
                mastered, mastering_receipt = apply_linked_mastering(
                    delivery,
                    target_rms_dbfs=policy.target_rms_dbfs[level],
                    peak_ceiling_dbfs=policy.peak_ceiling_dbfs,
                )
                delivery_score = measure_intensity(
                    mastered,
                    policy.sample_rate,
                ).intensity_score
                score_matrix[(candidate_id, level)] = delivery_score
                rendered[(candidate_id, level)] = {
                    "base": base,
                    "rotationFrames": rotation_frames,
                    "mastered": mastered,
                    "masteringReceipt": mastering_receipt,
                    "deliveryIntensityScore": delivery_score,
                }
        selected = select_delivery_assignment(
            family,
            raw_order,
            score_matrix,
            minimum_delta=policy.min_adjacent_rms_delta_db,
        )
        for rank, (level, candidate_id) in enumerate(
            zip(LEVELS, selected),
            start=1,
        ):
            raw = raw_by_candidate[candidate_id]
            final_assignments.append(
                RuntimeAssignment(
                    family=family,
                    level=level,
                    candidate_id=candidate_id,
                    source_sha256=raw.source_sha256,
                    preview_sha256=raw.preview_sha256,
                    rank=rank,
                    metrics=raw.metrics,
                )
            )
    return tuple(final_assignments), rendered


def build_runtime_masters() -> Path:
    if OUTPUT_ROOT.exists() or OUTPUT_ROOT.is_symlink():
        raise RuntimeMasterBuildError("runtime master output already exists")
    policy = load_mastering_policy(POLICY_PATH)
    raw_assignments, samples_by_id, rights_by_id = _load_inputs()
    assignments, rendered = _refine_assignments_for_delivery(
        raw_assignments,
        samples_by_id,
        policy,
    )
    PRIVATE_ROOT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(
        dir=PRIVATE_ROOT,
        prefix=".runtime-masters-v2.",
    ) as temporary_name:
        staging = Path(temporary_name) / "package"
        audio_root = staging / "audio"
        pcm_root = staging / "pcm"
        analysis_root = staging / "analysis"
        audio_root.mkdir(parents=True)
        pcm_root.mkdir()
        analysis_root.mkdir()
        manifest_assets = []
        provenance_assets = []
        for assignment in assignments:
            selected_render = rendered[
                (assignment.candidate_id, assignment.level)
            ]
            base = selected_render["base"]
            rotation_frames = selected_render["rotationFrames"]
            mastered = selected_render["mastered"]
            mastering_receipt = selected_render["masteringReceipt"]
            safe_id = assignment.variant_id.replace(":", "--")
            pcm_path = pcm_root / f"{safe_id}.wav"
            mp3_path = audio_root / assignment.file_name
            decoded_path = analysis_root / f"{safe_id}.wav"
            write_pcm24_wav(mastered, policy.sample_rate, pcm_path)
            encoder_receipt = encode_mp3(pcm_path, mp3_path)
            decoded_qc = _decoded_qc(mp3_path, decoded_path)
            row = {
                "variantId": assignment.variant_id,
                "family": assignment.family,
                "level": assignment.level,
                "candidateId": assignment.candidate_id,
                "sourceSha256": assignment.source_sha256,
                "previewSha256": assignment.preview_sha256,
                "basePcmSha256": _sha256_pcm(base),
                "masterPcmSha256": _sha256_file(pcm_path),
                "fileName": assignment.file_name,
                "outputSha256": _sha256_file(mp3_path),
                "outputBytes": mp3_path.stat().st_size,
                "operations": list(ALLOWED_OPERATIONS),
                "assignmentMetrics": {
                    **assignment.metrics.to_dict(),
                    "deliveryIntensityScore": selected_render[
                        "deliveryIntensityScore"
                    ],
                },
                "decodedQc": decoded_qc,
            }
            manifest_assets.append(row)
            rights = rights_by_id[assignment.candidate_id]
            provenance_assets.append(
                {
                    **row,
                    "source": {
                        "soundNumber": rights["soundNumber"],
                        "title": rights["title"],
                        "author": rights["author"],
                        "sourcePageUrl": rights["sourcePageUrl"],
                        "licenseId": rights["licenseId"],
                        "licenseUrl": rights["licenseUrl"],
                        "rightsLegalStatus": "UNVERIFIED",
                    },
                    "loop": {
                        "reviewedSourceSeconds": policy.source_preview_seconds,
                        "crossfadeSeconds": policy.crossfade_seconds,
                        "baseLoopSeconds": policy.base_loop_seconds,
                        "rotationFrames": rotation_frames,
                        "repeatCount": 2,
                        "deliverySeconds": policy.delivery_seconds,
                    },
                    "mastering": mastering_receipt,
                    "encoder": encoder_receipt,
                }
            )
        runtime_manifest = {
            "schemaVersion": 2,
            "status": "RUNTIME_MASTERS_TECHNICAL_PASS_REVIEW_PENDING",
            "runtimePromotionAllowed": False,
            "assetCount": 18,
            "minAdjacentRmsDeltaDb": policy.min_adjacent_rms_delta_db,
            "assets": manifest_assets,
        }
        validate_runtime_manifest_payload(runtime_manifest)
        _write_json(staging / "runtime-manifest.json", runtime_manifest)
        _write_json(
            staging / "assignment.json",
            {
                "schemaVersion": 1,
                "method": "signal-intensity-ascending-candidate-id-tiebreak",
                "blindLabelsUsed": False,
                "assignments": [
                    {
                        **assignment.to_dict(),
                        "deliveryIntensityScore": rendered[
                            (assignment.candidate_id, assignment.level)
                        ]["deliveryIntensityScore"],
                    }
                    for assignment in assignments
                ],
            },
        )
        _write_json(
            staging / "provenance.json",
            {
                "schemaVersion": 2,
                "status": "TECHNICAL_PASS_REVIEW_PENDING",
                "runtimePromotionAllowed": False,
                "sourceAuditionBundleSha256": json.loads(
                    (SOURCE_AUDITION_ROOT / "blind-map.json").read_text(
                        encoding="utf-8"
                    )
                )["bundleSha256"],
                "policySha256": _sha256_file(POLICY_PATH),
                "assets": provenance_assets,
                "humanLoopReview": "UNVERIFIED",
                "aiStatus": "UNVERIFIED",
                "storeReleaseStatus": "STOP",
            },
        )
        _write_json(
            staging / "qc.json",
            {
                "schemaVersion": 1,
                "status": "PASS",
                "assetCount": 18,
                "rows": [
                    {"variantId": row["variantId"], **row["decodedQc"]}
                    for row in manifest_assets
                ],
            },
        )
        _write_json(
            staging / "build-environment.json",
            {
                "schemaVersion": 1,
                "builtAt": _utc_timestamp(),
                "policySha256": _sha256_file(POLICY_PATH),
                "sourcePreviewInventorySha256": _sha256_file(
                    RAW_PREVIEW_ROOT / "SHA256SUMS"
                ),
                "sourceAuditionInventorySha256": _sha256_file(
                    SOURCE_AUDITION_ROOT / "SHA256SUMS"
                ),
                "lameSourceArchiveSha256": policy.encoder.source_archive_sha256,
                "lameExecutableSha256": _sha256_file(
                    Path(policy.encoder.executable)
                ),
                "lameExternalSourceSecurityStatus": "FAIL_SCOPED_EXTERNAL_SOURCE",
                "lameSourceSecurityReport": "/Users/yehor/.codex/security/reports/20260826T004738Z-62025",
                "pkgconfSourceSecurityStatus": "FAIL_SCOPED_BUILD_DEPENDENCY",
                "pkgconfSourceSecurityReport": "/Users/yehor/.codex/security/reports/20260826T005024Z-65425",
                "runtimePromotionAllowed": False,
            },
        )
        inventory_files = tuple(
            path
            for path in staging.rglob("*")
            if path.is_file() and path.name != "SHA256SUMS"
        )
        write_sha256sums(staging, inventory_files)
        staging.replace(OUTPUT_ROOT)
    return OUTPUT_ROOT


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Build the fixed reviewed Hyperfocus runtime master package."
    )
    parser.parse_args(argv)
    output = build_runtime_masters()
    print(f"PASS: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
