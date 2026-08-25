from __future__ import annotations

import math
try:
    import numpy as np
except ImportError as exc:
    raise RuntimeError("numpy is required for procedural audio") from exc

AMBIENCE_IDS = {"soft-air-veil", "gentle-water-bed", "soft-rain-veil"}


def _periodic_noise(frames: int, sample_rate: int, seed: int, alpha: float, low: float, high: float) -> np.ndarray:
    rng = np.random.default_rng(seed)
    bins = frames // 2 + 1
    freqs = np.fft.rfftfreq(frames, 1 / sample_rate)
    amplitude = np.zeros_like(freqs)
    mask = (freqs >= low) & (freqs <= high)
    amplitude[mask] = np.maximum(freqs[mask], 1.0) ** (-alpha / 2)
    common = rng.uniform(0, 2 * np.pi, bins)
    independent = rng.uniform(0, 2 * np.pi, bins)
    left = np.fft.irfft(amplitude * np.exp(1j * common), n=frames)
    right = np.fft.irfft(amplitude * np.exp(1j * (common * 0.86 + independent * 0.14)), n=frames)
    data = np.column_stack([left, right])
    data -= data.mean(axis=0, keepdims=True)
    data /= max(float(np.sqrt(np.mean(data * data))), 1e-12)
    return data


def generate_ambience(asset_id: str, duration_seconds: float, sample_rate: int, seed: int):
    if asset_id not in AMBIENCE_IDS:
        raise ValueError(f"Unknown ambience asset: {asset_id}")
    if sample_rate != 48000:
        raise ValueError("Ambience contract requires 48000 Hz")
    frames = int(round(duration_seconds * sample_rate))
    phase = np.arange(frames, dtype=np.float64) / frames
    if asset_id == "soft-air-veil":
        data = _periodic_noise(frames, sample_rate, seed, 1.8, 12, 6500)
        modulation = 0.88 + 0.12 * np.sin(2 * np.pi * 5 * phase)
        target_rms, peak_limit = 0.030, 0.14
    elif asset_id == "gentle-water-bed":
        low = _periodic_noise(frames, sample_rate, seed, 1.4, 24, 4200)
        shimmer = _periodic_noise(frames, sample_rate, seed ^ 0x75A, 0.4, 600, 12000)
        data = 0.78 * low + 0.22 * shimmer
        modulation = 0.82 + 0.18 * np.sin(2 * np.pi * 7 * phase + 0.7)
        target_rms, peak_limit = 0.042, 0.18
    else:
        sheet = _periodic_noise(frames, sample_rate, seed, 0.25, 350, 18000)
        mist = _periodic_noise(frames, sample_rate, seed ^ 0x931, 1.0, 80, 9000)
        data = 0.72 * sheet + 0.28 * mist
        modulation = 0.90 + 0.10 * np.sin(2 * np.pi * 11 * phase + 1.2)
        target_rms, peak_limit = 0.038, 0.16
    data *= modulation[:, None]
    data -= data.mean(axis=0, keepdims=True)
    data *= target_rms / max(float(np.sqrt(np.mean(data * data))), 1e-12)
    peak = float(np.max(np.abs(data)))
    if peak > peak_limit:
        data *= peak_limit / peak
    return data.astype(np.float32)


def generate_feedback(duration_seconds: float, sample_rate: int, notes: list[dict] | tuple[dict, ...]):
    if sample_rate != 48000:
        raise ValueError("Feedback contract requires 48000 Hz")
    frames = int(round(duration_seconds * sample_rate))
    data = np.zeros((frames, 2), dtype=np.float64)
    for index, note in enumerate(notes):
        start = float(note["start"])
        length = float(note["length"])
        frequency = float(note["frequency"])
        level = float(note["level"])
        first = max(0, int(round(start * sample_rate)))
        last = min(frames, int(round((start + length) * sample_rate)))
        if last <= first:
            continue
        t = np.arange(last - first, dtype=np.float64) / sample_rate
        attack = max(1, int(round(min(0.018, length * 0.20) * sample_rate)))
        release = max(1, int(round(min(0.16, length * 0.48) * sample_rate)))
        envelope = np.ones(last - first, dtype=np.float64)
        attack_count = min(attack, len(envelope))
        envelope[:attack_count] = np.sin(np.linspace(0, np.pi / 2, attack_count, endpoint=False)) ** 2
        release_count = min(release, len(envelope))
        envelope[-release_count:] = np.sin(np.linspace(np.pi / 2, 0, release_count, endpoint=False)) ** 2
        phase = 2 * np.pi * frequency * t
        tone = np.sin(phase) + 0.11 * np.sin(2 * phase) + 0.025 * np.sin(3 * phase)
        pan = 0.48 + 0.04 * ((index % 3) - 1)
        left = math.cos(pan * np.pi / 2)
        right = math.sin(pan * np.pi / 2)
        data[first:last, 0] += tone * envelope * level * left
        data[first:last, 1] += tone * envelope * level * right
    data -= data.mean(axis=0, keepdims=True)
    rms = float(np.sqrt(np.mean(data * data)))
    target = 0.038 if len(notes) <= 2 else 0.042
    data *= target / max(rms, 1e-12)
    peak = float(np.max(np.abs(data)))
    if peak > 0.18:
        data *= 0.18 / peak
    edge = min(128, frames // 4)
    data[:edge] *= np.linspace(0, 1, edge, endpoint=False)[:, None]
    data[-edge:] *= np.linspace(1, 0, edge, endpoint=False)[:, None]
    return data.astype(np.float32)
