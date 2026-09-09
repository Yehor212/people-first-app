import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeWorkboxRevision,
  verifyServiceWorkerPrecacheReferences,
} from "../check-release-artifact-integrity.cjs";
import {
  collectDiaryOfflineAssets,
  createDiaryOfflinePrecache,
} from "../diary-offline-precache.mjs";

const root = path.resolve("/isolated-zenflow-build");
const editorModule = path.join(root, "src/features/journal/JournalEntryEditor.tsx");
const listModule = path.join(root, "src/features/journal/JournalEntryList.tsx");

function chunk(fileName, options = {}) {
  return {
    type: "chunk",
    fileName,
    code: `export const name = ${JSON.stringify(fileName)};`,
    imports: [],
    dynamicImports: [],
    moduleIds: [],
    facadeModuleId: null,
    viteMetadata: { importedCss: new Set(), importedAssets: new Set() },
    ...options,
  };
}

function asset(fileName, source) {
  return { type: "asset", fileName, source };
}

function graph() {
  return {
    "assets/list-build.js": chunk("assets/list-build.js", {
      facadeModuleId: listModule,
      moduleIds: [listModule],
      imports: ["assets/shared-build.js"],
    }),
    "assets/editor-build.js": chunk("assets/editor-build.js", {
      facadeModuleId: editorModule,
      moduleIds: [editorModule],
      imports: ["assets/shared-build.js"],
      dynamicImports: ["assets/optional-audio.js"],
      viteMetadata: {
        importedCss: new Set(["assets/editor.css"]),
        importedAssets: new Set(),
      },
    }),
    "assets/shared-build.js": chunk("assets/shared-build.js", {
      imports: ["assets/editor-build.js"],
      viteMetadata: {
        importedCss: new Set(["assets/editor.css"]),
        importedAssets: new Set(["assets/editor.woff2"]),
      },
    }),
    "assets/editor.css": asset("assets/editor.css", "body { color: inherit; }"),
    "assets/editor.woff2": asset("assets/editor.woff2", new Uint8Array([1, 2, 3])),
    "assets/optional-audio.js": chunk("assets/optional-audio.js"),
    "assets/unrelated-locale.js": chunk("assets/unrelated-locale.js"),
  };
}

function collectedIntegration(bundle = graph()) {
  bundle["assets/main.js"] ??= chunk("assets/main.js", { isEntry: true });
  const integration = createDiaryOfflinePrecache({ root });
  integration.plugin.buildStart();
  integration.plugin.writeBundle({}, bundle);
  return integration;
}

describe("Diary offline emitted dependency closure", () => {
  it("includes static dependencies, emitted CSS/assets and deduplicates cycles", () => {
    const entries = collectDiaryOfflineAssets(graph(), { root });
    expect(entries.map((entry) => entry.url)).toEqual([
      "assets/editor-build.js",
      "assets/editor.css",
      "assets/editor.woff2",
      "assets/list-build.js",
      "assets/shared-build.js",
    ]);
    expect(new Set(entries.map((entry) => entry.url)).size).toBe(entries.length);
  });

  it("does not traverse optional dynamic features or unrelated locales", () => {
    const bundle = graph();
    delete bundle["assets/optional-audio.js"];
    expect(collectDiaryOfflineAssets(bundle, { root })).toHaveLength(5);
  });

  it("finds the editor by module identity even if output naming or facade changes", () => {
    const bundle = graph();
    bundle["assets/editor-build.js"].facadeModuleId = null;
    expect(collectDiaryOfflineAssets(bundle, { root })).toHaveLength(5);
  });

  it("fails closed when the editor module is missing", () => {
    const bundle = graph();
    bundle["assets/editor-build.js"].facadeModuleId = null;
    bundle["assets/editor-build.js"].moduleIds = [];
    expect(() => collectDiaryOfflineAssets(bundle, { root })).toThrow(/editor.*not found/i);
  });

  it("requires the lazy entry list used after the first offline save and reload", () => {
    const bundle = graph();
    delete bundle["assets/list-build.js"];
    expect(() => collectDiaryOfflineAssets(bundle, { root })).toThrow(/list.*not found/i);
  });

  it.each(["assets/missing.js", "https://unavailable.invalid/editor.js"])(
    "rejects an unresolved static dependency: %s",
    (dependency) => {
      const bundle = graph();
      bundle["assets/editor-build.js"].imports.push(dependency);
      expect(() => collectDiaryOfflineAssets(bundle, { root })).toThrow(/missing|external/i);
    },
  );

  it.each(["assets/editor.css", "assets/editor.woff2"])(
    "rejects missing emitted CSS or assets: %s",
    (dependency) => {
      const bundle = graph();
      delete bundle[dependency];
      expect(() => collectDiaryOfflineAssets(bundle, { root })).toThrow(/missing/i);
    },
  );

  it("enforces the existing 3 MiB per-file limit in actual bytes", () => {
    const bundle = graph();
    bundle["assets/editor-build.js"].code = "я".repeat(1_572_865);
    expect(() => collectDiaryOfflineAssets(bundle, { root })).toThrow(/file.*limit/i);
  });

  it("binds revisions and sizes to emitted code and binary asset bytes", () => {
    const bundle = graph();
    bundle["assets/editor-build.js"].code = "export const value = 'я';";
    const entries = collectDiaryOfflineAssets(bundle, { root });
    for (const entry of entries) {
      const output = bundle[entry.url];
      const bytes = output.type === "chunk" ? output.code : output.source;
      expect(entry.revision).toBe(computeWorkboxRevision(bytes));
      expect(entry.size).toBe(Buffer.byteLength(bytes));
    }
    bundle["assets/editor-build.js"].code += "\n";
    expect(collectDiaryOfflineAssets(bundle, { root })[0].revision).not.toBe(entries[0].revision);
  });
});

describe("Diary offline Workbox manifest integration", () => {
  it("is build-only, post-enforced and rejects transformation before collection", () => {
    const integration = createDiaryOfflinePrecache({ root });
    expect(integration.plugin.apply).toBe("build");
    expect(integration.plugin.enforce).toBe("post");
    expect(integration.plugin.generateBundle).toBeUndefined();
    expect(integration.plugin.writeBundle).toBeTypeOf("function");
    expect(() => integration.manifestTransform([])).toThrow(/not collected/i);
  });

  it("preserves shell entries and revisions while adding only missing URLs", () => {
    const integration = collectedIntegration();
    const shell = [
      { url: "index.html", revision: "existing-html-revision", size: 12 },
      { url: "assets/shared-build.js", revision: null, size: 34 },
    ];
    const result = integration.manifestTransform(shell);
    expect(result.manifest).toHaveLength(6);
    expect(result.manifest.slice(0, 2)).toEqual(shell);
    expect(result.manifest[0]).not.toBe(shell[0]);
    expect(result.warnings).toEqual([]);
    expect(shell).toHaveLength(2);
  });

  it("passes the actual release revision verifier and still rejects changed bytes", () => {
    const artifactRoot = mkdtempSync(path.join(tmpdir(), "zenflow-diary-precache-release-"));
    try {
      const bundle = graph();
      const indexHtml = "<!doctype html><title>Isolated artifact contract</title>";
      const integration = collectedIntegration(bundle);
      const result = integration.manifestTransform([
        { url: "index.html", revision: computeWorkboxRevision(indexHtml) },
      ]);
      writeFileSync(path.join(artifactRoot, "index.html"), indexHtml);
      for (const entry of collectDiaryOfflineAssets(bundle, { root })) {
        const output = bundle[entry.url];
        const destination = path.join(artifactRoot, entry.url);
        mkdirSync(path.dirname(destination), { recursive: true });
        writeFileSync(destination, output.type === "chunk" ? output.code : output.source);
      }
      writeFileSync(
        path.join(artifactRoot, "sw.js"),
        `precacheAndRoute(${JSON.stringify(result.manifest)},{});`,
      );
      expect(verifyServiceWorkerPrecacheReferences(artifactRoot)).toEqual({ checkedPrecacheUrls: 6 });

      writeFileSync(path.join(artifactRoot, "assets/editor-build.js"), "changed emitted bytes");
      expect(() => verifyServiceWorkerPrecacheReferences(artifactRoot)).toThrow(
        /precache revision mismatch: assets\/editor-build\.js/,
      );
    } finally {
      rmSync(artifactRoot, { recursive: true, force: true });
    }
  });

  it("retains sizes and stable entries after Workbox removes size metadata", () => {
    const integration = collectedIntegration();
    const first = integration.manifestTransform([]);
    const expected = first.manifest.map((entry) => ({ ...entry }));
    for (const entry of first.manifest) delete entry.size;
    expect(integration.manifestTransform([]).manifest).toEqual(expected);
  });

  it("blocks more than the owner-approved 640 KiB of newly added assets", () => {
    const bundle = graph();
    bundle["assets/editor-build.js"].code = "x".repeat(350_000);
    bundle["assets/shared-build.js"].code = "x".repeat(350_000);
    const integration = collectedIntegration(bundle);
    expect(() => integration.manifestTransform([])).toThrow(/added.*limit/i);
  });

  it.each([0, 1])("enforces the added-byte boundary with %i excess bytes", (excess) => {
    const bundle = graph();
    bundle["assets/editor-build.js"].code = "я".repeat(163_840);
    bundle["assets/list-build.js"].code = "x".repeat(327_680 + excess);
    bundle["assets/shared-build.js"].code = "";
    bundle["assets/editor.css"].source = "";
    bundle["assets/editor.woff2"].source = new Uint8Array();
    const integration = collectedIntegration(bundle);
    if (excess === 0) {
      expect(integration.manifestTransform([]).manifest).toHaveLength(5);
    } else {
      expect(() => integration.manifestTransform([])).toThrow(/655360-byte limit: 655361/);
    }
  });

  it("does not charge already precached shared bytes against the added budget", () => {
    const bundle = graph();
    bundle["assets/shared-build.js"].code = "x".repeat(700_000);
    const integration = collectedIntegration(bundle);
    expect(() => integration.manifestTransform([
      { url: "assets/shared-build.js", revision: null, size: 700_000 },
    ])).not.toThrow();
  });

  it("requires fresh collection on each new build", () => {
    const integration = collectedIntegration();
    integration.plugin.buildStart();
    expect(() => integration.manifestTransform([])).toThrow(/not collected/i);
  });

  it("adds only cold editor dependencies beyond the already executed boot graph", () => {
    const bundle = graph();
    bundle["assets/boot-vendor.js"] = chunk("assets/boot-vendor.js", {
      code: "x".repeat(700_000),
      imports: ["assets/boot-child.js"],
    });
    bundle["assets/boot-child.js"] = chunk("assets/boot-child.js");
    bundle["assets/main.js"] = chunk("assets/main.js", {
      isEntry: true,
      imports: ["assets/boot-vendor.js"],
    });
    bundle["assets/editor-build.js"].imports.push("assets/boot-vendor.js");
    const integration = collectedIntegration(bundle);
    const result = integration.manifestTransform([]);
    expect(result.manifest).toHaveLength(5);
    expect(result.manifest.map((entry) => entry.url)).not.toContain("assets/boot-vendor.js");
    expect(result.manifest.map((entry) => entry.url)).not.toContain("assets/boot-child.js");
  });

  it("rejects a missing emitted boot dependency rather than presuming coverage", () => {
    const bundle = graph();
    bundle["assets/main.js"] = chunk("assets/main.js", {
      isEntry: true,
      imports: ["assets/missing-boot.js"],
    });
    expect(() => collectedIntegration(bundle)).toThrow(/missing/i);
  });

  it("fails closed when an editor becomes an eager boot dependency", () => {
    const bundle = graph();
    bundle["assets/main.js"] = chunk("assets/main.js", {
      isEntry: true,
      imports: ["assets/editor-build.js"],
    });
    expect(() => collectedIntegration(bundle)).toThrow(/editor.*lazy/i);
  });

  it("requires a real emitted boot entry before subtracting shared dependencies", () => {
    const integration = createDiaryOfflinePrecache({ root });
    expect(() => integration.plugin.writeBundle({}, graph())).toThrow(/boot.*not found/i);
  });
});
