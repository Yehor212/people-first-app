from __future__ import annotations

import argparse
from dataclasses import dataclass
import json
from pathlib import Path, PurePosixPath
import shutil
import tarfile
import tempfile
from typing import Callable
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

from .model import EXPECTED_MODELS, ModelSpec, load_model_manifest
from .model_cache import (
    MAX_ARCHIVE_BYTES,
    MAX_ARCHIVE_FILES,
    ModelAcquisitionError,
    ModelAcquisitionReceipt,
    ModelFileReceipt,
    copy_regular_file,
    copy_stream,
    file_sha256,
    safe_relative_file,
    write_receipt,
)


FetchFile = Callable[[ModelSpec, str, Path], Path]
ALLOWED_YAMNET_REDIRECT_HOSTS = frozenset(("tfhub.dev", "storage.googleapis.com", "www.kaggle.com"))


@dataclass(frozen=True)
class AcquisitionPaths:
    repo_root: Path
    private_root: Path
    manifest_path: Path
    cache_root: Path
    receipt_path: Path


class _ModelRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        parsed = urlparse(newurl)
        if parsed.scheme != "https" or parsed.hostname not in ALLOWED_YAMNET_REDIRECT_HOSTS:
            raise ModelAcquisitionError(f"unsafe model redirect: {newurl}")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _is_relative_to(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def validate_acquisition_paths(
    repo_root: Path,
    private_root: Path,
    manifest_path: Path,
) -> AcquisitionPaths:
    repo = repo_root.resolve(strict=True)
    private = private_root.resolve(strict=True)
    manifest = manifest_path.resolve(strict=True)
    if repo_root.is_symlink() or not repo.is_dir():
        raise ModelAcquisitionError("repository root must be a regular directory")
    if private_root.is_symlink() or not private.is_dir():
        raise ModelAcquisitionError("private root must be a regular directory")
    if _is_relative_to(private, repo):
        raise ModelAcquisitionError("private root cannot be inside the repository")
    expected_private = repo.parents[1] / "private-evidence" / "audio-ai-audit"
    if private != expected_private:
        raise ModelAcquisitionError(f"private root must be canonical: {expected_private}")
    expected_manifest = repo / "config/audio/hyperfocus-ai-models-v2.json"
    if manifest != expected_manifest or manifest_path.is_symlink() or not manifest.is_file():
        raise ModelAcquisitionError(f"manifest path must be canonical: {expected_manifest}")
    return AcquisitionPaths(
        repo_root=repo,
        private_root=private,
        manifest_path=manifest,
        cache_root=private / "models",
        receipt_path=private / "model-acquisition-receipt.json",
    )


def safe_model_id(spec: ModelSpec) -> str:
    if spec.id not in EXPECTED_MODELS or PurePosixPath(spec.id).name != spec.id:
        raise ModelAcquisitionError(f"unsafe model id: {spec.id}")
    return spec.id


def acquire_hf_model(
    spec: ModelSpec,
    cache_root: Path,
    fetch_file: FetchFile,
) -> ModelAcquisitionReceipt:
    cache_root.mkdir(parents=True, exist_ok=True)
    model_id = safe_model_id(spec)
    target = cache_root / model_id
    if target.exists():
        raise ModelAcquisitionError(f"refusing to overwrite model cache: {target}")
    temporary = Path(tempfile.mkdtemp(dir=cache_root, prefix=f".{model_id}."))
    download_root = temporary / ".downloads"
    download_root.mkdir()
    receipts: dict[str, ModelFileReceipt] = {}
    try:
        for filename in spec.allowed_files:
            relative = safe_relative_file(filename)
            source = Path(fetch_file(spec, filename, download_root))
            resolved_source = source.resolve(strict=True)
            resolved_download = download_root.resolve(strict=True)
            try:
                resolved_source.relative_to(resolved_download)
            except ValueError:
                # Test and operator fetchers may return a separately controlled regular file.
                if source.is_symlink() or not source.is_file():
                    raise ModelAcquisitionError(f"download escaped controlled roots: {source}")
            receipts[filename] = copy_regular_file(source, temporary / relative)
        shutil.rmtree(download_root)
        temporary.replace(target)
    except Exception:
        shutil.rmtree(temporary, ignore_errors=True)
        raise
    receipt = ModelAcquisitionReceipt(
        schema_version=1,
        model_id=model_id,
        repository=spec.repository,
        revision=spec.revision,
        license_id=spec.license_id,
        files=receipts,
    )
    verify_model_cache(receipt, cache_root)
    return receipt


def verify_model_cache(receipt: ModelAcquisitionReceipt, cache_root: Path) -> dict[str, str]:
    target = cache_root / receipt.model_id
    if target.is_symlink() or not target.is_dir():
        raise ModelAcquisitionError(f"model cache root must be a regular directory: {target}")
    actual_files = {
        path.relative_to(target).as_posix(): path
        for path in target.rglob("*")
        if path.is_file() or path.is_symlink()
    }
    if set(actual_files) != set(receipt.files):
        raise ModelAcquisitionError("model cache inventory mismatch")
    result: dict[str, str] = {}
    for name, expected in receipt.files.items():
        path = actual_files[name]
        if path.is_symlink() or not path.is_file():
            raise ModelAcquisitionError(f"model cache entry must be a regular file: {name}")
        digest = file_sha256(path)
        if digest != expected.sha256 or path.stat().st_size != expected.bytes:
            raise ModelAcquisitionError(f"model hash mismatch: {name}")
        result[name] = digest
    return result


def extract_yamnet_archive(archive: Path, output_root: Path) -> dict[str, ModelFileReceipt]:
    if output_root.exists():
        raise ModelAcquisitionError(f"refusing to overwrite extracted model: {output_root}")
    output_root.mkdir(parents=True)
    receipts: dict[str, ModelFileReceipt] = {}
    total = 0
    try:
        with tarfile.open(archive, "r:gz") as stream:
            members = stream.getmembers()
            if len(members) > MAX_ARCHIVE_FILES:
                raise ModelAcquisitionError("unsafe model archive member count")
            seen: set[str] = set()
            for member in members:
                relative = PurePosixPath(member.name)
                if (
                    not member.name
                    or relative.is_absolute()
                    or ".." in relative.parts
                    or "." in relative.parts
                    or member.issym()
                    or member.islnk()
                    or member.isdev()
                    or member.isfifo()
                ):
                    raise ModelAcquisitionError(f"unsafe model archive member: {member.name}")
                normalized = relative.as_posix()
                if normalized in seen:
                    raise ModelAcquisitionError(f"unsafe model archive member duplicate: {normalized}")
                seen.add(normalized)
                destination = output_root.joinpath(*relative.parts)
                if member.isdir():
                    destination.mkdir(parents=True, exist_ok=False)
                    continue
                if not member.isfile():
                    raise ModelAcquisitionError(f"unsafe model archive member type: {normalized}")
                total += member.size
                if total > MAX_ARCHIVE_BYTES:
                    raise ModelAcquisitionError("unsafe model archive expanded size")
                extracted = stream.extractfile(member)
                if extracted is None:
                    raise ModelAcquisitionError(f"unable to read model archive member: {normalized}")
                receipts[normalized] = copy_stream(extracted, destination, member.size)
    except Exception:
        shutil.rmtree(output_root, ignore_errors=True)
        raise
    if not receipts:
        shutil.rmtree(output_root, ignore_errors=True)
        raise ModelAcquisitionError("model archive contains no files")
    return receipts


def _hf_fetcher(spec: ModelSpec, filename: str, download_root: Path) -> Path:
    from huggingface_hub import hf_hub_download

    parsed = urlparse(spec.repository)
    repo_id = parsed.path.strip("/")
    if parsed.scheme != "https" or parsed.hostname != "huggingface.co" or not repo_id:
        raise ModelAcquisitionError(f"unsupported Hugging Face repository: {spec.repository}")
    local_root = download_root / "local"
    path = Path(
        hf_hub_download(
            repo_id=repo_id,
            filename=filename,
            revision=spec.revision,
            local_dir=local_root,
        )
    )
    if path.is_symlink():
        resolved = path.resolve(strict=True)
        materialized = download_root / "materialized" / safe_relative_file(filename)
        materialized.parent.mkdir(parents=True, exist_ok=True)
        with resolved.open("rb") as source, materialized.open("xb") as target:
            shutil.copyfileobj(source, target, length=1024 * 1024)
        return materialized
    return path


def _download_yamnet(url: str, destination: Path) -> None:
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname != "tfhub.dev":
        raise ModelAcquisitionError(f"unsupported YAMNet URL: {url}")
    opener = build_opener(_ModelRedirectHandler())
    request = Request(url, headers={"User-Agent": "ZenFlow-Audio-Audit/1"})
    with opener.open(request, timeout=60) as response, destination.open("xb") as output:
        total = 0
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_ARCHIVE_BYTES:
                raise ModelAcquisitionError("YAMNet archive exceeds size limit")
            output.write(chunk)
    if destination.stat().st_size <= 0:
        raise ModelAcquisitionError("YAMNet archive is empty")


def acquire_yamnet(spec: ModelSpec, cache_root: Path) -> ModelAcquisitionReceipt:
    cache_root.mkdir(parents=True, exist_ok=True)
    model_id = safe_model_id(spec)
    target = cache_root / model_id
    if target.exists():
        raise ModelAcquisitionError(f"refusing to overwrite model cache: {target}")
    transaction = Path(tempfile.mkdtemp(dir=cache_root, prefix=f".{model_id}."))
    archive = transaction / "yamnet-v1.tar.gz"
    extracted = transaction / "extracted"
    try:
        _download_yamnet(f"{spec.repository}?tf-hub-format=compressed", archive)
        archive_sha = file_sha256(archive)
        archive_bytes = archive.stat().st_size
        files = extract_yamnet_archive(archive, extracted)
        archive.unlink()
        extracted.replace(target)
        transaction.rmdir()
    except Exception:
        shutil.rmtree(transaction, ignore_errors=True)
        raise
    receipt = ModelAcquisitionReceipt(
        schema_version=1,
        model_id=model_id,
        repository=spec.repository,
        revision=spec.revision,
        license_id=spec.license_id,
        files=files,
        archive_sha256=archive_sha,
        archive_bytes=archive_bytes,
    )
    verify_model_cache(receipt, cache_root)
    return receipt


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Acquire explicit hash-bound audit models")
    return parser


def main(argv=None) -> int:
    build_parser().parse_args(argv)
    repo_root = Path(__file__).resolve().parents[2]
    private_root = repo_root.parents[1] / "private-evidence" / "audio-ai-audit"
    paths = validate_acquisition_paths(
        repo_root,
        private_root,
        repo_root / "config/audio/hyperfocus-ai-models-v2.json",
    )
    manifest = load_model_manifest(paths.manifest_path)
    receipts = {
        "semantic-clap": acquire_hf_model(
            manifest.models["semantic-clap"],
            paths.cache_root,
            _hf_fetcher,
        ),
        "temporal-yamnet": acquire_yamnet(
            manifest.models["temporal-yamnet"],
            paths.cache_root,
        ),
    }
    payload = {
        "schemaVersion": 1,
        "status": "HASH_PINNED_NOT_ADMITTED",
        "models": {key: value.to_dict() for key, value in receipts.items()},
    }
    write_receipt(paths.receipt_path, payload)
    print(json.dumps(payload, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


__all__ = [
    "ModelAcquisitionError",
    "ModelAcquisitionReceipt",
    "acquire_hf_model",
    "acquire_yamnet",
    "extract_yamnet_archive",
    "validate_acquisition_paths",
    "verify_model_cache",
]
