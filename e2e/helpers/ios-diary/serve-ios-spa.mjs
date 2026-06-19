import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createServer as createHttpsServer } from "node:https";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, normalize, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const port = Number(process.env.PORT || 4188);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
const root = resolve(repoRoot, "ios/App/App/public");
const fallback = join(root, "index.html");
const artifactRoot = resolve(repoRoot, "output/playwright/ios-diary-e2e-20260614");
const outputCertPath = join(artifactRoot, "localhost-cert.pem");
const outputKeyPath = join(artifactRoot, "localhost-key.pem");
const tmpCertPath = join(tmpdir(), "zenflow-ios-diary-localhost-cert.pem");
const tmpKeyPath = join(tmpdir(), "zenflow-ios-diary-localhost-key.pem");
const requestBuckets = new Map();
const REQUEST_WINDOW_MS = 1_000;
const REQUEST_LIMIT_PER_WINDOW = 240;
const STALE_DUPLICATE_ASSET_SUFFIX = / \d+(?=(\.[^.]+)?$)/;
const ALLOWED_METHODS = new Set(["GET", "HEAD"]);
const STATIC_RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

function createLocalCertificate() {
  mkdirSync(artifactRoot, { recursive: true });
  const result = spawnSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      outputKeyPath,
      "-out",
      outputCertPath,
      "-days",
      "1",
      "-subj",
      "/CN=127.0.0.1",
      "-addext",
      "subjectAltName=IP:127.0.0.1,DNS:localhost",
    ],
    { stdio: "ignore" },
  );
  return result.status === 0 && existsSync(outputCertPath) && existsSync(outputKeyPath);
}

if (
  !process.env.HTTPS_CERT &&
  !process.env.HTTPS_KEY &&
  !existsSync(outputCertPath) &&
  !existsSync(outputKeyPath) &&
  !existsSync(tmpCertPath) &&
  !existsSync(tmpKeyPath)
) {
  createLocalCertificate();
}

const certPath = process.env.HTTPS_CERT || (existsSync(outputCertPath) ? outputCertPath : tmpCertPath);
const keyPath = process.env.HTTPS_KEY || (existsSync(outputKeyPath) ? outputKeyPath : tmpKeyPath);
const tlsOptions =
  existsSync(certPath) && existsSync(keyPath)
    ? { cert: readFileSync(certPath), key: readFileSync(keyPath) }
    : null;
if (!tlsOptions) {
  throw new Error("iOS diary local server requires HTTPS certificate and key files.");
}
const protocol = "https";

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".mp3", "audio/mpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function buildFileManifest(directory, manifest = new Map()) {
  for (const entry of readdirSync(directory)) {
    if (STALE_DUPLICATE_ASSET_SUFFIX.test(entry)) {
      continue;
    }

    const entryPath = join(directory, entry);
    const stats = statSync(entryPath);
    if (stats.isDirectory()) {
      buildFileManifest(entryPath, manifest);
      continue;
    }

    if (stats.isFile()) {
      const ext = extname(entryPath);
      manifest.set(entryPath, {
        body: readFileSync(entryPath),
        contentType: contentTypes.get(ext) || "application/octet-stream",
        path: entryPath,
        size: stats.size,
      });
    }
  }
  return manifest;
}

const fileManifest = buildFileManifest(root);

function resolveRequestAsset(requestUrl) {
  const url = new URL(requestUrl || "/", `${protocol}://127.0.0.1:${port}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/people-first-app") pathname = "/";
  if (pathname.startsWith("/people-first-app/")) {
    pathname = pathname.slice("/people-first-app".length);
  }

  const normalized = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  if (STALE_DUPLICATE_ASSET_SUFFIX.test(basename(normalized))) {
    return fileManifest.get(fallback);
  }

  const absolute = resolve(root, `.${sep}${normalized}`);
  if (!absolute.startsWith(root)) return fileManifest.get(fallback);

  return (
    fileManifest.get(absolute) ??
    fileManifest.get(join(absolute, "index.html")) ??
    fileManifest.get(fallback)
  );
}

function sendFile(request, response, asset) {
  const headers = {
    ...STATIC_RESPONSE_HEADERS,
    "Content-Length": String(asset.size),
    "Content-Type": asset.contentType,
  };

  response.writeHead(200, headers);
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  Readable.from([asset.body]).pipe(response);
}

function sendPlain(response, statusCode, message) {
  response.writeHead(statusCode, {
    ...STATIC_RESPONSE_HEADERS,
    "Content-Type": "text/plain; charset=utf-8",
  });
  response.end(message);
}

function rejectUnsafeRequest(request, response) {
  if (!ALLOWED_METHODS.has(request.method || "")) {
    sendPlain(response, 405, "Method not allowed");
    return true;
  }
  if (isRateLimited(request)) {
    sendPlain(response, 429, "Too many requests");
    return true;
  }
  return false;
}

function isRateLimited(request) {
  const key = request.socket.remoteAddress || "127.0.0.1";
  const now = Date.now();
  const bucket = requestBuckets.get(key);
  if (!bucket || now - bucket.startedAt > REQUEST_WINDOW_MS) {
    requestBuckets.set(key, { count: 1, startedAt: now });
    return false;
  }

  bucket.count += 1;
  return bucket.count > REQUEST_LIMIT_PER_WINDOW;
}

const handleStaticAssetRequest = (request, response) => {
  try {
    if (rejectUnsafeRequest(request, response)) return;
    const asset = resolveRequestAsset(request.url);
    if (!asset) {
      sendPlain(response, 404, "Not found");
      return;
    }
    sendFile(request, response, asset);
  } catch {
    sendPlain(response, 500, "Internal server error");
  }
};

const server = createHttpsServer(tlsOptions, handleStaticAssetRequest);

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`iOS diary SPA server listening on ${protocol}://127.0.0.1:${port}/\n`);
});
