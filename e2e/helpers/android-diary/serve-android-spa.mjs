import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.env.PORT || 4177);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
const root = resolve(repoRoot, "android/app/src/main/assets/public");
const fallback = join(root, "index.html");
const artifactRoot = resolve(repoRoot, "output/playwright/android-diary-e2e-20260614");
const outputCertPath = join(artifactRoot, "localhost-cert.pem");
const outputKeyPath = join(artifactRoot, "localhost-key.pem");
const tmpCertPath = join(tmpdir(), "zenflow-android-diary-localhost-cert.pem");
const tmpKeyPath = join(tmpdir(), "zenflow-android-diary-localhost-key.pem");
const certPath = process.env.HTTPS_CERT || (existsSync(outputCertPath) ? outputCertPath : tmpCertPath);
const keyPath = process.env.HTTPS_KEY || (existsSync(outputKeyPath) ? outputKeyPath : tmpKeyPath);
const tlsOptions =
  existsSync(certPath) && existsSync(keyPath)
    ? { cert: readFileSync(certPath), key: readFileSync(keyPath) }
    : null;
const protocol = tlsOptions ? "https" : "http";

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function resolveRequestPath(requestUrl) {
  const url = new URL(requestUrl || "/", `${protocol}://127.0.0.1:${port}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/people-first-app") pathname = "/";
  if (pathname.startsWith("/people-first-app/")) {
    pathname = pathname.slice("/people-first-app".length);
  }

  const normalized = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  const absolute = resolve(root, `.${sep}${normalized}`);
  return absolute.startsWith(root) ? absolute : fallback;
}

function sendFile(response, filePath) {
  const ext = extname(filePath);
  const size = statSync(filePath).size;
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Length": String(size),
    "Content-Type": contentTypes.get(ext) || "application/octet-stream",
  });
  const stream = createReadStream(filePath);
  stream.on("error", (error) => {
    if (!response.headersSent) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    }
    response.destroy(error);
  });
  stream.pipe(response);
}

const handleRequest = (request, response) => {
  try {
    let filePath = resolveRequestPath(request.url);
    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      filePath = join(filePath, "index.html");
    }
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      filePath = fallback;
    }
    sendFile(response, filePath);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(error instanceof Error ? error.message : "Unknown server error");
  }
};

const server = tlsOptions
  ? createHttpsServer(tlsOptions, handleRequest)
  : createHttpServer(handleRequest);

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(
    `Android diary SPA server listening on ${protocol}://127.0.0.1:${port}/\n`,
  );
});
