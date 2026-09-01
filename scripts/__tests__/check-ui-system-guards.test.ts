import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  collectUiGuardFindings,
  partitionBaseline,
  renderUiGuardHumanReport,
  renderUiGuardJson,
  runUiSystemGuardCli,
  shouldScanUiFile,
  validateBaseline,
  type UiGuardBaseline,
} from "../check-ui-system-guards";
import { checkContainment } from "../ui-system-rules/containment";
import { checkLayering } from "../ui-system-rules/layering";
import { checkMaterialOverload } from "../ui-system-rules/material-overload";
import { checkTokenDrift } from "../ui-system-rules/token-drift";

const ordinaryNestedSurface = `
export function SettingsDestination() {
  return (
    <article className="rounded-[8px] border border-border bg-card shadow-[var(--zen-shadow-card)]">
      <button className="rounded-[8px] bg-muted shadow-sm">Open appearance</button>
    </article>
  );
}
`;

const destructiveRecoverySurface = `
export function SignOutRecovery() {
  return (
    <section
      role="alert"
      aria-label="Finish signing out"
      className="rounded-[8px] border border-destructive/20 bg-destructive/10 shadow-sm"
    >
      <button className="rounded-[8px] border border-destructive bg-background shadow-sm">
        Retry safely
      </button>
    </section>
  );
}
`;

const ordinaryMaterialCombination = `
const ACTION_SURFACES = {
  primary:
    "border border-[hsl(var(--settings-v2-accent)/0.45)] bg-[hsl(var(--settings-v2-accent)/0.14)] shadow-[0_12px_28px_-22px_hsl(var(--settings-v2-accent)/0.52)]",
};
`;

const destructiveMaterialCombination = `
export function DestructiveConfirmation() {
  return (
    <div
      role="alert"
      className="rounded-[8px] border border-destructive/25 bg-destructive/10 shadow-sm"
    >
      This action cannot be undone.
    </div>
  );
}
`;

function baselineFor(
  findings: ReturnType<typeof collectUiGuardFindings>
): UiGuardBaseline {
  return {
    schemaVersion: 1,
    entries: findings.map((finding) => ({
      fingerprint: finding.fingerprint,
      path: finding.path,
      rule: finding.rule,
      rationale: finding.rationale,
      owner: "UI governance tooling owner",
      reviewDate: "2026-07-29",
      removalCondition: "Remove after the owning surface migrates to the canonical grouped pattern.",
    })),
  };
}

describe("UI-system report-only guards", () => {
  it("reports ordinary nested material containment", () => {
    const findings = checkContainment({
      path: "src/pages/nav-v2/settings/components/SettingsModuleCard.tsx",
      source: ordinaryNestedSurface,
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule: "containment",
      path: "src/pages/nav-v2/settings/components/SettingsModuleCard.tsx",
      severity: "high",
      mode: "report-only",
    });
    expect(findings[0].line).toBeGreaterThan(0);
    expect(findings[0].fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("does not flatten necessary destructive or recovery containment", () => {
    expect(
      checkContainment({
        path: "src/pages/nav-v2/settings/V2SettingsAccountPanel.tsx",
        source: destructiveRecoverySurface,
      })
    ).toEqual([]);
  });

  it("reports an ordinary border plus background plus shadow material stack", () => {
    const findings = checkMaterialOverload({
      path: "src/pages/nav-v2/settings/components/V2SettingsControlPrimitives.tsx",
      source: ordinaryMaterialCombination,
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      rule: "material-overload",
      severity: "medium",
      mode: "report-only",
    });
    expect(findings[0].rationale).toContain("border");
    expect(findings[0].rationale).toContain("background");
    expect(findings[0].rationale).toContain("shadow");
  });

  it("does not flag a semantically destructive alert material stack", () => {
    expect(
      checkMaterialOverload({
        path: "src/pages/nav-v2/settings/V2SettingsAccountDeletion.tsx",
        source: destructiveMaterialCombination,
      })
    ).toEqual([]);
  });

  it("preserves elevated modal panels as a semantic material exception", () => {
    const modalPanel = `
export function SettingsDialog() {
  return (
    <div role="dialog" aria-modal="true">
      <div className="rounded-[8px] border border-border bg-card shadow-lg">Confirm</div>
    </div>
  );
}
`;

    expect(
      checkMaterialOverload({
        path: "src/pages/nav-v2/settings/components/V2SettingsFormPrimitives.tsx",
        source: modalPanel,
      })
    ).toEqual([]);
  });

  it("does not count transparent and none utilities as active material cues", () => {
    const neutralizedMaterial = `
export function CompactHero({ controlsWired }) {
  return (
    <section
      className={cn(
        "rounded-[8px] border border-border bg-card shadow-sm",
        controlsWired && "border-transparent bg-transparent shadow-none"
      )}
    />
  );
}
`;

    const findings = checkMaterialOverload({
      path: "src/pages/nav-v2/settings/components/SettingsPageComponents.tsx",
      source: neutralizedMaterial,
    });

    expect(findings).toHaveLength(1);
    expect(findings[0].rationale).toContain("border");
  });

  it("preserves a transient menu surface as a semantic material exception", () => {
    const transientMenu = `
export function AppearanceMenu() {
  return (
    <div
      id="settings-v2-appearance-more-menu"
      data-testid="settings-v2-appearance-more-menu"
      className="absolute z-20 rounded-[8px] border border-border bg-card shadow-lg"
    />
  );
}
`;

    expect(
      checkMaterialOverload({
        path: "src/pages/nav-v2/settings/V2SettingsAppearanceBasics.tsx",
        source: transientMenu,
      })
    ).toEqual([]);
  });

  it("keeps the initial detector scope bound to the directly evidenced V2 Settings system", () => {
    expect(
      collectUiGuardFindings([
        {
          path: "src/components/canvas/GoalInput.tsx",
          source: ordinaryNestedSurface,
        },
        {
          path: "src/components/layout/BentoGrid.tsx",
          source: ordinaryMaterialCombination,
        },
      ])
    ).toEqual([]);
  });

  it("derives composed material containment from current primitive definitions", () => {
    const primitivePath =
      "src/pages/nav-v2/settings/components/V2SettingsControlPrimitives.tsx";
    const consumerPath = "src/pages/nav-v2/settings/V2SettingsSoundPanel.tsx";
    const materialDefinitions = `
export function PanelFrame({ children }) {
  return (
    <section className="rounded-[8px] border bg-card shadow-lg">{children}</section>
  );
}
export function SettingsInset({ children }) {
  return <div className="rounded-[8px] border bg-muted">{children}</div>;
}
`;
    const flatDefinitions = `
export function PanelFrame({ children }) {
  return <section className="space-y-4">{children}</section>;
}
export function SettingsInset({ children }) {
  return <div className="border-t pt-3">{children}</div>;
}
`;
    const consumer = `
export function SoundPanel() {
  return (
    <PanelFrame>
      <SettingsInset>Volume</SettingsInset>
    </PanelFrame>
  );
}
`;

    expect(
      collectUiGuardFindings([
        { path: primitivePath, source: materialDefinitions },
        { path: consumerPath, source: consumer },
      ]).filter((finding) => finding.rule === "containment")
    ).toHaveLength(1);
    expect(
      collectUiGuardFindings([
        { path: primitivePath, source: flatDefinitions },
        { path: consumerPath, source: consumer },
      ])
    ).toEqual([]);
  });

  it("keeps fingerprints stable across line-only movement", () => {
    const path = "src/pages/nav-v2/settings/components/SettingsModuleCard.tsx";
    const first = checkContainment({ path, source: ordinaryNestedSurface })[0];
    const shifted = checkContainment({
      path,
      source: `\n\n${ordinaryNestedSurface}`,
    })[0];

    expect(shifted.line).toBe(first.line + 2);
    expect(shifted.fingerprint).toBe(first.fingerprint);
  });

  it("sorts JSON and human reports deterministically", () => {
    const files = [
      {
        path: "src/pages/nav-v2/settings/ZLastSettingsSurface.tsx",
        source: ordinaryMaterialCombination,
      },
      {
        path: "src/pages/nav-v2/settings/AFirstSettingsSurface.tsx",
        source: ordinaryNestedSurface,
      },
    ];
    const forward = collectUiGuardFindings(files);
    const reverse = collectUiGuardFindings([...files].reverse());
    const baseline = baselineFor(forward);

    expect(reverse).toEqual(forward);
    expect(renderUiGuardJson(reverse, baseline)).toBe(renderUiGuardJson(forward, baseline));
    expect(renderUiGuardHumanReport(reverse, baseline)).toBe(
      renderUiGuardHumanReport(forward, baseline)
    );
    expect(JSON.parse(renderUiGuardJson(forward, baseline))).toMatchObject({
      schemaVersion: 1,
      mode: "report-only",
      summary: {
        total: forward.length,
        new: 0,
        baselined: forward.length,
        staleBaseline: 0,
      },
    });
  });

  it("requires exact, reviewable baseline metadata and exposes stale debt", () => {
    const findings = collectUiGuardFindings([
      {
        path: "src/pages/nav-v2/settings/components/V2SettingsControlPrimitives.tsx",
        source: ordinaryMaterialCombination,
      },
    ]);
    const baseline = validateBaseline(baselineFor(findings));
    expect(partitionBaseline(findings, baseline)).toMatchObject({
      newFindings: [],
      baselinedFindings: findings,
      staleBaselineEntries: [],
    });

    const rationaleDrift = validateBaseline({
      ...baseline,
      entries: baseline.entries.map((entry, index) =>
        index === 0 ? { ...entry, rationale: "A different reviewed claim." } : entry
      ),
    });
    expect(partitionBaseline(findings, rationaleDrift)).toMatchObject({
      newFindings: findings,
      baselinedFindings: [],
      staleBaselineEntries: rationaleDrift.entries,
    });

    const stale = {
      ...baseline,
      entries: [
        ...baseline.entries,
        {
          fingerprint: "a".repeat(64),
          path: "src/removed.tsx",
          rule: "containment",
          rationale: "Reviewed legacy debt.",
          owner: "UI governance tooling owner",
          reviewDate: "2026-07-29",
          removalCondition: "Remove when the file is deleted.",
        },
      ],
    };
    expect(partitionBaseline(findings, validateBaseline(stale)).staleBaselineEntries).toHaveLength(
      1
    );

    expect(() =>
      validateBaseline({
        schemaVersion: 1,
        entries: [
          {
            fingerprint: findings[0].fingerprint,
            path: findings[0].path,
            rule: findings[0].rule,
            rationale: "",
            owner: "",
            reviewDate: "29/07/2026",
            removalCondition: "",
          },
        ],
      })
    ).toThrow(/baseline/i);
  });

  it("uses narrow source exclusions and still scans settings recovery sources", () => {
    expect(
      shouldScanUiFile("src/pages/nav-v2/settings/V2SettingsAccountPanel.tsx")
    ).toBe(true);
    expect(shouldScanUiFile("src/generated/tokens.ts")).toBe(false);
    expect(shouldScanUiFile("src/dev/ui-system-preview/fixtures.tsx")).toBe(false);
    expect(shouldScanUiFile("src/components/__tests__/fixture.tsx")).toBe(false);
    expect(shouldScanUiFile("src/components/Card.recovery-copy.tsx")).toBe(false);
    expect(shouldScanUiFile("src/lib/data-visualization/palette.ts")).toBe(false);
    expect(shouldScanUiFile("src/assets/canonical/Leaf.tsx")).toBe(false);
  });

  it("reports numeric Tailwind palette drift only inside shared UI primitives", () => {
    const source = `
const badge = "border-transparent bg-blue-500 text-blue-950 hover:bg-blue-600";
`;
    const findings = checkTokenDrift({
      path: "src/components/ui/badge.tsx",
      source,
    });

    expect(findings.map((finding) => finding.rationale)).toEqual([
      expect.stringContaining("bg-blue-500"),
      expect.stringContaining("text-blue-950"),
      expect.stringContaining("hover:bg-blue-600"),
    ]);
    expect(findings.every((finding) => finding.rule === "token-drift")).toBe(true);
    expect(
      checkTokenDrift({
        path: "src/components/ui/button.tsx",
        source: `const button = "bg-primary text-primary-foreground hover:bg-primary/90";`,
      })
    ).toEqual([]);
    expect(
      checkTokenDrift({
        path: "src/pages/nav-v2/habits/ExpressiveArt.tsx",
        source,
      })
    ).toEqual([]);
  });

  it("reports one-node class versus inline layer conflicts without flagging valid pairs", () => {
    const sheetConflict = `
const sheetVariants = cva("fixed z-[60] bg-background");
const safeStyle = side === "bottom" ? { zIndex: 80 } : undefined;
export function SheetContent() {
  return <div style={safeStyle} className={cn(sheetVariants({ side }), "relative")} />;
}
`;
    const distinctNodes = `
export function DialogContent() {
  return (
    <>
      <div className="fixed inset-0 z-[60]" />
      <div className="fixed z-[70]" />
    </>
  );
}
`;

    expect(
      checkLayering({
        path: "src/components/ui/sheet.tsx",
        source: sheetConflict,
      })
    ).toEqual([
      expect.objectContaining({
        rule: "layering",
        severity: "medium",
        rationale: expect.stringContaining("z-[60]"),
      }),
    ]);
    expect(
      checkLayering({
        path: "src/components/ui/DialogMotion.tsx",
        source: distinctNodes,
      })
    ).toEqual([]);
  });

  it("keeps canonical shared primitives on semantic color and named sheet-layer roles", () => {
    const tokenPaths = [
      "src/components/ui/section-header.tsx",
      "src/components/ui/badge.tsx",
      "src/components/ui/sheet.tsx",
      "src/components/ui/SheetMotion.tsx",
    ];
    const tokenFindings = tokenPaths.flatMap((path) =>
      checkTokenDrift({
        path,
        source: readFileSync(path, "utf8"),
      }),
    );

    expect(tokenFindings).toEqual([]);

    for (const path of [
      "src/components/ui/sheet.tsx",
      "src/components/ui/SheetMotion.tsx",
    ]) {
      const source = readFileSync(path, "utf8");
      expect(checkLayering({ path, source })).toEqual([]);
      expect(source).toContain("z-[var(--z-sheet)]");
      expect(source).toContain("z-[var(--z-sheet-overlay)]");
      expect(source).not.toMatch(/\bzIndex\s*:/);
    }
  });

  it("rejects caller-controlled baseline paths and keeps the canonical repository baseline", () => {
    expect(() =>
      runUiSystemGuardCli(["--baseline", "../outside-repository.json"])
    ).toThrow(/does not accept --baseline/i);
  });
});
