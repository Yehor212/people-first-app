import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("V2-only shell inventory", () => {
  it("does not keep the old V1 app shell or preview portal files", () => {
    expect(existsSync("src/pages/IndexV1Impl.tsx")).toBe(false);
    expect(existsSync("src/components/navigation-v2/ClassicPortalLink.tsx")).toBe(false);
    expect(existsSync("src/components/tabs/PreviewPortal.tsx")).toBe(false);
  });

  it("keeps Index as the single V2 shell entry without a shell-selection API", () => {
    const source = read("src/pages/Index.tsx");

    expect(source).toContain("return <IndexV2Impl />;");
    expect(source).toContain("NavV2Orchestrator");
    expect(source).not.toContain("IndexV1Impl");
    expect(source).not.toContain("shouldUseNavV2Shell");
    expect(source).not.toContain("NavV2ShellDecision");
  });

  it("keeps legacy portal test IDs out of production V2 navigation code", () => {
    for (const file of [
      "src/components/navigation-v2/SidebarV2.tsx",
      "src/components/navigation-v2/DrawerV2.tsx",
      "src/pages/nav-v2/planning/PlanningPage.tsx",
    ]) {
      const source = read(file);
      expect(source, file).not.toContain("v1-v2-portal");
      expect(source, file).not.toContain("classic-portal");
    }
  });
});
