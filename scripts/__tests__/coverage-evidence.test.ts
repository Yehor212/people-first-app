import { describe, expect, it } from "vitest";
import { validateCoverageSummary } from "../check-coverage-evidence.mjs";

const metric = (total: number, covered: number) => ({
  total,
  covered,
  skipped: 0,
  pct: total === 0 ? 100 : (covered / total) * 100,
});

const summary = (
  files: Record<string, Record<"lines" | "functions" | "statements" | "branches", ReturnType<typeof metric>>>,
) => ({
  total: Object.values(files).reduce(
    (totals, file) => {
      for (const key of ["lines", "functions", "statements", "branches"] as const) {
        totals[key].total += file[key].total;
        totals[key].covered += file[key].covered;
        totals[key].pct = totals[key].total === 0
          ? 100
          : (totals[key].covered / totals[key].total) * 100;
      }
      return totals;
    },
    {
      lines: metric(0, 0),
      functions: metric(0, 0),
      statements: metric(0, 0),
      branches: metric(0, 0),
    },
  ),
  ...files,
});

describe("coverage evidence guard", () => {
  it("rejects a zero-total report even when Istanbul labels it 100 percent", () => {
    expect(() => validateCoverageSummary(summary({}))).toThrow(/zero executable totals/i);
  });

  it("rejects an asset-only report as evidence for application source", () => {
    const report = summary({
      "/repo/src/styles.css": {
        lines: metric(4, 4),
        functions: metric(1, 1),
        statements: metric(4, 4),
        branches: metric(2, 2),
      },
    });

    expect(() => validateCoverageSummary(report)).toThrow(/TypeScript application source/i);
  });

  it("accepts a nonzero internally consistent TS and TSX source report", () => {
    const report = summary({
      "/repo/src/lib/example.ts": {
        lines: metric(5, 4),
        functions: metric(2, 1),
        statements: metric(6, 5),
        branches: metric(4, 3),
      },
      "/repo/src/pages/Example.tsx": {
        lines: metric(3, 3),
        functions: metric(1, 1),
        statements: metric(4, 4),
        branches: metric(2, 1),
      },
    });

    expect(validateCoverageSummary(report)).toMatchObject({
      sourceFileCount: 2,
      totals: {
        lines: 8,
        functions: 3,
        statements: 10,
        branches: 6,
      },
    });
  });

  it("rejects totals that do not match the reported source files", () => {
    const report = summary({
      "/repo/src/lib/example.ts": {
        lines: metric(5, 4),
        functions: metric(2, 1),
        statements: metric(6, 5),
        branches: metric(4, 3),
      },
    });
    report.total.lines.total += 1;

    expect(() => validateCoverageSummary(report)).toThrow(/does not match file totals/i);
  });
});
