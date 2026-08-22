import process from "node:process";

import { isDirectCliInvocation } from "./directCli";
import {
  createFreeProjectRagIndex,
  formatFreeRagResultsForAgent,
  searchFreeProjectRag,
  type FreeRagDocument,
  type FreeRagResult,
} from "./freeProjectRag";
import { expandRagCorpusDocuments, loadRagCorpusManifest } from "./ragCorpus";
import { readRegularFileInsideRoot } from "./safeFilesystem";

export const DEFAULT_AGENT_RAG_FILES = [
  "AGENTS.md",
  "ARCHITECTURE.md",
  "docs/ai/TEST_FIRST_AGENT_POLICY.md",
  "docs/ai/SKILL_ROUTING_AGENT_POLICY.md",
  "config/persistent-agent-orchestra.json",
  "docs/ai/PERSISTENT_AGENT_ORCHESTRA_EVAL_PROTOCOL.md",
  "docs/ai/AGENT_CHANGE_GOVERNANCE.md",
  "docs/ai/FREE_RAG_AND_COACH_LITE.md",
];

export interface SearchProjectDocsOptions {
  rootDir?: string;
  limit?: number;
  files?: string[];
  groups?: string[];
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
    try {
      return [
        {
          source: relativePath,
          text: readRegularFileInsideRoot(rootDir, relativePath),
        },
      ];
    } catch (error) {
      if (error instanceof Error && /ENOENT|Missing RAG parent directory/.test(error.message)) {
        return [];
      }
      throw error;
    }
  });
}

export function searchProjectDocs(
  query: string,
  options: SearchProjectDocsOptions = {}
): SearchProjectDocsResult {
  const documents = options.files
    ? loadProjectRagDocuments(options.rootDir, options.files)
    : expandRagCorpusDocuments(loadRagCorpusManifest(), {
        rootDir: options.rootDir,
        groupIds: options.groups,
      });
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

interface SearchCliArguments {
  asJson: boolean;
  limit?: number;
  query: string;
}

function parseCliArguments(args: readonly string[]): SearchCliArguments {
  let asJson = false;
  let limit: number | undefined;
  let sawJson = false;
  let sawLimit = false;
  const queryParts: string[] = [];

  for (const arg of args) {
    if (arg === "--json") {
      if (sawJson) throw new Error("Duplicate --json option");
      sawJson = true;
      asJson = true;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      if (sawLimit) throw new Error("Duplicate --limit option");
      sawLimit = true;
      const rawLimit = arg.slice("--limit=".length);
      if (!/^[1-9]\d*$/.test(rawLimit)) throw new Error("Invalid --limit value");
      const parsedLimit = Number(rawLimit);
      if (!Number.isSafeInteger(parsedLimit)) throw new Error("Invalid --limit value");
      limit = parsedLimit;
      continue;
    }
    if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`);
    queryParts.push(arg);
  }

  return { asJson, limit, query: queryParts.join(" ").trim() };
}

if (isDirectCliInvocation(import.meta.url, process.argv[1])) {
  try {
    const { asJson, limit, query } = parseCliArguments(process.argv.slice(2));
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
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
