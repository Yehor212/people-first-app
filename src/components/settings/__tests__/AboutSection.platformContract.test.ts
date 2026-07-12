import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/components/settings/AboutSection.tsx"), "utf8");

describe("legacy About Settings safety contract", () => {
  it("does not expose raw developer release notes and never routes iOS to Google Play", () => {
    expect(source).not.toContain("ChangelogPanel");
    expect(source).not.toContain("showChangelog");
    expect(source).not.toContain("Version History Button");
    expect(source).toContain('import { isAndroid } from "@/lib/platform"');
    expect(source).not.toMatch(/\bisNative\b/);
  });
});
