from __future__ import annotations

from dataclasses import asdict, dataclass
import hashlib
import math
from pathlib import Path
import tempfile
import wave

import numpy as np

from scripts.audio_review.quarantine import default_denylist_path, load_denylist


FIXED_PREVIEW_NAMES = {
    f"{family}-c{position}": f"{family}-c{position}.wav"
    for family in ("forest", "rain", "ocean", "fireplace", "river", "wind")
    for position in (1, 2, 3)
}
ALLOWED_PREVIEW_OPERATIONS = ("decode-pcm", "contiguous-extract")
SAMPLE_RATE = 48000
CHANNELS = 2
START_SECONDS = 5
DURATION_SECONDS = 20


class PreviewError(RuntimeError):
    pass


@dataclass(frozen=True)
class PreviewRecord:
    candidate_id: str
    source_sha256: str
    start_frame: int
    frame_count: int
    available_frames: int
    sample_rate: int
    channels: int
    sample_width_bytes: int
    operations: tuple[str, ...]
    preview_path: str
    preview_sha256: str
    playback_gain_db: float
    measured_rms_dbfs: float
    measured_peak_dbfs: float
    measured_dc_offset: float
    product_level: None

    def serializable(self) -> dict:
        data = asdict(self)
        return {
            "schemaVersion": 1,
            "candidateId": data["candidate_id"],
            "sourceSha256": data["source_sha256"],
            "startFrame": data["start_frame"],
            "frameCount": data["frame_count"],
            "availableFrames": data["available_frames"],
            "sampleRate": data["sample_rate"],
            "channels": data["channels"],
            "sampleWidthBytes": data["sample_width_bytes"],
            "operations": list(data["operations"]),
            "previewPath": data["preview_path"],
            "previewSha256": data["preview_sha256"],
            "analysisOnlyPlaybackGainDb": data["playback_gain_db"],
            "measuredRmsDbfs": data["measured_rms_dbfs"],
            "measuredPeakDbfs": data["measured_peak_dbfs"],
            "measuredDcOffset": data["measured_dc_offset"],
            "productLevel": None,
        }


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _read_wave_contract(path: Path) -> tuple[wave._wave_params, bytes]:
    try:
        with wave.open(str(path), "rb") as source:
            params = source.getparams()
            if params.comptype != "NONE":
                raise PreviewError("source WAV must be uncompressed PCM")
            frames = source.readframes(params.nframes)
    except PreviewError:
        raise
    except (OSError, EOFError, wave.Error) as exc:
        raise PreviewError("regular source WAV is required") from exc
    expected_bytes = params.nframes * params.nchannels * params.sampwidth
    if len(frames) != expected_bytes:
        raise PreviewError("source WAV frame payload is truncated")
    return params, frames


def _pcm_to_float(frames: bytes, sample_width: int, channels: int) -> np.ndarray:
    if sample_width == 2:
        integers = np.frombuffer(frames, dtype="<i2").astype(np.float64)
        scale = float(1 << 15)
    elif sample_width == 3:
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
    elif sample_width == 4:
        integers = np.frombuffer(frames, dtype="<i4").astype(np.float64)
        scale = float(1 << 31)
    else:
        raise PreviewError("source PCM width is unsupported")
    if integers.size % channels:
        raise PreviewError("source PCM channel payload is incomplete")
    return (integers / scale).reshape(-1, channels)


def _measure_pcm(frames: bytes, sample_width: int, channels: int) -> dict[str, float]:
    samples = _pcm_to_float(frames, sample_width, channels)
    if samples.size == 0 or not np.isfinite(samples).all():
        raise PreviewError("preview contains no finite PCM samples")
    rms = float(np.sqrt(np.mean(np.square(samples), dtype=np.float64)))
    peak = float(np.max(np.abs(samples)))
    dc = float(np.max(np.abs(np.mean(samples, axis=0))))
    rms_dbfs = 20 * math.log10(max(rms, 1e-12))
    peak_dbfs = 20 * math.log10(max(peak, 1e-12))
    playback_gain = max(-12.0, min(12.0, -23.0 - rms_dbfs))
    return {
        "rmsDbfs": round(rms_dbfs, 6),
        "peakDbfs": round(peak_dbfs, 6),
        "dcOffset": round(dc, 9),
        "playbackGainDb": round(playback_gain, 3),
    }


def verify_operations(operations: tuple[str, ...]) -> None:
    if operations != ALLOWED_PREVIEW_OPERATIONS:
        raise PreviewError(f"prohibited preview operation: {operations!r}")


def build_raw_preview(
    candidate_id: str,
    source_path: Path,
    source_sha256: str,
    preview_root: Path,
) -> PreviewRecord:
    preview_name = FIXED_PREVIEW_NAMES.get(candidate_id)
    if preview_name is None:
        raise PreviewError("candidate preview identity is not allowlisted")
    source = Path(source_path)
    if source.is_symlink() or not source.is_file():
        raise PreviewError("regular source WAV is required")
    if _sha256_file(source) != source_sha256:
        raise PreviewError("source hash mismatch")
    params, all_frames = _read_wave_contract(source)
    if params.framerate != SAMPLE_RATE or params.nchannels != CHANNELS:
        raise PreviewError("source must be 48 kHz stereo PCM")
    if params.sampwidth not in (2, 3, 4):
        raise PreviewError("source PCM width is unsupported")
    start_frame = START_SECONDS * SAMPLE_RATE
    frame_count = DURATION_SECONDS * SAMPLE_RATE
    if params.nframes < start_frame + frame_count:
        raise PreviewError("source is too short for the fixed preview window")
    frame_width = params.nchannels * params.sampwidth
    start_byte = start_frame * frame_width
    end_byte = (start_frame + frame_count) * frame_width
    selected_frames = all_frames[start_byte:end_byte]
    metrics = _measure_pcm(selected_frames, params.sampwidth, params.nchannels)

    output_root = Path(preview_root)
    if output_root.is_symlink():
        raise PreviewError("preview root may not be a symlink")
    output_root.mkdir(parents=True, exist_ok=True)
    output_path = output_root / preview_name
    if output_path.exists() or output_path.is_symlink():
        raise PreviewError(f"preview output already exists: {preview_name}")
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            dir=output_root,
            prefix=f".{preview_name}.",
            suffix=".tmp",
            delete=False,
        ) as stream:
            temporary = Path(stream.name)
        with wave.open(str(temporary), "wb") as output:
            output.setnchannels(params.nchannels)
            output.setsampwidth(params.sampwidth)
            output.setframerate(params.framerate)
            output.writeframes(selected_frames)
        temporary.replace(output_path)
        temporary = None
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return PreviewRecord(
        candidate_id=candidate_id,
        source_sha256=source_sha256,
        start_frame=start_frame,
        frame_count=frame_count,
        available_frames=params.nframes,
        sample_rate=params.framerate,
        channels=params.nchannels,
        sample_width_bytes=params.sampwidth,
        operations=ALLOWED_PREVIEW_OPERATIONS,
        preview_path=str(output_path.resolve()),
        preview_sha256=_sha256_file(output_path),
        playback_gain_db=metrics["playbackGainDb"],
        measured_rms_dbfs=metrics["rmsDbfs"],
        measured_peak_dbfs=metrics["peakDbfs"],
        measured_dc_offset=metrics["dcOffset"],
        product_level=None,
    )


def verify_preview(
    record: PreviewRecord,
    source_path: Path,
    *,
    denylist: frozenset[str] | None = None,
) -> dict:
    verify_operations(record.operations)
    preview = Path(record.preview_path)
    source = Path(source_path)
    if preview.is_symlink() or not preview.is_file():
        raise PreviewError("preview must be a regular file")
    if source.is_symlink() or not source.is_file():
        raise PreviewError("regular source WAV is required")
    if _sha256_file(preview) != record.preview_sha256:
        raise PreviewError("preview hash mismatch")
    if _sha256_file(source) != record.source_sha256:
        raise PreviewError("source hash mismatch")
    blocked = denylist if denylist is not None else load_denylist(default_denylist_path())
    if record.preview_sha256 in blocked:
        raise PreviewError("preview hash is quarantined")

    source_params, source_frames = _read_wave_contract(source)
    preview_params, preview_frames = _read_wave_contract(preview)
    if (
        preview_params.framerate != record.sample_rate
        or preview_params.nchannels != record.channels
        or preview_params.sampwidth != record.sample_width_bytes
        or preview_params.nframes != record.frame_count
        or preview_params.comptype != "NONE"
    ):
        raise PreviewError("preview PCM contract mismatch")
    frame_width = source_params.nchannels * source_params.sampwidth
    start_byte = record.start_frame * frame_width
    end_byte = (record.start_frame + record.frame_count) * frame_width
    expected_frames = source_frames[start_byte:end_byte]
    if preview_frames != expected_frames:
        raise PreviewError("preview is not an exact contiguous source frame window")
    metrics = _measure_pcm(
        preview_frames,
        preview_params.sampwidth,
        preview_params.nchannels,
    )
    if metrics["dcOffset"] > 0.1:
        raise PreviewError("preview DC offset exceeds 0.1 full scale")
    if metrics["peakDbfs"] > 0.000001:
        raise PreviewError("preview peak exceeds full scale")
    return {
        "schemaVersion": 1,
        "candidateId": record.candidate_id,
        "status": "PASS",
        "sourceFrameBytesEqual": True,
        "sampleRate": preview_params.framerate,
        "channels": preview_params.nchannels,
        "sampleWidthBytes": preview_params.sampwidth,
        "frameCount": preview_params.nframes,
        "durationSeconds": preview_params.nframes / preview_params.framerate,
        **metrics,
    }
