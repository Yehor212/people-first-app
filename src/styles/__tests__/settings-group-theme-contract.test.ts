import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postcss, { type Node, type Rule } from "postcss";
import { describe, expect, it } from "vitest";

const themesRoot = postcss.parse(
  readFileSync(resolve(process.cwd(), "src/styles/themes.css"), "utf8"),
  { from: "src/styles/themes.css" }
);

const GROUP_SELECTOR = '[data-slot="settings-group"]';
const GENERIC_PANEL_SELECTOR = '[data-testid^="settings-v2-panel-"]';
const EXACT_PANEL_SELECTOR = /\[data-testid="settings-v2-panel-[^"]+"\]/g;
const ORDINARY_STYLE_ROW_SELECTOR = '[data-testid="settings-v2-style-customization"]';
const MATERIAL_PROPERTIES = new Set([
  "background",
  "background-color",
  "background-image",
  "border",
  "border-color",
  "box-shadow",
  "-webkit-backdrop-filter",
  "backdrop-filter",
]);

function materialProperties(rule: Rule) {
  const properties = new Set<string>();
  rule.walkDecls((declaration) => {
    if (MATERIAL_PROPERTIES.has(declaration.prop)) {
      properties.add(declaration.prop);
    }
  });
  return [...properties].sort();
}

function nonFlatMaterialProperties(rule: Rule) {
  const properties = new Set<string>();
  rule.walkDecls((declaration) => {
    if (!MATERIAL_PROPERTIES.has(declaration.prop)) return;
    const value = declaration.value.trim();
    const isFlatReset =
      ((declaration.prop === "background" ||
        declaration.prop === "background-color" ||
        declaration.prop === "background-image" ||
        declaration.prop === "border-color") &&
        value === "transparent") ||
      ((declaration.prop === "box-shadow" ||
        declaration.prop === "-webkit-backdrop-filter" ||
        declaration.prop === "backdrop-filter") &&
        value === "none") ||
      (declaration.prop === "border" && (value === "0" || value === "none"));
    if (!isFlatReset) properties.add(declaration.prop);
  });
  return [...properties].sort();
}

function stripSameElementQualifiers(value: string) {
  let remainder = value;
  while (remainder.startsWith("[")) {
    const closeIndex = remainder.indexOf("]");
    if (closeIndex === -1) break;
    remainder = remainder.slice(closeIndex + 1);
  }
  return remainder;
}

function selectorTargetsOuterPanel(selector: string) {
  if (selector.includes(GENERIC_PANEL_SELECTOR)) {
    const suffix = selector.slice(
      selector.lastIndexOf(GENERIC_PANEL_SELECTOR) + GENERIC_PANEL_SELECTOR.length
    );
    const remainder = stripSameElementQualifiers(suffix).trim();
    if (remainder === "" || remainder.startsWith(",") || remainder.startsWith(")")) {
      return true;
    }
  }

  for (const match of selector.matchAll(EXACT_PANEL_SELECTOR)) {
    const suffix = selector.slice((match.index ?? 0) + match[0].length);
    const remainder = stripSameElementQualifiers(suffix).trim();
    if (remainder === "" || remainder.startsWith(",") || remainder.startsWith(")")) {
      return true;
    }
  }

  return false;
}

function selectorTargetsOrdinaryStyleRow(selector: string) {
  if (!selector.includes(ORDINARY_STYLE_ROW_SELECTOR)) return false;
  const suffix = selector.slice(
    selector.lastIndexOf(ORDINARY_STYLE_ROW_SELECTOR) + ORDINARY_STYLE_ROW_SELECTOR.length
  );
  const remainder = stripSameElementQualifiers(suffix).trim();
  return remainder === "" || remainder.startsWith(",") || remainder.startsWith(")");
}

function insideAtRule(rule: Rule, name: string, params: string) {
  let parent: Node | undefined = rule.parent;
  while (parent) {
    if (
      parent.type === "atrule" &&
      "name" in parent &&
      "params" in parent &&
      typeof parent.params === "string" &&
      parent.name === name &&
      parent.params.includes(params)
    ) {
      return true;
    }
    parent = parent.parent;
  }
  return false;
}

describe("Settings group theme contract", () => {
  it("does not assign material presentation to the outer PanelFrame shell", () => {
    const violations: Array<{ line: number; selector: string; properties: string[] }> = [];

    themesRoot.walkRules((rule) => {
      const properties = nonFlatMaterialProperties(rule);
      if (properties.length === 0) return;

      for (const selector of rule.selectors) {
        if (selectorTargetsOuterPanel(selector)) {
          violations.push({
            line: rule.source?.start?.line ?? 0,
            selector,
            properties,
          });
        }
      }
    });

    expect(violations).toEqual([]);
  });

  it("does not turn the ordinary style-customization inset into a nested material card", () => {
    const violations: Array<{ line: number; selector: string; properties: string[] }> = [];

    themesRoot.walkRules((rule) => {
      const properties = nonFlatMaterialProperties(rule);
      if (properties.length === 0) return;

      for (const selector of rule.selectors) {
        if (selectorTargetsOrdinaryStyleRow(selector)) {
          violations.push({
            line: rule.source?.start?.line ?? 0,
            selector,
            properties,
          });
        }
      }
    });

    expect(violations).toEqual([]);
  });

  it("keeps appearance, high-contrast, and forced-colors presentation on the semantic group", () => {
    const groupRules: Rule[] = [];
    themesRoot.walkRules((rule) => {
      if (rule.selector.includes(GROUP_SELECTOR)) {
        groupRules.push(rule);
      }
    });

    expect(
      groupRules.some(
        (rule) =>
          rule.selector.includes('[data-testid="settings-v2-panel-appearance"]') &&
          rule.selector.includes('[data-panel-variant="studio"]') &&
          materialProperties(rule).includes("background")
      )
    ).toBe(true);
    expect(
      groupRules.some(
        (rule) =>
          rule.selector.includes('[data-theme-contrast="high"]') &&
          materialProperties(rule).includes("border-color")
      )
    ).toBe(true);
    expect(
      groupRules.some(
        (rule) =>
          insideAtRule(rule, "media", "forced-colors: active") &&
          materialProperties(rule).includes("border-color")
      )
    ).toBe(true);

    const elevatedGroups = groupRules.flatMap((rule) => {
      const declarations: Array<{ line: number; value: string }> = [];
      rule.walkDecls("box-shadow", (declaration) => {
        if (declaration.value.trim() !== "none") {
          declarations.push({
            line: declaration.source?.start?.line ?? 0,
            value: declaration.value,
          });
        }
      });
      return declarations;
    });
    expect(elevatedGroups).toEqual([]);
  });
});
