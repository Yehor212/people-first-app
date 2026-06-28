# Tauri glib RustSec triage - 2026-06-28

## Finding

- Package: `glib 0.18.5`
- Advisory: `RUSTSEC-2024-0429` / `GHSA-wrw7-89jp-8q8g`
- Scanner status:
  - `cargo audit --file src-tauri/Cargo.lock --json` reports `0` vulnerabilities and `1` `unsound` warning for `glib`.
  - Trivy reports `GHSA-wrw7-89jp-8q8g` as `MEDIUM`, fixed in `glib >=0.20.0`.

## Reachability

`glib` is pulled by the Linux GTK stack in the current Tauri 2 dependency tree:

```text
tauri 2.11.3 -> gtk 0.18.2 -> glib 0.18.5
```

Fresh target checks showed:

- `cargo tree --target x86_64-apple-darwin -i glib`: no matching dependency printed.
- `cargo tree --target x86_64-pc-windows-msvc -i glib`: no matching dependency printed.
- `cargo tree --target x86_64-unknown-linux-gnu -i glib`: Linux GTK path includes `glib 0.18.5`.

## Attempted Fix

Direct fixed-version update is blocked by Tauri's Linux GTK dependency chain:

```text
cargo update --manifest-path src-tauri/Cargo.toml -p glib --precise 0.20.0 --dry-run
error: failed to select a version for the requirement `glib = "^0.18"`
required by package `gtk v0.18.2`
... which satisfies dependency `tauri = "^2.11.3"`
```

`cargo search tauri --limit 1` returned `tauri = "2.11.3"`, so no newer stable Tauri crate was available during this audit.

## Continuation Evidence

Fresh continuation checks on 2026-06-28 kept the same conclusion:

- `output/security/cargo-audit-src-tauri-20260628-continuation.json`: `cargo-audit` found `0` vulnerabilities and still listed RustSec warnings including `RUSTSEC-2024-0429`.
- `output/security/trivy-src-tauri-20260628-continuation.json`: Trivy still reported exactly `GHSA-wrw7-89jp-8q8g` for `glib 0.18.5`, fixed in `0.20.0`, severity `MEDIUM`.
- `cargo update --manifest-path src-tauri/Cargo.toml -p glib --precise 0.20.0 --dry-run`: still blocked by `gtk v0.18.2` requiring `glib = "^0.18"` through `tauri v2.11.3`.
- `cargo search tauri --limit 1`: still returned `tauri = "2.11.3"`.

## Decision

Status: `NEEDS UPSTREAM UPDATE`, not a safe local override.

Do not patch `glib` to `0.20.x` through `[patch.crates-io]`, git overrides, or forced lockfile edits while `gtk 0.18.2` requires `glib ^0.18`; that would risk an ABI/API mismatch in the native Linux stack.

## Follow-up

1. Keep Tauri pinned to the latest stable release available to this repo.
2. Re-run `cargo search tauri --limit 1`, `cargo update -p tauri`, `cargo audit`, and Trivy during desktop release prep.
3. Treat Linux desktop distribution as requiring this audit row until Tauri/wry/gtk moves off `gtk 0.18` or provides a safe patched path.
4. Windows/macOS Store packaging may proceed separately with target-specific proof, but do not claim Linux native security closure while this row remains.
