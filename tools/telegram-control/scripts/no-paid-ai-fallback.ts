import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildNoPaidAiFallbackReport } from "../src/no-paid-ai-fallback";

const root = path.resolve(import.meta.dirname, "../../..");
const outputPath = process.env.NO_PAID_AI_REPORT_PATH
  ? path.resolve(process.env.NO_PAID_AI_REPORT_PATH)
  : path.join(root, "artifacts/telegram-control-no-paid-ai.md");

const report = await buildNoPaidAiFallbackReport({
  mode: process.env.MODE || "unknown",
  prompt: process.env.PROMPT || "",
  baseRef: process.env.BASE_REF || "main",
  jobId: process.env.JOB_ID || "unknown",
  promptSha: process.env.PROMPT_SHA || "unknown",
  promptBytes: process.env.PROMPT_BYTES || "unknown",
  rootDir: root,
});

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, report, "utf8");
console.log(`Wrote no-paid AI fallback report to ${outputPath}`);
