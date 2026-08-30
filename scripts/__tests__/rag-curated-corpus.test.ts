import {
  linkSync,
  mkdtempSync,
  mkdirSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  FREE_RAG_MAX_CHUNK_CHARS,
  createFreeProjectRagIndex,
  formatFreeRagResultsForAgent,
  searchFreeProjectRag,
} from "../rag/freeProjectRag";
import {
  expandRagCorpusDocuments,
  loadRagCorpusManifest,
  type RagCorpusManifest,
} from "../rag/ragCorpus";

describe("curated Free RAG corpus", () => {
  it("declares the required project knowledge groups in a curated manifest", () => {
    const manifest = loadRagCorpusManifest();
    const groupIds = manifest.groups.map((group) => group.id);

    expect(groupIds).toEqual([
      "agent_rules",
      "telegram_control",
      "sync_auth",
      "ui_v2",
      "coach_journal",
    ]);

    expect(manifest.groups.find((group) => group.id === "agent_rules")?.include).toContain(
      "AGENTS.md"
    );
    expect(manifest.groups.find((group) => group.id === "telegram_control")?.include).toContain(
      ".github/workflows/telegram-control.yml"
    );
    expect(manifest.groups.find((group) => group.id === "coach_journal")?.include).toContain(
      "supabase/functions/ai-coach/index.ts"
    );
  });

  it("rejects curated inputs that escape the root through symlinks or hardlinks", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "zenflow-rag-input-root-"));
    const outsideDir = mkdtempSync(join(tmpdir(), "zenflow-rag-input-outside-"));
    const outsidePath = join(outsideDir, "private-journal.md");
    writeFileSync(outsidePath, "PRIVATE_JOURNAL_SENTINEL");

    const manifest: RagCorpusManifest = {
      version: 1,
      globalExclude: [],
      groups: [
        {
          id: "agent_rules",
          description: "test rules",
          tags: ["rules"],
          include: ["AGENTS.md"],
        },
      ],
    };

    symlinkSync(outsidePath, join(rootDir, "AGENTS.md"));
    expect(() => expandRagCorpusDocuments(manifest, { rootDir })).toThrow(/symlink/i);

    unlinkSync(join(rootDir, "AGENTS.md"));
    writeFileSync(join(rootDir, "AGENTS.md"), "local");
    linkSync(outsidePath, join(rootDir, "HARDLINK.md"));
    manifest.groups[0].include = ["HARDLINK.md"];
    expect(() => expandRagCorpusDocuments(manifest, { rootDir })).toThrow(/hardlink/i);
  });

  it("expands only curated source files and excludes generated, asset, build, dependency, and secret paths", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "zenflow-rag-corpus-"));
    writeFile(rootDir, "docs/ai/good.md", "# Good\n\nUseful project guidance.");
    writeFile(rootDir, "src/lib/good.ts", "export function useful() { return true; }");
    writeFile(rootDir, "node_modules/pkg/README.md", "# Dependency");
    writeFile(rootDir, "dist/app.js", "console.log('build output');");
    writeFile(rootDir, "src/assets/icon.svg", "<svg />");
    writeFile(rootDir, "docs/ai/generated/report.md", "# Generated report");
    writeFile(rootDir, "output/volatile.ts", "export const shouldNeverBeIndexed = true;");
    writeFile(rootDir, ".env.local", "OPENAI_API_KEY=should-not-index");

    const manifest: RagCorpusManifest = {
      version: 1,
      globalExclude: [
        "node_modules/**",
        "dist/**",
        "build/**",
        "coverage/**",
        "artifacts/**",
        "**/assets/**",
        "**/generated/**",
        ".env*",
      ],
      groups: [
        {
          id: "agent_rules",
          description: "test rules",
          tags: ["rules"],
          include: ["**/*.md", "**/*.ts", ".env.local"],
        },
      ],
    };

    const documents = expandRagCorpusDocuments(manifest, { rootDir });
    const sources = documents.map((document) => document.source).sort();

    expect(sources).toEqual(["docs/ai/good.md", "src/lib/good.ts"]);
    expect(documents.every((document) => document.group === "agent_rules")).toBe(true);
    expect(documents.every((document) => document.tags.includes("rules"))).toBe(true);
  });

  it("chunks Markdown, TypeScript, and YAML with metadata and source citations", () => {
    const index = createFreeProjectRagIndex([
      {
        source: "docs/ai/sample.md",
        group: "agent_rules",
        tags: ["rules"],
        text: "# Root\n\nIntro.\n\n## Sync Auth\n\nSync contract details.",
      },
      {
        source: "src/lib/sample.ts",
        group: "sync_auth",
        tags: ["sync", "auth"],
        text: "import x from 'x';\n\nexport function syncNow() {\n  return 'ok';\n}\n\nexport class AuthGate {}\n",
      },
      {
        source: ".github/workflows/sample.yml",
        group: "telegram_control",
        tags: ["workflow"],
        text: "name: Sample\njobs:\n  test:\n    steps:\n      - run: npm test\n",
      },
    ]);

    expect(index.chunks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "docs/ai/sample.md",
          group: "agent_rules",
          kind: "markdown_section",
          heading: "Sync Auth",
          citation: "docs/ai/sample.md:5",
        }),
        expect.objectContaining({
          source: "src/lib/sample.ts",
          group: "sync_auth",
          kind: "typescript_symbol",
          heading: "syncNow",
          citation: "src/lib/sample.ts:3",
        }),
        expect.objectContaining({
          source: ".github/workflows/sample.yml",
          group: "telegram_control",
          kind: "yaml_block",
          heading: "jobs.test",
          citation: ".github/workflows/sample.yml:3",
        }),
      ])
    );

    const [result] = searchFreeProjectRag(index, "sync auth workflow", { limit: 1 });
    expect(result).toEqual(
      expect.objectContaining({
        source: expect.any(String),
        group: expect.any(String),
        citation: expect.stringMatching(/:[0-9]+$/),
      })
    );
  });

  it("splits oversized semantic chunks without dropping metadata or citations", () => {
    const longMarkdown = Array.from({ length: 80 }, (_, index) => `Paragraph ${index} ${"sync ".repeat(20)}`).join("\n");
    const longTypeScriptBody = Array.from({ length: 80 }, (_, index) => `  const value${index} = "${"auth ".repeat(20)}";`).join("\n");
    const longYamlSteps = Array.from({ length: 80 }, (_, index) => `      - run: echo ${index} ${"telegram ".repeat(16)}`).join("\n");

    const index = createFreeProjectRagIndex([
      {
        source: "docs/ai/large.md",
        group: "agent_rules",
        tags: ["rules"],
        text: `# Large\n\n${longMarkdown}`,
      },
      {
        source: "src/lib/large.ts",
        group: "sync_auth",
        tags: ["sync", "auth"],
        text: `export function largeSync() {\n${longTypeScriptBody}\n  return true;\n}`,
      },
      {
        source: ".github/workflows/large.yml",
        group: "telegram_control",
        tags: ["workflow"],
        text: `name: Large\njobs:\n  report:\n    steps:\n${longYamlSteps}\n`,
      },
    ]);

    expect(index.chunks.length).toBeGreaterThan(3);
    expect(Math.max(...index.chunks.map((chunk) => chunk.text.length))).toBeLessThanOrEqual(
      FREE_RAG_MAX_CHUNK_CHARS
    );
    expect(index.chunks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "docs/ai/large.md",
          kind: "markdown_section",
          heading: "Large",
          group: "agent_rules",
          citation: expect.stringMatching(/^docs\/ai\/large\.md:[0-9]+$/),
        }),
        expect.objectContaining({
          source: "src/lib/large.ts",
          kind: "typescript_symbol",
          heading: "largeSync",
          group: "sync_auth",
          citation: expect.stringMatching(/^src\/lib\/large\.ts:[0-9]+$/),
        }),
        expect.objectContaining({
          source: ".github/workflows/large.yml",
          kind: "yaml_block",
          heading: "jobs.report",
          group: "telegram_control",
          citation: expect.stringMatching(/^\.github\/workflows\/large\.yml:[0-9]+$/),
        }),
      ])
    );
  });

  it("keeps formatted RAG excerpts cited and redacts token-shaped text", () => {
    const index = createFreeProjectRagIndex([
      {
        source: "docs/ai/unsafe.md",
        group: "agent_rules",
        tags: ["rules"],
        text: [
          "# Unsafe",
          "Never leak RAG_LIVE_ACCESS_TOKEN=eyJhbGciOiJFUzI1NiJ9.secret.payload.",
          "Never leak openai_key=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890.",
          "Never leak github_pat_abcdefghijklmnopqrstuvwxyz1234567890.",
          "Never leak 123456789:abcdefghijklmnopqrstuvwxyzABCDE1234567890.",
        ].join("\n\n"),
      },
    ]);

    const formatted = formatFreeRagResultsForAgent(
      searchFreeProjectRag(index, "unsafe token", { limit: 1 })
    );

    expect(formatted).toContain("docs/ai/unsafe.md:");
    expect(formatted).toContain("group agent_rules");
    expect(formatted).toContain("[redacted-token]");
    expect(formatted).not.toContain("RAG_LIVE_ACCESS_TOKEN=");
    expect(formatted).not.toContain("eyJhbGci");
    expect(formatted).not.toContain("sk-proj-");
    expect(formatted).not.toContain("github_pat_");
    expect(formatted).not.toContain("123456789:");
  });
});

function writeFile(rootDir: string, relativePath: string, contents: string): void {
  const absolutePath = join(rootDir, relativePath);
  mkdirSync(absolutePath.replace(/\/[^/]+$/, ""), { recursive: true });
  writeFileSync(absolutePath, contents);
}
