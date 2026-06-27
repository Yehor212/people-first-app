import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

const v2Pages = [
  {
    id: "orb",
    loader: "loadOrbPage",
    component: "OrbPage",
    source: "src/pages/nav-v2/OrbPage.tsx",
    testId: "orb-page",
  },
  {
    id: "habits",
    loader: "loadHabitsPage",
    component: "HabitsPage",
    source: "src/pages/nav-v2/habits/HabitsPage.tsx",
    testId: "habits-page",
  },
  {
    id: "diary",
    loader: "loadDiaryPage",
    component: "DiaryPage",
    source: "src/pages/nav-v2/DiaryPage.tsx",
    testId: "diary-page",
  },
  {
    id: "planning",
    loader: "loadPlanningPage",
    component: "PlanningPage",
    source: "src/pages/nav-v2/planning/PlanningPage.tsx",
    testId: "planning-page",
  },
  {
    id: "settings",
    loader: "loadSettingsPage",
    component: "SettingsPage",
    source: "src/pages/nav-v2/settings/components/SettingsPageComponents.tsx",
    testId: "settings-page",
  },
] as const;

describe("V2 page coverage contract", () => {
  it("keeps the canonical V2 page inventory synchronized across route owners", () => {
    const navHook = read("src/hooks/useNavigationV2.ts");
    const orchestrator = read("src/components/navigation-v2/NavV2Orchestrator.tsx");
    const helper = read("e2e/helpers/zenflowV2State.ts");

    expect(navHook).toContain(
      "export const NAV_V2_PAGES: readonly NavV2Page[] = [\"orb\", \"habits\", \"diary\", \"planning\", \"settings\"] as const;",
    );

    for (const page of v2Pages) {
      expect(navHook).toContain(`"${page.id}"`);
      expect(orchestrator).toContain(`const ${page.loader} = () =>`);
      expect(orchestrator).toContain(`${page.id}: ${page.loader}`);
      expect(orchestrator).toContain(`<${page.component}`);
      expect(helper).toContain(`"${page.id}"`);
    }
  });

  it("boots every V2 page through direct-route Playwright smoke coverage", () => {
    const deploySmoke = read("e2e/deploy-smoke.spec.ts");

    for (const page of v2Pages) {
      expect(deploySmoke).toContain(
        `{ path: "${page.id}?nav=v2&navLayout=phone&dev=true", testId: "${page.testId}" }`,
      );
    }
  });

  it("keeps performance budgets on every V2 page for phone and desktop", () => {
    const perfBudgets = read("config/chrome-performance-budgets.json");

    for (const page of v2Pages) {
      expect(perfBudgets).toContain(`"${page.id}-v2-phone"`);
      expect(perfBudgets).toContain(`"path": "${page.id}/?nav=v2&navLayout=phone"`);
      expect(perfBudgets).toContain(`"${page.id}-v2-desktop"`);
      expect(perfBudgets).toContain(`"path": "${page.id}/?nav=v2"`);
    }
  });

  it("keeps every V2 page root testable, readable, and fullscreen-aware", () => {
    for (const page of v2Pages) {
      const source = read(page.source);

      expect(source).toContain(`data-testid="${page.testId}"`);
      expect(source).toContain(`data-v2-readable-page="${page.id}"`);
      expect(source).toContain("v2-fullscreen-page");
      expect(source).toContain("v2-readable-page");
      expect(source).toContain("var(--app-viewport-height)");
      expect(source).toContain("main-content-v2");
    }
  });
});
