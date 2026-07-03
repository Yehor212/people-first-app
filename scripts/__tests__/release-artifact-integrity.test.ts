import { afterEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const {
  extractServiceWorkerPrecacheUrls,
  verifyReleaseArtifactIntegrity,
  } = require("../check-release-artifact-integrity.cjs") as {
    extractServiceWorkerPrecacheUrls: (source: string) => string[];
    verifyReleaseArtifactIntegrity: (
      root: string,
      options?: { allowedRoot?: string },
    ) => { checkedPrecacheUrls: number };
  };

const tempRoots: string[] = [];

function fixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), "zenflow-release-integrity-"));
  tempRoots.push(root);
  return root;
}

function writeFixture(root: string, relPath: string, content = relPath) {
  const absPath = join(root, relPath);
  mkdirSync(join(absPath, ".."), { recursive: true });
  writeFileSync(absPath, content);
  return absPath;
}

function writeMinimalPwaArtifact(root: string, swContent?: string) {
  writeFixture(root, "index.html", "<!doctype html><div id=\"root\"></div>");
  writeFixture(root, "manifest.webmanifest", JSON.stringify({ name: "ZenFlow" }));
  writeFixture(root, "registerSW.js", "navigator.serviceWorker?.register('/people-first-app/sw.js');");
  writeFixture(
    root,
    "sw.js",
    swContent ?? 'precacheAndRoute([{url:"/people-first-app/index.html",revision:"1"}],{});',
  );
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("release artifact integrity", () => {
  it("extracts Workbox precache URLs from generated service workers", () => {
    const sw = 'precacheAndRoute([{url:"/people-first-app/assets/index.js",revision:"1"},{"revision":"2","url":"orb/"}],{});';

    expect(extractServiceWorkerPrecacheUrls(sw)).toEqual([
      "/people-first-app/assets/index.js",
      "orb/",
    ]);
  });

  it("fails when a staged service worker precaches a missing file", () => {
    const root = fixtureRoot();
    writeMinimalPwaArtifact(
      root,
      'precacheAndRoute([{url:"/people-first-app/assets/missing.js",revision:"1"}],{});',
    );

    expect(() => verifyReleaseArtifactIntegrity(root, { allowedRoot: root })).toThrow(
      "Service worker precache references missing artifact(s)",
    );
  });

  it("fails when the staged artifact is missing required PWA shell files", () => {
    const root = fixtureRoot();
    writeFixture(root, "index.html", "<!doctype html>");

    expect(() => verifyReleaseArtifactIntegrity(root, { allowedRoot: root })).toThrow(
      "Release artifact missing required PWA file(s)",
    );
  });

  it("fails when the service worker has no precache URLs", () => {
    const root = fixtureRoot();
    writeMinimalPwaArtifact(root, "self.addEventListener('install', () => {});");

    expect(() => verifyReleaseArtifactIntegrity(root, { allowedRoot: root })).toThrow(
      "Service worker precache contains no URLs",
    );
  });

  it("fails when a release artifact contains symlinks", () => {
    const root = fixtureRoot();
    writeMinimalPwaArtifact(root);
    const canonical = writeFixture(root, "assets/index.js");
    symlinkSync(canonical, join(root, "assets", "index-link.js"));

    expect(() => verifyReleaseArtifactIntegrity(root, { allowedRoot: root })).toThrow(
      "Release artifact contains symlink(s)",
    );
  });

  it("fails when a staged artifact contains unexpected hidden files", () => {
    const root = fixtureRoot();
    writeMinimalPwaArtifact(root);
    writeFixture(root, ".nojekyll", "");
    writeFixture(root, ".env", "TOKEN=not-for-pages");

    expect(() => verifyReleaseArtifactIntegrity(root, { allowedRoot: root })).toThrow(
      "Release artifact contains unexpected hidden file(s)",
    );
  });

  it("fails when uploadable artifact content contains secret-like values", () => {
    const root = fixtureRoot();
    writeMinimalPwaArtifact(root);
    writeFixture(root, "assets/index.js", 'fetch("/", { headers: { Authorization: "Bearer ghp_exampletoken" } });');

    expect(() => verifyReleaseArtifactIntegrity(root, { allowedRoot: root })).toThrow(
      "Release artifact contains secret-like content",
    );
  });

  it("allows the public Android asset links file under .well-known only", () => {
    const root = fixtureRoot();
    writeMinimalPwaArtifact(root);
    writeFixture(root, ".nojekyll", "");
    writeFixture(root, ".well-known/assetlinks.json", JSON.stringify([]));

    expect(verifyReleaseArtifactIntegrity(root, { allowedRoot: root })).toEqual({ checkedPrecacheUrls: 1 });
  });

  it("does not treat minified auth field references as leaked token values", () => {
    const root = fixtureRoot();
    writeMinimalPwaArtifact(root);
    writeFixture(root, "assets/session.js", "const session={access_token:source.access_token,refresh_token:source.refresh_token};");

    expect(verifyReleaseArtifactIntegrity(root, { allowedRoot: root })).toEqual({ checkedPrecacheUrls: 1 });
  });

  it("rejects unexpected files under .well-known", () => {
    const root = fixtureRoot();
    writeMinimalPwaArtifact(root);
    writeFixture(root, ".well-known/debug.txt", "debug");

    expect(() => verifyReleaseArtifactIntegrity(root, { allowedRoot: root })).toThrow(
      "Release artifact contains unexpected hidden file(s)",
    );
  });
  it("rejects artifact roots outside the allowed root", () => {
    const allowedRoot = fixtureRoot();
    const outsideRoot = fixtureRoot();
    writeMinimalPwaArtifact(outsideRoot);

    expect(() => verifyReleaseArtifactIntegrity(outsideRoot, { allowedRoot })).toThrow(
      "Release artifact root escapes allowed root",
    );
  });

  it("accepts base-prefixed files and route index fallbacks in the staged artifact", () => {
    const root = fixtureRoot();
    writeMinimalPwaArtifact(
      root,
      'precacheAndRoute([{url:"/people-first-app/assets/index.js",revision:"1"},{url:"/people-first-app/orb/",revision:"2"}],{});',
    );
    writeFixture(root, "assets/index.js");
    writeFixture(root, "orb/index.html");

    expect(verifyReleaseArtifactIntegrity(root, { allowedRoot: root })).toEqual({ checkedPrecacheUrls: 2 });
  });
});
