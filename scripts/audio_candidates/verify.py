from __future__ import annotations

import argparse
import json
from pathlib import Path

from scripts.audio_review.verify import verify_hash_inventory

from .build_previews import (
    OUTPUT_ROOT,
    RIGHTS_LEDGER,
    SPEC_PATH,
    _load_rights_rows,
    _resolve_source,
    _sha256_file,
)
from .model import load_candidate_spec
from .preview import PreviewRecord, verify_preview


class CandidateVerificationError(RuntimeError):
    pass


def _record_from_json(row: object, root: Path) -> PreviewRecord:
    if not isinstance(row, dict):
        raise CandidateVerificationError("invalid preview provenance row")
    expected_keys = {
        "schemaVersion",
        "candidateId",
        "sourceSha256",
        "startFrame",
        "frameCount",
        "availableFrames",
        "sampleRate",
        "channels",
        "sampleWidthBytes",
        "operations",
        "previewPath",
        "previewSha256",
        "analysisOnlyPlaybackGainDb",
        "measuredRmsDbfs",
        "measuredPeakDbfs",
        "measuredDcOffset",
        "productLevel",
    }
    if set(row) != expected_keys or row.get("schemaVersion") != 1:
        raise CandidateVerificationError("invalid preview provenance keys")
    relative = row["previewPath"]
    expected_relative = f"audio/{row['candidateId']}.wav"
    if relative != expected_relative:
        raise CandidateVerificationError("preview path is not candidate bound")
    return PreviewRecord(
        candidate_id=row["candidateId"],
        source_sha256=row["sourceSha256"],
        start_frame=row["startFrame"],
        frame_count=row["frameCount"],
        available_frames=row["availableFrames"],
        sample_rate=row["sampleRate"],
        channels=row["channels"],
        sample_width_bytes=row["sampleWidthBytes"],
        operations=tuple(row["operations"]),
        preview_path=str(root / relative),
        preview_sha256=row["previewSha256"],
        playback_gain_db=row["analysisOnlyPlaybackGainDb"],
        measured_rms_dbfs=row["measuredRmsDbfs"],
        measured_peak_dbfs=row["measuredPeakDbfs"],
        measured_dc_offset=row["measuredDcOffset"],
        product_level=row["productLevel"],
    )


def verify_raw_preview_package(root: Path = OUTPUT_ROOT) -> dict:
    root = Path(root)
    inventory = verify_hash_inventory(root)
    spec = load_candidate_spec(SPEC_PATH)
    expected_ids = tuple(candidate.id for candidate in spec.candidates)
    expected_files = {
        "preview-provenance.json",
        "preview-qc.json",
        *(f"audio/{candidate_id}.wav" for candidate_id in expected_ids),
    }
    if set(inventory) != expected_files:
        raise CandidateVerificationError("raw preview inventory mismatch")
    try:
        provenance = json.loads(
            (root / "preview-provenance.json").read_text(encoding="utf-8")
        )
        qc = json.loads((root / "preview-qc.json").read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise CandidateVerificationError("preview evidence is unreadable") from exc
    if (
        provenance.get("schemaVersion") != 1
        or provenance.get("status")
        != "SOURCE_PRESERVING_PREVIEWS_TECHNICAL_PASS"
        or provenance.get("runtimePromotionAllowed") is not False
        or provenance.get("aiStatus") != "UNVERIFIED"
        or provenance.get("humanSemanticStatus") != "UNVERIFIED"
        or provenance.get("rightsLegalStatus") != "UNVERIFIED"
        or provenance.get("specSha256") != _sha256_file(SPEC_PATH)
        or provenance.get("rightsLedgerSha256") != _sha256_file(RIGHTS_LEDGER)
        or provenance.get("previewCount") != 18
        or not isinstance(provenance.get("previews"), list)
    ):
        raise CandidateVerificationError("preview provenance boundary mismatch")
    if (
        qc.get("schemaVersion") != 1
        or qc.get("status") != "PASS"
        or qc.get("previewCount") != 18
        or not isinstance(qc.get("rows"), list)
    ):
        raise CandidateVerificationError("preview QC boundary mismatch")
    rights_rows = _load_rights_rows()
    records = [_record_from_json(row, root) for row in provenance["previews"]]
    if tuple(record.candidate_id for record in records) != expected_ids:
        raise CandidateVerificationError("preview candidate order mismatch")
    verified_qc = []
    for record in records:
        rights_row = rights_rows[record.candidate_id]
        if record.source_sha256 != rights_row["sourceSha256"]:
            raise CandidateVerificationError("preview source hash chain mismatch")
        verified_qc.append(verify_preview(record, _resolve_source(rights_row)))
    if qc["rows"] != verified_qc:
        raise CandidateVerificationError("stored preview QC does not match verification")
    return {
        "status": "PASS",
        "previewCount": 18,
        "sourceFrameBytesEqual": True,
        "runtimePromotionAllowed": False,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Verify the fixed source-preserving Hyperfocus v2 preview package."
    )
    parser.parse_args(argv)
    result = verify_raw_preview_package()
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
