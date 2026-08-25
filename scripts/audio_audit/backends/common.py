from __future__ import annotations

import json
from pathlib import Path
import sys
from typing import Any

from scripts.audio_audit.model import EXPECTED_FAMILIES, ModelSpec, load_model_manifest
from scripts.audio_audit.model_cache import file_sha256


CLAP_REQUEST_KEYS = frozenset(
    ("schemaVersion", "requestId", "backend", "audioPath", "family", "prompts")
)
YAMNET_REQUEST_KEYS = frozenset(("schemaVersion", "requestId", "backend", "audioPath"))


class RunnerInputError(RuntimeError):
    pass


def _strict_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise RunnerInputError(f"duplicate request key: {key}")
        result[key] = value
    return result


def read_request() -> dict[str, Any]:
    raw = sys.stdin.read()
    try:
        decoder = json.JSONDecoder(object_pairs_hook=_strict_object)
        payload, end = decoder.raw_decode(raw)
        if raw[end:].strip() or not isinstance(payload, dict):
            raise ValueError("trailing or non-object request")
    except (json.JSONDecodeError, TypeError, ValueError) as exc:
        raise RunnerInputError(f"invalid backend request: {exc}") from exc
    return payload


def _validate_common(payload: dict[str, Any], expected_keys: frozenset[str], backend: str) -> None:
    if set(payload) != expected_keys:
        raise RunnerInputError("request keys mismatch")
    if payload.get("schemaVersion") != 1:
        raise RunnerInputError("schemaVersion must be 1")
    if payload.get("backend") != backend:
        raise RunnerInputError(f"backend must be {backend}")
    request_id = payload.get("requestId")
    if not isinstance(request_id, str) or not request_id or len(request_id) > 128:
        raise RunnerInputError("requestId must be a bounded non-empty string")
    audio_path = payload.get("audioPath")
    if not isinstance(audio_path, str) or not audio_path:
        raise RunnerInputError("audioPath must be a non-empty string")


def validate_clap_request(payload: dict[str, Any]) -> dict[str, Any]:
    _validate_common(payload, CLAP_REQUEST_KEYS, "clap")
    family = payload.get("family")
    if family not in EXPECTED_FAMILIES:
        raise RunnerInputError("family must be a canonical literal family")
    prompts = payload.get("prompts")
    if not isinstance(prompts, list) or len(prompts) < 3 or len(prompts) > 128:
        raise RunnerInputError("prompts must contain 3 through 128 rows")
    ids: set[str] = set()
    for row in prompts:
        if not isinstance(row, dict) or set(row) != {"id", "group", "text"}:
            raise RunnerInputError("prompt rows require exact id/group/text fields")
        if row.get("group") not in ("positive", "sibling", "hard-negative"):
            raise RunnerInputError("prompt group is unsupported")
        for field in ("id", "text"):
            value = row.get(field)
            if not isinstance(value, str) or not value.strip() or len(value) > 500:
                raise RunnerInputError(f"prompt {field} must be a bounded non-empty string")
        if row["id"] in ids:
            raise RunnerInputError("prompt ids must be unique")
        ids.add(row["id"])
    return payload


def validate_yamnet_request(payload: dict[str, Any]) -> dict[str, Any]:
    _validate_common(payload, YAMNET_REQUEST_KEYS, "yamnet")
    return payload


def validate_private_audio_path(path: Path, private_root: Path) -> Path:
    if path.is_symlink() or not path.is_file() or path.stat().st_nlink != 1:
        raise RunnerInputError("audio path must identify one regular file")
    resolved_private = private_root.resolve(strict=True)
    resolved = path.resolve(strict=True)
    try:
        resolved.relative_to(resolved_private)
    except ValueError as exc:
        raise RunnerInputError("audio path must stay inside private evidence") from exc
    return resolved


def repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def private_evidence_root() -> Path:
    root = repo_root().parents[1] / "private-evidence"
    if root.is_symlink() or not root.is_dir():
        raise RunnerInputError(f"private evidence root is unavailable: {root}")
    return root.resolve(strict=True)


def model_root(model_id: str) -> Path:
    manifest = load_model_manifest(repo_root() / "config/audio/hyperfocus-ai-models-v2.json")
    if model_id not in manifest.models:
        raise RunnerInputError(f"model id is not declared: {model_id}")
    root = private_evidence_root() / "audio-ai-audit" / "models" / model_id
    verify_model_root(manifest.models[model_id], root)
    return root


def verify_model_root(spec: ModelSpec, root: Path) -> dict[str, str]:
    if root.is_symlink() or not root.is_dir():
        raise RunnerInputError(f"model root must be a regular directory: {root}")
    files = {
        path.relative_to(root).as_posix(): path
        for path in root.rglob("*")
        if path.is_file() or path.is_symlink()
    }
    if set(files) != set(spec.allowed_files):
        raise RunnerInputError(f"model inventory mismatch: {spec.id}")
    result: dict[str, str] = {}
    for name in spec.allowed_files:
        path = files[name]
        if path.is_symlink() or not path.is_file() or path.stat().st_nlink != 1:
            raise RunnerInputError(f"model file must be regular: {name}")
        digest = file_sha256(path)
        if digest != spec.file_sha256[name] or path.stat().st_size != spec.file_bytes[name]:
            raise RunnerInputError(f"model file identity mismatch: {name}")
        result[name] = digest
    return result


def emit_response(request_id: str, backend: str, results: dict[str, Any]) -> None:
    payload = {
        "schemaVersion": 1,
        "status": "PASS",
        "requestId": request_id,
        "backend": backend,
        "results": results,
    }
    sys.stdout.write(json.dumps(payload, separators=(",", ":"), sort_keys=True) + "\n")

