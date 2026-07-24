import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import type { FreeRagDocument } from "./freeProjectRag";
import { readRegularFileInsideRoot } from "./safeFilesystem";

export type RagCorpusGroupId =
  | "agent_rules"
  | "telegram_control"
  | "sync_auth"
  | "ui_v2"
  | "coach_journal"
  | string;

export interface RagCorpusGroup {
  id: RagCorpusGroupId;
  description: string;
  tags: string[];
  include: string[];
  exclude?: string[];
}

export interface RagCorpusManifest {
  version: 1;
  globalExclude: string[];
  groups: RagCorpusGroup[];
}

export interface ExpandRagCorpusOptions {
  rootDir?: string;
  groupIds?: string[];
  maxFileBytes?: number;
}

export interface CuratedRagDocument extends FreeRagDocument {
  group: string;
  tags: string[];
}

const DEFAULT_MANIFEST_PATH = path.join(import.meta.dirname, "corpus-manifest.json");
const DEFAULT_MAX_FILE_BYTES = 250_000;
const PRUNED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "artifacts",
  "output",
  "assets",
  "generated",
]);

export function loadRagCorpusManifest(manifestPath = DEFAULT_MANIFEST_PATH): RagCorpusManifest {
  const manifest = JSON.parse(
    readRegularFileInsideRoot(path.dirname(manifestPath), path.basename(manifestPath))
  ) as RagCorpusManifest;
  validateRagCorpusManifest(manifest);
  return manifest;
}

export function expandRagCorpusDocuments(
  manifest = loadRagCorpusManifest(),
  options: ExpandRagCorpusOptions = {}
): CuratedRagDocument[] {
  const rootDir = options.rootDir ?? process.cwd();
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  const selectedGroups = new Set(options.groupIds ?? manifest.groups.map((group) => group.id));
  const allFiles = listCandidateFiles(rootDir);
  const seenSources = new Set<string>();
  const documents: CuratedRagDocument[] = [];

  for (const group of manifest.groups) {
    if (!selectedGroups.has(group.id)) continue;
    const excludePatterns = [...manifest.globalExclude, ...(group.exclude ?? [])];
    for (const includePattern of group.include) {
      const matches = expandIncludePattern(rootDir, includePattern, allFiles);
      for (const source of matches) {
        if (seenSources.has(`${group.id}:${source}`)) continue;
        if (matchesAnyGlob(source, excludePatterns)) continue;
        const text = readRegularFileInsideRoot(rootDir, source);
        if (Buffer.byteLength(text, "utf8") > maxFileBytes) continue;
        documents.push({
          source,
          text,
          title: group.description,
          group: group.id,
          tags: group.tags,
        });
        seenSources.add(`${group.id}:${source}`);
      }
    }
  }

  return documents.sort((left, right) => left.source.localeCompare(right.source));
}

export function validateRagCorpusManifest(manifest: RagCorpusManifest): void {
  if (manifest.version !== 1) throw new Error("RAG corpus manifest version must be 1");
  const requiredGroups = ["agent_rules", "telegram_control", "sync_auth", "ui_v2", "coach_journal"];
  const groupIds = manifest.groups.map((group) => group.id);
  for (const requiredGroup of requiredGroups) {
    if (!groupIds.includes(requiredGroup)) throw new Error(`RAG corpus manifest missing ${requiredGroup}`);
  }
}

function expandIncludePattern(rootDir: string, pattern: string, allFiles: string[]): string[] {
  if (!hasGlob(pattern)) return existsSync(path.join(rootDir, pattern)) ? [pattern] : [];
  return allFiles.filter((source) => matchesGlob(source, pattern));
}

function listCandidateFiles(rootDir: string): string[] {
  const files: string[] = [];
  walkDirectory(rootDir, "", files);
  return files.sort();
}

function walkDirectory(rootDir: string, relativeDir: string, files: string[]): void {
  const absoluteDir = path.join(rootDir, relativeDir);
  if (!existsSync(absoluteDir)) return;
  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".github") continue;
    if (entry.isDirectory()) {
      if (PRUNED_DIRECTORIES.has(entry.name)) continue;
      walkDirectory(rootDir, toPosixPath(path.join(relativeDir, entry.name)), files);
      continue;
    }
    if (!entry.isFile()) continue;
    files.push(toPosixPath(path.join(relativeDir, entry.name)));
  }
}

function hasGlob(pattern: string): boolean {
  return pattern.includes("*");
}

function matchesAnyGlob(source: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => matchesGlob(source, pattern));
}

function matchesGlob(source: string, pattern: string): boolean {
  return globToRegExp(pattern).test(source);
}

function globToRegExp(pattern: string): RegExp {
  let output = "^";
  for (let index = 0; index < pattern.length; index++) {
    if (pattern.startsWith("**/", index)) {
      output += "(?:.*/)?";
      index += 2;
      continue;
    }
    if (pattern.startsWith("**", index)) {
      output += ".*";
      index += 1;
      continue;
    }
    const char = pattern[index];
    if (char === "*") {
      output += "[^/]*";
      continue;
    }
    output += escapeRegExp(char);
  }
  output += "$";
  return new RegExp(output);
}

function escapeRegExp(char: string): string {
  return /[\\^$+?.()|{}[\]]/.test(char) ? `\\${char}` : char;
}

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/").replace(/^\.\//, "");
}
