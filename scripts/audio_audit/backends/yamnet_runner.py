from __future__ import annotations

import csv
import math
from pathlib import Path
import sys

import numpy as np
from scipy.signal import resample_poly
import soundfile as sf
import tensorflow as tf

from .common import (
    RunnerInputError,
    emit_response,
    model_root,
    private_evidence_root,
    read_request,
    validate_private_audio_path,
    validate_yamnet_request,
)


def _class_names(model_path: Path) -> list[str]:
    path = model_path / "assets/yamnet_class_map.csv"
    with path.open("r", encoding="utf-8", newline="") as stream:
        rows = list(csv.DictReader(stream))
    names = [row.get("display_name", "").strip() for row in rows]
    if len(names) != 521 or any(not name for name in names):
        raise RunnerInputError("YAMNet class map must contain 521 named classes")
    return names


def run(payload: dict) -> dict:
    request = validate_yamnet_request(payload)
    audio_path = validate_private_audio_path(Path(request["audioPath"]), private_evidence_root())
    model_path = model_root("temporal-yamnet")
    audio, sample_rate = sf.read(audio_path, dtype="float32", always_2d=True)
    if audio.shape[1] not in (1, 2) or not np.isfinite(audio).all():
        raise RunnerInputError("YAMNet input must be finite mono or stereo audio")
    mono = np.ascontiguousarray(np.mean(audio, axis=1), dtype=np.float32)
    divisor = math.gcd(int(sample_rate), 16000)
    waveform = np.ascontiguousarray(
        resample_poly(mono, 16000 // divisor, int(sample_rate) // divisor),
        dtype=np.float32,
    )

    tf.random.set_seed(0)
    tf.config.threading.set_intra_op_parallelism_threads(1)
    tf.config.threading.set_inter_op_parallelism_threads(1)
    model = tf.saved_model.load(str(model_path))
    scores_tensor, _embeddings, _spectrogram = model(tf.convert_to_tensor(waveform))
    scores = np.asarray(scores_tensor.numpy(), dtype=np.float64)
    if scores.ndim != 2 or scores.shape[1] != 521 or not np.isfinite(scores).all():
        raise RunnerInputError("YAMNet returned an invalid score matrix")
    names = _class_names(model_path)
    rows = []
    for index, name in enumerate(names):
        column = scores[:, index]
        active = np.flatnonzero(column >= 0.1)
        rows.append(
            {
                "classIndex": index,
                "className": name,
                "mean": round(float(np.mean(column)), 10),
                "max": round(float(np.max(column)), 10),
                "p95": round(float(np.percentile(column, 95)), 10),
                "framesAbovePointOne": int(len(active)),
                "firstSecond": round(float(active[0] * 0.48), 3) if len(active) else None,
                "lastSecond": round(float(active[-1] * 0.48 + 0.96), 3) if len(active) else None,
            }
        )
    return {
        "sourceSampleRate": int(sample_rate),
        "modelSampleRate": 16000,
        "audioFrames": int(len(waveform)),
        "scoreFrames": int(scores.shape[0]),
        "frameSeconds": 0.96,
        "hopSeconds": 0.48,
        "rows": rows,
    }


def main() -> int:
    try:
        request = read_request()
        results = run(request)
        emit_response(request["requestId"], "yamnet", results)
        return 0
    except Exception as exc:
        sys.stderr.write(f"YAMNet runner failed: {type(exc).__name__}: {exc}\n")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
