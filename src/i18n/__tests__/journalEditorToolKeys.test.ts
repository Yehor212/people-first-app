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
  "diaryPhotoGestureInstructions",
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
});
