import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DOC = "docs/ai/BEST_PRACTICES_IMPLIED_REQUIREMENTS_GATE.md";
const CHECKER = "scripts/check-best-practices-gate.cjs";

const REQUIRED_STANDARD_REFERENCES = [
  "https://developer.android.com/docs/quality-guidelines/core-app-quality",
  "https://developer.android.com/develop/ui/compose/system/icon_design_adaptive",
  "https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Define_app_icons",
  "https://web.dev/learn/pwa/web-app-manifest",
  "https://developer.apple.com/design/human-interface-guidelines/app-icons",
  "https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/best-practices",
  "https://www.w3.org/TR/WCAG22/",
  "https://web.dev/articles/vitals",
  "https://owasp.org/www-project-application-security-verification-standard/",
  "https://mas.owasp.org/MASVS/",
  "https://playwright.dev/docs/best-practices",
  "https://testing-library.com/docs/guiding-principles/",
];

describe("best-practices implied requirements gate", () => {
  it("is documented, wired into completion, and backed by official platform standards", () => {
    expect(existsSync(DOC)).toBe(true);
    expect(existsSync(CHECKER)).toBe(true);

    const doc = read(DOC);
    const checker = read(CHECKER);
    const agents = read("AGENTS.md");
    const taskCompletion = read("docs/ai/TASK_COMPLETION_PROTOCOL.md");
    const definitionOfDone = read("docs/DEFINITION_OF_DONE.md");
    const releaseChecklist = read("docs/RELEASE_CHECKLIST.md");
    const deployWorkflow = read(".github/workflows/deploy.yml");
    const driftWorkflow = read(".github/workflows/drift-checks.yml");
    const packageJson = JSON.parse(read("package.json"));

    for (const required of [
      "Explicit Requirements",
      "Implied Requirements",
      "Platform Matrix",
      "Standards Map",
      "Acceptance Evidence",
      "Implied Work Ledger",
      "Popup Question Rule",
      "UNVERIFIED Ledger",
      "Best Practices Packet",
      "Дополнительно по подразумеваемому:",
      "Web/PWA",
      "Android",
      "iOS",
      "Desktop",
      "Accessibility",
      "Performance",
      "Security And Privacy",
      "Release And Operations",
    ]) {
      expect(doc).toContain(required);
    }

    for (const url of REQUIRED_STANDARD_REFERENCES) {
      expect(doc).toContain(url);
    }

    expect(agents).toContain("Best Practices Implied Requirements Gate");
    expect(agents).toContain("Дополнительно по подразумеваемому:");
    expect(agents).toContain("popup");
    expect(agents).toContain("npm run check:best-practices");
    expect(taskCompletion).toContain(DOC);
    expect(definitionOfDone).toContain(DOC);
    expect(releaseChecklist).toContain(DOC);

    expect(packageJson.scripts["check:best-practices"]).toBe(
      "node scripts/check-best-practices-gate.cjs",
    );
    expect(packageJson.scripts["ci:preflight"]).toContain(
      "npm run check:best-practices",
    );
    expect(deployWorkflow).toContain("Check best-practices implied requirements gate");
    expect(deployWorkflow).toContain("npm run check:best-practices");
    expect(driftWorkflow).toContain("best-practices-gate");
    expect(driftWorkflow).toContain("npm run check:best-practices");

    expect(checker).toContain("REQUIRED_STANDARD_REFERENCES");
    expect(checker).toContain("Implied Work Ledger");
    expect(checker).toContain("Popup Question Rule");
    expect(checker).toContain("BEST_PRACTICES_IMPLIED_REQUIREMENTS_GATE.md");
  });
});

function read(relativePath: string): string {
  return readFileSync(relativePath, "utf8").replace(/\r\n/g, "\n");
}
