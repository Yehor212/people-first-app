from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess

from .model import load_spec
from .rights import RIGHTS_EVIDENCE_STATUS, RIGHTS_LEGAL_BOUNDARY

class VerificationError(RuntimeError):
    pass


def _sha(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_hash_inventory(root: str | Path) -> dict[str, str]:
    root = Path(root)
    sums = root / "SHA256SUMS"
    if not sums.is_file():
        raise VerificationError("MISSING_SHA256SUMS")
    expected: dict[str, str] = {}
    for line in sums.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        match = re.fullmatch(r"([0-9a-f]{64})  ([^\\]+)", line)
        if not match:
            raise VerificationError(f"INVALID_SHA256SUMS_LINE:{line}")
        digest, relative = match.groups()
        path = root / relative
        if not path.is_file():
            raise VerificationError(f"MISSING_FILE:{relative}")
        actual = _sha(path)
        if actual != digest:
            raise VerificationError(f"HASH_MISMATCH:{relative}")
        expected[relative] = digest
    return expected


def verify_rights_evidence(
    root: str | Path,
    inventory: dict[str, str],
    expected_numbers: set[int],
) -> int:
    root = Path(root)

    def fail(detail: str) -> None:
        raise VerificationError(f"RIGHTS_EVIDENCE_INCOMPLETE:{detail}")

    if "rights-ledger.json" not in inventory:
        fail("rights-ledger.json")
    try:
        rights = json.loads((root / "rights-ledger.json").read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise VerificationError("RIGHTS_EVIDENCE_INCOMPLETE:rights-ledger.json") from exc
    if (
        not isinstance(rights, dict)
        or rights.get("schemaVersion") != 1
        or rights.get("status") != RIGHTS_EVIDENCE_STATUS
        or rights.get("canonicalLicense") != "CC0-1.0"
        or rights.get("legalBoundary") != RIGHTS_LEGAL_BOUNDARY
    ):
        fail("ledger-boundary")
    sources = rights.get("sources")
    receipts = rights.get("receipts")
    if not isinstance(sources, list) or not isinstance(receipts, list):
        fail("ledger-rows")

    def index_rows(rows: list, key: str, label: str) -> dict[int, dict]:
        indexed: dict[int, dict] = {}
        for row in rows:
            if not isinstance(row, dict):
                fail(f"{label}-row")
            number = row.get(key)
            if not isinstance(number, int) or isinstance(number, bool) or number in indexed:
                fail(f"{label}-sound-number")
            indexed[number] = row
        return indexed

    source_by_number = index_rows(sources, "sound_number", "source")
    receipt_by_number = index_rows(receipts, "soundNumber", "receipt")
    if set(source_by_number) != expected_numbers or set(receipt_by_number) != expected_numbers:
        fail("source-coverage")

    rights_keys = {"cc0", "distribution", "adaptation", "commercial"}
    for number in sorted(expected_numbers):
        source = source_by_number[number]
        receipt = receipt_by_number[number]
        if any(
            key in source
            for key in ("local_path", "source_page_snapshot", "license_page_snapshot")
        ):
            fail(f"private-source-fields:{number}")
        evidence = source.get("rights_evidence")
        author = source.get("author")
        if (
            source.get("license_id") != "CC0-1.0"
            or not isinstance(evidence, dict)
            or set(evidence) != rights_keys
            or any(value is not True for value in evidence.values())
            or not isinstance(author, str)
            or not author.strip()
            or author == "Not stated on parsed page"
        ):
            fail(f"source:{number}")
        if (
            receipt.get("schemaVersion") != 1
            or receipt.get("soundNumber") != number
            or receipt.get("title") != source.get("title")
            or receipt.get("author") != author
            or receipt.get("acquiredAt") != source.get("acquired_at")
            or receipt.get("licenseId") != source.get("license_id")
            or receipt.get("rightsEvidence") != evidence
            or receipt.get("legalBoundary") != RIGHTS_LEGAL_BOUNDARY
        ):
            fail(f"receipt:{number}")
        receipt_relative = f"evidence/rights/s{number:04d}/receipt.json"
        if receipt_relative not in inventory:
            fail(receipt_relative)
        try:
            stored_receipt = json.loads(
                (root / receipt_relative).read_text(encoding="utf-8")
            )
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise VerificationError(
                f"RIGHTS_EVIDENCE_INCOMPLETE:{receipt_relative}"
            ) from exc
        if stored_receipt != receipt:
            fail(f"receipt-ledger-mismatch:{number}")

        snapshot_fields = (
            (
                "sourcePage",
                "source-page.html",
                "source_page_url",
                "source_page_sha256",
                "source_page_content_type",
                "source_page_redirect_chain",
            ),
            (
                "licensePage",
                "license-page.html",
                "license_url",
                "license_page_sha256",
                "license_page_content_type",
                "license_page_redirect_chain",
            ),
        )
        for (
            section_name,
            filename,
            url_key,
            hash_key,
            content_type_key,
            redirects_key,
        ) in snapshot_fields:
            section = receipt.get(section_name)
            relative = f"evidence/rights/s{number:04d}/{filename}"
            if (
                not isinstance(section, dict)
                or section.get("artifactPath") != relative
                or section.get("url") != source.get(url_key)
                or section.get("sha256") != source.get(hash_key)
                or inventory.get(relative) != source.get(hash_key)
                or section.get("contentType") != source.get(content_type_key)
                or section.get("redirectChain") != source.get(redirects_key)
            ):
                fail(f"{section_name}:{number}")
            try:
                snapshot_bytes = (root / relative).stat().st_size
            except OSError as exc:
                raise VerificationError(
                    f"RIGHTS_EVIDENCE_INCOMPLETE:{relative}"
                ) from exc
            if section.get("bytes") != snapshot_bytes:
                fail(f"{section_name}-bytes:{number}")

        audio = receipt.get("audio")
        if (
            not isinstance(audio, dict)
            or audio.get("url") != source.get("audio_url")
            or audio.get("sha256") != source.get("source_sha256")
            or audio.get("bytes") != source.get("source_bytes")
            or audio.get("contentType") != source.get("audio_content_type")
            or audio.get("redirectChain") != source.get("audio_redirect_chain")
            or audio.get("includedInReviewArtifact") is not False
            or "artifactPath" in audio
        ):
            fail(f"audio-boundary:{number}")
    return len(source_by_number)


def _mp3_magic(path: Path) -> bool:
    data = path.read_bytes()[:4096]
    if data.startswith(b"ID3"):
        return True
    return any(data[index] == 0xFF and (data[index + 1] & 0xE0) == 0xE0 for index in range(max(0, len(data) - 1)))


def verify_package(package_dir: str | Path, spec_path: str | Path, *, ffprobe_path: str | None = None) -> dict:
    root = Path(package_dir)
    spec = load_spec(spec_path)
    inventory = verify_hash_inventory(root)
    expected_paths = {asset.relative_path for asset in spec.all_assets}
    if {path for path in inventory if path.endswith(".mp3")} != expected_paths:
        raise VerificationError("AUDIO_INVENTORY_MISMATCH")
    for relative in sorted(expected_paths):
        if not _mp3_magic(root / relative):
            raise VerificationError(f"INVALID_MP3_SIGNATURE:{relative}")

    provenance = json.loads((root / "provenance.json").read_text(encoding="utf-8"))
    qc = json.loads((root / "qc-report.json").read_text(encoding="utf-8"))
    human = json.loads((root / "human-review.json").read_text(encoding="utf-8"))
    if provenance.get("status") != "REVIEW_ONLY" or provenance.get("runtimePromotionAllowed") is not False:
        raise VerificationError("PACKAGE_IS_NOT_REVIEW_ONLY")
    assets = provenance.get("assets") or []
    if len(assets) != 26 or {row["id"] for row in assets} != {asset.id for asset in spec.all_assets}:
        raise VerificationError("PROVENANCE_INVENTORY_MISMATCH")
    for row in assets:
        if inventory.get(row["relativePath"]) != row["sha256"]:
            raise VerificationError(f"PROVENANCE_HASH_MISMATCH:{row['id']}")

    unique_numbers = {asset.source.sound_number for asset in spec.hyperfocus if asset.source}
    source_count = verify_rights_evidence(root, inventory, unique_numbers)

    qc_rows = qc.get("assets") or []
    if len(qc_rows) != 26 or not all(row.get("objectiveStatus") == "PASS" for row in qc_rows):
        raise VerificationError("OBJECTIVE_QC_NOT_PASS")
    human_rows = human.get("assets") or []
    if len(human_rows) != 26 or human.get("promotionAllowed") is not False or human.get("status") != "PENDING_HUMAN_REVIEW":
        raise VerificationError("HUMAN_REVIEW_BOUNDARY_INVALID")
    hash_by_id = {row["id"]: row["sha256"] for row in assets}
    for row in human_rows:
        if hash_by_id.get(row["id"]) != row["sha256"]:
            raise VerificationError(f"HUMAN_REVIEW_HASH_MISMATCH:{row['id']}")

    ffprobe = ffprobe_path or shutil.which("ffprobe")
    if not ffprobe:
        raise VerificationError("FFPROBE_MISSING")
    for asset in spec.all_assets:
        command = [ffprobe, "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=sample_rate,channels", "-of", "json", str(root / asset.relative_path)]
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if result.returncode != 0:
            raise VerificationError(f"FFPROBE_FAILED:{asset.id}:{result.stderr.strip()}")
        streams = json.loads(result.stdout).get("streams") or []
        if len(streams) != 1 or int(streams[0].get("sample_rate", 0)) != 48000 or int(streams[0].get("channels", 0)) != 2:
            raise VerificationError(f"AUDIO_CONTRACT_MISMATCH:{asset.id}")
    return {"status": "TECHNICAL_PASS_HUMAN_PENDING", "assetCount": 26, "sourceCount": source_count, "humanReview": human["status"]}


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", required=True)
    parser.add_argument("--package", required=True)
    args = parser.parse_args(argv)
    print(json.dumps(verify_package(args.package, args.spec), indent=2, sort_keys=True))

if __name__ == "__main__":
    main()
