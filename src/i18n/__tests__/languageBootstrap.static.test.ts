import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { resolveInitialLanguage } from "../index";

const read = (path: string) => readFileSync(path, "utf8");
const mainSource = read("src/main.tsx");
const appSource = read("src/App.tsx");
const contextSource = read("src/contexts/LanguageContext.tsx");
const i18nSource = read("src/i18n/index.ts");
const selectorSource = read("src/components/LanguageSelector.tsx");
const settingsSource = read("src/pages/nav-v2/settings/V2SettingsLanguagePanel.tsx");

describe("language runtime bootstrap contracts", () => {
  it("preloads the resolved dictionary and document direction before mounting React", () => {
    expect(mainSource).toContain("async function prepareInitialLanguageBeforeRender");
    expect(mainSource).toContain("applyDocumentLanguage(initialLanguage)");
    expect(mainSource).toContain("await loadLanguage(initialLanguage)");
    expect(mainSource).toMatch(
      /Promise\.all\(\[\s*ensureFreshVersionBeforeRender\(\),\s*prepareInitialLanguageBeforeRender\(\),?\s*\]\)/,
    );
    expect(i18nSource).toContain("hasSelectedLanguage === true");
  });

  it("accepts only the literal boolean true manual-selection marker", () => {
    expect(resolveInitialLanguage("uk", "ar", true)).toBe("uk");
    expect(resolveInitialLanguage("uk", "ar", false)).toBe("ar");
    expect(resolveInitialLanguage("uk", "ar", "true")).toBe("ar");
    expect(resolveInitialLanguage("uk", "ar", {})).toBe("ar");
    expect(resolveInitialLanguage("uk", "ar", 1)).toBe("ar");
  });

  it("keeps one runtime direction owner and preserves recovery without trapping session-only users", () => {
    expect(appSource).not.toContain("RtlDirectionManager");
    expect(contextSource).toContain("pendingLanguage: Language | null;");
    expect(contextSource).toContain("languageLoadError: Language | null;");
    expect(contextSource).toContain("languageSaveError: Language | null;");
    expect(selectorSource).toContain("retryLanguage");
    expect(selectorSource).toContain(
      "disabled={Boolean(pendingLanguage || languageLoadError)}"
    );
    expect(selectorSource).not.toContain(
      "disabled={Boolean(pendingLanguage || languageLoadError || languageSaveError)}"
    );
    expect(settingsSource).toContain("retryLanguage");
  });
});
