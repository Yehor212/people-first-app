# Hyperfocus CC0 Review Package Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Salvage and harden the existing CC0 reconstruction toolchain, then produce an independently verified, hash-bound, review-only artifact for the 18 Hyperfocus candidates without changing any runtime audio asset.

**Architecture:** Import the exact unmerged CC0 review-tool lineage at `9f7e037a`, preserve its review-only boundary, and repair the live source-identity failure through test-first changes. Harden HTTP/cache/redirect handling, rights receipts, quarantine denial, package verification, and CI provenance before a live build. Human acceptance remains a separate owner action; runtime promotion receives a new hash-specific implementation plan only after the exact 18 candidate hashes are accepted.

**Tech Stack:** Python 3.12, NumPy 2.1.3, FFmpeg/ffprobe with `libmp3lame`, `unittest`, JSON evidence, SHA-256, GitHub Actions, existing ZenFlow Node/Vitest/asset guards.

**Spec:** `docs/superpowers/specs/2026-08-25-hyperfocus-cc0-audio-rights-pack-design.md`

**Execution mode:** SOLO inline execution. Do not dispatch subagents unless the user explicitly requests delegation in a current message.

## Global Constraints

- Work only in `/Users/yehor/Projects/ZenFlow/worktrees/codex-audio-cc0-rights-pack-20260825` on `codex/audio-cc0-rights-pack-20260825`.
- Preserve base `origin/main` SHA `13ca51a80d23220574deba762851fe5a32372e46` and the committed design at `d74f6d5a`.
- Import only the exact prior CC0 lineage `0170c84849653bcef94f392dc385b06923824748^..9f7e037a24a26793932a4d0dbb63341b03823a74` after verifying its merge base, tip, patch hash, and changed-path allowlist.
- The package inventory stays exactly 26 review files: 18 Hyperfocus, three ambience, and five feedback cues.
- Runtime promotion scope is only the 18 Hyperfocus files. The eight current non-Hyperfocus runtime files remain unchanged.
- All outputs are review-only under `output/cc0-kimi-audio-review`; no command may write to `public`, `docs/sounds`, `dist`, `android`, `ios`, or `src-tauri`.
- No Kimi binary, decoded waveform, spectrogram, derivative, or any of the 26 recovered hashes may be used as source or output.
- Every source recording must be source-page-, license-page-, and audio-byte-bound to a BigSoundBank item explicitly marked CC0.
- Hyperfocus output contract is MP3, 48,000 Hz, stereo, 128 kbps, and 29.9–30.1 decoded seconds.
- Each family must satisfy `soft < deep < intense` with both gaps at least 3.0 intensity-score points.
- Rights parsing is evidence capture, not legal clearance. Human `AUDIO_FIT`, owner/legal decision, all runtime targets, store submission, and publication remain `UNVERIFIED`.
- No new paid service, paid API, runtime dependency, production write, source download, output cleanup, push, PR, deploy, or store action without its applicable explicit authorization.
- Do not weaken an existing test, scanner, hash check, path check, rights check, or acceptance criterion to make a run green.

---

### Task 1: Verify And Import The Existing CC0 Lineage

**Files:**

- Import: `.github/workflows/cc0-kimi-audio-review.yml`
- Import: `config/audio/cc0-kimi-audio-review-spec.json`
- Import: `docs/audio/cc0-kimi-audio-review.md`
- Import: `docs/audio/cc0-kimi-audio-source-shortlist.md`
- Import: `docs/superpowers/plans/2026-08-24-cc0-kimi-audio-reconstruction.md`
- Import: `docs/superpowers/specs/2026-08-24-cc0-kimi-audio-reconstruction-design.md`
- Import: `scripts/audio_review/**`

**Interfaces:**

- Consumes: remote ref `origin/codex/cc0-kimi-audio-reconstruction`.
- Produces: the exact prior 19-commit review-tool history in the current isolated lane, with no runtime asset or binary file.

- [ ] **Step 1: Verify immutable branch identity**

Run:

```bash
test "$(git rev-parse origin/codex/cc0-kimi-audio-reconstruction)" = "9f7e037a24a26793932a4d0dbb63341b03823a74"
test "$(git merge-base origin/main origin/codex/cc0-kimi-audio-reconstruction)" = "13ca51a80d23220574deba762851fe5a32372e46"
test "$(git rev-list --count origin/main..origin/codex/cc0-kimi-audio-reconstruction)" = "19"
test "$(git diff --binary origin/main...origin/codex/cc0-kimi-audio-reconstruction | shasum -a 256 | awk '{print $1}')" = "fad16ed045dd095012015b71657cb1c88e47b35ee44dad340dc8606a043d5df6"
```

Expected: all four commands exit `0`.

- [ ] **Step 2: Verify exact changed-path allowlist**

Run:

```bash
git diff --name-only origin/main...origin/codex/cc0-kimi-audio-reconstruction | sort > /tmp/zenflow-cc0-import-paths.txt
diff -u - /tmp/zenflow-cc0-import-paths.txt <<'EOF'
.github/workflows/cc0-kimi-audio-review.yml
config/audio/cc0-kimi-audio-review-spec.json
docs/audio/cc0-kimi-audio-review.md
docs/audio/cc0-kimi-audio-source-shortlist.md
docs/superpowers/plans/2026-08-24-cc0-kimi-audio-reconstruction.md
docs/superpowers/specs/2026-08-24-cc0-kimi-audio-reconstruction-design.md
scripts/audio_review/NOTICE.md
scripts/audio_review/__init__.py
scripts/audio_review/build.py
scripts/audio_review/builder.py
scripts/audio_review/dsp.py
scripts/audio_review/evidence.py
scripts/audio_review/model.py
scripts/audio_review/procedural.py
scripts/audio_review/requirements.txt
scripts/audio_review/rights.py
scripts/audio_review/tests/__init__.py
scripts/audio_review/tests/test_review_tool.py
scripts/audio_review/verify.py
EOF
```

Expected: no diff. If a path differs, stop and re-audit the remote branch.

- [ ] **Step 3: Verify no binary/runtime payload exists in the imported diff**

Run:

```bash
test -z "$(git diff --name-only origin/main...origin/codex/cc0-kimi-audio-reconstruction | rg '\.(mp3|wav|flac|ogg|m4a|aac|aab|apk|ipa|dmg|msix)$' || true)"
test -z "$(git diff --name-only origin/main...origin/codex/cc0-kimi-audio-reconstruction | rg '^(public/sounds|docs/sounds|dist/|android/|ios/|src-tauri/)' || true)"
```

Expected: both assertions exit `0`.

- [ ] **Step 4: Import the exact commit chain**

Run:

```bash
git cherry-pick 0170c84849653bcef94f392dc385b06923824748^..9f7e037a24a26793932a4d0dbb63341b03823a74
```

Expected: 19 commits are replayed without conflicts; the existing `2026-08-25` spec and plan remain present.

- [ ] **Step 5: Verify imported tree and history**

Run:

```bash
git diff --check origin/main...HEAD
git status --short --untracked-files=all
git log --oneline --reverse dd9c44c7..HEAD
```

Expected: no tracked/untracked project changes; the 19 imported commits appear after plan commit `dd9c44c7`. The cherry-picked commits themselves satisfy this task's commit boundary.

---

### Task 2: Reproduce And Fix Grouped Sound-Number Binding

**Files:**

- Modify: `scripts/audio_review/rights.py:195-223`
- Modify: `scripts/audio_review/tests/test_review_tool.py:48-136`

**Interfaces:**

- Consumes: `sound_number: int`, plain text extracted from a provider page.
- Produces: `sound_number_text_pattern(sound_number: int) -> re.Pattern[str]`, which accepts exact ungrouped and thousands-grouped representations only after an explicit sound-number label.

- [ ] **Step 1: Create an isolated Python 3.12 environment**

Run:

```bash
uv venv --python 3.12 .venv-audio-review
uv pip install --python .venv-audio-review/bin/python numpy==2.1.3
```

Expected: `.venv-audio-review/bin/python --version` reports Python 3.12 and NumPy reports `2.1.3`. The directory is ignored and never staged.

- [ ] **Step 2: Write failing grouped-number tests**

Add to `RightsTests`:

```python
def test_accepts_comma_grouped_live_sound_number(self):
    html = "<h1>Forest #3</h1><p>Sound number: 2,715</p><p>Author: Pierre SIBANARCO</p><p>CC0 1.0</p>"
    title, author, _ = rights_module._extract_page(
        html,
        "https://bigsoundbank.com/forest-3-s2715.html",
        2715,
    )
    self.assertEqual(title, "Forest #3")
    self.assertEqual(author, "Pierre SIBANARCO")

def test_rejects_nearby_or_malformed_sound_number(self):
    for body in ("Sound number: 27,150", "Sound number: 2.715", "Sound number: 12715"):
        with self.subTest(body=body), self.assertRaises(RightsError):
            rights_module._extract_page(
                f"<h1>Wrong</h1><p>{body}</p><p>Author: Wrong</p><p>CC0 1.0</p>",
                "https://bigsoundbank.com/forest-3-s2715.html",
                2715,
            )
```

Also import the module as:

```python
from scripts.audio_review import rights as rights_module
```

- [ ] **Step 3: Run the tests to verify RED**

Run:

```bash
PATH="$(pwd)/.venv-audio-review/bin:/usr/bin:/bin:/usr/sbin:/sbin" \
  .venv-audio-review/bin/python -m unittest \
  scripts.audio_review.tests.test_review_tool.RightsTests.test_accepts_comma_grouped_live_sound_number \
  scripts.audio_review.tests.test_review_tool.RightsTests.test_rejects_nearby_or_malformed_sound_number -v
```

Expected: the grouped-number test fails with `Source page body is not bound to sound 2715`; the negative cases remain rejected.

- [ ] **Step 4: Implement exact grouping support**

Add above `_extract_page`:

```python
def sound_number_text_pattern(sound_number: int) -> re.Pattern[str]:
    digits = str(sound_number)
    variants = [re.escape(digits)]
    if len(digits) > 3:
        variants.append(
            re.escape(digits[:-3])
            + r"(?:,|\u00a0|\u202f|[ ])"
            + re.escape(digits[-3:])
        )
    exact_number = "(?:" + "|".join(variants) + ")"
    return re.compile(
        rf"(?:sound\s*(?:number|n°|no\.?)|sound\s*#)[\s:#-]*0*{exact_number}(?!\d)",
        re.IGNORECASE,
    )
```

Replace the body check in `_extract_page` with:

```python
if not sound_number_text_pattern(sound_number).search(text):
    raise RightsError(f"Source page body is not bound to sound {sound_number}")
```

Do not retain the prior bare `s2715` body alternative; the URL already proves the slug and the page body must carry an explicit number label.

- [ ] **Step 5: Run Rights tests GREEN**

Run the Step 3 command, then:

```bash
PATH="$(pwd)/.venv-audio-review/bin:/usr/bin:/bin:/usr/sbin:/sbin" \
  .venv-audio-review/bin/python -m unittest \
  scripts.audio_review.tests.test_review_tool.RightsTests -v
```

Expected: all Rights tests pass; audio tests are not invoked.

- [ ] **Step 6: Commit**

```bash
git add scripts/audio_review/rights.py scripts/audio_review/tests/test_review_tool.py
git commit -m 'fix(audio): bind grouped source numbers'
```

---

### Task 3: Harden URL, Redirect, Sitemap, And Cache Identity

**Files:**

- Modify: `scripts/audio_review/rights.py:21-164`
- Modify: `scripts/audio_review/tests/test_review_tool.py:32-136`

**Interfaces:**

- Consumes: an initial URL, `allowed_hosts: frozenset[str]`, byte limit, and optional offline cache.
- Produces: `HttpResponse(url, body, content_type, redirect_chain)` only when every hop and cached byte is valid.

- [ ] **Step 1: Write failing cache-integrity tests**

Add:

```python
def test_offline_cache_rejects_body_tampering(self):
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory) / "server"
        cache = Path(directory) / "cache"
        root.mkdir()
        with fixture_server(root) as base:
            write_source_fixture(root, base, [100])
            client = HttpClient(cache, allow_http_hosts={"127.0.0.1"})
            response = client.fetch(base + "/sitemap.xml")
            body_path = next((cache / "http").glob("*.body"))
            body_path.write_bytes(response.body + b"tampered")
        with self.assertRaisesRegex(RightsError, "CACHE_INTEGRITY_MISMATCH"):
            HttpClient(cache, offline=True, allow_http_hosts={"127.0.0.1"}).fetch(
                base + "/sitemap.xml"
            )

def test_offline_cache_rejects_missing_hash_metadata(self):
    with tempfile.TemporaryDirectory() as directory:
        cache = Path(directory)
        http = cache / "http"
        http.mkdir()
        key = hashlib.sha256(b"https://bigsoundbank.com/sitemap.xml").hexdigest()
        (http / f"{key}.body").write_bytes(b"x")
        (http / f"{key}.json").write_text('{"url":"https://bigsoundbank.com/sitemap.xml"}')
        with self.assertRaisesRegex(RightsError, "CACHE_METADATA_INVALID"):
            HttpClient(cache, offline=True).fetch("https://bigsoundbank.com/sitemap.xml")
```

- [ ] **Step 2: Write failing URL/redirect tests**

Add tests proving rejection of:

```python
for url in (
    "https://user@bigsoundbank.com/file.mp3",
    "https://bigsoundbank.com:444/file.mp3",
    "ftp://bigsoundbank.com/file.mp3",
):
    with self.subTest(url=url), self.assertRaises(RightsError):
        HttpClient(Path(tempfile.mkdtemp()))._validate_url(
            url,
            allowed_hosts=frozenset({"bigsoundbank.com"}),
        )
```

Use two fixture servers to prove that a redirect from the allowed server to the second host is rejected before the second body becomes trusted. Add a child-sitemap test whose `<loc>` points to the second host and expect `SITEMAP_HOST_MISMATCH`.

Use this redirect fixture rather than mocking `urlopen`:

```python
@contextlib.contextmanager
def redirect_server(target_url: str):
    class Handler(http.server.BaseHTTPRequestHandler):
        def log_message(self, format, *args):
            pass

        def do_GET(self):
            self.send_response(302)
            self.send_header("Location", target_url)
            self.end_headers()

    with socketserver.TCPServer(("127.0.0.1", 0), Handler) as server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield f"http://127.0.0.1:{server.server_address[1]}/redirect"
        finally:
            server.shutdown()
            thread.join(timeout=2)
```

Start the target fixture on `localhost` using its dynamically returned `server.server_address[1]`, allow only `127.0.0.1`, and assert `URL host is outside the request allowlist`. For the sitemap case, write a parent sitemap containing the exact target fixture URL in `<loc>` and assert the same host failure is wrapped as `SITEMAP_HOST_MISMATCH`.

- [ ] **Step 3: Run focused tests RED**

Run:

```bash
PATH="$(pwd)/.venv-audio-review/bin:/usr/bin:/bin:/usr/sbin:/sbin" \
  .venv-audio-review/bin/python -m unittest \
  scripts.audio_review.tests.test_review_tool.RightsTests -v
```

Expected: new cache and redirect tests fail because cached bytes are trusted without hash verification and redirects are not host-bound.

- [ ] **Step 4: Extend response and client interfaces**

Change `HttpResponse` to:

```python
@dataclass(frozen=True)
class HttpResponse:
    url: str
    body: bytes
    content_type: str
    redirect_chain: tuple[str, ...]
```

Change URL validation to:

```python
def _validate_url(self, url: str, *, allowed_hosts: frozenset[str] | None = None) -> None:
    parsed = urlparse(url)
    if parsed.username or parsed.password or parsed.fragment:
        raise RightsError(f"URL contains forbidden authority or fragment: {url}")
    try:
        port = parsed.port
    except ValueError as exc:
        raise RightsError(f"URL has an invalid port: {url}") from exc
    if port not in (None, 443) and not (
        parsed.scheme == "http" and parsed.hostname in self.allow_http_hosts
    ):
        raise RightsError(f"URL uses an unexpected port: {url}")
    if not parsed.hostname:
        raise RightsError(f"URL has no hostname: {url}")
    host = parsed.hostname.lower().rstrip(".")
    if allowed_hosts is not None and host not in allowed_hosts:
        raise RightsError(f"URL host is outside the request allowlist: {host}")
    if parsed.scheme == "https":
        return
    if parsed.scheme == "http" and host in self.allow_http_hosts:
        return
    raise RightsError(f"Only HTTPS is allowed outside explicit test hosts: {url}")
```

Add a redirect handler that validates and records every target before following it. `fetch` must accept `allowed_hosts`, verify final host, store `redirectChain`, and reject more than five redirects.

- [ ] **Step 5: Verify cached bytes before returning them**

Replace the cache read path with:

```python
body = body_path.read_bytes()
required = {"url", "contentType", "sha256", "bytes", "redirectChain"}
if not required.issubset(meta):
    raise RightsError(f"CACHE_METADATA_INVALID:{url}")
if len(body) != int(meta["bytes"]) or sha256_bytes(body) != meta["sha256"]:
    raise RightsError(f"CACHE_INTEGRITY_MISMATCH:{url}")
self._validate_url(meta["url"], allowed_hosts=allowed_hosts)
for hop in meta["redirectChain"]:
    self._validate_url(hop, allowed_hosts=allowed_hosts)
return HttpResponse(meta["url"], body, meta["contentType"], tuple(meta["redirectChain"]))
```

Reject symlinked cache files with `lstat()` before reading. Write body and metadata with exclusive temporary creation and atomic `replace` only inside `cache/http`.

- [ ] **Step 6: Bind every provider request to the exact provider host**

Derive once in `acquire_source`:

```python
provider_host = (urlparse(request.provider_root).hostname or "").lower().rstrip(".")
allowed_hosts = frozenset({provider_host})
```

Pass `allowed_hosts` to sitemap, child sitemap, source page, license page, and audio fetches. Replace substring matching in `number_tokens` with a boundary-aware path/query regex that cannot match sound `27150` for request `2715`.

- [ ] **Step 7: Run Rights tests GREEN and full non-audio suite**

Run:

```bash
PATH="$(pwd)/.venv-audio-review/bin:/usr/bin:/bin:/usr/sbin:/sbin" \
  .venv-audio-review/bin/python -m unittest discover -s scripts/audio_review/tests -v
```

Expected: rights/model/evidence/workflow tests pass; audio and builder classes report `skipped` because the intentionally restricted local PATH contains no audio-capable FFmpeg.

- [ ] **Step 8: Commit**

```bash
git add scripts/audio_review/rights.py scripts/audio_review/tests/test_review_tool.py
git commit -m 'fix(audio): harden source acquisition'
```

---

### Task 4: Make Rights Evidence Reviewable Without Claiming Clearance

**Files:**

- Modify: `scripts/audio_review/rights.py:21-305`
- Modify: `scripts/audio_review/builder.py:221-313`
- Modify: `scripts/audio_review/verify.py:55-109`
- Modify: `scripts/audio_review/tests/test_review_tool.py`

**Interfaces:**

- Consumes: source page, canonical license page, audio bytes, and redirect metadata.
- Produces: source-specific receipt records plus private page/license snapshots in the review artifact; never raw source audio.

- [ ] **Step 1: Write failing negative-rights tests**

Add:

```python
def test_license_gate_rejects_negated_commercial_or_redistribution_rights(self):
    for text in (
        "CC0 1.0. You may adapt, but commercial use is not permitted. You may distribute.",
        "CC0 1.0. Commercial use and adaptation are allowed, but redistribution is prohibited.",
    ):
        with self.subTest(text=text), self.assertRaises(RightsError):
            validate_cc0_license_text(text)

def test_source_page_requires_named_author(self):
    html = "<h1>Forest</h1><p>Sound number: 100</p><p>CC0 1.0</p>"
    with self.assertRaisesRegex(RightsError, "AUTHOR_NOT_STATED"):
        rights_module._extract_page(
            html,
            "https://bigsoundbank.com/foret-s0100.html",
            100,
        )
```

- [ ] **Step 2: Run new tests RED**

Run the Rights test command from Task 3.

Expected: negated language is incorrectly accepted and missing author returns the fallback string rather than failing.

- [ ] **Step 3: Add explicit negative-language and author gates**

Before positive rights classification, reject:

```python
NEGATED_RIGHTS = re.compile(
    r"(?:(?:commercial|redistribut|distribut|adapt|remix|transform).{0,30}"
    r"(?:not permitted|not allowed|prohibited|forbidden)|"
    r"(?:prohibited|forbidden|may not).{0,40}"
    r"(?:commercial|redistribut|distribut|adapt|remix|transform))",
    re.IGNORECASE,
)
```

Require a nonempty named author extracted from an explicit `Author`, `Recorded by`, `Auteur`, or `Credit` label. Do not permit `Not stated on parsed page` in a source record.

- [ ] **Step 4: Extend `SourceRecord` receipt fields**

Add:

```python
acquired_at: str
source_page_content_type: str
license_page_content_type: str
audio_content_type: str
source_page_redirect_chain: tuple[str, ...]
license_page_redirect_chain: tuple[str, ...]
audio_redirect_chain: tuple[str, ...]
source_page_snapshot: bytes
license_page_snapshot: bytes
```

Exclude raw snapshot bytes and `local_path` from `serializable()`. Add `receipt_manifest()` that reports their SHA-256, byte count, content type, and artifact-relative path.

- [ ] **Step 5: Write private rights snapshots into the review package**

For each unique source, write:

```text
evidence/rights/sNNNN/source-page.html
evidence/rights/sNNNN/license-page.html
evidence/rights/sNNNN/receipt.json
```

Use the exact fetched bytes. Never copy `record.local_path` into the review artifact. Include all receipt files in `SHA256SUMS`.

- [ ] **Step 6: Downgrade rights status wording to the truthful boundary**

In `rights-ledger.json`, use:

```json
{
  "status": "RIGHTS_EVIDENCE_CAPTURED_REVIEW_REQUIRED",
  "legalBoundary": "Source-specific technical evidence; not legal clearance, legal advice, exclusivity, or a warranty against third-party claims."
}
```

Rename verifier error `RIGHTS_NOT_CLEARED` to `RIGHTS_EVIDENCE_INCOMPLETE`. A parser must never emit `CLEARED`, `APPROVED`, or `RELEASED`.

- [ ] **Step 7: Verify receipt hash tampering fails**

Add a test that builds a fixture package, changes one byte in `source-page.html`, and expects `verify_package` to fail first with `HASH_MISMATCH:evidence/rights/...`.

- [ ] **Step 8: Run focused and full review-tool tests GREEN**

Run the restricted-PATH full unittest command from Task 3, then run the full audio-capable suite in CI during Task 8.

- [ ] **Step 9: Commit**

```bash
git add scripts/audio_review/rights.py scripts/audio_review/builder.py scripts/audio_review/verify.py scripts/audio_review/tests/test_review_tool.py
git commit -m 'feat(audio): preserve source rights receipts'
```

---

### Task 5: Add The Exact 26-Hash Quarantine Denylist

**Files:**

- Create: `config/audio/quarantine-denylist.json`
- Create: `scripts/audio_review/quarantine.py`
- Modify: `scripts/audio_review/builder.py`
- Modify: `scripts/audio_review/verify.py`
- Modify: `scripts/audio_review/tests/test_review_tool.py`

**Interfaces:**

- Consumes: `config/audio/quarantine-denylist.json` and bytes at source/candidate/package boundaries.
- Produces: `load_denylist(path) -> frozenset[str]` and `assert_not_quarantined(data, label, denylist) -> str` returning the non-denied SHA-256.

- [ ] **Step 1: Write the exact denylist fixture in a failing test**

The canonical hash/classification mapping is:

```python
BLOCKED_HASHES = {
    "4e8c8f757848aba7337047c4d91ec9f9f5d973454ed9e86d978a1a76ac61296a",
    "49fdbd5296ac8de4b8c44b8f39643607e741109362b94b1cce25deed85967ceb",
    "affa686a1772877d8ea23c0769833e89d3c6d234ff2f4a611af85a914978565c",
    "015b77908929a3354de99e5d4c6bdb8e5db7a99e03d29cd52f2a1ef573c1b1a6",
    "84af13be0ebf0b042915a4487650b80bce4f3ed53024540dc0e48c1334752de4",
    "b47f9368dd4ff4df0403825e791ffe5b585032805d3ac6583d33f899e648f220",
    "79de9727c528e2de3b0986eea739005b3c66955adf0ab0735dd20da1dd5aa7a9",
    "b2b08f17fbf6a8ae73bdf1c66fa6fc6f8140d398039bf79cf63e4c3ae32bf5ff",
    "a0534266e5fbab15119f1fe8f2fd3bc371090346c04556dc9665549df6bc89e4",
}

QUARANTINED_HASHES = {
    "f5c8e70570f38bd86d993d3de484c85ef4e1e8c676094020360042afc5722189",
    "fa40413b5882b79825af7e74880cd7252268405b97d78655470915ab1c5358cf",
    "6fd3b57c14f83a6418fc26f6cfa4f346ee4bd7e585c14f2dc9935ac8b142bdd9",
    "b79c475c1ee1501e6dfc8949ecf8947baa2c83f76d6e89992d16c9ca7aa111c8",
    "a67528b3a9e8621c906c53f28f8e7ca9dc1629e36e57c776c161c3ce4ebf980c",
    "e2e5988ccfca12edc45332ce6209660c056936caa4a2d07863be6214d73e0e43",
    "c64fc737ff4e945ad1a198d5ed66ebfc6b1908bb57daa817d8b6e87db86174cc",
    "adc7126e82e1a9e11b19084927c679115698b7b1a29125b3bc0855ca6f5aa323",
    "e587d5b24016ee444dfd5de9213709fed1589b738d943d0b2b60f614c22c9d22",
    "8e01ff606b2e63cf23fa89406a17db038495980828b6d10d57473069f8c39cd2",
    "e4eafb4061e1db9a389b1365180f90afd425cf93c1e8cc244422e0a29061f1a2",
    "cdcbe3fb0c8c251c2131495c66e22061b18e0091cb26027326ce9d20cfc4e3c5",
    "13eb0d8d3e12041a534b9e6b9390de0d2c6dfdb5b20e46394782271b53d4621d",
    "e1a7f87669f5aaba5668cfded53c6d43a7f43eefb4823a456e51a53e507b79a0",
    "5004f7057a1bf4678e8201a9eb75ec5ac96baf40a8bea613989e19a016b3122e",
    "62f042ea5520d6024d06703497d2a6e43a327c11668020bb8e72094c217ce18c",
    "0b859de27b4ea7c5f6ea5a4aa3032ebba586d9308730751a62e171dde3dd4065",
}
```

Before implementing, compare every value against `docs/audio/kimi-k3-recovery-ledger-2026-07-25.md`. If any literal above differs from the ledger, the ledger is authoritative and the plan must be corrected before code proceeds.

- [ ] **Step 2: Write RED tests for schema and byte rejection**

Tests must require:

```python
self.assertEqual(len(denylist), 26)
self.assertEqual(len(BLOCKED_HASHES), 9)
self.assertEqual(len(QUARANTINED_HASHES), 17)
with self.assertRaisesRegex(QuarantineError, "QUARANTINED_HASH"):
    assert_not_quarantined(quarantined_bytes, "source:forest:soft", denylist)
```

Also reject duplicate hashes, malformed SHA-256, unknown classifications, and a denylist whose source ledger path is not the canonical recovery ledger.

- [ ] **Step 3: Run quarantine tests RED**

Run:

```bash
PATH="$(pwd)/.venv-audio-review/bin:/usr/bin:/bin:/usr/sbin:/sbin" \
  .venv-audio-review/bin/python -m unittest \
  scripts.audio_review.tests.test_review_tool.QuarantineTests -v
```

Expected: import or symbol-not-found failure.

- [ ] **Step 4: Implement strict denylist loading**

Use:

```python
class QuarantineError(RuntimeError):
    pass

def load_denylist(path: str | Path) -> frozenset[str]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    rows = payload.get("entries")
    if payload.get("schemaVersion") != 1 or not isinstance(rows, list) or len(rows) != 26:
        raise QuarantineError("QUARANTINE_SCHEMA_INVALID")
    hashes = [str(row.get("sha256", "")) for row in rows]
    if any(re.fullmatch(r"[0-9a-f]{64}", value) is None for value in hashes):
        raise QuarantineError("QUARANTINE_HASH_INVALID")
    if len(set(hashes)) != 26:
        raise QuarantineError("QUARANTINE_HASH_DUPLICATE")
    if {row.get("classification") for row in rows} != {"BLOCKED", "QUARANTINED"}:
        raise QuarantineError("QUARANTINE_CLASSIFICATION_INVALID")
    return frozenset(hashes)

def assert_not_quarantined(data: bytes, label: str, denylist: frozenset[str]) -> str:
    digest = hashlib.sha256(data).hexdigest()
    if digest in denylist:
        raise QuarantineError(f"QUARANTINED_HASH:{label}:{digest}")
    return digest
```

- [ ] **Step 5: Enforce denial at every package boundary**

Call `assert_not_quarantined` for:

- every acquired source body before it enters `cache/sources`;
- every encoded candidate before provenance is written;
- every MP3 during independent package verification.

Record the denylist file SHA-256 in `provenance.json` and `build-environment.json`.

- [ ] **Step 6: Run quarantine/full non-audio tests GREEN**

Run the Task 3 full restricted-PATH command.

- [ ] **Step 7: Commit**

```bash
git add config/audio/quarantine-denylist.json scripts/audio_review/quarantine.py scripts/audio_review/builder.py scripts/audio_review/verify.py scripts/audio_review/tests/test_review_tool.py
git commit -m 'feat(audio): deny recovered audio hashes'
```

---

### Task 6: Harden Package Path And Inventory Verification

**Files:**

- Modify: `scripts/audio_review/verify.py:17-109`
- Modify: `scripts/audio_review/tests/test_review_tool.py:178-224`

**Interfaces:**

- Consumes: `SHA256SUMS` plus package root.
- Produces: a complete mapping of safe package-relative regular files; rejects traversal, symlinks, duplicates, unlisted extras, and missing entries before parsing JSON or probing audio.

- [ ] **Step 1: Write RED tests for malicious inventories**

Create fixture cases for:

```text
0000000000000000000000000000000000000000000000000000000000000000  ../outside
1111111111111111111111111111111111111111111111111111111111111111  /absolute/path
2222222222222222222222222222222222222222222222222222222222222222  audio/../outside
duplicate path rows
duplicate digest under unexpected path
symlinked package member
unlisted extra file
listed directory instead of regular file
```

Every case must fail with a stable `UNSAFE_PACKAGE_PATH`, `DUPLICATE_SHA256SUMS_PATH`, `SYMLINKED_PACKAGE_MEMBER`, or `UNLISTED_PACKAGE_FILE` code.

- [ ] **Step 2: Run verifier tests RED**

Run:

```bash
PATH="$(pwd)/.venv-audio-review/bin:/usr/bin:/bin:/usr/sbin:/sbin" \
  .venv-audio-review/bin/python -m unittest \
  scripts.audio_review.tests.test_review_tool.EvidenceTests -v
```

Expected: traversal and extra-file tests demonstrate the current verifier accepts or follows unsafe members.

- [ ] **Step 3: Implement one containment helper**

Add:

```python
def safe_package_member(root: Path, relative: str) -> Path:
    pure = PurePosixPath(relative)
    if pure.is_absolute() or not pure.parts or any(part in {"", ".", ".."} for part in pure.parts):
        raise VerificationError(f"UNSAFE_PACKAGE_PATH:{relative}")
    candidate = root.joinpath(*pure.parts)
    resolved_root = root.resolve(strict=True)
    resolved_parent = candidate.parent.resolve(strict=True)
    if resolved_root != resolved_parent and resolved_root not in resolved_parent.parents:
        raise VerificationError(f"UNSAFE_PACKAGE_PATH:{relative}")
    info = candidate.lstat()
    if stat.S_ISLNK(info.st_mode) or not stat.S_ISREG(info.st_mode):
        raise VerificationError(f"SYMLINKED_PACKAGE_MEMBER:{relative}")
    return candidate
```

Import `PurePosixPath` and `stat`. Reject backslashes and NUL before constructing the path.

- [ ] **Step 4: Enforce complete one-to-one inventory**

Track seen paths while parsing `SHA256SUMS`; reject duplicates. After hash validation, compare:

```python
actual = {
    path.relative_to(root).as_posix()
    for path in root.rglob("*")
    if path.is_file() and path.name != "SHA256SUMS"
}
if actual != set(expected):
    missing = sorted(set(expected) - actual)
    extra = sorted(actual - set(expected))
    raise VerificationError(f"PACKAGE_INVENTORY_MISMATCH:missing={missing}:extra={extra}")
```

Reject any symlink encountered by `rglob` even when it is not listed.

- [ ] **Step 5: Preserve hash-first ordering**

Add a spy test proving `verify_hash_inventory()` completes before JSON parsing, MP3 signature checks, ffprobe, rights classification, or human-review parsing. The first failure for a modified `audio/hyperfocus/hyperfocus-forest-soft.mp3` must remain `HASH_MISMATCH:audio/hyperfocus/hyperfocus-forest-soft.mp3`.

- [ ] **Step 6: Run verifier and full non-audio tests GREEN**

Run the Task 3 restricted-PATH full suite.

- [ ] **Step 7: Commit**

```bash
git add scripts/audio_review/verify.py scripts/audio_review/tests/test_review_tool.py
git commit -m 'fix(audio): contain review package verification'
```

---

### Task 7: Pin Review Build Dependencies And Attest The Build Environment

**Files:**

- Modify: `scripts/audio_review/requirements.txt`
- Modify: `.github/workflows/cc0-kimi-audio-review.yml`
- Modify: `scripts/audio_review/builder.py:25-313`
- Modify: `scripts/audio_review/tests/test_review_tool.py:225-237`
- Modify: `docs/audio/cc0-kimi-audio-review.md`

**Interfaces:**

- Consumes: hash-pinned NumPy wheels, pinned GitHub Action SHAs, runner FFmpeg packages.
- Produces: `build-environment.json` that binds Python, NumPy, FFmpeg, ffprobe, libmp3lame, OS, Git SHA, workflow source SHA, requirements SHA, and denylist SHA.

- [ ] **Step 1: Write RED workflow/dependency tests**

Require:

```python
self.assertIn("--require-hashes", workflow)
self.assertNotRegex(workflow, r"uses:\s+actions/[^@]+@v\d")
self.assertRegex(workflow, r"actions/checkout@11d5960a326750d5838078e36cf38b85af677262")
self.assertRegex(workflow, r"actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065")
self.assertRegex(workflow, r"actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02")
self.assertIn("contents: read", workflow)
self.assertNotIn("secrets.", workflow)
self.assertNotIn("output/cc0-kimi-audio-cache", artifact_upload_block)
```

Add a builder test that asserts all named environment fields are present and nonempty in a fixture package.

- [ ] **Step 2: Run workflow tests RED**

Run `WorkflowContractTests` with the restricted local PATH.

Expected: floating action tags and unhashed NumPy install fail the new assertions.

- [ ] **Step 3: Hash-pin NumPy 2.1.3**

Replace `requirements.txt` with:

```text
numpy==2.1.3 \
    --hash=sha256:2312b2aa89e1f43ecea6da6ea9a810d06aae08321609d8dc0d0eda6d946a541b \
    --hash=sha256:a6b46587b14b888e95e4a24d7b13ae91fa22386c199ee7b418f449032b2fa3b8
```

The first hash is the CPython 3.12 manylinux2014 x86_64 wheel used by GitHub Actions; the second is the CPython 3.12 macOS 14 arm64 wheel used by this worktree.

- [ ] **Step 4: Pin action revisions and restrict workflow concurrency**

Use the exact action SHAs from Step 1. Add:

```yaml
concurrency:
  group: cc0-audio-review-${{ github.ref }}
  cancel-in-progress: true
```

Change pip install to:

```bash
python -m pip install --disable-pip-version-check --only-binary=:all: --require-hashes -r scripts/audio_review/requirements.txt
```

Retain `permissions: contents: read`, `persist-credentials: false`, 35-minute timeout, review-only output path, and cache exclusion.

- [ ] **Step 5: Record exact toolchain evidence**

Extend `build-environment.json` with:

```python
"ffprobe": _tool_version([ffprobe, "-version"]),
"libmp3lame": _tool_version(["dpkg-query", "-W", "-f=${Version}", "libmp3lame0"]),
"osRelease": Path("/etc/os-release").read_text(encoding="utf-8") if Path("/etc/os-release").is_file() else platform.platform(),
"gitSha": os.environ.get("GITHUB_SHA") or _tool_version(["git", "rev-parse", "HEAD"]),
"requirementsSha256": file_sha256(Path("scripts/audio_review/requirements.txt")),
"workflowSha256": file_sha256(Path(".github/workflows/cc0-kimi-audio-review.yml")),
```

Import `platform`. Do not label cross-version output hashes deterministic; describe them as deterministic for the recorded toolchain.

- [ ] **Step 6: Add same-toolchain determinism coverage**

In the audio-capable test class, encode the same fixed PCM twice and assert identical SHA-256 bytes. Keep `-map_metadata -1`, `-write_xing 0`, and `-id3v2_version 0` in the FFmpeg invocation.

- [ ] **Step 7: Run local non-audio tests and format checks GREEN**

Run the restricted-PATH full Python suite plus:

```bash
npm run check:no-ai-templates
npm run check:best-practices
git diff --check
```

- [ ] **Step 8: Commit**

```bash
git add scripts/audio_review/requirements.txt .github/workflows/cc0-kimi-audio-review.yml scripts/audio_review/builder.py scripts/audio_review/tests/test_review_tool.py docs/audio/cc0-kimi-audio-review.md
git commit -m 'ci(audio): pin review build provenance'
```

---

### Task 8: Build And Verify The Live CC0 Review Artifact

**Files:**

- Generated/private only: `output/cc0-kimi-audio-review/**`
- Generated/private only: `output/cc0-kimi-audio-cache/**`
- No tracked product asset file.

**Interfaces:**

- Consumes: hardened review tool, exact source specification, current BigSoundBank pages/downloads, private cache.
- Produces: a GitHub Actions artifact `cc0-kimi-audio-review` whose hash inventory, rights receipts, objective QC, build environment, and human-review boundary independently verify.

- [ ] **Step 1: Run all source-free local checks**

Run:

```bash
PATH="$(pwd)/.venv-audio-review/bin:/usr/bin:/bin:/usr/sbin:/sbin" \
  .venv-audio-review/bin/python -m unittest discover -s scripts/audio_review/tests -v
npm run typecheck
npm run check:no-ai-templates
npm run check:best-practices
npm run check:agent-workspace
npm run doc-counts
git diff --check
```

Expected: all source-free tests pass; local audio-capable cases are explicitly skipped because this host lacks a full audio FFmpeg build.

- [ ] **Step 2: Run security review before any network acquisition**

Run:

```bash
/Users/yehor/.codex/bin/codex-security-suite.sh --path scripts/audio_review --profile auto
/Users/yehor/.codex/bin/codex-security-suite.sh --path config/audio --profile auto
/Users/yehor/.codex/bin/codex-security-suite.sh --path .github/workflows --profile iac
```

Run Snyk Code against `scripts/audio_review` if callable; otherwise record the exact blocker as `UNVERIFIED`. Fix every validated high/critical issue before proceeding.

- [ ] **Step 3: Freeze exact source shortlist for the first review build**

Compare the live official pages for prior sound numbers `100, 2715, 699, 2679, 1019, 1047, 698, 2570, 2856, 823, 3218, 871, 908, 904, 625` with the researched candidates in the design spec. Do not infer suitability from titles. Change `config/audio/cc0-kimi-audio-review-spec.json` only when a source page is unavailable, rights evidence fails, technical metadata violates the contract, or the owner explicitly selects a researched alternative.

Any source-number change requires:

```bash
git add config/audio/cc0-kimi-audio-review-spec.json scripts/audio_review/tests/test_review_tool.py docs/audio/cc0-kimi-audio-source-shortlist.md
git commit -m 'docs(audio): bind reviewed CC0 source shortlist'
```

- [ ] **Step 4: Stop for explicit push, PR, and live-source authorization**

Preview the exact branch, commits, changed paths, workflow permissions, intended BigSoundBank network access, and pull-request title/body. Obtain explicit owner authorization before push or pull-request creation. Do not treat this implementation plan as that authorization.

- [ ] **Step 5: Push only after authorization and verify exact tip**

Run the repository-safe push for the same-named `codex/audio-cc0-rights-pack-20260825` branch. Do not push to `main`, force-push, delete refs, or use `--no-verify`.

Verify:

```bash
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/codex/audio-cc0-rights-pack-20260825)"
```

- [ ] **Step 6: Open the approved pull request and monitor the exact review workflow**

Run:

```bash
gh pr create \
  --repo Yehor212/people-first-app \
  --base main \
  --head codex/audio-cc0-rights-pack-20260825 \
  --title 'audio: recover CC0 review package' \
  --body 'Review-only CC0 audio reconstruction tooling. No runtime audio promotion. The live workflow must produce a hash-bound technical artifact with human and runtime status still pending.'
```

The `pull_request` event is the authoritative trigger because the workflow is not yet on the default branch. Resolve the created run whose workflow is `CC0 Kimi audio review package` and whose `headSha` equals `git rev-parse HEAD`. Wait until completion. If source parsing, rights evidence, download identity, DSP, QC, or verification fails, preserve the failure and return to the owning test task; do not add a live-only bypass.

- [ ] **Step 7: Download and independently verify the exact artifact**

After a successful run:

```bash
review_root=$(mktemp -d /tmp/zenflow-cc0-review.XXXXXX)
head_sha=$(git rev-parse HEAD)
run_id=$(gh run list \
  --repo Yehor212/people-first-app \
  --workflow cc0-kimi-audio-review.yml \
  --branch codex/audio-cc0-rights-pack-20260825 \
  --limit 20 \
  --json databaseId,headSha,status,conclusion \
  | jq -er --arg head "$head_sha" \
    '[.[] | select(.headSha == $head and .status == "completed" and .conclusion == "success")] | if length == 1 then .[0].databaseId else error("expected exactly one successful exact-head run") end')
gh run download "$run_id" \
  --repo Yehor212/people-first-app \
  --name cc0-kimi-audio-review \
  --dir "$review_root"
PATH="$(pwd)/.venv-audio-review/bin:/usr/bin:/bin:/usr/sbin:/sbin" \
  .venv-audio-review/bin/python -m scripts.audio_review.verify \
  --spec config/audio/cc0-kimi-audio-review-spec.json \
  --package "$review_root"
```

Do not use “latest” or a run from a different head SHA. Expected verifier status: `TECHNICAL_PASS_HUMAN_PENDING`, 26 assets, zero denied hashes, 18 Hyperfocus outputs, and private human review pending.

- [ ] **Step 8: Create durable private evidence receipt**

Record outside Git:

- workflow URL, run ID, head SHA, artifact ID, artifact archive SHA-256, and expiry;
- downloaded package `SHA256SUMS` hash;
- `rights-ledger.json`, `provenance.json`, `qc-report.json`, `build-environment.json`, and `human-review.json` hashes;
- external recovery destination and retention owner.

Do not claim a 14-day Actions artifact is durable release evidence by itself.

---

### Task 9: Add Hash-Bound Human Review Recording

**Files:**

- Create: `scripts/audio_review/review.py`
- Modify: `scripts/audio_review/evidence.py`
- Modify: `scripts/audio_review/verify.py`
- Modify: `scripts/audio_review/tests/test_review_tool.py`
- Modify: `docs/audio/cc0-kimi-audio-review.md`

**Interfaces:**

- Consumes: independently verified package, exact asset ID/hash, human-entered reviewer identity, decision, playback contexts, attested minutes, and reasons.
- Produces: updated private `human-review.json`; it can mark `AUDIO_FIT=PASS` only after every promotion-scope Hyperfocus hash is accepted and all required attestations are present.

- [ ] **Step 1: Write RED review-state tests**

Require:

```python
def test_cannot_accept_long_loop_without_both_contexts_and_ten_minutes(self):
    row = pending_row(kind="hyperfocus")
    with self.assertRaises(ReviewError):
        record_decision(row, reviewer="Owner", decision="ACCEPT", minutes=9, contexts=["headphones"])

def test_reject_decision_requires_reason(self):
    row = pending_row(kind="hyperfocus")
    with self.assertRaises(ReviewError):
        record_decision(row, reviewer="Owner", decision="REJECT", minutes=10, contexts=["headphones", "built-in-speaker"], reasons=[])

def test_only_exact_promotion_scope_hashes_can_complete_audio_fit(self):
    matrix = complete_fixture_matrix()
    matrix["assets"][0]["sha256"] = "0" * 64
    self.assertFalse(compute_audio_fit(matrix, provenance_fixture())["pass"])
```

- [ ] **Step 2: Run HumanReview tests RED**

Run the restricted-PATH focused unittest command. Expected: missing `review.py` or symbols.

- [ ] **Step 3: Implement explicit human-only state transitions**

Use:

```python
ALLOWED_DECISIONS = frozenset({"ACCEPT", "REVISE", "REJECT"})
REQUIRED_CONTEXTS = frozenset({"headphones", "built-in-speaker"})

def record_decision(row, *, reviewer, decision, minutes, contexts, reasons, reviewed_at):
    if not reviewer.strip() or decision not in ALLOWED_DECISIONS:
        raise ReviewError("REVIEW_INPUT_INVALID")
    if row["minimumLoopMinutes"] and (minutes < 10 or not REQUIRED_CONTEXTS.issubset(contexts)):
        raise ReviewError("LISTENING_ATTESTATION_INCOMPLETE")
    if decision in {"REVISE", "REJECT"} and not reasons:
        raise ReviewError("REJECTION_REASON_REQUIRED")
    return {**row, "decision": decision, "reviewer": reviewer.strip(), "reviewedAt": reviewed_at, "attestedMinutes": minutes, "listenOn": sorted(contexts), "rejectReasons": list(reasons)}
```

No agent may populate reviewer identity or listening time. The command must prompt the human in a local terminal or accept an owner-prepared JSON input.

- [ ] **Step 4: Limit promotion eligibility to the 18 Hyperfocus rows**

Mark the eight procedurally generated comparison files `promotionScope: false`. Mark all 18 Hyperfocus rows `promotionScope: true`. `compute_audio_fit` requires exact provenance hash equality and `ACCEPT` for every promotion-scope row; it does not treat reference-only rows as runtime replacements.

- [ ] **Step 5: Verify the updated review file and re-hash the private package**

Human review intentionally changes package evidence after generation. Add `finalize-review` behavior that:

1. verifies the original package first;
2. updates only `human-review.json` from owner input;
3. rewrites `SHA256SUMS` atomically;
4. verifies the full package again;
5. emits `AUDIO_FIT_PASS_RUNTIME_UNVERIFIED` only when all 18 exact hashes are accepted.

- [ ] **Step 6: Run tests GREEN**

Run HumanReview tests, the full source-free Python suite, and the exact artifact verifier fixture.

- [ ] **Step 7: Commit**

```bash
git add scripts/audio_review/review.py scripts/audio_review/evidence.py scripts/audio_review/verify.py scripts/audio_review/tests/test_review_tool.py docs/audio/cc0-kimi-audio-review.md
git commit -m 'feat(audio): bind owner listening review'
```

- [ ] **Step 8: Hand the exact artifact to the owner**

Provide the private artifact path, `SHA256SUMS` hash, 18 promotion-scope hashes, listening instructions, and the local review command. Stop. Do not listen on behalf of the owner, fabricate duration, prefill acceptance, or start runtime promotion.

---

### Task 10: Close Phase A And Gate The Runtime Promotion Plan

**Files:**

- Modify: `.verification-done` only as ignored local evidence.
- No runtime or release file.

**Interfaces:**

- Consumes: exact committed tool tip, successful exact-head review run, downloaded artifact hashes, independent verification, and owner human-review result.
- Produces: a Phase A evidence packet and a decision to write or withhold the separate runtime promotion plan.

- [ ] **Step 1: Run the complete Phase A verification set**

Run:

```bash
npm run typecheck
npm run check:no-ai-templates
npm run check:best-practices
npm run check:agent-workspace
npm run doc-counts
npm run check:production-data-integrity:diff
PATH="$(pwd)/.venv-audio-review/bin:/usr/bin:/bin:/usr/sbin:/sbin" \
  .venv-audio-review/bin/python -m unittest discover -s scripts/audio_review/tests -v
git diff --check origin/main...HEAD
git status --short --untracked-files=all
```

Add the exact CI audio-capable test count, run URL, artifact hash, and independent verifier result to `.verification-done`. Record npm audit and scanner results without changing unrelated dependencies.

- [ ] **Step 2: Run exact-tip local commit review**

Verify:

- only approved review-tool/spec/docs/workflow paths changed;
- no MP3/WAV/source cache/private receipt/runtime asset is tracked;
- no quarantined hash appears in tracked blobs or review artifact;
- no workflow has write permission, secrets, runtime path, deploy step, or push command;
- every failed check or unavailable proof remains explicit.

- [ ] **Step 3: Decide the next gate**

Use this exact decision rule:

```text
IF technical artifact verification is not PASS:
  keep Phase A active and fix the owning task.
ELSE IF owner AUDIO_FIT is not PASS for all 18 exact hashes:
  stop at PENDING_HUMAN_REVIEW; do not write runtime plan.
ELSE IF owner/legal rights decision is not GO:
  stop at RIGHTS_REVIEW_REQUIRED; do not write runtime plan.
ELSE:
  write a new hash-specific runtime-promotion implementation plan that names all 18 accepted SHA-256 values and exact package/artifact evidence.
```

- [ ] **Step 4: Do not mark the thread goal complete**

Phase A completion is not the user's final objective. The active goal remains open through runtime promotion, cross-platform artifact proof, release approval, and truthful store/publication state.

## Spec Coverage And Deliberate Phase Boundary

| Design requirement                                                        | Owning task |
| ------------------------------------------------------------------------- | ----------- |
| Existing branch audit and non-duplication                                 | Task 1      |
| Exact live source-number binding                                          | Task 2      |
| HTTPS/host/redirect/sitemap/cache trust boundary                          | Task 3      |
| Source-specific page/license/audio receipts and truthful rights status    | Task 4      |
| Exact 9 blocked plus 17 quarantined hash denial                           | Task 5      |
| Hash-first safe package containment and inventory                         | Task 6      |
| Toolchain/action/dependency provenance                                    | Task 7      |
| Live CC0 package build, independent verification, durable private receipt | Task 8      |
| Human `AUDIO_FIT` state machine and exact-hash review                     | Task 9      |
| Completion audit and runtime-plan gate                                    | Task 10     |

The following design sections intentionally do not have production-edit tasks in Phase A: runtime integration, PWA caching, Android/iOS/Desktop packaging, stale `output/**` archive movement, rollout, rollback deployment, store submission, and publication. They require the exact 18 human-accepted output hashes and an owner/legal `GO`; neither exists before Task 9. Task 10 requires a second implementation plan with those immutable values rather than allowing generic or placeholder promotion work.

## Phase A Done Criteria

- [ ] Exact prior CC0 lineage imported and audited.
- [ ] Live grouped source number `2,715` passes an exact positive test while nearby numbers remain rejected.
- [ ] Every URL/redirect/sitemap/cache hop is host-bound and hash-verified.
- [ ] Source page and license snapshots are hash-bound in private evidence without raw source audio in the artifact.
- [ ] Rights status says evidence captured/review required, never legal clearance.
- [ ] Exact 9 blocked plus 17 quarantined hashes are machine-denied at source, candidate, and package boundaries.
- [ ] Package verifier rejects traversal, symlinks, duplicate rows, extra files, and unlisted bytes before semantic parsing.
- [ ] Python dependency wheels and GitHub Actions are SHA-pinned; build environment is recorded.
- [ ] Source-free local tests and audio-capable CI tests pass with exact counts.
- [ ] Live CC0 review artifact builds and independently verifies against the exact branch tip.
- [ ] Artifact and rights evidence are exported to a durable private location before Actions expiry.
- [ ] Human-review file is exact-hash-bound and cannot self-approve.
- [ ] Runtime paths, current runtime audio, deployments, and stores remain untouched in Phase A.

## Execution Handoff

The next execution mode is **Inline Execution** using `superpowers:executing-plans`, with a checkpoint after each task and no subagent delegation. Network source acquisition, push/workflow execution, human review, output-archive movement, runtime promotion, and release actions retain their explicit action-boundary approvals.
