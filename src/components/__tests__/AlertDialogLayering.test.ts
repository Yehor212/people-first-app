import { readFileSync } from "fs";

import { describe, expect, it } from "vitest";

describe("AlertDialog layering contract", () => {
  it("keeps dialog content above its blocking overlay", () => {
    const source = readFileSync("src/components/ui/alert-dialog.tsx", "utf8");

    expect(source).toContain("fixed inset-0 z-[60]");
    expect(source).toContain("fixed left-[50%] top-[50%] z-[70]");
  });
});
