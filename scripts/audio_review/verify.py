from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess

from .model import load_spec

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
    rights = json.loads((root / "rights-ledger.json").read_text(encoding="utf-8"))
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
    records = rights.get("sources") or []
    if {int(row["sound_number"]) for row in records} != unique_numbers:
        raise VerificationError("RIGHTS_SOURCE_COVERAGE_MISMATCH")
    for row in records:
        if row.get("license_id") != "CC0-1.0" or not all((row.get("rights_evidence") or {}).values()):
            raise VerificationError(f"RIGHTS_NOT_CLEARED:{row.get('sound_number')}")

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
    return {"status": "TECHNICAL_PASS_HUMAN_PENDING", "assetCount": 26, "sourceCount": len(records), "humanReview": human["status"]}


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", required=True)
    parser.add_argument("--package", required=True)
    args = parser.parse_args(argv)
    print(json.dumps(verify_package(args.package, args.spec), indent=2, sort_keys=True))

if __name__ == "__main__":
    main()
