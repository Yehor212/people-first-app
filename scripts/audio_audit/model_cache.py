from __future__ import annotations

from dataclasses import asdict, dataclass
import hashlib
import json
from pathlib import Path, PurePosixPath
import tempfile
from typing import BinaryIO


MAX_MODEL_FILE_BYTES = 2 * 1024 * 1024 * 1024
MAX_ARCHIVE_FILES = 256
MAX_ARCHIVE_BYTES = 512 * 1024 * 1024


class ModelAcquisitionError(RuntimeError):
    pass


@dataclass(frozen=True)
class ModelFileReceipt:
    sha256: str
    bytes: int


@dataclass(frozen=True)
class ModelAcquisitionReceipt:
    schema_version: int
    model_id: str
    repository: str
    revision: str
    license_id: str
    files: dict[str, ModelFileReceipt]
    archive_sha256: str | None = None
    archive_bytes: int | None = None
    status: str = "HASH_PINNED_NOT_ADMITTED"

    def to_dict(self) -> dict:
        payload = asdict(self)
        payload["schemaVersion"] = payload.pop("schema_version")
        payload["modelId"] = payload.pop("model_id")
        payload["licenseId"] = payload.pop("license_id")
        payload["archiveSha256"] = payload.pop("archive_sha256")
        payload["archiveBytes"] = payload.pop("archive_bytes")
        return payload


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_relative_file(name: str) -> PurePosixPath:
    path = PurePosixPath(name)
    if not name or path.is_absolute() or ".." in path.parts or "." in path.parts:
        raise ModelAcquisitionError(f"unsafe model file path: {name}")
    return path


def copy_regular_file(source: Path, destination: Path) -> ModelFileReceipt:
    if source.is_symlink() or not source.is_file():
        raise ModelAcquisitionError(f"downloaded model entry must be a regular file: {source}")
    size = source.stat().st_size
    if size <= 0 or size > MAX_MODEL_FILE_BYTES:
        raise ModelAcquisitionError(f"downloaded model file size is invalid: {source}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256()
    written = 0
    with source.open("rb") as input_stream, destination.open("xb") as output_stream:
        for chunk in iter(lambda: input_stream.read(1024 * 1024), b""):
            digest.update(chunk)
            output_stream.write(chunk)
            written += len(chunk)
    if written != size:
        raise ModelAcquisitionError(f"model copy length mismatch: {source}")
    return ModelFileReceipt(sha256=digest.hexdigest(), bytes=written)


def copy_stream(stream: BinaryIO, destination: Path, expected_size: int) -> ModelFileReceipt:
    if expected_size <= 0 or expected_size > MAX_ARCHIVE_BYTES:
        raise ModelAcquisitionError(f"unsafe model archive member size: {destination}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256()
    written = 0
    with destination.open("xb") as output_stream:
        while written < expected_size:
            chunk = stream.read(min(1024 * 1024, expected_size - written))
            if not chunk:
                break
            output_stream.write(chunk)
            digest.update(chunk)
            written += len(chunk)
    if written != expected_size or stream.read(1):
        raise ModelAcquisitionError(f"model archive member length mismatch: {destination}")
    return ModelFileReceipt(sha256=digest.hexdigest(), bytes=written)


def write_receipt(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    encoded = (json.dumps(payload, indent=2, sort_keys=True) + "\n").encode("utf-8")
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as stream:
            stream.write(encoded)
            temporary = Path(stream.name)
        if path.exists():
            raise ModelAcquisitionError(f"refusing to overwrite model receipt: {path}")
        temporary.replace(path)
        temporary = None
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)

