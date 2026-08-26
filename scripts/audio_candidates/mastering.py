from __future__ import annotations

from dataclasses import dataclass
import json
import math
from pathlib import Path
from types import MappingProxyType
from typing import Mapping

import numpy as np

from .model import EXACT_FAMILIES


LEVELS = ("soft", "deep", "intense")
POLICY_ROOT_KEYS = {
    "schemaVersion",
    "status",
    "sampleRate",
    "channels",
    "sourcePreviewSeconds",
    "crossfadeSeconds",
    "baseLoopSeconds",
    "deliverySeconds",
    "bitrateKbps",
    "peakCeilingDbfs",
    "minAdjacentRmsDeltaDb",
    "targetRmsDbfs",
    "operations",
    "encoder",
}
ENCODER_KEYS = {"executable", "fileFormat", "dataFormat", "bitrateBps"}
ALLOWED_OPERATIONS = (
    "decode-pcm",
    "equal-power-loop-crossfade",
    "repeat-exactly-twice",
    "linked-gain",
    "safety-peak-scale",
    "encode-mp3",
)


class MasteringError(RuntimeError):
    pass


@dataclass(frozen=True)
class IntensityMetrics:
    rms_dbfs: float
    motion_dbfs: float
    zero_crossings_per_second: float
    crest_factor_db: float
    intensity_score: float

    def to_dict(self) -> dict[str, float]:
        return {
            "rmsDbfs": self.rms_dbfs,
            "motionDbfs": self.motion_dbfs,
            "zeroCrossingsPerSecond": self.zero_crossings_per_second,
            "crestFactorDb": self.crest_factor_db,
            "intensityScore": self.intensity_score,
        }


@dataclass(frozen=True)
class RuntimeCandidateMeasurement:
    candidate_id: str
    family: str
    source_sha256: str
    preview_sha256: str
    metrics: IntensityMetrics


@dataclass(frozen=True)
class RuntimeAssignment:
    family: str
    level: str
    candidate_id: str
    source_sha256: str
    preview_sha256: str
    rank: int
    metrics: IntensityMetrics

    @property
    def variant_id(self) -> str:
        return f"{self.family}:{self.level}"

    @property
    def file_name(self) -> str:
        return f"hyperfocus-{self.family}-{self.level}.mp3"

    def to_dict(self) -> dict:
        return {
            "variantId": self.variant_id,
            "family": self.family,
            "level": self.level,
            "candidateId": self.candidate_id,
            "sourceSha256": self.source_sha256,
            "previewSha256": self.preview_sha256,
            "rank": self.rank,
            "fileName": self.file_name,
            "metrics": self.metrics.to_dict(),
        }


@dataclass(frozen=True)
class MasteringEncoderPolicy:
    executable: str
    file_format: str
    data_format: str
    bitrate_bps: int


@dataclass(frozen=True)
class MasteringPolicy:
    schema_version: int
    status: str
    sample_rate: int
    channels: int
    source_preview_seconds: float
    crossfade_seconds: float
    base_loop_seconds: float
    delivery_seconds: float
    bitrate_kbps: int
    peak_ceiling_dbfs: float
    min_adjacent_rms_delta_db: float
    target_rms_dbfs: Mapping[str, float]
    operations: tuple[str, ...]
    encoder: MasteringEncoderPolicy


def _finite_db(value: float) -> float:
    if not math.isfinite(value):
        raise MasteringError("intensity metric must be finite")
    return round(float(value), 6)


def measure_intensity(samples: np.ndarray, sample_rate: int) -> IntensityMetrics:
    data = np.asarray(samples, dtype=np.float64)
    if data.ndim != 2 or data.shape[1] != 2:
        raise MasteringError("intensity input must be stereo")
    if sample_rate != 48000:
        raise MasteringError("intensity input must be 48 kHz")
    if data.shape[0] < 2 or not np.isfinite(data).all():
        raise MasteringError("intensity input must contain finite samples")
    rms = float(np.sqrt(np.mean(np.square(data), dtype=np.float64)))
    if rms <= 1e-12:
        raise MasteringError("intensity input must not be silent")
    mono = np.mean(data, axis=1, dtype=np.float64)
    motion = float(np.sqrt(np.mean(np.square(np.diff(mono)), dtype=np.float64)))
    signs = np.signbit(mono)
    zero_crossings = int(np.count_nonzero(signs[1:] != signs[:-1]))
    duration_seconds = data.shape[0] / sample_rate
    zero_crossings_per_second = zero_crossings / duration_seconds
    peak = float(np.max(np.abs(data)))
    rms_dbfs = 20.0 * math.log10(max(rms, 1e-12))
    motion_dbfs = 20.0 * math.log10(max(motion, 1e-12))
    crest_factor_db = 20.0 * math.log10(max(peak, 1e-12) / rms)
    intensity_score = (
        (rms_dbfs + 60.0) * 1.2
        + (motion_dbfs + 70.0) * 0.45
        + min(20.0, zero_crossings_per_second / 400.0)
    )
    return IntensityMetrics(
        rms_dbfs=_finite_db(rms_dbfs),
        motion_dbfs=_finite_db(motion_dbfs),
        zero_crossings_per_second=_finite_db(zero_crossings_per_second),
        crest_factor_db=_finite_db(crest_factor_db),
        intensity_score=_finite_db(intensity_score),
    )


def _valid_sha256(value: str) -> bool:
    return (
        isinstance(value, str)
        and len(value) == 64
        and all(character in "0123456789abcdef" for character in value)
    )


def assign_family_levels(
    records: tuple[RuntimeCandidateMeasurement, ...],
) -> tuple[RuntimeAssignment, ...]:
    expected_ids = {
        f"{family}-c{position}"
        for family in EXACT_FAMILIES
        for position in (1, 2, 3)
    }
    candidate_ids = [record.candidate_id for record in records]
    if len(records) != 18 or len(set(candidate_ids)) != 18 or set(candidate_ids) != expected_ids:
        raise MasteringError("exact 18-candidate inventory is required")
    by_family: dict[str, list[RuntimeCandidateMeasurement]] = {
        family: [] for family in EXACT_FAMILIES
    }
    for record in records:
        if (
            record.family not in by_family
            or not record.candidate_id.startswith(f"{record.family}-c")
            or not _valid_sha256(record.source_sha256)
            or not _valid_sha256(record.preview_sha256)
            or not all(
                math.isfinite(value)
                for value in (
                    record.metrics.rms_dbfs,
                    record.metrics.motion_dbfs,
                    record.metrics.zero_crossings_per_second,
                    record.metrics.crest_factor_db,
                    record.metrics.intensity_score,
                )
            )
        ):
            raise MasteringError(f"invalid candidate measurement: {record.candidate_id}")
        by_family[record.family].append(record)
    assignments: list[RuntimeAssignment] = []
    for family in EXACT_FAMILIES:
        ordered = sorted(
            by_family[family],
            key=lambda row: (row.metrics.intensity_score, row.candidate_id),
        )
        if len(ordered) != 3:
            raise MasteringError("exact 18-candidate inventory is required")
        assignments.extend(
            RuntimeAssignment(
                family=family,
                level=level,
                candidate_id=record.candidate_id,
                source_sha256=record.source_sha256,
                preview_sha256=record.preview_sha256,
                rank=rank,
                metrics=record.metrics,
            )
            for rank, (level, record) in enumerate(zip(LEVELS, ordered), start=1)
        )
    return tuple(assignments)


def _strict_object(pairs):
    output = {}
    for key, value in pairs:
        if key in output:
            raise MasteringError(f"duplicate mastering policy key: {key}")
        output[key] = value
    return output


def load_mastering_policy(path: str | Path) -> MasteringPolicy:
    source = Path(path)
    if source.is_symlink() or not source.is_file():
        raise MasteringError("mastering policy must be a regular file")
    try:
        payload = json.loads(
            source.read_text(encoding="utf-8"),
            object_pairs_hook=_strict_object,
        )
    except MasteringError:
        raise
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise MasteringError(f"invalid mastering policy: {exc}") from exc
    if not isinstance(payload, dict) or set(payload) != POLICY_ROOT_KEYS:
        raise MasteringError("mastering policy root keys mismatch")
    if (
        payload["schemaVersion"] != 2
        or payload["status"] != "REVIEW_ONLY"
        or payload["sampleRate"] != 48000
        or payload["channels"] != 2
        or payload["sourcePreviewSeconds"] != 20
        or payload["crossfadeSeconds"] != 5
        or payload["baseLoopSeconds"] != 15
        or payload["deliverySeconds"] != 30
        or payload["bitrateKbps"] != 128
        or payload["peakCeilingDbfs"] != -1
        or payload["minAdjacentRmsDeltaDb"] != 3
        or payload["operations"] != list(ALLOWED_OPERATIONS)
    ):
        raise MasteringError("mastering policy fixed contract mismatch")
    targets = payload["targetRmsDbfs"]
    if not isinstance(targets, dict) or targets != {
        "soft": -30,
        "deep": -26,
        "intense": -22,
    }:
        raise MasteringError("mastering target RMS contract mismatch")
    encoder = payload["encoder"]
    if (
        not isinstance(encoder, dict)
        or set(encoder) != ENCODER_KEYS
        or encoder != {
            "executable": "/usr/bin/afconvert",
            "fileFormat": "MPG3",
            "dataFormat": ".mp3",
            "bitrateBps": 128000,
        }
    ):
        raise MasteringError("mastering encoder contract mismatch")
    return MasteringPolicy(
        schema_version=2,
        status="REVIEW_ONLY",
        sample_rate=48000,
        channels=2,
        source_preview_seconds=20.0,
        crossfade_seconds=5.0,
        base_loop_seconds=15.0,
        delivery_seconds=30.0,
        bitrate_kbps=128,
        peak_ceiling_dbfs=-1.0,
        min_adjacent_rms_delta_db=3.0,
        target_rms_dbfs=MappingProxyType({
            "soft": -30.0,
            "deep": -26.0,
            "intense": -22.0,
        }),
        operations=ALLOWED_OPERATIONS,
        encoder=MasteringEncoderPolicy(
            executable="/usr/bin/afconvert",
            file_format="MPG3",
            data_format=".mp3",
            bitrate_bps=128000,
        ),
    )
