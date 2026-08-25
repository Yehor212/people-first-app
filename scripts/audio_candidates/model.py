from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import re
from types import MappingProxyType
from typing import Mapping
from urllib.parse import urlparse


EXACT_FAMILIES = ("forest", "rain", "ocean", "fireplace", "river", "wind")
PROVIDER = "BigSoundBank / LaSonotheque"
PROVIDER_ROOT = "https://bigsoundbank.com/"
LICENSE_ID = "CC0-1.0"
LICENSE_URL = "https://bigsoundbank.com/licenses.html"
ROOT_KEYS = {
    "schemaVersion",
    "provider",
    "providerRoot",
    "licenseId",
    "licenseUrl",
    "previewStartSeconds",
    "previewDurationSeconds",
    "families",
}
FAMILY_KEYS = {"family", "noneAllowed", "candidates"}
CANDIDATE_KEYS = {"id", "soundNumber", "expectedTitle", "pageUrl"}


class CandidateSpecError(ValueError):
    pass


@dataclass(frozen=True)
class CandidateSource:
    id: str
    family: str
    provider: str
    provider_root: str
    sound_number: int
    page_url: str
    expected_title: str
    license_id: str
    license_url: str


@dataclass(frozen=True)
class FamilyCandidates:
    family: str
    candidates: tuple[CandidateSource, CandidateSource, CandidateSource]
    none_allowed: bool


@dataclass(frozen=True)
class CandidateSpec:
    schema_version: int
    preview_start_seconds: int
    preview_duration_seconds: int
    families: Mapping[str, FamilyCandidates]

    @property
    def candidates(self) -> tuple[CandidateSource, ...]:
        return tuple(
            candidate
            for family in self.families.values()
            for candidate in family.candidates
        )


def _reject_duplicate_keys(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise CandidateSpecError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def _require_exact_keys(value: object, expected: set[str], context: str) -> dict:
    if not isinstance(value, dict) or set(value) != expected:
        actual = sorted(value) if isinstance(value, dict) else type(value).__name__
        raise CandidateSpecError(
            f"{context} keys mismatch: expected {sorted(expected)}, got {actual}"
        )
    return value


def _validate_https_bigsoundbank_url(value: object, *, page: bool) -> str:
    if not isinstance(value, str):
        raise CandidateSpecError("unapproved page URL")
    parsed = urlparse(value)
    if (
        parsed.scheme != "https"
        or parsed.hostname != "bigsoundbank.com"
        or parsed.username is not None
        or parsed.password is not None
        or parsed.port not in (None, 443)
        or parsed.query
        or parsed.fragment
    ):
        raise CandidateSpecError("unapproved page URL")
    if page and re.fullmatch(r"/[a-z0-9-]+-s\d{4}\.html", parsed.path) is None:
        raise CandidateSpecError("unapproved page URL")
    return value


def _parse_candidate(
    raw: object,
    *,
    family: str,
    position: int,
    provider: str,
    provider_root: str,
    license_id: str,
    license_url: str,
) -> CandidateSource:
    row = _require_exact_keys(raw, CANDIDATE_KEYS, f"candidate {family}-{position}")
    expected_id = f"{family}-c{position}"
    if row["id"] != expected_id:
        raise CandidateSpecError(
            f"candidate id mismatch: expected {expected_id}, got {row['id']!r}"
        )
    sound_number = row["soundNumber"]
    if (
        not isinstance(sound_number, int)
        or isinstance(sound_number, bool)
        or not 1 <= sound_number <= 9999
    ):
        raise CandidateSpecError(f"invalid sound number for {expected_id}")
    expected_title = row["expectedTitle"]
    if not isinstance(expected_title, str) or not expected_title.strip():
        raise CandidateSpecError(f"missing expected title for {expected_id}")
    if re.search(r"\b(?:soft|deep|intense)\b", expected_title, re.IGNORECASE):
        raise CandidateSpecError(f"product level is forbidden in source title: {expected_id}")
    page_url = _validate_https_bigsoundbank_url(row["pageUrl"], page=True)
    if re.search(rf"-s0*{sound_number}\.html$", page_url, re.IGNORECASE) is None:
        raise CandidateSpecError(f"page URL is not bound to sound number: {expected_id}")
    return CandidateSource(
        id=expected_id,
        family=family,
        provider=provider,
        provider_root=provider_root,
        sound_number=sound_number,
        page_url=page_url,
        expected_title=" ".join(expected_title.split()),
        license_id=license_id,
        license_url=license_url,
    )


def load_candidate_spec(path: str | Path) -> CandidateSpec:
    source = Path(path)
    if source.is_symlink() or not source.is_file():
        raise CandidateSpecError(f"candidate spec must be a regular file: {source}")
    try:
        raw = json.loads(
            source.read_text(encoding="utf-8"),
            object_pairs_hook=_reject_duplicate_keys,
        )
    except CandidateSpecError:
        raise
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise CandidateSpecError(f"invalid candidate spec: {exc}") from exc
    data = _require_exact_keys(raw, ROOT_KEYS, "root")
    if data["schemaVersion"] != 2:
        raise CandidateSpecError("schemaVersion must be 2")
    if data["provider"] != PROVIDER:
        raise CandidateSpecError("unapproved provider")
    if data["providerRoot"] != PROVIDER_ROOT:
        raise CandidateSpecError("unapproved provider root")
    _validate_https_bigsoundbank_url(data["providerRoot"], page=False)
    if data["licenseId"] != LICENSE_ID or data["licenseUrl"] != LICENSE_URL:
        raise CandidateSpecError("unapproved license")
    _validate_https_bigsoundbank_url(data["licenseUrl"], page=False)
    if data["previewStartSeconds"] != 5 or data["previewDurationSeconds"] != 20:
        raise CandidateSpecError("preview window must be exactly 5s start and 20s duration")
    if not isinstance(data["families"], list):
        raise CandidateSpecError("families must be an array")

    parsed_families = {}
    all_ids = set()
    all_numbers = set()
    all_urls = set()
    for index, expected_family in enumerate(EXACT_FAMILIES):
        if index >= len(data["families"]):
            raise CandidateSpecError("exact six-family order is required")
        family_data = _require_exact_keys(
            data["families"][index], FAMILY_KEYS, f"family {expected_family}"
        )
        if family_data["family"] != expected_family:
            raise CandidateSpecError("exact six-family order is required")
        if family_data["noneAllowed"] is not True:
            raise CandidateSpecError(f"NONE must be allowed for {expected_family}")
        candidates_raw = family_data["candidates"]
        if not isinstance(candidates_raw, list) or len(candidates_raw) != 3:
            raise CandidateSpecError(
                f"exactly three candidates are required for {expected_family}"
            )
        candidates = tuple(
            _parse_candidate(
                candidate,
                family=expected_family,
                position=position,
                provider=data["provider"],
                provider_root=data["providerRoot"],
                license_id=data["licenseId"],
                license_url=data["licenseUrl"],
            )
            for position, candidate in enumerate(candidates_raw, start=1)
        )
        for candidate in candidates:
            if candidate.id in all_ids:
                raise CandidateSpecError(f"duplicate candidate id: {candidate.id}")
            if candidate.sound_number in all_numbers:
                raise CandidateSpecError(
                    f"duplicate sound number: {candidate.sound_number}"
                )
            if candidate.page_url in all_urls:
                raise CandidateSpecError(f"duplicate page URL: {candidate.page_url}")
            all_ids.add(candidate.id)
            all_numbers.add(candidate.sound_number)
            all_urls.add(candidate.page_url)
        parsed_families[expected_family] = FamilyCandidates(
            family=expected_family,
            candidates=candidates,
            none_allowed=True,
        )
    if len(data["families"]) != len(EXACT_FAMILIES):
        raise CandidateSpecError("exact six-family order is required")
    return CandidateSpec(
        schema_version=2,
        preview_start_seconds=5,
        preview_duration_seconds=20,
        families=MappingProxyType(parsed_families),
    )
