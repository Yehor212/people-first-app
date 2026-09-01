import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  "src/components/hyperfocus/HyperfocusMode.tsx",
  "utf8",
);

describe("HyperfocusMode modal accessibility contract", () => {
  it("uses the shared modal owner for the fullscreen layer and nested permission dialog", () => {
    expect(source).toContain('import { useModalA11y } from "@/hooks/useModalA11y";');
    expect(source).not.toContain('import { useBackHandler } from "@/hooks/useBackHandler";');
    expect(source).toContain("const hyperfocusA11y = useModalA11y(true, onExit);");
    expect(source).toContain(
      "const dndPermissionA11y = useModalA11y(",
    );
    expect(source).toContain("{...hyperfocusA11y.modalProps}");
    expect(source).toContain("{...dndPermissionA11y.modalProps}");
    expect(source).toContain("ref={dndPermissionOpenerRef}");
  });

  it("positions the logical end close control with the direction-aware safe-area token", () => {
    expect(source).toContain(
      'insetInlineEnd: "max(1rem, calc(var(--safe-inline-end) + 0.75rem))"',
    );
    expect(source).not.toContain(
      'insetInlineEnd: "max(1rem, calc(var(--safe-right) + 0.75rem))"',
    );
  });

  it("uses flat semantic controls without decorative background, gradient, glow, or pulse chrome", () => {
    expect(source).toContain('variant="default"');
    expect(source).toContain('variant="secondary"');
    expect(source).toContain('variant="outline"');
    expect(source).toContain("border-primary bg-primary/10");
    expect(source).not.toMatch(
      /HyperfocusBackground|linear-gradient|boxShadow|repeat:\s*Infinity|backdrop-blur|shadow-(?:xl|lg)|(?:bg|text|border)-(?:violet|purple|pink|red|slate|white|black)-/,
    );
  });
});
