from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import tempfile
import wave

from scripts.audio_review.quarantine import QuarantineError, load_denylist
from scripts.audio_review.rights import (
    RIGHTS_LEGAL_BOUNDARY,
    HttpClient,
    RightsError,
    SourceRecord,
    SourceRequest,
    acquire_source,
)

from .model import CandidateSource


CANDIDATE_RIGHTS_STATUS = (
    "RIGHTS_EVIDENCE_CAPTURED_TECHNICAL_PASS_LEGAL_UNVERIFIED"
)
FIXED_RECEIPT_DIRECTORIES = {
    f"{family}-c{position}": f"{family}-c{position}"
    for family in ("forest", "rain", "ocean", "fireplace", "river", "wind")
    for position in (1, 2, 3)
}


class CandidateRightsError(RightsError):
    pass


@dataclass(frozen=True)
class CandidateSourceRecord:
    candidate_id: str
    family: str
    sound_number: int
    expected_title: str
    title: str
    author: str
    source_page_url: str
    audio_url: str
    license_id: str
    license_url: str
    source_sha256: str
    source_bytes: int
    source_path: Path
    source_page_sha256: str
    license_page_sha256: str
    sample_rate: int
    channels: int
    sample_width_bytes: int
    duration_frames: int
    duration_seconds: float
    acquired_at: str
    rights_evidence: dict[str, bool]
    status: str
    source_record: SourceRecord

    def serializable(self) -> dict:
        return {
            "schemaVersion": 1,
            "candidateId": self.candidate_id,
            "family": self.family,
            "status": self.status,
            "legalBoundary": RIGHTS_LEGAL_BOUNDARY,
            "rightsDecision": "UNVERIFIED_OWNER_LEGAL",
            "soundNumber": self.sound_number,
            "expectedTitle": self.expected_title,
            "title": self.title,
            "author": self.author,
            "sourcePageUrl": self.source_page_url,
            "audioUrl": self.audio_url,
            "licenseId": self.license_id,
            "licenseUrl": self.license_url,
            "sourceSha256": self.source_sha256,
            "sourceBytes": self.source_bytes,
            "sourceCacheFile": self.source_path.name,
            "sourcePageSha256": self.source_page_sha256,
            "licensePageSha256": self.license_page_sha256,
            "sampleRate": self.sample_rate,
            "channels": self.channels,
            "sampleWidthBytes": self.sample_width_bytes,
            "durationFrames": self.duration_frames,
            "durationSeconds": self.duration_seconds,
            "acquiredAt": self.acquired_at,
            "rightsEvidence": dict(self.rights_evidence),
            "sourceAudioIncludedInReceipt": False,
        }


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _within(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def _read_wave_contract(path: Path) -> tuple[int, int, int, int]:
    try:
        with wave.open(str(path), "rb") as source:
            return (
                source.getframerate(),
                source.getnchannels(),
                source.getsampwidth(),
                source.getnframes(),
            )
    except (OSError, EOFError, wave.Error) as exc:
        raise CandidateRightsError("source must be a readable PCM WAV") from exc


def _validate_source_record(
    candidate: CandidateSource,
    source: SourceRecord,
    cache_root: Path,
) -> CandidateSourceRecord:
    if source.sound_number != candidate.sound_number:
        raise CandidateRightsError("sound number drift")
    if source.source_page_url != candidate.page_url:
        raise CandidateRightsError("page URL drift")
    if " ".join(source.title.split()) != candidate.expected_title:
        raise CandidateRightsError("title drift")
    if not source.author.strip():
        raise CandidateRightsError("author is missing")
    if source.license_id != candidate.license_id:
        raise CandidateRightsError("license identity drift")
    if source.license_url != candidate.license_url:
        raise CandidateRightsError("license URL drift")
    if set(source.rights_evidence) != {
        "cc0",
        "distribution",
        "adaptation",
        "commercial",
    } or not all(source.rights_evidence.values()):
        raise CandidateRightsError("CC0 rights evidence is incomplete")

    root = cache_root.resolve()
    path = source.local_path
    if cache_root.is_symlink() or path.is_symlink() or not path.is_file():
        raise CandidateRightsError("source cache boundary")
    resolved = path.resolve()
    if not _within(resolved, root):
        raise CandidateRightsError("source cache boundary")
    if resolved.suffix.lower() != ".wav":
        raise CandidateRightsError("source must be a readable PCM WAV")
    if resolved.stat().st_size != source.source_bytes:
        raise CandidateRightsError("source byte count mismatch")
    if _sha256_file(resolved) != source.source_sha256:
        raise CandidateRightsError("source hash mismatch")

    sample_rate, channels, sample_width, duration_frames = _read_wave_contract(
        resolved
    )
    if sample_rate != 48000 or source.sample_rate_declared != 48000:
        raise CandidateRightsError("source must be 48 kHz")
    if channels != 2 or source.channels_declared != 2:
        raise CandidateRightsError("source must be stereo")
    if sample_width not in (2, 3, 4):
        raise CandidateRightsError("source PCM width is unsupported")
    duration_seconds = duration_frames / sample_rate
    if duration_seconds < 30:
        raise CandidateRightsError("source must be at least 30 seconds")
    return CandidateSourceRecord(
        candidate_id=candidate.id,
        family=candidate.family,
        sound_number=candidate.sound_number,
        expected_title=candidate.expected_title,
        title=source.title,
        author=source.author,
        source_page_url=source.source_page_url,
        audio_url=source.audio_url,
        license_id=source.license_id,
        license_url=source.license_url,
        source_sha256=source.source_sha256,
        source_bytes=source.source_bytes,
        source_path=resolved,
        source_page_sha256=source.source_page_sha256,
        license_page_sha256=source.license_page_sha256,
        sample_rate=sample_rate,
        channels=channels,
        sample_width_bytes=sample_width,
        duration_frames=duration_frames,
        duration_seconds=duration_seconds,
        acquired_at=source.acquired_at,
        rights_evidence=dict(source.rights_evidence),
        status=CANDIDATE_RIGHTS_STATUS,
        source_record=source,
    )


def acquire_candidate(
    candidate: CandidateSource,
    cache_root: Path,
    client: HttpClient,
) -> CandidateSourceRecord:
    try:
        source = acquire_source(
            SourceRequest(
                sound_number=candidate.sound_number,
                provider_root=candidate.provider_root,
                license_url=candidate.license_url,
                license_id=candidate.license_id,
            ),
            client,
            denylist=load_denylist(
                Path(__file__).resolve().parents[2]
                / "config/audio/quarantine-denylist.json"
            ),
        )
    except QuarantineError as exc:
        raise CandidateRightsError(str(exc)) from exc
    return _validate_source_record(candidate, source, Path(cache_root))


def _atomic_write_bytes(path: Path, data: bytes) -> None:
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as stream:
            stream.write(data)
            temporary = Path(stream.name)
        temporary.replace(path)
        temporary = None
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def write_candidate_rights_receipt(
    record: CandidateSourceRecord,
    receipt_root: Path,
) -> Path:
    if receipt_root.is_symlink():
        raise CandidateRightsError("receipt root may not be a symlink")
    receipt_directory = FIXED_RECEIPT_DIRECTORIES.get(record.candidate_id)
    if receipt_directory is None:
        raise CandidateRightsError("candidate receipt identity is not allowlisted")
    receipt_dir = receipt_root / receipt_directory
    if receipt_dir.is_symlink():
        raise CandidateRightsError("receipt directory may not be a symlink")
    receipt_dir.mkdir(parents=True, exist_ok=True)
    source_page_path = receipt_dir / "source-page.html"
    license_page_path = receipt_dir / "license-page.html"
    _atomic_write_bytes(source_page_path, record.source_record.source_page_snapshot)
    _atomic_write_bytes(license_page_path, record.source_record.license_page_snapshot)
    payload = record.serializable()
    payload["artifacts"] = {
        "sourcePage": {
            "path": f"{record.candidate_id}/source-page.html",
            "sha256": record.source_page_sha256,
        },
        "licensePage": {
            "path": f"{record.candidate_id}/license-page.html",
            "sha256": record.license_page_sha256,
        },
    }
    receipt_path = receipt_dir / "receipt.json"
    _atomic_write_bytes(
        receipt_path,
        (json.dumps(payload, indent=2, sort_keys=True) + "\n").encode("utf-8"),
    )
    return receipt_path
