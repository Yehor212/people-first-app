from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path, PurePosixPath
from typing import Any
from urllib.parse import urlparse

EXPECTED_FAMILIES = ("forest", "rain", "ocean", "fireplace", "river", "wind")
EXPECTED_LEVELS = ("soft", "deep", "intense")
EXPECTED_HYPERFOCUS_IDS = frozenset(f"{family}:{level}" for family in EXPECTED_FAMILIES for level in EXPECTED_LEVELS)
EXPECTED_AMBIENCE_IDS = frozenset(("soft-air-veil", "gentle-water-bed", "soft-rain-veil"))
EXPECTED_FEEDBACK_IDS = frozenset(("feedback-success", "feedback-complete", "feedback-streak", "feedback-milestone", "feedback-notification"))

class SpecError(ValueError):
    pass

@dataclass(frozen=True)
class AudioContract:
    sample_rate: int
    channels: int
    format: str
    encoder: str
    bitrate_kbps: int
    hyperfocus_duration_seconds: float
    ambience_duration_seconds: float

@dataclass(frozen=True)
class SourceSpec:
    provider: str
    provider_root: str
    sound_number: int
    license_id: str
    license_url: str

@dataclass(frozen=True)
class AssetSpec:
    id: str
    file_name: str
    relative_path: str
    duration_seconds: float
    kind: str
    family: str | None = None
    level: str | None = None
    label: str | None = None
    seed: int | None = None
    role: str | None = None
    runtime_gain: float | None = None
    notes: tuple[dict[str, float], ...] = ()
    processing_profile: str | None = None
    source: SourceSpec | None = None

@dataclass(frozen=True)
class ReviewSpec:
    schema_version: int
    package_id: str
    status: str
    purpose: str
    output_root: str
    runtime_promotion_allowed: bool
    audio_contract: AudioContract
    rights_policy: dict[str, Any]
    hyperfocus: tuple[AssetSpec, ...]
    ambience: tuple[AssetSpec, ...]
    feedback: tuple[AssetSpec, ...]

    @property
    def all_assets(self) -> tuple[AssetSpec, ...]:
        return self.hyperfocus + self.ambience + self.feedback


def _require_https(url: str, field: str, errors: list[str]) -> None:
    parsed = urlparse(str(url))
    if parsed.scheme != "https" or not parsed.hostname:
        errors.append(f"{field} must be an absolute HTTPS URL")


def _is_review_path(path: str) -> bool:
    posix = PurePosixPath(path)
    if posix.is_absolute() or ".." in posix.parts:
        return False
    blocked = {"public", "docs", "android", "ios", "src-tauri", "dist"}
    return bool(posix.parts) and posix.parts[0] == "audio" and not blocked.intersection(posix.parts)


def validate_spec_dict(data: dict[str, Any]) -> ReviewSpec:
    errors: list[str] = []
    if data.get("schemaVersion") != 1:
        errors.append("schemaVersion must be 1")
    if data.get("status") != "REVIEW_ONLY":
        errors.append("status must be REVIEW_ONLY")
    if data.get("runtimePromotionAllowed") is not False:
        errors.append("runtimePromotionAllowed must be false")
    output_root = str(data.get("outputRoot", ""))
    if not output_root.startswith("output/") or any(part in {"public", "docs", "android", "ios", "src-tauri", "dist"} for part in PurePosixPath(output_root).parts):
        errors.append("outputRoot must remain in a review-only output directory")

    contract_data = data.get("audioContract") or {}
    if contract_data.get("sampleRate") != 48000:
        errors.append("audioContract.sampleRate must be 48000")
    if contract_data.get("channels") != 2:
        errors.append("audioContract.channels must be 2")
    if contract_data.get("format") != "mp3":
        errors.append("audioContract.format must be mp3")
    if contract_data.get("bitrateKbps") != 128:
        errors.append("audioContract.bitrateKbps must be 128")

    rights = data.get("rightsPolicy") or {}
    if rights.get("requiredLicense") != "CC0-1.0":
        errors.append("rightsPolicy.requiredLicense must be CC0-1.0")
    _require_https(str(rights.get("canonicalLicenseUrl", "")), "rightsPolicy.canonicalLicenseUrl", errors)

    groups = (("hyperfocus", data.get("hyperfocus") or []), ("ambience", data.get("ambience") or []), ("feedback", data.get("feedback") or []))
    all_ids: list[str] = []
    all_paths: list[str] = []
    parsed_groups: dict[str, list[AssetSpec]] = {"hyperfocus": [], "ambience": [], "feedback": []}
    for kind, rows in groups:
        if not isinstance(rows, list):
            errors.append(f"{kind} must be a list")
            continue
        for row in rows:
            if not isinstance(row, dict):
                errors.append(f"{kind} entries must be objects")
                continue
            asset_id = str(row.get("id", ""))
            rel = str(row.get("relativePath", ""))
            all_ids.append(asset_id)
            all_paths.append(rel)
            if not _is_review_path(rel):
                errors.append(f"{asset_id or kind}: relativePath must stay inside the audio review package")
            file_name = str(row.get("fileName", ""))
            if PurePosixPath(rel).name != file_name or not file_name.endswith(".mp3"):
                errors.append(f"{asset_id or kind}: fileName and relativePath must identify one MP3")
            duration = float(row.get("durationSeconds", 0) or 0)
            if duration <= 0:
                errors.append(f"{asset_id or kind}: durationSeconds must be positive")
            source = None
            if kind == "hyperfocus":
                source_data = row.get("source") or {}
                if source_data.get("licenseId") != "CC0-1.0":
                    errors.append(f"{asset_id}: source license must be CC0-1.0")
                _require_https(str(source_data.get("providerRoot", "")), f"{asset_id}.source.providerRoot", errors)
                _require_https(str(source_data.get("licenseUrl", "")), f"{asset_id}.source.licenseUrl", errors)
                try:
                    number = int(source_data.get("soundNumber"))
                    if number <= 0:
                        raise ValueError
                except (TypeError, ValueError):
                    errors.append(f"{asset_id}: source soundNumber must be a positive integer")
                    number = 0
                source = SourceSpec(
                    provider=str(source_data.get("provider", "")),
                    provider_root=str(source_data.get("providerRoot", "")),
                    sound_number=number,
                    license_id=str(source_data.get("licenseId", "")),
                    license_url=str(source_data.get("licenseUrl", "")),
                )
            notes = tuple(dict(note) for note in (row.get("notes") or []))
            parsed_groups[kind].append(AssetSpec(
                id=asset_id,
                file_name=file_name,
                relative_path=rel,
                duration_seconds=duration,
                kind=kind,
                family=row.get("family"),
                level=row.get("level"),
                label=row.get("label"),
                seed=int(row["seed"]) if row.get("seed") is not None else None,
                role=row.get("role"),
                runtime_gain=float(row["runtimeGain"]) if row.get("runtimeGain") is not None else None,
                notes=notes,
                processing_profile=row.get("processingProfile"),
                source=source,
            ))

    expected_all = EXPECTED_HYPERFOCUS_IDS | EXPECTED_AMBIENCE_IDS | EXPECTED_FEEDBACK_IDS
    if set(all_ids) != expected_all or len(all_ids) != 26 or len(set(all_paths)) != 26:
        errors.append("spec must contain the exact 26-role inventory with unique paths")
    if {row.id for row in parsed_groups["hyperfocus"]} != EXPECTED_HYPERFOCUS_IDS:
        errors.append("hyperfocus must contain six families with soft/deep/intense levels")
    if {row.id for row in parsed_groups["ambience"]} != EXPECTED_AMBIENCE_IDS:
        errors.append("ambience inventory is incomplete")
    if {row.id for row in parsed_groups["feedback"]} != EXPECTED_FEEDBACK_IDS:
        errors.append("feedback inventory is incomplete")

    if errors:
        raise SpecError("; ".join(dict.fromkeys(errors)))

    contract = AudioContract(
        sample_rate=int(contract_data["sampleRate"]),
        channels=int(contract_data["channels"]),
        format=str(contract_data["format"]),
        encoder=str(contract_data["encoder"]),
        bitrate_kbps=int(contract_data["bitrateKbps"]),
        hyperfocus_duration_seconds=float(contract_data["hyperfocusDurationSeconds"]),
        ambience_duration_seconds=float(contract_data["ambienceDurationSeconds"]),
    )
    return ReviewSpec(
        schema_version=1,
        package_id=str(data["packageId"]),
        status="REVIEW_ONLY",
        purpose=str(data["purpose"]),
        output_root=output_root,
        runtime_promotion_allowed=False,
        audio_contract=contract,
        rights_policy=dict(rights),
        hyperfocus=tuple(parsed_groups["hyperfocus"]),
        ambience=tuple(parsed_groups["ambience"]),
        feedback=tuple(parsed_groups["feedback"]),
    )


def load_spec(path: str | Path) -> ReviewSpec:
    return validate_spec_dict(json.loads(Path(path).read_text(encoding="utf-8")))
