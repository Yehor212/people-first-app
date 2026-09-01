import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postcss, { type Node } from "postcss";
import { describe, expect, it } from "vitest";

const indexCss = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
const themesCss = readFileSync(resolve(process.cwd(), "src/styles/themes.css"), "utf8");
const indexRoot = postcss.parse(indexCss, { from: "src/index.css" });

describe("global UI foundation contract", () => {
  it("keeps every web interaction-target role at or above 44 CSS px", () => {
    const targets: Array<{ line: number; value: string }> = [];
    indexRoot.walkDecls("--touch-target-min", (declaration) => {
      targets.push({
        line: declaration.source?.start?.line ?? 0,
        value: declaration.value,
      });
    });

    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) {
      const match = target.value.match(/^(\d+(?:\.\d+)?)px$/);
      expect(match, `line ${target.line} must use an explicit CSS px target`).not.toBeNull();
      expect(Number(match?.[1]), `line ${target.line} target`).toBeGreaterThanOrEqual(44);
    }
  });

  it("declares every named z-index role referenced by a z-index property", () => {
    const declaredRoles = new Set<string>();
    const referencedRoles: Array<{ line: number; role: string }> = [];

    indexRoot.walkDecls((declaration) => {
      if (declaration.prop.startsWith("--z-")) {
        declaredRoles.add(declaration.prop);
      }
      if (declaration.prop !== "z-index") return;

      for (const match of declaration.value.matchAll(/var\((--z-[\w-]+)/g)) {
        referencedRoles.push({
          line: declaration.source?.start?.line ?? 0,
          role: match[1],
        });
      }
    });

    expect(
      referencedRoles.filter(({ role }) => !declaredRoles.has(role)),
    ).toEqual([]);
  });

  it("uses one effective unlayered focus-visible fallback and preserves the high-contrast override", () => {
    const baseFocusRules: Array<{ line: number; layered: boolean }> = [];
    indexRoot.walkRules((rule) => {
      if (rule.selector.trim() === ":focus-visible") {
        let parent: Node | undefined = rule.parent;
        let layered = false;
        while (parent) {
          if (
            parent.type === "atrule" &&
            "name" in parent &&
            parent.name === "layer"
          ) {
            layered = true;
            break;
          }
          parent = parent.parent;
        }
        baseFocusRules.push({
          line: rule.source?.start?.line ?? 0,
          layered,
        });
      }
    });

    expect(baseFocusRules).toHaveLength(1);
    expect(baseFocusRules[0]).toMatchObject({ layered: false });
    expect(themesCss).toContain(
      ':where(button, input, select, textarea, summary, [tabindex]):focus-visible',
    );
    expect(themesCss).toContain("outline: 3px solid hsl(var(--settings-v2-focus));");
  });
});
