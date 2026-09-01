import { afterEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { gzipSync } from "node:zlib";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { computeWorkboxRevision, extractServiceWorkerPrecacheUrls, verifyReleaseArtifactIntegrity } =
  require("../check-release-artifact-integrity.cjs") as {
    computeWorkboxRevision: (content: string | Uint8Array) => string;
    extractServiceWorkerPrecacheUrls: (source: string) => string[];
    verifyReleaseArtifactIntegrity: (
      root: string,
      options?: { allowedRoot?: string }
    ) => { checkedPrecacheUrls: number };
  };

const tempRoots: string[] = [];
const { pwaInstallIconRevision } = JSON.parse(
  readFileSync("config/brand-logo-assets.json", "utf8")
) as { pwaInstallIconRevision: string };
const directRoutes = ["orb", "habits", "diary", "planning", "settings", "desktop"];
const indexHtml =
  "<!doctype html><html><head>" +
  `<link rel="manifest" href="/people-first-app/manifest.webmanifest?v=${pwaInstallIconRevision}">` +
  '</head><body><div id="root"></div></body></html>';
const indexRevision = computeWorkboxRevision(indexHtml);
const indexPrecacheEntry = `{url:"/people-first-app/index.html",revision:"${indexRevision}"}`;

function precache(...entries: string[]): string {
  return `precacheAndRoute([${entries.join(",")}],{});`;
}

function fixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), "zenflow-release-integrity-"));
  tempRoots.push(root);
  return root;
}

function writeFixture(root: string, relPath: string, content: string | Uint8Array = relPath) {
  const absPath = join(root, relPath);
  mkdirSync(join(absPath, ".."), { recursive: true });
  writeFileSync(absPath, content);
  return absPath;
}

function writeMinimalPwaArtifact(root: string, swContent?: string) {
  writeFixture(root, "index.html", indexHtml);
  for (const route of directRoutes) writeFixture(root, `${route}/index.html`, indexHtml);
  writeFixture(root, "manifest.webmanifest", JSON.stringify({ name: "ZenFlow" }));
  writeFixture(
    root,
    "registerSW.js",
    "navigator.serviceWorker?.register('/people-first-app/sw.js');"
  );
  writeFixture(root, "sw.js", swContent ?? precache(indexPrecacheEntry));
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("release artifact integrity", () => {
  it("extracts Workbox precache URLs from generated service workers", () => {
    const sw =
      'precacheAndRoute([{url:"/people-first-app/assets/index.js",revision:"1"},{"revision":"2","url":"orb/"}],{});';

    expect(extractServiceWorkerPrecacheUrls(sw)).toEqual([
      "/people-first-app/assets/index.js",
      "orb/",
    ]);
  });

  it("fails when a staged service worker precaches a missing file", () => {
    const root = fixtureRoot();
    writeMinimalPwaArtifact(
      root,
      precache(indexPrecacheEntry, '{url:"/people-first-app/assets/missing.js",revision:null}')
    );

    expect(() => verifyReleaseArtifactIntegrity(root, { allowedRoot: root })).toThrow(
      "Service worker precache references missing artifact(s)"
    );
  });

  it("fails when the service worker precaches an external absolute URL", () => {
    const root = fixtureRoot();
    writeMinimalPwaArtifact(
      root,
      precache(indexPrecacheEntry, '{url:"https://evil.invalid/missing.js",revision:null}')
    );

    expect(() => verifyReleaseArtifactIntegrity(root, { allowedRoot: root })).toThrow(
      "Service worker precache URL must be local"
    );
  });

  it("fails when a precache target is a directory instead of a regular file", () => {
    const root = fixtureRoot();
    writeMinimalPwaArtifact(root, precache(indexPrecacheEntry, '{url:"assets",revision:null}'));
    mkdirSync(join(root, "assets"), { recursive: true });

    expect(() => verifyReleaseArtifactIntegrity(root, { allowedRoot: root })).toThrow(
      "Service worker precache target is not a regular file: assets"
    );
  });

  it("fails when the staged artifact is missing required PWA shell files", () => {
    const root = fixtureRoot();
    writeFixture(root, "index.html", "<!doctype html>");

    expect(() => verifyReleaseArtifactIntegrity(root, { allowedRoot: root })).toThrow(
      "Release artifact missing required PWA file(s)"
    );
  });

  it("fails when the service worker has no precache URLs", () => {
    const root = fixtureRoot();
    writeMinimalPwaArtifact(root, "self.addEventListener('install', () => {});");

    expect(() => verifyReleaseArtifactIntegrity(root, { allowedRoot: root })).toThrow(
      "Service worker precache contains no URLs"
    );
  });

  it("fails when the service worker precaches the same URL more than once", () => {
    const root = fixtureRoot();
    writeMinimalPwaArtifact(root, precache(indexPrecacheEntry, indexPrecacheEntry));

    expect(() => verifyReleaseArtifactIntegrity(root, { allowedRoot: root })).toThrow(
      "Service worker precache contains duplicate URL(s): /people-first-app/index.html"
    );
  });

  it("fails when relative and scoped-absolute URLs resolve to the same precache identity", () => {
    const root = fixtureRoot();
    writeMinimalPwaArtifact(
      root,
      precache(`{url:"index.html",revision:"${indexRevision}"}`, indexPrecacheEntry)
    );

    expect(() => verifyReleaseArtifactIntegrity(root, { allowedRoot: root })).toThrow(
      "Service worker precache contains duplicate URL identity: index.html"
    );
  });

  it("keeps query-distinct precache identities separate", () => {
    const root = fixtureRoot();
    writeMinimalPwaArtifact(
      root,
      precache(
        indexPrecacheEntry,
        '{url:"index.html?locale=en",revision:null}',
        '{url:"/people-first-app/index.html?locale=uk",revision:null}'
      )
    );

    expect(() => verifyReleaseArtifactIntegrity(root, { allowedRoot: root })).not.toThrow();
  });

  it("fails when a revisioned precache entry no longer matches the artifact bytes", () => {
    const root = fixtureRoot();
    writeMinimalPwaArtifact(
      root,
      precache('{url:"index.html",revision:"00000000000000000000000000000000"}')
    );

    expect(() => verifyReleaseArtifactIntegrity(root, { allowedRoot: root })).toThrow(
      "Service worker precache revision mismatch: index.html"
    );
  });

  it("fails when the app-shell index is absent from the service worker precache", () => {
    const root = fixtureRoot();
    writeMinimalPwaArtifact(root, precache('{url:"assets/index.js",revision:null}'));
    writeFixture(root, "assets/index.js", "content");

    expect(() => verifyReleaseArtifactIntegrity(root, { allowedRoot: root })).toThrow(
      "Service worker precache must contain exactly one app-shell index entry"
    );
  });

  it("fails when a compressed index representation is stale", () => {
    const root = fixtureRoot();
    writeMinimalPwaArtifact(root);
    writeFixture(root, "index.html.gz", gzipSync("stale index"));

    expect(() => verifyReleaseArtifactIntegrity(root, { allowedRoot: root })).toThrow(
      "Compressed index representation does not match index.html: index.html.gz"
    );
  });

  it("fails when the root entrypoint lacks one cache-busted manifest link", () => {
    const root = fixtureRoot();
    writeMinimalPwaArtifact(root);
    writeFixture(root, "index.html", '<!doctype html><div id="root"></div>');

    expect(() => verifyReleaseArtifactIntegrity(root, { allowedRoot: root })).toThrow(
      "Pages artifact index must contain exactly one cache-busted manifest link"
    );
  });

  it("fails when the root entrypoint contains duplicate manifest links", () => {
    const root = fixtureRoot();
    writeMinimalPwaArtifact(root);
    writeFixture(
      root,
      "index.html",
      indexHtml.replace(
        "</head>",
        '<link rel="manifest" href="/people-first-app/manifest.webmanifest"></head>'
      )
    );

    expect(() => verifyReleaseArtifactIntegrity(root, { allowedRoot: root })).toThrow(
      "Pages artifact index must contain exactly one cache-busted manifest link"
    );
  });

  it("fails when a required direct-route entrypoint is absent", () => {
    const root = fixtureRoot();
    writeMinimalPwaArtifact(root);
    rmSync(join(root, "orb"), { force: true, recursive: true });

    expect(() => verifyReleaseArtifactIntegrity(root, { allowedRoot: root })).toThrow(
      "Pages artifact is missing direct-route entrypoint: orb/index.html"
    );
  });

  it("fails when a direct-route entrypoint differs from the root index", () => {
    const root = fixtureRoot();
    writeMinimalPwaArtifact(root);
    writeFixture(root, "planning/index.html", "stale route entrypoint");

    expect(() => verifyReleaseArtifactIntegrity(root, { allowedRoot: root })).toThrow(
      "Pages artifact direct-route entrypoint does not match index.html: planning/index.html"
    );
  });

  it("fails when a release artifact contains symlinks", () => {
    const root = fixtureRoot();
    writeMinimalPwaArtifact(root);
    const canonical = writeFixture(root, "assets/index.js");
    symlinkSync(canonical, join(root, "assets", "index-link.js"));

    expect(() => verifyReleaseArtifactIntegrity(root, { allowedRoot: root })).toThrow(
      "Release artifact contains symlink(s)"
    );
  });

  it("fails when a staged artifact contains unexpected hidden files", () => {
    const root = fixtureRoot();
    writeMinimalPwaArtifact(root);
    writeFixture(root, ".nojekyll", "");
    writeFixture(root, ".env", "TOKEN=not-for-pages");

    expect(() => verifyReleaseArtifactIntegrity(root, { allowedRoot: root })).toThrow(
      "Release artifact contains unexpected hidden file(s)"
    );
  });

  it("fails when uploadable artifact content contains secret-like values", () => {
    const root = fixtureRoot();
    writeMinimalPwaArtifact(root);
    writeFixture(
      root,
      "assets/index.js",
      'fetch("/", { headers: { Authorization: "Bearer ghp_exampletoken" } });'
    );

    expect(() => verifyReleaseArtifactIntegrity(root, { allowedRoot: root })).toThrow(
      "Release artifact contains secret-like content"
    );
  });

  it("allows the public Android asset links file under .well-known only", () => {
    const root = fixtureRoot();
    writeMinimalPwaArtifact(root);
    writeFixture(root, ".nojekyll", "");
    writeFixture(root, ".well-known/assetlinks.json", JSON.stringify([]));

    expect(verifyReleaseArtifactIntegrity(root, { allowedRoot: root })).toEqual({
      checkedPrecacheUrls: 1,
    });
  });

  it("does not treat minified auth field references as leaked token values", () => {
    const root = fixtureRoot();
    writeMinimalPwaArtifact(root);
    writeFixture(
      root,
      "assets/session.js",
      "const session={access_token:source.access_token,refresh_token:source.refresh_token};"
    );

    expect(verifyReleaseArtifactIntegrity(root, { allowedRoot: root })).toEqual({
      checkedPrecacheUrls: 1,
    });
  });

  it("rejects unexpected files under .well-known", () => {
    const root = fixtureRoot();
    writeMinimalPwaArtifact(root);
    writeFixture(root, ".well-known/debug.txt", "debug");

    expect(() => verifyReleaseArtifactIntegrity(root, { allowedRoot: root })).toThrow(
      "Release artifact contains unexpected hidden file(s)"
    );
  });
  it("rejects artifact roots outside the allowed root", () => {
    const allowedRoot = fixtureRoot();
    const outsideRoot = fixtureRoot();
    writeMinimalPwaArtifact(outsideRoot);

    expect(() => verifyReleaseArtifactIntegrity(outsideRoot, { allowedRoot })).toThrow(
      "Release artifact root escapes allowed root"
    );
  });

  it("accepts base-prefixed files and route index fallbacks in the staged artifact", () => {
    const root = fixtureRoot();
    writeMinimalPwaArtifact(
      root,
      precache(
        indexPrecacheEntry,
        '{url:"/people-first-app/assets/index.js",revision:null}',
        '{url:"/people-first-app/orb/",revision:null}'
      )
    );
    writeFixture(root, "assets/index.js");

    expect(verifyReleaseArtifactIntegrity(root, { allowedRoot: root })).toEqual({
      checkedPrecacheUrls: 3,
    });
  });
});
