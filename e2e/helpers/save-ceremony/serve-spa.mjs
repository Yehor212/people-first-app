import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { spawnSync } from "node:child_process";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
const root = resolve(repoRoot, "dist");
const outputRoot = resolve(repoRoot, "output/playwright/save-ceremony-server");
const port = Number(process.env.ZENFLOW_SAVE_CEREMONY_PORT || "4191");
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(
    "ZENFLOW_SAVE_CEREMONY_PORT must be a TCP port between 1 and 65535.",
  );
}
const scheme =
  process.env.ZENFLOW_SAVE_CEREMONY_SCHEME?.trim().toLowerCase() || "https";
if (scheme !== "http" && scheme !== "https") {
  throw new Error(
    "ZENFLOW_SAVE_CEREMONY_SCHEME must be either http or https.",
  );
}
const origin = `${scheme}://127.0.0.1:${port}`;

const contentTypes = new Map([
  [".br", "application/octet-stream"],
  [".css", "text/css; charset=utf-8"],
  [".gz", "application/gzip"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".mp3", "audio/mpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".tgs", "application/gzip"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function resolveAsset(requestUrl) {
  const url = new URL(requestUrl || "/", origin);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/people-first-app") pathname = "/";
  if (pathname.startsWith("/people-first-app/")) {
    pathname = pathname.slice("/people-first-app".length);
  }

  const requested = resolve(root, `.${sep}${pathname}`);
  if (requested !== root && !requested.startsWith(`${root}${sep}`)) {
    return null;
  }
  if (existsSync(requested) && statSync(requested).isFile()) return requested;
  return resolve(root, "index.html");
}

const handleRequest = (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Method not allowed");
      return;
    }

    try {
      const assetPath = resolveAsset(request.url);
      if (!assetPath || !existsSync(assetPath)) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }
      const body = readFileSync(assetPath);
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Length": String(body.length),
        "Content-Type":
          contentTypes.get(extname(assetPath)) || "application/octet-stream",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Internal server error");
    }
};

let server;
if (scheme === "https") {
  mkdirSync(outputRoot, { recursive: true });
  const keyPath = resolve(outputRoot, "localhost-key.pem");
  const certPath = resolve(outputRoot, "localhost-cert.pem");
  if (!existsSync(keyPath) || !existsSync(certPath)) {
    const result = spawnSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        keyPath,
        "-out",
        certPath,
        "-days",
        "1",
        "-subj",
        "/CN=127.0.0.1",
        "-addext",
        "subjectAltName=IP:127.0.0.1",
      ],
      { encoding: "utf8" },
    );
    if (result.status !== 0) {
      throw new Error(
        `Unable to create the local HTTPS certificate: ${result.stderr || result.stdout}`,
      );
    }
  }
  server = createHttpsServer(
    {
      cert: readFileSync(certPath),
      key: readFileSync(keyPath),
    },
    handleRequest,
  );
} else {
  server = createHttpServer(handleRequest);
}

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(
    `Journal save ceremony ${scheme.toUpperCase()} server listening on ${origin}/people-first-app/\n`,
  );
});
