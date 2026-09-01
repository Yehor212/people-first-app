import { createHash } from "node:crypto";
import ts from "typescript";

export interface UiGuardInput {
  path: string;
  source: string;
  materialComponentTags?: ReadonlySet<string>;
}

export interface UiGuardFinding {
  rule: string;
  path: string;
  line: number;
  fingerprint: string;
  severity: "high" | "medium" | "low";
  rationale: string;
  mode: "report-only" | "blocking";
}

type JsxContainer = ts.JsxElement | ts.JsxSelfClosingElement;

const NATIVE_CONTAINER_TAGS = new Set(["article", "aside", "div", "form", "li", "section"]);
export function normalizeUiGuardPath(filePath: string): string {
  return filePath.replaceAll("\\", "/").replace(/^\.\//, "");
}

export function isEvidenceBackedSettingsScope(filePath: string): boolean {
  return normalizeUiGuardPath(filePath).startsWith("src/pages/nav-v2/settings/");
}

export function stableUiGuardFingerprint(
  rule: string,
  filePath: string,
  evidenceSignature: string
): string {
  return createHash("sha256")
    .update(`${rule}\n${normalizeUiGuardPath(filePath)}\n${evidenceSignature}`)
    .digest("hex");
}

function normalizeEvidence(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function getOpening(node: JsxContainer): ts.JsxOpeningLikeElement {
  return ts.isJsxElement(node) ? node.openingElement : node;
}

function getTagName(node: JsxContainer): string {
  return getOpening(node).tagName.getText();
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

function buildStaticClassMap(sourceFile: ts.SourceFile): ReadonlyMap<string, string> {
  const classes = new Map<string, string>();
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      const values = collectStringLiterals(node.initializer);
      if (values.some((value) => /\b(?:rounded|border|bg|shadow)(?:-|\b)/.test(value))) {
        classes.set(node.name.text, values.join(" "));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return classes;
}

function getStaticClassText(
  opening: ts.JsxOpeningLikeElement,
  staticClassMap: ReadonlyMap<string, string>
): string {
  const classAttribute = opening.attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) && property.name.getText() === "className"
  );
  if (!classAttribute?.initializer) return "";
  if (ts.isStringLiteral(classAttribute.initializer)) {
    return classAttribute.initializer.text;
  }
  if (!ts.isJsxExpression(classAttribute.initializer) || !classAttribute.initializer.expression) {
    return "";
  }

  const values: string[] = [];
  const referencedConstants = new Set<string>();
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteralLike(node)) {
      values.push(node.text);
      return;
    }
    if (ts.isIdentifier(node) && staticClassMap.has(node.text)) {
      referencedConstants.add(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(classAttribute.initializer.expression);
  for (const name of [...referencedConstants].sort()) {
    values.push(staticClassMap.get(name) ?? "");
  }
  return values.join(" ");
}

function baseUtilities(classText: string): string[] {
  return classText
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !token.includes(":"));
}

function hasUtility(classes: string[], prefix: string): boolean {
  return classes.some((token) => token === prefix || token.startsWith(`${prefix}-`));
}

function materialSignals(classText: string) {
  const classes = baseUtilities(classText);
  return {
    rounded: hasUtility(classes, "rounded"),
    border: hasUtility(classes, "border"),
    background: hasUtility(classes, "bg"),
    shadow: hasUtility(classes, "shadow"),
  };
}

function isOuterMaterialSurface(
  tagName: string,
  classText: string,
  materialComponentTags: ReadonlySet<string>
): boolean {
  if (materialComponentTags.has(tagName)) return true;
  if (!NATIVE_CONTAINER_TAGS.has(tagName)) return false;
  const signals = materialSignals(classText);
  return signals.rounded && signals.border && signals.background && signals.shadow;
}

function isInnerMaterialSurface(
  tagName: string,
  classText: string,
  materialComponentTags: ReadonlySet<string>
): boolean {
  if (materialComponentTags.has(tagName)) return true;
  const signals = materialSignals(classText);
  const materialCount = [signals.border, signals.background, signals.shadow].filter(Boolean).length;
  return signals.rounded && materialCount >= 2;
}

function isSemanticContainmentException(openingText: string): boolean {
  return (
    /\b(?:destructive|danger|recovery|warning|error|confirmation|permission-blocked)\b/i.test(
      openingText
    ) ||
    /\brole\s*=\s*["'](?:alert|alertdialog)["']/i.test(openingText) ||
    /\btone\s*=\s*["']danger["']/i.test(openingText)
  );
}

function collectDescendants(node: ts.JsxElement): JsxContainer[] {
  const descendants: JsxContainer[] = [];
  const visit = (candidate: ts.Node) => {
    if (ts.isJsxElement(candidate) || ts.isJsxSelfClosingElement(candidate)) {
      if (candidate !== node) descendants.push(candidate);
    }
    ts.forEachChild(candidate, visit);
  };
  for (const child of node.children) visit(child);
  return descendants;
}

function getReturnedJsx(
  functionNode: ts.FunctionDeclaration,
  sourceFile: ts.SourceFile
): JsxContainer | null {
  if (!functionNode.body) return null;
  let result: JsxContainer | null = null;
  const visit = (node: ts.Node) => {
    if (result) return;
    if (ts.isReturnStatement(node) && node.expression) {
      let expression: ts.Expression = node.expression;
      while (ts.isParenthesizedExpression(expression)) expression = expression.expression;
      if (ts.isJsxElement(expression) || ts.isJsxSelfClosingElement(expression)) {
        result = expression;
        return;
      }
    }
    if (node !== functionNode && ts.isFunctionLike(node)) return;
    ts.forEachChild(node, visit);
  };
  visit(functionNode.body);
  void sourceFile;
  return result;
}

export function inferMaterialComponentTags(files: UiGuardInput[]): ReadonlySet<string> {
  const materialTags = new Set<string>();
  for (const file of files) {
    const normalizedPath = normalizeUiGuardPath(file.path);
    if (!isEvidenceBackedSettingsScope(normalizedPath)) continue;
    const sourceFile = ts.createSourceFile(
      normalizedPath,
      file.source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
    const staticClassMap = buildStaticClassMap(sourceFile);
    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name) {
        const returned = getReturnedJsx(node, sourceFile);
        if (returned) {
          const opening = getOpening(returned);
          const tagName = getTagName(returned);
          if (NATIVE_CONTAINER_TAGS.has(tagName)) {
            const signals = materialSignals(getStaticClassText(opening, staticClassMap));
            if (signals.rounded && signals.border && signals.background) {
              materialTags.add(node.name.text);
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return materialTags;
}

export function checkContainment({
  path,
  source,
  materialComponentTags = new Set<string>(),
}: UiGuardInput): UiGuardFinding[] {
  const normalizedPath = normalizeUiGuardPath(path);
  if (!isEvidenceBackedSettingsScope(normalizedPath)) return [];
  const sourceFile = ts.createSourceFile(
    normalizedPath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const staticClassMap = buildStaticClassMap(sourceFile);
  const findings = new Map<string, UiGuardFinding>();

  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node)) {
      const outerOpening = node.openingElement;
      const outerTag = outerOpening.tagName.getText(sourceFile);
      const outerClassText = getStaticClassText(outerOpening, staticClassMap);
      const outerOpeningText = outerOpening.getText(sourceFile);

      if (
        isOuterMaterialSurface(outerTag, outerClassText, materialComponentTags) &&
        !isSemanticContainmentException(outerOpeningText)
      ) {
        const inner = collectDescendants(node).find((candidate) => {
          const opening = getOpening(candidate);
          const openingText = opening.getText(sourceFile);
          return (
            !isSemanticContainmentException(openingText) &&
            isInnerMaterialSurface(
              getTagName(candidate),
              getStaticClassText(opening, staticClassMap),
              materialComponentTags
            )
          );
        });

        if (inner) {
          const innerOpening = getOpening(inner);
          const innerTag = getTagName(inner);
          const signature = [
            outerTag,
            innerTag,
            normalizeEvidence(outerClassText || outerOpeningText),
            normalizeEvidence(
              getStaticClassText(innerOpening, staticClassMap) ||
                innerOpening.getText(sourceFile)
            ),
          ].join("|");
          const fingerprint = stableUiGuardFingerprint(
            "containment",
            normalizedPath,
            signature
          );
          const line =
            sourceFile.getLineAndCharacterOfPosition(outerOpening.getStart(sourceFile)).line + 1;

          if (!findings.has(fingerprint)) {
            findings.set(fingerprint, {
              rule: "containment",
              path: normalizedPath,
              line,
              fingerprint,
              severity: "high",
              rationale: `Ordinary ${outerTag} material contains another ${innerTag} material surface; verify that both containment levels are semantically necessary.`,
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
