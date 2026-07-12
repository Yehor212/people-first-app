import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/components/ChangelogPanel.tsx"), "utf8");

describe("ChangelogPanel viewport contract", () => {
  it("renders at the viewport root when opened from a transformed settings surface", () => {
    expect(source).toContain('from "react-dom"');
    expect(source).toContain("createPortal(");
    expect(source).toContain("document.body");
    expect(source).toContain("open: boolean");
    expect(source).toContain("useModalA11y(open, onClose)");
    expect(source).toContain("ref={modalRef}");
    expect(source).toContain("onKeyDown={handleKeyDown}");
  });
});
