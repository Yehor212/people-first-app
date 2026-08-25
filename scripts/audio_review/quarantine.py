from __future__ import annotations

import hashlib
import json
from pathlib import Path
import re


CANONICAL_LEDGER_PATH = "docs/audio/kimi-k3-recovery-ledger-2026-07-25.md"
CANONICAL_LEDGER_SHA256 = "d91a9ae1372a4a2ccd6614cec67c6f09df40cc0b8f37de3a99f8fce4d7e9a2d2"
DENYLIST_REPOSITORY_PATH = "config/audio/quarantine-denylist.json"
EXPECTED_CLASSIFICATION_COUNTS = {"BLOCKED": 9, "QUARANTINED": 17}


class QuarantineError(RuntimeError):
    pass


def default_denylist_path() -> Path:
    return Path(__file__).resolve().parents[2] / DENYLIST_REPOSITORY_PATH


def load_denylist(path: str | Path) -> frozenset[str]:
    try:
        payload = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise QuarantineError("QUARANTINE_SCHEMA_INVALID") from exc
    if not isinstance(payload, dict) or payload.get("schemaVersion") != 1:
        raise QuarantineError("QUARANTINE_SCHEMA_INVALID")
    source_ledger = payload.get("sourceLedger")
    if (
        not isinstance(source_ledger, dict)
        or source_ledger.get("path") != CANONICAL_LEDGER_PATH
        or source_ledger.get("sha256") != CANONICAL_LEDGER_SHA256
    ):
        raise QuarantineError("QUARANTINE_LEDGER_INVALID")
    rows = payload.get("entries")
    if not isinstance(rows, list) or len(rows) != 26 or any(not isinstance(row, dict) for row in rows):
        raise QuarantineError("QUARANTINE_SCHEMA_INVALID")
    hashes = [row.get("sha256") for row in rows]
    if any(not isinstance(value, str) or re.fullmatch(r"[0-9a-f]{64}", value) is None for value in hashes):
        raise QuarantineError("QUARANTINE_HASH_INVALID")
    if len(set(hashes)) != 26:
        raise QuarantineError("QUARANTINE_HASH_DUPLICATE")
    counts = {
        classification: sum(
            row.get("classification") == classification for row in rows
        )
        for classification in EXPECTED_CLASSIFICATION_COUNTS
    }
    if (
        any(row.get("classification") not in EXPECTED_CLASSIFICATION_COUNTS for row in rows)
        or counts != EXPECTED_CLASSIFICATION_COUNTS
    ):
        raise QuarantineError("QUARANTINE_CLASSIFICATION_INVALID")
    if any(not isinstance(row.get("legacyPath"), str) or not row["legacyPath"] for row in rows):
        raise QuarantineError("QUARANTINE_SCHEMA_INVALID")
    return frozenset(hashes)


def assert_not_quarantined(
    data: bytes,
    label: str,
    denylist: frozenset[str],
) -> str:
    digest = hashlib.sha256(data).hexdigest()
    if digest in denylist:
        raise QuarantineError(f"QUARANTINED_HASH:{label}:{digest}")
    return digest
