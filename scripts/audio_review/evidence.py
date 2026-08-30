from __future__ import annotations

import hashlib
from pathlib import Path
import tempfile

PLATFORMS = ("web-vite", "installed-pwa", "android-capacitor", "ios-wkwebview", "desktop-tauri")


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_sha256sums(root: Path, files: list[Path] | tuple[Path, ...]) -> Path:
    rows = []
    for path in sorted(files, key=lambda item: item.relative_to(root).as_posix()):
        rows.append(f"{file_sha256(path)}  {path.relative_to(root).as_posix()}")
    output = root / "SHA256SUMS"
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=root,
            prefix=".SHA256SUMS.",
            suffix=".tmp",
            delete=False,
        ) as stream:
            stream.write("\n".join(rows) + "\n")
            temporary = Path(stream.name)
        temporary.replace(output)
        temporary = None
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return output


def build_human_review_matrix(assets: list[dict]) -> dict:
    rows = []
    for asset in assets:
        kind = asset["kind"]
        rows.append({
            "id": asset["id"],
            "kind": kind,
            "relativePath": asset["relativePath"],
            "sha256": asset["sha256"],
            "promotionScope": kind == "hyperfocus",
            "decision": "PENDING",
            "minimumLoopMinutes": 10 if kind in {"hyperfocus", "ambience"} else 0,
            "requiredListenOn": ["headphones", "built-in-speaker"],
            "listenOn": [],
            "acceptCriteria": [
                "no audible seam",
                "no speech or vocals",
                "no melody or beat",
                "no alarm-like foreground event",
                "no fatigue-inducing repetition",
                "role and intensity match"
            ],
            "rejectReasons": []
        })
    return {
        "schemaVersion": 1,
        "status": "PENDING_HUMAN_REVIEW",
        "promotionAllowed": False,
        "runtimeStatus": "UNVERIFIED",
        "assets": rows,
        "platforms": {platform: "UNVERIFIED" for platform in PLATFORMS}
    }
