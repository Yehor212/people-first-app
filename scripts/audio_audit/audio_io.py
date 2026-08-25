from __future__ import annotations

from dataclasses import dataclass
import hashlib
from pathlib import Path

import numpy as np
import soundfile as sf


MAX_AUDIO_BYTES = 128 * 1024 * 1024
MAX_AUDIO_SECONDS = 60 * 60


class PreprocessError(RuntimeError):
    pass


@dataclass(frozen=True)
class AudioView:
    path: Path
    input_sha256: str
    samples: np.ndarray
    sample_rate: int
    channels: int

    @property
    def mono(self) -> np.ndarray:
        return np.ascontiguousarray(np.mean(self.samples, axis=1), dtype=np.float32)


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def decode_audio_view(path: str | Path) -> AudioView:
    source = Path(path)
    if source.is_symlink() or not source.is_file() or source.stat().st_nlink != 1:
        raise PreprocessError(f"audio input must be one regular file: {source}")
    size = source.stat().st_size
    if size <= 0 or size > MAX_AUDIO_BYTES:
        raise PreprocessError(f"audio input byte size is invalid: {source}")
    try:
        samples, sample_rate = sf.read(source, dtype="float32", always_2d=True)
    except (RuntimeError, OSError, ValueError) as exc:
        raise PreprocessError(f"unable to decode audio input {source}: {exc}") from exc
    if samples.ndim != 2 or samples.shape[1] not in (1, 2):
        raise PreprocessError(f"audio input must be mono or stereo: {source}")
    if sample_rate < 8000 or sample_rate > 192000:
        raise PreprocessError(f"audio input sample rate is unsupported: {sample_rate}")
    if len(samples) == 0 or len(samples) / sample_rate > MAX_AUDIO_SECONDS:
        raise PreprocessError(f"audio input duration is invalid: {source}")
    if not np.isfinite(samples).all():
        raise PreprocessError(f"audio input contains non-finite samples: {source}")
    data = np.ascontiguousarray(samples, dtype=np.float32)
    return AudioView(
        path=source.resolve(strict=True),
        input_sha256=file_sha256(source),
        samples=data,
        sample_rate=int(sample_rate),
        channels=int(data.shape[1]),
    )

