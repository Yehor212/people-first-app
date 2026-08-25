from __future__ import annotations

from dataclasses import asdict, dataclass
import hashlib
import json
import math
from pathlib import Path
import shutil
import tempfile

import numpy as np
from scipy.signal import resample_poly
import soundfile as sf

from .audio_io import AudioView, PreprocessError, decode_audio_view, file_sha256
from .model import AuditPolicy


TARGET_SAMPLE_RATE = 48000


@dataclass(frozen=True)
class AuditWindow:
    id: str
    start_frame: int
    end_frame: int
    sample_rate: int
    mono: np.ndarray
    sha256: str


@dataclass(frozen=True)
class PreprocessReceipt:
    schema_version: int
    input_path: str
    input_sha256: str
    normalized_path: str
    normalized_sha256: str
    target_rms_dbfs: float
    actual_rms_dbfs: float
    sample_rate: int
    channels: int
    frame_count: int
    operations: tuple[str, ...]

    def to_dict(self) -> dict:
        payload = asdict(self)
        payload["schemaVersion"] = payload.pop("schema_version")
        payload["inputPath"] = payload.pop("input_path")
        payload["inputSha256"] = payload.pop("input_sha256")
        payload["normalizedPath"] = payload.pop("normalized_path")
        payload["normalizedSha256"] = payload.pop("normalized_sha256")
        payload["targetRmsDbfs"] = payload.pop("target_rms_dbfs")
        payload["actualRmsDbfs"] = payload.pop("actual_rms_dbfs")
        payload["sampleRate"] = payload.pop("sample_rate")
        payload["frameCount"] = payload.pop("frame_count")
        return payload


def _window_hash(samples: np.ndarray) -> str:
    data = np.ascontiguousarray(samples, dtype="<f4")
    return hashlib.sha256(data.tobytes()).hexdigest()


def make_audit_windows(view: AudioView, policy: AuditPolicy) -> tuple[AuditWindow, ...]:
    window_frames = round(policy.semantic_window_seconds * view.sample_rate)
    hop_frames = round(policy.semantic_hop_seconds * view.sample_rate)
    if window_frames <= 0 or hop_frames <= 0 or len(view.mono) < window_frames:
        raise PreprocessError("audio is shorter than the configured semantic window")
    final_start = len(view.mono) - window_frames
    starts = list(range(0, final_start + 1, hop_frames)) or [0]
    if starts[-1] != final_start:
        starts.append(final_start)
    rows: list[AuditWindow] = []
    mono = view.mono
    for index, start in enumerate(starts):
        end = start + window_frames
        samples = np.ascontiguousarray(mono[start:end], dtype=np.float32)
        rows.append(
            AuditWindow(
                id=f"w{index:03d}",
                start_frame=start,
                end_frame=end,
                sample_rate=view.sample_rate,
                mono=samples,
                sha256=_window_hash(samples),
            )
        )
    return tuple(rows)


def _resample_mono(mono: np.ndarray, source_rate: int) -> np.ndarray:
    divisor = math.gcd(source_rate, TARGET_SAMPLE_RATE)
    up = TARGET_SAMPLE_RATE // divisor
    down = source_rate // divisor
    return np.ascontiguousarray(resample_poly(mono, up, down), dtype=np.float32)


def _normalize_rms(samples: np.ndarray, target_dbfs: float) -> tuple[np.ndarray, float]:
    rms = float(np.sqrt(np.mean(np.square(samples, dtype=np.float64))))
    if not math.isfinite(rms) or rms <= 1e-8:
        raise PreprocessError("audio input is silent or has invalid RMS")
    target = 10.0 ** (target_dbfs / 20.0)
    normalized = samples.astype(np.float64) * (target / rms)
    peak = float(np.max(np.abs(normalized)))
    if peak > 0.99:
        normalized *= 0.99 / peak
    output = np.ascontiguousarray(normalized, dtype=np.float32)
    actual_rms = float(np.sqrt(np.mean(np.square(output, dtype=np.float64))))
    return output, 20.0 * math.log10(max(actual_rms, 1e-12))


def write_analysis_views(
    input_path: Path,
    output_root: Path,
    policy: AuditPolicy,
) -> PreprocessReceipt:
    if output_root.exists() or output_root.is_symlink():
        raise PreprocessError(f"refusing to overwrite analysis output: {output_root}")
    output_root.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(dir=output_root.parent, prefix=f".{output_root.name}."))
    try:
        view = decode_audio_view(input_path)
        resampled = _resample_mono(view.mono, view.sample_rate)
        normalized, actual_rms = _normalize_rms(resampled, policy.analysis_target_rms_dbfs)
        audio_name = "normalized-mono-48000.wav"
        audio_path = temporary / audio_name
        sf.write(audio_path, normalized, TARGET_SAMPLE_RATE, subtype="PCM_24")
        receipt = PreprocessReceipt(
            schema_version=1,
            input_path=str(view.path),
            input_sha256=view.input_sha256,
            normalized_path=audio_name,
            normalized_sha256=file_sha256(audio_path),
            target_rms_dbfs=policy.analysis_target_rms_dbfs,
            actual_rms_dbfs=actual_rms,
            sample_rate=TARGET_SAMPLE_RATE,
            channels=1,
            frame_count=len(normalized),
            operations=("decode", "downmix-mean", "resample-polyphase", "rms-normalize"),
        )
        (temporary / "preprocess-receipt.json").write_text(
            json.dumps(receipt.to_dict(), indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        temporary.replace(output_root)
    except Exception:
        shutil.rmtree(temporary, ignore_errors=True)
        raise
    return receipt


__all__ = [
    "AuditWindow",
    "PreprocessError",
    "PreprocessReceipt",
    "decode_audio_view",
    "file_sha256",
    "make_audit_windows",
    "write_analysis_views",
]
