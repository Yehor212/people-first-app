import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Loader2, Save, UserRound } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { updateProfileName } from "@/lib/accountService";
import { logger } from "@/lib/logger";
import { safeLocalStorageGet } from "@/lib/safeJson";
import { sanitizeUserName } from "@/lib/sanitize";
import {
  assertSettingsOwnerCurrent,
  SettingsOwnerBoundaryError,
} from "@/lib/settingsOwnerBoundary";
import { SK } from "@/lib/storageKeys";
import { getCurrentSessionUserId } from "@/lib/supabaseClient";
import { userNameSchema } from "@/lib/validation";

import {
  PanelFrame,
  SettingsFieldHeader,
  SettingsInlineButton,
  SettingsStatus,
  SettingsTextInput,
} from "./components/V2SettingsControlPrimitives";
import type { V2SettingsControls } from "./types";

export function getStoredLockTimeoutMs(): number {
  return safeLocalStorageGet<number | null>(SK.JOURNAL_LOCK_TIMEOUT, null) ?? 300_000;
}

export function ProfilePanel({ controls }: { controls: V2SettingsControls }) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const visibleName =
    controls.userName === "Friend" && controls.userNameCustom === false ? "" : controls.userName;
  const [name, setName] = useState(visibleName);
  const [nameStatus, setNameStatus] = useState<string | null>(null);
  const [lastSavedName, setLastSavedName] = useState(visibleName);
  const [isSavingName, setIsSavingName] = useState(false);
  const nameSaveGenerationRef = useRef(0);

  useEffect(() => {
    setName(visibleName);
    setLastSavedName(visibleName);
    setNameStatus(null);
  }, [visibleName]);

  useEffect(() => {
    if (!nameStatus) return;
    const timer = window.setTimeout(() => setNameStatus(null), 2400);
    return () => window.clearTimeout(timer);
  }, [nameStatus]);

  const sanitizedName = sanitizeUserName(name);
  const sanitizedCurrentName = sanitizeUserName(lastSavedName);
  let isNameValid = Boolean(sanitizedName);

  if (isNameValid) {
    try {
      userNameSchema.parse(sanitizedName);
    } catch {
      isNameValid = false;
    }
  }

  const isNameSaveDisabled = isSavingName || !isNameValid || sanitizedName === sanitizedCurrentName;

  const handleNameSave = async () => {
    const sanitized = sanitizeUserName(name);
    if (isSavingName || !sanitized) return;

    try {
      userNameSchema.parse(sanitized);
    } catch {
      setNameStatus(tx.invalidNameFormat || "Invalid name format");
      return;
    }

    const operationGeneration = ++nameSaveGenerationRef.current;
    setIsSavingName(true);
    let expectedOwnerUserId: string | null = null;
    let ownerCaptured = false;

    try {
      expectedOwnerUserId = await getCurrentSessionUserId();
      ownerCaptured = true;
      await assertSettingsOwnerCurrent(expectedOwnerUserId, "Profile name save");
      if (operationGeneration !== nameSaveGenerationRef.current) return;

      setName(sanitized);
      setLastSavedName(sanitized);
      controls.onNameChange(sanitized);
      setNameStatus(tx.nameSaved || "Saved");
      if (!expectedOwnerUserId) {
        setNameStatus(tx.nameSavedLocally || "Saved on this device");
        return;
      }

      const success = await updateProfileName(expectedOwnerUserId, sanitized);
      await assertSettingsOwnerCurrent(expectedOwnerUserId, "Profile name save");
      if (operationGeneration !== nameSaveGenerationRef.current) return;
      if (!success) {
        setNameStatus(tx.nameSavedLocally || "Saved on this device");
      }
    } catch (error) {
      if (error instanceof SettingsOwnerBoundaryError) return;
      if (ownerCaptured) {
        try {
          await assertSettingsOwnerCurrent(expectedOwnerUserId, "Profile name save error");
        } catch (ownerError) {
          if (ownerError instanceof SettingsOwnerBoundaryError) return;
          throw ownerError;
        }
      }
      if (operationGeneration !== nameSaveGenerationRef.current) return;
      logger.error("[V2Settings] Failed to update profile name:", error);
      setNameStatus(tx.nameSavedLocally || "Saved on this device");
    } finally {
      if (operationGeneration === nameSaveGenerationRef.current) {
        setIsSavingName(false);
      }
    }
  };

  const handleNameKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || isNameSaveDisabled) return;
    event.preventDefault();
    void handleNameSave();
  };

  return (
    <PanelFrame
      icon={UserRound}
      title={tx.profile || tx.settingsGroupProfile || "Profile"}
      description={tx.yourName || "Name and personal preferences."}
      testId="settings-v2-panel-profile"
    >
      <SettingsFieldHeader htmlFor="settings-v2-name" title={tx.yourName || "Your name"} />
      <div className="flex flex-col gap-2 min-[520px]:flex-row">
        <SettingsTextInput
          id="settings-v2-name"
          value={name}
          onChange={setName}
          autoComplete="name"
          placeholder={tx.profileNamePlaceholder || "Enter your name"}
          fill
          onKeyDown={handleNameKeyDown}
        />
        <SettingsInlineButton
          icon={isSavingName ? Loader2 : Save}
          isLoading={isSavingName}
          onClick={() => {
            void handleNameSave();
          }}
          disabled={isNameSaveDisabled}
          testId="settings-v2-profile-save"
          variant="primary"
        >
          {isSavingName ? tx.saving || "Saving..." : tx.saveName || "Save name"}
        </SettingsInlineButton>
      </div>
      <div>
        <SettingsStatus>{nameStatus}</SettingsStatus>
      </div>
    </PanelFrame>
  );
}
