import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CONTRACT_PATH = resolve(
  process.cwd(),
  "docs/superpowers/specs/2026-07-28-ui-system-conformance-contract.md"
);
const SETTINGS_SPEC_PATH = resolve(
  process.cwd(),
  "docs/superpowers/specs/2026-07-12-settings-simplification-live-apply-design.md"
);
const SETTINGS_SPEC_RELATIVE_PATH =
  "docs/superpowers/specs/2026-07-12-settings-simplification-live-apply-design.md";
const DECISION_REGISTER_PATH = resolve(
  process.cwd(),
  "docs/audits/experience-quality/ui-decision-register-2026-07-28.md"
);
const PACKAGE_PATH = resolve(process.cwd(), "package.json");

const REQUIRED_CHAPTERS = [
  "## 1. Authority, Scope, And Evidence Boundary",
  "## 2. Foundations",
  "## 3. Semantic Color Pairs And Theme Recipes",
  "## 4. Typography And Localization Fallback",
  "## 5. Spacing, Size, Radius, Border, And Material",
  "## 6. Focus, Targets, Safe Areas, Containers, And Layers",
  "## 7. Motion And Transparency",
  "## 8. Iconography And Expressive Assets",
  "## 9. Canonical Component Contract",
  "## 10. Canonical Pattern Contract",
  "## 11. Platform Adaptation Matrix",
  "## 12. Accessibility And Localization Contract",
  "## 13. Governance, Generation, And Drift Control",
  "## 14. Migration, Deprecation, Exceptions, And Ownership",
  "## 15. Verification And Rejection Criteria",
  "## 16. Residual Risk And UNVERIFIED Ledger",
] as const;

const REQUIRED_FOUNDATION_TERMS = [
  "semantic color pairs",
  "type roles",
  "localization fallback",
  "spacing scale",
  "optical exception",
  "radius",
  "border",
  "separator",
  "elevation",
  "opacity",
  "material",
  "safe area",
  "breakpoint",
  "container",
  "z-index",
] as const;

const REQUIRED_PATTERN_IDS = [
  "GROUPED_SETTINGS_LIST",
  "FORM",
  "NAVIGATION",
  "DIALOG_SHEET",
  "ASYNC_FEEDBACK",
  "EMPTY_ERROR_OFFLINE_RECOVERY",
  "DESTRUCTIVE_CONFIRMATION",
  "PERMISSION_REQUEST",
  "LIST_DETAIL",
  "CHART",
] as const;

const REQUIRED_COMPONENT_IDS = [
  "PAGE",
  "SECTION",
  "GROUP",
  "LIST_ROW",
  "SETTINGS_ROW",
  "BUTTON",
  "ICON_BUTTON",
  "LINK",
  "FIELD",
  "SELECTION_CONTROL",
  "STATUS",
  "DIALOG",
  "SHEET",
  "MENU_POPOVER_TOOLTIP",
  "TOAST_SNACKBAR_BANNER",
  "EMPTY_ERROR_OFFLINE",
  "NAVIGATION",
  "CHART_DATA_VIEW",
] as const;

function readContract() {
  return readFileSync(CONTRACT_PATH, "utf8");
}

function tableRowFor(source: string, id: string) {
  return source
    .split(/\r?\n/)
    .find((line) => line.startsWith("|") && line.split("|")[1]?.trim() === id);
}

describe("ZenFlow UI-system conformance contract", () => {
  it("keeps one declared utility icon dependency aligned with the Lucide contract", () => {
    const packageJson = JSON.parse(readFileSync(PACKAGE_PATH, "utf8")) as {
      dependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies?.["lucide-react"]).toBeTruthy();
    expect(packageJson.dependencies?.["@phosphor-icons/react"]).toBeUndefined();
  });

  it("exists as the single canonical contract and imports the bounded Settings contract by reference", () => {
    const contract = readContract();
    const settingsSpec = readFileSync(SETTINGS_SPEC_PATH, "utf8");

    expect(contract).toContain("Status: Canonical source of truth");
    expect(contract).toContain(SETTINGS_SPEC_RELATIVE_PATH);
    expect(contract).toContain("imports that bounded Settings contract by reference");
    expect(settingsSpec).toContain(
      "docs/superpowers/specs/2026-07-28-ui-system-conformance-contract.md"
    );
    expect(settingsSpec).toContain("governs foundations and shared components");
  });

  it("contains every required foundation, component, pattern, platform, and governance chapter", () => {
    const contract = readContract();

    for (const chapter of REQUIRED_CHAPTERS) {
      expect(contract, `missing chapter: ${chapter}`).toContain(chapter);
    }
    for (const term of REQUIRED_FOUNDATION_TERMS) {
      expect(contract.toLowerCase(), `missing foundation term: ${term}`).toContain(term);
    }
    for (const platform of ["Web/PWA", "Android/Capacitor", "iOS/WKWebView", "Desktop/Tauri"]) {
      expect(contract, `missing platform: ${platform}`).toContain(platform);
    }
  });

  it("defines a bounded containment budget without weakening interaction or safety states", () => {
    const contract = readContract();

    expect(contract).toContain("CONTAINMENT_BUDGET");
    expect(contract).toContain("1. page background");
    expect(contract).toContain("2. one group surface");
    expect(contract).toContain("3. one semantic nested control");
    expect(contract).toContain("4. one transient overlay");
    expect(contract).toContain("Flattening rejection criteria");
    for (const protectedState of [
      "focus visibility",
      "status comprehension",
      "destructive safety",
      "high-contrast separation",
    ]) {
      expect(contract).toContain(protectedState);
    }
  });

  it("assigns an owner and proof type to every canonical component and pattern", () => {
    const contract = readContract();

    for (const id of REQUIRED_COMPONENT_IDS) {
      const row = tableRowFor(contract, id);
      expect(row, `missing canonical component row: ${id}`).toBeTruthy();
      expect(row, `component ${id} is missing owner`).not.toContain("| UNASSIGNED |");
      expect(row, `component ${id} is missing proof`).toMatch(
        /\| (?:AUTOMATED_AND_MANUAL|AUTOMATED|MANUAL_RUNTIME) \|/
      );
    }

    for (const id of REQUIRED_PATTERN_IDS) {
      const row = tableRowFor(contract, id);
      expect(row, `missing canonical pattern row: ${id}`).toBeTruthy();
      expect(row, `pattern ${id} is missing owner`).not.toContain("| UNASSIGNED |");
      expect(row, `pattern ${id} is missing proof`).toMatch(
        /\| (?:AUTOMATED_AND_MANUAL|AUTOMATED|MANUAL_RUNTIME) \|/
      );
    }
  });

  it("requires evidence, tradeoff, rejection, and verification fields for every normative rule", () => {
    const contract = readContract();

    expect(contract).toContain("RULE_RECORD");
    for (const field of [
      "Applicability",
      "Local evidence",
      "Tradeoff",
      "Rejection criterion",
      "Verification path",
    ]) {
      expect(contract).toContain(`- ${field}:`);
    }
    expect(contract).toContain("Exception owner");
    expect(contract).toContain("Expiry or recheck trigger");
    expect(contract).toContain("No silent waiver");
  });

  it("keeps bounded remediation decisions aligned with the canonical findings", () => {
    const contract = readContract();
    const decisions = readFileSync(DECISION_REGISTER_PATH, "utf8");

    expect(decisions).not.toContain("UI-9/UI-10 remain `INFERENCE/OPEN`");
    expect(decisions).toContain("UI-9 and UI-10 are `VERIFIED/FIXED`");
    expect(decisions).toMatch(/native Back and app-link delivery remain `UNVERIFIED`/i);
    expect(contract).not.toContain("`UI-9` records missing explicit Back ownership");
    expect(contract).toContain("`UI-9` records remediated explicit Back ownership");
  });
});
