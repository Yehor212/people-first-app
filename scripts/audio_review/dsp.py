from __future__ import annotations

from dataclasses import asdict, dataclass
import hashlib
import json
import math
from pathlib import Path
import shutil
import subprocess
import tempfile

try:
    import numpy as np
except ImportError as exc:
    raise RuntimeError("numpy is required for audio review DSP") from exc

class AudioError(RuntimeError):
    pass

FAMILIES = {"forest", "rain", "ocean", "fireplace", "river", "wind"}
LEVELS = {"soft", "deep", "intense"}
LEVEL_TARGETS = {
    "soft": (-32.0, -5.0, 0.035),
    "deep": (-27.0, -4.0, 0.075),
    "intense": (-22.0, -3.0, 0.130),
}

@dataclass(frozen=True)
class AudioMetrics:
    duration_seconds: float
    sample_rate: int
    channels: int
    rms_dbfs: float
    motion_dbfs: float
    peak_dbfs: float
    true_peak_dbfs: float
    dc_offset: float
    zero_crossings_per_second: float
    seam_mean_abs_diff: float
    start_end_rms_delta_db: float
    stereo_correlation: float
    clipped_samples: int
    intensity_score: float

    def to_dict(self) -> dict:
        return asdict(self)


def _db(value: float) -> float:
    return 20.0 * math.log10(max(float(value), 1e-12))


def _ensure_stereo(samples: np.ndarray) -> np.ndarray:
    data = np.asarray(samples, dtype=np.float32)
    if data.ndim == 1:
        data = np.column_stack([data, data])
    if data.ndim != 2 or data.shape[1] not in (1, 2):
        raise AudioError(f"Expected mono/stereo samples, got shape {data.shape}")
    if data.shape[1] == 1:
        data = np.repeat(data, 2, axis=1)
    if not np.isfinite(data).all():
        raise AudioError("Samples contain NaN or infinity")
    return data


def _periodic_colored_noise(frames: int, sample_rate: int, seed: int, alpha: float, low_hz: float, high_hz: float) -> np.ndarray:
    rng = np.random.default_rng(seed)
    bins = frames // 2 + 1
    freqs = np.fft.rfftfreq(frames, 1.0 / sample_rate)
    amplitude = np.zeros_like(freqs)
    mask = (freqs >= low_hz) & (freqs <= high_hz)
    amplitude[mask] = np.maximum(freqs[mask], 1.0) ** (-alpha / 2.0)
    phase_l = rng.uniform(0, 2 * np.pi, bins)
    phase_r = phase_l * 0.82 + rng.uniform(0, 2 * np.pi, bins) * 0.18
    left = np.fft.irfft(amplitude * np.exp(1j * phase_l), n=frames)
    right = np.fft.irfft(amplitude * np.exp(1j * phase_r), n=frames)
    data = np.column_stack([left, right])
    rms = float(np.sqrt(np.mean(data * data)))
    return (data / max(rms, 1e-12)).astype(np.float32)


def _loop_segment(source: np.ndarray, frames: int, crossfade_frames: int, offset: int) -> np.ndarray:
    source = _ensure_stereo(source)
    needed = frames + crossfade_frames
    if len(source) < 2:
        raise AudioError("Source audio is empty")
    repeats = math.ceil((needed + offset) / len(source)) + 1
    tiled = np.tile(source, (repeats, 1))
    raw = tiled[offset:offset + needed].astype(np.float64, copy=True)
    if len(raw) != needed:
        raise AudioError("Unable to construct loop segment")
    out = raw[:frames].copy()
    if crossfade_frames:
        theta = np.linspace(0.0, np.pi / 2.0, crossfade_frames, endpoint=False)[:, None]
        fade_in = np.sin(theta) ** 2
        fade_out = np.cos(theta) ** 2
        out[:crossfade_frames] = raw[:crossfade_frames] * fade_in + raw[frames:frames + crossfade_frames] * fade_out
    return out.astype(np.float32)


def _spectral_shape(samples: np.ndarray, sample_rate: int, family: str, level: str) -> np.ndarray:
    frames = len(samples)
    freqs = np.fft.rfftfreq(frames, 1.0 / sample_rate)
    ranges = {
        "forest": (90.0, 13500.0), "rain": (140.0, 17000.0), "ocean": (35.0, 9000.0),
        "fireplace": (55.0, 12000.0), "river": (70.0, 15000.0), "wind": (25.0, 8500.0),
    }
    low, high = ranges[family]
    hp = 1.0 - np.exp(-np.maximum(freqs - low, 0.0) / max(low * 0.75, 1.0))
    lp = np.exp(-np.maximum(freqs - high, 0.0) / max(high * 0.35, 1.0))
    gain = hp * lp
    if level == "soft":
        gain *= np.where(freqs > 6500, 0.75, 1.0)
    if level == "intense":
        gain *= np.where((freqs > 700) & (freqs < 11000), 1.12, 1.0)
    shaped = np.empty_like(samples, dtype=np.float64)
    for channel in range(2):
        spectrum = np.fft.rfft(samples[:, channel].astype(np.float64))
        shaped[:, channel] = np.fft.irfft(spectrum * gain, n=frames)
    return shaped.astype(np.float32)


def _family_texture(family: str, level: str, frames: int, sample_rate: int, seed: int) -> np.ndarray:
    settings = {
        "forest": (0.8, 180.0, 12000.0), "rain": (0.1, 800.0, 19000.0), "ocean": (1.6, 30.0, 5000.0),
        "fireplace": (0.4, 90.0, 13000.0), "river": (0.7, 120.0, 16000.0), "wind": (1.8, 20.0, 7000.0),
    }
    alpha, low, high = settings[family]
    noise = _periodic_colored_noise(frames, sample_rate, seed, alpha, low, high).astype(np.float64)
    phase = np.arange(frames, dtype=np.float64) / frames
    cycles = {"forest": 7, "rain": 13, "ocean": 3, "fireplace": 11, "river": 5, "wind": 2}[family]
    mod = 0.78 + 0.22 * np.sin(2 * np.pi * cycles * phase + (seed % 360) * np.pi / 180)
    noise *= mod[:, None]
    if family == "fireplace":
        rng = np.random.default_rng(seed ^ 0xA51E)
        impulses = np.zeros(frames, dtype=np.float64)
        count = {"soft": 18, "deep": 40, "intense": 75}[level]
        positions = rng.integers(sample_rate // 2, max(sample_rate // 2 + 1, frames - sample_rate // 2), size=count)
        impulses[positions] = rng.uniform(0.2, 1.0, size=count)
        kernel = np.exp(-np.arange(min(1800, frames), dtype=np.float64) / 190.0)
        crackle = np.convolve(impulses, kernel, mode="same")
        crackle /= max(float(np.max(np.abs(crackle))), 1e-9)
        noise += np.column_stack([crackle, np.roll(crackle, 47)]) * 0.55
    rms = float(np.sqrt(np.mean(noise * noise)))
    return (noise / max(rms, 1e-12)).astype(np.float32)


def _normalize(samples: np.ndarray, target_rms_db: float, peak_limit_db: float) -> np.ndarray:
    data = _ensure_stereo(samples).astype(np.float64)
    data -= np.mean(data, axis=0, keepdims=True)
    rms = float(np.sqrt(np.mean(data * data)))
    data *= (10.0 ** (target_rms_db / 20.0)) / max(rms, 1e-12)
    data = np.tanh(data * 1.15) / np.tanh(1.15)
    peak = float(np.max(np.abs(data)))
    peak_limit = 10.0 ** (peak_limit_db / 20.0)
    if peak > peak_limit:
        data *= peak_limit / peak
    return data.astype(np.float32)


def render_hyperfocus(source: np.ndarray, family: str, level: str, sample_rate: int, *, seed: int, duration_seconds: float = 30.0) -> np.ndarray:
    if family not in FAMILIES or level not in LEVELS:
        raise AudioError(f"Unsupported Hyperfocus variant: {family}:{level}")
    if sample_rate != 48000:
        raise AudioError("Hyperfocus reconstruction contract requires 48000 Hz")
    frames = int(round(duration_seconds * sample_rate))
    crossfade = min(int(0.75 * sample_rate), max(1, frames // 5))
    source = _ensure_stereo(source)
    digest = hashlib.sha256(f"{family}:{level}:{seed}".encode()).digest()
    offset = int.from_bytes(digest[:8], "big") % len(source)
    base = _loop_segment(source, frames, crossfade, offset)
    base = _spectral_shape(base, sample_rate, family, level)
    target_rms_db, peak_db, texture_mix = LEVEL_TARGETS[level]
    texture = _family_texture(family, level, frames, sample_rate, seed ^ int.from_bytes(digest[8:12], "big"))
    data = base.astype(np.float64) * (1.0 - texture_mix) + texture.astype(np.float64) * texture_mix
    mid = (data[:, 0] + data[:, 1]) * 0.5
    side = (data[:, 0] - data[:, 1]) * 0.5
    width = {"soft": 0.78, "deep": 0.92, "intense": 1.04}[level]
    data = np.column_stack([mid + side * width, mid - side * width])
    return _normalize(data, target_rms_db, peak_db)


def encode_mp3(samples: np.ndarray, output_path: str | Path, sample_rate: int, bitrate_kbps: int, ffmpeg_path: str | None = None) -> None:
    ffmpeg = ffmpeg_path or shutil.which("ffmpeg")
    if not ffmpeg:
        raise AudioError("ffmpeg is required")
    data = _ensure_stereo(samples).astype("<f4", copy=False)
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".f32", delete=False) as raw:
        raw.write(data.tobytes(order="C"))
        raw_path = Path(raw.name)
    try:
        command = [ffmpeg, "-hide_banner", "-loglevel", "error", "-f", "f32le", "-ar", str(sample_rate), "-ac", "2", "-i", str(raw_path), "-map_metadata", "-1", "-codec:a", "libmp3lame", "-b:a", f"{bitrate_kbps}k", "-ar", str(sample_rate), "-ac", "2", "-write_xing", "0", "-id3v2_version", "0", "-y", str(output)]
        subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except subprocess.CalledProcessError as exc:
        raise AudioError(exc.stderr.decode("utf-8", "replace")) from exc
    finally:
        raw_path.unlink(missing_ok=True)


def decode_audio(path: str | Path, ffmpeg_path: str | None = None, sample_rate: int = 48000, *, start_seconds: float = 0.0, max_seconds: float | None = None) -> np.ndarray:
    ffmpeg = ffmpeg_path or shutil.which("ffmpeg")
    if not ffmpeg:
        raise AudioError("ffmpeg is required")
    command = [ffmpeg, "-hide_banner", "-loglevel", "error"]
    if start_seconds > 0:
        command += ["-ss", f"{start_seconds:.6f}"]
    command += ["-i", str(path)]
    if max_seconds is not None:
        command += ["-t", f"{max_seconds:.6f}"]
    command += ["-f", "f32le", "-ar", str(sample_rate), "-ac", "2", "pipe:1"]
    try:
        result = subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except subprocess.CalledProcessError as exc:
        raise AudioError(exc.stderr.decode("utf-8", "replace")) from exc
    data = np.frombuffer(result.stdout, dtype="<f4")
    if len(data) % 2:
        raise AudioError("Decoded stereo PCM has an odd sample count")
    return data.reshape(-1, 2).copy()


def _probe(path: str | Path, ffprobe_path: str | None = None) -> tuple[int, int, float]:
    ffprobe = ffprobe_path or shutil.which("ffprobe")
    if not ffprobe:
        raise AudioError("ffprobe is required")
    command = [ffprobe, "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=sample_rate,channels,duration", "-of", "json", str(path)]
    try:
        result = subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    except subprocess.CalledProcessError as exc:
        raise AudioError(exc.stderr) from exc
    streams = (json.loads(result.stdout).get("streams") or [])
    if len(streams) != 1:
        raise AudioError("Expected exactly one audio stream")
    stream = streams[0]
    return int(stream["sample_rate"]), int(stream["channels"]), float(stream.get("duration") or 0.0)


def measure_pcm(samples: np.ndarray, sample_rate: int) -> AudioMetrics:
    data = _ensure_stereo(samples).astype(np.float64)
    mono = np.mean(data, axis=1)
    frames = len(data)
    duration = frames / sample_rate
    rms = float(np.sqrt(np.mean(mono * mono)))
    motion = float(np.sqrt(np.mean(np.diff(mono) ** 2))) if frames > 1 else 0.0
    peak = float(np.max(np.abs(data))) if frames else 0.0
    true_peak = peak
    if frames > 1:
        for fraction in (0.25, 0.5, 0.75):
            interpolated = data[:-1] * (1.0 - fraction) + data[1:] * fraction
            true_peak = max(true_peak, float(np.max(np.abs(interpolated))))
    dc = float(np.max(np.abs(np.mean(data, axis=0)))) if frames else 0.0
    crossings = int(np.count_nonzero(np.signbit(mono[1:]) != np.signbit(mono[:-1]))) if frames > 1 else 0
    if frames > 1:
        value_discontinuity = float(np.mean(np.abs(data[0] - data[-1])))
        incoming_slope = data[-1] - data[-2]
        outgoing_slope = data[1] - data[0]
        slope_discontinuity = float(np.mean(np.abs(outgoing_slope - incoming_slope)))
        seam = max(value_discontinuity, slope_discontinuity)
    else:
        seam = 0.0
    window = min(max(1, int(sample_rate * 0.5)), max(1, frames // 2))
    start_rms = float(np.sqrt(np.mean(data[:window] ** 2))) if frames else 0.0
    end_rms = float(np.sqrt(np.mean(data[-window:] ** 2))) if frames else 0.0
    delta = abs(_db(start_rms) - _db(end_rms))
    corr = float(np.corrcoef(data[:, 0], data[:, 1])[0, 1]) if frames > 2 and np.std(data[:, 0]) > 1e-9 and np.std(data[:, 1]) > 1e-9 else 1.0
    clipped = int(np.count_nonzero(np.abs(data) >= 0.9999))
    rms_db = _db(rms)
    motion_db = _db(motion)
    zcr = crossings / max(duration, 1e-9)
    intensity = (rms_db + 60) * 1.2 + (motion_db + 70) * 0.45 + min(20.0, zcr / 400.0)
    return AudioMetrics(duration, sample_rate, 2, rms_db, motion_db, _db(peak), _db(true_peak), dc, zcr, seam, delta, corr, clipped, intensity)


def measure_audio(path: str | Path, ffmpeg_path: str | None = None) -> AudioMetrics:
    sample_rate, channels, probed_duration = _probe(path)
    samples = decode_audio(path, ffmpeg_path, sample_rate)
    metrics = measure_pcm(samples, sample_rate)
    return AudioMetrics(probed_duration or metrics.duration_seconds, sample_rate, channels, metrics.rms_dbfs, metrics.motion_dbfs, metrics.peak_dbfs, metrics.true_peak_dbfs, metrics.dc_offset, metrics.zero_crossings_per_second, metrics.seam_mean_abs_diff, metrics.start_end_rms_delta_db, metrics.stereo_correlation, metrics.clipped_samples, metrics.intensity_score)
