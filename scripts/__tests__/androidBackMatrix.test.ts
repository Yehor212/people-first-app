import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

type Ownership = "registered-lifo" | "shared-modal-hook" | "escape-stack";

interface BackMatrixEntry {
  source: string;
  ownership: Ownership;
  expected: "close-top-layer" | "consume-required-recovery";
  note: string;
}

interface BackMatrix {
  schemaVersion: 1;
  entries: BackMatrixEntry[];
}

const projectRoot = path.resolve(import.meta.dirname, "../..");
const matrixPath = path.join(projectRoot, "docs/release/android-2.1-back-matrix.json");
const scanRoots = ["src/components", "src/features", "src/pages"];

function walkProductionTsx(relativeDirectory: string): string[] {
  const absoluteDirectory = path.join(projectRoot, relativeDirectory);
  return fs.readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : walkProductionTsx(relativePath);
    }
    if (!entry.name.endsWith(".tsx") || entry.name.includes(".test.")) return [];
    return [relativePath];
  });
}

function rendersOwnedLayer(relativePath: string): boolean {
  const absolutePath = path.join(projectRoot, relativePath);
  const sourceText = fs.readFileSync(absolutePath, "utf8");
  const sourceFile = ts.createSourceFile(
    relativePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let found = false;

  const visit = (node: ts.Node): void => {
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText(sourceFile) === "role" &&
      node.initializer &&
      ts.isStringLiteral(node.initializer) &&
      ["dialog", "alertdialog"].includes(node.initializer.text)
    ) {
      found = true;
    }

    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      ["DialogContent", "AlertDialogContent", "SheetContent", "Drawer.Content"].includes(
        node.tagName.getText(sourceFile),
      )
    ) {
      found = true;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return found;
}

function readMatrix(): BackMatrix {
  return JSON.parse(fs.readFileSync(matrixPath, "utf8")) as BackMatrix;
}

describe("Android 2.1 Back ownership matrix", () => {
  it("accounts for every production dialog, alert dialog, and sheet source", () => {
    const renderedLayers = scanRoots
      .flatMap(walkProductionTsx)
      .filter(rendersOwnedLayer)
      .sort();
    const matrixSources = readMatrix().entries.map((entry) => entry.source).sort();

    expect(matrixSources).toEqual(renderedLayers);
  });

  it("binds every ownership claim to executable source evidence", () => {
    const matrix = readMatrix();
    expect(matrix.schemaVersion).toBe(1);
    expect(new Set(matrix.entries.map((entry) => entry.source)).size).toBe(matrix.entries.length);

    for (const entry of matrix.entries) {
      expect(entry.note.trim().length, `${entry.source} needs a concrete note`).toBeGreaterThan(12);
      const source = fs.readFileSync(path.join(projectRoot, entry.source), "utf8");
      if (entry.ownership === "registered-lifo") {
        expect(source, entry.source).toMatch(/useBackHandler|registerModalCloseCallback/);
      } else if (entry.ownership === "shared-modal-hook") {
        expect(source, entry.source).toMatch(/useModalA11y|useModalClose|useModalState/);
      } else {
        expect(source, entry.source).toContain("Escape");
      }
    }
  });

  it("keeps the global fallback non-destructive", () => {
    const source = fs.readFileSync(
      path.join(projectRoot, "src/lib/androidBackHandler.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/querySelectorAll\([^)]*button|\.click\(\)/);
    expect(source).toContain('key: "Escape"');
    expect(source).toContain("return true;");
  });

  it("registers shared modal state exactly once", () => {
    const source = fs.readFileSync(
      path.join(projectRoot, "src/hooks/useModalState.ts"),
      "utf8",
    );
    const sourceFile = ts.createSourceFile(
      "src/hooks/useModalState.ts",
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const importedHooks: string[] = [];
    const calledHooks: string[] = [];

    const visit = (node: ts.Node): void => {
      if (ts.isImportSpecifier(node)) importedHooks.push(node.name.text);
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        calledHooks.push(node.expression.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);

    expect(importedHooks).not.toContain("useBackHandler");
    expect(calledHooks).not.toContain("useBackHandler");
    expect(calledHooks.filter((name) => name === "useModalA11y")).toHaveLength(2);
  });
});
