from __future__ import annotations

from dataclasses import dataclass
import hashlib
import hmac
import json
from pathlib import Path
import shutil
import tempfile

from .model import EXACT_FAMILIES
from .preview import PreviewRecord


BLIND_LABELS = ("A", "B", "C")
OWNER_DECISIONS = ("A", "B", "C", "NONE")


class ReviewError(RuntimeError):
    pass


@dataclass(frozen=True)
class BlindBundle:
    root: Path
    listen_root: Path
    public_files: tuple[Path, ...]
    mapping: tuple[dict, ...]
    bundle_sha256: str
    source_review_path: Path
    blind_map_path: Path


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _write_json(path: Path, value: object) -> None:
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as stream:
            json.dump(value, stream, indent=2, sort_keys=True)
            stream.write("\n")
            temporary = Path(stream.name)
        temporary.replace(path)
        temporary = None
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def _permutation(seed: bytes, family: str) -> tuple[int, int, int]:
    values = [0, 1, 2]
    counter = 0
    for index in range(len(values) - 1, 0, -1):
        block = hmac.new(
            seed,
            f"hyperfocus-source-v2:{family}:{counter}".encode("utf-8"),
            hashlib.sha256,
        ).digest()
        selected = int.from_bytes(block[:8], "big") % (index + 1)
        values[index], values[selected] = values[selected], values[index]
        counter += 1
    return tuple(values)


def _bundle_hash(listen_rows: list[dict]) -> str:
    encoded = json.dumps(
        listen_rows,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _write_review_instructions(path: Path) -> None:
    path.write_text(
        """# Hyperfocus source audition v1

Это слепое прослушивание шести семейств: `forest`, `rain`, `ocean`, `fireplace`, `river`, `wind`.

Для каждого семейства прослушайте `A`, `B`, `C` в случайном порядке и выберите только один ответ: `A`, `B`, `C` или `NONE`. `NONE` означает, что ни один вариант буквально и чисто не соответствует названию.

Проверяйте отдельно:

- буквальную узнаваемость сцены без подсказки;
- отсутствие речи, музыки, транспорта, механизмов, сигналов и чужой доминирующей сцены;
- отсутствие утомляющего переднего события;
- пригодность как непрерывного фонового звука.

Громкость файлов намеренно не выровнена: это точные необработанные окна. Подстройте системную громкость вручную, но не применяйте эффекты. ИИ-оценки, источник и технические метрики скрыты до фиксации решения.
""",
        encoding="utf-8",
    )


def build_blind_bundle(
    previews: tuple[PreviewRecord, ...],
    bundle_root: Path,
    seed_bytes: bytes,
) -> BlindBundle:
    if len(seed_bytes) != 32:
        raise ReviewError("blind seed must contain exactly 32 bytes")
    root = Path(bundle_root)
    if root.exists() or root.is_symlink():
        raise ReviewError("blind bundle output must be a new directory")
    by_id = {record.candidate_id: record for record in previews}
    expected_ids = {
        f"{family}-c{position}"
        for family in EXACT_FAMILIES
        for position in (1, 2, 3)
    }
    if len(previews) != 18 or set(by_id) != expected_ids:
        raise ReviewError("blind bundle requires the exact 18 preview identities")
    root.mkdir(parents=True)
    listen_root = root / "listen"
    listen_root.mkdir()
    mapping = []
    listen_rows = []
    public_files = []
    for family in EXACT_FAMILIES:
        family_records = tuple(by_id[f"{family}-c{position}"] for position in (1, 2, 3))
        for blind_index, source_index in enumerate(
            _permutation(seed_bytes, family)
        ):
            label = BLIND_LABELS[blind_index]
            record = family_records[source_index]
            source = Path(record.preview_path)
            if source.is_symlink() or not source.is_file():
                raise ReviewError("preview input must be a regular file")
            if _sha256_file(source) != record.preview_sha256:
                raise ReviewError("preview input hash mismatch")
            output_name = f"{family}-{label}.wav"
            output = listen_root / output_name
            shutil.copyfile(source, output)
            output_sha = _sha256_file(output)
            if output_sha != record.preview_sha256 or output.stat().st_nlink != 1:
                raise ReviewError("blind copy is not byte-identical and independent")
            mapping.append(
                {
                    "family": family,
                    "blindId": label,
                    "candidateId": record.candidate_id,
                    "sourceSha256": record.source_sha256,
                    "previewSha256": record.preview_sha256,
                    "listenPath": f"listen/{output_name}",
                    "listenSha256": output_sha,
                }
            )
            listen_rows.append(
                {
                    "family": family,
                    "blindId": label,
                    "path": f"listen/{output_name}",
                    "sha256": output_sha,
                }
            )
            public_files.append(output)
    instructions = listen_root / "SOURCE_REVIEW.md"
    _write_review_instructions(instructions)
    public_files.append(instructions)
    bundle_sha256 = _bundle_hash(listen_rows)
    blind_map = {
        "schemaVersion": 1,
        "status": "PRIVATE_SEALED_MAPPING",
        "seedHex": seed_bytes.hex(),
        "seedSha256": hashlib.sha256(seed_bytes).hexdigest(),
        "bundleSha256": bundle_sha256,
        "mapping": mapping,
    }
    blind_map_path = root / "blind-map.json"
    _write_json(blind_map_path, blind_map)
    source_review = {
        "schemaVersion": 1,
        "status": "PENDING_OWNER_SOURCE_REVIEW",
        "runtimePromotionAllowed": False,
        "bundleSha256": bundle_sha256,
        "allowedDecisions": list(OWNER_DECISIONS),
        "requiredPlaybackContexts": ["headphones", "built-in-speaker"],
        "families": [
            {
                "family": family,
                "decision": "PENDING",
                "identityRating1to5": "PENDING",
                "purityRating1to5": "PENDING",
                "rejectReasons": [],
            }
            for family in EXACT_FAMILIES
        ],
        "reviewer": "PENDING",
        "reviewedAt": "PENDING",
        "playbackContexts": [],
    }
    source_review_path = root / "source-review.json"
    _write_json(source_review_path, source_review)
    return BlindBundle(
        root=root,
        listen_root=listen_root,
        public_files=tuple(public_files),
        mapping=tuple(mapping),
        bundle_sha256=bundle_sha256,
        source_review_path=source_review_path,
        blind_map_path=blind_map_path,
    )


def apply_source_review(
    allowed_by_family: dict[str, tuple[str, ...]],
    owner_input: dict[str, dict],
) -> dict[str, str]:
    decisions = {}
    for family, allowed in allowed_by_family.items():
        row = owner_input.get(family)
        decision = row.get("decision") if isinstance(row, dict) else None
        if decision not in allowed:
            raise ReviewError(f"owner decision required for {family}")
        decisions[family] = decision
    return decisions
