import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), "src/pages/nav-v2/settings", path), "utf8");

const sources = {
  moduleCard: read("components/SettingsModuleCard.tsx"),
  page: read("components/SettingsPageComponents.tsx"),
  controls: read("components/V2SettingsControlPrimitives.tsx"),
  forms: read("components/V2SettingsFormPrimitives.tsx"),
  appearanceBasics: read("V2SettingsAppearanceBasics.tsx"),
  appearanceAccent: read("V2SettingsAppearanceAccent.tsx"),
  about: read("V2SettingsAboutPanel.tsx"),
  notifications: `${read("V2SettingsNotificationsPanel.tsx")}\n${read(
    "V2SettingsNotificationFeedback.tsx"
  )}\n${read("V2SettingsReminderSchedule.tsx")}`,
  sound: read("V2SettingsSoundPanel.tsx"),
};

describe("Settings localized text wrapping contract", () => {
  it("does not let the browser invent hyphens in ordinary translated text", () => {
    for (const source of Object.values(sources)) {
      expect(source).not.toContain("[overflow-wrap:normal]");
      expect(source).not.toContain("[hyphens:auto]");
    }

    expect(sources.about).toMatch(
      /const footerLegalLabelClass\s*=\s*"min-w-0 max-w-full whitespace-normal text-center \[hyphens:manual\] \[overflow-wrap:break-word\]";/
    );
    expect(sources.about.match(/className=\{footerLegalLabelClass\}/g)).toHaveLength(2);
  });

  it("uses manual hyphenation with an emergency word boundary in every text surface", () => {
    expect(sources.moduleCard).toContain('overflowWrap: "break-word"');
    expect(sources.moduleCard).toContain('hyphens: "manual"');

    for (const source of Object.values(sources).filter((source) => source !== sources.moduleCard)) {
      expect(source).toContain("[hyphens:manual]");
      expect(source).toContain("[overflow-wrap:break-word]");
    }
  });

  it("keeps identifier wrapping limited to the mixed-direction user filename detail", () => {
    expect(sources.forms.match(/\[overflow-wrap:anywhere\]/g)).toHaveLength(1);
    expect(sources.forms).toContain('dir="auto"');

    for (const [name, source] of Object.entries(sources)) {
      if (name !== "forms") expect(source).not.toContain("[overflow-wrap:anywhere]");
    }
  });

  it("gives both reachable sound errors a shrinkable emergency wrapping track", () => {
    expect(sources.notifications).toMatch(
      /<span className="min-w-0 break-words \[hyphens:manual\] \[overflow-wrap:break-word\]">\s*\{error\}\s*<\/span>/
    );
    expect(sources.sound).toMatch(
      /<span className="min-w-0 break-words \[hyphens:manual\] \[overflow-wrap:break-word\]">\s*\{saveError\}\s*<\/span>/
    );
  });
});
