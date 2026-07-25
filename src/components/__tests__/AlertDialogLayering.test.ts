import { readFileSync } from "fs";

import { describe, expect, it } from "vitest";

describe("AlertDialog layering contract", () => {
  it("keeps dialog content above its blocking overlay", () => {
    const source = readFileSync("src/components/ui/alert-dialog.tsx", "utf8");
    const styles = readFileSync("src/index.css", "utf8");

    expect(source).toContain("fixed inset-0 z-[60]");
    expect(source).toContain("fixed z-[70]");
    expect(source).toContain("zf-safe-area-dialog");
    expect(styles).toContain("left: calc(var(--safe-left)");
    expect(styles).toContain("top: calc(var(--safe-top)");
    expect(styles).toContain("max-height: calc(var(--app-viewport-height)");
  });
});
