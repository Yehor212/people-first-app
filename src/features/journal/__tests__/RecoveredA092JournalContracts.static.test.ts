import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const editor = readFileSync("src/features/journal/JournalEntryEditor.tsx", "utf8");
const editorState = readFileSync("src/features/journal/useJournalEditorState.ts", "utf8");
const photoPicker = readFileSync("src/features/journal/JournalPhotoPicker.tsx", "utf8");
const photoEncoding = readFileSync("src/features/journal/journalPhotoEncoding.ts", "utf8");
const translationTypes = readFileSync("src/i18n/types.ts", "utf8");

const sheetSources = [
  "src/features/journal/JournalStickerPicker.tsx",
  "src/features/journal/JournalStickerPackManager.tsx",
  "src/features/journal/JournalPhotoPicker.tsx",
  "src/features/journal/JournalTemplatePicker.tsx",
].map((path) => readFileSync(path, "utf8"));

describe("recovered a092 journal contracts", () => {
  it("closes prompt and style layers before editor navigation", () => {
    const keyboardSource =
      /Keyboard shortcuts: Escape[\s\S]*?document\.addEventListener\("keydown", handleKeyDown\);/.exec(
        editorState,
      )?.[0] ?? "";
    const androidBackSource =
      /Android back button \(priority order\)[\s\S]*?const handleRestoreDraft/.exec(
        editorState,
      )?.[0] ?? "";

    for (const source of [keyboardSource, androidBackSource]) {
      expect(source).toContain("if (showPromptsDropdown)");
      expect(source).toContain("setShowPromptsDropdown(false);");
      expect(source).toContain("if (showStyleBar)");
      expect(source).toContain("setShowStyleBar(false);");
    }
    expect(keyboardSource.indexOf("if (showPromptsDropdown)")).toBeLessThan(
      keyboardSource.indexOf("handleBack();"),
    );
  });

  it("keeps portaled diary sheets outside the desktop sidebar hit area", () => {
    for (const source of sheetSources) {
      expect(source).toContain("lg:start-[var(--sidebar-width,256px)]");
    }
  });

  it("preserves template provenance through the editor save payload", () => {
    expect(editor).toContain("templateId?: string;");
    expect(editorState).toContain(
      "const [templateId, setTemplateId] = useState<string | undefined>(entry?.templateId);",
    );
    expect(editorState).toContain("setTemplateId(selectedTemplateId ?? undefined);");
    expect(editorState).toContain("templateId: templateId || undefined,");
  });

  it("does not execute Save and Close for an empty style-only draft", () => {
    const saveAndClose =
      /const handleSaveAndClose = useCallback[\s\S]*?\}, \[[^\]]*\]\);/.exec(editorState)?.[0] ??
      "";
    expect(saveAndClose).toContain("if (!hasContent) return;");
    expect(editor).toContain("disabled={saveInteractionLocked || !hasContent}");
  });

  it("explains when a valid photo cannot fit the bounded cloud payload", () => {
    expect(photoEncoding).toContain(
      'export const JOURNAL_PHOTO_TOO_DETAILED_ERROR = "JOURNAL_PHOTO_TOO_DETAILED";',
    );
    expect(photoEncoding).toContain("throw new Error(JOURNAL_PHOTO_TOO_DETAILED_ERROR);");
    expect(photoPicker).toContain("err.message === JOURNAL_PHOTO_TOO_DETAILED_ERROR");
    expect(editorState).toContain("error.message === JOURNAL_PHOTO_TOO_DETAILED_ERROR");
    expect(translationTypes).toContain("journalPhotoTooDetailed: string;");
  });
});
