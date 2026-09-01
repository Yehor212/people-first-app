import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = join(process.cwd(), "src");
const GENERIC_PROP_FORWARDERS = new Set([
  "src/components/ui/input.tsx",
  "src/components/ui/textarea.tsx",
]);

function productionTsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") return [];
      return productionTsxFiles(absolute);
    }
    if (!entry.name.endsWith(".tsx") || /\.(?:test|spec)\.tsx$/.test(entry.name)) return [];
    return [absolute];
  });
}

describe("Android WebView form labels", () => {
  it("gives every direct user-editable native control an explicit accessible name", () => {
    const unlabeled: string[] = [];

    for (const absolute of productionTsxFiles(SOURCE_ROOT)) {
      const file = relative(process.cwd(), absolute).replace(/\\/g, "/");
      if (GENERIC_PROP_FORWARDERS.has(file)) continue;

      const sourceText = readFileSync(absolute, "utf8");
      const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

      const visit = (node: ts.Node): void => {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
          const tag = node.tagName.getText(source);
          if (tag === "input" || tag === "textarea" || tag === "select") {
            const attributes = new Map<string, string>();
            for (const property of node.attributes.properties) {
              if (ts.isJsxAttribute(property)) {
                attributes.set(
                  property.name.getText(source),
                  property.initializer?.getText(source) ?? "true",
                );
              }
            }

            const type = attributes.get("type") ?? "";
            const hiddenFromAccessibility = attributes.has("aria-hidden");
            const nonUserControl = /(?:hidden|file)/.test(type);
            const explicitlyNamed =
              attributes.has("aria-label") || attributes.has("aria-labelledby");

            if (!hiddenFromAccessibility && !nonUserControl && !explicitlyNamed) {
              const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
              unlabeled.push(`${file}:${line} <${tag}>`);
            }
          }
        }
        ts.forEachChild(node, visit);
      };

      visit(source);
    }

    expect(unlabeled).toEqual([]);
  });
});
