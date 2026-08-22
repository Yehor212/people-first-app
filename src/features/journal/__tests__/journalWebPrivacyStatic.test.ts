import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const journalModuleSource = readFileSync("src/features/journal/JournalModule.tsx", "utf8");
const useAuthSessionSource = readFileSync("src/hooks/useAuthSession.ts", "utf8");
const authRedirectSource = readFileSync("src/lib/authRedirect.ts", "utf8");
const journalEntryListSource = readFileSync("src/features/journal/JournalEntryList.tsx", "utf8");
const journalAiConsentDialogSource = readFileSync(
  "src/features/journal/JournalAiConsentDialog.tsx",
  "utf8",
);
const onThisDaySource = readFileSync("src/features/journal/OnThisDayCard.tsx", "utf8");
const memoryPortalSource = readFileSync("src/features/journal/MemoryPortalCanvas.tsx", "utf8");
const exportPickerDialogSource = readFileSync("src/features/journal/ExportPickerDialog.tsx", "utf8");
const removePasswordDialogSource = readFileSync("src/features/journal/RemovePasswordConfirmDialog.tsx", "utf8");
const localeSources = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"].map((language) => ({
  language,
  source: readFileSync(`src/i18n/languages/${language}.ts`, "utf8"),
}));

function sliceRequiredBlock(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  expect(start, `Missing start marker: ${startMarker}`).toBeGreaterThanOrEqual(0);
  expect(end, `Missing end marker after ${startMarker}: ${endMarker}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("web diary privacy and reset contracts", () => {
  it("requires password reset sign-in to match the requested immutable account id and email", () => {
    const resetListenerBlock = sliceRequiredBlock(
      journalModuleSource,
      "// Magic link fallback",
      "const mobileDiarySectionButtonClass",
    );
    const resetConsumerBlock = sliceRequiredBlock(
      journalModuleSource,
      "const consumeVerifiedPasswordReset = useCallback(",
      "// --- HOOKS",
    );

    expect(journalModuleSource).toContain(
      'const JOURNAL_PASSWORD_RESET_AUTH_EVENTS = new Set(["SIGNED_IN", "TOKEN_REFRESHED", "INITIAL_SESSION"]);',
    );
    expect(journalModuleSource).toContain('import { AUTH_COMPLETE_EVENT, getAuthRedirectUrl } from "@/lib/authRedirect";');
    expect(journalModuleSource).not.toContain("function hasJournalPasswordResetRedirectProof");
    expect(resetListenerBlock).toContain("JOURNAL_PASSWORD_RESET_AUTH_EVENTS.has(event)");
    expect(resetListenerBlock).toContain("window.addEventListener(AUTH_COMPLETE_EVENT");
    expect(resetListenerBlock).toContain("hasJournalPasswordResetProof(currentPending)");
    expect(resetListenerBlock).toContain("parseJournalPasswordResetRequest");
    expect(resetListenerBlock).toContain("consumeVerifiedPasswordReset(session)");
    expect(resetConsumerBlock).toContain("hasJournalPasswordResetProof(pending)");
    expect(resetConsumerBlock).toContain("signedInEmail !== pending.email");
    expect(resetConsumerBlock).toContain("sessionUserId !== pending.userId");
    const removePasswordIndex = resetConsumerBlock.indexOf("security.removePassword(");
    expect(removePasswordIndex).toBeGreaterThanOrEqual(0);
    expect(resetConsumerBlock.indexOf("signedInEmail !== pending.email")).toBeLessThan(removePasswordIndex);
    expect(resetConsumerBlock.indexOf("sessionUserId !== pending.userId")).toBeLessThan(removePasswordIndex);
    expect(resetConsumerBlock.indexOf("hasJournalPasswordResetProof(pending)")).toBeLessThan(removePasswordIndex);
  });

  it("cleans the one-time journal reset nonce from the URL after consuming proof", () => {
    const resetConsumerBlock = sliceRequiredBlock(
      journalModuleSource,
      "const consumeVerifiedPasswordReset = useCallback(",
      "// --- HOOKS",
    );

    expect(resetConsumerBlock).toContain("clearJournalPasswordResetParamFromCurrentUrl()");
    const consumeIndex = resetConsumerBlock.indexOf("consumeJournalPasswordResetProof");
    const successCleanupIndex = resetConsumerBlock.indexOf(
      "clearJournalPasswordResetParamFromCurrentUrl()",
      consumeIndex,
    );
    expect(consumeIndex).toBeGreaterThanOrEqual(0);
    expect(successCleanupIndex).toBeGreaterThan(consumeIndex);
    expect(successCleanupIndex).toBeLessThan(
      resetConsumerBlock.indexOf("security.removePassword("),
    );
  });

  it("stores journal reset proof before notifying auth completion on web callbacks", () => {
    const completeWebOAuthSessionBlock =
      /const completeWebOAuthSession = \([\s\S]*?\n\s{4}};/.exec(useAuthSessionSource)?.[0] ?? "";
    const callbackExchangeBlock = sliceRequiredBlock(
      useAuthSessionSource,
      "const completeManualWebOAuthCallback = async (",
      "const {\n      data: { subscription },",
    );
    const pkceCallbackBlock = sliceRequiredBlock(
      authRedirectSource,
      "if (code) {",
      "// Fallback: Implicit flow",
    );

    expect(pkceCallbackBlock).toContain(
      "persistJournalPasswordResetProofFromUrl(url, data.session.user.id)",
    );
    expect(pkceCallbackBlock.indexOf("persistJournalPasswordResetProofFromUrl")).toBeLessThan(
      pkceCallbackBlock.indexOf("return data.session"),
    );
    expect(callbackExchangeBlock).toContain(
      "const callbackSession = await handleAuthCallback(supabase, window.location.href)",
    );
    expect(callbackExchangeBlock).toContain(
      "completeWebOAuthSession(callbackSession)",
    );
    expect(completeWebOAuthSessionBlock).toContain("notifyAuthComplete()");
  });

  it("uses WebView-safe spaced calc syntax for journal security dialog safe areas", () => {
    for (const [name, source] of [
      ["JournalModule", journalModuleSource],
      ["ExportPickerDialog", exportPickerDialogSource],
      ["RemovePasswordConfirmDialog", removePasswordDialogSource],
    ] as const) {
      expect(source, name).not.toContain("100dvh-env(");
      expect(source, name).not.toContain("env(safe-area-inset-top)-env");
    }

    expect(journalModuleSource).toContain(
      "max-h-[calc(var(--app-viewport-height)_-_var(--safe-top)_-_var(--safe-bottom)_-_2rem)]",
    );
    expect(exportPickerDialogSource).toContain(
      "max-h-[calc(var(--app-viewport-height)-var(--safe-top)-0.75rem)]",
    );
    expect(removePasswordDialogSource).toContain("zf-safe-area-dialog");
  });

  it("routes the memory portal through the shared native-safe viewport tokens", () => {
    expect(memoryPortalSource).toContain('"var(--safe-top)"');
    expect(memoryPortalSource).toContain('"var(--safe-bottom)"');
    expect(memoryPortalSource).not.toContain("env(safe-area-inset");
  });

  it("passes private mode into the lazy statistics surface", () => {
    const statsBlock = /<LazyJournalStats[\s\S]*?\/>/.exec(journalModuleSource)?.[0] ?? "";

    expect(statsBlock).toContain("privateMode={privateMode}");
  });

  it("keeps On This Day behind the explicit memory portal instead of ordinary journal surfaces", () => {
    const moduleBlocks = [...journalModuleSource.matchAll(/<OnThisDayCard[\s\S]*?\/>/g)].map((match) => match[0]);
    expect(moduleBlocks).toHaveLength(0);

    const portalBlock = /<OnThisDayCard[\s\S]*?\/>/.exec(memoryPortalSource)?.[0] ?? "";
    expect(portalBlock).not.toBe("");
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

  it("keeps Memory Portal node aria labels private", () => {
    expect(memoryPortalSource).toContain('data-testid="memory-portal-node"');
    expect(memoryPortalSource).not.toContain('aria-label={`${node.title} ${formatPortalDate(node.date)}`}');
    expect(memoryPortalSource).toMatch(/aria-label=\{[\s\S]*?privateMode[\s\S]*?journalHubSpacePrivate[\s\S]*?formatPortalDate\(node\.date, locale\)/);
  });

  it("hides memory portal day capsule titles and tags while private mode is active", () => {
    expect(memoryPortalSource).toContain("privateMode ?");
    expect(memoryPortalSource).toContain("journalHubSpacePrivate");
    expect(memoryPortalSource).toContain("!privateMode && getVisibleJournalTags(entry.tags)");
  });

  it("keeps the space capture board private while private mode is active", () => {
    const captureBoardBlock =
      /data-testid="journal-capture-board-card"[\s\S]*?data-testid="journal-capture-open-editor"[\s\S]*?<\/button>/.exec(
        journalEntryListSource,
      )?.[0] ?? "";

    expect(captureBoardBlock).toMatch(/privateMode[\s\S]*?\?[\s\S]*?journalPrivateEntry/);
    expect(captureBoardBlock).toContain("!privateMode && focusedCapture.fields");
    expect(captureBoardBlock).toContain("aria-disabled={privateMode || undefined}");
    expect(captureBoardBlock).toContain("disabled={!focusedCapture || privateMode}");
    expect(captureBoardBlock).toContain("if (privateMode || !focusedCapture) return;");
    expect(captureBoardBlock.search(/privateMode[\s\S]*?\?[\s\S]*?journalPrivateEntry/)).toBeLessThan(
      captureBoardBlock.indexOf("getCaptureDisplayTitle(focusedCapture, ts)"),
    );
  });

  it("keeps the capture studio compose branch private while private mode is active", () => {
    const studioComposeBlock =
      /data-testid="journal-capture-studio"[\s\S]*?data-testid="journal-capture-save"[\s\S]*?<\/button>/.exec(
        journalEntryListSource,
      )?.[0] ?? "";

    expect(studioComposeBlock).toContain("getSpaceDisplayName(activeStudio)");
    expect(studioComposeBlock).toContain("getSpaceDisplayDescription(activeStudio)");
    expect(studioComposeBlock).toContain('activeStudio.id === "space-all" ? ts.all || "All" : getSpaceDisplayName(activeStudio)');
    expect(studioComposeBlock).not.toContain("{activeStudio.name}");
    expect(studioComposeBlock).not.toContain("{activeStudio.description}");
  });

  it("keeps private space prefill payloads free of hidden folder names and ids", () => {
    const studioPrefillBlock =
      /const buildStudioPrefill = useCallback\([\s\S]*?const handleSaveStudioCapture/.exec(
        journalEntryListSource,
      )?.[0] ?? "";
    const filteredEmptyActionBlock =
      /activeFilterSpaceName && !deferredSearch && onNewEntryWithPrefill[\s\S]*?<\/button>/.exec(
        journalEntryListSource,
      )?.[0] ?? "";

    expect(studioPrefillBlock).toContain('tags: privateMode || space.id === "space-all" ? [] : [space.name]');
    expect(studioPrefillBlock).toContain(
      'spaceId: !privateMode && space.id.startsWith("space-") && space.id !== "space-all" ? space.id : undefined',
    );
    expect(studioPrefillBlock).not.toContain('tags: space.id === "space-all" ? [] : [space.name]');
    expect(studioPrefillBlock).not.toContain(
      'spaceId: space.id.startsWith("space-") && space.id !== "space-all" ? space.id : undefined',
    );

    expect(filteredEmptyActionBlock).toContain("tags: privateMode ? [] : [activeFilterSpaceName]");
    expect(filteredEmptyActionBlock).toContain("spaceId: privateMode ? undefined : selectedSpaceId ?? undefined");
    expect(filteredEmptyActionBlock).not.toContain("tags: [activeFilterSpaceName]");
    expect(filteredEmptyActionBlock).not.toContain("spaceId: selectedSpaceId ?? undefined");
  });

  it("guards the shared entry open handler while private mode is active", () => {
    const handleTapBlock =
      /const handleTap = useCallback\([\s\S]*?\n\s{2}const handleDelete/.exec(journalEntryListSource)?.[0] ?? "";

    expect(handleTapBlock).toContain("privateMode");
    expect(handleTapBlock).toContain("onOpenEntry(id)");
    expect(handleTapBlock.indexOf("privateMode")).toBeLessThan(handleTapBlock.indexOf("onOpenEntry(id)"));
  });

  it("keeps the desktop entry context menu from opening private entries", () => {
    const contextItemsBlock =
      /const getEntryContextItems = useCallback\([\s\S]*?return items;[\s\S]*?\n\s{2}\);/.exec(
        journalEntryListSource,
      )?.[0] ?? "";

    expect(contextItemsBlock).toContain('label: ts.open || "Open"');
    expect(contextItemsBlock).toContain("if (!privateMode) {");
    expect(contextItemsBlock.indexOf("if (!privateMode) {")).toBeLessThan(
      contextItemsBlock.indexOf('label: ts.open || "Open"'),
    );
    expect(contextItemsBlock).not.toMatch(/const items:[\s\S]*?\[\s*\{\s*label: ts\.open \|\| "Open"/);
  });

  it("keeps privacy copy honest about account sync in every supported locale", () => {
    for (const { language, source } of localeSources) {
      const description = /privacyDescription:\s*"([^"]+)"/.exec(source)?.[1] ?? "";
      expect(description, `${language} privacyDescription`).not.toMatch(/stays? on (?:the )?device|remain(?:s)? on (?:the )?device|bleiben auf dem Gerät|permanecen en el dispositivo|restent sur l'appareil|デバイス上|تبقى على جهازك|נשארים במכשיר|залишаються на пристрої/i);
      expect(description, `${language} privacyDescription`).toMatch(/sync|синх|sincron|synchron|同期|مزامنة|סנכרון/i);
    }
  });

  it("blocks remote folder cover images from diary visual surfaces", () => {
    expect(journalEntryListSource).toContain("getSafeSpaceCoverImageUrl");
    expect(journalEntryListSource).toContain("toCssImageUrl");
    expect(journalEntryListSource).toContain("/^(?:https?:)?\\/\\//i");
    expect(journalEntryListSource).not.toContain("url(${space.coverImage})");
  });

  it("requires explicit consent before account-backed private search without indexing", () => {
    const activationBlock = sliceRequiredBlock(
      journalEntryListSource,
      "const activateAiMode = useCallback(",
      "const confirmAiConsent = useCallback(",
    );
    const confirmationBlock = sliceRequiredBlock(
      journalEntryListSource,
      "const confirmAiConsent = useCallback(",
      "// Toggle private account-backed search",
    );
    expect(journalEntryListSource).toContain("JournalAiConsentDialog");
    expect(journalAiConsentDialogSource).toContain("journalAiPrivacyConfirm");
    expect(journalEntryListSource).not.toContain("window.confirm");
    expect(activationBlock).not.toContain("generateAllMissingEmbeddings");
    expect(journalEntryListSource).not.toContain("generateAllMissingEmbeddingsLazy");
    expect(confirmationBlock).toContain("await withJournalRequestTimeout(grantJournalAiConsent())");
    expect(confirmationBlock.indexOf("await withJournalRequestTimeout(grantJournalAiConsent())")).toBeLessThan(
      confirmationBlock.indexOf("activateAiMode()"),
    );
  });

  it("localizes the private-search provider boundary in every supported locale", () => {
    for (const { language, source } of localeSources) {
      const disclosure = /journalAiPrivacyConfirm:\s*"([^"]+)"/.exec(source)?.[1] ?? "";
      expect(disclosure, `${language} journalAiPrivacyConfirm`).toMatch(
        /private|приват|privad|privat|privée|プライベート|الخاص|הפרטי/i,
      );
      expect(disclosure, `${language} journalAiPrivacyConfirm`).toMatch(
        /provider|провайдер|proveedor|Anbieter|fournisseur|プロバイダー|مزود|ספק/i,
      );
      expect(disclosure, `${language} journalAiPrivacyConfirm`).toContain("Supabase");
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

  it("scopes password encryption honestly in every supported locale", () => {
    for (const { language, source } of localeSources) {
      const hints = ["journalLockHint", "journalLockHintLocalOnly"].map((key) => ({
        key,
        value: new RegExp(String.raw`${key}:\s*"([^"]+)"`).exec(source)?.[1] ?? "",
      }));

      for (const { key, value } of hints) {
        expect(value, `${language} ${key} encrypted content scope`).toMatch(
          /writing|content|текст|contenido|Tagebuchtext|textes|本文|نصوص|תוכן/i,
        );
        expect(value, `${language} ${key} encrypted attachment scope`).toMatch(
          /attachment|вкладенн|archivo|Anhänge|pièces jointes|添付|مرفق|קבצים.*מצורפים/i,
        );
        expect(value, `${language} ${key} metadata exclusion`).toMatch(
          /not encrypted|не шифр|no se cifr|nicht verschlüsselt|ne sont pas chiffr|暗号化されません|لا يتم تشفير|אינם מוצפנים/i,
        );
        expect(value, `${language} ${key} title metadata`).toMatch(
          /titles|назви|títulos|Titel|titres|タイトル|العناوين|כותרות/i,
        );
      }
    }
  });
});
