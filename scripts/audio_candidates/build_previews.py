from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import tempfile

from scripts.audio_review.verify import verify_hash_inventory

from .evidence import write_preview_evidence
from .model import load_candidate_spec
from .preview import build_raw_preview, verify_preview


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
SPEC_PATH = REPOSITORY_ROOT / "config/audio/hyperfocus-source-candidates-v2.json"
PRIVATE_ROOT = Path(
    "/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2"
)
SOURCE_CACHE = PRIVATE_ROOT / "source-cache"
RIGHTS_ROOT = PRIVATE_ROOT / "rights-receipts"
RIGHTS_LEDGER = RIGHTS_ROOT / "rights-ledger.json"
OUTPUT_ROOT = PRIVATE_ROOT / "raw-previews-v1"
SOURCE_CACHE_NAME = re.compile(
    r"bigsoundbank-s(?P<number>\d{4})-(?P<prefix>[0-9a-f]{16})\.wav"
)


class PreviewBuildError(RuntimeError):
    pass


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _load_rights_rows() -> dict[str, dict]:
    verify_hash_inventory(RIGHTS_ROOT)
    try:
        ledger = json.loads(RIGHTS_LEDGER.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise PreviewBuildError("rights ledger is unreadable") from exc
    if (
        not isinstance(ledger, dict)
        or ledger.get("schemaVersion") != 1
        or ledger.get("status")
        != "RIGHTS_EVIDENCE_CAPTURED_TECHNICAL_PASS_LEGAL_UNVERIFIED"
        or ledger.get("runtimePromotionAllowed") is not False
        or ledger.get("candidateCount") != 18
        or not isinstance(ledger.get("candidates"), list)
    ):
        raise PreviewBuildError("rights ledger boundary mismatch")
    rows = {}
    for row in ledger["candidates"]:
        candidate_id = row.get("candidateId") if isinstance(row, dict) else None
        if not isinstance(candidate_id, str) or candidate_id in rows:
            raise PreviewBuildError("rights candidate identity mismatch")
        rows[candidate_id] = row
    return rows


def _resolve_source(row: dict) -> Path:
    name = row.get("sourceCacheFile")
    match = SOURCE_CACHE_NAME.fullmatch(name) if isinstance(name, str) else None
    if (
        match is None
        or int(match.group("number")) != row.get("soundNumber")
        or not isinstance(row.get("sourceSha256"), str)
        or match.group("prefix") != row["sourceSha256"][:16]
    ):
        raise PreviewBuildError("source cache filename is not hash and number bound")
    source_root = (SOURCE_CACHE / "sources").resolve(strict=True)
    source = SOURCE_CACHE / "sources" / name
    if source.is_symlink() or not source.is_file():
        raise PreviewBuildError("source cache file is unavailable")
    resolved = source.resolve(strict=True)
    if resolved.parent != source_root:
        raise PreviewBuildError("source cache boundary mismatch")
    if resolved.stat().st_size != row.get("sourceBytes"):
        raise PreviewBuildError("source cache byte count mismatch")
    if _sha256_file(resolved) != row["sourceSha256"]:
        raise PreviewBuildError("source cache hash mismatch")
    return resolved


def build_previews() -> Path:
    for path in (PRIVATE_ROOT, SOURCE_CACHE, RIGHTS_ROOT, OUTPUT_ROOT):
        if path.is_symlink():
            raise PreviewBuildError(f"symlinked private path is forbidden: {path}")
    if OUTPUT_ROOT.exists():
        raise PreviewBuildError("raw preview output already exists")
    spec = load_candidate_spec(SPEC_PATH)
    rights_rows = _load_rights_rows()
    expected_ids = tuple(candidate.id for candidate in spec.candidates)
    if set(rights_rows) != set(expected_ids):
        raise PreviewBuildError("rights ledger does not cover exact candidate inventory")

    PRIVATE_ROOT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(
        dir=PRIVATE_ROOT,
        prefix=".raw-previews-v1.",
    ) as temporary_name:
        temporary = Path(temporary_name)
        audio_root = temporary / "audio"
        records = []
        qc_rows = []
        for candidate_id in expected_ids:
            rights_row = rights_rows[candidate_id]
            source = _resolve_source(rights_row)
            record = build_raw_preview(
                candidate_id,
                source,
                rights_row["sourceSha256"],
                audio_root,
            )
            qc = verify_preview(record, source)
            records.append(record)
            qc_rows.append(qc)
        write_preview_evidence(
            temporary,
            tuple(records),
            tuple(qc_rows),
            spec_sha256=_sha256_file(SPEC_PATH),
            rights_ledger_sha256=_sha256_file(RIGHTS_LEDGER),
        )
        temporary.replace(OUTPUT_ROOT)
    return OUTPUT_ROOT


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Build the fixed source-preserving Hyperfocus v2 previews."
    )
    parser.parse_args(argv)
    output = build_previews()
    print(f"PASS: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
