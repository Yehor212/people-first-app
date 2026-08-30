from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import tempfile

from .runtime_ai import OUTPUT_ROOT as AI_ROOT, verify_runtime_ai_audit
from .verify_runtime_masters import (
    OUTPUT_ROOT as MASTER_ROOT,
    verify_runtime_master_package,
)


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
PUBLIC_ROOT = REPOSITORY_ROOT / "public/sounds/hyperfocus"
RUNTIME_MANIFEST_PATH = REPOSITORY_ROOT / "docs/audio/hyperfocus-runtime-v2-manifest.json"
LEGACY_PROVENANCE_PATH = (
    REPOSITORY_ROOT / "docs/audio/hyperfocus-generated-audio-provenance.json"
)
TYPESCRIPT_MANIFEST_PATH = REPOSITORY_ROOT / "src/lib/hyperfocusGeneratedAudioManifest.ts"
ALLOWED_PUBLIC_FILES = {
    f"hyperfocus-{family}-{level}.mp3"
    for family in ("forest", "rain", "ocean", "fireplace", "river", "wind")
    for level in ("soft", "deep", "intense")
}


class RuntimePromotionError(RuntimeError):
    pass


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8") as stream:
        json.dump(payload, stream, indent=2, sort_keys=True)
        stream.write("\n")


def _render_typescript(entries: list[dict]) -> str:
    lines = [
        "export interface HyperfocusGeneratedAudioManifestEntry {",
        "  publicPath: string;",
        "  sha256: string;",
        "  bytes: number;",
        "  generatedAt: string;",
        "  provider?: string;",
        "  model?: string;",
        "  generationId?: string;",
        "  source?: string;",
        "}",
        "",
        "export const HYPERFOCUS_GENERATED_AUDIO_MANIFEST: Readonly<Record<string, HyperfocusGeneratedAudioManifestEntry>> = {",
    ]
    for entry in sorted(entries, key=lambda row: row["variantId"]):
        lines.extend(
            [
                f"  {json.dumps(entry['variantId'])}: {{",
                f"    publicPath: {json.dumps(entry['publicPath'])},",
                f"    sha256: {json.dumps(entry['sha256'])},",
                f"    bytes: {entry['bytes']},",
                f"    generatedAt: {json.dumps(entry['generatedAt'])},",
                f"    provider: {json.dumps(entry['provider'])},",
                f"    model: {json.dumps(entry['model'])},",
                f"    generationId: {json.dumps(entry['generationId'])},",
                f"    source: {json.dumps(entry['source'])},",
                "  },",
            ]
        )
    lines.extend(("};", ""))
    return "\n".join(lines)


def _build_payloads() -> tuple[dict, dict, str, dict[str, Path]]:
    master_result = verify_runtime_master_package()
    ai_result = verify_runtime_ai_audit()
    if master_result["status"] != "PASS" or ai_result["status"] != "PASS":
        raise RuntimePromotionError("private runtime evidence did not verify")
    master_manifest = json.loads(
        (MASTER_ROOT / "runtime-manifest.json").read_text(encoding="utf-8")
    )
    master_provenance = json.loads(
        (MASTER_ROOT / "provenance.json").read_text(encoding="utf-8")
    )
    build_environment = json.loads(
        (MASTER_ROOT / "build-environment.json").read_text(encoding="utf-8")
    )
    ai_report = json.loads(
        (AI_ROOT / "ai-audit-report.json").read_text(encoding="utf-8")
    )
    provenance_by_id = {
        row["variantId"]: row for row in master_provenance["assets"]
    }
    ai_by_id = {row["id"]: row for row in ai_report["assets"]}
    generated_at = build_environment["builtAt"]
    assets = []
    legacy_assets = {}
    source_files = {}
    ts_entries = []
    for row in master_manifest["assets"]:
        variant_id = row["variantId"]
        provenance = provenance_by_id[variant_id]
        ai = ai_by_id[variant_id]
        source = provenance["source"]
        file_name = row["fileName"]
        if file_name not in ALLOWED_PUBLIC_FILES:
            raise RuntimePromotionError(f"unapproved runtime file: {file_name}")
        source_file = MASTER_ROOT / "audio" / file_name
        if (
            source_file.is_symlink()
            or not source_file.is_file()
            or _sha256_file(source_file) != row["outputSha256"]
        ):
            raise RuntimePromotionError(f"runtime source hash mismatch: {file_name}")
        public_path = f"sounds/hyperfocus/{file_name}"
        source_text = (
            f"{source['title']} by {source['author']} "
            f"({source['sourcePageUrl']})"
        )
        generation_id = f"bigsoundbank-{row['candidateId']}-runtime-v2"
        asset = {
            "variantId": variant_id,
            "family": row["family"],
            "level": row["level"],
            "candidateId": row["candidateId"],
            "publicPath": public_path,
            "sha256": row["outputSha256"],
            "bytes": row["outputBytes"],
            "provider": "BigSoundBank / LaSonotheque",
            "model": "real-source-cc0-runtime-v2",
            "generationId": generation_id,
            "generatedAt": generated_at,
            "sourceTitle": source["title"],
            "author": source["author"],
            "soundNumber": source["soundNumber"],
            "sourcePageUrl": source["sourcePageUrl"],
            "licenseId": source["licenseId"],
            "licenseUrl": source["licenseUrl"],
            "sourceSha256": row["sourceSha256"],
            "previewSha256": row["previewSha256"],
            "basePcmSha256": row["basePcmSha256"],
            "masterPcmSha256": row["masterPcmSha256"],
            "operations": row["operations"],
            "assignmentMetrics": row["assignmentMetrics"],
            "decodedQc": row["decodedQc"],
            "aiStatus": "TRIAL_ONLY_NOT_ADMITTED",
            "aiVerdict": "ABSTAIN",
            "aiDiagnosticDisposition": ai["diagnostic"]["disposition"],
            "humanLoopReview": "UNVERIFIED",
            "rightsLegalStatus": "UNVERIFIED",
            "storeReleaseStatus": "STOP",
        }
        assets.append(asset)
        legacy_assets[variant_id] = {
            "fileName": file_name,
            "provider": asset["provider"],
            "model": asset["model"],
            "generationId": generation_id,
            "generatedAt": generated_at,
            "source": source_text,
            "sourceLicense": source["licenseUrl"],
            "publicSha256": row["outputSha256"],
            "bytes": row["outputBytes"],
            "audibleReview": {
                "status": "OWNER_ACCEPTED_SOURCE_SET_FINAL_LOOP_REVIEW_PENDING",
                "humanLoopReview": "UNVERIFIED",
            },
            "postProcessing": {
                "objectiveResult": "PASS",
                "policy": "cc0-reviewed-20s-to-periodic-30s-runtime-v2",
                "tool": "ZenFlow deterministic loop mastering plus private LAME 4.0 CBR 128 kbps",
                "runtimeManifest": "docs/audio/hyperfocus-runtime-v2-manifest.json",
                "aiStatus": "TRIAL_ONLY_NOT_ADMITTED",
                "externalEncoderSourceSecurityStatus": "FAIL_SCOPED_EXTERNAL_SOURCE",
            },
        }
        ts_entries.append(
            {
                "variantId": variant_id,
                "publicPath": public_path,
                "sha256": row["outputSha256"],
                "bytes": row["outputBytes"],
                "generatedAt": generated_at,
                "provider": asset["provider"],
                "model": asset["model"],
                "generationId": generation_id,
                "source": source_text,
            }
        )
        source_files[file_name] = source_file
    runtime_manifest = {
        "schemaVersion": 2,
        "status": "INTEGRATED_REVIEW_PENDING",
        "runtimePromotionAllowed": False,
        "assetCount": 18,
        "masterInventorySha256": _sha256_file(MASTER_ROOT / "SHA256SUMS"),
        "aiInventorySha256": _sha256_file(AI_ROOT / "SHA256SUMS"),
        "aiStatus": "TRIAL_ONLY_NOT_ADMITTED",
        "humanLoopReview": "UNVERIFIED",
        "rightsLegalStatus": "UNVERIFIED",
        "storeReleaseStatus": "STOP",
        "assets": assets,
    }
    legacy_provenance = {
        "version": "2026-08-25-cc0-runtime-v2",
        "decision": (
            "All 18 Hyperfocus runtime variants use source-specific BigSoundBank "
            "CC0 recordings, deterministic signal-intensity assignment, periodic "
            "loop mastering, and hash-bound technical evidence. Human long-loop, "
            "legal, store, and release decisions remain separate."
        ),
        "runtimeV2Manifest": "docs/audio/hyperfocus-runtime-v2-manifest.json",
        "assets": legacy_assets,
    }
    return runtime_manifest, legacy_provenance, _render_typescript(ts_entries), source_files


def promote_runtime() -> dict:
    runtime_manifest, legacy_provenance, typescript, source_files = _build_payloads()
    if set(source_files) != ALLOWED_PUBLIC_FILES:
        raise RuntimePromotionError("promotion requires exact 18-file public inventory")
    with tempfile.TemporaryDirectory(
        dir=MASTER_ROOT.parent,
        prefix=".runtime-promotion-v2.",
    ) as temporary_name:
        staging = Path(temporary_name) / "staging"
        staged_public = staging / "public"
        staged_public.mkdir(parents=True)
        for file_name, source in source_files.items():
            shutil.copyfile(source, staged_public / file_name)
        _write_json(staging / "runtime-manifest.json", runtime_manifest)
        _write_json(staging / "legacy-provenance.json", legacy_provenance)
        (staging / "manifest.ts").write_text(typescript, encoding="utf-8")
        for asset in runtime_manifest["assets"]:
            staged = staged_public / Path(asset["publicPath"]).name
            if _sha256_file(staged) != asset["sha256"]:
                raise RuntimePromotionError(
                    f"staged runtime hash mismatch: {asset['variantId']}"
                )
        targets = {
            **{
                PUBLIC_ROOT / file_name: staged_public / file_name
                for file_name in sorted(ALLOWED_PUBLIC_FILES)
            },
            RUNTIME_MANIFEST_PATH: staging / "runtime-manifest.json",
            LEGACY_PROVENANCE_PATH: staging / "legacy-provenance.json",
            TYPESCRIPT_MANIFEST_PATH: staging / "manifest.ts",
        }
        backup_root = Path(temporary_name) / "backup"
        backup_root.mkdir()
        backups = {}
        try:
            for index, (destination, source) in enumerate(targets.items()):
                if destination.is_symlink():
                    raise RuntimePromotionError(
                        f"promotion target may not be a symlink: {destination}"
                    )
                destination.parent.mkdir(parents=True, exist_ok=True)
                backup = backup_root / f"{index:03d}.bak"
                if destination.exists():
                    shutil.copyfile(destination, backup)
                    backups[destination] = backup
                temporary = destination.parent / f".{destination.name}.runtime-v2.tmp"
                if temporary.exists() or temporary.is_symlink():
                    raise RuntimePromotionError(
                        f"promotion temporary path already exists: {temporary}"
                    )
                shutil.copyfile(source, temporary)
                temporary.replace(destination)
        except Exception:
            for destination, backup in backups.items():
                shutil.copyfile(backup, destination)
            raise
    for asset in runtime_manifest["assets"]:
        public_file = REPOSITORY_ROOT / "public" / asset["publicPath"]
        if _sha256_file(public_file) != asset["sha256"]:
            raise RuntimePromotionError(
                f"promoted runtime hash mismatch: {asset['variantId']}"
            )
    return {
        "status": "PASS",
        "assetCount": 18,
        "runtimePromotionAllowed": False,
        "aiStatus": "TRIAL_ONLY_NOT_ADMITTED",
        "humanLoopReview": "UNVERIFIED",
        "storeReleaseStatus": "STOP",
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Promote the fixed verified Hyperfocus runtime master package."
    )
    parser.parse_args(argv)
    print(json.dumps(promote_runtime(), sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
