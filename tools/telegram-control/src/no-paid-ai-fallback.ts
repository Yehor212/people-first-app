import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const DEFAULT_NO_PAID_RAG_FILES = [
  "AGENTS.md",
  "ARCHITECTURE.md",
  "docs/ai/TEST_FIRST_AGENT_POLICY.md",
  "docs/ai/SKILL_ROUTING_AGENT_POLICY.md",
  "docs/ai/PERSISTENT_AGENT_ORCHESTRA.md",
  "docs/ai/PERSISTENT_AGENT_ORCHESTRA_EVAL_PROTOCOL.md",
  "docs/ai/AGENT_CHANGE_GOVERNANCE.md",
  "docs/ai/FREE_RAG_AND_COACH_LITE.md",
  "docs/ai/TELEGRAM_CONTROL_PLANE.md",
];

export interface NoPaidAiFallbackInput {
  mode: string;
  prompt?: string;
  baseRef?: string;
  jobId?: string;
  promptSha?: string;
  promptBytes?: string;
  rootDir?: string;
  ragFiles?: string[];
}

const MAX_RESULTS = 5;

interface FreeRagDocument {
  source: string;
  text: string;
  title?: string;
  group?: string;
  tags?: string[];
}

interface FreeRagModule {
  createFreeProjectRagIndex: (documents: FreeRagDocument[]) => unknown;
  formatFreeRagResultsForAgent: (results: unknown[]) => string;
  searchFreeProjectRag: (
    index: unknown,
    query: string,
    options: { limit?: number }
  ) => unknown[];
}

interface RagCorpusModule {
  expandRagCorpusDocuments: (
    manifest: unknown,
    options: { rootDir: string }
  ) => FreeRagDocument[];
  loadRagCorpusManifest: () => unknown;
}

function loadLegacyRagDocuments(rootDir: string, ragFiles: string[]): FreeRagDocument[] {
  return ragFiles.flatMap((relativePath) => {
    const absolutePath = path.join(rootDir, relativePath);
    if (!existsSync(absolutePath)) return [];
    return [
      {
        source: relativePath,
        text: readFileSync(absolutePath, "utf8"),
        group: "telegram_control",
        tags: ["no-paid", "legacy-override"],
      },
    ];
  });
}

async function loadSharedRagModules(): Promise<{
  freeRag: FreeRagModule;
  ragCorpus: RagCorpusModule;
}> {
  const freeRagUrl = new URL("../../../scripts/rag/freeProjectRag.ts", import.meta.url).href;
  const ragCorpusUrl = new URL("../../../scripts/rag/ragCorpus.ts", import.meta.url).href;
  const [freeRag, ragCorpus] = await Promise.all([
    import(freeRagUrl) as Promise<FreeRagModule>,
    import(ragCorpusUrl) as Promise<RagCorpusModule>,
  ]);
  return { freeRag, ragCorpus };
}

async function loadNoPaidRagDocuments(
  input: NoPaidAiFallbackInput,
  rootDir: string,
  ragCorpus: RagCorpusModule
): Promise<FreeRagDocument[]> {
  if (input.ragFiles) return loadLegacyRagDocuments(rootDir, input.ragFiles);
  return ragCorpus.expandRagCorpusDocuments(ragCorpus.loadRagCorpusManifest(), { rootDir });
}

export async function buildNoPaidAiFallbackReport(input: NoPaidAiFallbackInput): Promise<string> {
  const mode = input.mode || "unknown";
  const baseRef = input.baseRef || "main";
  const rootDir = input.rootDir || process.cwd();
  const query = [mode, baseRef, input.prompt || "", "no paid api local rag manual codex"]
    .join(" ")
    .trim();
  const { freeRag, ragCorpus } = await loadSharedRagModules();
  const index = freeRag.createFreeProjectRagIndex(
    await loadNoPaidRagDocuments(input, rootDir, ragCorpus)
  );
  const context = freeRag.formatFreeRagResultsForAgent(
    freeRag.searchFreeProjectRag(index, query, { limit: MAX_RESULTS })
  );

  return [
    "# Telegram Control No-Paid AI Report",
    "",
    "Status: UNVERIFIED",
    "",
    "OPENAI_API_KEY is missing, so the remote Codex action was not run.",
    "This report uses free lexical project RAG only; it is not autonomous AI execution and does not prove the requested work is complete.",
    "",
    "## Job Metadata",
    "",
    `- Mode: ${mode}`,
    `- Base ref: ${baseRef}`,
    `- Job id: ${input.jobId || "unknown"}`,
    `- Prompt SHA256: ${input.promptSha || "unknown"}`,
    `- Prompt bytes: ${input.promptBytes || "unknown"}`,
    "- Raw Telegram prompt: intentionally omitted from this artifact.",
    "",
    "## What Still Works Without Paid APIs",
    "",
    "- Repository checks, test gates, deploy/rollback approval plumbing, and curated local project RAG can run without an OpenAI API key.",
    "- Remote plan/fix/review/security AI execution remains UNVERIFIED until it is handled by local Codex Desktop or an approved API-backed runner.",
    "",
    "## Free Local RAG Context",
    "",
    context,
    "",
    "## Next Step",
    "",
    "Use the RAG context above in local Codex Desktop, or configure OPENAI_API_KEY only after explicit operator approval if remote Codex execution is required.",
  ].join("\n");
}
