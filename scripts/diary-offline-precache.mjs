import { createHash } from "node:crypto";
import path from "node:path";

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MAX_ADDED_BYTES = 640 * 1024;

function normalizedModuleId(id) {
  return id?.replaceAll("\\", "/").split("?", 1)[0];
}

function diaryChunksIn(bundle, root) {
  return ["JournalEntryEditor.tsx", "JournalEntryList.tsx"].flatMap((moduleName) => {
    const moduleId = normalizedModuleId(path.resolve(root, "src/features/journal", moduleName));
    const chunks = Object.values(bundle).filter(
      (output) => output.type === "chunk" && (
        normalizedModuleId(output.facadeModuleId) === moduleId ||
        output.moduleIds.some((id) => normalizedModuleId(id) === moduleId)
      ),
    );
    if (chunks.length === 0) {
      throw new Error(`Diary offline ${moduleName} module not found in the emitted bundle`);
    }
    return chunks;
  });
}

function staticAssetNames(bundle, roots) {
  const visited = new Set();
  const visit = (fileName) => {
    if (visited.has(fileName)) return;
    const output = bundle[fileName];
    if (!output || !fileName.startsWith("assets/") || fileName.split("/").includes("..")) {
      throw new Error(`Diary offline missing or external emitted dependency: ${fileName}`);
    }
    visited.add(fileName);
    if (output.type !== "chunk") return;
    for (const dependency of output.imports) visit(dependency);
    for (const css of output.viteMetadata?.importedCss ?? []) visit(css);
    for (const asset of output.viteMetadata?.importedAssets ?? []) visit(asset);
  };
  for (const fileName of roots) visit(fileName);
  return visited;
}

// Read the emitted graph, not source imports or hash-dependent chunk names.
export function collectDiaryOfflineAssets(bundle, { root }) {
  const roots = diaryChunksIn(bundle, root).map((entry) => entry.fileName);
  return [...staticAssetNames(bundle, roots)].sort().map((fileName) => {
    const output = bundle[fileName];
    const bytes = output.type === "chunk" ? output.code : output.source;
    const size = Buffer.byteLength(bytes);
    if (size > MAX_FILE_BYTES) {
      throw new Error(`Diary offline file exceeds ${MAX_FILE_BYTES}-byte limit: ${fileName}`);
    }
    return {
      url: fileName,
      revision: createHash("sha256").update(bytes).digest("hex"),
      size,
    };
  });
}

export function createDiaryOfflinePrecache({ root }) {
  let collected;
  return {
    plugin: {
      name: "zenflow-diary-offline-precache",
      apply: "build",
      enforce: "post",
      buildStart() {
        collected = undefined;
      },
      writeBundle(_options, bundle) {
        // Vite's generateBundle hooks can still rewrite preload lists. Collect
        // after them so revisions describe the bytes actually written to disk.
        const bootRoots = Object.values(bundle).filter(
          (entry) => entry.type === "chunk" && entry.isEntry,
        ).map((entry) => entry.fileName);
        if (bootRoots.length === 0) throw new Error("Diary offline boot entry not found");
        const bootAssets = staticAssetNames(bundle, bootRoots);
        if (diaryChunksIn(bundle, root).some((entry) => bootAssets.has(entry.fileName))) {
          throw new Error("Diary offline editor/list must remain lazy, outside the boot graph");
        }
        // The visited-route contract already requires a completed, controlled
        // online boot. Keep its shared assets on the existing caching path and
        // add only dependencies that the cold editor can require for the first time.
        collected = collectDiaryOfflineAssets(bundle, { root }).filter(
          (entry) => !bootAssets.has(entry.url),
        );
      },
    },
    manifestTransform(manifest) {
      if (!collected) throw new Error("Diary offline emitted assets not collected before manifest");
      const existingUrls = new Set(manifest.map((entry) => entry.url));
      const additions = collected.filter((entry) => !existingUrls.has(entry.url));
      const addedBytes = additions.reduce((total, entry) => total + entry.size, 0);
      // Workbox's built-in size filter runs before custom transforms.
      if (addedBytes > MAX_ADDED_BYTES) {
        const details = additions.map((entry) => `${entry.url} (${entry.size})`).join(", ");
        throw new Error(
          `Diary offline added assets exceed ${MAX_ADDED_BYTES}-byte limit: ${addedBytes}; ${details}`,
        );
      }
      // Workbox removes size metadata after transformation; do not share objects
      // with either the caller's manifest or a later invocation of this transform.
      return { manifest: [...manifest, ...additions].map((entry) => ({ ...entry })), warnings: [] };
    },
  };
}
