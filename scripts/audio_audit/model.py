from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
from typing import Any


EXPECTED_FAMILIES = ("forest", "rain", "ocean", "fireplace", "river", "wind")
EXPECTED_VERDICTS = ("PASS", "FAIL", "ABSTAIN", "UNVERIFIED")
EXPECTED_SCOPES = ("source", "base", "delivery")
EXPECTED_MODELS = ("semantic-clap", "temporal-yamnet")
UNSAFE_MODEL_SUFFIXES = (".bin", ".ckpt", ".pth", ".pickle", ".pkl", ".pt")


class AuditSpecError(ValueError):
    pass


@dataclass(frozen=True)
class FamilyPolicy:
    id: str
    positive_prompts: tuple[str, ...]
    sibling_negatives: tuple[str, ...]
    hard_negatives: tuple[str, ...]


@dataclass(frozen=True)
class AuditPolicy:
    schema_version: int
    status: str
    verdicts: tuple[str, ...]
    ai_may_set_human_pass: bool
    semantic_window_seconds: float
    semantic_hop_seconds: float
    scopes: tuple[str, ...]
    universal_hard_negative_events: tuple[str, ...]
    families: dict[str, FamilyPolicy]


@dataclass(frozen=True)
class ModelSpec:
    id: str
    role: str
    provider: str
    repository: str
    revision: str
    license_id: str
    allowed_files: tuple[str, ...]
    denied_files: tuple[str, ...]
    status: str


@dataclass(frozen=True)
class ModelManifest:
    schema_version: int
    status: str
    canonical_device: str
    network_during_inference: bool
    models: dict[str, ModelSpec]


def _strict_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise AuditSpecError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def _read_json(path: str | Path) -> dict[str, Any]:
    source = Path(path)
    try:
        data = json.loads(source.read_text(encoding="utf-8"), object_pairs_hook=_strict_object)
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise AuditSpecError(f"unable to read audit JSON {source}: {exc}") from exc
    if not isinstance(data, dict):
        raise AuditSpecError("audit JSON root must be an object")
    return data


def _string_tuple(value: Any, field: str, errors: list[str]) -> tuple[str, ...]:
    if not isinstance(value, list) or any(not isinstance(item, str) or not item.strip() for item in value):
        errors.append(f"{field} must be a non-empty string list")
        return ()
    return tuple(item.strip() for item in value)


def load_audit_policy(path: str | Path) -> AuditPolicy:
    data = _read_json(path)
    errors: list[str] = []

    if data.get("schemaVersion") != 2:
        errors.append("schemaVersion must be 2")
    if data.get("status") != "REVIEW_ONLY_NOT_ADMITTED":
        errors.append("status must be REVIEW_ONLY_NOT_ADMITTED")

    family_rows = data.get("families")
    if not isinstance(family_rows, list):
        family_rows = []
        errors.append("families must be a list")
    family_ids = tuple(row.get("id") for row in family_rows if isinstance(row, dict))
    if family_ids != EXPECTED_FAMILIES or len(family_rows) != len(EXPECTED_FAMILIES):
        errors.append(f"families must be exactly {EXPECTED_FAMILIES}")

    verdicts = _string_tuple(data.get("verdicts"), "verdicts", errors)
    if verdicts != EXPECTED_VERDICTS:
        errors.append(f"verdicts must be exactly {EXPECTED_VERDICTS}")

    ai_may_set_human_pass = data.get("aiMaySetHumanPass")
    if ai_may_set_human_pass is not False:
        errors.append("aiMaySetHumanPass must be false")

    try:
        window = float(data.get("semanticWindowSeconds"))
        hop = float(data.get("semanticHopSeconds"))
        if window <= 0 or hop <= 0 or hop > window:
            raise ValueError
    except (TypeError, ValueError):
        errors.append("semantic window/hop must be positive and hop cannot exceed window")
        window = 0.0
        hop = 0.0

    scopes = _string_tuple(data.get("scopes"), "scopes", errors)
    if scopes != EXPECTED_SCOPES:
        errors.append(f"scopes must be exactly {EXPECTED_SCOPES}")

    events = _string_tuple(
        data.get("universalHardNegativeEvents"),
        "universalHardNegativeEvents",
        errors,
    )
    if len(set(events)) != len(events) or len(events) < 8:
        errors.append("universalHardNegativeEvents must contain at least eight unique events")

    families: dict[str, FamilyPolicy] = {}
    for row in family_rows:
        if not isinstance(row, dict):
            errors.append("family entries must be objects")
            continue
        family_id = str(row.get("id", ""))
        positives = _string_tuple(row.get("positivePrompts"), f"{family_id}.positivePrompts", errors)
        siblings = _string_tuple(row.get("siblingNegatives"), f"{family_id}.siblingNegatives", errors)
        negatives = _string_tuple(row.get("hardNegatives"), f"{family_id}.hardNegatives", errors)
        expected_siblings = tuple(item for item in EXPECTED_FAMILIES if item != family_id)
        if len(positives) < 3 or len(set(positives)) != len(positives):
            errors.append(f"{family_id}.positivePrompts must contain at least three unique prompts")
        if siblings != expected_siblings:
            errors.append(f"{family_id}.siblingNegatives must be exactly {expected_siblings}")
        if len(negatives) < 3 or len(set(negatives)) != len(negatives):
            errors.append(f"{family_id}.hardNegatives must contain at least three unique prompts")
        if family_id:
            families[family_id] = FamilyPolicy(family_id, positives, siblings, negatives)

    if errors:
        raise AuditSpecError("; ".join(dict.fromkeys(errors)))

    return AuditPolicy(
        schema_version=2,
        status="REVIEW_ONLY_NOT_ADMITTED",
        verdicts=verdicts,
        ai_may_set_human_pass=False,
        semantic_window_seconds=window,
        semantic_hop_seconds=hop,
        scopes=scopes,
        universal_hard_negative_events=events,
        families=families,
    )


def load_model_manifest(path: str | Path) -> ModelManifest:
    data = _read_json(path)
    errors: list[str] = []

    if data.get("schemaVersion") != 1:
        errors.append("schemaVersion must be 1")
    if data.get("status") != "UNVERIFIED_DISCOVERY":
        errors.append("status must be UNVERIFIED_DISCOVERY")
    if data.get("canonicalDevice") != "cpu":
        errors.append("canonicalDevice must be cpu")
    if data.get("networkDuringInference") is not False:
        errors.append("networkDuringInference must be false")

    rows = data.get("models")
    if not isinstance(rows, list):
        rows = []
        errors.append("models must be a list")
    model_ids = tuple(row.get("id") for row in rows if isinstance(row, dict))
    if model_ids != EXPECTED_MODELS or len(rows) != len(EXPECTED_MODELS):
        errors.append(f"models must be exactly {EXPECTED_MODELS}")

    models: dict[str, ModelSpec] = {}
    for row in rows:
        if not isinstance(row, dict):
            errors.append("model entries must be objects")
            continue
        model_id = str(row.get("id", ""))
        allowed = _string_tuple(row.get("allowedFiles"), f"{model_id}.allowedFiles", errors)
        denied = _string_tuple(row.get("deniedFiles"), f"{model_id}.deniedFiles", errors)
        if len(set(allowed)) != len(allowed) or set(allowed).intersection(denied):
            errors.append(f"{model_id} allowed/denied files must be unique and disjoint")
        if any(name.lower().endswith(UNSAFE_MODEL_SUFFIXES) for name in allowed):
            errors.append(f"{model_id}: unsafe model file is allowed")
        if model_id == "semantic-clap" and "model.safetensors" not in allowed:
            errors.append("semantic-clap must allow model.safetensors")
        if model_id == "semantic-clap" and "pytorch_model.bin" not in denied:
            errors.append("semantic-clap must deny pytorch_model.bin")
        for field in ("role", "provider", "repository", "revision", "licenseId", "status"):
            if not isinstance(row.get(field), str) or not row[field].strip():
                errors.append(f"{model_id}.{field} must be a non-empty string")
        if model_id:
            models[model_id] = ModelSpec(
                id=model_id,
                role=str(row.get("role", "")),
                provider=str(row.get("provider", "")),
                repository=str(row.get("repository", "")),
                revision=str(row.get("revision", "")),
                license_id=str(row.get("licenseId", "")),
                allowed_files=allowed,
                denied_files=denied,
                status=str(row.get("status", "")),
            )

    if errors:
        raise AuditSpecError("; ".join(dict.fromkeys(errors)))

    return ModelManifest(
        schema_version=1,
        status="UNVERIFIED_DISCOVERY",
        canonical_device="cpu",
        network_during_inference=False,
        models=models,
    )

