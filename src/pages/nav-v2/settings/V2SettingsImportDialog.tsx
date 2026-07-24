import { memo, type RefObject } from "react";

import type { useDataImport } from "@/components/settings/data-section/useDataImport";

import {
  SettingsButtonGrid,
  SettingsChoiceButton,
  SettingsDialog,
  SettingsFieldHeader,
} from "./components/V2SettingsControlPrimitives";

interface V2SettingsImportDialogProps {
  copy: Record<string, string>;
  dataImport: ReturnType<typeof useDataImport>;
  confirmFocusRef: RefObject<HTMLElement | null>;
  returnFocusRef: RefObject<HTMLElement | null>;
}

export const V2SettingsImportDialog = memo(function V2SettingsImportDialog({
  copy,
  dataImport,
  confirmFocusRef,
  returnFocusRef,
}: V2SettingsImportDialogProps) {
  if (!dataImport.showImportConfirm || !dataImport.pendingImportFile) return null;

  return (
    <SettingsDialog
      titleId="settings-v2-import-title"
      title={copy.importConfirmTitle || "Import backup"}
      description={
        dataImport.importMode === "replace"
          ? copy.settingsImportReplaceTooltip ||
            "This replaces current moods, habits, focus sessions, gratitude, and settings included in backups. Diary areas are replaced only when they are present in the backup. Protection settings for this device stay unchanged."
          : copy.importConfirmMessage || "Import data from this backup?"
      }
      detail={dataImport.pendingImportFile.name}
      cancelLabel={copy.cancel}
      confirmLabel={
        dataImport.importMode === "replace"
          ? copy.settingsImportReplaceAction || "Replace with backup"
          : copy.settingsImportTitle || "Import backup"
      }
      confirmVariant={dataImport.importMode === "replace" ? "danger" : "primary"}
      onCancel={dataImport.handleImportCancel}
      confirmFocusRef={confirmFocusRef}
      returnFocusRef={returnFocusRef}
      onConfirm={() => {
        void dataImport.handleImportConfirm();
      }}
    >
      <SettingsFieldHeader title={copy.importMode || "How to import"} />
      <SettingsButtonGrid
        columns="confirm"
        role="group"
        ariaLabel={copy.importMode || "How to import"}
      >
        {(["merge", "replace"] as const).map((mode) => (
          <SettingsChoiceButton
            key={mode}
            onClick={() => dataImport.setImportMode(mode)}
            selected={dataImport.importMode === mode}
            presentation="compact"
            selectedTone={mode === "replace" ? "danger" : "subtle"}
            surface="card"
            testId={`settings-v2-import-mode-${mode}`}
          >
            {mode === "merge"
              ? copy.importMerge || "Add to current data"
              : copy.importReplace || "Replace current data"}
          </SettingsChoiceButton>
        ))}
      </SettingsButtonGrid>
    </SettingsDialog>
  );
});
