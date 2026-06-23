import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  createFreeProjectRagIndex,
  formatFreeRagResultsForAgent,
  searchFreeProjectRag,
  type FreeRagDocument,
  type FreeRagResult,
} from "./freeProjectRag";

export const DEFAULT_AGENT_RAG_FILES = [
  "AGENTS.md",
  "ARCHITECTURE.md",
  "docs/ai/TEST_FIRST_AGENT_POLICY.md",
  "docs/ai/SKILL_ROUTING_AGENT_POLICY.md",
  "docs/ai/RUFLOW_PLUS_BLUEPRINT.md",
  "docs/ai/AGENT_CHANGE_GOVERNANCE.md",
  "docs/ai/FREE_RAG_AND_COACH_LITE.md",
];

export interface SearchProjectDocsOptions {
  rootDir?: string;
  limit?: number;
  files?: string[];
}

export interface SearchProjectDocsResult {
  results: FreeRagResult[];
  formatted: string;
  indexedFiles: string[];
}

export function loadProjectRagDocuments(
  rootDir = process.cwd(),
  files = DEFAULT_AGENT_RAG_FILES
): FreeRagDocument[] {
  return files.flatMap((relativePath) => {
    const absolutePath = path.join(rootDir, relativePath);
    if (!existsSync(absolutePath)) return [];
    return [
      {
        source: relativePath,
        text: readFileSync(absolutePath, "utf8"),
      },
    ];
  });
}

export function searchProjectDocs(
  query: string,
  options: SearchProjectDocsOptions = {}
): SearchProjectDocsResult {
  const documents = loadProjectRagDocuments(options.rootDir, options.files);
  const index = createFreeProjectRagIndex(documents);
  const results = searchFreeProjectRag(index, query, { limit: options.limit ?? 5 });

  return {
    results,
    formatted: formatFreeRagResultsForAgent(results),
    indexedFiles: documents.map((document) => document.source),
  };
}

function printUsage(): void {
  console.error('Usage: npm run rag:search:free -- "your agent query" [--limit=5] [--json]');
}

function parseLimit(args: string[]): number | undefined {
  const flag = args.find((arg) => arg.startsWith("--limit="));
  if (!flag) return undefined;
  const value = Number(flag.replace("--limit=", ""));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const limit = parseLimit(args);
  const query = args
    .filter((arg) => !arg.startsWith("--"))
    .join(" ")
    .trim();

  if (!query) {
    printUsage();
    process.exitCode = 1;
  } else {
    const result = searchProjectDocs(query, { limit });
    if (asJson) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(result.formatted);
      console.log(`\nIndexed files: ${result.indexedFiles.join(", ")}`);
    }
  }
}
