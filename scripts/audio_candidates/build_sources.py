from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import tempfile

from scripts.audio_review.evidence import write_sha256sums
from scripts.audio_review.rights import HttpClient

from .model import load_candidate_spec
from .rights import (
    CandidateRightsError,
    acquire_candidate,
    write_candidate_rights_receipt,
)


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
SPEC_PATH = REPOSITORY_ROOT / "config/audio/hyperfocus-source-candidates-v2.json"
PRIVATE_ROOT = Path(
    "/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2"
)
SOURCE_CACHE = PRIVATE_ROOT / "source-cache"
RIGHTS_RECEIPTS = PRIVATE_ROOT / "rights-receipts"


class SourceBuildError(RuntimeError):
    pass


def _utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _write_json(path: Path, value: object) -> None:
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as stream:
            json.dump(value, stream, indent=2, sort_keys=True)
            stream.write("\n")
            temporary = Path(stream.name)
        temporary.replace(path)
        temporary = None
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def _validate_fixed_roots() -> None:
    expected_private = Path(
        "/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2"
    )
    if PRIVATE_ROOT != expected_private:
        raise SourceBuildError("private evidence root drift")
    for path in (PRIVATE_ROOT, SOURCE_CACHE, RIGHTS_RECEIPTS):
        if path.is_symlink():
            raise SourceBuildError(f"symlinked private path is forbidden: {path}")
    if SPEC_PATH.is_symlink() or not SPEC_PATH.is_file():
        raise SourceBuildError("canonical candidate spec is unavailable")


def build_sources(*, offline: bool = False) -> Path:
    _validate_fixed_roots()
    spec = load_candidate_spec(SPEC_PATH)
    if RIGHTS_RECEIPTS.exists() and any(RIGHTS_RECEIPTS.iterdir()):
        raise SourceBuildError(
            "rights receipt root is not empty; preserve it and choose a new versioned run"
        )
    SOURCE_CACHE.mkdir(parents=True, exist_ok=True)
    RIGHTS_RECEIPTS.mkdir(parents=True, exist_ok=False)
    client = HttpClient(SOURCE_CACHE, offline=offline, timeout=30.0)
    acquired = []
    started_at = _utc_timestamp()
    try:
        for candidate in spec.candidates:
            record = acquire_candidate(candidate, SOURCE_CACHE, client)
            receipt_path = write_candidate_rights_receipt(record, RIGHTS_RECEIPTS)
            acquired.append(
                {
                    **record.serializable(),
                    "receiptPath": receipt_path.relative_to(RIGHTS_RECEIPTS).as_posix(),
                    "receiptSha256": _sha256_file(receipt_path),
                }
            )
    except Exception as exc:
        failure = {
            "schemaVersion": 1,
            "status": "FAIL",
            "startedAt": started_at,
            "failedAt": _utc_timestamp(),
            "completedCandidates": [row["candidateId"] for row in acquired],
            "errorType": type(exc).__name__,
            "error": str(exc),
        }
        _write_json(RIGHTS_RECEIPTS / "source-acquisition-failure.json", failure)
        if isinstance(exc, (CandidateRightsError, SourceBuildError)):
            raise
        raise SourceBuildError(str(exc)) from exc

    if len(acquired) != 18:
        raise SourceBuildError(f"exactly 18 sources required, acquired {len(acquired)}")
    ledger = {
        "schemaVersion": 1,
        "status": "RIGHTS_EVIDENCE_CAPTURED_TECHNICAL_PASS_LEGAL_UNVERIFIED",
        "runtimePromotionAllowed": False,
        "spec": {
            "path": SPEC_PATH.relative_to(REPOSITORY_ROOT).as_posix(),
            "sha256": _sha256_file(SPEC_PATH),
        },
        "startedAt": started_at,
        "completedAt": _utc_timestamp(),
        "candidateCount": len(acquired),
        "candidates": acquired,
    }
    ledger_path = RIGHTS_RECEIPTS / "rights-ledger.json"
    _write_json(ledger_path, ledger)
    inventory_files = tuple(
        path
        for path in RIGHTS_RECEIPTS.rglob("*")
        if path.is_file() and path.name != "SHA256SUMS"
    )
    write_sha256sums(RIGHTS_RECEIPTS, inventory_files)
    return ledger_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Acquire the fixed Hyperfocus v2 CC0 source candidate matrix."
    )
    parser.parse_args(argv)
    ledger = build_sources(offline=False)
    print(f"PASS: {ledger}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
