import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GitHub Pages deploy workflow contract", () => {
  it("uses the repository typecheck script instead of an ineffective root tsc invocation", () => {
    const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");

    expect(workflow).toContain("run: npm run typecheck");
    expect(workflow).not.toContain("run: npx tsc --noEmit");
  });
  it("does not auto-deploy preview branches to the production GitHub Pages environment", () => {
    const previewWorkflow = readFileSync(".github/workflows/deploy-v2-preview.yml", "utf8");

    expect(previewWorkflow).toContain("workflow_dispatch:");
    expect(previewWorkflow).not.toContain("push:");
    expect(previewWorkflow).not.toContain("codex/journal-v2-hub");
    expect(previewWorkflow).not.toContain("VITE_DISABLE_PWA");
  });
});
