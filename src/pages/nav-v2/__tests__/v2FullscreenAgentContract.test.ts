import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("V2 fullscreen agent contract", () => {
  it("keeps future-agent instructions wired to the V2 fullscreen edge-to-edge contract", () => {
    const contractPath = "docs/ai/V2_FULLSCREEN_EDGE_TO_EDGE_CONTRACT.md";

    expect(existsSync(contractPath)).toBe(true);

    const contract = read(contractPath);
    const agents = read("AGENTS.md");
    const runtime = read("docs/ai/TELEGRAM_GRADE_RUNTIME_CONTRACT.md");
    const completion = read("docs/ai/TASK_COMPLETION_PROTOCOL.md");

    for (const source of [agents, runtime, completion]) {
      expect(source).toContain("V2_FULLSCREEN_EDGE_TO_EDGE_CONTRACT.md");
    }

    expect(contract).toContain("Edge-to-edge means the WebView fills the viewport");
    expect(contract).toContain("Safe areas protect interactive and readable content");
    expect(contract).toContain("Do not hide system bars to fake fullscreen");
    expect(contract).toContain("Android 15");
    expect(contract).toContain("Capacitor SystemBars");
    expect(contract).toContain("viewport-fit=cover");
    expect(contract).toContain("100dvh");
    expect(contract).toContain("var(--safe-top)");
    expect(contract).toContain("RTL");
    expect(contract).toContain("Android emulator");
    expect(contract).toContain("iOS Simulator");
  });
});
