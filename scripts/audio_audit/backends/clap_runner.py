from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
from transformers import ClapModel, ClapProcessor

from .common import (
    RunnerInputError,
    emit_response,
    model_root,
    private_evidence_root,
    read_request,
    validate_clap_request,
    validate_private_audio_path,
)


def run(payload: dict) -> dict:
    request = validate_clap_request(payload)
    audio_path = validate_private_audio_path(Path(request["audioPath"]), private_evidence_root())
    model_path = model_root("semantic-clap")
    audio, sample_rate = sf.read(audio_path, dtype="float32", always_2d=True)
    if sample_rate != 48000 or audio.shape[1] not in (1, 2) or not np.isfinite(audio).all():
        raise RunnerInputError("CLAP input must be finite 48 kHz mono or stereo audio")
    mono = np.ascontiguousarray(np.mean(audio, axis=1), dtype=np.float32)
    prompts = request["prompts"]
    texts = [row["text"] for row in prompts]

    torch.set_num_threads(1)
    torch.manual_seed(0)
    torch.use_deterministic_algorithms(True)
    processor = ClapProcessor.from_pretrained(model_path, local_files_only=True)
    model = ClapModel.from_pretrained(
        model_path,
        local_files_only=True,
        use_safetensors=True,
    ).to("cpu")
    model.eval()
    inputs = processor(
        text=texts,
        audio=mono,
        sampling_rate=sample_rate,
        return_tensors="pt",
        padding=True,
    )
    with torch.inference_mode():
        output = model(**inputs)
        logits = output.logits_per_audio[0].detach().cpu().to(torch.float64)
        probabilities = torch.softmax(logits, dim=-1)
    rows = []
    for index, prompt in enumerate(prompts):
        rows.append(
            {
                "promptId": prompt["id"],
                "group": prompt["group"],
                "logit": round(float(logits[index]), 10),
                "probability": round(float(probabilities[index]), 10),
            }
        )
    return {
        "family": request["family"],
        "audioFrames": int(len(mono)),
        "sampleRate": int(sample_rate),
        "rows": rows,
    }


def main() -> int:
    try:
        request = read_request()
        results = run(request)
        emit_response(request["requestId"], "clap", results)
        return 0
    except Exception as exc:
        sys.stderr.write(f"CLAP runner failed: {type(exc).__name__}: {exc}\n")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
