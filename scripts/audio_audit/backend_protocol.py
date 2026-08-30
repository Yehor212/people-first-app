from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import subprocess
from typing import Any


ALLOWED_MODULES = frozenset(
    (
        "scripts.audio_audit.backends.clap_runner",
        "scripts.audio_audit.backends.yamnet_runner",
    )
)
ALLOWED_STATUSES = frozenset(("PASS", "FAIL", "ABSTAIN", "UNVERIFIED"))
RESPONSE_KEYS = frozenset(("schemaVersion", "status", "requestId", "backend", "results"))


class BackendProtocolError(RuntimeError):
    pass


@dataclass(frozen=True)
class BackendResponse:
    schema_version: int
    status: str
    request_id: str
    backend: str
    results: dict[str, Any]


def _strict_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate key: {key}")
        result[key] = value
    return result


def parse_backend_response(raw: str) -> BackendResponse:
    try:
        decoder = json.JSONDecoder(object_pairs_hook=_strict_object)
        payload, end = decoder.raw_decode(raw)
        if raw[end:].strip():
            raise ValueError("trailing output")
        if not isinstance(payload, dict) or set(payload) != RESPONSE_KEYS:
            raise ValueError("response keys mismatch")
        if payload.get("schemaVersion") != 1:
            raise ValueError("schema version mismatch")
        status = payload.get("status")
        if status not in ALLOWED_STATUSES:
            raise ValueError("status mismatch")
        request_id = payload.get("requestId")
        backend = payload.get("backend")
        results = payload.get("results")
        if not isinstance(request_id, str) or not request_id:
            raise ValueError("requestId missing")
        if backend not in ("clap", "yamnet"):
            raise ValueError("backend mismatch")
        if not isinstance(results, dict):
            raise ValueError("results must be an object")
    except (json.JSONDecodeError, TypeError, ValueError) as exc:
        raise BackendProtocolError(f"invalid backend response: {exc}") from exc
    return BackendResponse(1, status, request_id, backend, results)


def build_backend_command(executable: Path, module: str) -> tuple[list[str], dict[str, str]]:
    if not executable.is_absolute() or not executable.exists():
        raise BackendProtocolError(f"backend executable is unavailable: {executable}")
    if module not in ALLOWED_MODULES:
        raise BackendProtocolError(f"backend module is not allowlisted: {module}")
    command = [str(executable), "-m", module]
    environment = {
        "PATH": "/usr/bin:/bin",
        "PYTHONHASHSEED": "0",
        "PYTHONNOUSERSITE": "1",
        "HF_HUB_OFFLINE": "1",
        "TRANSFORMERS_OFFLINE": "1",
        "CUDA_VISIBLE_DEVICES": "",
        "TOKENIZERS_PARALLELISM": "false",
        "OMP_NUM_THREADS": "1",
        "VECLIB_MAXIMUM_THREADS": "1",
        "TF_CPP_MIN_LOG_LEVEL": "2",
        "TF_ENABLE_ONEDNN_OPTS": "0",
    }
    return command, environment


def run_backend(
    executable: Path,
    module: str,
    request: dict[str, Any],
    *,
    timeout_seconds: int = 300,
) -> BackendResponse:
    command, environment = build_backend_command(executable, module)
    encoded = json.dumps(request, separators=(",", ":"), sort_keys=True)
    try:
        result = subprocess.run(
            command,
            input=encoded,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=environment,
            timeout=timeout_seconds,
            check=False,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise BackendProtocolError(f"backend execution failed: {exc}") from exc
    if result.returncode != 0:
        stderr = result.stderr[-4000:].replace("\x00", "")
        raise BackendProtocolError(f"backend returned {result.returncode}: {stderr}")
    return parse_backend_response(result.stdout)


__all__ = [
    "BackendProtocolError",
    "BackendResponse",
    "build_backend_command",
    "parse_backend_response",
    "run_backend",
]
