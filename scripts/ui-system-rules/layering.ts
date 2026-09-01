import ts from "typescript";

import {
  normalizeUiGuardPath,
  stableUiGuardFingerprint,
  type UiGuardFinding,
  type UiGuardInput,
} from "./containment";

function isCentralSheetPrimitive(filePath: string): boolean {
  return /^src\/components\/ui\/(?:sheet|SheetMotion)\.tsx$/.test(
    normalizeUiGuardPath(filePath)
  );
}

function collectStringLiterals(node: ts.Node): string[] {
  const values: string[] = [];
  const visit = (candidate: ts.Node) => {
    if (ts.isStringLiteralLike(candidate)) {
      values.push(candidate.text);
      return;
    }
    ts.forEachChild(candidate, visit);
  };
  visit(node);
  return values;
}

function collectNumericZIndices(node: ts.Node): number[] {
  const layers: number[] = [];
  const visit = (candidate: ts.Node) => {
    if (
      ts.isPropertyAssignment(candidate) &&
      candidate.name.getText() === "zIndex" &&
      ts.isNumericLiteral(candidate.initializer)
    ) {
      layers.push(Number(candidate.initializer.text));
    }
    ts.forEachChild(candidate, visit);
  };
  visit(node);
  return layers;
}

function buildStaticMaps(sourceFile: ts.SourceFile) {
  const classValues = new Map<string, string[]>();
  const inlineLayers = new Map<string, number[]>();
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      const strings = collectStringLiterals(node.initializer);
      if (strings.some((value) => /\bz-\[\d+\](?=\s|$)/.test(value))) {
        classValues.set(node.name.text, strings);
      }
      const layers = collectNumericZIndices(node.initializer);
      if (layers.length > 0) {
        inlineLayers.set(node.name.text, layers);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { classValues, inlineLayers };
}

function getAttribute(
  opening: ts.JsxOpeningLikeElement,
  attributeName: string
): ts.JsxAttribute | undefined {
  return opening.attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) && property.name.getText() === attributeName
  );
}

function classLayersFor(
  attribute: ts.JsxAttribute,
  classValues: ReadonlyMap<string, string[]>
): number[] {
  const values: string[] = [];
  if (attribute.initializer && ts.isStringLiteral(attribute.initializer)) {
    values.push(attribute.initializer.text);
  } else if (
    attribute.initializer &&
    ts.isJsxExpression(attribute.initializer) &&
    attribute.initializer.expression
  ) {
    const referenced = new Set<string>();
    const visit = (node: ts.Node) => {
      if (ts.isStringLiteralLike(node)) values.push(node.text);
      if (ts.isIdentifier(node) && classValues.has(node.text)) referenced.add(node.text);
      ts.forEachChild(node, visit);
    };
    visit(attribute.initializer.expression);
    for (const name of [...referenced].sort()) {
      values.push(...(classValues.get(name) ?? []));
    }
  }

  const layers = new Set<number>();
  for (const value of values) {
    for (const match of value.matchAll(/\bz-\[(\d+)\]/g)) {
      layers.add(Number(match[1]));
    }
  }
  return [...layers].sort((left, right) => left - right);
}

function inlineLayersFor(
  attribute: ts.JsxAttribute,
  inlineLayerValues: ReadonlyMap<string, number[]>
): number[] {
  if (
    !attribute.initializer ||
    !ts.isJsxExpression(attribute.initializer) ||
    !attribute.initializer.expression
  ) {
    return [];
  }
  const layers = new Set<number>(collectNumericZIndices(attribute.initializer.expression));
  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node)) {
      for (const layer of inlineLayerValues.get(node.text) ?? []) layers.add(layer);
    }
    ts.forEachChild(node, visit);
  };
  visit(attribute.initializer.expression);
  return [...layers].sort((left, right) => left - right);
}

export function checkLayering({ path, source }: UiGuardInput): UiGuardFinding[] {
  const normalizedPath = normalizeUiGuardPath(path);
  if (!isCentralSheetPrimitive(normalizedPath)) return [];

  const sourceFile = ts.createSourceFile(
    normalizedPath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const { classValues, inlineLayers } = buildStaticMaps(sourceFile);
  const findings = new Map<string, UiGuardFinding>();

  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const classAttribute = getAttribute(node, "className");
      const styleAttribute = getAttribute(node, "style");
      if (classAttribute && styleAttribute) {
        const classLayerValues = classLayersFor(classAttribute, classValues);
        const inlineLayerValues = inlineLayersFor(styleAttribute, inlineLayers);
        const conflicts = classLayerValues.some(
          (classLayer) => !inlineLayerValues.includes(classLayer)
        );

        if (classLayerValues.length > 0 && inlineLayerValues.length > 0 && conflicts) {
          const signature = `class:${classLayerValues.join(",")}|inline:${inlineLayerValues.join(
            ","
          )}`;
          const fingerprint = stableUiGuardFingerprint(
            "layering",
            normalizedPath,
            signature
          );
          if (!findings.has(fingerprint)) {
            const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
            findings.set(fingerprint, {
              rule: "layering",
              path: normalizedPath,
              line,
              fingerprint,
              severity: "medium",
              rationale: `One Sheet content node receives class layer ${classLayerValues
                .map((layer) => `z-[${layer}]`)
                .join("/")} and conflicting inline zIndex ${inlineLayerValues.join("/")}.`,
              mode: "report-only",
            });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return [...findings.values()].sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.line - right.line ||
      left.fingerprint.localeCompare(right.fingerprint)
  );
}
