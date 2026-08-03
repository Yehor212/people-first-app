import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildStaticAssetCatalog,
  selectStaticAsset,
} from "../../e2e/helpers/save-ceremony/static-assets.mjs";

const temporaryRoots = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

function makeFixture() {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "zenflow-save-ceremony-assets-"));
  temporaryRoots.push(fixtureRoot);
  const distRoot = join(fixtureRoot, "dist");
  mkdirSync(join(distRoot, "assets"), { recursive: true });
  writeFileSync(join(distRoot, "index.html"), "<!doctype html><title>ZenFlow</title>");
  writeFileSync(join(distRoot, "assets", "app.js"), "export const ready = true;");
  writeFileSync(join(distRoot, "unexpected.html"), "<script>unexpected()</script>");
  return { distRoot, fixtureRoot };
}

describe("save ceremony static asset catalog", () => {
  it("serves catalogued assets and the SPA index without resolving request paths on disk", () => {
    const { distRoot } = makeFixture();
    const catalog = buildStaticAssetCatalog(distRoot);

    expect(
      selectStaticAsset("/people-first-app/assets/app.js?v=1", catalog)?.body.toString(),
    ).toBe("export const ready = true;");
    expect(selectStaticAsset("/people-first-app/journal", catalog)?.key).toBe(
      "/index.html",
    );
    expect(
      selectStaticAsset("/people-first-app/unexpected.html", catalog)?.body.toString(),
    ).toBe("<script>unexpected()</script>");
  });

  it("rejects traversal-shaped, malformed, and unknown asset requests", () => {
    const { distRoot } = makeFixture();
    const catalog = buildStaticAssetCatalog(distRoot);

    for (const requestPath of [
      "/people-first-app/%252e%252e/private.txt",
      "/people-first-app/..\\private.txt",
      "/people-first-app/%00private.txt",
      "/people-first-app/%E0%A4%A",
      "/people-first-app/unknown.html",
      "/people-first-app/missing.js",
    ]) {
      expect(selectStaticAsset(requestPath, catalog), requestPath).toBeNull();
    }
  });

  it("does not catalogue symbolic links that can escape the build directory", () => {
    const { distRoot, fixtureRoot } = makeFixture();
    const outsidePath = join(fixtureRoot, "outside.txt");
    writeFileSync(outsidePath, "private");
    symlinkSync(outsidePath, join(distRoot, "assets", "outside.txt"));

    const catalog = buildStaticAssetCatalog(distRoot);

    expect(selectStaticAsset("/people-first-app/assets/outside.txt", catalog)).toBeNull();
  });
});
