from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import platform
import secrets
import shutil
import subprocess
import tempfile

import numpy as np

from scripts.audio_review.evidence import write_sha256sums

from .ai import OUTPUT_ROOT as AI_ROOT, verify_source_ai_audit
from .blind import build_blind_bundle
from .build_previews import (
    OUTPUT_ROOT as RAW_PREVIEW_ROOT,
    RIGHTS_LEDGER,
    SPEC_PATH,
)
from .verify import _record_from_json, verify_raw_preview_package


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
PRIVATE_ROOT = Path(
    "/Users/yehor/Projects/ZenFlow/private-evidence/hyperfocus-v2"
)
OUTPUT_ROOT = PRIVATE_ROOT / "source-audition-v1"
TRACKED_INPUTS = (
    "config/audio/hyperfocus-source-candidates-v2.json",
    "config/audio/hyperfocus-semantic-audit-v2.json",
    "config/audio/hyperfocus-ai-models-v2.json",
    "config/audio/quarantine-denylist.json",
    "scripts/audio_candidates/ai.py",
    "scripts/audio_candidates/blind.py",
    "scripts/audio_candidates/build.py",
    "scripts/audio_candidates/build_previews.py",
    "scripts/audio_candidates/evidence.py",
    "scripts/audio_candidates/model.py",
    "scripts/audio_candidates/preview.py",
    "scripts/audio_candidates/rights.py",
    "scripts/audio_candidates/verify.py",
)


class BundleBuildError(RuntimeError):
    pass


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _write_json(path: Path, value: object) -> None:
    with path.open("x", encoding="utf-8") as stream:
        json.dump(value, stream, indent=2, sort_keys=True)
        stream.write("\n")


def _git_head() -> str:
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=REPOSITORY_ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
        env={"PATH": "/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin"},
    )
    value = result.stdout.strip()
    if result.returncode != 0 or len(value) != 40:
        raise BundleBuildError("unable to bind review bundle to Git HEAD")
    return value


def _build_environment() -> dict:
    inputs = []
    for relative in TRACKED_INPUTS:
        path = REPOSITORY_ROOT / relative
        if path.is_symlink() or not path.is_file():
            raise BundleBuildError(f"tracked build input is unavailable: {relative}")
        inputs.append({"path": relative, "sha256": _sha256_file(path)})
    return {
        "schemaVersion": 1,
        "status": "REVIEW_ONLY",
        "runtimePromotionAllowed": False,
        "builtAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "gitHead": _git_head(),
        "python": platform.python_version(),
        "platform": platform.platform(),
        "numpy": np.__version__,
        "trackedInputs": inputs,
        "rightsLedgerSha256": _sha256_file(RIGHTS_LEDGER),
        "rawPreviewInventorySha256": _sha256_file(
            RAW_PREVIEW_ROOT / "SHA256SUMS"
        ),
        "aiEvidenceInventorySha256": _sha256_file(AI_ROOT / "SHA256SUMS"),
    }


def _seal_contents_read_only(root: Path) -> None:
    for path in root.rglob("*"):
        if path.is_symlink():
            raise BundleBuildError(f"review bundle contains a symlink: {path}")
        if path.is_file():
            path.chmod(0o444)
    directories = sorted(
        (path for path in root.rglob("*") if path.is_dir()),
        key=lambda path: len(path.parts),
        reverse=True,
    )
    for path in directories:
        path.chmod(0o555)


def build_source_audition_bundle() -> Path:
    for path in (
        PRIVATE_ROOT,
        RAW_PREVIEW_ROOT,
        AI_ROOT,
        OUTPUT_ROOT,
    ):
        if path.is_symlink():
            raise BundleBuildError(f"symlinked private path is forbidden: {path}")
    if OUTPUT_ROOT.exists():
        raise BundleBuildError("source audition output already exists")
    verify_raw_preview_package(RAW_PREVIEW_ROOT)
    verify_source_ai_audit()
    provenance = json.loads(
        (RAW_PREVIEW_ROOT / "preview-provenance.json").read_text(
            encoding="utf-8"
        )
    )
    records = tuple(
        _record_from_json(row, RAW_PREVIEW_ROOT) for row in provenance["previews"]
    )
    PRIVATE_ROOT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(
        dir=PRIVATE_ROOT,
        prefix=".source-audition-v1.",
    ) as temporary_name:
        temporary = Path(temporary_name)
        staging = temporary / "package"
        bundle = build_blind_bundle(records, staging, secrets.token_bytes(32))
        shutil.copyfile(
            RAW_PREVIEW_ROOT / "preview-provenance.json",
            staging / "preview-provenance.json",
        )
        shutil.copyfile(
            RAW_PREVIEW_ROOT / "preview-qc.json",
            staging / "preview-qc.json",
        )
        shutil.copyfile(RIGHTS_LEDGER, staging / "rights-ledger.json")
        shutil.copytree(AI_ROOT, staging / "ai", copy_function=shutil.copyfile)
        _write_json(staging / "build-environment.json", _build_environment())
        _write_json(
            staging / "listen-manifest.json",
            {
                "schemaVersion": 1,
                "status": "PENDING_OWNER_SOURCE_REVIEW",
                "runtimePromotionAllowed": False,
                "bundleSha256": bundle.bundle_sha256,
                "files": [
                    {
                        "path": row["listenPath"],
                        "sha256": row["listenSha256"],
                    }
                    for row in bundle.mapping
                ],
            },
        )
        files = tuple(
            path
            for path in staging.rglob("*")
            if path.is_file()
            and path.relative_to(staging).as_posix() != "SHA256SUMS"
        )
        write_sha256sums(staging, files)
        _seal_contents_read_only(staging)
        staging.replace(OUTPUT_ROOT)
        OUTPUT_ROOT.chmod(0o555)
    return OUTPUT_ROOT


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Build the fixed blind Hyperfocus source audition bundle."
    )
    parser.parse_args(argv)
    output = build_source_audition_bundle()
    print(f"PASS: {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
