from __future__ import annotations

import json
from pathlib import Path
import tempfile

from scripts.audio_review.evidence import write_sha256sums

from .preview import PreviewRecord


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


def write_preview_evidence(
    root: Path,
    records: tuple[PreviewRecord, ...],
    qc_rows: tuple[dict, ...],
    *,
    spec_sha256: str,
    rights_ledger_sha256: str,
) -> tuple[Path, Path, Path]:
    if len(records) != 18 or len(qc_rows) != 18:
        raise ValueError("exactly 18 preview records and QC rows are required")
    provenance_rows = []
    for record in records:
        row = record.serializable()
        row["previewPath"] = f"audio/{Path(record.preview_path).name}"
        provenance_rows.append(row)
    provenance = {
        "schemaVersion": 1,
        "status": "SOURCE_PRESERVING_PREVIEWS_TECHNICAL_PASS",
        "runtimePromotionAllowed": False,
        "aiStatus": "UNVERIFIED",
        "humanSemanticStatus": "UNVERIFIED",
        "rightsLegalStatus": "UNVERIFIED",
        "specSha256": spec_sha256,
        "rightsLedgerSha256": rights_ledger_sha256,
        "previewCount": 18,
        "operations": ["decode-pcm", "contiguous-extract"],
        "previews": provenance_rows,
    }
    qc = {
        "schemaVersion": 1,
        "status": "PASS",
        "previewCount": 18,
        "rows": list(qc_rows),
    }
    provenance_path = root / "preview-provenance.json"
    qc_path = root / "preview-qc.json"
    _write_json(provenance_path, provenance)
    _write_json(qc_path, qc)
    files = tuple(
        path
        for path in root.rglob("*")
        if path.is_file() and path.name != "SHA256SUMS"
    )
    sums_path = write_sha256sums(root, files)
    return provenance_path, qc_path, sums_path
