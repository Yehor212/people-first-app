import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { createServer } from "node:http";
import { basename, dirname, extname, normalize, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
const port = Number(process.env.PORT || 4183);
const artifactRoot = resolve(repoRoot, "output/playwright/pwa-update/artifacts");
const roots = {
  a: resolve(artifactRoot, "version-a"),
  b: resolve(artifactRoot, "version-b"),
};
const artifactManifestPath = resolve(artifactRoot, "artifact-manifest.json");
const requiredFiles = ["index.html", "manifest.webmanifest", "registerSW.js", "sw.js", "version.json"];
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".mp3", "audio/mpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);
const staticHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
// Loopback HTTP is a potentially trustworthy origin for service workers and is
// required here because Chrome's installed-app process rejects ephemeral TLS
// certificates even when the Playwright tab ignores certificate errors.
const baseOrigin = `http://127.0.0.1:${port}`;

if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("T146 PWA update server requires a safe unprivileged port");
}
if (!existsSync(artifactManifestPath)) {
  throw new Error("Prepare the two T146 PWA artifacts before starting the update server");
}
for (const root of Object.values(roots)) {
  for (const file of requiredFiles) {
    if (!existsSync(resolve(root, file))) throw new Error(`T146 PWA artifact is missing ${file}`);
  }
}

const artifactManifest = JSON.parse(readFileSync(artifactManifestPath, "utf8"));
let activeVersion = "a";

function buildFileManifest(root, directory = root, manifest = new Map()) {
  for (const entry of readdirSync(directory)) {
    const absolute = resolve(directory, entry);
    const stats = statSync(absolute);
    if (stats.isDirectory()) {
      buildFileManifest(root, absolute, manifest);
      continue;
    }
    if (!stats.isFile()) continue;
    const relative = absolute.slice(root.length + 1);
    manifest.set(absolute, {
      body: readFileSync(absolute),
      contentType: contentTypes.get(extname(absolute)) ?? "application/octet-stream",
      relative,
      shell: ["index.html", "sw.js", "registerSW.js", "version.json"].includes(relative),
    });
  }
  return manifest;
}

const fileManifests = {
  a: buildFileManifest(roots.a),
  b: buildFileManifest(roots.b),
};

function sendJson(response, status, value) {
  const body = Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
  response.writeHead(status, {
    ...staticHeaders,
    "Cache-Control": "no-store",
    "Content-Length": String(body.byteLength),
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(body);
}

function sendText(response, status, message) {
  const body = Buffer.from(message, "utf8");
  response.writeHead(status, {
    ...staticHeaders,
    "Cache-Control": "no-store",
    "Content-Length": String(body.byteLength),
    "Content-Type": "text/plain; charset=utf-8",
  });
  response.end(body);
}

function isLoopback(request) {
  const address = request.socket.remoteAddress ?? "";
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

function resolveAsset(root, manifest, requestUrl) {
  if (typeof requestUrl !== "string" || requestUrl.length > 2_048) return null;
  const url = new URL(requestUrl || "/", baseOrigin);
  if (url.origin !== baseOrigin) return null;
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/people-first-app") pathname = "/";
  if (pathname.startsWith("/people-first-app/")) {
    pathname = pathname.slice("/people-first-app".length);
  }
  const normalized = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  const absolute = resolve(root, `.${sep}${normalized}`);
  if (!absolute.startsWith(`${root}${sep}`) && absolute !== root) return null;
  const directoryIndex = resolve(absolute, "index.html");
  return manifest.get(absolute) ?? manifest.get(directoryIndex) ?? manifest.get(resolve(root, "index.html"));
}

const server = createServer((request, response) => {
  try {
    if (!isLoopback(request)) {
      sendText(response, 403, "Loopback only");
      return;
    }
    const url = new URL(request.url || "/", baseOrigin);
    if (url.pathname === "/__t146/state") {
      if (request.method !== "GET") {
        sendText(response, 405, "Method not allowed");
        return;
      }
      sendJson(response, 200, {
        schemaVersion: 1,
        activeVersion,
        artifact: artifactManifest.artifacts[activeVersion],
      });
      return;
    }
    if (url.pathname === "/__t146/activate-b") {
      if (
        request.method !== "POST" ||
        request.headers["x-zenflow-t146-control"] !== "activate-version-b"
      ) {
        sendText(response, 405, "Method not allowed");
        return;
      }
      activeVersion = "b";
      sendJson(response, 200, {
        schemaVersion: 1,
        activeVersion,
        artifact: artifactManifest.artifacts.b,
      });
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      sendText(response, 405, "Method not allowed");
      return;
    }
    const root = roots[activeVersion];
    const asset = resolveAsset(root, fileManifests[activeVersion], request.url);
    if (!asset) {
      sendText(response, 404, "Not found");
      return;
    }
    response.writeHead(200, {
      ...staticHeaders,
      "Cache-Control": asset.shell ? "no-store" : "public, max-age=31536000, immutable",
      "Content-Length": String(asset.body.byteLength),
      "Content-Type": asset.contentType,
      ...(basename(asset.relative) === "sw.js"
        ? { "Service-Worker-Allowed": "/people-first-app/" }
        : {}),
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    Readable.from([asset.body]).pipe(response);
  } catch {
    sendText(response, 500, "Internal server error");
  }
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`T146 PWA update server listening on ${baseOrigin}/\n`);
});
