from __future__ import annotations

from dataclasses import asdict, dataclass
import hashlib
from html import unescape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import tempfile
from typing import Iterable
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
import wave
import xml.etree.ElementTree as ET

class RightsError(RuntimeError):
    pass

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

@dataclass(frozen=True)
class SourceRecord:
    sound_number: int
    title: str
    author: str
    source_page_url: str
    audio_url: str
    license_url: str
    license_id: str
    source_page_sha256: str
    license_page_sha256: str
    source_sha256: str
    source_bytes: int
    sample_rate_declared: int | None
    channels_declared: int | None
    local_path: Path
    rights_evidence: dict[str, bool]

    def serializable(self) -> dict:
        data = asdict(self)
        data.pop("local_path")
        return data

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


def _plain_text(html: str) -> str:
    text = re.sub(r"(?is)<script.*?</script>|<style.*?</style>", " ", html)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", unescape(text)).strip()


def validate_cc0_license_text(text_or_html: str) -> dict[str, bool]:
    text = _plain_text(text_or_html).lower()
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
        self.allow_http_hosts = set(allow_http_hosts)
        self.timeout = timeout

    def _validate_url(self, url: str) -> None:
        parsed = urlparse(url)
        if not parsed.hostname:
            raise RightsError(f"URL has no hostname: {url}")
        if parsed.scheme == "https":
            return
        if parsed.scheme == "http" and parsed.hostname in self.allow_http_hosts:
            return
        raise RightsError(f"Only HTTPS is allowed outside explicit test hosts: {url}")

    def fetch(self, url: str, *, max_bytes: int = 100 * 1024 * 1024) -> HttpResponse:
        self._validate_url(url)
        key = hashlib.sha256(url.encode("utf-8")).hexdigest()
        body_path = self.cache_dir / "http" / f"{key}.body"
        meta_path = self.cache_dir / "http" / f"{key}.json"
        if body_path.exists() and meta_path.exists():
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            return HttpResponse(meta["url"], body_path.read_bytes(), meta.get("contentType", ""))
        if self.offline:
            raise RightsError(f"Offline cache miss: {url}")
        request = Request(url, headers={"User-Agent": "ZenFlow-Audio-Provenance/1.0 (+https://github.com/Yehor212/people-first-app)"})
        try:
            with urlopen(request, timeout=self.timeout) as response:
                final_url = response.geturl()
                self._validate_url(final_url)
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
        body_path.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=body_path.parent, delete=False) as tmp:
            tmp.write(body)
            temp_body = Path(tmp.name)
        temp_body.replace(body_path)
        meta = {"url": final_url, "contentType": content_type, "sha256": sha256_bytes(body), "bytes": len(body)}
        temp_meta = meta_path.with_suffix(".tmp")
        temp_meta.write_text(json.dumps(meta, sort_keys=True), encoding="utf-8")
        temp_meta.replace(meta_path)
        return HttpResponse(final_url, body, content_type)


def _parse_sitemap(xml_bytes: bytes) -> list[str]:
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError as exc:
        raise RightsError(f"Invalid sitemap XML: {exc}") from exc
    return [element.text.strip() for element in root.iter() if element.tag.rsplit("}", 1)[-1] == "loc" and element.text]


def _collect_sitemap_urls(client: HttpClient, provider_root: str) -> list[str]:
    candidates = [urljoin(provider_root, "sitemap.xml"), urljoin(provider_root, "sitemap_index.xml")]
    errors: list[str] = []
    for candidate in candidates:
        try:
            response = client.fetch(candidate, max_bytes=20 * 1024 * 1024)
            locations = _parse_sitemap(response.body)
            pages: list[str] = []
            for loc in locations:
                if loc.lower().endswith(".xml"):
                    child = client.fetch(loc, max_bytes=20 * 1024 * 1024)
                    pages.extend(_parse_sitemap(child.body))
                else:
                    pages.append(loc)
            if pages:
                return pages
        except RightsError as exc:
            errors.append(str(exc))
    raise RightsError("No usable provider sitemap: " + " | ".join(errors))


def resolve_sound_page(sound_number: int, provider_root: str, client: HttpClient) -> str:
    pattern = re.compile(rf"s0*{sound_number}\.html$", re.IGNORECASE)
    matches = [url for url in _collect_sitemap_urls(client, provider_root) if pattern.search(urlparse(url).path)]
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
    author = re.sub(r"\s+", " ", author_match.group(1)).strip()[:200] if author_match else "Not stated on parsed page"
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


def acquire_source(request: SourceRequest, client: HttpClient) -> SourceRecord:
    if request.license_id != "CC0-1.0":
        raise RightsError(f"Unsupported source license: {request.license_id}")
    page_url = resolve_sound_page(request.sound_number, request.provider_root, client)
    page_response = client.fetch(page_url, max_bytes=5 * 1024 * 1024)
    license_response = client.fetch(request.license_url, max_bytes=5 * 1024 * 1024)
    rights = validate_cc0_license_text(license_response.body.decode("utf-8", "replace"))
    html = page_response.body.decode("utf-8", "replace")
    title, author, links = _extract_page(html, page_response.url, request.sound_number)
    number_tokens = {str(request.sound_number), f"{request.sound_number:04d}"}
    audio_candidates = []
    for url in links:
        parsed = urlparse(url)
        if not parsed.hostname:
            continue
        host = parsed.hostname.lower()
        provider_host = urlparse(request.provider_root).hostname or ""
        if host != provider_host and not host.endswith("." + provider_host):
            continue
        lower = url.lower()
        if not any(token in (parsed.path + "?" + parsed.query) for token in number_tokens):
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
            response = client.fetch(candidate, max_bytes=100 * 1024 * 1024)
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
    source_dir = client.cache_dir / "sources"
    source_dir.mkdir(parents=True, exist_ok=True)
    local_path = source_dir / f"bigsoundbank-s{request.sound_number:04d}-{sha256_bytes(response.body)[:16]}.{extension}"
    if not local_path.exists():
        with tempfile.NamedTemporaryFile(dir=source_dir, delete=False) as tmp:
            tmp.write(response.body)
            temp_path = Path(tmp.name)
        temp_path.replace(local_path)
    sample_rate, channels = _declared_wav_format(local_path) if extension == "wav" else (None, None)
    return SourceRecord(
        sound_number=request.sound_number,
        title=title,
        author=author,
        source_page_url=page_response.url,
        audio_url=response.url,
        license_url=license_response.url,
        license_id=request.license_id,
        source_page_sha256=sha256_bytes(page_response.body),
        license_page_sha256=sha256_bytes(license_response.body),
        source_sha256=sha256_bytes(response.body),
        source_bytes=len(response.body),
        sample_rate_declared=sample_rate,
        channels_declared=channels,
        local_path=local_path,
        rights_evidence=rights,
    )
