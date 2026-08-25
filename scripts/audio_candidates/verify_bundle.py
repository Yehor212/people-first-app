from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from scripts.audio_review.verify import verify_hash_inventory

from .ai import OUTPUT_ROOT as AI_ROOT
from .blind import BLIND_LABELS, _bundle_hash, _permutation
from .build import OUTPUT_ROOT, REPOSITORY_ROOT, TRACKED_INPUTS
from .build_previews import (
    OUTPUT_ROOT as RAW_PREVIEW_ROOT,
    RIGHTS_LEDGER,
    SPEC_PATH,
)
from .model import EXACT_FAMILIES, load_candidate_spec


class BundleVerificationError(RuntimeError):
    pass


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _json(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise BundleVerificationError(f"unreadable JSON: {path.name}") from exc
    if not isinstance(value, dict):
        raise BundleVerificationError(f"JSON root is not an object: {path.name}")
    return value


def verify_source_audition_bundle() -> dict:
    root = OUTPUT_ROOT
    inventory = verify_hash_inventory(root)
    expected_listen = {
        f"listen/{family}-{label}.wav"
        for family in EXACT_FAMILIES
        for label in BLIND_LABELS
    } | {"listen/SOURCE_REVIEW.md"}
    actual_listen = {relative for relative in inventory if relative.startswith("listen/")}
    if actual_listen != expected_listen:
        raise BundleVerificationError("public listen inventory mismatch")
    public_text = (root / "listen/SOURCE_REVIEW.md").read_text(encoding="utf-8")
    for forbidden in (
        "BigSoundBank",
        "incumbent",
        "source title",
        "candidate",
        "-c1",
        "-c2",
        "-c3",
    ):
        if forbidden.lower() in public_text.lower():
            raise BundleVerificationError("public listening instructions leak identity")

    blind_map = _json(root / "blind-map.json")
    source_review = _json(root / "source-review.json")
    listen_manifest = _json(root / "listen-manifest.json")
    environment = _json(root / "build-environment.json")
    provenance = _json(root / "preview-provenance.json")
    qc = _json(root / "preview-qc.json")
    rights = _json(root / "rights-ledger.json")
    if (
        blind_map.get("schemaVersion") != 1
        or blind_map.get("status") != "PRIVATE_SEALED_MAPPING"
        or not isinstance(blind_map.get("seedHex"), str)
        or not isinstance(blind_map.get("mapping"), list)
        or len(blind_map["mapping"]) != 18
    ):
        raise BundleVerificationError("blind map boundary mismatch")
    try:
        seed = bytes.fromhex(blind_map["seedHex"])
    except ValueError as exc:
        raise BundleVerificationError("blind seed is invalid") from exc
    if len(seed) != 32 or blind_map.get("seedSha256") != hashlib.sha256(seed).hexdigest():
        raise BundleVerificationError("blind seed hash mismatch")

    spec = load_candidate_spec(SPEC_PATH)
    preview_by_id = {row["candidateId"]: row for row in provenance.get("previews", [])}
    rights_by_id = {row["candidateId"]: row for row in rights.get("candidates", [])}
    mapping_by_key = {
        (row.get("family"), row.get("blindId")): row for row in blind_map["mapping"]
    }
    if len(mapping_by_key) != 18:
        raise BundleVerificationError("blind mapping keys are not unique")
    listen_rows = []
    for family in EXACT_FAMILIES:
        candidate_ids = [f"{family}-c{position}" for position in (1, 2, 3)]
        permutation = _permutation(seed, family)
        for blind_index, source_index in enumerate(permutation):
            label = BLIND_LABELS[blind_index]
            candidate_id = candidate_ids[source_index]
            row = mapping_by_key.get((family, label))
            preview = preview_by_id.get(candidate_id)
            rights_row = rights_by_id.get(candidate_id)
            relative = f"listen/{family}-{label}.wav"
            if (
                row is None
                or preview is None
                or rights_row is None
                or row.get("candidateId") != candidate_id
                or row.get("sourceSha256") != rights_row.get("sourceSha256")
                or row.get("previewSha256") != preview.get("previewSha256")
                or row.get("listenPath") != relative
                or row.get("listenSha256") != inventory.get(relative)
                or row.get("listenSha256") != preview.get("previewSha256")
            ):
                raise BundleVerificationError("blind mapping hash chain mismatch")
            listen_rows.append(
                {
                    "family": family,
                    "blindId": label,
                    "path": relative,
                    "sha256": row["listenSha256"],
                }
            )
    bundle_sha = _bundle_hash(listen_rows)
    if (
        blind_map.get("bundleSha256") != bundle_sha
        or listen_manifest.get("bundleSha256") != bundle_sha
        or source_review.get("bundleSha256") != bundle_sha
        or source_review.get("status") != "PENDING_OWNER_SOURCE_REVIEW"
        or source_review.get("runtimePromotionAllowed") is not False
        or listen_manifest.get("status") != "PENDING_OWNER_SOURCE_REVIEW"
        or listen_manifest.get("runtimePromotionAllowed") is not False
    ):
        raise BundleVerificationError("source review boundary mismatch")
    if listen_manifest.get("files") != [
        {"path": row["path"], "sha256": row["sha256"]} for row in listen_rows
    ]:
        raise BundleVerificationError("listen manifest mismatch")

    if _sha256_file(root / "rights-ledger.json") != _sha256_file(RIGHTS_LEDGER):
        raise BundleVerificationError("rights ledger copy mismatch")
    for name in ("preview-provenance.json", "preview-qc.json"):
        if _sha256_file(root / name) != _sha256_file(RAW_PREVIEW_ROOT / name):
            raise BundleVerificationError("preview evidence copy mismatch")
    verify_hash_inventory(root / "ai")
    if _sha256_file(root / "ai/SHA256SUMS") != _sha256_file(AI_ROOT / "SHA256SUMS"):
        raise BundleVerificationError("AI evidence copy mismatch")
    if (
        qc.get("status") != "PASS"
        or rights.get("status")
        != "RIGHTS_EVIDENCE_CAPTURED_TECHNICAL_PASS_LEGAL_UNVERIFIED"
        or environment.get("status") != "REVIEW_ONLY"
        or environment.get("runtimePromotionAllowed") is not False
        or environment.get("rightsLedgerSha256") != _sha256_file(RIGHTS_LEDGER)
        or environment.get("rawPreviewInventorySha256")
        != _sha256_file(RAW_PREVIEW_ROOT / "SHA256SUMS")
        or environment.get("aiEvidenceInventorySha256")
        != _sha256_file(AI_ROOT / "SHA256SUMS")
    ):
        raise BundleVerificationError("private evidence boundary mismatch")
    tracked = environment.get("trackedInputs")
    expected_tracked = [
        {"path": relative, "sha256": _sha256_file(REPOSITORY_ROOT / relative)}
        for relative in TRACKED_INPUTS
    ]
    if tracked != expected_tracked:
        raise BundleVerificationError("tracked build input hash mismatch")
    if tuple(spec.families) != EXACT_FAMILIES:
        raise BundleVerificationError("candidate spec family drift")
    return {
        "status": "PASS",
        "listenFileCount": 18,
        "bundleSha256": bundle_sha,
        "aiStatus": "TRIAL_ONLY_NOT_ADMITTED",
        "humanStatus": "PENDING_OWNER_SOURCE_REVIEW",
        "rightsLegalStatus": "UNVERIFIED",
        "runtimePromotionAllowed": False,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Verify the fixed blind Hyperfocus source audition bundle."
    )
    parser.parse_args(argv)
    result = verify_source_audition_bundle()
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
