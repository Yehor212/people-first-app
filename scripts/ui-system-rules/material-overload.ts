import ts from "typescript";

import {
  isEvidenceBackedSettingsScope,
  normalizeUiGuardPath,
  stableUiGuardFingerprint,
  type UiGuardFinding,
  type UiGuardInput,
} from "./containment";

function normalizeEvidence(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function baseUtilities(value: string): string[] {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !token.includes(":"));
}

function hasUtility(classes: string[], prefix: string): boolean {
  const inactiveUtilities = new Set([
    "bg-transparent",
    "border-0",
    "border-transparent",
    "shadow-[none]",
    "shadow-none",
  ]);
  return classes.some(
    (token) =>
      !inactiveUtilities.has(token) &&
      (token === prefix || token.startsWith(`${prefix}-`))
  );
}

function hasMaterialOverload(value: string): boolean {
  const classes = baseUtilities(value);
  return (
    hasUtility(classes, "border") &&
    hasUtility(classes, "bg") &&
    hasUtility(classes, "shadow")
  );
}

function getLocalSemanticContext(node: ts.StringLiteralLike, sourceFile: ts.SourceFile): string {
  let current: ts.Node | undefined = node.parent;
  const contexts: string[] = [];
  while (current && current !== sourceFile) {
    if (ts.isPropertyAssignment(current)) {
      contexts.push(current.name.getText(sourceFile));
      break;
    }
    if (ts.isVariableDeclaration(current)) {
      contexts.push(current.name.getText(sourceFile));
      break;
    }
    if (ts.isJsxOpeningElement(current) || ts.isJsxSelfClosingElement(current)) {
      contexts.push(current.getText(sourceFile));
    } else if (ts.isJsxElement(current)) {
      contexts.push(current.openingElement.getText(sourceFile));
    }
    if (ts.isFunctionLike(current)) break;
    current = current.parent;
  }
  return contexts.join(" ");
}

function isSemanticMaterialException(value: string): boolean {
  return (
    /\b(?:destructive|danger|recovery|warning|error|confirmation|permission-blocked)\b/i.test(
      value
    ) ||
    /\brole\s*=\s*["'](?:alert|alertdialog|dialog)["']/i.test(value) ||
    /\b(?:id|data-testid)\s*=\s*["'][^"']*(?:menu|popover|tooltip)[^"']*["']/i.test(
      value
    )
  );
}

export function checkMaterialOverload({ path, source }: UiGuardInput): UiGuardFinding[] {
  const normalizedPath = normalizeUiGuardPath(path);
  if (!isEvidenceBackedSettingsScope(normalizedPath)) return [];
  const sourceFile = ts.createSourceFile(
    normalizedPath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const findings = new Map<string, UiGuardFinding>();

  const visit = (node: ts.Node) => {
    if (ts.isStringLiteralLike(node) && hasMaterialOverload(node.text)) {
      const semanticContext = getLocalSemanticContext(node, sourceFile);
      if (!isSemanticMaterialException(`${semanticContext} ${node.text}`)) {
        const normalizedClasses = normalizeEvidence(node.text);
        const fingerprint = stableUiGuardFingerprint(
          "material-overload",
          normalizedPath,
          `${normalizeEvidence(semanticContext)}|${normalizedClasses}`
        );
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

        if (!findings.has(fingerprint)) {
          findings.set(fingerprint, {
            rule: "material-overload",
            path: normalizedPath,
            line,
            fingerprint,
            severity: "medium",
            rationale:
              "Ordinary presentation combines border, background, and shadow on one surface; verify that every material cue carries distinct hierarchy or state information.",
            mode: "report-only",
          });
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
