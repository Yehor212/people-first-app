from __future__ import annotations

from pathlib import Path
import re
from typing import Any


EXPECTED_DIRECT = {
    "clap": {
        "torch": "2.13.0",
        "transformers": "5.15.1",
        "safetensors": "0.8.0",
        "huggingface-hub": "1.28.0",
        "numpy": "2.5.2",
        "scipy": "1.18.1",
        "soundfile": "0.14.0",
        "librosa": "1.0.0",
    },
    "yamnet": {
        "tensorflow": "2.21.0",
        "tensorflow-hub": "0.16.1",
        "tf-keras": "2.21.0",
        "numpy": "2.5.2",
        "scipy": "1.18.1",
        "soundfile": "0.14.0",
    },
}

REQUIREMENT = re.compile(r"^([A-Za-z0-9_.-]+)==([A-Za-z0-9_.+!-]+)$")


class EnvironmentError(ValueError):
    pass


def normalize_package_name(name: str) -> str:
    return re.sub(r"[-_.]+", "-", name).lower()


def parse_direct_requirements(path: str | Path) -> dict[str, str]:
    source = Path(path)
    try:
        lines = source.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeError) as exc:
        raise EnvironmentError(f"unable to read direct requirements {source}: {exc}") from exc
    result: dict[str, str] = {}
    errors: list[str] = []
    for number, raw in enumerate(lines, start=1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        match = REQUIREMENT.fullmatch(line)
        if not match:
            errors.append(f"line {number} must be one exact name==version requirement")
            continue
        name = normalize_package_name(match.group(1))
        if name in result:
            errors.append(f"duplicate direct requirement: {name}")
            continue
        result[name] = match.group(2)
    if not result:
        errors.append("direct requirements cannot be empty")
    if errors:
        raise EnvironmentError("; ".join(errors))
    return result


def validate_environment(
    kind: str,
    executable: Path,
    observed: dict[str, Any],
) -> dict[str, Any]:
    if kind not in EXPECTED_DIRECT:
        raise EnvironmentError(f"unsupported audit environment: {kind}")
    errors: list[str] = []
    version = str(observed.get("pythonVersion", ""))
    if not re.fullmatch(r"3\.12(?:\.\d+)?", version):
        errors.append("Python 3.12 audit environment required")
    packages_value = observed.get("packages")
    if not isinstance(packages_value, dict):
        packages_value = {}
        errors.append("observed packages must be an object")
    packages = {
        normalize_package_name(str(name)): str(package_version)
        for name, package_version in packages_value.items()
    }
    expected = EXPECTED_DIRECT[kind]
    for name, expected_version in expected.items():
        actual = packages.get(name)
        if actual != expected_version:
            errors.append(f"{kind} requires {name}=={expected_version}, observed {actual or 'MISSING'}")
    if errors:
        raise EnvironmentError("; ".join(errors))
    return {
        "kind": kind,
        "executable": str(executable),
        "pythonVersion": version,
        "packages": {name: packages[name] for name in sorted(expected)},
        "status": "ENVIRONMENT_IDENTITY_VALID",
    }
