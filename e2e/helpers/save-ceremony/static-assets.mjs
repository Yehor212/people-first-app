import { readFileSync, readdirSync } from "node:fs";
import { extname, join, sep } from "node:path";

const SPA_PREFIX = "/people-first-app";
const REQUEST_ORIGIN = "https://127.0.0.1";

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

function assetRecord(key, absolutePath) {
  return Object.freeze({
    body: readFileSync(absolutePath),
    contentType:
      contentTypes.get(extname(absolutePath)) || "application/octet-stream",
    key,
  });
}

export function buildStaticAssetCatalog(root) {
  const assets = new Map();

  const visit = (directory, relativeDirectory = "") => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;

      const relativePath = relativeDirectory
        ? join(relativeDirectory, entry.name)
        : entry.name;
      const absolutePath = join(directory, entry.name);

      if (entry.isDirectory()) {
        visit(absolutePath, relativePath);
        continue;
      }
      if (!entry.isFile()) continue;

      const key = `/${relativePath.split(sep).join("/")}`;
      assets.set(key, assetRecord(key, absolutePath));
    }
  };

  visit(root);
  const index = assets.get("/index.html");
  if (!index) {
    throw new Error("The save ceremony build must contain dist/index.html.");
  }

  return Object.freeze({ assets, index });
}

function normalizeRequestPath(requestUrl) {
  let url;
  try {
    url = new URL(requestUrl || "/", REQUEST_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== REQUEST_ORIGIN) return null;

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }

  if (pathname === SPA_PREFIX) pathname = "/";
  if (pathname.startsWith(`${SPA_PREFIX}/`)) {
    pathname = pathname.slice(SPA_PREFIX.length);
  }

  if (
    !pathname.startsWith("/") ||
    pathname.includes("\\") ||
    pathname.includes("\0") ||
    pathname.includes("%")
  ) {
    return null;
  }

  const segments = pathname.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    return null;
  }
  return `/${segments.join("/")}`;
}

export function selectStaticAsset(requestUrl, catalog) {
  const key = normalizeRequestPath(requestUrl);
  if (!key) return null;

  const asset = catalog.assets.get(key);
  if (asset) return asset;

  return extname(key) ? null : catalog.index;
}
