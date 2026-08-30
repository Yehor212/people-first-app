from __future__ import annotations

import hashlib
import json
from pathlib import Path
import re


SHA256_LINE = re.compile(r"^([0-9a-f]{64})  ([^\r\n]+)$")


class EvidenceError(RuntimeError):
    pass


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json_exclusive(path: Path, payload: dict | list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(payload, indent=2, sort_keys=True) + "\n"
    with path.open("x", encoding="utf-8") as stream:
        stream.write(encoded)


def write_sha256sums(root: Path) -> Path:
    rows = []
    for path in sorted(root.rglob("*")):
        if path.name == "SHA256SUMS":
            continue
        if path.is_symlink():
            raise EvidenceError(f"evidence cannot contain symlink: {path}")
        if path.is_file():
            rows.append(f"{file_sha256(path)}  {path.relative_to(root).as_posix()}")
    output = root / "SHA256SUMS"
    with output.open("x", encoding="utf-8") as stream:
        stream.write("\n".join(rows) + "\n")
    return output

