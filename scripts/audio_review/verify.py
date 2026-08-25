from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess

from .model import load_spec
from .quarantine import (
    DENYLIST_REPOSITORY_PATH,
    QuarantineError,
    assert_not_quarantined,
    default_denylist_path,
    load_denylist,
)
from .review import ALLOWED_DECISIONS, ReviewError, compute_audio_fit, record_decision
from .rights import RIGHTS_EVIDENCE_STATUS, RIGHTS_LEGAL_BOUNDARY

class VerificationError(RuntimeError):
    pass


def _sha(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_package_member(root: Path, relative: str) -> Path:
    if not isinstance(relative, str) or not relative or "\\" in relative or "\x00" in relative:
        raise VerificationError(f"UNSAFE_PACKAGE_PATH:{relative}")
    raw_parts = relative.split("/")
    pure = PurePosixPath(relative)
    if (
        pure.is_absolute()
        or not pure.parts
        or any(part in {"", ".", ".."} for part in raw_parts)
        or relative == "SHA256SUMS"
    ):
        raise VerificationError(f"UNSAFE_PACKAGE_PATH:{relative}")
    try:
        resolved_root = root.resolve(strict=True)
    except OSError as exc:
        raise VerificationError(f"MISSING_PACKAGE_ROOT:{root}") from exc
    candidate = root.joinpath(*pure.parts)
    cursor = root
    for part in pure.parts[:-1]:
        cursor = cursor / part
        try:
            info = cursor.lstat()
        except OSError as exc:
            raise VerificationError(f"MISSING_FILE:{relative}") from exc
        if stat.S_ISLNK(info.st_mode):
            raise VerificationError(f"SYMLINKED_PACKAGE_MEMBER:{relative}")
        if not stat.S_ISDIR(info.st_mode):
            raise VerificationError(f"MISSING_FILE:{relative}")
    try:
        resolved_parent = candidate.parent.resolve(strict=True)
    except OSError as exc:
        raise VerificationError(f"MISSING_FILE:{relative}") from exc
    if resolved_root != resolved_parent and resolved_root not in resolved_parent.parents:
        raise VerificationError(f"UNSAFE_PACKAGE_PATH:{relative}")
    try:
        info = candidate.lstat()
    except OSError as exc:
        raise VerificationError(f"MISSING_FILE:{relative}") from exc
    if stat.S_ISLNK(info.st_mode) or not stat.S_ISREG(info.st_mode):
        raise VerificationError(f"SYMLINKED_PACKAGE_MEMBER:{relative}")
    return candidate


def verify_hash_inventory(root: str | Path) -> dict[str, str]:
    root = Path(root)
    sums = root / "SHA256SUMS"
    if sums.is_symlink():
        raise VerificationError("SYMLINKED_PACKAGE_MEMBER:SHA256SUMS")
    try:
        sums_info = sums.lstat()
    except OSError as exc:
        raise VerificationError("MISSING_SHA256SUMS") from exc
    if not stat.S_ISREG(sums_info.st_mode):
        raise VerificationError("MISSING_SHA256SUMS")
    expected: dict[str, str] = {}
    for line in sums.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        match = re.fullmatch(r"([0-9a-f]{64})  (.+)", line)
        if not match:
            raise VerificationError(f"INVALID_SHA256SUMS_LINE:{line}")
        digest, relative = match.groups()
        if relative in expected:
            raise VerificationError(f"DUPLICATE_SHA256SUMS_PATH:{relative}")
        path = safe_package_member(root, relative)
        actual = _sha(path)
        if actual != digest:
            raise VerificationError(f"HASH_MISMATCH:{relative}")
        expected[relative] = digest
    actual_files: set[str] = set()
    for path in root.rglob("*"):
        relative = path.relative_to(root).as_posix()
        try:
            info = path.lstat()
        except OSError as exc:
            raise VerificationError(f"MISSING_FILE:{relative}") from exc
        if stat.S_ISLNK(info.st_mode):
            raise VerificationError(f"SYMLINKED_PACKAGE_MEMBER:{relative}")
        if stat.S_ISDIR(info.st_mode):
            continue
        if not stat.S_ISREG(info.st_mode):
            raise VerificationError(f"SYMLINKED_PACKAGE_MEMBER:{relative}")
        if relative != "SHA256SUMS":
            actual_files.add(relative)
    expected_files = set(expected)
    missing = sorted(expected_files - actual_files)
    if missing:
        raise VerificationError(f"PACKAGE_INVENTORY_MISMATCH:missing={missing}:extra=[]")
    extra = sorted(actual_files - expected_files)
    if extra:
        raise VerificationError(f"UNLISTED_PACKAGE_FILE:{extra[0]}:extra={extra}")
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


def verify_human_review(human: dict, provenance: dict) -> str:
    if not isinstance(human, dict) or not isinstance(provenance, dict):
        raise VerificationError("HUMAN_REVIEW_BOUNDARY_INVALID")
    human_rows = human.get("assets")
    provenance_rows = provenance.get("assets")
    platforms = human.get("platforms")
    expected_platforms = {
        "web-vite",
        "installed-pwa",
        "android-capacitor",
        "ios-wkwebview",
        "desktop-tauri",
    }
    if (
        not isinstance(human_rows, list)
        or len(human_rows) != 26
        or not isinstance(provenance_rows, list)
        or len(provenance_rows) != 26
        or human.get("promotionAllowed") is not False
        or human.get("runtimeStatus") != "UNVERIFIED"
        or not isinstance(platforms, dict)
        or set(platforms) != expected_platforms
        or any(value != "UNVERIFIED" for value in platforms.values())
    ):
        raise VerificationError("HUMAN_REVIEW_BOUNDARY_INVALID")
    provenance_by_id: dict[str, dict] = {}
    for row in provenance_rows:
        if not isinstance(row, dict) or not isinstance(row.get("id"), str):
            raise VerificationError("HUMAN_REVIEW_BOUNDARY_INVALID")
        if row["id"] in provenance_by_id:
            raise VerificationError("HUMAN_REVIEW_BOUNDARY_INVALID")
        provenance_by_id[row["id"]] = row
    if len(provenance_by_id) != 26:
        raise VerificationError("HUMAN_REVIEW_BOUNDARY_INVALID")
    seen: set[str] = set()
    reviewed_count = 0
    for row in human_rows:
        if not isinstance(row, dict):
            raise VerificationError("HUMAN_REVIEW_BOUNDARY_INVALID")
        asset_id = row.get("id")
        if not isinstance(asset_id, str) or asset_id in seen:
            raise VerificationError("HUMAN_REVIEW_BOUNDARY_INVALID")
        provenance_row = provenance_by_id.get(asset_id)
        if provenance_row is None:
            raise VerificationError("HUMAN_REVIEW_BOUNDARY_INVALID")
        seen.add(asset_id)
        kind = provenance_row.get("kind")
        expected_minutes = 10 if kind in {"hyperfocus", "ambience"} else 0
        required_contexts = row.get("requiredListenOn")
        if (
            not isinstance(required_contexts, (list, tuple, set))
            or any(not isinstance(context, str) for context in required_contexts)
        ):
            raise VerificationError("HUMAN_REVIEW_BOUNDARY_INVALID")
        if (
            row.get("kind") != kind
            or row.get("relativePath") != provenance_row.get("relativePath")
            or row.get("sha256") != provenance_row.get("sha256")
            or row.get("promotionScope") is not (kind == "hyperfocus")
            or row.get("minimumLoopMinutes") != expected_minutes
            or set(required_contexts) != {"headphones", "built-in-speaker"}
        ):
            raise VerificationError(f"HUMAN_REVIEW_HASH_MISMATCH:{asset_id}")
        decision = row.get("decision")
        if decision == "PENDING":
            if row.get("listenOn") not in ([], None):
                raise VerificationError("HUMAN_REVIEW_BOUNDARY_INVALID")
            continue
        if decision not in ALLOWED_DECISIONS:
            raise VerificationError("HUMAN_REVIEW_BOUNDARY_INVALID")
        try:
            record_decision(
                row,
                reviewer=row.get("reviewer", ""),
                decision=decision,
                minutes=row.get("attestedMinutes", -1),
                contexts=row.get("listenOn", []),
                reasons=row.get("rejectReasons", []),
                reviewed_at=row.get("reviewedAt", ""),
            )
        except ReviewError as exc:
            raise VerificationError(
                f"HUMAN_REVIEW_ATTESTATION_INVALID:{asset_id}"
            ) from exc
        reviewed_count += 1
    status = human.get("status")
    audio_fit = compute_audio_fit(human, provenance)
    if status == "PENDING_HUMAN_REVIEW":
        if reviewed_count != 0 or human.get("audioFit") is not None:
            raise VerificationError("HUMAN_REVIEW_BOUNDARY_INVALID")
    elif status == "HUMAN_REVIEW_IN_PROGRESS":
        if reviewed_count == 0 or audio_fit["pass"] or human.get("audioFit") != audio_fit:
            raise VerificationError("HUMAN_REVIEW_BOUNDARY_INVALID")
    elif status == "AUDIO_FIT_PASS_RUNTIME_UNVERIFIED":
        if not audio_fit["pass"] or human.get("audioFit") != audio_fit:
            raise VerificationError("HUMAN_REVIEW_BOUNDARY_INVALID")
    else:
        raise VerificationError("HUMAN_REVIEW_BOUNDARY_INVALID")
    return status


def verify_mp3s_not_quarantined(
    root: str | Path,
    relative_paths: set[str],
    denylist: frozenset[str],
) -> None:
    root = Path(root)
    for relative in sorted(relative_paths):
        try:
            assert_not_quarantined(
                (root / relative).read_bytes(),
                f"package:{relative}",
                denylist,
            )
        except QuarantineError as exc:
            raise VerificationError(str(exc)) from exc


def _mp3_magic(path: Path) -> bool:
    data = path.read_bytes()[:4096]
    if data.startswith(b"ID3"):
        return True
    return any(data[index] == 0xFF and (data[index + 1] & 0xE0) == 0xE0 for index in range(max(0, len(data) - 1)))


def verify_package(
    package_dir: str | Path,
    spec_path: str | Path,
    *,
    ffprobe_path: str | None = None,
    denylist_path: str | Path | None = None,
) -> dict:
    root = Path(package_dir)
    spec = load_spec(spec_path)
    denylist_source = Path(denylist_path) if denylist_path is not None else default_denylist_path()
    denylist = load_denylist(denylist_source)
    denylist_sha256 = _sha(denylist_source)
    inventory = verify_hash_inventory(root)
    expected_paths = {asset.relative_path for asset in spec.all_assets}
    if {path for path in inventory if path.endswith(".mp3")} != expected_paths:
        raise VerificationError("AUDIO_INVENTORY_MISMATCH")
    verify_mp3s_not_quarantined(root, expected_paths, denylist)
    for relative in sorted(expected_paths):
        if not _mp3_magic(root / relative):
            raise VerificationError(f"INVALID_MP3_SIGNATURE:{relative}")

    provenance = json.loads((root / "provenance.json").read_text(encoding="utf-8"))
    qc = json.loads((root / "qc-report.json").read_text(encoding="utf-8"))
    human = json.loads((root / "human-review.json").read_text(encoding="utf-8"))
    build_environment = json.loads((root / "build-environment.json").read_text(encoding="utf-8"))
    if provenance.get("status") != "REVIEW_ONLY" or provenance.get("runtimePromotionAllowed") is not False:
        raise VerificationError("PACKAGE_IS_NOT_REVIEW_ONLY")
    assets = provenance.get("assets") or []
    if len(assets) != 26 or {row["id"] for row in assets} != {asset.id for asset in spec.all_assets}:
        raise VerificationError("PROVENANCE_INVENTORY_MISMATCH")
    for row in assets:
        if inventory.get(row["relativePath"]) != row["sha256"]:
            raise VerificationError(f"PROVENANCE_HASH_MISMATCH:{row['id']}")
    expected_denylist_attestation = {
        "path": DENYLIST_REPOSITORY_PATH,
        "sha256": denylist_sha256,
        "entries": len(denylist),
    }
    if (
        provenance.get("quarantineDenylist") != expected_denylist_attestation
        or build_environment.get("quarantineDenylist") != expected_denylist_attestation
    ):
        raise VerificationError("QUARANTINE_DENYLIST_PROVENANCE_MISMATCH")
    git_sha = build_environment.get("gitSha")
    source_head_sha = build_environment.get("sourceHeadSha")
    workflow_event_sha = build_environment.get("workflowEventSha")
    if (
        not isinstance(git_sha, str)
        or re.fullmatch(r"[0-9a-f]{40}", git_sha) is None
        or source_head_sha != git_sha
        or not isinstance(workflow_event_sha, str)
        or re.fullmatch(r"[0-9a-f]{40}", workflow_event_sha) is None
    ):
        raise VerificationError("BUILD_SOURCE_HEAD_MISMATCH")

    unique_numbers = {asset.source.sound_number for asset in spec.hyperfocus if asset.source}
    source_count = verify_rights_evidence(root, inventory, unique_numbers)

    qc_rows = qc.get("assets") or []
    if len(qc_rows) != 26 or not all(row.get("objectiveStatus") == "PASS" for row in qc_rows):
        raise VerificationError("OBJECTIVE_QC_NOT_PASS")
    human_status = verify_human_review(human, provenance)

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
    package_status = {
        "PENDING_HUMAN_REVIEW": "TECHNICAL_PASS_HUMAN_PENDING",
        "HUMAN_REVIEW_IN_PROGRESS": "TECHNICAL_PASS_HUMAN_REVIEW_IN_PROGRESS",
        "AUDIO_FIT_PASS_RUNTIME_UNVERIFIED": "TECHNICAL_PASS_AUDIO_FIT_RUNTIME_PENDING",
    }[human_status]
    return {"status": package_status, "assetCount": 26, "sourceCount": source_count, "humanReview": human_status}


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", required=True)
    parser.add_argument("--package", required=True)
    args = parser.parse_args(argv)
    print(json.dumps(verify_package(args.package, args.spec), indent=2, sort_keys=True))

if __name__ == "__main__":
    main()
