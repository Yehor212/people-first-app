from __future__ import annotations

from dataclasses import dataclass
from collections import deque
import hashlib
import json
import math
from pathlib import Path
import subprocess
from types import MappingProxyType
from typing import Mapping
import wave

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
    "decodedPeakCeilingDbfs",
    "minAdjacentRmsDeltaDb",
    "targetRmsDbfs",
    "operations",
    "encoder",
}
ENCODER_KEYS = {
    "executable",
    "version",
    "sourceUrl",
    "sourceArchiveSha256",
    "buildFlags",
    "bitrateBps",
}
ALLOWED_OPERATIONS = (
    "decode-pcm",
    "equal-power-loop-crossfade",
    "quiet-boundary-rotate",
    "repeat-exactly-twice",
    "linked-gain",
    "safety-peak-limit",
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
    version: str
    source_url: str
    source_archive_sha256: str
    build_flags: tuple[str, ...]
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
    decoded_peak_ceiling_dbfs: float
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
        or payload["peakCeilingDbfs"] != -6
        or payload["decodedPeakCeilingDbfs"] != -1
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
            "executable": "/Users/yehor/Projects/ZenFlow/private-evidence/audio-encoder/lame-4.0-install/bin/lame",
            "version": "4.0",
            "sourceUrl": "https://downloads.sourceforge.net/project/lame/lame/4.0/lame-4.0.tar.gz",
            "sourceArchiveSha256": "3df5124d5ad3a98312ffd7ba6a9b36230e4f8a3e66d3ce0f425e336c32d216eb",
            "buildFlags": [
                "--disable-shared",
                "--enable-static",
                "--disable-decoder",
                "--disable-gtktest",
                "CPPFLAGS=-include locale.h",
            ],
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
        peak_ceiling_dbfs=-6.0,
        decoded_peak_ceiling_dbfs=-1.0,
        min_adjacent_rms_delta_db=3.0,
        target_rms_dbfs=MappingProxyType({
            "soft": -30.0,
            "deep": -26.0,
            "intense": -22.0,
        }),
        operations=ALLOWED_OPERATIONS,
        encoder=MasteringEncoderPolicy(
            executable="/Users/yehor/Projects/ZenFlow/private-evidence/audio-encoder/lame-4.0-install/bin/lame",
            version="4.0",
            source_url="https://downloads.sourceforge.net/project/lame/lame/4.0/lame-4.0.tar.gz",
            source_archive_sha256="3df5124d5ad3a98312ffd7ba6a9b36230e4f8a3e66d3ce0f425e336c32d216eb",
            build_flags=(
                "--disable-shared",
                "--enable-static",
                "--disable-decoder",
                "--disable-gtktest",
                "CPPFLAGS=-include locale.h",
            ),
            bitrate_bps=128000,
        ),
    )


def _validate_stereo_pcm(
    samples: np.ndarray,
    sample_rate: int,
    *,
    expected_frames: int | None = None,
) -> np.ndarray:
    data = np.asarray(samples, dtype=np.float64)
    if data.ndim != 2 or data.shape[1] != 2:
        raise MasteringError("mastering input must be stereo")
    if sample_rate != 48000:
        raise MasteringError("mastering input must be 48 kHz")
    if expected_frames is not None and data.shape[0] != expected_frames:
        raise MasteringError(
            f"mastering input requires exactly {expected_frames} frames"
        )
    if data.size == 0 or not np.isfinite(data).all():
        raise MasteringError("mastering input must contain finite samples")
    return np.ascontiguousarray(data, dtype=np.float64)


def build_circular_base(
    samples: np.ndarray,
    sample_rate: int,
    crossfade_seconds: float,
) -> np.ndarray:
    source_frames = 20 * 48000
    data = _validate_stereo_pcm(
        samples,
        sample_rate,
        expected_frames=source_frames,
    )
    if crossfade_seconds != 5.0:
        raise MasteringError("runtime crossfade must be exactly 5 seconds")
    crossfade_frames = round(crossfade_seconds * sample_rate)
    base_frames = source_frames - crossfade_frames
    tail = data[base_frames:source_frames]
    head = data[:crossfade_frames]
    phase = np.linspace(
        0.0,
        math.pi / 2.0,
        crossfade_frames,
        endpoint=True,
        dtype=np.float64,
    )[:, None]
    overlap = tail * np.cos(phase) + head * np.sin(phase)
    middle = data[crossfade_frames:base_frames]
    base = np.concatenate((overlap, middle), axis=0)
    if base.shape != (15 * sample_rate, 2):
        raise MasteringError("circular base frame count mismatch")
    return np.ascontiguousarray(base, dtype=np.float64)


def build_delivery_pcm(
    base: np.ndarray,
    sample_rate: int,
    delivery_seconds: float,
) -> np.ndarray:
    data = _validate_stereo_pcm(
        base,
        sample_rate,
        expected_frames=15 * 48000,
    )
    if delivery_seconds != 30.0:
        raise MasteringError("runtime delivery must be exactly 30 seconds")
    delivery = np.concatenate((data, data), axis=0)
    if delivery.shape != (30 * sample_rate, 2):
        raise MasteringError("delivery frame count mismatch")
    return np.ascontiguousarray(delivery, dtype=np.float64)


def rotate_to_quiet_boundary(
    base: np.ndarray,
    sample_rate: int,
) -> tuple[np.ndarray, int]:
    data = _validate_stereo_pcm(
        base,
        sample_rate,
        expected_frames=15 * 48000,
    )
    radius = round(0.02 * sample_rate)
    per_frame_energy = np.mean(np.square(data), axis=1, dtype=np.float64)
    circular_energy = np.concatenate(
        (
            per_frame_energy[-radius:],
            per_frame_energy,
            per_frame_energy[:radius],
        )
    )
    prefix = np.concatenate(
        (np.zeros(1, dtype=np.float64), np.cumsum(circular_energy))
    )
    window_size = radius * 2 + 1
    local_sums = prefix[window_size:] - prefix[:-window_size]
    local_rms = np.sqrt(local_sums[: len(data)] / window_size)
    previous = np.roll(data, 1, axis=0)
    adjacent_jump = np.max(np.abs(data - previous), axis=1)
    score = adjacent_jump + 0.25 * local_rms
    rotation_frames = int(np.argmin(score))
    if rotation_frames == 0:
        return np.ascontiguousarray(data.copy()), 0
    rotated = np.concatenate(
        (data[rotation_frames:], data[:rotation_frames]),
        axis=0,
    )
    return np.ascontiguousarray(rotated, dtype=np.float64), rotation_frames


def apply_linked_mastering(
    samples: np.ndarray,
    *,
    target_rms_dbfs: float,
    peak_ceiling_dbfs: float,
) -> tuple[np.ndarray, dict]:
    data = _validate_stereo_pcm(samples, 48000)
    if target_rms_dbfs not in (-30.0, -26.0, -22.0):
        raise MasteringError("unapproved target RMS")
    if peak_ceiling_dbfs != -6.0:
        raise MasteringError("runtime pre-encode peak ceiling must be -6 dBFS")
    rms_before = float(np.sqrt(np.mean(np.square(data), dtype=np.float64)))
    if rms_before <= 1e-12:
        raise MasteringError("mastering input must not be silent")
    period_frames = 15 * 48000
    if data.shape[0] != period_frames * 2 or not np.array_equal(
        data[:period_frames], data[period_frames:]
    ):
        raise MasteringError("linked mastering requires two exact 15-second periods")
    target_linear = 10.0 ** (target_rms_dbfs / 20.0)
    mastered_base = data[:period_frames].copy()
    operations = ["linked-gain"]
    peak_ceiling_linear = 10.0 ** (peak_ceiling_dbfs / 20.0)
    total_gain = 1.0
    max_limiter_reduction_db = 0.0
    limiter_used = False
    lookahead_frames = round(0.005 * 48000)
    release_coefficient = math.exp(-1.0 / (0.1 * 48000))

    def forward_max_circular(values: np.ndarray) -> np.ndarray:
        extended = np.concatenate((values, values[:lookahead_frames]))
        output = np.empty(len(values), dtype=np.float64)
        candidates: deque[int] = deque()
        for index, value in enumerate(extended):
            while candidates and extended[candidates[-1]] <= value:
                candidates.pop()
            candidates.append(index)
            left = index - lookahead_frames
            while candidates and candidates[0] < left:
                candidates.popleft()
            start = index - lookahead_frames
            if 0 <= start < len(values):
                output[start] = extended[candidates[0]]
        return output

    for _iteration in range(8):
        current_rms = float(
            np.sqrt(np.mean(np.square(mastered_base), dtype=np.float64))
        )
        correction = target_linear / max(current_rms, 1e-12)
        mastered_base *= correction
        total_gain *= correction
        frame_peak = np.max(np.abs(mastered_base), axis=1)
        lookahead_peak = forward_max_circular(frame_peak)
        desired_gain = np.minimum(
            1.0,
            peak_ceiling_linear / np.maximum(lookahead_peak, 1e-12),
        )
        if np.any(desired_gain < 1.0):
            limiter_used = True
            gain = float(desired_gain[-1])
            gains = np.ones(period_frames, dtype=np.float64)
            for cycle in range(3):
                for index, desired in enumerate(desired_gain):
                    if desired < gain:
                        gain = float(desired)
                    else:
                        gain = (
                            release_coefficient * gain
                            + (1.0 - release_coefficient) * float(desired)
                        )
                    if cycle == 2:
                        gains[index] = gain
            mastered_base *= gains[:, None]
            max_limiter_reduction_db = min(
                max_limiter_reduction_db,
                float(20.0 * math.log10(max(float(np.min(gains)), 1e-12))),
            )
        actual_rms = float(
            np.sqrt(np.mean(np.square(mastered_base), dtype=np.float64))
        )
        if abs(20.0 * math.log10(max(actual_rms, 1e-12)) - target_rms_dbfs) <= 0.05:
            break
    if limiter_used:
        operations.append("safety-peak-limit")
    mastered = np.concatenate((mastered_base, mastered_base), axis=0)
    rms_after = float(np.sqrt(np.mean(np.square(mastered), dtype=np.float64)))
    peak_after = float(np.max(np.abs(mastered)))
    actual_rms_dbfs = 20.0 * math.log10(max(rms_after, 1e-12))
    if actual_rms_dbfs > target_rms_dbfs + 0.1:
        raise MasteringError("linked mastering exceeded target RMS")
    if peak_after > peak_ceiling_linear + 1e-12:
        raise MasteringError("linked safety limiter exceeded peak ceiling")
    receipt = {
        "targetRmsDbfs": target_rms_dbfs,
        "peakCeilingDbfs": peak_ceiling_dbfs,
        "linkedGainDb": round(20.0 * math.log10(total_gain), 6),
        "maxLimiterGainReductionDb": round(max_limiter_reduction_db, 6),
        "lookaheadFrames": lookahead_frames,
        "releaseMs": 100.0,
        "actualRmsDbfs": round(actual_rms_dbfs, 6),
        "actualPeakDbfs": round(20.0 * math.log10(max(peak_after, 1e-12)), 6),
        "operations": operations,
    }
    return np.ascontiguousarray(mastered, dtype=np.float64), receipt


def verify_mastering_operations(operations: tuple[str, ...]) -> None:
    prohibited = [operation for operation in operations if operation not in ALLOWED_OPERATIONS]
    if prohibited:
        raise MasteringError(f"prohibited mastering operation: {prohibited[0]}")


def _pcm24_bytes(samples: np.ndarray) -> bytes:
    integers = np.rint(samples.reshape(-1) * ((1 << 23) - 1)).astype(np.int32)
    unsigned = integers & 0xFFFFFF
    packed = np.empty((len(unsigned), 3), dtype=np.uint8)
    packed[:, 0] = unsigned & 0xFF
    packed[:, 1] = (unsigned >> 8) & 0xFF
    packed[:, 2] = (unsigned >> 16) & 0xFF
    return packed.tobytes()


def write_pcm24_wav(samples: np.ndarray, sample_rate: int, output_path: Path) -> Path:
    data = _validate_stereo_pcm(samples, sample_rate)
    if float(np.max(np.abs(data))) > 1.0:
        raise MasteringError("PCM output exceeds full scale")
    output = Path(output_path)
    if output.exists() or output.is_symlink():
        raise MasteringError("PCM output must be a new regular path")
    if output.parent.is_symlink():
        raise MasteringError("PCM output parent may not be a symlink")
    output.parent.mkdir(parents=True, exist_ok=True)
    try:
        with wave.open(str(output), "wb") as destination:
            destination.setnchannels(2)
            destination.setsampwidth(3)
            destination.setframerate(sample_rate)
            destination.writeframes(_pcm24_bytes(data))
    except (OSError, wave.Error) as exc:
        output.unlink(missing_ok=True)
        raise MasteringError(f"unable to write PCM24 WAV: {exc}") from exc
    return output


def read_pcm_wav(path: Path) -> tuple[np.ndarray, int]:
    source = Path(path)
    if source.is_symlink() or not source.is_file() or source.stat().st_nlink != 1:
        raise MasteringError("PCM input must be one regular WAV")
    try:
        with wave.open(str(source), "rb") as input_wave:
            params = input_wave.getparams()
            frames = input_wave.readframes(params.nframes)
    except (OSError, EOFError, wave.Error) as exc:
        raise MasteringError(f"unable to read PCM WAV: {exc}") from exc
    if (
        params.comptype != "NONE"
        or params.nchannels != 2
        or params.framerate != 48000
        or params.sampwidth not in (2, 3, 4)
    ):
        raise MasteringError("PCM input must be uncompressed 48 kHz stereo")
    expected_bytes = params.nframes * params.nchannels * params.sampwidth
    if len(frames) != expected_bytes:
        raise MasteringError("PCM WAV frame payload is truncated")
    if params.sampwidth == 2:
        integers = np.frombuffer(frames, dtype="<i2").astype(np.float64)
        scale = float(1 << 15)
    elif params.sampwidth == 3:
        raw = np.frombuffer(frames, dtype=np.uint8).reshape(-1, 3)
        unsigned = (
            raw[:, 0].astype(np.int32)
            | (raw[:, 1].astype(np.int32) << 8)
            | (raw[:, 2].astype(np.int32) << 16)
        )
        integers = np.where(
            unsigned & 0x800000,
            unsigned - 0x1000000,
            unsigned,
        ).astype(np.float64)
        scale = float(1 << 23)
    else:
        integers = np.frombuffer(frames, dtype="<i4").astype(np.float64)
        scale = float(1 << 31)
    samples = (integers / scale).reshape(-1, 2)
    if not np.isfinite(samples).all():
        raise MasteringError("PCM input must contain finite samples")
    return np.ascontiguousarray(samples, dtype=np.float64), params.framerate


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def encode_mp3(input_wav: Path, output_mp3: Path) -> dict:
    source = Path(input_wav)
    output = Path(output_mp3)
    executable = Path(
        "/Users/yehor/Projects/ZenFlow/private-evidence/audio-encoder/lame-4.0-install/bin/lame"
    )
    if executable.is_symlink() or not executable.is_file():
        raise MasteringError("fixed private LAME 4.0 encoder is unavailable")
    if source.is_symlink() or not source.is_file():
        raise MasteringError("MP3 input must be a regular WAV")
    if output.exists() or output.is_symlink():
        raise MasteringError("MP3 output must be a new path")
    if output.parent.is_symlink():
        raise MasteringError("MP3 output parent may not be a symlink")
    output.parent.mkdir(parents=True, exist_ok=True)
    command = [
        str(executable),
        "--silent",
        "--noreplaygain",
        "--cbr",
        "-b",
        "128",
        str(source.resolve(strict=True)),
        str(output),
    ]
    try:
        result = subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=120,
            check=False,
            env={"PATH": "/usr/bin:/bin"},
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise MasteringError(f"MP3 encoder failed: {exc}") from exc
    if result.returncode != 0 or not output.is_file():
        output.unlink(missing_ok=True)
        detail = result.stderr[-2000:].replace("\x00", "")
        raise MasteringError(f"MP3 encoder returned {result.returncode}: {detail}")
    version_result = subprocess.run(
        [str(executable), "--version"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=10,
        check=False,
        env={"PATH": "/usr/bin:/bin"},
    )
    if version_result.returncode != 0 or "version 4.0" not in version_result.stdout:
        output.unlink(missing_ok=True)
        raise MasteringError("private LAME version evidence mismatch")
    return {
        "encoder": "LAME",
        "encoderVersion": "4.0",
        "executable": str(executable),
        "executableSha256": _sha256_file(executable),
        "sourceArchiveSha256": "3df5124d5ad3a98312ffd7ba6a9b36230e4f8a3e66d3ce0f425e336c32d216eb",
        "externalSourceSecurityStatus": "FAIL_SCOPED_EXTERNAL_SOURCE",
        "argv": command,
        "bitrateBps": 128000,
        "inputSha256": _sha256_file(source),
        "outputSha256": _sha256_file(output),
        "outputBytes": output.stat().st_size,
    }
