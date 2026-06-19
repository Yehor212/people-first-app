import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const journalModuleSource = readFileSync("src/features/journal/JournalModule.tsx", "utf8");
const journalEntryListSource = readFileSync("src/features/journal/JournalEntryList.tsx", "utf8");
const onThisDaySource = readFileSync("src/features/journal/OnThisDayCard.tsx", "utf8");
const memoryPortalSource = readFileSync("src/features/journal/MemoryPortalCanvas.tsx", "utf8");
const exportPickerDialogSource = readFileSync("src/features/journal/ExportPickerDialog.tsx", "utf8");
const localeSources = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"].map((language) => ({
  language,
  source: readFileSync(`src/i18n/languages/${language}.ts`, "utf8"),
}));

describe("web diary privacy and reset contracts", () => {
  it("requires password reset sign-in to match the requested account email", () => {
    const resetListenerBlock =
      /onAuthStateChange\(async \(event, session\)[\s\S]*?subscription = data\.subscription;/.exec(journalModuleSource)?.[0] ?? "";

    expect(resetListenerBlock).toContain('event !== "SIGNED_IN"');
    expect(resetListenerBlock).not.toContain("TOKEN_REFRESHED");
    expect(resetListenerBlock).toContain("parseJournalPasswordResetRequest");
    expect(resetListenerBlock).toContain("session?.user?.email");
    expect(resetListenerBlock).toContain("signedInEmail !== pending.email");
    expect(resetListenerBlock.indexOf("signedInEmail !== pending.email")).toBeLessThan(
      resetListenerBlock.indexOf("security.removePassword()"),
    );
  });

  it("passes private mode into every On This Day surface", () => {
    const moduleBlocks = [...journalModuleSource.matchAll(/<OnThisDayCard[\s\S]*?\/>/g)].map((match) => match[0]);
    expect(moduleBlocks.length).toBeGreaterThan(0);
    for (const block of moduleBlocks) {
      expect(block).toContain("privateMode={privateMode}");
    }

    const portalBlock = /<OnThisDayCard[\s\S]*?\/>/.exec(memoryPortalSource)?.[0] ?? "";
    expect(portalBlock).toContain("privateMode={privateMode}");
  });

  it("hides On This Day title, mood, and snippet while private mode is active", () => {
    expect(onThisDaySource).toContain("privateMode?: boolean");
    expect(onThisDaySource).toContain("privateMode = false");
    expect(onThisDaySource).toContain("!privateMode && entry.mood");
    expect(onThisDaySource).toContain("!privateMode && entry.title");
    expect(onThisDaySource).toContain("!privateMode && snippet");
    expect(onThisDaySource).toContain("journalHubSpacePrivate");
  });

  it("hides memory portal day capsule titles and tags while private mode is active", () => {
    expect(memoryPortalSource).toContain("privateMode ?");
    expect(memoryPortalSource).toContain("journalHubSpacePrivate");
    expect(memoryPortalSource).toContain("!privateMode && entry.tags");
  });

  it("keeps privacy copy honest about account sync in every supported locale", () => {
    for (const { language, source } of localeSources) {
      const description = /privacyDescription:\s*"([^"]+)"/.exec(source)?.[1] ?? "";
      expect(description, `${language} privacyDescription`).not.toMatch(/stays? on (?:the )?device|remain(?:s)? on (?:the )?device|bleiben auf dem Gerät|permanecen en el dispositivo|restent sur l'appareil|デバイス上|تبقى على جهازك|נשארים במכשיר|залишаються на пристрої/i);
      expect(description, `${language} privacyDescription`).toMatch(/sync|синх|sincron|synchron|同期|مزامنة|סנכרון/i);
    }
  });

  it("requires an explicit privacy disclosure before AI search can index diary text", () => {
    expect(journalEntryListSource).toContain("journalAiPrivacyConfirm");
    expect(journalEntryListSource).toContain("window.confirm");
    expect(journalEntryListSource).toContain("SK.JOURNAL_AI_SEARCH_CONSENT");
    expect(journalEntryListSource.indexOf("window.confirm")).toBeLessThan(
      journalEntryListSource.indexOf("void generateAllMissingEmbeddingsLazy()"),
    );
  });

  it("localizes the AI search privacy disclosure in every supported locale", () => {
    for (const { language, source } of localeSources) {
      const disclosure = /journalAiPrivacyConfirm:\s*"([^"]+)"/.exec(source)?.[1] ?? "";
      expect(disclosure, `${language} journalAiPrivacyConfirm`).toMatch(
        /AI|IA|KI|検索|الذكاء|ספק ה-AI/i,
      );
      expect(disclosure, `${language} journalAiPrivacyConfirm`).toMatch(
        /provider|провайдер|proveedor|Anbieter|fournisseur|プロバイダー|مزود|ספק/i,
      );
    }
  });

  it("discloses that diary exports create private unencrypted files", () => {
    expect(exportPickerDialogSource).toContain("journalExportPrivacyWarning");

    for (const { language, source } of localeSources) {
      const warning = /journalExportPrivacyWarning:\s*"([^"]+)"/.exec(source)?.[1] ?? "";
      expect(warning, `${language} journalExportPrivacyWarning`).toMatch(
        /encrypt|шифр|cifrad|verschl|chiffr|暗号|تشفير|מוצפן/i,
      );
      expect(warning, `${language} journalExportPrivacyWarning`).toMatch(
        /private|приват|privad|privat|privé|プライベート|خاص|פרטי/i,
      );
    }
  });
});
