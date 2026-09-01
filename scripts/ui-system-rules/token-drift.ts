import ts from "typescript";

import {
  normalizeUiGuardPath,
  stableUiGuardFingerprint,
  type UiGuardFinding,
  type UiGuardInput,
} from "./containment";

const NUMERIC_PALETTE_TOKEN =
  /(?:^|\s)((?:(?:active|aria-\[[^\]]+\]|data-\[[^\]]+\]|dark|disabled|focus|focus-visible|group-hover|hover|peer-checked|pressed|selected):)*(?:bg|border|fill|ring|stroke|text)-(?:amber|blue|cyan|emerald|fuchsia|gray|green|indigo|lime|neutral|orange|pink|purple|red|rose|sky|slate|stone|teal|violet|yellow|zinc)-(?:50|[1-8]00|900|950)(?:\/\d{1,3})?)(?=\s|$)/g;

function isSharedPrimitivePath(filePath: string): boolean {
  const normalized = normalizeUiGuardPath(filePath);
  return (
    normalized.startsWith("src/components/ui/") &&
    /\.(?:jsx|tsx)$/.test(normalized) &&
    !/(?:^|\/)(?:__tests__|__fixtures__)(?:\/|$)/.test(normalized) &&
    !/\.(?:spec|test)\.[jt]sx$/.test(normalized)
  );
}

export function checkTokenDrift({ path, source }: UiGuardInput): UiGuardFinding[] {
  const normalizedPath = normalizeUiGuardPath(path);
  if (!isSharedPrimitivePath(normalizedPath)) return [];

  const sourceFile = ts.createSourceFile(
    normalizedPath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const findings: UiGuardFinding[] = [];
  const tokenOccurrences = new Map<string, number>();

  const visit = (node: ts.Node) => {
    if (ts.isStringLiteralLike(node)) {
      for (const match of node.text.matchAll(NUMERIC_PALETTE_TOKEN)) {
        const token = match[1];
        const occurrence = (tokenOccurrences.get(token) ?? 0) + 1;
        tokenOccurrences.set(token, occurrence);
        const tokenOffset = node.text.indexOf(token, match.index ?? 0);
        const sourcePosition = node.getStart(sourceFile) + 1 + Math.max(0, tokenOffset);
        const line = sourceFile.getLineAndCharacterOfPosition(sourcePosition).line + 1;
        const fingerprint = stableUiGuardFingerprint(
          "token-drift",
          normalizedPath,
          `${token}|occurrence:${occurrence}`
        );
        findings.push({
          rule: "token-drift",
          path: normalizedPath,
          line,
          fingerprint,
          severity: "medium",
          rationale: `Shared primitive uses numeric palette utility "${token}" instead of a semantic ZenFlow color role.`,
          mode: "report-only",
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return findings;
}
