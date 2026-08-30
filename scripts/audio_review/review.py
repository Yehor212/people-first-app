from __future__ import annotations

import argparse
import copy
from datetime import datetime
import json
import math
from pathlib import Path
import tempfile

from .evidence import write_sha256sums


ALLOWED_DECISIONS = frozenset({"ACCEPT", "REVISE", "REJECT"})
REQUIRED_CONTEXTS = frozenset({"headphones", "built-in-speaker"})


class ReviewError(RuntimeError):
    pass


def _validate_reviewed_at(reviewed_at: str) -> str:
    if not isinstance(reviewed_at, str) or not reviewed_at.endswith("Z"):
        raise ReviewError("REVIEW_INPUT_INVALID")
    try:
        parsed = datetime.fromisoformat(reviewed_at[:-1] + "+00:00")
    except ValueError as exc:
        raise ReviewError("REVIEW_INPUT_INVALID") from exc
    if parsed.utcoffset() is None or parsed.utcoffset().total_seconds() != 0:
        raise ReviewError("REVIEW_INPUT_INVALID")
    return reviewed_at


def record_decision(
    row: dict,
    *,
    reviewer: str,
    decision: str,
    minutes: int | float,
    contexts: list[str] | tuple[str, ...] | set[str],
    reasons: list[str] | tuple[str, ...],
    reviewed_at: str,
) -> dict:
    reviewer_name = reviewer.strip() if isinstance(reviewer, str) else ""
    if (
        not isinstance(row, dict)
        or not reviewer_name
        or len(reviewer_name) > 200
        or any(ord(character) < 32 for character in reviewer_name)
        or decision not in ALLOWED_DECISIONS
        or not isinstance(minutes, (int, float))
        or isinstance(minutes, bool)
        or not math.isfinite(float(minutes))
        or minutes < 0
        or minutes > 10_000
        or not isinstance(contexts, (list, tuple, set))
        or not isinstance(reasons, (list, tuple))
    ):
        raise ReviewError("REVIEW_INPUT_INVALID")
    try:
        context_set = set(contexts)
    except TypeError as exc:
        raise ReviewError("REVIEW_INPUT_INVALID") from exc
    if (
        any(not isinstance(context, str) for context in context_set)
        or not context_set.issubset(REQUIRED_CONTEXTS)
        or any(not isinstance(reason, str) or not reason.strip() for reason in reasons)
    ):
        raise ReviewError("REVIEW_INPUT_INVALID")
    minimum_minutes = row.get("minimumLoopMinutes")
    if not isinstance(minimum_minutes, int) or isinstance(minimum_minutes, bool) or minimum_minutes < 0:
        raise ReviewError("REVIEW_INPUT_INVALID")
    if minimum_minutes and (
        minutes < minimum_minutes or not REQUIRED_CONTEXTS.issubset(context_set)
    ):
        raise ReviewError("LISTENING_ATTESTATION_INCOMPLETE")
    if decision in {"REVISE", "REJECT"} and not reasons:
        raise ReviewError("REJECTION_REASON_REQUIRED")
    return {
        **row,
        "decision": decision,
        "reviewer": reviewer_name,
        "reviewedAt": _validate_reviewed_at(reviewed_at),
        "attestedMinutes": minutes,
        "listenOn": sorted(context_set),
        "rejectReasons": [reason.strip() for reason in reasons],
    }


def compute_audio_fit(matrix: dict, provenance: dict) -> dict:
    failures: list[str] = []
    matrix_rows = matrix.get("assets") if isinstance(matrix, dict) else None
    provenance_rows = provenance.get("assets") if isinstance(provenance, dict) else None
    if not isinstance(matrix_rows, list) or not isinstance(provenance_rows, list):
        return {
            "pass": False,
            "status": "AUDIO_FIT_INCOMPLETE",
            "promotionScopeCount": 0,
            "acceptedCount": 0,
            "failures": ["MALFORMED_REVIEW_OR_PROVENANCE"],
        }
    provenance_by_id: dict[str, dict] = {}
    for row in provenance_rows:
        if not isinstance(row, dict) or not isinstance(row.get("id"), str):
            failures.append("MALFORMED_PROVENANCE_ROW")
            continue
        if row["id"] in provenance_by_id:
            failures.append(f"DUPLICATE_PROVENANCE_ID:{row['id']}")
        provenance_by_id[row["id"]] = row
    promotion_rows = [
        row for row in matrix_rows if isinstance(row, dict) and row.get("promotionScope") is True
    ]
    expected_promotion_ids = {
        row["id"]
        for row in provenance_rows
        if isinstance(row, dict)
        and row.get("kind") == "hyperfocus"
        and isinstance(row.get("id"), str)
    }
    promotion_ids = {
        row.get("id") for row in promotion_rows if isinstance(row.get("id"), str)
    }
    if len(promotion_rows) != 18 or promotion_ids != expected_promotion_ids:
        failures.append("PROMOTION_SCOPE_MISMATCH")
    accepted = 0
    for row in promotion_rows:
        asset_id = row.get("id")
        if not isinstance(asset_id, str):
            failures.append("MALFORMED_PROMOTION_ROW")
            continue
        provenance_row = provenance_by_id.get(asset_id)
        if provenance_row is None or row.get("sha256") != provenance_row.get("sha256"):
            failures.append(f"HASH_MISMATCH:{asset_id}")
            continue
        if row.get("decision") != "ACCEPT":
            failures.append(f"NOT_ACCEPTED:{asset_id}")
            continue
        try:
            record_decision(
                row,
                reviewer=row.get("reviewer", ""),
                decision="ACCEPT",
                minutes=row.get("attestedMinutes", -1),
                contexts=row.get("listenOn", []),
                reasons=row.get("rejectReasons", []),
                reviewed_at=row.get("reviewedAt", ""),
            )
        except ReviewError:
            failures.append(f"INVALID_ATTESTATION:{asset_id}")
            continue
        accepted += 1
    passed = not failures
    return {
        "pass": passed,
        "status": (
            "AUDIO_FIT_PASS_RUNTIME_UNVERIFIED" if passed else "AUDIO_FIT_INCOMPLETE"
        ),
        "promotionScopeCount": len(promotion_rows),
        "acceptedCount": accepted,
        "failures": sorted(set(failures)),
    }


def apply_owner_review(matrix: dict, provenance: dict, owner_input: dict) -> dict:
    if not isinstance(owner_input, dict) or owner_input.get("humanAttested") is not True:
        raise ReviewError("HUMAN_ATTESTATION_REQUIRED")
    reviewer = owner_input.get("reviewer")
    reviewed_at = owner_input.get("reviewedAt")
    decisions = owner_input.get("decisions")
    if not isinstance(decisions, list) or not decisions:
        raise ReviewError("REVIEW_INPUT_INVALID")
    updated = copy.deepcopy(matrix)
    rows = updated.get("assets") if isinstance(updated, dict) else None
    provenance_rows = provenance.get("assets") if isinstance(provenance, dict) else None
    if not isinstance(rows, list) or not isinstance(provenance_rows, list):
        raise ReviewError("REVIEW_INPUT_INVALID")
    row_index = {
        row.get("id"): index
        for index, row in enumerate(rows)
        if isinstance(row, dict) and isinstance(row.get("id"), str)
    }
    provenance_by_id = {
        row.get("id"): row
        for row in provenance_rows
        if isinstance(row, dict) and isinstance(row.get("id"), str)
    }
    seen: set[str] = set()
    for decision_row in decisions:
        if not isinstance(decision_row, dict):
            raise ReviewError("REVIEW_INPUT_INVALID")
        asset_id = decision_row.get("id")
        if not isinstance(asset_id, str) or asset_id in seen or asset_id not in row_index:
            raise ReviewError("REVIEW_INPUT_INVALID")
        seen.add(asset_id)
        current = rows[row_index[asset_id]]
        provenance_row = provenance_by_id.get(asset_id)
        supplied_hash = decision_row.get("sha256")
        if (
            provenance_row is None
            or supplied_hash != current.get("sha256")
            or supplied_hash != provenance_row.get("sha256")
        ):
            raise ReviewError(f"REVIEW_HASH_MISMATCH:{asset_id}")
        rows[row_index[asset_id]] = record_decision(
            current,
            reviewer=reviewer,
            decision=decision_row.get("decision"),
            minutes=decision_row.get("minutes"),
            contexts=decision_row.get("contexts"),
            reasons=decision_row.get("reasons"),
            reviewed_at=reviewed_at,
        )
    audio_fit = compute_audio_fit(updated, provenance)
    updated["audioFit"] = audio_fit
    updated["status"] = (
        "AUDIO_FIT_PASS_RUNTIME_UNVERIFIED"
        if audio_fit["pass"]
        else "HUMAN_REVIEW_IN_PROGRESS"
    )
    updated["promotionAllowed"] = False
    updated["runtimeStatus"] = "UNVERIFIED"
    return updated


def _read_json(path: Path, label: str) -> dict:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ReviewError(f"REVIEW_JSON_INVALID:{label}") from exc
    if not isinstance(payload, dict):
        raise ReviewError(f"REVIEW_JSON_INVALID:{label}")
    return payload


def _atomic_write_bytes(path: Path, data: bytes) -> None:
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as stream:
            stream.write(data)
            temporary = Path(stream.name)
        temporary.replace(path)
        temporary = None
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def finalize_review_package(
    package_dir: str | Path,
    spec_path: str | Path,
    owner_input_path: str | Path,
    *,
    ffprobe_path: str | None = None,
    denylist_path: str | Path | None = None,
) -> dict:
    from .verify import verify_package

    try:
        package = Path(package_dir).resolve(strict=True)
        owner_input_file = Path(owner_input_path).resolve(strict=True)
    except OSError as exc:
        raise ReviewError("REVIEW_PATH_INVALID") from exc
    if owner_input_file == package or package in owner_input_file.parents:
        raise ReviewError("OWNER_INPUT_MUST_BE_OUTSIDE_PACKAGE")
    original_verification = verify_package(
        package,
        spec_path,
        ffprobe_path=ffprobe_path,
        denylist_path=denylist_path,
    )
    if original_verification.get("humanReview") not in {
        "PENDING_HUMAN_REVIEW",
        "HUMAN_REVIEW_IN_PROGRESS",
    }:
        raise ReviewError("REVIEW_ALREADY_COMPLETE")
    provenance_path = package / "provenance.json"
    human_path = package / "human-review.json"
    sums_path = package / "SHA256SUMS"
    provenance = _read_json(provenance_path, "provenance")
    human = _read_json(human_path, "human-review")
    owner_input = _read_json(owner_input_file, "owner-input")
    updated = apply_owner_review(human, provenance, owner_input)
    original_human = human_path.read_bytes()
    original_sums = sums_path.read_bytes()
    updated_bytes = (
        json.dumps(updated, indent=2, ensure_ascii=False, sort_keys=True) + "\n"
    ).encode("utf-8")
    try:
        _atomic_write_bytes(human_path, updated_bytes)
        files = [
            path
            for path in package.rglob("*")
            if path.is_file() and path.name != "SHA256SUMS"
        ]
        write_sha256sums(package, files)
        verification = verify_package(
            package,
            spec_path,
            ffprobe_path=ffprobe_path,
            denylist_path=denylist_path,
        )
        if verification.get("humanReview") != updated["status"]:
            raise ReviewError("POST_REVIEW_STATUS_MISMATCH")
    except BaseException:
        _atomic_write_bytes(human_path, original_human)
        _atomic_write_bytes(sums_path, original_sums)
        raise
    return {**verification, "audioFit": updated["audioFit"]}


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Apply an owner-prepared, hash-bound listening review to a private package"
    )
    parser.add_argument("--package", required=True)
    parser.add_argument("--spec", required=True)
    parser.add_argument("--input", required=True, help="Owner-prepared JSON outside the package")
    parser.add_argument("--ffprobe")
    parser.add_argument("--denylist")
    args = parser.parse_args(argv)
    result = finalize_review_package(
        args.package,
        args.spec,
        args.input,
        ffprobe_path=args.ffprobe,
        denylist_path=args.denylist,
    )
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
