import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildNoPaidAiFallbackReport } from "../src/no-paid-ai-fallback";

void test("builds a no-paid Telegram control report without exposing the raw prompt", async () => {
  const rootDir = mkdtempSync(join(tmpdir(), "zenflow-no-paid-rag-"));
  writeFileSync(
    join(rootDir, "AGENTS.md"),
    "Agent rule: use free local RAG before architecture work. SECRET_TOKEN=must-not-leak",
    "utf8"
  );

  const report = await buildNoPaidAiFallbackReport({
    mode: "plan",
    prompt: "please plan architecture changes for sync but keep this raw prompt private",
    baseRef: "main",
    jobId: "job-123",
    promptSha: "abc123",
    promptBytes: "68",
    rootDir,
    ragFiles: ["AGENTS.md"],
  });

  assert.match(report, /Status: UNVERIFIED/);
  assert.match(report, /OPENAI_API_KEY is missing/);
  assert.match(report, /free lexical project RAG only/);
  assert.match(report, /AGENTS\.md#chunk-0/);
  assert.match(report, /\[redacted-token\]/);
  assert.doesNotMatch(report, /keep this raw prompt private/);
});
