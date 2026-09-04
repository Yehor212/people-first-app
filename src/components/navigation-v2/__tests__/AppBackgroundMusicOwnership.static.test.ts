import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("global app background music ownership", () => {
  it("mounts the provider above account gating instead of inside NavV2", () => {
    const app = readFileSync("src/App.tsx", "utf8");
    const nav = readFileSync("src/components/navigation-v2/NavV2Orchestrator.tsx", "utf8");

    expect(app).toContain("<AppBackgroundMusicProvider>");
    expect(app.indexOf("<AppBackgroundMusicProvider>")).toBeLessThan(app.indexOf("<Index />"));
    expect(nav).not.toContain("<AppBackgroundMusicProvider>");
  });
});
