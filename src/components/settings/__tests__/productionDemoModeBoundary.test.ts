import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const PRODUCTION_SETTINGS = [
  "src/components/settings/AboutSection.tsx",
  "src/pages/nav-v2/settings/V2SettingsAboutPanel.tsx",
];

describe("production demo-mode boundary", () => {
  it("does not ship a hidden persistent demo toggle or plausible demo history", () => {
    for (const file of PRODUCTION_SETTINGS) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("useDemoMode");
      expect(source).not.toContain("toggleDemoMode");
      expect(source).not.toContain("handleVersionTap");
      expect(source).not.toContain("SettingsInsetButton");
    }

    const v2 = readFileSync(PRODUCTION_SETTINGS[1], "utf8");
    expect(v2).toContain("border-[hsl(var(--settings-v2-border)/0.58)]");
    expect(v2).toContain("bg-[hsl(var(--settings-v2-shell)/0.56)] p-4 text-center");
    expect(existsSync("src/hooks/useDemoMode.ts")).toBe(false);
    expect(existsSync("src/lib/demoData.ts")).toBe(false);
  });
});
