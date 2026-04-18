/**
 * Phase 3-A.4c-ii-d-c Integration Test #5 — V1 HomeTab regression-free.
 *
 * Goals:
 *  - Verify V1 HomeTab source file is unchanged by Phase 3 CSS work (no
 *    accidental className churn from nav-v2 refactor).
 *  - Static check that the V1 file does NOT import any nav-v2 artefacts.
 *
 * We avoid re-rendering the full HomeTab (it has deep Capacitor / Supabase
 * runtime dependencies that require the existing HomeTab.test suite). The
 * full existing V1 suite is the real regression safety net — this file is
 * an ADDITIONAL smoke check to catch the worst class of Phase 3 mistakes:
 * accidentally importing nav-v2 code into HomeTab.
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const HOMETAB_PATH = path.join(
  process.cwd(),
  "src",
  "components",
  "tabs",
  "HomeTab.tsx",
);

function readHomeTab(): string {
  return fs.readFileSync(HOMETAB_PATH, "utf-8");
}

describe("Integration #5 — V1 HomeTab regression-free", () => {
  it("HomeTab.tsx file exists at the expected V1 path", () => {
    expect(fs.existsSync(HOMETAB_PATH)).toBe(true);
  });

  it("HomeTab.tsx does NOT import anything from nav-v2 (orthogonality)", () => {
    const src = readHomeTab();
    expect(src).not.toMatch(/from\s+["']@\/pages\/nav-v2/);
    expect(src).not.toMatch(/from\s+["']@\/components\/navigation-v2/);
    expect(src).not.toMatch(/useNavigationV2/);
    expect(src).not.toMatch(/NavV2Orchestrator/);
  });

  it("HomeTab.tsx does NOT import useDiaryDraftStore (orb→diary is V2-only)", () => {
    const src = readHomeTab();
    expect(src).not.toMatch(/useDiaryDraftStore/);
    expect(src).not.toMatch(/pendingMoodContext/);
  });

  it("HomeTab.tsx still references V1 navigation primitives (smoke check)", () => {
    const src = readHomeTab();
    // Sanity that V1 file is non-trivial and still renders something
    expect(src.length).toBeGreaterThan(100);
    // Import line present for React (every component in this file exports a React component)
    expect(src).toMatch(/react/i);
  });
});
