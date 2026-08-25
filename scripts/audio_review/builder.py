from __future__ import annotations

import argparse
from collections import defaultdict
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import uuid

from .dsp import decode_audio, encode_mp3, measure_audio, render_hyperfocus
from .evidence import build_human_review_matrix, file_sha256, write_sha256sums
from .model import AssetSpec, ReviewSpec, load_spec
from .procedural import generate_ambience, generate_feedback
from .rights import HttpClient, SourceRecord, SourceRequest, acquire_source
from .verify import verify_package

class BuildError(RuntimeError):
    pass


def _timestamp() -> str:
    epoch = os.environ.get("SOURCE_DATE_EPOCH")
    if epoch:
        return datetime.fromtimestamp(int(epoch), tz=timezone.utc).isoformat().replace("+00:00", "Z")
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _tool_version(command: list[str]) -> str:
    try:
        result = subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        return result.stdout.splitlines()[0][:500]
    except Exception as exc:
        return f"UNAVAILABLE: {exc}"


def _duration(asset: AssetSpec, cap: float | None) -> float:
    return min(asset.duration_seconds, cap) if cap is not None else asset.duration_seconds


def _seed(asset: AssetSpec, source_sha: str = "") -> int:
    payload = f"{asset.id}|{source_sha}|zenflow-cc0-review-v1".encode("utf-8")
    return int.from_bytes(hashlib.sha256(payload).digest()[:8], "big") & 0x7FFFFFFF


def _objective_status(asset: AssetSpec, metrics, expected_duration: float) -> tuple[str, list[str]]:
    failures: list[str] = []
    tolerance = 0.18 if expected_duration >= 1 else 0.12
    if metrics.sample_rate != 48000:
        failures.append("sample_rate")
    if metrics.channels != 2:
        failures.append("channels")
    if abs(metrics.duration_seconds - expected_duration) > tolerance:
        failures.append("duration")
    if metrics.peak_dbfs > -0.5:
        failures.append("peak")
    if metrics.true_peak_dbfs > -0.25:
        failures.append("true_peak")
    if metrics.dc_offset > 0.002:
        failures.append("dc_offset")
    if metrics.clipped_samples != 0:
        failures.append("clipping")
    if asset.kind in {"hyperfocus", "ambience"}:
        if metrics.seam_mean_abs_diff > 0.08:
            failures.append("loop_seam")
        if metrics.start_end_rms_delta_db > 8.0:
            failures.append("start_end_rms")
    return ("PASS" if not failures else "FAIL", failures)


def _atomic_promote(temp_dir: Path, output_dir: Path) -> None:
    backup = output_dir.with_name(output_dir.name + ".backup-" + uuid.uuid4().hex)
    had_existing = output_dir.exists()
    try:
        if had_existing:
            os.replace(output_dir, backup)
        os.replace(temp_dir, output_dir)
    except Exception:
        if output_dir.exists() and not had_existing:
            shutil.rmtree(output_dir, ignore_errors=True)
        if had_existing and backup.exists() and not output_dir.exists():
            os.replace(backup, output_dir)
        raise
    else:
        if backup.exists():
            shutil.rmtree(backup)


def _write_json(path: Path, payload: dict | list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")


def _render_source_assets(spec: ReviewSpec, records: dict[int, SourceRecord], temp_dir: Path, ffmpeg: str, duration_cap: float | None) -> tuple[list[dict], list[dict]]:
    assets_by_source: dict[int, list[AssetSpec]] = defaultdict(list)
    for asset in spec.hyperfocus:
        if not asset.source:
            raise BuildError(f"Missing source for {asset.id}")
        assets_by_source[asset.source.sound_number].append(asset)
    provenance: list[dict] = []
    qc: list[dict] = []
    for sound_number in sorted(assets_by_source):
        record = records[sound_number]
        source_pcm = decode_audio(record.local_path, ffmpeg, 48000, max_seconds=48.0)
        if len(source_pcm) < 4800:
            raise BuildError(f"Decoded source {sound_number} is too short")
        for asset in sorted(assets_by_source[sound_number], key=lambda row: row.id):
            duration = _duration(asset, duration_cap)
            seed = _seed(asset, record.source_sha256)
            pcm = render_hyperfocus(source_pcm, asset.family or "", asset.level or "", 48000, seed=seed, duration_seconds=duration)
            output = temp_dir / asset.relative_path
            encode_mp3(pcm, output, 48000, spec.audio_contract.bitrate_kbps, ffmpeg)
            digest = file_sha256(output)
            metrics = measure_audio(output, ffmpeg)
            status, failures = _objective_status(asset, metrics, duration)
            provenance.append({
                "id": asset.id,
                "kind": asset.kind,
                "relativePath": asset.relative_path,
                "sha256": digest,
                "bytes": output.stat().st_size,
                "durationSecondsRequested": duration,
                "source": {
                    "provider": asset.source.provider,
                    "soundNumber": sound_number,
                    "sourceSha256": record.source_sha256,
                    "sourcePageUrl": record.source_page_url,
                    "licenseId": record.license_id,
                    "licenseUrl": record.license_url
                },
                "processing": {
                    "profile": asset.processing_profile,
                    "seed": seed,
                    "sampleRate": 48000,
                    "channels": 2,
                    "bitrateKbps": spec.audio_contract.bitrate_kbps,
                    "cleanRoom": True,
                    "kimiInputUsed": False
                }
            })
            qc.append({
                "id": asset.id,
                "kind": asset.kind,
                "relativePath": asset.relative_path,
                "sha256": digest,
                "objectiveStatus": status,
                "failures": failures,
                "metrics": metrics.to_dict()
            })
    return provenance, qc


def _render_procedural_assets(spec: ReviewSpec, temp_dir: Path, ffmpeg: str, duration_cap: float | None) -> tuple[list[dict], list[dict]]:
    provenance: list[dict] = []
    qc: list[dict] = []
    for asset in tuple(spec.ambience) + tuple(spec.feedback):
        duration = _duration(asset, duration_cap)
        if asset.kind == "ambience":
            seed = asset.seed if asset.seed is not None else _seed(asset)
            pcm = generate_ambience(asset.id, duration, 48000, seed)
            generator = "deterministic-periodic-frequency-domain-noise"
            parameters = {"seed": seed}
        else:
            pcm = generate_feedback(duration, 48000, list(asset.notes))
            generator = "deterministic-fixed-note-oscillators-with-cosine-envelopes"
            parameters = {"notes": list(asset.notes), "runtimeGain": asset.runtime_gain}
        output = temp_dir / asset.relative_path
        encode_mp3(pcm, output, 48000, spec.audio_contract.bitrate_kbps, ffmpeg)
        digest = file_sha256(output)
        metrics = measure_audio(output, ffmpeg)
        status, failures = _objective_status(asset, metrics, duration)
        provenance.append({
            "id": asset.id,
            "kind": asset.kind,
            "relativePath": asset.relative_path,
            "sha256": digest,
            "bytes": output.stat().st_size,
            "durationSecondsRequested": duration,
            "source": {
                "type": "first-party-procedural",
                "thirdPartySamples": False,
                "aiGeneratedAudioInput": False,
                "voices": False
            },
            "processing": {
                "generator": generator,
                "sampleRate": 48000,
                "channels": 2,
                "bitrateKbps": spec.audio_contract.bitrate_kbps,
                **parameters
            }
        })
        qc.append({
            "id": asset.id,
            "kind": asset.kind,
            "relativePath": asset.relative_path,
            "sha256": digest,
            "objectiveStatus": status,
            "failures": failures,
            "metrics": metrics.to_dict()
        })
    return provenance, qc


def _assert_progression(qc_rows: list[dict]) -> dict:
    by_id = {row["id"]: row for row in qc_rows}
    progression = {}
    for family in ("forest", "rain", "ocean", "fireplace", "river", "wind"):
        scores = [float(by_id[f"{family}:{level}"]["metrics"]["intensity_score"]) for level in ("soft", "deep", "intense")]
        gaps = [scores[1] - scores[0], scores[2] - scores[1]]
        passed = all(gap >= 3.0 for gap in gaps)
        progression[family] = {"scores": scores, "gaps": gaps, "minimumGap": 3.0, "pass": passed}
        if not passed:
            raise BuildError(f"Intensity progression failed for {family}: {scores}")
    return progression


def build_review_package(spec_path: str | Path, output_dir: str | Path, cache_dir: str | Path, *, offline: bool = False, provider_root_override: str | None = None, license_url_override: str | None = None, allow_http_hosts: set[str] | None = None, test_duration_cap: float | None = None) -> dict:
    spec = load_spec(spec_path)
    output = Path(output_dir).resolve()
    cache = Path(cache_dir).resolve()
    if output == cache or output in cache.parents or cache in output.parents:
        raise BuildError("Output and cache directories must be independent")
    if any(part in {"public", "docs", "android", "ios", "src-tauri", "dist"} for part in output.parts):
        raise BuildError("Review package output may not target runtime directories")
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise BuildError("ffmpeg is required")
    client = HttpClient(cache, offline=offline, allow_http_hosts=allow_http_hosts or set())
    unique_sources: dict[int, SourceRecord] = {}
    for asset in spec.hyperfocus:
        source = asset.source
        if not source:
            raise BuildError(f"Missing source: {asset.id}")
        if source.sound_number in unique_sources:
            continue
        request = SourceRequest(
            sound_number=source.sound_number,
            provider_root=provider_root_override or source.provider_root,
            license_url=license_url_override or source.license_url,
            license_id=source.license_id
        )
        unique_sources[source.sound_number] = acquire_source(request, client)

    output.parent.mkdir(parents=True, exist_ok=True)
    temp_dir = output.parent / ("." + output.name + ".tmp-" + uuid.uuid4().hex)
    temp_dir.mkdir(parents=True)
    try:
        sourced_provenance, sourced_qc = _render_source_assets(spec, unique_sources, temp_dir, ffmpeg, test_duration_cap)
        procedural_provenance, procedural_qc = _render_procedural_assets(spec, temp_dir, ffmpeg, test_duration_cap)
        provenance_rows = sorted(sourced_provenance + procedural_provenance, key=lambda row: row["id"])
        qc_rows = sorted(sourced_qc + procedural_qc, key=lambda row: row["id"])
        failed = [row for row in qc_rows if row["objectiveStatus"] != "PASS"]
        if failed:
            raise BuildError("Objective QC failed: " + ", ".join(f"{row['id']}={row['failures']}" for row in failed))
        progression = _assert_progression(qc_rows)
        generated_at = _timestamp()
        _write_json(temp_dir / "rights-ledger.json", {
            "schemaVersion": 1,
            "status": "CC0_SOURCE_RIGHTS_VERIFIED_AT_BUILD_TIME",
            "accessedAt": generated_at,
            "canonicalLicense": "CC0-1.0",
            "sources": [unique_sources[number].serializable() for number in sorted(unique_sources)],
            "legalBoundary": "Evidence packet, not legal advice or a warranty against third-party claims."
        })
        _write_json(temp_dir / "provenance.json", {
            "schemaVersion": 1,
            "packageId": spec.package_id,
            "status": "REVIEW_ONLY",
            "runtimePromotionAllowed": False,
            "generatedAt": generated_at,
            "cleanRoomStatement": "No Kimi MP3, decoded waveform, spectrogram, or derivative audio was used as an input.",
            "audioContract": {"sampleRate": 48000, "channels": 2, "format": "mp3", "bitrateKbps": 128},
            "assets": provenance_rows
        })
        _write_json(temp_dir / "qc-report.json", {
            "schemaVersion": 1,
            "status": "OBJECTIVE_PASS",
            "generatedAt": generated_at,
            "progression": progression,
            "assets": qc_rows
        })
        human = build_human_review_matrix(provenance_rows)
        human["generatedAt"] = generated_at
        _write_json(temp_dir / "human-review.json", human)
        _write_json(temp_dir / "build-environment.json", {
            "schemaVersion": 1,
            "generatedAt": generated_at,
            "python": _tool_version([shutil.which("python3") or "python3", "--version"]),
            "ffmpeg": _tool_version([ffmpeg, "-version"]),
            "numpy": __import__("numpy").__version__,
            "sourceDateEpoch": os.environ.get("SOURCE_DATE_EPOCH")
        })
        (temp_dir / "README.md").write_text(
            "# ZenFlow CC0 Kimi audio reconstruction — review package\n\n"
            "Status: **REVIEW_ONLY**\n\n"
            "This package contains 26 clean-room audio reconstructions: 18 CC0-source Hyperfocus variants, three first-party procedural ambience loops, and five first-party procedural feedback cues. No Kimi binary or derivative audio input was used.\n\n"
            "Objective QC: PASS. Human listening and Web/PWA/Android/iOS/Desktop runtime acceptance: PENDING/UNVERIFIED. Do not copy files into runtime asset directories until `human-review.json` is completed against the exact SHA-256 values and a separate promotion change is approved.\n\n"
            f"Generated: {generated_at}\n",
            encoding="utf-8"
        )
        files = [path for path in temp_dir.rglob("*") if path.is_file() and path.name != "SHA256SUMS"]
        write_sha256sums(temp_dir, files)
        verification = verify_package(temp_dir, spec_path)
        _atomic_promote(temp_dir, output)
        return {**verification, "sourceCount": len(unique_sources), "packagePath": str(output)}
    except Exception:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise


def main(argv=None):
    parser = argparse.ArgumentParser(description="Build the review-only CC0 Kimi audio reconstruction package")
    parser.add_argument("--spec", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--cache", required=True)
    parser.add_argument("--offline", action="store_true")
    args = parser.parse_args(argv)
    result = build_review_package(args.spec, args.output, args.cache, offline=args.offline)
    print(json.dumps(result, indent=2, sort_keys=True))

if __name__ == "__main__":
    main()
