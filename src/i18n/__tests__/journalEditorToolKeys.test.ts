import { describe, expect, it } from "vitest";
import { loadLanguage } from "../translations";
import type { Language } from "../types";

const LANGUAGES: readonly Language[] = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"];
const JOURNAL_EDITOR_TOOL_KEYS = [
  "diaryBackgroundDim",
  "diaryBackgroundFull",
  "diaryBackgroundOff",
  "diaryFormatHintLabel",
  "diaryMotion",
  "diaryParticleSpeed",
  "diaryParticleSpeedDrift",
  "diaryParticleSpeedOff",
  "diaryParticleSpeedSlow",
  "diaryPhotoGestureHint",
  "diaryPhotoDescribe",
  "diaryPhotoDescriptionLabel",
  "diaryPhotoDescriptionHelp",
  "diaryPhotoGestureInstructions",
  "diaryPhotoInteractionLabel",
  "diaryPhotoInteractionLabelWithDescription",
  "diaryPhotoLayoutStatus",
  "diaryPhotoTapDestination",
  "diaryPhotoMove",
  "diaryScene",
  "diaryTexture",
  "diaryTextureClean",
  "diaryTextureCraft",
  "diaryTextureDots",
  "diaryTextureGrid",
  "diaryTextureLinen",
  "diaryTextureLines",
  "journalDraftSaveFailed",
  "journalBackgroundSelected",
  "journalFontSizeSelected",
  "journalMotionSelected",
  "journalSceneSelected",
  "journalTextureSelected",
  "journalFormatToolbar",
  "journalInkEmerald",
  "journalInkGold",
  "journalInkRose",
  "journalInkWhite",
  "journalPanicLockDescription",
  "journalPanicLockTitle",
  "journalPanicLockUnlockRequired",
  "journalPaperDark",
  "journalPaperMilky",
  "journalPaperSoftWhite",
  "journalPhotoNext",
  "journalPhotoPrevious",
  "journalRecordingDiscard",
  "journalRecordingDiscardTitle",
  "journalRecordingDiscardDescription",
  "journalRecordingStopKeep",
  "journalRemoveAudio",
  "journalRemoveTag",
  "journalStyleTools",
  "journalToolbarInk",
  "journalToolbarPaper",
  "journalVoicePrivacyCancel",
  "journalVoicePrivacyContinue",
  "journalVoicePrivacyDescription",
  "journalVoicePrivacyTitle",
  "openPhoto",
  "previous",
] as const;

describe("journal editor tool i18n", () => {
  it("defines every editor, photo, and privacy label in all supported languages", async () => {
    for (const language of LANGUAGES) {
      const translations = (await loadLanguage(language)) as unknown as Record<string, string>;
      for (const key of JOURNAL_EDITOR_TOOL_KEYS) {
        expect(translations[key]?.trim(), `${language}.${key}`).toBeTruthy();
      }
    }
  });

  it("names the destructive unsaved-entry action explicitly in every language", async () => {
    const expectedLabels: Record<Language, string> = {
      en: "Discard changes",
      uk: "Відкинути зміни",
      es: "Descartar cambios",
      de: "Änderungen verwerfen",
      fr: "Abandonner les modifications",
      ja: "変更を破棄",
      ar: "تجاهل التغييرات",
      he: "בטל את השינויים",
    };

    for (const language of LANGUAGES) {
      const translations = (await loadLanguage(language)) as unknown as Record<string, string>;
      expect(translations.journalDiscard, language).toBe(expectedLabels[language]);
    }
  });

  it("discloses the quiet-release date and time marker in every supported language", async () => {
    for (const language of LANGUAGES) {
      const translations = (await loadLanguage(language)) as unknown as Record<string, string>;
      expect(translations.journalReleaseBeforeAction?.trim(), language).toBeTruthy();
      expect(translations.journalReleaseFinalSubtitle?.trim(), language).toBeTruthy();
    }

    const en = (await loadLanguage("en")) as unknown as Record<string, string>;
    expect(en.journalReleaseBeforeAction).toContain("date and time");
    expect(en.journalReleaseBeforeAction).toContain("backup");
    expect(en.journalReleaseFinalSubtitle).toContain("date and time");
  });

  it.each(["ar", "he"] as const)("isolates LTR keyboard names in %s", async (language) => {
    const translations = (await loadLanguage(language)) as unknown as Record<string, string>;
    expect(translations.diaryPhotoGestureInstructions).toContain("\u2066Home\u2069");
    expect(translations.diaryPhotoGestureInstructions).toContain("\u2066Delete\u2069");
  });

  it("uses whole-message templates for photo actions and selected style values", async () => {
    for (const language of LANGUAGES) {
      const translations = (await loadLanguage(language)) as unknown as Record<string, string>;
      expect(translations.diaryPhotoInteractionLabel, language).toContain("{current}");
      expect(translations.diaryPhotoInteractionLabel, language).toContain("{total}");
      expect(translations.diaryPhotoInteractionLabelWithDescription, language).toContain("{description}");
      for (const placeholder of ["{current}", "{total}", "{x}", "{y}", "{width}"]) {
        expect(translations.diaryPhotoLayoutStatus, `${language}.diaryPhotoLayoutStatus`).toContain(
          placeholder,
        );
      }
      for (const key of [
        "journalBackgroundSelected",
        "journalFontSizeSelected",
        "journalMotionSelected",
        "journalSceneSelected",
        "journalTextureSelected",
      ]) {
        expect(translations[key], `${language}.${key}`).toContain("{value}");
      }
    }
  });

  it("uses reassuring, actionable photo preparation and recovery copy", async () => {
    const expected: Record<
      Language,
      { preparing: string; failed: string; tooLarge: string }
    > = {
      en: {
        preparing: "Preparing photo...",
        failed: "Couldn't add this photo. Try again.",
        tooLarge: "This photo is larger than 10 MB. Choose a smaller photo and try again.",
      },
      uk: {
        preparing: "Готуємо фото...",
        failed: "Не вдалося додати це фото. Спробуйте ще раз.",
        tooLarge: "Це фото завелике (понад 10 МБ). Виберіть менше фото й спробуйте ще раз.",
      },
      es: {
        preparing: "Preparando la foto...",
        failed: "No se pudo añadir esta foto. Inténtalo de nuevo.",
        tooLarge: "Esta foto supera los 10 MB. Elige una más pequeña e inténtalo de nuevo.",
      },
      de: {
        preparing: "Foto wird vorbereitet...",
        failed: "Dieses Foto konnte nicht hinzugefügt werden. Versuche es erneut.",
        tooLarge:
          "Dieses Foto ist größer als 10 MB. Wähle ein kleineres Foto und versuche es erneut.",
      },
      fr: {
        preparing: "Préparation de la photo...",
        failed: "Impossible d’ajouter cette photo. Réessayez.",
        tooLarge:
          "Cette photo dépasse 10 Mo. Choisissez une photo plus petite et réessayez.",
      },
      ja: {
        preparing: "写真を準備しています...",
        failed: "この写真を追加できませんでした。もう一度お試しください。",
        tooLarge:
          "この写真は10 MBを超えています。より小さい写真を選んでもう一度お試しください。",
      },
      ar: {
        preparing: "جارٍ تجهيز الصورة...",
        failed: "تعذّرت إضافة هذه الصورة. حاول مرة أخرى.",
        tooLarge:
          "حجم هذه الصورة أكبر من 10 ميجابايت. اختر صورة أصغر وحاول مرة أخرى.",
      },
      he: {
        preparing: "מכינים את התמונה...",
        failed: "לא ניתן להוסיף את התמונה הזאת. נסו שוב.",
        tooLarge: "התמונה הזאת גדולה מ-10 MB. בחרו תמונה קטנה יותר ונסו שוב.",
      },
    };

    for (const language of LANGUAGES) {
      const translations = (await loadLanguage(language)) as unknown as Record<string, string>;
      expect(translations.journalCompressing, language).toBe(expected[language].preparing);
      expect(translations.journalPhotoError, language).toBe(expected[language].failed);
      expect(translations.journalPhotoTooLarge, language).toBe(expected[language].tooLarge);
    }
  });
});
