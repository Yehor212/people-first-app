from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
import hashlib
from html import unescape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import tempfile
from typing import Callable, Iterable
from urllib.parse import urljoin, urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener
import wave
import xml.etree.ElementTree as ET

from .quarantine import assert_not_quarantined

class RightsError(RuntimeError):
    pass


RIGHTS_EVIDENCE_STATUS = "RIGHTS_EVIDENCE_CAPTURED_REVIEW_REQUIRED"
RIGHTS_LEGAL_BOUNDARY = (
    "Source-specific technical evidence; not legal clearance, legal advice, "
    "exclusivity, or a warranty against third-party claims."
)


@dataclass(frozen=True)
class SourceRequest:
    sound_number: int
    provider_root: str
    license_url: str
    license_id: str

@dataclass(frozen=True)
class HttpResponse:
    url: str
    body: bytes
    content_type: str
    redirect_chain: tuple[str, ...]


class _ValidatingRedirectHandler(HTTPRedirectHandler):
    def __init__(self, validate_target: Callable[[str], None]):
        super().__init__()
        self._validate_target = validate_target
        self.redirect_chain: list[str] = []

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        target_url = urljoin(req.full_url, newurl)
        if len(self.redirect_chain) >= 5:
            raise RightsError(f"REDIRECT_LIMIT_EXCEEDED:{req.full_url}")
        self._validate_target(target_url)
        self.redirect_chain.append(target_url)
        return super().redirect_request(req, fp, code, msg, headers, target_url)

@dataclass(frozen=True)
class SourceRecord:
    sound_number: int
    title: str
    author: str
    acquired_at: str
    source_page_url: str
    audio_url: str
    license_url: str
    license_id: str
    source_page_content_type: str
    license_page_content_type: str
    audio_content_type: str
    source_page_redirect_chain: tuple[str, ...]
    license_page_redirect_chain: tuple[str, ...]
    audio_redirect_chain: tuple[str, ...]
    source_page_sha256: str
    license_page_sha256: str
    source_sha256: str
    source_bytes: int
    sample_rate_declared: int | None
    channels_declared: int | None
    local_path: Path
    rights_evidence: dict[str, bool]
    source_page_snapshot: bytes
    license_page_snapshot: bytes

    def serializable(self) -> dict:
        data = asdict(self)
        data.pop("local_path")
        data.pop("source_page_snapshot")
        data.pop("license_page_snapshot")
        return data

    def receipt_manifest(self) -> dict:
        if sha256_bytes(self.source_page_snapshot) != self.source_page_sha256:
            raise RightsError(f"RECEIPT_SNAPSHOT_HASH_MISMATCH:source-page:{self.sound_number}")
        if sha256_bytes(self.license_page_snapshot) != self.license_page_sha256:
            raise RightsError(f"RECEIPT_SNAPSHOT_HASH_MISMATCH:license-page:{self.sound_number}")
        prefix = f"evidence/rights/s{self.sound_number:04d}"
        return {
            "schemaVersion": 1,
            "soundNumber": self.sound_number,
            "title": self.title,
            "author": self.author,
            "acquiredAt": self.acquired_at,
            "licenseId": self.license_id,
            "rightsEvidence": dict(self.rights_evidence),
            "sourcePage": {
                "url": self.source_page_url,
                "artifactPath": f"{prefix}/source-page.html",
                "sha256": self.source_page_sha256,
                "bytes": len(self.source_page_snapshot),
                "contentType": self.source_page_content_type,
                "redirectChain": list(self.source_page_redirect_chain),
            },
            "licensePage": {
                "url": self.license_url,
                "artifactPath": f"{prefix}/license-page.html",
                "sha256": self.license_page_sha256,
                "bytes": len(self.license_page_snapshot),
                "contentType": self.license_page_content_type,
                "redirectChain": list(self.license_page_redirect_chain),
            },
            "audio": {
                "url": self.audio_url,
                "sha256": self.source_sha256,
                "bytes": self.source_bytes,
                "contentType": self.audio_content_type,
                "redirectChain": list(self.audio_redirect_chain),
                "includedInReviewArtifact": False,
            },
            "legalBoundary": RIGHTS_LEGAL_BOUNDARY,
        }

class _LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links: list[str] = []
        self.title_parts: list[str] = []
        self.h1_parts: list[str] = []
        self._in_title = False
        self._in_h1 = False

    def handle_starttag(self, tag, attrs):
        if tag == "title":
            self._in_title = True
        if tag == "h1":
            self._in_h1 = True
        for key, value in attrs:
            if key in {"href", "src", "data-src", "data-file", "data-url"} and value:
                self.links.append(unescape(value))

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        if tag == "h1":
            self._in_h1 = False

    def handle_data(self, data):
        if self._in_title:
            self.title_parts.append(data)
        if self._in_h1:
            self.h1_parts.append(data)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _plain_text(html: str) -> str:
    text = re.sub(r"(?is)<script.*?</script>|<style.*?</style>", " ", html)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", unescape(text)).strip()


NEGATED_RIGHTS = re.compile(
    r"(?:(?:commercial|redistribut|distribut|adapt|remix|transform).{0,30}"
    r"(?:not permitted|not allowed|prohibited|forbidden)|"
    r"(?:prohibited|forbidden|may not).{0,40}"
    r"(?:commercial|redistribut|distribut|adapt|remix|transform))",
    re.IGNORECASE,
)


def validate_cc0_license_text(text_or_html: str) -> dict[str, bool]:
    text = _plain_text(text_or_html).lower()
    if NEGATED_RIGHTS.search(text):
        raise RightsError("CC0 license evidence contains negated rights language")
    evidence = {
        "cc0": bool(re.search(r"\bcc0\b", text)) and ("1.0" in text or "creative commons zero" in text),
        "distribution": bool(re.search(r"copy.{0,40}(?:redistribute|distribute)|share.{0,50}copy|distribut", text)),
        "adaptation": bool(re.search(r"adapt|remix|transform|build upon", text)),
        "commercial": bool(re.search(r"commercial(?:ly| purposes| use)?", text)),
    }
    if not all(evidence.values()):
        missing = ", ".join(key for key, value in evidence.items() if not value)
        raise RightsError(f"CC0 license evidence is incomplete: {missing}")
    return evidence

class HttpClient:
    def __init__(self, cache_dir: str | Path, *, offline: bool = False, allow_http_hosts: Iterable[str] = (), timeout: float = 20.0):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.offline = offline
        self.allow_http_hosts = {host.lower().rstrip(".") for host in allow_http_hosts}
        self.timeout = timeout

    def _validate_url(self, url: str, *, allowed_hosts: frozenset[str] | None = None) -> None:
        parsed = urlparse(url)
        if parsed.username is not None or parsed.password is not None or parsed.fragment:
            raise RightsError(f"URL contains forbidden authority or fragment: {url}")
        try:
            hostname = parsed.hostname
            port = parsed.port
        except ValueError as exc:
            raise RightsError(f"URL has an invalid port: {url}") from exc
        if not hostname:
            raise RightsError(f"URL has no hostname: {url}")
        host = hostname.lower().rstrip(".")
        normalized_allowed_hosts = (
            frozenset(item.lower().rstrip(".") for item in allowed_hosts)
            if allowed_hosts is not None
            else None
        )
        if normalized_allowed_hosts is not None and host not in normalized_allowed_hosts:
            raise RightsError(f"URL host is outside the request allowlist: {host}")
        if port not in (None, 443) and not (
            parsed.scheme == "http" and host in self.allow_http_hosts
        ):
            raise RightsError(f"URL uses an unexpected port: {url}")
        if parsed.scheme == "https":
            return
        if parsed.scheme == "http" and host in self.allow_http_hosts:
            return
        raise RightsError(f"Only HTTPS is allowed outside explicit test hosts: {url}")

    def fetch(
        self,
        url: str,
        *,
        max_bytes: int = 100 * 1024 * 1024,
        allowed_hosts: frozenset[str] | None = None,
    ) -> HttpResponse:
        self._validate_url(url, allowed_hosts=allowed_hosts)
        key = hashlib.sha256(url.encode("utf-8")).hexdigest()
        http_dir = self.cache_dir / "http"
        body_path = http_dir / f"{key}.body"
        meta_path = http_dir / f"{key}.json"
        if body_path.is_symlink() or meta_path.is_symlink():
            raise RightsError(f"CACHE_SYMLINK_REJECTED:{url}")
        body_exists = body_path.exists()
        meta_exists = meta_path.exists()
        if body_exists != meta_exists:
            raise RightsError(f"CACHE_METADATA_INVALID:{url}")
        if body_exists and meta_exists:
            if not body_path.is_file() or not meta_path.is_file():
                raise RightsError(f"CACHE_METADATA_INVALID:{url}")
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
            except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise RightsError(f"CACHE_METADATA_INVALID:{url}") from exc
            required = {"url", "contentType", "sha256", "bytes", "redirectChain"}
            if not isinstance(meta, dict) or not required.issubset(meta):
                raise RightsError(f"CACHE_METADATA_INVALID:{url}")
            redirect_chain = meta["redirectChain"]
            if (
                not isinstance(meta["url"], str)
                or not isinstance(meta["contentType"], str)
                or not isinstance(meta["sha256"], str)
                or re.fullmatch(r"[0-9a-f]{64}", meta["sha256"]) is None
                or not isinstance(meta["bytes"], int)
                or isinstance(meta["bytes"], bool)
                or meta["bytes"] < 0
                or not isinstance(redirect_chain, list)
                or len(redirect_chain) > 5
                or any(not isinstance(hop, str) for hop in redirect_chain)
                or (redirect_chain and redirect_chain[-1] != meta["url"])
            ):
                raise RightsError(f"CACHE_METADATA_INVALID:{url}")
            body = body_path.read_bytes()
            if len(body) != meta["bytes"] or sha256_bytes(body) != meta["sha256"]:
                raise RightsError(f"CACHE_INTEGRITY_MISMATCH:{url}")
            if len(body) > max_bytes:
                raise RightsError(f"Response exceeds byte limit: {url}")
            self._validate_url(meta["url"], allowed_hosts=allowed_hosts)
            for hop in redirect_chain:
                self._validate_url(hop, allowed_hosts=allowed_hosts)
            return HttpResponse(
                meta["url"],
                body,
                meta["contentType"],
                tuple(redirect_chain),
            )
        if self.offline:
            raise RightsError(f"Offline cache miss: {url}")
        request = Request(url, headers={"User-Agent": "ZenFlow-Audio-Provenance/1.0 (+https://github.com/Yehor212/people-first-app)"})
        redirect_handler = _ValidatingRedirectHandler(
            lambda target: self._validate_url(target, allowed_hosts=allowed_hosts)
        )
        opener = build_opener(redirect_handler)
        try:
            with opener.open(request, timeout=self.timeout) as response:
                final_url = response.geturl()
                self._validate_url(final_url, allowed_hosts=allowed_hosts)
                declared = response.headers.get("Content-Length")
                if declared and int(declared) > max_bytes:
                    raise RightsError(f"Response exceeds byte limit: {url}")
                body = response.read(max_bytes + 1)
                if len(body) > max_bytes:
                    raise RightsError(f"Response exceeds byte limit: {url}")
                content_type = response.headers.get_content_type() or ""
        except RightsError:
            raise
        except Exception as exc:
            raise RightsError(f"HTTP fetch failed for {url}: {exc}") from exc
        http_dir.mkdir(parents=True, exist_ok=True)
        meta = {
            "url": final_url,
            "contentType": content_type,
            "sha256": sha256_bytes(body),
            "bytes": len(body),
            "redirectChain": redirect_handler.redirect_chain,
        }
        temp_body: Path | None = None
        temp_meta: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(
                dir=http_dir,
                prefix=f".{key}.",
                suffix=".body.tmp",
                delete=False,
            ) as tmp:
                tmp.write(body)
                temp_body = Path(tmp.name)
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                dir=http_dir,
                prefix=f".{key}.",
                suffix=".json.tmp",
                delete=False,
            ) as tmp:
                json.dump(meta, tmp, sort_keys=True)
                temp_meta = Path(tmp.name)
            temp_body.replace(body_path)
            temp_body = None
            temp_meta.replace(meta_path)
            temp_meta = None
        finally:
            if temp_body is not None:
                temp_body.unlink(missing_ok=True)
            if temp_meta is not None:
                temp_meta.unlink(missing_ok=True)
        return HttpResponse(
            final_url,
            body,
            content_type,
            tuple(redirect_handler.redirect_chain),
        )


def _parse_sitemap(xml_bytes: bytes) -> list[str]:
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError as exc:
        raise RightsError(f"Invalid sitemap XML: {exc}") from exc
    return [element.text.strip() for element in root.iter() if element.tag.rsplit("}", 1)[-1] == "loc" and element.text]


def _collect_sitemap_urls(
    client: HttpClient,
    provider_root: str,
    *,
    allowed_hosts: frozenset[str],
) -> list[str]:
    candidates = [urljoin(provider_root, "sitemap.xml"), urljoin(provider_root, "sitemap_index.xml")]
    errors: list[str] = []
    for candidate in candidates:
        try:
            response = client.fetch(
                candidate,
                max_bytes=20 * 1024 * 1024,
                allowed_hosts=allowed_hosts,
            )
            locations = _parse_sitemap(response.body)
            pages: list[str] = []
            for loc in locations:
                try:
                    client._validate_url(loc, allowed_hosts=allowed_hosts)
                except RightsError as exc:
                    raise RightsError(f"SITEMAP_HOST_MISMATCH:{loc}: {exc}") from exc
                if urlparse(loc).path.lower().endswith(".xml"):
                    child = client.fetch(
                        loc,
                        max_bytes=20 * 1024 * 1024,
                        allowed_hosts=allowed_hosts,
                    )
                    for page in _parse_sitemap(child.body):
                        try:
                            client._validate_url(page, allowed_hosts=allowed_hosts)
                        except RightsError as exc:
                            raise RightsError(f"SITEMAP_HOST_MISMATCH:{page}: {exc}") from exc
                        pages.append(page)
                else:
                    pages.append(loc)
            if pages:
                return pages
        except RightsError as exc:
            if str(exc).startswith("SITEMAP_HOST_MISMATCH:"):
                raise
            errors.append(str(exc))
    raise RightsError("No usable provider sitemap: " + " | ".join(errors))


def resolve_sound_page(
    sound_number: int,
    provider_root: str,
    client: HttpClient,
    *,
    allowed_hosts: frozenset[str],
) -> str:
    pattern = re.compile(rf"s0*{sound_number}\.html$", re.IGNORECASE)
    matches = [
        url
        for url in _collect_sitemap_urls(
            client,
            provider_root,
            allowed_hosts=allowed_hosts,
        )
        if pattern.search(urlparse(url).path)
    ]
    unique = list(dict.fromkeys(matches))
    if len(unique) != 1:
        raise RightsError(f"Expected one sitemap page for sound {sound_number}, found {len(unique)}")
    return unique[0]


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


def _extract_page(html: str, page_url: str, sound_number: int) -> tuple[str, str, list[str]]:
    text = _plain_text(html)
    page_path = urlparse(page_url).path
    if not re.search(rf"s0*{sound_number}\.html$", page_path, re.IGNORECASE):
        raise RightsError(f"Source page URL is not bound to sound {sound_number}")
    if not sound_number_text_pattern(sound_number).search(text):
        raise RightsError(f"Source page body is not bound to sound {sound_number}")
    if not re.search(r"\bcc0\b", text, re.IGNORECASE):
        raise RightsError(f"Source page for sound {sound_number} does not identify CC0")
    parser = _LinkParser()
    parser.feed(html)
    title = " ".join(parser.h1_parts).strip() or " ".join(parser.title_parts).strip()
    title = re.sub(r"\s+", " ", title)[:300] or f"Sound {sound_number}"
    author_match = re.search(r"(?:author|recorded by|auteur|credit)[\s:–-]+([^|•]+?)(?=\s+(?:license|sound\s*(?:number|no\.?|n°)|format|duration)\b|$)", text, re.IGNORECASE)
    if not author_match:
        raise RightsError(f"AUTHOR_NOT_STATED:{sound_number}")
    author = re.sub(r"\s+", " ", author_match.group(1)).strip()[:200]
    if not author:
        raise RightsError(f"AUTHOR_NOT_STATED:{sound_number}")
    links = [urljoin(page_url, link) for link in parser.links]
    for match in re.findall(r"(?i)(?:https?:)?//[^\s\"'<>]+|[\w./%-]+\.(?:wav|flac|mp3|ogg)(?:\?[^\s\"'<>]*)?", html):
        links.append(urljoin(page_url, match))
    return title, author, list(dict.fromkeys(links))


def _audio_magic(body: bytes) -> str | None:
    if len(body) >= 12 and body[:4] == b"RIFF" and body[8:12] == b"WAVE":
        return "wav"
    if body.startswith(b"fLaC"):
        return "flac"
    if body.startswith(b"OggS"):
        return "ogg"
    if body.startswith(b"ID3") or any(body[i] == 0xFF and (body[i + 1] & 0xE0) == 0xE0 for i in range(min(len(body) - 1, 4096))):
        return "mp3"
    return None


def _declared_wav_format(path: Path) -> tuple[int | None, int | None]:
    try:
        with wave.open(str(path), "rb") as src:
            return src.getframerate(), src.getnchannels()
    except (wave.Error, EOFError):
        return None, None


def acquire_source(
    request: SourceRequest,
    client: HttpClient,
    *,
    denylist: frozenset[str],
) -> SourceRecord:
    if request.license_id != "CC0-1.0":
        raise RightsError(f"Unsupported source license: {request.license_id}")
    provider_host = (urlparse(request.provider_root).hostname or "").lower().rstrip(".")
    if not provider_host:
        raise RightsError(f"Provider root has no hostname: {request.provider_root}")
    allowed_hosts = frozenset({provider_host})
    client._validate_url(request.provider_root, allowed_hosts=allowed_hosts)
    client._validate_url(request.license_url, allowed_hosts=allowed_hosts)
    page_url = resolve_sound_page(
        request.sound_number,
        request.provider_root,
        client,
        allowed_hosts=allowed_hosts,
    )
    page_response = client.fetch(
        page_url,
        max_bytes=5 * 1024 * 1024,
        allowed_hosts=allowed_hosts,
    )
    license_response = client.fetch(
        request.license_url,
        max_bytes=5 * 1024 * 1024,
        allowed_hosts=allowed_hosts,
    )
    rights = validate_cc0_license_text(license_response.body.decode("utf-8", "replace"))
    html = page_response.body.decode("utf-8", "replace")
    title, author, links = _extract_page(html, page_response.url, request.sound_number)
    number_pattern = re.compile(
        rf"(?<!\d)0*{re.escape(str(request.sound_number))}(?!\d)"
    )
    audio_candidates = []
    for url in links:
        parsed = urlparse(url)
        if not parsed.hostname:
            continue
        host = parsed.hostname.lower().rstrip(".")
        if host != provider_host:
            continue
        lower = url.lower()
        if number_pattern.search(parsed.path + "?" + parsed.query) is None:
            continue
        if re.search(r"\.(?:wav|flac|mp3|ogg)(?:$|\?)", lower) or "download" in lower or "upload" in lower:
            audio_candidates.append(url)
    if not audio_candidates:
        raise RightsError(f"No sound-number-bound audio URL found for {request.sound_number}")
    rank = {"wav": 0, "flac": 1, "mp3": 2, "ogg": 3}
    selected: tuple[HttpResponse, str] | None = None
    failures: list[str] = []
    for candidate in audio_candidates:
        try:
            response = client.fetch(
                candidate,
                max_bytes=100 * 1024 * 1024,
                allowed_hosts=allowed_hosts,
            )
            kind = _audio_magic(response.body)
            if not kind:
                raise RightsError("download is not recognized audio")
            if selected is None or rank[kind] < rank[selected[1]]:
                selected = (response, kind)
                if kind == "wav":
                    break
        except RightsError as exc:
            failures.append(f"{candidate}: {exc}")
    if selected is None:
        raise RightsError("No valid source audio: " + " | ".join(failures))
    response, extension = selected
    source_sha256 = assert_not_quarantined(
        response.body,
        f"source:s{request.sound_number:04d}",
        denylist,
    )
    source_dir = client.cache_dir / "sources"
    source_dir.mkdir(parents=True, exist_ok=True)
    local_path = source_dir / f"bigsoundbank-s{request.sound_number:04d}-{source_sha256[:16]}.{extension}"
    if local_path.is_symlink():
        raise RightsError(f"SOURCE_CACHE_SYMLINK_REJECTED:s{request.sound_number:04d}")
    if local_path.exists():
        cached_source_sha256 = assert_not_quarantined(
            local_path.read_bytes(),
            f"source-cache:s{request.sound_number:04d}",
            denylist,
        )
        if cached_source_sha256 != source_sha256:
            raise RightsError(f"SOURCE_CACHE_INTEGRITY_MISMATCH:s{request.sound_number:04d}")
    else:
        with tempfile.NamedTemporaryFile(dir=source_dir, delete=False) as tmp:
            tmp.write(response.body)
            temp_path = Path(tmp.name)
        temp_path.replace(local_path)
    sample_rate, channels = _declared_wav_format(local_path) if extension == "wav" else (None, None)
    return SourceRecord(
        sound_number=request.sound_number,
        title=title,
        author=author,
        acquired_at=_utc_timestamp(),
        source_page_url=page_response.url,
        audio_url=response.url,
        license_url=license_response.url,
        license_id=request.license_id,
        source_page_content_type=page_response.content_type,
        license_page_content_type=license_response.content_type,
        audio_content_type=response.content_type,
        source_page_redirect_chain=page_response.redirect_chain,
        license_page_redirect_chain=license_response.redirect_chain,
        audio_redirect_chain=response.redirect_chain,
        source_page_sha256=sha256_bytes(page_response.body),
        license_page_sha256=sha256_bytes(license_response.body),
        source_sha256=source_sha256,
        source_bytes=len(response.body),
        sample_rate_declared=sample_rate,
        channels_declared=channels,
        local_path=local_path,
        rights_evidence=rights,
        source_page_snapshot=page_response.body,
        license_page_snapshot=license_response.body,
    )
