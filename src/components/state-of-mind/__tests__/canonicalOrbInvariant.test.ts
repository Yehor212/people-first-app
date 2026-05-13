import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function extractPortalCore(source: string): string {
  const start = source.indexOf('data-testid="v1-v2-portal-orb-core"');
  const end = source.indexOf("</motion.span>", start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("canonical orb invariant", () => {
  it("keeps every state-of-mind entry surface on ValenceOrb or MiniValenceOrb", () => {
    const canonicalSurfaces = [
      {
        file: "src/pages/nav-v2/OrbPageSteps.tsx",
        required: ["ValenceOrb", "MiniValenceOrb", 'transitionProfile="v1-soft"'],
      },
      {
        file: "src/components/state-of-mind/StateOfMindModal.tsx",
        required: ["ValenceOrb"],
      },
      {
        file: "src/components/tabs/HomeTab.tsx",
        required: ["MiniValenceOrb"],
      },
      {
        file: "src/features/journal/DiaryMiniOrb.tsx",
        required: ["MiniValenceOrb"],
      },
      {
        file: "src/components/diary/TypingDynamicsMirror.tsx",
        required: ["MiniValenceOrb"],
      },
      {
        file: "src/features/journal/MemoryPortalCanvas.tsx",
        required: ["MiniValenceOrb"],
      },
      {
        file: "src/components/navigation-v2/SidebarV2.tsx",
        required: ["MiniValenceOrb"],
      },
      {
        file: "src/components/navigation-v2/DrawerV2.tsx",
        required: ["MiniValenceOrb"],
      },
      {
        file: "src/components/navigation-v2/ClassicPortalLink.tsx",
        required: ["MiniValenceOrb"],
      },
      {
        file: "src/components/tabs/PreviewPortal.tsx",
        required: ["MiniValenceOrb", 'data-testid="v1-v2-portal-orb-core"'],
      },
    ];

    for (const surface of canonicalSurfaces) {
      const source = readSource(surface.file);
      for (const required of surface.required) {
        expect(source, `${surface.file} must keep ${required}`).toContain(required);
      }
    }
  });

  it("does not put a manual icon back inside the V1 to V2 portal orb core", () => {
    const source = readSource("src/components/tabs/PreviewPortal.tsx");
    const portalCore = extractPortalCore(source);

    expect(portalCore).toContain("<MiniValenceOrb");
    expect(portalCore).not.toContain("<Sparkles");
    expect(portalCore).not.toContain("<svg");
  });
});
